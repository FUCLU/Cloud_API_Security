import React, { useState } from 'react'
import { useCart } from '../../context/CartContext'

const PAST_ORDERS = [
  { id:'ORD-1042', date:'28/03/2026 · 14:21', items:'💻 Laptop ASUS VivoBook 15 (x1)', amount:'15,490,000đ', status:'success',  pay:'Chuyển khoản' },
  { id:'ORD-1035', date:'26/03/2026 · 15:20', items:'☕ Cà phê Arabica Đà Lạt (x3)',  amount:'540,000đ',    status:'shipping', pay:'VietQR' },
  { id:'ORD-1028', date:'20/03/2026 · 10:05', items:'🖱️ Chuột Logitech MX3 (x1)',     amount:'1,890,000đ',  status:'success',  pay:'Ví điện tử' },
]

const SL = { success:'Hoàn thành', pending:'Đang xử lý', shipping:'Đang giao', new:'Mới đặt' }
const SC = { success:'badge-green', pending:'badge-amber', shipping:'badge-blue', new:'badge-purple' }
const PAY_METHODS = [
  { id:'bank',   label:'Chuyển khoản', icon:'🏦' },
  { id:'vietqr', label:'VietQR',       icon:'📱' },
  { id:'ewallet',label:'Ví điện tử',   icon:'💳' },
  { id:'credit', label:'Thẻ tín dụng', icon:'💳' },
  { id:'cash',   label:'Tiền mặt',     icon:'💵' },
]

export default function MyOrders() {
  const { cart, removeItem } = useCart()
  const [selected, setSelected] = useState(null)
  const [payMethod, setPayMethod] = useState('vietqr')
  const [orders, setOrders] = useState(PAST_ORDERS)
  const [toast, setToast] = useState('')

  // Cart items as "chưa đặt"
  const cartOrders = cart.map((item, idx) => ({
    id: `CART-${idx+1}`,
    date: 'Chưa đặt',
    items: `${item.e || '📦'} ${item.n} (x${item.qty})`,
    amount: item.p,
    status: 'new',
    pay: '',
    fromCart: true,
    cartName: item.n,
  }))

  const allOrders = [...cartOrders, ...orders]

  function placeOrder(item) {
    const newOrder = {
      id: `ORD-${1050 + orders.length}`,
      date: new Date().toLocaleDateString('vi-VN') + ' · ' + new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'}),
      items: item.items,
      amount: item.amount,
      status: 'pending',
      pay: PAY_METHODS.find(m => m.id === payMethod)?.label || payMethod,
    }
    setOrders(prev => [newOrder, ...prev])
    removeItem(item.cartName)
    setToast(`Đặt hàng thành công! Mã: ${newOrder.id}`)
    setTimeout(() => setToast(''), 3000)
    setSelected(null)
  }

  function deleteCartItem(cartName) {
    removeItem(cartName)
    setSelected(null)
    setToast('Đã xoá khỏi giỏ hàng')
    setTimeout(() => setToast(''), 2000)
  }

  return (
    <div className="page-content">
      <div style={{ marginBottom:'20px' }}>
        <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'24px', marginBottom:'4px' }}>Đơn hàng của tôi</div>
        <div style={{ fontSize:'13px', color:'var(--muted)' }}>
          {allOrders.length} đơn · Tài khoản: <strong>Nguyễn Văn An</strong>
        </div>
      </div>

      <div style={{ background:'#e8f5ee', border:'1px solid #c8e6d4', borderRadius:'10px', padding:'14px 18px', marginBottom:'20px', fontSize:'13px', color:'var(--green)', display:'flex', alignItems:'center', gap:'8px' }}>
        🔒 <span>Bạn chỉ có thể xem đơn hàng của chính mình. Truy cập đơn hàng người khác sẽ bị <strong>OPA từ chối và ghi log</strong>.</span>
      </div>

      {allOrders.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--muted)' }}>
          <div style={{ fontSize:'48px', marginBottom:'12px' }}>🛒</div>
          <div style={{ fontSize:'14px' }}>Chưa có đơn hàng nào</div>
        </div>
      )}

      {allOrders.map(o => (
        <div key={o.id}
          style={{ background:'#fff', border:`1.5px solid ${o.fromCart ? 'var(--amber)' : 'var(--border)'}`, borderRadius:'12px', padding:'18px 20px', marginBottom:'12px', cursor:'pointer', transition:'box-shadow .15s' }}
          onClick={() => setSelected(o)}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
            <div style={{ fontWeight:700, fontSize:'14px' }}>
              #{o.id}
              {o.fromCart && <span style={{ marginLeft:'8px', fontSize:'10px', background:'#fff4e8', color:'var(--amber)', padding:'2px 7px', borderRadius:'4px', fontWeight:600 }}>Trong giỏ</span>}
            </div>
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

      {/* Drawer chi tiết */}
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
              {selected.pay && !selected.fromCart && (
                <div className="sec-item"><span className="sec-name">Thanh toán</span><span className="sec-val">{selected.pay}</span></div>
              )}

              {/* Chọn phương thức thanh toán — CHỈ hiện cho đơn trong giỏ */}
              {selected.fromCart && (
                <div style={{ marginTop:'16px' }}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'10px' }}>
                    Chọn phương thức thanh toán
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {PAY_METHODS.map(m => (
                      <div key={m.id}
                        onClick={() => setPayMethod(m.id)}
                        style={{
                          padding:'10px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px',
                          border: payMethod===m.id ? '2px solid var(--ink)' : '1.5px solid var(--border)',
                          background: payMethod===m.id ? 'var(--cream)' : '#fff',
                          fontWeight: payMethod===m.id ? 600 : 400,
                          display:'flex', alignItems:'center', gap:'8px',
                          transition:'all .15s',
                        }}>
                        <span>{m.icon}</span>
                        {m.label}
                        {payMethod===m.id && <span style={{ marginLeft:'auto', color:'var(--green)', fontWeight:700 }}>✓</span>}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:'12px', padding:'10px 13px', background:'#f0faf4', border:'1px solid #c8e6d4', borderRadius:'8px', fontSize:'11.5px', color:'var(--green)' }}>
                    🔒 Giao dịch được mã hoá AES-256-GCM · TLS 1.3
                  </div>
                </div>
              )}
            </div>

            <div className="drawer-footer">
              {selected.fromCart ? (
                /* Đơn trong giỏ: nút Đặt hàng + Xoá */
                <>
                  <button className="btn btn-primary" style={{flex:1}} onClick={() => placeOrder(selected)}>
                    ✅ Đặt hàng ngay
                  </button>
                  <button className="btn btn-danger" onClick={() => deleteCartItem(selected.cartName)}>
                    🗑 Xoá
                  </button>
                </>
              ) : (
                /* Đơn cũ: chỉ có nút Đóng */
                <button className="btn btn-outline" style={{flex:1}} onClick={() => setSelected(null)}>
                  Đóng
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
          background:'var(--ink)', color:'#fff', padding:'10px 20px', borderRadius:'8px',
          fontSize:'13px', zIndex:999, boxShadow:'0 4px 16px rgba(0,0,0,.2)'
        }}>{toast}</div>
      )}
    </div>
  )
}
