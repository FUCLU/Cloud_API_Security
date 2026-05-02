#!/bin/sh

set -eu

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-root}"
export VAULT_ADDR VAULT_TOKEN

LOG_FILE="${LOG_FILE:-/vault/init/vault-rotation.log}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-60}"

log() {
	ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
	echo "$ts $*" | tee -a "$LOG_FILE"
}

wait_for_vault() {
	waited=0
	while ! vault status >/dev/null 2>&1; do
		if [ "$waited" -ge "$MAX_WAIT_SECONDS" ]; then
			log "ERROR Vault is not ready after ${MAX_WAIT_SECONDS}s"
			exit 1
		fi
		sleep 2
		waited=$((waited + 2))
	done
}

log "START key rotation"
wait_for_vault

if ! vault read transit/keys/dek >/dev/null 2>&1; then
	log "ERROR transit key 'dek' does not exist (enable/create it first)"
	exit 1
fi

START_TIME=$(date +%s)

OLD_VERSION=$(vault read -field=latest_version transit/keys/dek)
log "Current key version (N): ${OLD_VERSION}"

vault write -f transit/keys/dek/rotate >/dev/null
NEW_VERSION=$(vault read -field=latest_version transit/keys/dek)
log "Rotated to new key version (N+1): ${NEW_VERSION}"

vault write transit/keys/dek/config min_decryption_version="${NEW_VERSION}" >/dev/null
log "Set min_decryption_version=${NEW_VERSION}; old versions are revoked for decrypt"

END_TIME=$(date +%s)
DURATION_SECONDS=$((END_TIME - START_TIME))

if [ "$DURATION_SECONDS" -lt 600 ]; then
	SLA_RESULT="PASS"
else
	SLA_RESULT="FAIL"
fi

log "DONE duration=${DURATION_SECONDS}s sla(<600s)=${SLA_RESULT}"