# D2 Deploy Runbook

Mục tiêu D2 là deploy hệ thống trên Ubuntu Server với cổng public tối thiểu.

## Public ports

```text
80
443
8443
```

## Internal-only services

```text
backend:9000
opa:8181
vault:8200
postgres:5432
redis:6379
kong-admin:8001
```

## Run

```bash
docker compose config
docker compose up -d --build
docker compose ps
sudo ss -tulpn
```

## Evidence

- Frontend HTTPS: `https://<ip-or-domain>`
- Kong mTLS: `https://<ip-or-domain>:8443/health`
- OPA policy: `docker compose exec opa opa test /policies /tests -v`
