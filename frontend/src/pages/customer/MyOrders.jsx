import React, { useState } from 'react'

const PAST_ORDERS = [
  { id:'ORD-1042', date:'28/03/2026 · 14:21', items:'💻 Laptop ASUS VivoBook 15 (x1)', amount:'15,490,000đ', status:'success',  pay:'Chuyển khoản' },
  { id:'ORD-1035', date:'26/03/2026 · 15:20', items:'☕ Cà phê Arabica Đà Lạt (x3)',  amount:'540,000đ',    status:'shipping', pay:'VietQR' },
  { id:'ORD-1028', date:'20/03/2026 · 10:05', items:'🖱️ Chuột Logitech MX3 (x1)',     amount:'1,890,000đ',  status:'success',  pay:'Ví điện tử' },
]

const SL = { success:'Hoàn thành', pending:'Đang xử lý', shipping:'Đang giao', new:'Mới đặt' }
const SC = { success:'badge-green', pending:'badge-amber', shipping:'badge-blue', new:'badge-purple' }

export default function MyOrders() {
  const [selected, setSelected] = useState(null)

  return (
    <div className="page-content">
      <div style={{ marginBottom:'20px' }}>
        <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'24px', marginBottom:'4px' }}>Đơn hàng của tôi</div>
        <div style={{ fontSize:'13px', color:'var(--muted)' }}>
          {PAST_ORDERS.length} đơn · Tài khoản: <strong>Nguyễn Văn An</strong>
        </div>
      </div>

      <div style={{ background:'#e8f5ee', border:'1px solid #c8e6d4', borderRadius:'10px', padding:'14px 18px', marginBottom:'20px', fontSize:'13px', color:'var(--green)', display:'flex', alignItems:'center', gap:'8px' }}>
        🔒 <span>Bạn chỉ có thể xem đơn hàng của chính mình. Truy cập đơn hàng người khác sẽ bị <strong>OPA từ chối và ghi log</strong>.</span>
      </div>

      {PAST_ORDERS.map(o => (
        <div key={o.id}
          style={{ background:'#fff', border:'1.5px solid var(--border)', borderRadius:'12px', padding:'18px 20px', marginBottom:'12px', cursor:'pointer', transition:'box-shadow .15s' }}
          onClick={() => setSelected(o)}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
            <div style={{ fontWeight:700, fontSize:'14px' }}>#{o.id}</div>
            <span className={`badge ${SC[o.status]}`}>{SL[o.status]}</span>
          </div>
          <div style={{ fontSize:'13px', marginBottom:'8px' }}>{o.items}</div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'var(--muted)' }}>
            <span>{o.date}</span>
            <span>{o.pay}</span>
            <span style={{ fontWeight:700, color:'var(--ink)' }}>{o.amount}</span>
          </div>
        </div>
      ))}

      {selected && (
        <>
          <div className="drawer-overlay open" onClick={() => setSelected(null)} />
          <div className="drawer open">
            <div className="drawer-header">
              <div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'20px' }}>#{selected.id}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'3px' }}>{selected.date}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="sec-item"><span className="sec-name">Sản phẩm</span><span className="sec-val">{selected.items}</span></div>
              <div className="sec-item"><span className="sec-name">Tổng tiền</span><span className="sec-val" style={{fontWeight:700}}>{selected.amount}</span></div>
              <div className="sec-item">
                <span className="sec-name">Trạng thái</span>
                <span className={`badge ${SC[selected.status]}`}>{SL[selected.status]}</span>
              </div>
              <div className="sec-item"><span className="sec-name">Thanh toán</span><span className="sec-val">{selected.pay}</span></div>
            </div>
            <div className="drawer-footer">
              <button className="btn btn-outline" style={{flex:1}} onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}