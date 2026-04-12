# gen_certs.py — Tạo cert TLS 1.3 cho D1
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Tham số thay đổi nếu cần 
DAYS     = 365
CA_CN    = "CloudAPI"
CA_ORG   = "NT-219"
KONG_CN  = "localhost"                                  # đổi thành IP/domain nếu deploy server thật
BACK_CN  = "api-backend"                                # phải khớp tên container trong docker-compose.yml
CERT_DIR = Path(__file__).parent.parent / "certs"       # luôn đúng đường dẫn

CERT_DIR.mkdir(exist_ok=True)
print(f"📁 Thư mục cert: {CERT_DIR}")

def make_key():
    return rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

def save_key(key, path):
    path.write_bytes(key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ))
    print(f"  - {path.name}")

def save_cert(cert, path):
    path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    print(f"  - {path.name}")

def base_cert(cn, org, issuer_name, pub_key, ca_key, days):
    now = datetime.now(timezone.utc)
    return (
        x509.CertificateBuilder()
        .subject_name(x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, cn),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, org),
        ]))
        .issuer_name(issuer_name)
        .public_key(pub_key)
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + timedelta(days=days))
        .sign(ca_key, hashes.SHA256())
    )

# CA 
print("\n Tạo CA...")
ca_key = make_key()
ca_name = x509.Name([
    x509.NameAttribute(NameOID.COMMON_NAME, CA_CN),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, CA_ORG),
])
now = datetime.now(timezone.utc)
ca_cert = (
    x509.CertificateBuilder()
    .subject_name(ca_name)
    .issuer_name(ca_name)
    .public_key(ca_key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now)
    .not_valid_after(now + timedelta(days=DAYS))
    .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
    .sign(ca_key, hashes.SHA256())
)
save_key(ca_key,  CERT_DIR / "ca.key")
save_cert(ca_cert, CERT_DIR / "ca.crt")

# Kong
print("\n Tạo cert cho Kong...")
kong_key  = make_key()
kong_cert = base_cert(KONG_CN, "NT219-KONG", ca_cert.subject,
                      kong_key.public_key(), ca_key, DAYS)
save_key(kong_key,   CERT_DIR / "kong.key")
save_cert(kong_cert, CERT_DIR / "kong.crt")

# Backend 
print("\n  Tạo cert cho FastAPI Backend...")
back_key  = make_key()
back_cert = base_cert(BACK_CN, "NT219-BACKEND", ca_cert.subject,
                      back_key.public_key(), ca_key, DAYS)
save_key(back_key,   CERT_DIR / "backend.key")
save_cert(back_cert, CERT_DIR / "backend.crt")

# Verify 
print("\n  Verify...")
from cryptography.hazmat.primitives.asymmetric import padding
ca_pub = ca_cert.public_key()
for name, cert in [("kong.crt", kong_cert), ("backend.crt", back_cert)]:
    ca_pub.verify(
        cert.signature,
        cert.tbs_certificate_bytes,
        padding.PKCS1v15(),
        cert.signature_hash_algorithm,
    )
    print(f"  - {name}: OK")

print(f"\n✅ Xong! Các file trong {CERT_DIR}:")