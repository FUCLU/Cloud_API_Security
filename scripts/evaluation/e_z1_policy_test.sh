#!/usr/bin/env bash
set -euo pipefail

echo "E-Z1 OPA policy test"
docker compose exec opa opa test /policies /tests -v
