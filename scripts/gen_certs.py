# gen_certs.py — Tạo bộ cert TLS/mTLS cho D1/D2
import ipaddress
from cryptography import x509
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Tham số thay đổi nếu cần
CA_DAYS = 3650
SERVER_DAYS = 825
CLIENT_DAYS = 365
CA_CN = "CloudAPI Root CA"
CA_ORG = "NT219"
CERT_DIR = Path(__file__).parent.parent / "certs"

CERT_DIR.mkdir(exist_ok=True)
print(f"Thư mục cert: {CERT_DIR}")


def make_key():
    # ECDSA P-256 tương ứng secp256r1/prime256v1, phổ biến cho TLS hiện đại.
    return ec.generate_private_key(ec.SECP256R1())


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


def dns(name):
    return x509.DNSName(name)


def ip(addr):
    return x509.IPAddress(ipaddress.ip_address(addr))


def cert_builder(cn, org, issuer_name, pub_key, days):
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
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(days=days))
    )


def make_ca():
    print("\nTạo CA...")
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
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(days=CA_DAYS))
        .add_extension(x509.BasicConstraints(ca=True, path_length=1), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_cert_sign=True,
                crl_sign=True,
                key_encipherment=False,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()), critical=False)
        .sign(ca_key, hashes.SHA256())
    )
    save_key(ca_key, CERT_DIR / "ca.key")
    save_cert(ca_cert, CERT_DIR / "ca.crt")
    return ca_key, ca_cert


def make_server_cert(name, org, san_entries, ca_key, ca_cert):
    print(f"\nTạo server cert cho {name}...")
    key = make_key()
    cert = (
        cert_builder(name, org, ca_cert.subject, key.public_key(), SERVER_DAYS)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_encipherment=False,
                key_cert_sign=False,
                crl_sign=False,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .add_extension(x509.SubjectAlternativeName(san_entries), critical=False)
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()),
            critical=False,
        )
        .sign(ca_key, hashes.SHA256())
    )
    save_key(key, CERT_DIR / f"{name}.key")
    save_cert(cert, CERT_DIR / f"{name}.crt")
    return key, cert


def make_client_cert(name, org, ca_key, ca_cert):
    print(f"\nTạo client cert cho {name}...")
    key = make_key()
    cert = (
        cert_builder(name, org, ca_cert.subject, key.public_key(), CLIENT_DAYS)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_encipherment=False,
                key_cert_sign=False,
                crl_sign=False,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.CLIENT_AUTH]), critical=False)
        .add_extension(x509.SubjectAlternativeName([dns(name)]), critical=False)
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()),
            critical=False,
        )
        .sign(ca_key, hashes.SHA256())
    )
    save_key(key, CERT_DIR / f"{name}.key")
    save_cert(cert, CERT_DIR / f"{name}.crt")
    return key, cert


ca_key, ca_cert = make_ca()

leaf_certs = []
_, kong_cert = make_server_cert(
    "kong",
    "NT219-KONG",
    [dns("localhost"), dns("api-gateway"), dns("kong"), ip("127.0.0.1")],
    ca_key,
    ca_cert,
)
leaf_certs.append(("kong.crt", kong_cert))

_, frontend_cert = make_server_cert(
    "frontend",
    "NT219-FRONTEND",
    [dns("localhost"), dns("api-frontend"), dns("frontend"), ip("127.0.0.1")],
    ca_key,
    ca_cert,
)
leaf_certs.append(("frontend.crt", frontend_cert))

_, backend_cert = make_server_cert(
    "backend",
    "NT219-BACKEND",
    [dns("localhost"), dns("api-backend"), dns("backend"), ip("127.0.0.1")],
    ca_key,
    ca_cert,
)
leaf_certs.append(("backend.crt", backend_cert))

_, client_cert = make_client_cert("client", "NT219-CLIENT", ca_key, ca_cert)
leaf_certs.append(("client.crt", client_cert))

print("\nVerify chain...")
ca_pub = ca_cert.public_key()
for name, cert in leaf_certs:
    ca_pub.verify(
        cert.signature,
        cert.tbs_certificate_bytes,
        ec.ECDSA(cert.signature_hash_algorithm),
    )
    print(f"  - {name}: OK")

print(f"\nXong. Các file trong {CERT_DIR}:")
for path in sorted(CERT_DIR.glob("*")):
    print(f"  - {path.name}")
