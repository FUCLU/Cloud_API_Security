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

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [hoveredBar, setHoveredBar] = useState(null)

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
          <div className="tb-icon">⚙️</div>
        </div>
      </div>

      <div className="content">
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
                  {hoveredBar ? <span style={{color:'var(--ink)',fontWeight:600}}>{hoveredBar.day}: {hoveredBar.val}M VNĐ {hoveredBar.accent ? '📍' : ''}</span> : 'VNĐ (triệu) — hover để xem chi tiết'}
                </div>
              </div>
              <a className="card-link" onClick={() => navigate('/admin/orders')}>Xem đơn hàng →</a>
            </div>
            <div className="card-body">
              <div className="bar-chart">
                {BAR_DATA.map(b => (
                  <div
                    key={b.day}
                    className="bar"
                    style={{
                      height: b.h,
                      background: hoveredBar?.day === b.day
                        ? (b.accent ? '#e05530' : '#1a3a28')
                        : (b.accent ? 'var(--accent)' : '#2a6049'),
                      cursor: 'pointer',
                      transition: 'all .15s',
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
            <div className="card-header"><div className="card-title">Bảo mật hệ thống</div></div>
            <div className="card-body" style={{padding:'12px 16px'}}>
              {[
                {dot:'ok',  name:'TLS 1.3',        val:'Active ✓'},
                {dot:'ok',  name:'Kong Gateway',    val:'Healthy'},
                {dot:'ok',  name:'OPA Policy',      val:'7 rules'},
                {dot:'ok',  name:'Vault KEK',       val:'Rotated 4m ago'},
                {dot:'warn',name:'TOTP',            val:'1 expired'},
                {dot:'ok',  name:'Redis jti store', val:'0 replay'},
              ].map(i => (
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
              <div className="card-title">Security Audit Log</div>
              <a className="card-link" onClick={() => navigate('/admin/settings')}>Grafana →</a>
            </div>
            <div className="card-body" style={{padding:'12px 16px'}}>
              {[
                {time:'14:31',tag:'deny', text:'JWT alg=none bị chặn — IP 10.0.0.14'},
                {time:'14:28',tag:'allow',text:'admin@co.vn xem /users — OPA pass'},
                {time:'14:22',tag:'deny', text:'BOLA: user1 truy cập order của user2'},
                {time:'14:15',tag:'warn', text:'Rate limit 95% — IP 10.0.0.8'},
                {time:'14:09',tag:'allow',text:'Key rotation hoàn thành — Vault v12'},
                {time:'14:01',tag:'deny', text:'DPoP replay bị chặn — jti đã dùng'},
              ].map((l,i) => (
                <div key={i} className="log-item">
                  <div className="log-time">{l.time}</div>
                  <div className="log-text"><span className={`log-tag ${l.tag}`}>{l.tag.toUpperCase()}</span>{l.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
