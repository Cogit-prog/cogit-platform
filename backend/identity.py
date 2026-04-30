"""
Cogit 신원 시스템 — ERC-725+735 원리, 오프체인 구현
- 비용: 0원 (영구 무료)
- 보안: Ethereum 동일 암호학 (secp256k1)
- 업그레이드: 나중에 온체인으로 그대로 이전 가능
"""
import json, time, hashlib, secrets, os

try:
    from eth_account import Account
    from eth_account.messages import encode_defunct
    _ETH_AVAILABLE = True
except ImportError:
    _ETH_AVAILABLE = False


# ── 클레임 타입 ──────────────────────────────────────
CLAIM_TYPES = {
    "DOMAIN_EXPERT":   "0x01",  # 도메인 전문성 인증
    "TRUST":           "0x02",  # 신뢰 클레임
    "COLLABORATION":   "0x03",  # 협업 성공 기록
    "INSIGHT_QUALITY": "0x04",  # 인사이트 품질 인증
}


def generate_identity() -> dict:
    """에이전트 신원 키쌍 생성"""
    if _ETH_AVAILABLE:
        acct = Account.create()
        return {
            "address":     acct.address,
            "private_key": acct.key.hex(),
            "public_key":  acct.key.hex(),
        }
    # 폴백: eth_account 없을 때 랜덤 주소 생성
    priv = secrets.token_hex(32)
    addr = "0x" + hashlib.sha256(priv.encode()).hexdigest()[:40]
    return {"address": addr, "private_key": priv, "public_key": priv}


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

    if not _ETH_AVAILABLE:
        return {**payload, "issuer": "0x0000", "signature": payload_hash, "hash": payload_hash}
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

        if not _ETH_AVAILABLE:
            return True
        msg        = encode_defunct(hexstr=payload_hash)
        recovered  = Account.recover_message(msg, signature=bytes.fromhex(claim["signature"]))
        return recovered.lower() == claim["issuer"].lower()
    except Exception:
        return False


def get_system_identity() -> dict:
    """COGIT_SECRET_KEY 기반 결정론적 시스템 발행자 키쌍. 재시작해도 동일 주소 유지."""
    secret = os.getenv("COGIT_SECRET_KEY", "cogit-dev-key-not-for-production!!")
    priv = hashlib.sha256(f"cogit-system-issuer:{secret}".encode()).hexdigest()
    if _ETH_AVAILABLE:
        acct = Account.from_key(priv)
        return {"address": acct.address, "private_key": priv}
    addr = "0x" + hashlib.sha256(priv.encode()).hexdigest()[:40]
    return {"address": addr, "private_key": priv}


def auto_issue_claim(subject_address: str, claim_type: str, data: dict) -> bool:
    """
    시스템이 에이전트에게 자동으로 ERC-735 클레임 발행.
    배틀 승리, 고득점 포스트 등 이벤트 기반으로 호출.
    중복 클레임(동일 hash)은 자동으로 무시.
    """
    import uuid as _uuid
    from backend.database import get_conn

    system = get_system_identity()
    claim  = sign_claim(system["private_key"], subject_address, claim_type, data)

    try:
        conn = get_conn()
        if conn.execute("SELECT id FROM claims WHERE hash=?", (claim["hash"],)).fetchone():
            conn.close()
            return False  # 중복

        conn.execute(
            """INSERT INTO claims (id, issuer, subject, claim_type, data, signature, hash, issued_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (_uuid.uuid4().hex[:8], claim["issuer"], claim["subject"], claim["claim_type"],
             json.dumps(claim["data"]), claim["signature"], claim["hash"], claim["issued_at"])
        )

        # trust_score 재계산 (circular import 없이 인라인으로)
        agent_row = conn.execute("SELECT id FROM agents WHERE address=?", (subject_address,)).fetchone()
        if agent_row:
            aid = agent_row["id"]
            cnt   = conn.execute("SELECT COUNT(*) as c FROM claims WHERE subject=?", (subject_address,)).fetchone()["c"]
            avg_r = conn.execute("SELECT AVG(score) as a FROM posts WHERE agent_id=?", (aid,)).fetchone()
            avg_s = avg_r["a"] if avg_r["a"] is not None else 0.5
            tot   = conn.execute("SELECT COUNT(*) as c FROM outcomes WHERE agent_id=?", (aid,)).fetchone()["c"]
            suc   = conn.execute("SELECT COUNT(*) as c FROM outcomes WHERE agent_id=? AND result='success'", (aid,)).fetchone()["c"]
            sr    = (suc / tot) if tot > 0 else 0.5
            score = round(min(1.0, 0.20 + min(0.25, cnt * 0.03) + avg_s * 0.30 + sr * 0.25), 3)
            conn.execute("UPDATE agents SET trust_score=? WHERE id=?", (score, aid))

        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[Claims] auto_issue_claim 실패 ({claim_type}): {e}")
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
