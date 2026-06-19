import React, { useMemo, useState } from 'react'

const ORDERS_KEY_PREFIX = 'customer_orders:'

const SL = { new:'Mới', pending:'Đang xử lý', shipping:'Đang giao', success:'Hoàn thành', failed:'Thất bại' }
const SC = { new:'badge-purple', pending:'badge-amber', shipping:'badge-blue', success:'badge-green', failed:'badge-red' }
const NEXT = { new:'pending', pending:'shipping', shipping:'success' }
const NEXT_LABEL = { new:'Xác nhận', pending:'Giao hàng', shipping:'Hoàn thành' }

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day:'2-digit',
      month:'2-digit',
      year:'numeric',
      hour:'2-digit',
      minute:'2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function summarizeItems(items = []) {
  return items.map(item => `${item.n} (x${item.qty})`).join(', ')
}

function loadAllCustomerOrders() {
  const orders = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key?.startsWith(ORDERS_KEY_PREFIX)) continue

    try {
      const storedOrders = JSON.parse(localStorage.getItem(key)) ?? []
      storedOrders.forEach(order => orders.push({ ...order, storageKey: key }))
    } catch {
      // Ignore malformed local demo data.
    }
  }

  return orders.sort((a, b) => new Date(b.date) - new Date(a.date))
}

function updateStoredOrderStatus(order, nextStatus) {
  const storedOrders = JSON.parse(localStorage.getItem(order.storageKey)) ?? []
  const nextOrders = storedOrders.map(storedOrder => {
    if (storedOrder.id !== order.id) return storedOrder

    const nextTracking = (storedOrder.tracking || []).map(step => {
      if (nextStatus === 'pending' && step.label === 'Đang xác nhận') return { ...step, done: true, time: 'Vừa xác nhận' }
      if (nextStatus === 'shipping' && step.label === 'Đóng gói') return { ...step, done: true, time: 'Đã bàn giao vận chuyển' }
      if (nextStatus === 'success' && step.label === 'Giao hàng') return { ...step, done: true, time: 'Đã giao thành công' }
      return step
    })

    return { ...storedOrder, status: nextStatus, tracking: nextTracking }
  })

  localStorage.setItem(order.storageKey, JSON.stringify(nextOrders))
}

export default function StaffOrders() {
  const [filter, setFilter] = useState('all')
  const [toast, setToast] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const orders = useMemo(() => loadAllCustomerOrders(), [reloadKey])
  const filtered = orders.filter(order => filter === 'all' || order.status === filter)

  function updateStatus(order) {
    const next = NEXT[order.status]
    if (!next) return

    updateStoredOrderStatus(order, next)
    setReloadKey(value => value + 1)
    setToast(`#${order.id} -> ${SL[next]}`)
    setTimeout(() => setToast(''), 2500)
  }

  const counts = { all: orders.length }
  orders.forEach(order => { counts[order.status] = (counts[order.status] || 0) + 1 })

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Xử lý đơn hàng</div>
          <div className="topbar-sub">Đơn phát sinh từ tài khoản customer</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-outline btn-sm" onClick={() => setReloadKey(value => value + 1)}>Làm mới</button>
        </div>
      </div>

      <div className="content">
        <div className="status-tabs">
          {[
            ['all','Tổng'],
            ['new','Mới'],
            ['pending','Đang xử lý'],
            ['shipping','Đang giao'],
            ['success','Hoàn thành'],
            ['failed','Thất bại'],
          ].map(([key, label]) => (
            <div key={key} className={'stab' + (filter === key ? ' active' : '')} onClick={() => setFilter(key)}>
              {label} <span className="cnt">{counts[key] || 0}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Ngày đặt</th>
                  <th>Sản phẩm</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <tr key={`${order.storageKey}-${order.id}`}>
                    <td style={{ fontWeight:700 }}>#{order.id}</td>
                    <td>
                      <div>{order.customer?.name || 'Khách hàng'}</div>
                      <div style={{ fontSize:'11px', color:'var(--muted)' }}>{order.customer?.email || ''}</div>
                    </td>
                    <td>{formatDate(order.date)}</td>
                    <td>{summarizeItems(order.items)}</td>
                    <td>{formatMoney(order.amount)}</td>
                    <td><span className={`badge ${SC[order.status]}`}>{SL[order.status]}</span></td>
                    <td>
                      {NEXT[order.status] ? (
                        <button className={`btn btn-sm ${order.status === 'new' ? 'btn-green' : 'btn-outline'}`} onClick={() => updateStatus(order)}>
                          {NEXT_LABEL[order.status]}
                        </button>
                      ) : (
                        <span style={{ fontSize:'12px', color:'var(--muted)' }}>Không còn thao tác</span>
                      )}
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

      {toast ? (
        <div style={{
          position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
          background:'var(--green)', color:'#fff', padding:'10px 20px', borderRadius:'8px',
          fontSize:'13px', zIndex:999, boxShadow:'0 4px 16px rgba(0,0,0,.2)'
        }}>{toast}</div>
      ) : null}
    </>
  )
}
