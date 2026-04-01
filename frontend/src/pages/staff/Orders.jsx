import React, { useState } from 'react'

const INIT_ORDERS = [
  { id:'ORD-1042', name:'Nguyễn Văn An',  date:'28/03 · 14:21', items:'Laptop ASUS (x1)',    amount:'15,490,000đ', status:'success' },
  { id:'ORD-1041', name:'Trần Thị Bích',  date:'28/03 · 13:10', items:'Chuột Logitech (x2)', amount:'3,780,000đ',  status:'pending' },
  { id:'ORD-1040', name:'Lê Văn Cường',   date:'28/03 · 11:44', items:'Tai nghe Sony (x1)',  amount:'7,990,000đ',  status:'shipping' },
  { id:'ORD-1039', name:'Phạm Thị Dung',  date:'27/03 · 16:00', items:'Áo polo (x3)',        amount:'1,470,000đ',  status:'failed' },
  { id:'ORD-1038', name:'Hoàng Thị Emm',  date:'27/03 · 14:30', items:'Bàn phím (x1)',       amount:'2,450,000đ',  status:'shipping' },
  { id:'ORD-1037', name:'Võ Tưởng Tuấn Kiệt',  date:'27/03 · 09:12', items:'Màn hình LG (x1)',    amount:'6,800,000đ',  status:'new' },
]

const SL = { new:'Mới', pending:'Đang xử lý', shipping:'Đang giao', success:'Hoàn thành', failed:'Thất bại' }
const SC = { new:'badge-purple', pending:'badge-amber', shipping:'badge-blue', success:'badge-green', failed:'badge-red' }

// Luồng chuyển trạng thái
const NEXT = { new:'pending', pending:'shipping', shipping:'success' }
const NEXT_LABEL = { new:'Xác nhận', pending:'Giao hàng', shipping:'Hoàn thành' }

export default function StaffOrders() {
  const [orders, setOrders] = useState(INIT_ORDERS)
  const [filter, setFilter] = useState('all')
  const [toast, setToast] = useState('')

  const filtered = orders.filter(o => filter === 'all' || o.status === filter)

  function updateStatus(id) {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o
      const next = NEXT[o.status]
      if (!next) return o
      setToast(`#${id} → ${SL[next]} ✓`)
      setTimeout(() => setToast(''), 2500)
      return { ...o, status: next }
    }))
  }

  const counts = { all: orders.length }
  orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1 })

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Xử lý đơn hàng</div>
          <div className="topbar-sub">Staff — cập nhật trạng thái đơn hàng</div>
        </div>
        <div className="topbar-right">
          <div style={{ padding:'7px 14px', background:'#fff4e8', border:'1px solid #f5c8a0', borderRadius:'8px', fontSize:'12px', color:'var(--amber)' }}>
            ⚠️ Staff không thể xoá đơn
          </div>
        </div>
      </div>

      <div className="content">
        <div className="status-tabs">
          {[['all','Tất cả'],['new','Mới'],['pending','Đang xử lý'],['shipping','Đang giao'],['success','Hoàn thành'],['failed','Thất bại']].map(([k,l]) => (
            <div key={k} className={'stab'+(filter===k?' active':'')} onClick={() => setFilter(k)}>
              {l} <span className="cnt">{counts[k] || 0}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày đặt</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Trạng thái</th><th>Hành động</th></tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id}>
                    <td style={{fontWeight:700}}>#{o.id}</td>
                    <td>{o.name}</td><td>{o.date}</td><td>{o.items}</td><td>{o.amount}</td>
                    <td><span className={`badge ${SC[o.status]}`}>{SL[o.status]}</span></td>
                    <td>
                      {NEXT[o.status] && (
                        <button className={`btn btn-sm ${o.status==='new'?'btn-green':'btn-outline'}`} onClick={() => updateStatus(o.id)}>
                          {NEXT_LABEL[o.status]}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop:'14px', padding:'14px 18px', background:'#e8f5ee', border:'1px solid #c8e6d4', borderRadius:'10px', fontSize:'13px', color:'var(--green)' }}>
          ✅ Mỗi thay đổi trạng thái đều được <strong>ghi audit log</strong> tự động bởi OPA.
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
          background:'var(--green)', color:'#fff', padding:'10px 20px', borderRadius:'8px',
          fontSize:'13px', zIndex:999, boxShadow:'0 4px 16px rgba(0,0,0,.2)'
        }}>✅ {toast}</div>
      )}
    </>
  )
}
