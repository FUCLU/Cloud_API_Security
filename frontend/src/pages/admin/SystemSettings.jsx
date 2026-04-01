import React, { useState } from 'react'

function Toggle({ on, onToggle }) {
  return (
    <div className="toggle-wrap">
      <div className={`toggle${on ? ' on' : ''}`} onClick={onToggle}></div>
    </div>
  )
}

export default function AdminSystemSettings() {
  const [tab, setTab] = useState('sec')
  const [saved, setSaved] = useState(false)

  const [toggles, setToggles] = useState({
    aesAtRest: true,
    dpop:      true,
    webauthn:  true,
    totp:      true,
  })

  function t(key) { setToggles(p => ({ ...p, [key]: !p[key] })) }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const dot = (on) => <span className={`sec-dot ${on ? 'ok' : 'err'}`}></span>

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Cài đặt hệ thống</div>
          <div className="topbar-sub">Bảo mật · Vault · OPA Policy</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-outline btn-sm">📋 Audit Logs</button>
          <button className="btn btn-primary btn-sm" onClick={() => window.open('http://localhost:3000')}>📈 Grafana</button>
        </div>
      </div>

      <div className="content">
        {/* Tab switcher */}
        <div style={{ display:'flex', background:'var(--cream)', border:'1.5px solid var(--border)', borderRadius:'10px', padding:'3px', marginBottom:'22px' }}>
          {[['sec','🛡 Bảo mật'],['vault','🔐 Vault & Keys'],['opa','📜 OPA Policy']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex:1, padding:'8px', textAlign:'center', fontSize:'13px', fontWeight:500,
              cursor:'pointer', borderRadius:'7px', transition:'all .15s', border:'none',
              fontFamily:'DM Sans,sans-serif',
              background: tab===k ? '#fff' : 'none',
              color: tab===k ? 'var(--ink)' : 'var(--muted)',
              boxShadow: tab===k ? '0 1px 4px rgba(0,0,0,.1)' : 'none'
            }}>{l}</button>
          ))}
        </div>

        {/* ══ SECURITY TAB ══ */}
        {tab === 'sec' && (
          <>
            <div className="sec-grid" style={{ marginBottom:'18px' }}>

              {/* TLS & Mã hoá */}
              <div className="sec-card">
                <div className="sc-title">🔒 TLS & Mã hoá</div>
                <div className="sec-item">{dot(true)}<span className="sec-name">TLS Version</span><span className="sec-val" style={{color:'var(--green)'}}>1.3 ✓</span></div>
                <div className="sec-item">{dot(true)}<span className="sec-name">Cipher Suite</span><span className="sec-val">AES_256_GCM</span></div>
                <div className="sec-item">{dot(true)}<span className="sec-name">0-RTT</span><span className="sec-val" style={{color:'var(--green)'}}>Tắt ✓</span></div>
                <div className="sec-item">{dot(true)}<span className="sec-name">HSTS</span><span className="sec-val" style={{color:'var(--green)'}}>Bật ✓</span></div>
                <div className="sec-item">
                  {dot(toggles.aesAtRest)}<span className="sec-name">AES-256-GCM at-rest</span>
                  <Toggle on={toggles.aesAtRest} onToggle={() => t('aesAtRest')} />
                </div>
              </div>

              {/* JWT & Token */}
              <div className="sec-card">
                <div className="sc-title">🛡 JWT & Token</div>
                <div className="sec-item">{dot(true)}<span className="sec-name">Algorithm</span><span className="sec-val">RS256</span></div>
                <div className="sec-item">{dot(true)}<span className="sec-name">alg=none block</span><span className="sec-val" style={{color:'var(--green)'}}>Bật ✓</span></div>
                <div className="sec-item">
                  {dot(toggles.dpop)}<span className="sec-name">DPoP Binding</span>
                  <Toggle on={toggles.dpop} onToggle={() => t('dpop')} />
                </div>
                <div className="sec-item">{dot(true)}<span className="sec-name">Token TTL</span><span className="sec-val">300s</span></div>
                <div className="sec-item">{dot(true)}<span className="sec-name">Refresh rotation</span><span className="sec-val" style={{color:'var(--green)'}}>Bật ✓</span></div>
              </div>

              {/* MFA */}
              <div className="sec-card">
                <div className="sc-title">🔑 Xác thực MFA</div>
                <div className="sec-item">
                  {dot(toggles.webauthn)}<span className="sec-name">WebAuthn / FIDO2</span>
                  <Toggle on={toggles.webauthn} onToggle={() => t('webauthn')} />
                </div>
                <div className="sec-item">
                  {dot(toggles.totp)}<span className="sec-name">TOTP fallback</span>
                  <Toggle on={toggles.totp} onToggle={() => t('totp')} />
                </div>
                <div className="sec-item">{dot(true)}<span className="sec-name">Bypass MFA</span><span className="sec-val" style={{color:'var(--green)'}}>Không có ✓</span></div>
                <div className="sec-item">{dot(true)}<span className="sec-name">Session cookie</span><span className="sec-val">Secure+HttpOnly</span></div>
              </div>

              {/* Rate Limiting */}
              <div className="sec-card">
                <div className="sc-title">⚡ Rate Limiting</div>
                <div className="sec-item">{dot(true)}<span className="sec-name">Limit / phút</span><span className="sec-val">60 req</span></div>
                <div className="sec-item" style={{flexDirection:'column',alignItems:'flex-start',gap:'4px'}}>
                  <div style={{display:'flex',width:'100%',justifyContent:'space-between'}}>
                    <span style={{fontSize:'13px'}}>Sử dụng hiện tại</span>
                    <span style={{fontSize:'12px',fontWeight:600}}>72%</span>
                  </div>
                  <div className="progress-bar" style={{width:'100%'}}>
                    <div className="progress-fill" style={{width:'72%',background:'var(--amber)'}}></div>
                  </div>
                </div>
                <div className="sec-item">{dot(true)}<span className="sec-name">Replay Protection</span><span className="sec-val">Redis SET NX</span></div>
                <div className="sec-item">{dot(true)}<span className="sec-name">CORS Origin</span><span className="sec-val">localhost:3000</span></div>
              </div>

            </div>

            {/* Nút lưu */}
            <div style={{display:'flex',justifyContent:'flex-end'}}>
              <button className="btn btn-primary" onClick={handleSave}>
                {saved ? '✅ Đã lưu!' : '💾 Lưu cài đặt'}
              </button>
            </div>
          </>
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

            <div className="card">
              <div className="card-header">
                <div className="card-title">Key Rotation Log</div>
                <button className="btn btn-primary btn-sm" onClick={() => alert('Kích hoạt rotation thủ công')}>⟳ Rotation ngay</button>
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
            <div className="card mb18">
              <div className="card-header">
                <div className="card-title">authz.rego — OPA Policy</div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button className="btn btn-outline btn-sm" onClick={() => alert('Chạy test OPA...')}>▶ Test</button>
                  <button className="btn btn-primary btn-sm" onClick={() => alert('Deploy lên OPA container')}>📤 Deploy</button>
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
                    {name:'Tổng quyết định', val:'4,821',        color:''},
                    {name:'ALLOW',           val:'4,798 (99.5%)', color:'var(--green)', dot:'ok'},
                    {name:'DENY',            val:'23 (0.5%)',     color:'var(--accent)', dot:'err'},
                    {name:'Explainable',     val:'100% ✓',       color:'var(--green)'},
                    {name:'Avg latency',     val:'2.1ms',         color:''},
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
