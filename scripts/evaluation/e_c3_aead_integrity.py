"""Evaluation C3: AEAD tamper detection.

This is a small local check showing that AES-GCM rejects modified ciphertext.
It does not need a running Docker stack.
"""

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os


def main() -> None:
    key = AESGCM.generate_key(bit_length=256)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    plaintext = b"order-total=100000"
    aad = b"order:demo"

    ciphertext = aesgcm.encrypt(nonce, plaintext, aad)
    tampered = bytearray(ciphertext)
    tampered[-1] ^= 1

    try:
        aesgcm.decrypt(nonce, bytes(tampered), aad)
    except InvalidTag:
        print("PASS: AES-GCM rejected tampered ciphertext with InvalidTag")
        return

    raise SystemExit("FAIL: tampered ciphertext was accepted")


if __name__ == "__main__":
    main()
