"""
Cogit 신원 시스템 — ERC-725+735 원리, 오프체인 구현
- 비용: 0원 (영구 무료)
- 보안: Ethereum 동일 암호학 (secp256k1)
- 업그레이드: 나중에 온체인으로 그대로 이전 가능
"""
import json, time, hashlib
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_keys import keys


# ── 클레임 타입 ──────────────────────────────────────
CLAIM_TYPES = {
    "DOMAIN_EXPERT":   "0x01",  # 도메인 전문성 인증
    "TRUST":           "0x02",  # 신뢰 클레임
    "COLLABORATION":   "0x03",  # 협업 성공 기록
    "INSIGHT_QUALITY": "0x04",  # 인사이트 품질 인증
}


def generate_identity() -> dict:
    """에이전트 신원 키쌍 생성 — 무료, 즉시"""
    acct = Account.create()
    return {
        "address":     acct.address,          # 공개 신원 (공유 가능)
        "private_key": acct.key.hex(),        # 서명 키 (비공개)
        "public_key":  acct.key.hex(),        # 내부 보관용
    }


def sign_claim(issuer_private_key: str, subject_address: str,
               claim_type: str, data: dict) -> dict:
    """
    클레임 발행 — 발행자가 대상 에이전트에 대해 서명된 증명 발행
    ERC-735 Claim 구조와 호환
    """
    payload = {
        "subject":    subject_address,
        "claim_type": claim_type,
        "data":       data,
        "issued_at":  int(time.time()),
    }
    payload_str  = json.dumps(payload, sort_keys=True)
    payload_hash = hashlib.sha256(payload_str.encode()).hexdigest()

    msg      = encode_defunct(hexstr=payload_hash)
    signed   = Account.sign_message(msg, private_key=issuer_private_key)
    issuer   = Account.from_key(issuer_private_key).address

    return {
        "issuer":     issuer,
        "subject":    subject_address,
        "claim_type": claim_type,
        "data":       data,
        "issued_at":  payload["issued_at"],
        "signature":  signed.signature.hex(),
        "hash":       payload_hash,
    }


def verify_claim(claim: dict) -> bool:
    """클레임 서명 검증 — 누구나 무료로 검증 가능"""
    try:
        payload = {
            "subject":    claim["subject"],
            "claim_type": claim["claim_type"],
            "data":       claim["data"],
            "issued_at":  claim["issued_at"],
        }
        payload_str  = json.dumps(payload, sort_keys=True)
        payload_hash = hashlib.sha256(payload_str.encode()).hexdigest()

        msg        = encode_defunct(hexstr=payload_hash)
        recovered  = Account.recover_message(msg, signature=bytes.fromhex(claim["signature"]))
        return recovered.lower() == claim["issuer"].lower()
    except Exception:
        return False


def get_trust_score_from_claims(claims: list) -> float:
    """클레임 목록으로 신뢰 점수 계산"""
    if not claims:
        return 0.5

    weights = {
        "TRUST":           1.0,
        "COLLABORATION":   0.8,
        "INSIGHT_QUALITY": 0.6,
        "DOMAIN_EXPERT":   0.5,
    }
    total, count = 0.0, 0
    for c in claims:
        if not verify_claim(c):
            continue
        w      = weights.get(c["claim_type"], 0.3)
        value  = c["data"].get("value", 1.0)
        total += w * value
        count += 1

    if count == 0:
        return 0.5
    return min(1.0, 0.5 + (total / count) * 0.1)
