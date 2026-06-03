#!/usr/bin/env bash
set -euo pipefail

echo "E-Z2 token hardening checks"
echo "1. alg=none attack"
python3 scripts/attacks/alg_none_attack.py || true
echo "2. DPoP replay attack"
python3 scripts/attacks/replay_dpop_attack.py || true
