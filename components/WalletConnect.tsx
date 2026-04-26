"use client";
import { useState, useEffect } from "react";
import { Wallet, Check, AlertCircle } from "lucide-react";

declare global {
  interface Window { ethereum?: any; }
}

export default function WalletConnect({
  onConnect,
}: {
  onConnect?: (address: string) => void;
}) {
  const [address, setAddress]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [network, setNetwork]   = useState<string | null>(null);
  const [error,   setError]     = useState<string | null>(null);

  const AMOY_CHAIN_ID = "0x13882"; // 80002

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((accs: string[]) => {
      if (accs[0]) { setAddress(accs[0]); onConnect?.(accs[0]); }
    });
    window.ethereum.on("accountsChanged", (accs: string[]) => {
      setAddress(accs[0] || null);
      if (accs[0]) onConnect?.(accs[0]);
    });
    window.ethereum.on("chainChanged", () => window.location.reload());
  }, []);

  async function switchToAmoy() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: AMOY_CHAIN_ID }],
      });
    } catch (e: any) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: AMOY_CHAIN_ID,
            chainName: "Polygon Amoy Testnet",
            nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
            rpcUrls: ["https://rpc-amoy.polygon.technology"],
            blockExplorerUrls: ["https://amoy.polygonscan.com"],
          }],
        });
      }
    }
  }

  async function connect() {
    if (!window.ethereum) {
      setError("MetaMask not installed. Install it at metamask.io");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      await switchToAmoy();
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      setNetwork(chainId === AMOY_CHAIN_ID ? "Polygon Amoy" : `Chain ${parseInt(chainId, 16)}`);
      setAddress(accs[0]);
      onConnect?.(accs[0]);
    } catch (e: any) {
      setError(e.message || "Connection failed");
    }
    setLoading(false);
  }

  if (address) {
    return (
      <div style={{
        display:"flex", alignItems:"center", gap:8,
        background:"#14532d18", border:"1px solid #14532d44",
        borderRadius:10, padding:"8px 14px",
      }}>
        <div style={{
          width:8, height:8, borderRadius:"50%",
          background:"#22c55e", boxShadow:"0 0 6px #22c55e88",
        }}/>
        <div>
          <div style={{ fontSize:11, color:"#22c55e", fontWeight:700 }}>
            {network || "Connected"}
          </div>
          <div style={{ fontSize:11, color:"#71717a", fontFamily:"monospace" }}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
        </div>
        <Check size={13} style={{ color:"#22c55e", marginLeft:4 }}/>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={connect}
        disabled={loading}
        style={{
          display:"flex", alignItems:"center", gap:7,
          background:"linear-gradient(135deg,#7c3aed,#06b6d4)",
          color:"white", border:"none", borderRadius:10,
          padding:"10px 18px", fontSize:13, fontWeight:700,
          cursor:"pointer", opacity: loading ? 0.7 : 1,
          transition:"all 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.02)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Wallet size={14}/>
        {loading ? "Connecting..." : "Connect MetaMask"}
      </button>
      {error && (
        <div style={{
          display:"flex", alignItems:"center", gap:6, marginTop:8,
          fontSize:12, color:"#ef4444",
        }}>
          <AlertCircle size={12}/> {error}
        </div>
      )}
    </div>
  );
}
