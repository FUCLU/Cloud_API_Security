#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${TARGET_URL:-https://localhost:8443/health}"

echo "E-C1 TLS capture check"
echo "Target: ${TARGET_URL}"
echo "Manual evidence step:"
echo "1. Capture traffic with Wireshark/tcpdump while calling the target."
echo "2. Confirm HTTP payload is not visible in plaintext."
echo "3. Save evidence under EVIDENCE/captures/."
