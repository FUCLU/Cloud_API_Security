import React, { useMemo, useState } from 'react'

const externalLinks = {
  grafana: 'http://localhost:3000',
  loki: 'http://localhost:3100/ready',
  prometheus: 'http://localhost:9091/-/ready',
}

const securityEvidence = [
  {
    name: 'TLS 1.3 qua Kong',
    status: 'Đã cấu hình',
    source: 'docker-compose.yml, gateway/kong.yml, certs/*.crt',
    test: 'curl --cacert certs/ca.crt -I https://localhost:8443/health',
  },
  {
    name: 'ECDSA P-256 certificate',
    status: 'Đã chứng minh',
    source: 'scripts/gen_certs.py, certs/kong.crt',
    test: 'openssl x509 -in certs/kong.crt -noout -text | grep -E "Public Key Algorithm|Signature Algorithm|ASN1 OID"',
  },
  {
    name: 'JWT hardening',
    status: 'Đã chứng minh',
    source: 'gateway/plugins/jwt-hardening, scripts/attacks/alg_none_attack.py',
    test: 'python3 scripts/attacks/alg_none_attack.py',
  },
  {
    name: 'BOLA / IDOR',
    status: 'Đã chứng minh',
    source: 'backend/app/security/bola_guard.py, EVIDENCE/attack_results/bola/bola_result.txt',
    test: 'python3 scripts/attacks/bola_attack.py',
  },
  {
    name: 'SSRF guard',
    status: 'Đã chứng minh',
    source: 'backend/app/security/ssrf_guard.py, EVIDENCE/attack_results/ssrf/ssrf_result.txt',
    test: 'python3 scripts/attacks/ssrf_attack.py',
  },
  {
    name: 'Route role isolation',
    status: 'Đã chứng minh',
    source: 'frontend/src/App.jsx, EVIDENCE/attack_results/role-escalation/role_escalation_result.json',
    test: 'python3 scripts/attacks/role_escalation_test.py',
  },
]

const opaEvidence = [
  {
    name: 'OPA health',
    source: 'OPA server :8181',
    test: 'curl -i http://localhost:8181/health',
  },
  {
    name: 'OPA policy tests',
    source: 'opa/policies, opa/tests',
    test: 'docker compose exec opa opa test /policies /tests -v',
  },
  {
    name: 'Deny customer delete users',
    source: 'opa/policies/authz.rego',
    test: 'curl -s http://localhost:8181/v1/data/authz -H "Content-Type: application/json" -d \'{"input":{"role":"customer","method":"DELETE","path":"/api/v1/users","subject":"u1"}}\'',
  },
]

const observabilityChecks = [
  {
    name: 'Bật stack observability',
    port: 'profile obs',
    expected: 'Tạo container loki, promtail, grafana, prometheus, cadvisor',
    command: 'docker compose --profile obs up -d',
  },
  {
    name: 'Loki ready',
    port: '3100',
    expected: 'HTTP 200 hoặc body ready',
    command: 'curl -i http://localhost:3100/ready',
  },
  {
    name: 'Grafana health',
    port: '3000',
    expected: 'HTTP 200, database ok',
    command: 'curl -i http://localhost:3000/api/health',
  },
  {
    name: 'Prometheus ready',
    port: '9091',
    expected: 'HTTP 200',
    command: 'curl -i http://localhost:9091/-/ready',
  },
  {
    name: 'Tạo log để Promtail gom',
    port: '8443',
    expected: 'Kong/backend có access log mới',
    command: 'curl --cacert certs/ca.crt -i https://localhost:8443/health',
  },
  {
    name: 'Query Loki trực tiếp',
    port: '3100',
    expected: 'Có stream log nếu promtail đã scrape được',
    command: 'curl -G -s "http://localhost:3100/loki/api/v1/query" --data-urlencode \'query={service=~".+"}\'',
  },
]

function SourceBadge({ type = 'real' }) {
  const real = type === 'real'
  return (
    <span style={{
      borderRadius: 999,
      padding: '3px 9px',
      fontSize: 10.5,
      fontWeight: 700,
      background: real ? '#e8f5ee' : '#fff4e8',
      color: real ? 'var(--green)' : 'var(--amber)',
      whiteSpace: 'nowrap',
    }}>
      {real ? 'Dữ liệu thật' : 'Cần bật stack'}
    </span>
  )
}

function CommandBlock({ children }) {
  return (
    <code style={{
      display: 'block',
      background: '#171724',
      color: '#d7f5d7',
      borderRadius: 8,
      padding: '9px 11px',
      fontFamily: 'Courier New, monospace',
      fontSize: 11.5,
      lineHeight: 1.55,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {children}
    </code>
  )
}

function EvidenceTable({ rows }) {
  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Hạng mục</th>
              <th>Trạng thái</th>
              <th>Nguồn thật</th>
              <th>Lệnh kiểm thử</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.name}>
                <td style={{ fontWeight: 700 }}>{row.name}</td>
                <td><span className="badge badge-green">{row.status}</span></td>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{row.source}</td>
                <td style={{ minWidth: 320 }}><CommandBlock>{row.test}</CommandBlock></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminSystemSettings() {
  const [tab, setTab] = useState('security')

  const tabs = useMemo(() => [
    ['security', 'Bảo mật'],
    ['opa', 'OPA'],
    ['obs', 'Loki / Grafana'],
  ], [])

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Cài đặt hệ thống</div>
          <div className="topbar-sub">Chỉ hiển thị cấu hình/evidence có nguồn kiểm chứng</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-outline btn-sm" onClick={() => window.open(externalLinks.loki)}>Loki</button>
          <button className="btn btn-outline btn-sm" onClick={() => window.open(externalLinks.prometheus)}>Prometheus</button>
          <button className="btn btn-primary btn-sm" onClick={() => window.open(externalLinks.grafana)}>Grafana</button>
        </div>
      </div>

      <div className="content">
        <div style={{
          display: 'flex',
          background: 'var(--cream)',
          border: '1.5px solid var(--border)',
          borderRadius: 10,
          padding: 3,
          marginBottom: 18,
        }}>
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1,
              padding: 9,
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: 7,
              border: 'none',
              fontFamily: 'DM Sans,sans-serif',
              background: tab === key ? '#fff' : 'transparent',
              color: tab === key ? 'var(--ink)' : 'var(--muted)',
              boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
            }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'security' && (
          <>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Bảo mật đã chứng minh</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                  Mỗi dòng có file nguồn và lệnh test lại trên máy Ubuntu của bạn.
                </div>
              </div>
              <SourceBadge />
            </div>
            <EvidenceTable rows={securityEvidence} />
          </>
        )}

        {tab === 'opa' && (
          <>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700 }}>OPA authorization</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                  Kiểm tra policy thật đang mount vào container OPA.
                </div>
              </div>
              <SourceBadge />
            </div>
            <EvidenceTable rows={opaEvidence.map(item => ({
              name: item.name,
              status: 'Có thể test',
              source: item.source,
              test: item.test,
            }))} />
          </>
        )}

        {tab === 'obs' && (
          <>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Kiểm thử Loki / Grafana / Prometheus</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                  Đây là stack chạy bằng Docker Compose profile `obs`, không tự bật trong D1 mặc định.
                </div>
              </div>
              <SourceBadge type="pending" />
            </div>

            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kiểm tra</th>
                      <th>Port</th>
                      <th>Kỳ vọng</th>
                      <th>Lệnh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observabilityChecks.map(check => (
                      <tr key={check.name}>
                        <td style={{ fontWeight: 700 }}>{check.name}</td>
                        <td><span className="badge badge-blue">{check.port}</span></td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{check.expected}</td>
                        <td style={{ minWidth: 360 }}><CommandBlock>{check.command}</CommandBlock></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 18 }}>
              <div className="card card-body">
                <div className="card-title" style={{ marginBottom: 10 }}>Truy cập Grafana</div>
                <CommandBlock>{`http://localhost:3000\nuser: admin\npassword: admin`}</CommandBlock>
              </div>
              <div className="card card-body">
                <div className="card-title" style={{ marginBottom: 10 }}>Xem log container nếu Loki chưa có dữ liệu</div>
                <CommandBlock>{`docker compose logs loki --tail 80\ndocker compose logs promtail --tail 80\ndocker compose logs grafana --tail 80`}</CommandBlock>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

