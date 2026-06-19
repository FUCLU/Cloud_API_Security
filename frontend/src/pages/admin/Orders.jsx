import React, { useMemo, useState } from 'react'

const ORDERS_KEY_PREFIX = 'customer_orders:'

const STATUS_LABEL = { new:'Mới', pending:'Đang xử lý', shipping:'Đang giao', success:'Hoàn thành', failed:'Thất bại' }
const STATUS_BADGE = { new:'badge-purple', pending:'badge-amber', shipping:'badge-blue', success:'badge-green', failed:'badge-red' }
const ROLE_BADGE = { admin:'badge-red', staff:'badge-blue', customer:'badge-gray' }

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

export default function AdminOrders() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const orders = useMemo(() => loadAllCustomerOrders(), [reloadKey])
  const filtered = orders.filter(order => {
    const customer = order.customer || {}
    const haystack = `${order.id} ${customer.name || ''} ${customer.email || ''} ${summarizeItems(order.items)}`.toLowerCase()
    return (filter === 'all' || order.status === filter) && haystack.includes(search.toLowerCase())
  })

  const counts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1
    return acc
  }, { all: orders.length })

  function refresh() {
    setReloadKey(value => value + 1)
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Quản lý đơn hàng</div>
          <div className="topbar-sub">Đơn phát sinh từ tài khoản customer</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-outline btn-sm" onClick={refresh}>Làm mới</button>
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

        <div className="filter-bar">
          <div className="search-box">
            <span>🔍</span>
            <input placeholder="Tìm mã đơn, tên khách, email..." value={search} onChange={event => setSearch(event.target.value)} />
          </div>
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
                  <th>Sản phẩm</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => {
                  const customer = order.customer || {}
                  return (
                    <tr key={`${order.storageKey}-${order.id}`}>
                      <td style={{ fontWeight:700 }}>#{order.id}</td>
                      <td>
                        <div style={{ fontWeight:500 }}>{customer.name || 'Khách hàng'}</div>
                        <div style={{ fontSize:'11px', color:'var(--muted)' }}>{customer.email || customer.id || 'unknown'}</div>
                      </td>
                      <td><span className={`badge ${ROLE_BADGE[customer.role || 'customer']}`}>{customer.role || 'customer'}</span></td>
                      <td style={{ fontSize:'12px', color:'var(--muted)' }}>{formatDate(order.date)}</td>
                      <td style={{ maxWidth:260 }}>{summarizeItems(order.items)}</td>
                      <td style={{ fontWeight:500 }}>{formatMoney(order.amount)}</td>
                      <td><span className={`badge ${STATUS_BADGE[order.status]}`}>{STATUS_LABEL[order.status]}</span></td>
                      <td>
                        <button className="btn btn-outline btn-xs" onClick={() => setSelected(order)}>Chi tiết</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span className="page-info">{filtered.length} đơn hàng</span>
          </div>
        </div>
      </div>

      {selected ? (
        <>
          <div className="drawer-overlay open" onClick={() => setSelected(null)} />
          <div className="drawer open">
            <div className="drawer-header">
              <div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'20px' }}>#{selected.id}</div>
                <div style={{ fontSize:'12px', color:'var(--muted)', marginTop:'3px' }}>{formatDate(selected.date)}</div>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="drawer-body">
              {[
                ['Khách hàng', selected.customer?.name || 'Khách hàng'],
                ['Email', selected.customer?.email || 'unknown'],
                ['User ID', selected.customer?.id || 'unknown'],
                ['Sản phẩm', summarizeItems(selected.items)],
                ['Tổng tiền', formatMoney(selected.amount)],
                ['Địa chỉ', selected.address],
                ['Thanh toán', selected.pay],
              ].map(([key, value]) => (
                <div key={key} className="sec-item">
                  <span className="sec-name">{key}</span>
                  <span className="sec-val" style={key === 'Tổng tiền' ? { fontWeight:700 } : undefined}>{value}</span>
                </div>
              ))}
              <div className="sec-item">
                <span className="sec-name">Trạng thái</span>
                <span className={`badge ${STATUS_BADGE[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
              </div>
            </div>
            <div className="drawer-footer">
              <button className="btn btn-outline" style={{ flex:1 }} onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
