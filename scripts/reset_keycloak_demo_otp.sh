#!/usr/bin/env bash
set -euo pipefail

# Reset OTP/TOTP credentials for demo users in Keycloak.
# Run this from the project root on the Ubuntu server:
#   bash scripts/reset_keycloak_demo_otp.sh

REALM="${KEYCLOAK_REALM:-cloudapi}"
MASTER_REALM="${KEYCLOAK_MASTER_REALM:-master}"
KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-keycloak}"
KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-}"

HIGH_PRIVILEGE_DEMO_USERS=(
  "phuc@company.com"
  "hung@company.com"
  "kiet@company.com"
)

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
  REALM="${KEYCLOAK_REALM:-$REALM}"
  KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN:-$KEYCLOAK_ADMIN_USER}"
  KEYCLOAK_ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-$KEYCLOAK_ADMIN_PASS}"
fi

if [[ -z "$KEYCLOAK_ADMIN_PASS" ]]; then
  echo "ERROR: KEYCLOAK_ADMIN_PASSWORD is empty. Put it in .env or export it before running this script." >&2
  exit 1
fi

KCADM="/opt/keycloak/bin/kcadm.sh"

echo "==> Login Keycloak admin"
docker compose exec -T "$KEYCLOAK_CONTAINER" "$KCADM" config credentials \
  --server "http://localhost:8080" \
  --realm "$MASTER_REALM" \
  --user "$KEYCLOAK_ADMIN_USER" \
  --password "$KEYCLOAK_ADMIN_PASS" >/dev/null

for username in "${HIGH_PRIVILEGE_DEMO_USERS[@]}"; do
  echo "==> User: $username"

  user_id="$(
    docker compose exec -T "$KEYCLOAK_CONTAINER" "$KCADM" get users \
      -r "$REALM" \
      -q "username=$username" \
      --fields id,username \
      --format csv --noquotes \
    | awk -F, -v u="$username" '$2 == u { print $1; exit }'
  )"

  if [[ -z "$user_id" ]]; then
    echo "    WARN: user not found, skipped"
    continue
  fi

  otp_ids="$(
    docker compose exec -T "$KEYCLOAK_CONTAINER" "$KCADM" get "users/$user_id/credentials" \
      -r "$REALM" \
      --fields id,type \
      --format csv --noquotes \
    | awk -F, '$2 == "otp" { print $1 }'
  )"

  if [[ -z "$otp_ids" ]]; then
    echo "    OK: no OTP credential to remove"
  else
    while IFS= read -r credential_id; do
      [[ -z "$credential_id" ]] && continue
      docker compose exec -T "$KEYCLOAK_CONTAINER" "$KCADM" delete "users/$user_id/credentials/$credential_id" \
        -r "$REALM"
      echo "    removed OTP credential: $credential_id"
    done <<< "$otp_ids"
  fi

  docker compose exec -T "$KEYCLOAK_CONTAINER" "$KCADM" update "users/$user_id" \
    -r "$REALM" \
    -s 'requiredActions=["CONFIGURE_TOTP"]'
  echo "    required action set: CONFIGURE_TOTP"
done

echo "==> Done. Next login for high-privilege demo users will require a new QR/TOTP setup."
