#!/usr/bin/env python3
"""
Generate self-signed TLS certificates for local development.
Creates a local CA and a localhost certificate trusted by all services.
Also creates a ca-bundle combining local CA + internal CA so the backend
can verify both Keycloak (local CA) and Postgres/Redis (internal CA).

Usage:
    python scripts/gen_local_certs.py

Output: certs-local/
    ca.crt, ca.key          ← Local CA (import into Windows trust store)
    localhost.crt, .key     ← Cert for all public-facing services
    ca-bundle.crt           ← ca.crt + internal-certs/ca.crt (for backend)
"""

import subprocess
import sys
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
OUT_DIR      = Path("certs-local")
CA_KEY       = OUT_DIR / "ca.key"
CA_CRT       = OUT_DIR / "ca.crt"
SRV_KEY      = OUT_DIR / "localhost.key"
SRV_CSR      = OUT_DIR / "localhost.csr"
SRV_CRT      = OUT_DIR / "localhost.crt"
EXT_FILE     = OUT_DIR / "localhost.ext"
BUNDLE       = OUT_DIR / "ca-bundle.crt"
INTERNAL_CA  = Path("internal-certs/ca.crt")

DAYS_CA   = 3650
DAYS_CERT = 825

SAN = """[req]
req_extensions     = v3_req
distinguished_name = dn
prompt             = no

[dn]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = keycloak
DNS.3 = api-backend
DNS.4 = api-gateway
DNS.5 = api-waf
IP.1  = 127.0.0.1
IP.2  = ::1
"""
# ──────────────────────────────────────────────────────────────────────────────


def run(cmd: list[str], desc: str) -> None:
    print(f"  ▸ {desc}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ERROR] {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n📁 Output: {OUT_DIR.resolve()}\n")

    # 1. Local CA
    print("── Step 1: Generate CA key & certificate")
    run(["openssl", "genrsa", "-out", str(CA_KEY), "4096"],
        "Generate CA private key (RSA-4096)")
    run([
        "openssl", "req", "-x509", "-new", "-nodes",
        "-key", str(CA_KEY), "-sha256", "-days", str(DAYS_CA),
        "-out", str(CA_CRT),
        "-subj", "/C=VN/ST=HCM/O=LocalDev/CN=LocalDev-CA",
    ], "Self-sign CA certificate")

    # 2. Server key + CSR
    print("\n── Step 2: Generate server key & CSR")
    run(["openssl", "genrsa", "-out", str(SRV_KEY), "2048"],
        "Generate server private key (RSA-2048)")
    EXT_FILE.write_text(SAN)
    run([
        "openssl", "req", "-new",
        "-key", str(SRV_KEY), "-out", str(SRV_CSR),
        "-config", str(EXT_FILE),
    ], "Create CSR")

    # 3. Sign cert
    print("\n── Step 3: Sign server certificate with local CA")
    run([
        "openssl", "x509", "-req",
        "-in", str(SRV_CSR),
        "-CA", str(CA_CRT), "-CAkey", str(CA_KEY), "-CAcreateserial",
        "-out", str(SRV_CRT),
        "-days", str(DAYS_CERT), "-sha256",
        "-extensions", "v3_req", "-extfile", str(EXT_FILE),
    ], "Sign certificate (SAN: localhost + container names)")

    # 4. Verify
    print("\n── Step 4: Verify")
    result = subprocess.run(
        ["openssl", "verify", "-CAfile", str(CA_CRT), str(SRV_CRT)],
        capture_output=True, text=True)
    print(f"  ▸ {result.stdout.strip()}")
    result = subprocess.run(
        ["openssl", "x509", "-in", str(SRV_CRT), "-noout", "-text"],
        capture_output=True, text=True)
    for line in result.stdout.splitlines():
        if "DNS:" in line or "IP Address:" in line:
            print(f"  ▸ SAN: {line.strip()}")

    # 5. CA bundle = local CA + internal CA
    print("\n── Step 5: Create CA bundle")
    if INTERNAL_CA.exists():
        BUNDLE.write_text(CA_CRT.read_text() + INTERNAL_CA.read_text())
        print(f"  ▸ {BUNDLE} = certs-local/ca.crt + internal-certs/ca.crt")
        print(f"     Backend dùng file này để trust cả Keycloak lẫn Postgres/Redis")
    else:
        print(f"  ⚠ {INTERNAL_CA} chưa tồn tại, bỏ qua bundle")
        print(f"     Chạy lại script sau khi có internal-certs/ca.crt")

    # Cleanup
    SRV_CSR.unlink(missing_ok=True)
    EXT_FILE.unlink(missing_ok=True)

    print(f"""
  Done! Files:
   {CA_CRT}          ← import vào Windows
   {CA_KEY}          ← giữ bí mật, không commit
   {SRV_CRT}     ← dùng cho keycloak, kong, waf, frontend
   {SRV_KEY}     ← private key tương ứng
   {BUNDLE}    ← backend dùng để trust Keycloak + Postgres

📌 Import CA (PowerShell Admin):
   certutil -addstore -f "ROOT" certs-local\\ca.crt

📌 Thêm vào .gitignore:
   certs-local/
""")


if __name__ == "__main__":
    main()