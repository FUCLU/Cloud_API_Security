# D1 Runbook

## Start Stack

```powershell
docker compose up -d
docker compose ps
```

Expected core services for D1: `frontend`, `kong`, `backend`, `keycloak`,
`opa`, `vault`, `postgres`, and `redis` should be `healthy`.

## Health Checks

```powershell
curl.exe --cacert certs\ca.crt -i https://localhost:5174
curl.exe --cacert certs\ca.crt -i https://localhost:8443/health
curl.exe -i http://localhost:8181/health
```

Expected:

- Frontend HTTPS returns `200`.
- Kong HTTPS `/health` returns `{"status":"ok"}`.
- OPA health returns `{}`.

## SAST Evidence

```powershell
powershell -ExecutionPolicy Bypass -File scripts\security_testing\run_sast.ps1
```

Generated files:

- `EVIDENCE/security_scans/bandit_report.json`
- `EVIDENCE/security_scans/sca_report.txt`
- `EVIDENCE/security_scans/sast_summary.md`

The runner uses Bandit and pip-audit when installed. If they are not installed,
it writes a deterministic fallback report and records the remaining dependency
audit gap.

## DAST Evidence

Make sure the D1 stack is running first.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\security_testing\run_dast.ps1
```

Generated files:

- `EVIDENCE/security_scans/zap_report.html`
- `EVIDENCE/security_scans/dast_summary.json`
- `EVIDENCE/security_scans/dast_summary.md`

The DAST runner performs black-box checks against `https://localhost:5174` and
`https://localhost:8443`: HTTPS availability, Kong health, security headers,
rate-limit headers, protected endpoint rejection, and JWT `alg=none` rejection.
If a local ZAP Docker image is available, it also runs ZAP baseline.

## Optional Full Tooling

```powershell
python -m pip install bandit pip-audit
docker pull ghcr.io/zaproxy/zaproxy:stable
```

Then rerun SAST/DAST commands above.
