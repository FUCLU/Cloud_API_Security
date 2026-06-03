#!/usr/bin/env bash
set -euo pipefail

echo "E-X1 Vault key rotation check"
echo "Expected manual command inside lab stack:"
echo "docker compose exec vault vault write -f transit/keys/${VAULT_KEY_NAME:-orders-dek}/rotate"
echo "Then verify encrypted/decrypted records still work."
