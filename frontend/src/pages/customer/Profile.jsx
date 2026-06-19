import React, { useEffect, useMemo, useState } from 'react'
import { getDisplayEmail, getDisplayName, getInitials, getPrimaryRole } from '../../auth/userDisplay'
import { useAuth } from '../../hooks/useAuth'
import { getCustomerStorageKey } from '../../utils/customerStorage'

const PROFILE_KEY_PREFIX = 'customer_profile'
const ORDERS_KEY_PREFIX = 'customer_orders'

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function formatMoney(value) {
  return `${value.toLocaleString('vi-VN')}đ`
}

export default function Profile() {
  const [saved, setSaved] = useState(false)
  const { user } = useAuth()
  const displayName = getDisplayName(user)
  const displayEmail = getDisplayEmail(user)
  const profileKey = useMemo(() => getCustomerStorageKey(PROFILE_KEY_PREFIX, user), [user])
  const ordersKey = useMemo(() => getCustomerStorageKey(ORDERS_KEY_PREFIX, user), [user])
  const orders = useMemo(() => ordersKey ? loadJson(ordersKey, []) : [], [ordersKey])
  const [profile, setProfile] = useState(() => loadJson(profileKey, {
    phone: '',
    dob: '',
    address: '',
  }))

  useEffect(() => {
    if (!profileKey) return
    setProfile(loadJson(profileKey, { phone: '', dob: '', address: '' }))
  }, [profileKey])

  function saveProfile() {
    if (!profileKey) return
    localStorage.setItem(profileKey, JSON.stringify(profile))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const completedOrders = orders.filter(order => order.status === 'success').length
  const totalSpent = orders
    .filter(order => order.status !== 'failed')
    .reduce((sum, order) => sum + (order.amount || 0), 0)

  return (
    <div className="page-content">
      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'24px', marginBottom:'20px' }}>Tài khoản của tôi</div>
      <div className="profile-grid">
        <div className="profile-sidebar">
          <div className="profile-avatar-card">
            <div className="big-avatar">{getInitials(user)}</div>
            <div className="profile-name">{displayName}</div>
            <div className="profile-email">{displayEmail}</div>
            <span className="badge badge-gray profile-role">{getPrimaryRole(user)}</span>
            <div style={{ marginTop:'14px', fontSize:'11.5px', color:'var(--muted)' }}>Tham gia 15/01/2026</div>
          </div>
          <div className="card card-body" style={{ padding:'16px' }}>
            <div className="section-title" style={{ marginBottom:'10px' }}>Đơn hàng</div>
            {[['Tổng đơn', String(orders.length)], ['Hoàn thành', String(completedOrders)], ['Tổng chi tiêu', formatMoney(totalSpent)]].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'6px' }}>
                <span>{k}</span><strong style={{ color: k==='Hoàn thành' ? 'var(--green)' : undefined }}>{v}</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Thông tin cá nhân</div></div>
            <div className="card-body">
              <div className="field-row">
                <div className="field"><label>Họ tên</label><input value={displayName} readOnly /></div>
                <div className="field"><label>Email</label><input value={displayEmail} readOnly style={{ background:'var(--cream)', color:'var(--muted)' }} /></div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Số điện thoại</label>
                  <input value={profile.phone} onChange={event => setProfile(data => ({ ...data, phone: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Ngày sinh</label>
                  <input type="date" value={profile.dob} onChange={event => setProfile(data => ({ ...data, dob: event.target.value }))} />
                </div>
              </div>
              <div className="field">
                <label>Địa chỉ giao hàng</label>
                <input value={profile.address} onChange={event => setProfile(data => ({ ...data, address: event.target.value }))} />
              </div>
              <button className="btn btn-primary" onClick={saveProfile}>
                {saved ? '✅ Đã lưu!' : '💾 Lưu thông tin'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Đổi mật khẩu</div></div>
            <div className="card-body">
              <div className="field"><label>Mật khẩu hiện tại</label><input type="password" placeholder="••••••••" /></div>
              <div className="field-row">
                <div className="field"><label>Mật khẩu mới</label><input type="password" placeholder="••••••••" /></div>
                <div className="field"><label>Xác nhận</label><input type="password" placeholder="••••••••" /></div>
              </div>
              <button className="btn btn-primary">🔑 Đổi mật khẩu</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
