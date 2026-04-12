import React, { useState, useEffect } from 'react'

const KONG_URL = 'http://localhost:8000'

// Giá trị fallback khi backend chưa có endpoint
const DEFAULT_STATUS = {
  tls: { version: '1.3', cipher: 'AES_256_GCM', zero_rtt: false, hsts: true, aes_at_rest: true },
  jwt: { algorithm: 'RS256', alg_none_blocked: true, dpop_enabled: true, token_ttl: 300, refresh_rotation: true },
  mfa: { webauthn: true, totp: true, mfa_bypass: false, session_cookie: 'Secure+HttpOnly' },
  rate_limit: { limit_per_minute: 60, current_usage_pct: 72, replay_protection: 'Redis SET NX', cors_origin: 'localhost:3000' },
}

function ReadOnlyTag({ source }) {
  const [tip, setTip] = useState(false)
  return (
    <div style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
      <span
        style={{ fontSize:'10px', color:'var(--muted)', background:'var(--cream)', border:'1px solid var(--border)', borderRadius:'4px', padding:'1px 6px', cursor:'default', userSelect:'none' }}
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
      >
        infra
      </span>
      {tip && (
        <div style={{
          position:'absolute', right:0, top:'22px', whiteSpace:'nowrap',
          background:'var(--ink)', color:'#fff', fontSize:'11px', padding:'6px 10px',
          borderRadius:'6px', zIndex:10, lineHeight:'1.4',
        }}>
          Cấu hình tại {source}
        </div>
      )}
    </div>
  )
}

function StatusDot({ value }) {
  return <span className={`sec-dot ${value ? 'ok' : 'err'}`}></span>
}

export default function AdminSystemSettings() {
  const [tab, setTab] = useState('sec')
  const [status, setStatus] = useState(DEFAULT_STATUS)
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState(null)
  const [fetchError, setFetchError] = useState(false)

  async function fetchStatus() {
    try {
      const res = await fetch(`${KONG_URL}/api/v1/system/status`, {
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStatus(data)
      setFetchError(false)
      setLastFetch(new Date().toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit', second:'2-digit' }))
    } catch (e) {
      setFetchError(true)
      // giữ nguyên DEFAULT_STATUS, không crash
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // auto-refresh mỗi 30s
    return () => clearInterval(interval)
  }, [])

  const dot = (val) => <StatusDot value={val} />

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Cài đặt hệ thống</div>
          <div className="topbar-sub">Bảo mật · Vault · OPA Policy</div>
        </div>
        <div className="topbar-right">
          {loading && <span style={{ fontSize:'12px', color:'var(--muted)' }}>⏳ Đang tải...</span>}
          {!loading && fetchError && (
            <span style={{ fontSize:'12px', color:'var(--amber)', background:'#fff4e8', padding:'4px 10px', borderRadius:'6px', border:'1px solid #f5d98a' }}>
              ⚠️ Backend chưa sẵn sàng — hiển thị giá trị mặc định
            </span>
          )}
          {!loading && !fetchError && lastFetch && (
            <span style={{ fontSize:'12px', color:'var(--green)' }}>✓ Cập nhật lúc {lastFetch}</span>
          )}
          <button className="btn btn-outline btn-sm" onClick={fetchStatus}>🔄 Refresh</button>
          <button className="btn btn-outline btn-sm">📋 Audit Logs</button>
          <button className="btn btn-primary btn-sm" onClick={() => window.open('http://localhost:3000')}>📈 Grafana</button>
        </div>
      </div>

      <div className="content">
        <div style={{ background:'#e8f0fa', border:'1px solid #b5cef0', borderRadius:'8px', padding:'10px 14px', marginBottom:'18px', fontSize:'12.5px', color:'var(--blue)' }}>
          <strong>Lưu ý:</strong> Các trường có nhãn <span style={{ fontFamily:'monospace', background:'rgba(0,0,0,.06)', padding:'0 4px', borderRadius:'3px' }}>infra</span> được quản lý bởi Kong / Keycloak / Vault — không thể chỉnh trực tiếp qua UI. Hover để xem nguồn cấu hình.
          {!fetchError && <span style={{ marginLeft:'8px', color:'var(--green)' }}>· Dữ liệu được fetch tự động từ <code style={{ fontFamily:'monospace' }}>GET /api/v1/system/status</code></span>}
        </div>

        {/* Tab switcher */}
        <div style={{ display:'flex', background:'var(--cream)', border:'1.5px solid var(--border)', borderRadius:'10px', padding:'3px', marginBottom:'22px' }}>
          {[['sec','🛡 Bảo mật'],['vault','🔐 Vault & Keys'],['opa','📜 OPA Policy']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex:1, padding:'8px', textAlign:'center', fontSize:'13px', fontWeight:500,
              cursor:'pointer', borderRadius:'7px', transition:'all .15s', border:'none',
              fontFamily:'DM Sans,sans-serif',
              background: tab===k ? '#fff' : 'none',
              color: tab===k ? 'var(--ink)' : 'var(--muted)',
              boxShadow: tab===k ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
            }}>{l}</button>
          ))}
        </div>

        {/* ══ SECURITY TAB ══ */}
        {tab === 'sec' && (
          <div className="sec-grid">

            {/* TLS & Mã hoá */}
            <div className="sec-card">
              <div className="sc-title">🔒 TLS & Mã hoá</div>
              <div className="sec-item">{dot(true)}<span className="sec-name">TLS Version</span><span className="sec-val" style={{color:'var(--green)'}}>{status.tls.version} ✓</span><ReadOnlyTag source="Kong / nginx.conf" /></div>
              <div className="sec-item">{dot(true)}<span className="sec-name">Cipher Suite</span><span className="sec-val">{status.tls.cipher}</span><ReadOnlyTag source="Kong TLS config" /></div>
              <div className="sec-item">{dot(!status.tls.zero_rtt)}<span className="sec-name">0-RTT</span><span className="sec-val" style={{color:'var(--green)'}}>{status.tls.zero_rtt ? 'Bật' : 'Tắt ✓'}</span><ReadOnlyTag source="Kong / nginx.conf" /></div>
              <div className="sec-item">{dot(status.tls.hsts)}<span className="sec-name">HSTS</span><span className="sec-val" style={{color:'var(--green)'}}>{status.tls.hsts ? 'Bật ✓' : 'Tắt'}</span><ReadOnlyTag source="hsts-header.lua plugin" /></div>
              <div className="sec-item">{dot(status.tls.aes_at_rest)}<span className="sec-name">AES-256-GCM at-rest</span><span className="sec-val" style={{color: status.tls.aes_at_rest ? 'var(--green)' : 'var(--accent)'}}>{status.tls.aes_at_rest ? 'Bật ✓' : 'Tắt'}</span><ReadOnlyTag source="aead_encryption.py" /></div>
            </div>

            {/* JWT & Token */}
            <div className="sec-card">
              <div className="sc-title">🛡 JWT & Token</div>
              <div className="sec-item">{dot(true)}<span className="sec-name">Algorithm</span><span className="sec-val">{status.jwt.algorithm}</span><ReadOnlyTag source="Keycloak realm config" /></div>
              <div className="sec-item">{dot(status.jwt.alg_none_blocked)}<span className="sec-name">alg=none block</span><span className="sec-val" style={{color:'var(--green)'}}>{status.jwt.alg_none_blocked ? 'Bật ✓' : 'Tắt'}</span><ReadOnlyTag source="jwt-hardening.lua plugin" /></div>
              <div className="sec-item">{dot(status.jwt.dpop_enabled)}<span className="sec-name">DPoP Binding</span><span className="sec-val" style={{color: status.jwt.dpop_enabled ? 'var(--green)' : 'var(--accent)'}}>{status.jwt.dpop_enabled ? 'Bật ✓' : 'Tắt'}</span><ReadOnlyTag source="dpop_verifier.py" /></div>
              <div className="sec-item">{dot(true)}<span className="sec-name">Token TTL</span><span className="sec-val">{status.jwt.token_ttl}s</span><ReadOnlyTag source="Keycloak client settings" /></div>
              <div className="sec-item">{dot(status.jwt.refresh_rotation)}<span className="sec-name">Refresh rotation</span><span className="sec-val" style={{color:'var(--green)'}}>{status.jwt.refresh_rotation ? 'Bật ✓' : 'Tắt'}</span><ReadOnlyTag source="Keycloak realm config" /></div>
            </div>

            {/* MFA */}
            <div className="sec-card">
              <div className="sc-title">🔑 Xác thực MFA</div>
              <div className="sec-item">{dot(status.mfa.webauthn)}<span className="sec-name">WebAuthn / FIDO2</span><span className="sec-val" style={{color: status.mfa.webauthn ? 'var(--green)' : 'var(--accent)'}}>{status.mfa.webauthn ? 'Bật ✓' : 'Tắt'}</span><ReadOnlyTag source="Keycloak auth flow" /></div>
              <div className="sec-item">{dot(status.mfa.totp)}<span className="sec-name">TOTP fallback</span><span className="sec-val" style={{color: status.mfa.totp ? 'var(--green)' : 'var(--accent)'}}>{status.mfa.totp ? 'Bật ✓' : 'Tắt'}</span><ReadOnlyTag source="Keycloak auth flow" /></div>
              <div className="sec-item">{dot(!status.mfa.mfa_bypass)}<span className="sec-name">Bypass MFA</span><span className="sec-val" style={{color:'var(--green)'}}>{status.mfa.mfa_bypass ? 'Có ⚠️' : 'Không có ✓'}</span><ReadOnlyTag source="Keycloak auth flow" /></div>
              <div className="sec-item">{dot(true)}<span className="sec-name">Session cookie</span><span className="sec-val">{status.mfa.session_cookie}</span><ReadOnlyTag source="Kong response headers" /></div>
            </div>

            {/* Rate Limiting */}
            <div className="sec-card">
              <div className="sc-title">⚡ Rate Limiting</div>
              <div className="sec-item">{dot(true)}<span className="sec-name">Limit / phút</span><span className="sec-val">{status.rate_limit.limit_per_minute} req</span><ReadOnlyTag source="Kong rate-limit plugin" /></div>
              <div className="sec-item" style={{flexDirection:'column',alignItems:'flex-start',gap:'4px'}}>
                <div style={{display:'flex',width:'100%',justifyContent:'space-between'}}>
                  <span style={{fontSize:'13px'}}>Sử dụng hiện tại</span>
                  <span style={{fontSize:'12px',fontWeight:600}}>{status.rate_limit.current_usage_pct}%</span>
                </div>
                <div className="progress-bar" style={{width:'100%'}}>
                  <div className="progress-fill" style={{
                    width:`${status.rate_limit.current_usage_pct}%`,
                    background: status.rate_limit.current_usage_pct > 90 ? 'var(--accent)' : status.rate_limit.current_usage_pct > 70 ? 'var(--amber)' : 'var(--green)'
                  }}></div>
                </div>
              </div>
              <div className="sec-item">{dot(true)}<span className="sec-name">Replay Protection</span><span className="sec-val">{status.rate_limit.replay_protection}</span><ReadOnlyTag source="dpop_verifier.py" /></div>
              <div className="sec-item">{dot(true)}<span className="sec-name">CORS Origin</span><span className="sec-val">{status.rate_limit.cors_origin}</span><ReadOnlyTag source="Kong CORS plugin" /></div>
            </div>
          </div>
        )}

        {/* ══ VAULT TAB ══ */}
        {tab === 'vault' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'18px' }}>
              {[
                ['v12','KEK Version hiện tại','var(--green)'],
                ['4m', 'Từ rotation cuối',    'var(--blue)'],
                ['6m', 'Rotation tiếp theo',  'var(--amber)'],
              ].map(([val,label,color]) => (
                <div key={label} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:'12px', padding:'16px', textAlign:'center' }}>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'28px', marginBottom:'4px', color }}>{val}</div>
                  <div style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ background:'#e8f0fa', border:'1px solid #b5cef0', borderRadius:'8px', padding:'10px 14px', marginBottom:'18px', fontSize:'12.5px', color:'var(--blue)' }}>
              KEK rotation được quản lý bởi <strong>HashiCorp Vault Transit Engine</strong> tại <code style={{fontFamily:'monospace',background:'rgba(0,0,0,.06)',padding:'0 4px',borderRadius:'3px'}}>localhost:8200</code> — nút "Rotation ngay" gọi API <code style={{fontFamily:'monospace',background:'rgba(0,0,0,.06)',padding:'0 4px',borderRadius:'3px'}}>vault write transit/keys/kek/rotate</code>.
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Key Rotation Log</div>
                <button className="btn btn-primary btn-sm" onClick={() => alert('vault write transit/keys/kek/rotate')}>⟳ Rotation ngay</button>
              </div>
              <div className="card-body">
                <ul style={{listStyle:'none'}}>
                  {[
                    {color:'var(--blue)',  time:'14:28', text:'KEK v12 được tạo — Transit engine',      sub:'DEK re-wrap · Blast radius: 6h'},
                    {color:'var(--green)', time:'14:18', text:'Rotation tự động (cron: */10 * * * *)',  sub:'KEK v11→v12 · SLA: 2m14s ✓'},
                    {color:'var(--blue)',  time:'14:08', text:'KEK v11 được tạo',                       sub:'156 records updated'},
                    {color:'var(--green)', time:'13:58', text:'Rotation tự động',                       sub:'KEK v10→v11 · SLA: 1m58s ✓'},
                  ].map((item,i) => (
                    <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:'12px', padding:'10px 0', borderBottom:'1px solid var(--cream)' }}>
                      <span style={{ width:'9px', height:'9px', borderRadius:'50%', background:item.color, marginTop:'4px', flexShrink:0, display:'block' }}></span>
                      <span style={{ fontSize:'11px', color:'var(--muted)', minWidth:'44px', marginTop:'1px' }}>{item.time}</span>
                      <div>
                        <div style={{fontSize:'13px'}}>{item.text}</div>
                        <div style={{fontSize:'11px',color:'var(--muted)',marginTop:'2px'}}>{item.sub}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}

        {/* ══ OPA TAB ══ */}
        {tab === 'opa' && (
          <>
            <div style={{ background:'#e8f0fa', border:'1px solid #b5cef0', borderRadius:'8px', padding:'10px 14px', marginBottom:'18px', fontSize:'12.5px', color:'var(--blue)' }}>
              Policy được deploy lên <strong>OPA container</strong> tại <code style={{fontFamily:'monospace',background:'rgba(0,0,0,.06)',padding:'0 4px',borderRadius:'3px'}}>localhost:8181</code>. Nút "Deploy" gọi <code style={{fontFamily:'monospace',background:'rgba(0,0,0,.06)',padding:'0 4px',borderRadius:'3px'}}>PUT /v1/policies/authz</code>.
            </div>

            <div className="card mb18">
              <div className="card-header">
                <div className="card-title">authz.rego — OPA Policy</div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button className="btn btn-outline btn-sm" onClick={() => alert('opa test ./opa/tests/authz_test.rego')}>▶ Test</button>
                  <button className="btn btn-primary btn-sm" onClick={() => alert('PUT http://localhost:8181/v1/policies/authz')}>📤 Deploy</button>
                </div>
              </div>
              <div className="card-body">
                <div className="policy-editor">
                  <span className="pe-cm"># authz.rego — deny by default</span>{'\n'}
                  <span className="pe-kw">package</span>{' authz\n\n'}
                  <span className="pe-kw">default</span>{' allow = '}<span className="pe-str">false</span>{'\n\n'}
                  {'allow {\n    input.user.role == '}<span className="pe-str">"admin"</span>{'\n}\n'}
                  {'allow {\n    input.method == '}<span className="pe-str">"GET"</span>{'\n    input.user.id == input.resource.owner_id\n    input.user.role == '}<span className="pe-str">"customer"</span>{'\n}\n'}
                  {'allow {\n    input.user.role == '}<span className="pe-str">"staff"</span>{'\n    input.path[1] == '}<span className="pe-str">"products"</span>{'\n}\n'}
                  {'deny_reason = '}<span className="pe-str">"insufficient_role"</span>{' {\n    not allow\n}'}
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header"><div className="card-title">Thống kê 24h</div></div>
                <div className="card-body">
                  {[
                    {name:'Tổng quyết định', val:'4,821',         color:''},
                    {name:'ALLOW',           val:'4,798 (99.5%)', color:'var(--green)', dot:'ok'},
                    {name:'DENY',            val:'23 (0.5%)',      color:'var(--accent)', dot:'err'},
                    {name:'Explainable',     val:'100% ✓',        color:'var(--green)'},
                    {name:'Avg latency',     val:'2.1ms',          color:''},
                  ].map(item => (
                    <div key={item.name} className="sec-item">
                      {item.dot && <span className={`sec-dot ${item.dot}`}></span>}
                      <span className="sec-name">{item.name}</span>
                      <span className="sec-val" style={item.color ? {color:item.color} : {}}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><div className="card-title">Top lý do từ chối</div></div>
                <div className="card-body">
                  {[
                    {name:'insufficient_role',    val:'14', color:'var(--accent)'},
                    {name:'BOLA / owner mismatch', val:'5',  color:'var(--accent)'},
                    {name:'rate_limit_exceeded',   val:'3',  color:'var(--amber)'},
                    {name:'jwt_expired',           val:'1',  color:'var(--amber)'},
                  ].map(item => (
                    <div key={item.name} className="sec-item">
                      <span className="sec-name" style={{fontFamily:'monospace',fontSize:'12px'}}>{item.name}</span>
                      <span className="sec-val" style={{color:item.color,fontWeight:700}}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}