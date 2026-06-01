import React, { useState } from 'react'

const KONG_URL = 'http://localhost:8000'

const FAKE_JWT = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InJzYS1rZXktMSJ9.eyJzdWIiOiJ1aWQtMDA0IiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo4MDgxL3JlYWxtcy9jb21wYW55IiwiYXVkIjoic3BhLWNsaWVudCIsInJvbGVzIjpbImN1c3RvbWVyIl0sImV4cCI6MTcxMTYzNTYwMCwiaWF0IjoxNzExNjM1MzAwLCJqdGkiOiJhYmMtMDA0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
const FAKE_DPOP = 'eyJhbGciOiJFUzI1NiIsInR5cCI6ImRwb3AranQiLCJqd2siOnsiYWxnIjoiRUMyNTYiLCJrdHkiOiJFQyIsImNydiI6IlAtMjU2In19.eyJodG0iOiJQT1NUIiwiaHR1IjoiaHR0cDovL2xvY2FsaG9zdDo4MDAwL2FwaS92MS9vcmRlcnMiLCJpYXQiOjE3MTE2MzUzMDAsImp0aSI6Impvb3AtMDAxIn0.replay_stolen_signature_xyz'
const FAKE_ALG_NONE = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlzcyI6ImF0dGFja2VyLmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.'

const ATTACKS_INIT = [
  {
    id: 'bola',
    icon: '👤',
    name: 'BOLA / IDOR',
    label: 'badge-red',
    category: 'Authorization',
    desc: 'User uid-004 (customer) cố truy cập đơn hàng ORD-1042 thuộc về uid-002. OPA kiểm tra owner_id không khớp → deny.',
    script: 'scripts/attacks/bola_attack.py',
    editableFields: { path: '/api/v1/orders/ORD-1042', body: '' },
    buildRequest: (f) => ({
      method: 'GET', path: f.path, body: null,
      headers: {
        'Host': 'localhost:8000',
        'Authorization': `Bearer ${FAKE_JWT}`,
        'X-Request-ID': 'req-bola-' + Math.random().toString(36).slice(2,7),
        'X-Forwarded-For': '10.0.0.14',
        'Content-Type': 'application/json',
      },
    }),
    mockResponse: {
      status: 'BLOCKED', http_code: 403,
      detail: 'Access denied: resource owner mismatch',
      opa_decision: { allow: false, deny_reason: 'BOLA / owner mismatch', policy: 'authz.rego:12' },
      blocked_by: 'OPA authz policy',
      latency_ms: 12,
    },
  },
  {
    id: 'dpop',
    icon: '🔄',
    name: 'DPoP Token Replay',
    label: 'badge-amber',
    category: 'Token Security',
    desc: 'Attacker stolen DPoP proof (jti: joop-001) và replay lại request. Redis phát hiện jti đã tồn tại → reject.',
    script: 'scripts/attacks/replay_dpop_attack.py',
    editableFields: { path: '/api/v1/orders', body: '{\n  "product_id": "prod-001",\n  "quantity": 1\n}' },
    buildRequest: (f) => ({
      method: 'POST', path: f.path, body: f.body,
      headers: {
        'Host': 'localhost:8000',
        'Authorization': `DPoP ${FAKE_JWT}`,
        'DPoP': FAKE_DPOP,
        'X-Request-ID': 'req-replay-001',
        'X-Forwarded-For': '10.0.0.22',
        'Content-Type': 'application/json',
      },
    }),
    mockResponse: {
      status: 'BLOCKED', http_code: 401,
      detail: 'DPoP proof replay detected: jti already used',
      jti: 'joop-001',
      redis_key: 'dpop:jti:joop-001',
      blocked_by: 'Redis SET NX jti check (dpop_verifier.py)',
      latency_ms: 8,
    },
  },
  {
    id: 'algnone',
    icon: '🔑',
    name: 'JWT alg=none',
    label: 'badge-red',
    category: 'Authentication',
    desc: 'Forged JWT dùng alg=none, xóa signature, claim role=admin. Kong jwt-hardening.lua từ chối mọi token không dùng RS256.',
    script: 'scripts/attacks/alg_none_attack.py',
    editableFields: { path: '/api/v1/users/me', body: '' },
    buildRequest: (f) => ({
      method: 'GET', path: f.path, body: null,
      headers: {
        'Host': 'localhost:8000',
        'Authorization': `Bearer ${FAKE_ALG_NONE}`,
        'X-Request-ID': 'req-algnone-001',
        'X-Forwarded-For': '10.0.0.99',
        'Content-Type': 'application/json',
      },
    }),
    mockResponse: {
      status: 'BLOCKED', http_code: 401,
      detail: 'JWT algorithm not allowed: none',
      jwt_header: { alg: 'none', typ: 'JWT' },
      allowed_algorithms: ['RS256'],
      blocked_by: 'Kong jwt-hardening.lua plugin',
      latency_ms: 6,
    },
  },
  {
    id: 'ssrf',
    icon: '🌐',
    name: 'SSRF / Metadata',
    label: 'badge-amber',
    category: 'Network',
    desc: 'Trigger server-side fetch tới AWS metadata endpoint 169.254.169.254 để leak IAM credentials. Bị chặn bởi iptables + URL validator.',
    script: 'scripts/attacks/ssrf_test.py',
    editableFields: {
      path: '/api/v1/fetch',
      body: '{\n  "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"\n}',
    },
    buildRequest: (f) => ({
      method: 'POST', path: f.path, body: f.body,
      headers: {
        'Host': 'localhost:8000',
        'Authorization': `Bearer ${FAKE_JWT}`,
        'X-Request-ID': 'req-ssrf-001',
        'X-Forwarded-For': '10.0.0.55',
        'Content-Type': 'application/json',
      },
    }),
    mockResponse: {
      status: 'BLOCKED', http_code: 403,
      detail: 'SSRF blocked: destination IP in deny list',
      denied_host: '169.254.169.254',
      rule: 'iptables OUTPUT -d 169.254.0.0/16 -j DROP',
      blocked_by: 'iptables egress + URL allowlist validator',
      latency_ms: 4,
    },
  },
]

function buildRaw(method, path, headers, body) {
  const hLines = Object.entries(headers).map(([k,v]) =>
    `${k}: ${(k==='Authorization'||k==='DPoP') ? v.slice(0,72)+'...' : v}`
  ).join('\n')
  return `${method} ${path} HTTP/1.1\n${hLines}${body ? '\n\n'+body : ''}`
}

async function callAttack(attack, fields) {
  const req = attack.buildRequest(fields)
  try {
    const res = await fetch(`${KONG_URL}/api/v1/attacks/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: attack.id, request: req }),
    })
    if (!res.ok) throw new Error()
    return { ...(await res.json()), fromBackend: true }
  } catch {
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600))
    return { ...attack.mockResponse, fromBackend: false }
  }
}

export default function AttackSimulation() {
  const [attacks, setAttacks] = useState(ATTACKS_INIT.map(a => ({ ...a, fields: { ...a.editableFields } })))
  const [results, setResults] = useState({})
  const [running, setRunning] = useState({})
  const [expanded, setExpanded] = useState({})
  const [activeTab, setActiveTab] = useState({})
  const [globalLog, setGlobalLog] = useState([])
  const [runningAll, setRunningAll] = useState(false)

  function updateField(id, key, val) {
    setAttacks(p => p.map(a => a.id===id ? {...a, fields:{...a.fields,[key]:val}} : a))
  }

  async function runAttack(attack) {
    setRunning(p => ({...p,[attack.id]:true}))
    setResults(p => ({...p,[attack.id]:null}))
    setActiveTab(p => ({...p,[attack.id]:'response'}))
    const res = await callAttack(attack, attack.fields)
    setResults(p => ({...p,[attack.id]:res}))
    setRunning(p => ({...p,[attack.id]:false}))
    setGlobalLog(p => [{
      time: new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
      name: attack.name, ...res,
    }, ...p].slice(0,30))
  }

  async function runAll() {
    setRunningAll(true)
    for (const a of attacks) { await runAttack(a); await new Promise(r=>setTimeout(r,150)) }
    setRunningAll(false)
  }

  const totalRun = Object.values(results).filter(Boolean).length
  const blockedCount = Object.values(results).filter(r=>r?.status==='BLOCKED').length

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Attack Simulation</div>
          <div className="topbar-sub">Mô phỏng tấn công API — OWASP Top 10 · chỉ chạy trên môi trường kiểm thử</div>
        </div>
        <div className="topbar-right">
          {totalRun > 0 && (
            <div style={{
              fontSize:'12px', display:'flex', alignItems:'center', gap:'6px',
              color: blockedCount===totalRun ? 'var(--green)' : 'var(--accent)',
              background: blockedCount===totalRun ? '#e8f5ee' : '#fcecea',
              padding:'5px 10px', borderRadius:'6px',
              border:`1px solid ${blockedCount===totalRun ? '#c8e6d4' : '#f5c8c2'}`,
            }}>
              {blockedCount===totalRun ? '✅' : '⚠️'} {blockedCount}/{totalRun} blocked
            </div>
          )}
          <button className={`btn btn-sm ${runningAll?'btn-outline':'btn-primary'}`} onClick={runAll} disabled={runningAll}>
            {runningAll ? '⏳ Đang chạy...' : '⚡ Chạy tất cả'}
          </button>
        </div>
      </div>

      <div className="content">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'24px'}}>
          {attacks.map(attack => {
            const res = results[attack.id]
            const isRunning = running[attack.id]
            const isExpanded = expanded[attack.id]
            const tab = activeTab[attack.id] || 'request'
            const req = attack.buildRequest(attack.fields)
            const hasBody = attack.editableFields.body !== ''

            return (
              <div key={attack.id} className="card">
                {/* Card header - click to expand */}
                <div className="card-header" style={{cursor:'pointer'}}
                  onClick={() => setExpanded(p => ({...p,[attack.id]:!p[attack.id]}))}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px',flex:1}}>
                    <span style={{fontSize:'22px'}}>{attack.icon}</span>
                    <div>
                      <div className="card-title">{attack.name}</div>
                      <div style={{display:'flex',gap:'6px',marginTop:'4px'}}>
                        <span className={`badge ${attack.label}`}>{attack.category}</span>
                        <span style={{fontSize:'10.5px',color:'var(--muted)',fontFamily:'monospace'}}>{attack.script.split('/').pop()}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    {res && <span className={`badge ${res.status==='BLOCKED'?'badge-green':'badge-red'}`}>{res.status==='BLOCKED'?'✓ ':'✗ '}{res.status}</span>}
                    <span style={{fontSize:'12px',color:'var(--muted)'}}>{isExpanded?'▲':'▼'}</span>
                  </div>
                </div>

                <div className="card-body">
                  <p style={{fontSize:'13px',color:'var(--muted)',marginBottom:'14px',lineHeight:'1.5'}}>{attack.desc}</p>

                  {isExpanded && (
                    <>
                      {/* Tab switcher */}
                      <div style={{display:'flex',background:'var(--cream)',border:'1px solid var(--border)',borderRadius:'8px',padding:'2px',marginBottom:'12px'}}>
                        {[['request','📤 Request'],['response','📥 Response']].map(([k,l]) => (
                          <button key={k} onClick={e=>{e.stopPropagation();setActiveTab(p=>({...p,[attack.id]:k}))}} style={{
                            flex:1,padding:'6px',fontSize:'12px',fontWeight:500,cursor:'pointer',
                            border:'none',fontFamily:'DM Sans,sans-serif',borderRadius:'6px',transition:'all .15s',
                            background:tab===k?'#fff':'none',
                            color:tab===k?'var(--ink)':'var(--muted)',
                            boxShadow:tab===k?'0 1px 3px rgba(0,0,0,.08)':'none',
                          }}>{l}</button>
                        ))}
                      </div>

                      {/* REQUEST TAB */}
                      {tab==='request' && (
                        <div style={{marginBottom:'12px'}}>
                          {/* Editable path + body */}
                          <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'6px'}}>
                            Chỉnh trước khi chạy
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:hasBody?'6px':'10px'}}>
                            <span style={{fontSize:'11px',fontFamily:'monospace',color:'#fff',background:'var(--ink)',padding:'3px 7px',borderRadius:'4px',minWidth:'36px',textAlign:'center'}}>{req.method}</span>
                            <input
                              value={attack.fields.path}
                              onChange={e=>updateField(attack.id,'path',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              style={{flex:1,padding:'6px 10px',border:'1.5px solid var(--border)',borderRadius:'6px',fontFamily:'monospace',fontSize:'12px',background:'#fff',color:'var(--ink)',outline:'none'}}
                            />
                          </div>
                          {hasBody && (
                            <textarea
                              value={attack.fields.body}
                              onChange={e=>updateField(attack.id,'body',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              rows={3}
                              style={{width:'100%',padding:'8px 10px',border:'1.5px solid var(--border)',borderRadius:'6px',fontFamily:'monospace',fontSize:'11.5px',background:'#fff',color:'var(--ink)',outline:'none',resize:'vertical',marginBottom:'10px'}}
                            />
                          )}

                          {/* Full raw request */}
                          <div style={{fontSize:'10.5px',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'6px'}}>
                            Full HTTP request
                          </div>
                          <pre style={{
                            background:'#0f0e0d',padding:'14px 16px',borderRadius:'8px',
                            fontSize:'11px',lineHeight:'1.8',overflowX:'auto',
                            fontFamily:'"Fira Code","Courier New",monospace',
                            whiteSpace:'pre',maxHeight:'200px',overflowY:'auto',margin:0,
                          }}>
                            <span style={{color:'#81d4fa'}}>{req.method}</span>
                            {' '}<span style={{color:'#fff176'}}>{req.path}</span>
                            {' '}<span style={{color:'#666'}}>HTTP/1.1</span>{'\n'}
                            {Object.entries(req.headers).map(([k,v])=>(
                              <span key={k}>
                                <span style={{color:'#ef9a9a'}}>{k}</span>
                                <span style={{color:'#666'}}>: </span>
                                <span style={{color:(k==='Authorization'||k==='DPoP')?'#ce93d8':'#a5d6a7'}}>
                                  {(k==='Authorization'||k==='DPoP') ? v.slice(0,70)+'...' : v}
                                </span>{'\n'}
                              </span>
                            ))}
                            {req.body && <span>{'\n'}<span style={{color:'#80cbc4'}}>{req.body}</span></span>}
                          </pre>
                        </div>
                      )}

                      {/* RESPONSE TAB */}
                      {tab==='response' && (
                        <div style={{marginBottom:'12px'}}>
                          {isRunning ? (
                            <div style={{background:'var(--cream)',borderRadius:'8px',padding:'24px',textAlign:'center',color:'var(--muted)',fontSize:'13px'}}>
                              ⏳ Đang gửi request tới {KONG_URL}{attack.fields.path}...
                            </div>
                          ) : res ? (
                            <>
                              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                                <span style={{fontSize:'14px',fontWeight:700,color:res.status==='BLOCKED'?'var(--green)':'var(--accent)'}}>
                                  HTTP {res.http_code}
                                </span>
                                <span className={`badge ${res.status==='BLOCKED'?'badge-green':'badge-red'}`}>{res.status}</span>
                                <span style={{fontSize:'11px',color:'var(--muted)',marginLeft:'auto'}}>
                                  {res.latency_ms}ms ·{' '}
                                  {res.fromBackend
                                    ? <span style={{color:'var(--green)'}}>● live backend</span>
                                    : <span style={{color:'var(--amber)'}}>● mock</span>}
                                </span>
                              </div>
                              <pre style={{
                                background:res.status==='BLOCKED'?'#0a1a10':'#1a0a0a',
                                color:res.status==='BLOCKED'?'#a5d6a7':'#ef9a9a',
                                padding:'14px 16px',borderRadius:'8px',fontSize:'11px',
                                lineHeight:'1.8',overflowX:'auto',
                                fontFamily:'"Fira Code","Courier New",monospace',
                                whiteSpace:'pre',maxHeight:'200px',overflowY:'auto',margin:0,
                              }}>
                                {JSON.stringify(res, null, 2)}
                              </pre>
                            </>
                          ) : (
                            <div style={{background:'var(--cream)',borderRadius:'8px',padding:'24px',textAlign:'center',color:'var(--muted)',fontSize:'13px'}}>
                              Chưa có kết quả — nhấn Simulate để chạy
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <button
                    className={`btn btn-sm ${isRunning?'btn-outline':'btn-primary'}`}
                    style={{width:'100%'}}
                    disabled={isRunning}
                    onClick={e=>{e.stopPropagation();runAttack(attack)}}
                  >
                    {isRunning ? '⏳ Đang chạy...' : `▶ Simulate ${attack.name}`}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Global log */}
        {globalLog.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Attack Log</div>
              <button className="btn btn-outline btn-xs" onClick={()=>setGlobalLog([])}>Xóa log</button>
            </div>
            <div className="card-body" style={{padding:'12px 16px'}}>
              {globalLog.map((entry,i) => (
                <div key={i} className="log-item">
                  <div className="log-time">{entry.time}</div>
                  <div className="log-text">
                    <span className={`log-tag ${entry.status==='BLOCKED'?'deny':'allow'}`}>{entry.status}</span>
                    {entry.name} — HTTP {entry.http_code} · {entry.blocked_by} · {entry.latency_ms}ms
                    {!entry.fromBackend && <span style={{fontSize:'10px',color:'var(--muted)',marginLeft:'6px'}}>(mock)</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
