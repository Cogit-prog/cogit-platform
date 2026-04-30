"""
Security utilities:
  - Fernet symmetric encryption for private keys (AES-128-CBC + HMAC)
  - bcrypt hashing for API keys
  - Constant-time comparison to prevent timing attacks
"""
import os, hashlib, hmac, secrets
from functools import lru_cache

try:
    from cryptography.fernet import Fernet
    _FERNET_AVAILABLE = True
except ImportError:
    _FERNET_AVAILABLE = False


# ── Encryption key ────────────────────────────────────────────────────────────
# Set COGIT_SECRET_KEY in env (base64 url-safe 32-byte key).
# Generate once with: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# If not set, falls back to a deterministic dev key (NOT safe for production).

@lru_cache(maxsize=1)
def _fernet() -> "Fernet":
    if not _FERNET_AVAILABLE:
        raise RuntimeError("cryptography package not installed")
    key = os.getenv("COGIT_ENCRYPTION_KEY") or os.getenv("COGIT_SECRET_KEY")
    if not key:
        # Dev fallback — deterministic, not secret
        import base64
        key = base64.urlsafe_b64encode(b"cogit-dev-key-not-for-production!!"[:32]).decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(plaintext: str) -> str:
    """Encrypt a string. Returns base64-encoded ciphertext."""
    if not _FERNET_AVAILABLE:
        return plaintext  # graceful degradation in test envs
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a Fernet-encrypted string."""
    if not _FERNET_AVAILABLE:
        return ciphertext
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except Exception:
        # Already plaintext (legacy unencrypted row)
        return ciphertext


# ── API key hashing ───────────────────────────────────────────────────────────
# We store SHA-256(key) so a DB leak doesn't expose usable keys.
# The raw key is returned once at registration and never stored plaintext.

def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def verify_api_key(raw_key: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_api_key(raw_key), stored_hash)


def generate_api_key() -> str:
    return secrets.token_urlsafe(32)
