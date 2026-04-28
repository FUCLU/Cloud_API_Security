import React, { useState } from 'react'
import '../../styles/login.css'
import logo from '../../../src/logo.png'
import { login as kcLogin } from '../../auth/keycloak'

const ACCOUNTS = {
  'phuc@company.com': { role: 'admin',    mfa: true,  name: 'Lưu Hồng Phúc' },
  'hung@company.com': { role: 'admin',    mfa: true,  name: 'Phan Thái Hưng' },
  'kiet@company.com': { role: 'staff',    mfa: true,  name: 'Võ Tưởng Tuấn Kiệt' },
  'an@gmail.com':     { role: 'customer', mfa: false, name: 'Nguyễn Văn An' },
  'bich@gmail.com':   { role: 'customer', mfa: false, name: 'Trần Thị Bích' },
}

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('demo1234')
  const [loading,  setLoading]  = useState(false)

  function fillDemo(demoEmail) {
    setEmail(demoEmail)
    setPassword('demo1234')
  }


  function doLogin() {
    if (!email || !password) return
    setLoading(true)
    // Keycloak sẽ tự handle: login form → TOTP (nếu admin) → redirect /callback
    kcLogin()
    // setLoading sẽ không cần reset vì browser redirect luôn
  }

  return (
    <div className="login-page">
      {/* LEFT — giữ nguyên */}
      <div className="left">
        <div className="left-content">
          <div className="brand">
            <img className="brand-icon" src={logo} alt="logo" />
            <div>
              <div className="brand-name">E - MARKET</div>
            </div>
          </div>
          <div className="hero">
            <h1>Mua sắm thả ga,<br /> giao hàng tận nhà</h1>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="right">
        <div className="form-wrap">
          <div className="form-title">Đăng nhập</div>
          <div className="form-sub">Nhập thông tin tài khoản của bạn.</div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              placeholder="hung@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <div className="field-hint">Email công ty hoặc cá nhân đã đăng ký</div>
          </div>

          <div className="field">
            <label>Mật khẩu</label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doLogin()}
            />
          </div>

          <div className="forgot"><a href="#">Quên mật khẩu?</a></div>

          <button className="btn-main" onClick={doLogin} disabled={loading}>
            {loading
              ? <span style={{ display: 'flex' }}><div className="spinner"></div></span>
              : <span>Đăng nhập</span>
            }
          </button>

          {/* Thông báo Keycloak */}
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#f0f4ff',
            border: '1px solid #c5d3f5',
            borderRadius: 7,
            fontSize: 12,
            color: '#3a5bb5',
            lineHeight: 1.6
          }}>
            🔐 Bạn sẽ được chuyển đến trang đăng nhập bảo mật.<br />
            Admin sẽ yêu cầu nhập mã <strong>TOTP</strong> sau khi xác thực.
          </div>

          {/* Demo accounts — giữ nguyên */}
          <div className="demo-box">
            <div className="demo-label">Tài khoản demo — chọn để điền tự động</div>
            <div className="demo-item" onClick={() => fillDemo('phuc@company.com')}>
              <span className="demo-role" style={{ background: '#fcecea', color: 'var(--accent)' }}>Admin</span>
              <span>phuc@company.com</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--muted)', background: 'var(--cream)', padding: '2px 6px', borderRadius: '4px' }}>MFA</span>
            </div>
            <div className="demo-item" onClick={() => fillDemo('kiet@company.com')}>
              <span className="demo-role" style={{ background: '#e6eef6', color: '#1e4e7a' }}>Staff</span>
              <span>kiet@company.com</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--muted)', background: 'var(--cream)', padding: '2px 6px', borderRadius: '4px' }}>MFA</span>
            </div>
            <div className="demo-item" onClick={() => fillDemo('an@gmail.com')}>
              <span className="demo-role" style={{ background: 'var(--cream)', color: 'var(--muted)' }}>Customer</span>
              <span>an@gmail.com</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--muted)', background: 'var(--cream)', padding: '2px 6px', borderRadius: '4px' }}>Tuỳ chọn</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}