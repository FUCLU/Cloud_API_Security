#!/bin/sh

set -eu

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-root}"
export VAULT_ADDR VAULT_TOKEN

vault secrets enable transit >/dev/null 2>&1 || true
vault write -f transit/keys/dek >/dev/null
vault policy write dek-policy /vault/policies/dek-policy.hcl >/dev/null
echo "Transit enabled, key 'dek' is ready, and dek-policy is applied."
