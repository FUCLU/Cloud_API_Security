"""
backend/app/security/aead_encryption.py

Fix so với bản gốc:
- Thêm load_dek_from_env() alias để seed_data.py không bị ImportError
- Thêm get_dek_from_vault() dùng Vault Transit (dùng khi Vault available)
- Hàm load_dek() giữ nguyên (đọc DEK_BASE64 từ env)
- Tất cả tên hàm đồng nhất
"""

import os
import base64
import logging

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

VAULT_ADDR = os.getenv("VAULT_ADDR", "http://vault:8200")
VAULT_TOKEN = os.getenv("VAULT_TOKEN", "root")
VAULT_KEY_NAME = os.getenv("VAULT_KEY_NAME", "dek")


# ─── DEK loaders ─────────────────────────────────────────────────────────────


def load_dek() -> bytes:
    """
    Đọc DEK từ env var DEK_BASE64.
    Dùng khi không có Vault (local dev / CI).
    """
    raw = os.getenv("DEK_BASE64", "")
    if not raw:
        raise ValueError("DEK_BASE64 chưa được set trong environment")
    key = base64.b64decode(raw)
    assert len(key) == 32, f"DEK phải là 32 bytes, nhận {len(key)}"
    return key


# Alias để seed_data.py import không lỗi
load_dek_from_env = load_dek


def get_dek_from_vault() -> bytes:
    """
    Tạo DEK mới, encrypt bằng Vault Transit KEK, decrypt lại → raw DEK.
    Dùng trong production khi Vault available.
    """
    raw_dek = os.urandom(32)
    b64_dek = base64.b64encode(raw_dek).decode()

    headers = {
        "X-Vault-Token": VAULT_TOKEN,
        "Content-Type": "application/json",
    }

    # Encrypt
    resp = httpx.post(
        f"{VAULT_ADDR}/v1/transit/encrypt/{VAULT_KEY_NAME}",
        headers=headers,
        json={"plaintext": b64_dek},
        timeout=5,
    )
    resp.raise_for_status()
    encrypted = resp.json()["data"]["ciphertext"]

    # Decrypt lại → raw DEK
    resp2 = httpx.post(
        f"{VAULT_ADDR}/v1/transit/decrypt/{VAULT_KEY_NAME}",
        headers=headers,
        json={"ciphertext": encrypted},
        timeout=5,
    )
    resp2.raise_for_status()
    dek = base64.b64decode(resp2.json()["data"]["plaintext"])
    assert len(dek) == 32
    logger.info("DEK fetched from Vault Transit")
    return dek


def get_dek() -> bytes:
    """
    Smart loader: thử Vault trước, fallback về DEK_BASE64.
    Đây là hàm nên dùng trong production code.
    """
    try:
        return get_dek_from_vault()
    except Exception as e:
        logger.warning(f"Vault unavailable ({e}), falling back to DEK_BASE64")
        return load_dek()


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
