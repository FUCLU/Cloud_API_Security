import React, { useState, useEffect } from 'react'

const INIT_USERS = [
  { av:'LP', name:'Lưu Hồng Phúc',      email:'phuc@company.com',  role:'admin',    mfa:'WebAuthn', status:'active', last:'28/03 · 14:32', color:'#c84b2f',
    token:{ iss:'http://localhost:8080/realms/company', sub:'uid-001', roles:['admin'], exp:280, dpop:true,  jti:'abc-001' } },
  { av:'PH', name:'Phan Thái Hưng',      email:'hung@company.com',  role:'admin',    mfa:'TOTP',     status:'active', last:'28/03 · 13:10', color:'#1e4e7a',
    token:{ iss:'http://localhost:8080/realms/company', sub:'uid-002', roles:['admin'], exp:145, dpop:true,  jti:'abc-002' } },
  { av:'VK', name:'Võ Tưởng Tuấn Kiệt', email:'kiet@company.com',  role:'staff',    mfa:'TOTP',     status:'active', last:'28/03 · 11:44', color:'#2a6049',
    token:{ iss:'http://localhost:8080/realms/company', sub:'uid-003', roles:['staff'], exp:60,  dpop:false, jti:'abc-003' } },
  { av:'NA', name:'Nguyễn Văn An',       email:'an@gmail.com',      role:'customer', mfa:'TOTP',     status:'active', last:'28/03 · 10:20', color:'#5a2d9a',
    token:{ iss:'http://localhost:8080/realms/company', sub:'uid-004', roles:['customer'], exp:210, dpop:true, jti:'abc-004' } },
  { av:'TB', name:'Trần Thị Bích',       email:'bich@gmail.com',    role:'customer', mfa:'TOTP',     status:'locked', last:'26/03 · 08:15', color:'#b05a10',
    token:null },
  { av:'LC', name:'Lê Văn Cường',        email:'cuong@gmail.com',   role:'customer', mfa:'TOTP',     status:'active', last:'25/03 · 17:00', color:'#0f6674',
    token:{ iss:'http://localhost:8080/realms/company', sub:'uid-006', roles:['customer'], exp:55, dpop:false, jti:'abc-006' } },
]

const ROLE_BADGE = { admin:'badge-red', staff:'badge-blue', customer:'badge-gray' }
const NOTIFS = [
  { time:'14:31', text:'JWT alg=none bị chặn — IP 10.0.0.14', type:'deny' },
  { time:'14:22', text:'BOLA: user1 truy cập order của user2', type:'deny' },
  { time:'14:15', text:'Rate limit 95% — IP 10.0.0.8',         type:'warn' },
  { time:'14:09', text:'Key rotation hoàn thành — Vault v12',  type:'allow' },
]

function TokenInspector({ token }) {
  const [countdown, setCountdown] = useState(token.exp)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const pct = Math.round((countdown / 300) * 100)
  const isExpiring = countdown < 60
  const barColor = countdown === 0 ? 'var(--accent)' : isExpiring ? 'var(--amber)' : 'var(--green)'

  return (
    <div style={{ background:'var(--ink)', borderRadius:'10px', padding:'14px 16px', marginTop:'8px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
        <span style={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.07em' }}>
          Token Inspector
        </span>
        <span style={{ fontSize:'11px', fontFamily:'monospace', color: countdown === 0 ? '#e8785f' : isExpiring ? '#f5c542' : '#7ecfa0' }}>
          {countdown > 0 ? `exp: ${countdown}s` : 'EXPIRED'}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ height:'3px', background:'rgba(255,255,255,.1)', borderRadius:'2px', marginBottom:'12px' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:barColor, borderRadius:'2px', transition:'width 1s linear' }} />
      </div>
      {/* Fields */}
      {[
        ['iss', token.iss.replace('http://localhost:8080/realms/', '')],
        ['sub', token.sub],
        ['roles', token.roles.join(', ')],
        ['jti', token.jti],
        ['DPoP bound', token.dpop ? 'true ✓' : 'false ✗'],
        ['alg', 'RS256'],
      ].map(([k, v]) => (
        <div key={k} style={{ display:'flex', gap:'8px', marginBottom:'5px' }}>
          <span style={{ fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,.35)', minWidth:'80px' }}>{k}</span>
          <span style={{ fontSize:'11px', fontFamily:'monospace', color: k === 'DPoP bound' ? (token.dpop ? '#7ecfa0' : '#e8785f') : '#c8e6c9' }}>
            {v}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function UserManagement() {
  const [users, setUsers] = useState(INIT_USERS)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [showTokenFor, setShowTokenFor] = useState(null)
  const [form, setForm] = useState({ name:'', email:'', role:'customer' })
  const [toast, setToast] = useState('')

  const filtered = users.filter(u =>
    (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search)) &&
    (!roleFilter || u.role === roleFilter)
  )

  function toggleLock(email) {
    setUsers(prev => prev.map(u => {
      if (u.email !== email) return u
      const next = u.status === 'active' ? 'locked' : 'active'
      setToast(`${u.name} đã ${next === 'locked' ? 'bị khoá' : 'được mở khoá'} ✓`)
      setTimeout(() => setToast(''), 2500)
      return { ...u, status: next }
    }))
  }

  function addUser() {
    if (!form.name || !form.email) return
    const av = form.name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
    const colors = ['#c84b2f','#1e4e7a','#2a6049','#5a2d9a','#b05a10','#0f6674']
    setUsers(prev => [...prev, {
      av, name: form.name, email: form.email, role: form.role,
      mfa: 'TOTP', status: 'active', last: 'Chưa đăng nhập',
      color: colors[Math.floor(Math.random() * colors.length)],
      token: null,
    }])
    setToast(`Đã tạo user ${form.name} ✓`)
    setTimeout(() => setToast(''), 2500)
    setForm({ name:'', email:'', role:'customer' })
    setShowModal(false)
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Quản lý người dùng</div>
          <div className="topbar-sub">Admin — Keycloak IAM integration</div>
        </div>
        <div className="topbar-right">
          <div style={{ position:'relative' }}>
            <div className="tb-icon" onClick={() => setShowNotif(!showNotif)} style={{ cursor:'pointer' }}>
              🔔<span className="tb-dot"></span>
            </div>
            {showNotif && (
              <div style={{
                position:'absolute', right:0, top:'44px', width:'320px',
                background:'#fff', border:'1px solid var(--border)', borderRadius:'12px',
                boxShadow:'0 8px 28px rgba(0,0,0,.12)', zIndex:200
              }}>
                <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', fontWeight:600, fontSize:'13px' }}>
                  Thông báo bảo mật
                </div>
                {NOTIFS.map((n,i) => (
                  <div key={i} style={{ padding:'10px 16px', borderBottom:'1px solid var(--cream)', display:'flex', gap:'10px' }}>
                    <span className={`log-tag ${n.type}`}>{n.type.toUpperCase()}</span>
                    <div>
                      <div style={{ fontSize:'12.5px' }}>{n.text}</div>
                      <div style={{ fontSize:'10.5px', color:'var(--muted)', marginTop:'2px' }}>{n.time}</div>
                    </div>
                  </div>
                ))}
                <div style={{ padding:'10px 16px', textAlign:'center' }}>
                  <span style={{ fontSize:'12px', color:'var(--blue)', cursor:'pointer' }}>Xem tất cả →</span>
                </div>
              </div>
            )}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Thêm user</button>
        </div>
      </div>

      <div className="content">
        {/* Filter bar */}
        <div className="filter-bar" style={{ marginBottom:'18px' }}>
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Tìm tên, email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            style={{ padding:'8px 12px', border:'1.5px solid var(--border)', borderRadius:'8px', fontSize:'13px', background:'#fff', cursor:'pointer' }}>
            <option value="">Tất cả role</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="customer">Customer</option>
          </select>
        </div>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'18px' }}>
          {[
            ['Tổng users', users.length, ''],
            ['Admin', users.filter(u=>u.role==='admin').length, 'var(--accent)'],
            ['Staff', users.filter(u=>u.role==='staff').length, 'var(--blue)'],
            ['Bị khoá', users.filter(u=>u.status==='locked').length, 'var(--amber)'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:'10px', padding:'14px 16px', textAlign:'center' }}>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'24px', color: color || 'var(--ink)', marginBottom:'3px' }}>{val}</div>
              <div style={{ fontSize:'11px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Role</th>
                <th>MFA</th>
                <th>Đăng nhập cuối</th>
                <th>Trạng thái</th>
                <th>Token</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <>
                  <tr key={u.email}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div className="sb-avatar" style={{ background:u.color, width:'32px', height:'32px', fontSize:'11px', flexShrink:0 }}>{u.av}</div>
                        <div>
                          <div style={{ fontWeight:500, fontSize:'13.5px' }}>{u.name}</div>
                          <div style={{ fontSize:'11px', color:'var(--muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${ROLE_BADGE[u.role]}`}>{u.role}</span></td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                        <span className={`sec-dot ${u.mfa === 'WebAuthn' ? 'ok' : 'ok'}`}></span>
                        <span style={{ fontSize:'12.5px' }}>{u.mfa}</span>
                      </div>
                    </td>
                    <td style={{ fontSize:'12px', color:'var(--muted)' }}>{u.last}</td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                        {u.status === 'active' ? 'Active' : 'Locked'}
                      </span>
                    </td>
                    <td>
                      {u.token ? (
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={e => { e.stopPropagation(); setShowTokenFor(showTokenFor === u.email ? null : u.email) }}
                        >
                          {showTokenFor === u.email ? 'Ẩn' : '🔍 Token'}
                        </button>
                      ) : (
                        <span style={{ fontSize:'11px', color:'var(--muted)' }}>No session</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button className="btn btn-outline btn-xs" onClick={() => toggleLock(u.email)}>
                          {u.status === 'active' ? '🔒 Khoá' : '🔓 Mở'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {showTokenFor === u.email && u.token && (
                    <tr key={u.email + '-token'}>
                      <td colSpan={7} style={{ padding:'4px 16px 14px', background:'var(--cream)' }}>
                        <TokenInspector token={u.token} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add user modal */}
      <div className={`modal-overlay${showModal ? ' open' : ''}`} onClick={() => setShowModal(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Thêm người dùng</div>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
          </div>
          <div style={{ padding:'22px 26px' }}>
            <div className="field">
              <label>Họ tên</label>
              <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="Nguyễn Văn A" />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="user@company.com" />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}>
                <option value="customer">Customer</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
              <button className="btn btn-primary" style={{flex:1}} onClick={addUser}>Tạo user</button>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Hủy</button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:'28px', right:'28px', background:'var(--ink)', color:'#fff',
          padding:'12px 20px', borderRadius:'10px', fontSize:'13px', fontWeight:500,
          boxShadow:'0 4px 20px rgba(0,0,0,.25)', zIndex:500
        }}>
          {toast}
        </div>
      )}
    </>
  )
}
