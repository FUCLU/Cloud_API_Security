import React, { useState } from 'react'

const ORDERS = [
  { id:'ORD-1042', name:'Nguyễn Văn An',     userId:'uid-004', role:'customer', email:'an.nv@gmail.com',    date:'28/03 · 14:21', items:'Laptop ASUS (x1)',    amount:'15,490,000đ', status:'success',  addr:'123 Nguyễn Huệ, Q1',      secFlag: null },
  { id:'ORD-1041', name:'Trần Thị Bích',      userId:'uid-005', role:'customer', email:'bich.tt@gmail.com',  date:'28/03 · 13:10', items:'Chuột Logitech (x2)', amount:'3,780,000đ',  status:'pending',  addr:'45 Lê Lợi, Q3',            secFlag: null },
  { id:'ORD-1040', name:'Lê Văn Cường',       userId:'uid-006', role:'customer', email:'cuong.lv@gmail.com', date:'28/03 · 11:44', items:'Tai nghe Sony (x1)',  amount:'7,990,000đ',  status:'shipping', addr:'88 Hai Bà Trưng, Q1',       secFlag: 'bola' },
  { id:'ORD-1039', name:'Phạm Thị Dung',      userId:'uid-007', role:'customer', email:'dung.pt@gmail.com',  date:'27/03 · 16:00', items:'Áo polo (x3)',        amount:'1,470,000đ',  status:'failed',   addr:'12 Đinh Tiên Hoàng, Q1',   secFlag: null },
  { id:'ORD-1038', name:'Hoàng Thị Emm',      userId:'uid-008', role:'customer', email:'emm.ht@gmail.com',   date:'27/03 · 14:30', items:'Bàn phím (x1)',       amount:'2,450,000đ',  status:'shipping', addr:'77 Pasteur, Q3',            secFlag: null },
  { id:'ORD-1037', name:'Võ Tuấn Kiệt',       userId:'uid-003', role:'staff',    email:'kiet.vt@gmail.com',  date:'27/03 · 09:12', items:'Màn hình LG (x1)',    amount:'6,800,000đ',  status:'new',      addr:'99 Nam Kỳ Khởi Nghĩa',     secFlag: null },
  { id:'ORD-1036', name:'Phan Thái Hưng',     userId:'uid-002', role:'admin',    email:'hung.pt@gmail.com',  date:'26/03 · 17:55', items:'Sổ tay A5 (x5)',      amount:'325,000đ',    status:'success',  addr:'10 Tôn Thất Tùng',         secFlag: null },
  { id:'ORD-1035', name:'Nguyễn T. Giang',    userId:'uid-009', role:'customer', email:'giang.nt@gmail.com', date:'26/03 · 15:20', items:'Cà phê (x3)',         amount:'540,000đ',    status:'pending',  addr:'55 Cách Mạng Tháng 8',     secFlag: 'rate' },
]

const STATUS_LABEL = { new:'Mới', pending:'Đang xử lý', shipping:'Đang giao', success:'Hoàn thành', failed:'Thất bại' }
const STATUS_BADGE = { new:'badge-purple', pending:'badge-amber', shipping:'badge-blue', success:'badge-green', failed:'badge-red' }
const ROLE_BADGE = { admin:'badge-red', staff:'badge-blue', customer:'badge-gray' }

const SEC_FLAG_INFO = {
  bola: { badge:'badge-red', label:'BOLA attempt', detail:'User uid-004 đã cố truy cập đơn hàng này — OPA đã chặn (owner mismatch).' },
  rate: { badge:'badge-amber', label:'Rate limit hit', detail:'IP của user này đã hit rate limit 95% trong session hiện tại.' },
}

export default function AdminOrders() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const filtered = ORDERS.filter(o =>
    (filter === 'all' || o.status === filter) &&
    (o.name.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search))
  )

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Quản lý đơn hàng</div>
          <div className="topbar-sub">Admin — xem tất cả đơn · BOLA monitoring active</div>
        </div>
        <div className="topbar-right">
          {ORDERS.filter(o => o.secFlag).length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--accent)', background:'#fcecea', padding:'5px 10px', borderRadius:'6px', border:'1px solid #f5c8c2' }}>
              <span>⚠️</span>
              {ORDERS.filter(o => o.secFlag).length} security flag
            </div>
          )}
          <button className="btn btn-outline btn-sm">📤 Xuất Excel</button>
          <button className="btn btn-primary btn-sm">+ Tạo đơn</button>
        </div>
      </div>

      <div className="content">
        <div className="status-tabs">
          {[['all','Tất cả',8],['new','Mới',1],['pending','Đang xử lý',2],['shipping','Đang giao',2],['success','Hoàn thành',2],['failed','Thất bại',1]].map(([k,l,c]) => (
            <div key={k} className={'stab'+(filter===k?' active':'')} onClick={() => setFilter(k)}>
              {l} <span className="cnt">{c}</span>
            </div>
          ))}
        </div>

        <div className="filter-bar">
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Tìm mã đơn, tên khách..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select><option>7 ngày qua</option><option>30 ngày qua</option><option>Tháng này</option></select>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Role</th>
                  <th>Ngày đặt</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th>Security</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} style={{ background: o.secFlag ? '#fffaf5' : undefined }}>
                    <td style={{fontWeight:700}}>#{o.id}</td>
                    <td>
                      <div style={{fontWeight:500}}>{o.name}</div>
                      <div style={{fontSize:'11px',color:'var(--muted)',fontFamily:'monospace'}}>{o.userId}</div>
                    </td>
                    <td><span className={`badge ${ROLE_BADGE[o.role]}`}>{o.role}</span></td>
                    <td style={{fontSize:'12px',color:'var(--muted)'}}>{o.date}</td>
                    <td style={{fontWeight:500}}>{o.amount}</td>
                    <td><span className={`badge ${STATUS_BADGE[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                    <td>
                      {o.secFlag
                        ? <span className={`badge ${SEC_FLAG_INFO[o.secFlag].badge}`}>{SEC_FLAG_INFO[o.secFlag].label}</span>
                        : <span style={{fontSize:'11px',color:'var(--muted)'}}>—</span>
                      }
                    </td>
                    <td>
                      <button className="btn btn-outline btn-xs" onClick={() => setSelected(o)}>Chi tiết</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span className="page-info">{filtered.length} đơn hàng</span>
          </div>
        </div>
      </div>

      {selected && (
        <>
          <div className="drawer-overlay open" onClick={() => setSelected(null)} />
          <div className="drawer open">
            <div className="drawer-header">
              <div>
                <div style={{fontFamily:"'DM Serif Display',serif",fontSize:'20px'}}>#{selected.id}</div>
                <div style={{fontSize:'12px',color:'var(--muted)',marginTop:'3px'}}>{selected.date}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              {[
                ['Khách hàng', selected.name],
                ['User ID',    selected.userId],
                ['Role',       selected.role],
                ['Email',      selected.email],
                ['Sản phẩm',  selected.items],
                ['Tổng tiền',  selected.amount],
                ['Địa chỉ',   selected.addr],
              ].map(([k,v]) => (
                <div key={k} className="sec-item">
                  <span className="sec-name">{k}</span>
                  <span className="sec-val" style={k==='Tổng tiền'?{fontWeight:700}:k==='User ID'?{fontFamily:'monospace',fontSize:'12px'}:{}}>{v}</span>
                </div>
              ))}
              <div className="sec-item">
                <span className="sec-name">Trạng thái</span>
                <span className={`badge ${STATUS_BADGE[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
              </div>
              {selected.secFlag && (
                <div style={{ marginTop:'14px', background:'#fff8e8', border:'1px solid #f5d98a', borderRadius:'8px', padding:'10px 12px' }}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:'var(--amber)', textTransform:'uppercase', marginBottom:'4px' }}>
                    ⚠️ Security Flag: {SEC_FLAG_INFO[selected.secFlag].label}
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--ink)', lineHeight:'1.5' }}>
                    {SEC_FLAG_INFO[selected.secFlag].detail}
                  </div>
                </div>
              )}
            </div>
            <div className="drawer-footer">
              <button className="btn btn-primary" style={{flex:1}}>Cập nhật trạng thái</button>
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
