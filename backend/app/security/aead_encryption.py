import os
import base64
import logging

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

VAULT_ADDR = os.getenv("VAULT_ADDR", "http://vault:8200")
VAULT_TOKEN = os.getenv("VAULT_TOKEN", "root")
VAULT_KEY_NAME = os.getenv("VAULT_KEY_NAME", "dek")
VAULT_WRAPPED_DEK = os.getenv("VAULT_WRAPPED_DEK", "")

def _vault_headers() -> dict[str, str]:
    return {
        "X-Vault-Token": VAULT_TOKEN,
        "Content-Type": "application/json",
    }

def wrap_dek_with_vault(raw_dek: bytes) -> str:
    if len(raw_dek) != 32:
        raise ValueError(f"DEK phải là 32 bytes, nhận {len(raw_dek)}")
    b64_dek = base64.b64encode(raw_dek).decode()
    resp = httpx.post(
        f"{VAULT_ADDR}/v1/transit/encrypt/{VAULT_KEY_NAME}",
        headers=_vault_headers(),
        json={"plaintext": b64_dek},
        timeout=5,
    )
    resp.raise_for_status()
    return resp.json()["data"]["ciphertext"]


def get_dek_from_vault() -> bytes:
    """
    Unwrap DEK từ ciphertext đã bọc bởi Vault Transit KEK.
    """
    if not VAULT_WRAPPED_DEK:
        raise ValueError("VAULT_WRAPPED_DEK chưa được set trong environment")
    resp2 = httpx.post(
        f"{VAULT_ADDR}/v1/transit/decrypt/{VAULT_KEY_NAME}",
        headers=_vault_headers(),
        json={"ciphertext": VAULT_WRAPPED_DEK},
        timeout=5,
    )
    resp2.raise_for_status()
    dek = base64.b64decode(resp2.json()["data"]["plaintext"])
    assert len(dek) == 32
    logger.info("DEK unwrapped from Vault Transit")
    return dek


def get_dek() -> bytes:
    """
    Vault-only loader: chỉ lấy DEK bằng cách unwrap từ Vault Transit.
    """
    return get_dek_from_vault()


# ─── AEAD encrypt / decrypt ───────────────────────────────────────────────────
def encrypt_field(text: str, dek: bytes) -> bytes:
    """
    Mã hoá field nhạy cảm bằng AES-256-GCM.
    Output: 12B nonce || ciphertext || 16B GCM tag
    """
    nonce = os.urandom(12)
    aes = AESGCM(dek)
    ct = aes.encrypt(nonce, text.encode("utf-8"), None)
    return nonce + ct


def decrypt_field(data: bytes, dek: bytes) -> str:
    """
    Giải mã field. Raises cryptography.exceptions.InvalidTag nếu bị tamper.
    """
    nonce = data[:12]
    ct = data[12:]
    aes = AESGCM(dek)
    return aes.decrypt(nonce, ct, None).decode("utf-8")
