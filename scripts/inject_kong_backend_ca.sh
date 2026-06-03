#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
KONG_FILE="$ROOT_DIR/gateway/kong.yml"
CA_FILE="$ROOT_DIR/certs/ca.crt"
BACKUP_FILE="$ROOT_DIR/gateway/kong.yml.bak-before-backend-ca"
TMP_FILE="$ROOT_DIR/gateway/kong.yml.tmp"
CA_ID="11111111-1111-1111-1111-111111111111"

if [ ! -f "$KONG_FILE" ]; then
  echo "Khong tim thay $KONG_FILE" >&2
  exit 1
fi

if [ ! -f "$CA_FILE" ]; then
  echo "Khong tim thay $CA_FILE" >&2
  echo "Hay tao certs/ca.crt truoc khi chay script nay." >&2
  exit 1
fi

if ! grep -q "BEGIN CERTIFICATE" "$CA_FILE"; then
  echo "$CA_FILE khong phai PEM certificate hop le." >&2
  exit 1
fi

cp "$KONG_FILE" "$BACKUP_FILE"

awk -v ca_file="$CA_FILE" -v ca_id="$CA_ID" '
BEGIN {
  inserted_ca = 0
  inserted_service_ca = 0
  skip_old_ca = 0
}

function print_ca_block() {
  print "ca_certificates:"
  print "  - id: " ca_id
  print "    cert: |"
  while ((getline line < ca_file) > 0) {
    print "      " line
  }
  close(ca_file)
  print ""
}

/^ca_certificates:/ {
  skip_old_ca = 1
  next
}

skip_old_ca && /^[^ ]/ {
  skip_old_ca = 0
}

skip_old_ca {
  next
}

NR == 1 {
  print
  print ""
  print_ca_block()
  inserted_ca = 1
  next
}

/^[[:space:]]+tls_verify_depth:[[:space:]]*2[[:space:]]*$/ && !inserted_service_ca {
  print
  print "    ca_certificates:"
  print "      - " ca_id
  inserted_service_ca = 1
  next
}

{
  print
}

END {
  if (!inserted_ca) {
    print "Khong chen duoc ca_certificates." > "/dev/stderr"
    exit 2
  }
  if (!inserted_service_ca) {
    print "Khong tim thay tls_verify_depth: 2 de gan CA cho backend service." > "/dev/stderr"
    exit 3
  }
}
' "$KONG_FILE" > "$TMP_FILE"

mv "$TMP_FILE" "$KONG_FILE"

echo "Da import $CA_FILE vao $KONG_FILE"
echo "Da backup file cu tai $BACKUP_FILE"
echo "Hay chay: docker compose restart kong waf"
