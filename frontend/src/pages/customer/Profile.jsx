import React, { useState } from 'react'
import { getDisplayEmail, getDisplayName, getInitials, getPrimaryRole } from '../../auth/userDisplay'
import { useAuth } from '../../hooks/useAuth'

export default function Profile() {
  const [saved, setSaved] = useState(false)
  const { user } = useAuth()
  const displayName = getDisplayName(user)
  const displayEmail = getDisplayEmail(user)

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
            <div className="section-title" style={{ marginBottom:'12px' }}>Bảo mật tài khoản</div>
            {[
              { dot:'ok',   name:'TOTP MFA',        val:'Đang bật',   color:'var(--green)' },
              { dot:'ok',   name:'Email xác thực',  val:'Đã xác thực',color:'var(--green)' },
              { dot:'ok',   name:'Session hiện tại',val:'1 thiết bị', color:'' },
              { dot:'warn', name:'WebAuthn',         val:'Chưa cài',   color:'' },
            ].map(i => (
              <div key={i.name} className="sec-item">
                <span className={`sec-dot ${i.dot}`}></span>
                <span className="sec-name">{i.name}</span>
                <span className="sec-val" style={{ color: i.color || undefined }}>{i.val}</span>
              </div>
            ))}
          </div>
          <div className="card card-body" style={{ padding:'16px' }}>
            <div className="section-title" style={{ marginBottom:'10px' }}>Đơn hàng</div>
            {[['Tổng đơn','3'],['Hoàn thành','3'],['Tổng chi tiêu','17,920,000đ']].map(([k,v]) => (
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
                <div className="field"><label>Số điện thoại</label><input defaultValue="0901 234 567" /></div>
                <div className="field"><label>Ngày sinh</label><input type="date" defaultValue="1995-06-15" /></div>
              </div>
              <div className="field"><label>Địa chỉ giao hàng</label><input defaultValue="123 Nguyễn Huệ, Phường Bến Nghé, Q.1, TP.HCM" /></div>
              <button className="btn btn-primary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }}>
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
