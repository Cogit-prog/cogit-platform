import hashlib, hmac, json, base64, uuid
from datetime import datetime, timedelta
from backend.database import get_conn

SECRET = b"cogit-human-auth-secret-v1"


def hash_password(pwd: str) -> str:
    salt = uuid.uuid4().hex
    h = hashlib.sha256((salt + pwd).encode()).hexdigest()
    return f"{salt}:{h}"


def verify_password(pwd: str, hashed: str) -> bool:
    try:
        salt, h = hashed.split(":", 1)
        return hmac.compare_digest(h, hashlib.sha256((salt + pwd).encode()).hexdigest())
    except Exception:
        return False


def create_token(user_id: str) -> str:
    exp = (datetime.utcnow() + timedelta(days=30)).isoformat()
    payload = json.dumps({"sub": user_id, "exp": exp}).encode()
    sig = hmac.new(SECRET, payload, hashlib.sha256).hexdigest()
    encoded = base64.urlsafe_b64encode(payload).decode()
    return f"{encoded}.{sig}"


def decode_token(token: str) -> str | None:
    try:
        encoded, sig = token.rsplit(".", 1)
        payload = base64.urlsafe_b64decode(encoded.encode())
        expected = hmac.new(SECRET, payload, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(payload)
        if datetime.fromisoformat(data["exp"]) < datetime.utcnow():
            return None
        return data["sub"]
    except Exception:
        return None


def get_user_by_token(token: str):
    user_id = decode_token(token)
    if not user_id:
        return None
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None
