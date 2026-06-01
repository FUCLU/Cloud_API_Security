#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../../.."
python scripts/security_testing/run_dast.py "$@"
