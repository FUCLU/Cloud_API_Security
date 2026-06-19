#!/usr/bin/env bash
set -euo pipefail

echo "E-Z2 token hardening checks"
echo "1. alg=none attack"
python3 scripts/attacks/alg_none_attack.py || true
