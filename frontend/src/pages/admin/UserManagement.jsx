import React, { useState } from 'react'

const INIT_USERS = [
  { av:'LP', name:'Lưu Hồng Phúc',  email:'phuc@company.com', role:'admin',    mfa:'WebAuthn', status:'active', last:'28/03 · 14:32', color:'#c84b2f' },
  { av:'PH', name:'Phan Thái Hưng', email:'hung@company.com', role:'admin',    mfa:'TOTP',     status:'active', last:'28/03 · 13:10', color:'#1e4e7a' },
  { av:'VK', name:'Võ Tưởng Tuấn Kiệt', email:'kiet@company.com', role:'staff',    mfa:'TOTP',     status:'active', last:'28/03 · 11:44', color:'#2a6049' },
  { av:'NA', name:'Nguyễn Văn An',  email:'an@gmail.com',     role:'customer', mfa:'TOTP',     status:'active', last:'28/03 · 10:20', color:'#5a2d9a' },
  { av:'TB', name:'Trần Thị Bích',  email:'bich@gmail.com',   role:'customer', mfa:'TOTP',     status:'locked', last:'26/03 · 08:15', color:'#b05a10' },
  { av:'LC', name:'Lê Văn Cường',   email:'cuong@gmail.com',  role:'customer', mfa:'TOTP',     status:'active', last:'25/03 · 17:00', color:'#0f6674' },
]

const ROLE_BADGE = { admin:'badge-red', staff:'badge-blue', customer:'badge-gray' }
const ROLE_LABEL = { admin:'Admin', staff:'Staff', customer:'Customer' }

const NOTIFS = [
  { time:'14:31', text:'JWT alg=none bị chặn — IP 10.0.0.14', type:'deny' },
  { time:'14:22', text:'BOLA: user1 truy cập order của user2', type:'deny' },
  { time:'14:15', text:'Rate limit 95% — IP 10.0.0.8',         type:'warn' },
  { time:'14:09', text:'Key rotation hoàn thành — Vault v12',  type:'allow' },
]

export default function UserManagement() {
  const [users, setUsers] = useState(INIT_USERS)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
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
      color: colors[Math.floor(Math.random() * colors.length)]
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
          {/* Nút chuông thông báo */}
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
        <div className="filter-bar">
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Tìm tên, email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">Tất cả vai trò</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="customer">Customer</option>
          </select>
          <span className="filter-count">{filtered.length} người dùng</span>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Người dùng</th><th>Vai trò</th><th>MFA</th><th>Trạng thái</th><th>Đăng nhập cuối</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.email}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
                        <div className="sb-avatar" style={{ background:u.color, width:'32px', height:'32px', fontSize:'11px' }}>{u.av}</div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:'13px' }}>{u.name}</div>
                          <div style={{ fontSize:'11px', color:'var(--muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span></td>
                    <td><span style={{ fontSize:'12px' }}>🔐 {u.mfa}</span></td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                        {u.status === 'active' ? 'Active' : 'Bị khoá'}
                      </span>
                    </td>
                    <td style={{ fontSize:'12px', color:'var(--muted)' }}>{u.last}</td>
                    <td>
                      <div style={{ display:'flex', gap:'5px' }}>
                        <button className="btn btn-outline btn-xs" title="Chỉnh sửa">✏️</button>
                        <button
                          className={`btn btn-xs ${u.status === 'active' ? 'btn-danger' : 'btn-green'}`}
                          title={u.status === 'active' ? 'Khoá tài khoản' : 'Mở khoá'}
                          onClick={() => toggleLock(u.email)}
                        >
                          {u.status === 'active' ? '🔒' : '🔓'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination"><span className="page-info">{filtered.length} người dùng</span></div>
        </div>

        <div style={{ marginTop:'18px' }} className="grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">Phân bổ vai trò</div></div>
            <div className="card-body">
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {[
                  ['Admin',    users.filter(u=>u.role==='admin').length,    'var(--accent)'],
                  ['Staff',    users.filter(u=>u.role==='staff').length,    'var(--blue)'],
                  ['Customer', users.filter(u=>u.role==='customer').length, 'var(--green)'],
                ].map(([label,count,color]) => (
                  <div key={label}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'4px' }}>
                      <span>{label}</span>
                      <span style={{ fontWeight:600 }}>{count} / {users.length}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width:`${(count/users.length)*100}%`, background:color }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Trạng thái MFA</div></div>
            <div className="card-body">
              {[
                { dot:'ok',   name:'WebAuthn / FIDO2', val:'1 user' },
                { dot:'warn', name:'TOTP fallback',     val:`${users.length-1} users` },
                { dot:'ok',   name:'Không có MFA',      val:'0 users ✓' },
                { dot:'err',  name:'Tài khoản bị khoá', val:`${users.filter(u=>u.status==='locked').length} user` },
              ].map(item => (
                <div key={item.name} className="sec-item">
                  <span className={`sec-dot ${item.dot}`}></span>
                  <span className="sec-name">{item.name}</span>
                  <span className="sec-val">{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal thêm user */}
      {showModal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Thêm người dùng</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Họ tên</label>
                <input placeholder="Nguyễn Văn A" value={form.name} onChange={e => setForm({...form, name:e.target.value})} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" placeholder="email@company.com" value={form.email} onChange={e => setForm({...form, email:e.target.value})} />
              </div>
              <div className="field">
                <label>Vai trò</label>
                <select value={form.role} onChange={e => setForm({...form, role:e.target.value})}>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
              <div style={{ padding:'10px 13px', background:'#f0faf4', border:'1px solid #c8e6d4', borderRadius:'8px', fontSize:'11.5px', color:'var(--green)', marginBottom:'14px' }}>
                🔒 User sẽ được tạo trong Keycloak với TOTP MFA mặc định
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" style={{ flex:1 }} onClick={addUser}>💾 Tạo user</button>
                <button className="btn btn-outline" onClick={() => setShowModal(false)}>Huỷ</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
          background:'var(--ink)', color:'#fff', padding:'10px 20px', borderRadius:'8px',
          fontSize:'13px', zIndex:999, boxShadow:'0 4px 16px rgba(0,0,0,.2)'
        }}>{toast}</div>
      )}

      {/* Click outside để đóng notif */}
      {showNotif && <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={() => setShowNotif(false)} />}
    </>
  )
}
