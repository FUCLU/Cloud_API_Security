import React, { useEffect, useMemo, useState } from 'react'
import { getDisplayName } from '../../auth/userDisplay'
import { useAuth } from '../../hooks/useAuth'
import { getCustomerStorageKey } from '../../utils/customerStorage'

const ORDERS_KEY_PREFIX = 'customer_orders'

const STATUS_LABEL = {
  all: 'Tất cả',
  new: 'Chờ xác nhận',
  pending: 'Đang xử lý',
  shipping: 'Đang giao',
  success: 'Hoàn thành',
  failed: 'Đã hủy',
}

const STATUS_BADGE = {
  new: 'badge-purple',
  pending: 'badge-amber',
  shipping: 'badge-blue',
  success: 'badge-green',
  failed: 'badge-red',
}

function formatMoney(value) {
  return `${value.toLocaleString('vi-VN')}đ`
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

export default function MyOrders() {
  const { user } = useAuth()
  const ordersKey = useMemo(() => getCustomerStorageKey(ORDERS_KEY_PREFIX, user), [user])
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('all')
  const [orders, setOrders] = useState([])

  useEffect(() => {
    if (!ordersKey) return
    setOrders(loadJson(ordersKey, []))
  }, [ordersKey])

  const filteredOrders = status === 'all'
    ? orders
    : orders.filter(order => order.status === status)

  const counts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1
    return acc
  }, { all: orders.length })

  return (
    <div className="page-content">
      <div className="orders-head">
        <div>
          <div className="customer-page-title">Đơn của tôi</div>
          <div className="customer-page-sub">
            {orders.length} đơn · Tài khoản: <strong>{getDisplayName(user)}</strong>
          </div>
        </div>
      </div>

      <div className="order-tabs">
        {['all', 'new', 'pending', 'shipping', 'success', 'failed'].map(key => (
          <button
            key={key}
            className={status === key ? 'active' : ''}
            onClick={() => setStatus(key)}
          >
            {STATUS_LABEL[key]} <span>{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-text">Chưa có đơn hàng ở trạng thái này.</div>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map(order => {
            const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0)
            return (
              <div key={order.id} className="order-card" onClick={() => setSelected(order)}>
                <div className="order-card-top">
                  <div>
                    <div className="order-id">#{order.id}</div>
                    <div className="order-date">{formatDate(order.date)}</div>
                  </div>
                  <span className={`badge ${STATUS_BADGE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
                </div>

                <div className="order-items-preview">
                  {order.items.slice(0, 2).map(item => (
                    <div className="order-item-row" key={`${order.id}-${item.n}`}>
                      <span className="order-item-icon">{item.e}</span>
                      <span>{item.n}</span>
                      <span>x{item.qty}</span>
                    </div>
                  ))}
                  {order.items.length > 2 ? <div className="order-more">+{order.items.length - 2} sản phẩm khác</div> : null}
                </div>

                <div className="order-card-bottom">
                  <span>{itemCount} sản phẩm</span>
                  <span>{order.pay}</span>
                  <strong>{formatMoney(order.amount)}</strong>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected ? (
        <>
          <div className="drawer-overlay open" onClick={() => setSelected(null)} />
          <div className="drawer open">
            <div className="drawer-header">
              <div>
                <div className="drawer-title">#{selected.id}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>{formatDate(selected.date)}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="drawer-body">
              <div className="order-detail-block">
                <div className="section-title">Trạng thái đơn</div>
                <div className="order-timeline">
                  {selected.tracking.map(step => (
                    <div key={step.label} className={`order-step ${step.done ? 'done' : ''}`}>
                      <span />
                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="order-detail-block">
                <div className="section-title">Sản phẩm</div>
                {selected.items.map(item => (
                  <div className="cart-line" key={`${selected.id}-${item.n}`}>
                    <div className="cart-line-icon">{item.e}</div>
                    <div className="cart-line-main">
                      <div className="cart-line-name">{item.n}</div>
                      <div className="cart-line-meta">{formatMoney(item.p)} · x{item.qty}</div>
                    </div>
                    <strong>{formatMoney(item.p * item.qty)}</strong>
                  </div>
                ))}
              </div>

              <div className="order-detail-block">
                <div className="section-title">Thanh toán và giao hàng</div>
                <div className="sec-item"><span className="sec-name">Thanh toán</span><span className="sec-val">{selected.pay}</span></div>
                <div className="sec-item"><span className="sec-name">Địa chỉ</span><span className="sec-val">{selected.address}</span></div>
                <div className="sec-item"><span className="sec-name">Tổng tiền</span><span className="sec-val" style={{ fontWeight: 700 }}>{formatMoney(selected.amount)}</span></div>
              </div>
            </div>

            <div className="drawer-footer">
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
