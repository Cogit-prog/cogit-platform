"""
Polygon web3 integration for Cogit API Marketplace.
Gracefully falls back to off-chain mode if web3 is unavailable or contract not deployed.

Setup:
  pip install web3
  export POLYGON_RPC="https://rpc-amoy.polygon.technology"   # testnet (free)
  export COGIT_CONTRACT="0x..."                               # after Remix deploy
"""
import os

POLYGON_RPC   = os.getenv("POLYGON_RPC", "https://rpc-amoy.polygon.technology")
CONTRACT_ADDR = os.getenv("COGIT_CONTRACT", "")
CHAIN_ID      = int(os.getenv("POLYGON_CHAIN_ID", "80002"))  # Amoy testnet

# Minimal ABI — only what we need
_ABI = [
    {
        "name": "registerService",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "serviceId",   "type": "bytes32"},
            {"name": "priceWei",    "type": "uint256"},
            {"name": "name",        "type": "string"},
            {"name": "description", "type": "string"},
            {"name": "endpointUrl", "type": "string"},
            {"name": "domain",      "type": "string"},
        ],
        "outputs": [],
    },
    {
        "name": "payForCall",
        "type": "function",
        "stateMutability": "payable",
        "inputs": [{"name": "serviceId", "type": "bytes32"}],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "rate",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "provider", "type": "address"},
            {"name": "score",    "type": "uint256"},
        ],
        "outputs": [],
    },
    {
        "name": "getService",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "serviceId", "type": "bytes32"}],
        "outputs": [
            {"name": "provider",       "type": "address"},
            {"name": "priceWei",       "type": "uint256"},
            {"name": "name",           "type": "string"},
            {"name": "active",         "type": "bool"},
            {"name": "totalCalls",     "type": "uint256"},
            {"name": "totalEarnedWei", "type": "uint256"},
        ],
    },
    {
        "name": "reputation",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "provider", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "CallPaid",
        "type": "event",
        "inputs": [
            {"name": "serviceId", "type": "bytes32", "indexed": True},
            {"name": "caller",    "type": "address", "indexed": True},
            {"name": "provider",  "type": "address", "indexed": True},
            {"name": "amount",    "type": "uint256", "indexed": False},
            {"name": "totalCalls","type": "uint256", "indexed": False},
        ],
    },
]

_w3       = None
_contract = None


def _init():
    global _w3, _contract
    try:
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider(POLYGON_RPC, request_kwargs={"timeout": 6}))
        if not w3.is_connected():
            return
        _w3 = w3
        if CONTRACT_ADDR:
            _contract = w3.eth.contract(
                address=Web3.to_checksum_address(CONTRACT_ADDR),
                abi=_ABI,
            )
    except Exception:
        pass


_init()


def is_connected() -> bool:
    return _w3 is not None and _w3.is_connected()


def has_contract() -> bool:
    return _contract is not None


def _service_id_bytes(service_id: str) -> bytes:
    """Convert short service ID string to bytes32."""
    from web3 import Web3
    return Web3.keccak(text=service_id)


def get_network_info() -> dict:
    if not _w3:
        return {"connected": False, "mode": "simulation"}
    return {
        "connected": True,
        "chain_id": _w3.eth.chain_id,
        "contract": CONTRACT_ADDR or None,
        "mode": "on-chain" if _contract else "connected-no-contract",
        "rpc": POLYGON_RPC,
    }


def get_on_chain_stats(service_id: str) -> dict | None:
    if not _contract:
        return None
    try:
        sid = _service_id_bytes(service_id)
        result = _contract.functions.getService(sid).call()
        return {
            "on_chain": True,
            "total_calls_chain": result[4],
            "total_earned_matic": float(_w3.from_wei(result[5], "ether")),
            "active_chain": result[3],
        }
    except Exception:
        return None


def get_reputation_on_chain(address: str) -> int | None:
    if not _contract:
        return None
    try:
        from web3 import Web3
        return _contract.functions.reputation(
            Web3.to_checksum_address(address)
        ).call()
    except Exception:
        return None


def build_register_tx(
    service_id: str,
    price_matic: float,
    name: str,
    description: str,
    endpoint_url: str,
    domain: str,
    from_address: str,
) -> dict | None:
    """
    Build unsigned registerService transaction for MetaMask to sign.
    Returns serialisable dict compatible with eth_sendTransaction.
    """
    if not _contract or not _w3:
        return None
    try:
        from web3 import Web3
        sid       = _service_id_bytes(service_id)
        price_wei = _w3.to_wei(price_matic, "ether")
        checksum  = Web3.to_checksum_address(from_address)
        tx = _contract.functions.registerService(
            sid, price_wei, name, description, endpoint_url, domain
        ).build_transaction({
            "from":     checksum,
            "gas":      250000,
            "gasPrice": _w3.eth.gas_price,
            "nonce":    _w3.eth.get_transaction_count(checksum),
            "chainId":  _w3.eth.chain_id,
        })
        # Convert bytes values to hex for JSON serialisation
        tx["data"] = tx["data"].hex() if isinstance(tx.get("data"), bytes) else tx.get("data")
        return tx
    except Exception:
        return None


def build_pay_tx(
    service_id: str,
    price_matic: float,
    from_address: str,
    provider_address: str,
) -> dict:
    """
    Build payment transaction.
    With contract: calls payForCall() — tracks stats on-chain.
    Without contract: direct transfer to provider (simpler).
    Returns dict ready for MetaMask eth_sendTransaction.
    """
    if _w3:
        price_wei = _w3.to_wei(price_matic, "ether")
    else:
        # Fallback calculation (1 MATIC = 1e18 wei)
        price_wei = int(price_matic * 10**18)

    if _contract and _w3:
        try:
            from web3 import Web3
            sid      = _service_id_bytes(service_id)
            checksum = Web3.to_checksum_address(from_address)
            tx = _contract.functions.payForCall(sid).build_transaction({
                "from":     checksum,
                "value":    price_wei,
                "gas":      100000,
                "gasPrice": _w3.eth.gas_price,
                "nonce":    _w3.eth.get_transaction_count(checksum),
                "chainId":  _w3.eth.chain_id,
            })
            tx["data"] = tx["data"].hex() if isinstance(tx.get("data"), bytes) else tx.get("data")
            return tx
        except Exception:
            pass

    # Fallback: direct transfer
    return {
        "to":       provider_address,
        "from":     from_address,
        "value":    hex(price_wei),
        "gas":      hex(21000),
        "chainId":  hex(CHAIN_ID),
        "data":     "0x",
    }


def verify_tx(tx_hash: str) -> dict | None:
    """Verify a transaction was mined and return details."""
    if not _w3:
        return None
    try:
        receipt = _w3.eth.get_transaction_receipt(tx_hash)
        if receipt:
            return {
                "confirmed": receipt["status"] == 1,
                "block":     receipt["blockNumber"],
                "gas_used":  receipt["gasUsed"],
            }
    except Exception:
        pass
    return None
