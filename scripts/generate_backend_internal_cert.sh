#!/usr/bin/env sh
set -eu

CERT_DIR="${CERT_DIR:-certs}"
CA_CERT="$CERT_DIR/ca.crt"
CA_KEY="$CERT_DIR/ca.key"
BACKEND_KEY="$CERT_DIR/backend.key"
BACKEND_CSR="$CERT_DIR/backend.csr"
BACKEND_CERT="$CERT_DIR/backend.crt"
BACKEND_CNF="$CERT_DIR/backend-san.cnf"

if [ ! -f "$CA_CERT" ] || [ ! -f "$CA_KEY" ]; then
  echo "Missing $CA_CERT or $CA_KEY" >&2
  exit 1
fi

mkdir -p "$CERT_DIR"

cat > "$BACKEND_CNF" <<'EOF'
[ req ]
default_bits = 256
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[ dn ]
CN = api-backend

[ req_ext ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = api-backend
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF

openssl ecparam -name prime256v1 -genkey -noout -out "$BACKEND_KEY"
openssl req -new -key "$BACKEND_KEY" -out "$BACKEND_CSR" -config "$BACKEND_CNF"
openssl x509 -req \
  -in "$BACKEND_CSR" \
  -CA "$CA_CERT" \
  -CAkey "$CA_KEY" \
  -CAcreateserial \
  -out "$BACKEND_CERT" \
  -days 365 \
  -sha256 \
  -extensions req_ext \
  -extfile "$BACKEND_CNF"

chmod 600 "$BACKEND_KEY"
chmod 644 "$BACKEND_CERT"

echo "Generated $BACKEND_CERT with SAN api-backend"
