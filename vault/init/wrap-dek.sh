#!/bin/sh

set -eu

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-root}"
VAULT_KEY_NAME="${VAULT_KEY_NAME:-dek}"
DEK_BASE64="${DEK_BASE64:-}"
export VAULT_ADDR VAULT_TOKEN VAULT_KEY_NAME

if [ -z "${DEK_BASE64}" ]; then
  echo "ERROR: DEK_BASE64 is empty"
  exit 1
fi

vault write -format=json "transit/encrypt/${VAULT_KEY_NAME}" plaintext="${DEK_BASE64}" \
  | sed -n 's/.*"ciphertext":"\([^"]*\)".*/\1/p'
