import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BAR_DATA = [
  { day:'T2', val:6.8,  h:'55%' },
  { day:'T3', val:8.7,  h:'70%' },
  { day:'T4', val:5.6,  h:'45%' },
  { day:'T5', val:10.5, h:'85%' },
  { day:'T6', val:7.7,  h:'62%' },
  { day:'T7', val:11.2, h:'90%' },
  { day:'CN', val:12.4, h:'78%', accent:true },
]

const AUDIT_LOG = [
  { time:'14:31', tag:'deny',  text:'JWT alg=none bị chặn — IP 10.0.0.14' },
  { time:'14:28', tag:'allow', text:'admin@co.vn xem /users — OPA pass' },
  { time:'14:22', tag:'deny',  text:'BOLA: user1 truy cập order của user2' },
  { time:'14:15', tag:'warn',  text:'Rate limit 95% — IP 10.0.0.8' },
  { time:'14:09', tag:'allow', text:'Key rotation hoàn thành — Vault v12' },
  { time:'14:01', tag:'deny',  text:'JWT không hợp lệ bị chặn ở gateway' },
]

const SEC_STATUS = [
  { dot:'ok',   name:'TLS 1.3',         val:'Active ✓' },
  { dot:'ok',   name:'Kong Gateway',     val:'Healthy' },
  { dot:'ok',   name:'OPA Policy',       val:'7 rules' },
  { dot:'ok',   name:'Vault KEK',        val:'Rotated 4m ago' },
  { dot:'warn', name:'TOTP',             val:'1 expired' },
  { dot:'ok',   name:'Redis session',    val:'Healthy' },
  { dot:'ok',   name:'HttpOnly Cookie',  val:'Active' },
  { dot:'ok',   name:'CORS',             val:'localhost:3000' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [hoveredBar, setHoveredBar] = useState(null)
  const [tab, setTab] = useState('biz')

  const tabStyle = (k) => ({
    flex: 1, padding: '8px', textAlign: 'center', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer', borderRadius: '7px', transition: 'all .15s', border: 'none',
    fontFamily: 'DM Sans,sans-serif',
    background: tab === k ? '#fff' : 'none',
    color: tab === k ? 'var(--ink)' : 'var(--muted)',
    boxShadow: tab === k ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
  })

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Dashboard tổng quan</div>
          <div className="topbar-sub">Thứ 7, 28/03/2026 · 14:32 — Admin view</div>
        </div>
        <div className="topbar-right">
          <div className="search-box"><span>🔍</span><input placeholder="Tìm kiếm..." /></div>
          <div className="tb-icon">🔔<span className="tb-dot"></span></div>
          <button className="btn btn-outline btn-sm" onClick={() => window.open('http://localhost:3000')}>📈 Grafana</button>
        </div>
      </div>

      <div className="content">
        {/* Tab switcher */}
        <div style={{ display:'flex', background:'var(--cream)', border:'1.5px solid var(--border)', borderRadius:'10px', padding:'3px', marginBottom:'22px' }}>
          <button style={tabStyle('biz')} onClick={() => setTab('biz')}>📦 Kinh doanh</button>
          <button style={tabStyle('sec')} onClick={() => setTab('sec')}>🛡 Bảo mật hệ thống</button>
        </div>

        {/* ── BUSINESS TAB ── */}
        {tab === 'biz' && (
          <>
            <div className="kpi-grid">
              <div className="kpi-card green"><div className="kpi-bg-icon">💰</div><div className="kpi-label">Doanh thu hôm nay</div><div className="kpi-value">12.4M</div><div className="kpi-change up">↑ 18% so hôm qua</div></div>
              <div className="kpi-card blue"><div className="kpi-bg-icon">🛒</div><div className="kpi-label">Đơn hàng mới</div><div className="kpi-value">47</div><div className="kpi-change up">↑ 12 đơn</div></div>
              <div className="kpi-card amber"><div className="kpi-bg-icon">📦</div><div className="kpi-label">Sản phẩm tồn</div><div className="kpi-value">156</div><div className="kpi-change dn">↓ 5 sắp hết</div></div>
              <div className="kpi-card red"><div className="kpi-bg-icon">🛡</div><div className="kpi-label">Request bị chặn</div><div className="kpi-value">23</div><div className="kpi-change dn">↑ 3 trong 1h</div></div>
            </div>

            <div className="grid-3-1">
              <div className="card mb18">
                <div className="card-header">
                  <div>
                    <div className="card-title">Doanh thu 7 ngày</div>
                    <div className="card-sub">
                      {hoveredBar
                        ? <span style={{color:'var(--ink)',fontWeight:600}}>{hoveredBar.day}: {hoveredBar.val}M VNĐ {hoveredBar.accent ? '📍' : ''}</span>
                        : 'VNĐ (triệu) — hover để xem chi tiết'}
                    </div>
                  </div>
                  <a className="card-link" onClick={() => navigate('/admin/orders')}>Xem đơn hàng →</a>
                </div>
                <div className="card-body">
                  <div className="bar-chart">
                    {BAR_DATA.map(b => (
                      <div key={b.day} className="bar"
                        style={{
                          height: b.h,
                          background: hoveredBar?.day === b.day
                            ? (b.accent ? '#e05530' : '#1a3a28')
                            : (b.accent ? 'var(--accent)' : '#2a6049'),
                          cursor: 'pointer', transition: 'all .15s',
                          outline: hoveredBar?.day === b.day ? '2px solid var(--ink)' : 'none',
                        }}
                        onMouseEnter={() => setHoveredBar(b)}
                        onMouseLeave={() => setHoveredBar(null)}
                      />
                    ))}
                  </div>
                  <div className="bar-labels">
                    {BAR_DATA.map(b => (
                      <div key={b.day} className="bar-label"
                        style={{ fontWeight: hoveredBar?.day === b.day ? 700 : 400, color: hoveredBar?.day === b.day ? 'var(--ink)' : undefined }}>
                        {b.day}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card mb18">
                <div className="card-header"><div className="card-title">Trạng thái nhanh</div></div>
                <div className="card-body" style={{padding:'12px 16px'}}>
                  {[
                    {dot:'ok',  name:'Kong Gateway',   val:'Healthy'},
                    {dot:'ok',  name:'Keycloak IdP',   val:'Online'},
                    {dot:'ok',  name:'PostgreSQL',     val:'Connected'},
                    {dot:'warn',name:'TOTP',           val:'1 expired'},
                    {dot:'ok',  name:'Redis',          val:'0 replay'},
                    {dot:'ok',  name:'Vault',          val:'KEK v12'},
                  ].map(i => (
                    <div key={i.name} className="sec-item">
                      <span className={`sec-dot ${i.dot}`}></span>
                      <span className="sec-name">{i.name}</span>
                      <span className="sec-val">{i.val}</span>
                    </div>
                  ))}
                  <div style={{marginTop:'12px'}}>
                    <button className="btn btn-outline btn-sm" style={{width:'100%'}} onClick={() => setTab('sec')}>
                      Chi tiết bảo mật →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Đơn hàng gần đây</div>
                  <a className="card-link" onClick={() => navigate('/admin/orders')}>Xem tất cả →</a>
                </div>
                <table>
                  <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead>
                  <tbody>
                    {[
                      {id:'ORD-1042',name:'Nguyễn Văn An', total:'15,490,000đ',badge:'badge-green',status:'Hoàn thành'},
                      {id:'ORD-1041',name:'Trần Thị Bích',  total:'890,000đ',   badge:'badge-amber',status:'Đang xử lý'},
                      {id:'ORD-1040',name:'Lê Văn Cường',   total:'7,990,000đ', badge:'badge-blue', status:'Đang giao'},
                      {id:'ORD-1039',name:'Phạm Thị Dung',  total:'1,470,000đ', badge:'badge-red',  status:'Thất bại'},
                    ].map(r => (
                      <tr key={r.id} onClick={() => navigate('/admin/orders')} style={{cursor:'pointer'}}>
                        <td style={{fontWeight:700}}>#{r.id}</td>
                        <td>{r.name}</td><td>{r.total}</td>
                        <td><span className={`badge ${r.badge}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Người dùng hoạt động</div>
                  <a className="card-link" onClick={() => navigate('/admin/users')}>Xem tất cả →</a>
                </div>
                <div className="card-body" style={{padding:'12px 16px'}}>
                  {[
                    {av:'LP',name:'Lưu Hồng Phúc', role:'admin',    mfa:'WebAuthn', color:'#c84b2f'},
                    {av:'PH',name:'Phan Thái Hưng', role:'admin',    mfa:'TOTP',     color:'#1e4e7a'},
                    {av:'VK',name:'Võ Tuấn Tuấn Kiệt',   role:'staff',    mfa:'TOTP',     color:'#2a6049'},
                    {av:'NA',name:'Nguyễn Văn An',  role:'customer', mfa:'TOTP',     color:'#5a2d9a'},
                  ].map(u => (
                    <div key={u.av} style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 0',borderBottom:'1px solid var(--cream)'}}>
                      <div className="sb-avatar" style={{background:u.color,width:'30px',height:'30px',fontSize:'11px'}}>{u.av}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'13px',fontWeight:500}}>{u.name}</div>
                        <div style={{fontSize:'11px',color:'var(--muted)'}}>{u.mfa}</div>
                      </div>
                      <span className={`badge ${u.role==='admin'?'badge-red':u.role==='staff'?'badge-blue':'badge-gray'}`}>{u.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── SECURITY TAB ── */}
        {tab === 'sec' && (
          <>
            <div className="kpi-grid">
              <div className="kpi-card red"><div className="kpi-bg-icon">🚫</div><div className="kpi-label">Request bị chặn</div><div className="kpi-value">23</div><div className="kpi-change dn">↑ 3 trong 1h qua</div></div>
              <div className="kpi-card amber"><div className="kpi-bg-icon">⚡</div><div className="kpi-label">Rate limit hit</div><div className="kpi-value">8</div><div className="kpi-change dn">72% capacity</div></div>
              <div className="kpi-card blue"><div className="kpi-bg-icon">🔑</div><div className="kpi-label">Auth thành công</div><div className="kpi-value">4,798</div><div className="kpi-change up">99.5% allow rate</div></div>
              <div className="kpi-card green"><div className="kpi-bg-icon">🔐</div><div className="kpi-label">KEK Version</div><div className="kpi-value">v12</div><div className="kpi-change up">Rotated 4m ago</div></div>
            </div>

            <div className="grid-3-1">
              <div className="card mb18">
                <div className="card-header">
                  <div className="card-title">Security Audit Log</div>
                  <div style={{display:'flex',gap:'8px'}}>
                    <a className="card-link" onClick={() => navigate('/admin/attacks')}>Simulate attack →</a>
                    <button className="btn btn-outline btn-sm" onClick={() => window.open('http://localhost:3000')}>📈 Grafana</button>
                  </div>
                </div>
                <div className="card-body" style={{padding:'12px 16px'}}>
                  {AUDIT_LOG.map((l,i) => (
                    <div key={i} className="log-item">
                      <div className="log-time">{l.time}</div>
                      <div className="log-text">
                        <span className={`log-tag ${l.tag}`}>{l.tag.toUpperCase()}</span>
                        {l.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card mb18">
                <div className="card-header"><div className="card-title">Trạng thái bảo mật</div></div>
                <div className="card-body" style={{padding:'12px 16px'}}>
                  {SEC_STATUS.map(i => (
                    <div key={i.name} className="sec-item">
                      <span className={`sec-dot ${i.dot}`}></span>
                      <span className="sec-name">{i.name}</span>
                      <span className="sec-val">{i.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <div className="card-title">OPA — Lý do từ chối 24h</div>
                  <a className="card-link" onClick={() => navigate('/admin/settings')}>Xem policy →</a>
                </div>
                <div className="card-body" style={{padding:'12px 16px'}}>
                  {[
                    {name:'insufficient_role',    val:14, color:'var(--accent)', w:'60%'},
                    {name:'BOLA / owner mismatch', val:5,  color:'var(--accent)', w:'22%'},
                    {name:'rate_limit_exceeded',   val:3,  color:'var(--amber)',  w:'13%'},
                    {name:'jwt_expired',           val:1,  color:'var(--amber)',  w:'4%'},
                  ].map(item => (
                    <div key={item.name} style={{marginBottom:'12px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                        <span style={{fontSize:'12px',fontFamily:'monospace'}}>{item.name}</span>
                        <span style={{fontSize:'12px',fontWeight:700,color:item.color}}>{item.val}</span>
                      </div>
                      <div className="progress-bar" style={{width:'100%'}}>
                        <div className="progress-fill" style={{width:item.w,background:item.color}}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Attack vectors phát hiện</div>
                  <a className="card-link" onClick={() => navigate('/admin/attacks')}>Test →</a>
                </div>
                <div className="card-body" style={{padding:'12px 16px'}}>
                  {[
                    {icon:'🚫', name:'JWT alg=none',    status:'BLOCKED', badge:'badge-green', count:'3 lần'},
                    {icon:'🍪', name:'Cookie theft attempt', status:'BLOCKED', badge:'badge-green', count:'1 lần'},
                    {icon:'👤', name:'BOLA / IDOR',      status:'BLOCKED', badge:'badge-green', count:'5 lần'},
                    {icon:'🌐', name:'SSRF attempt',     status:'BLOCKED', badge:'badge-green', count:'0 lần'},
                  ].map(item => (
                    <div key={item.name} className="sec-item">
                      <span style={{fontSize:'14px'}}>{item.icon}</span>
                      <span className="sec-name">{item.name}</span>
                      <span style={{fontSize:'11px',color:'var(--muted)',marginRight:'8px'}}>{item.count}</span>
                      <span className={`badge ${item.badge}`}>{item.status}</span>
                    </div>
                  ))}
                  <div style={{marginTop:'14px'}}>
                    <button className="btn btn-primary btn-sm" style={{width:'100%'}} onClick={() => navigate('/admin/attacks')}>
                      ⚡ Mở Attack Simulation →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
