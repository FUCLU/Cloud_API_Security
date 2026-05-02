import React, { useState } from 'react'
import logo from '../../../src/logo.png'
import '../../styles/login.css'
import { useAuth } from '../../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login, loginWithGoogle, resetAuth } = useAuth()

  function fillDemo(demoEmail) {
    setEmail(demoEmail)
    setError(null)
  }

  async function doKeycloakLogin() {
    setLoading(true)
    setError(null)

    resetAuth()
    sessionStorage.removeItem('pkce_verifier')
    sessionStorage.removeItem('pkce_state')
    if (email) sessionStorage.setItem('expected_login_email', email.toLowerCase())
    else sessionStorage.removeItem('expected_login_email')

    try {
      await login({ loginHint: email || '', prompt: 'login' })
    } catch (err) {
      setError(err?.message ?? 'Khong the chuyen huong dang nhap Keycloak')
      setLoading(false)
    }
  }

  async function doGoogleLogin() {
    setLoading(true)
    setError(null)

    resetAuth()
    sessionStorage.removeItem('pkce_verifier')
    sessionStorage.removeItem('pkce_state')
    sessionStorage.removeItem('expected_login_email')

    try {
      await loginWithGoogle()
    } catch (err) {
      setError(err?.message ?? 'Khong the dang nhap Google')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="left">
        <div className="left-content">
          <div className="brand">
            <img className="brand-icon" src={logo} alt="logo" />
            <div>
              <div className="brand-name">E - MARKET</div>
            </div>
          </div>
          <div className="hero">
            <h1>Mua sắm thả ga<br /> giao hàng tận nhà</h1>
          </div>
        </div>
      </div>

      <div className="right">
        <div className="form-wrap">
          <div className="form-title">Đăng nhập</div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              placeholder="hung@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <div style={{
              padding: '8px 12px', marginBottom: 8,
              background: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: 7, fontSize: 13, color: '#b91c1c'
            }}>
              {error}
            </div>
          )}

          <button className="btn-main" onClick={doKeycloakLogin} disabled={loading}>
            {loading ? 'Đang chuyển hướng...' : 'Đăng nhập'}
          </button>

          <div style={{ textAlign: 'center', margin: '12px 0', color: 'var(--muted)', fontSize: 12 }}>
            hoặc
          </div>

          <button
            className="btn-google"
            onClick={doGoogleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '10px 0',
              border: '1px solid #dadce0', borderRadius: 8,
              background: '#fff', cursor: 'pointer',
              fontSize: 14, fontWeight: 500,
            }}
          >
            Đăng nhập với google
          </button>

          <div className="demo-box">
            <div className="demo-label">Tài khoản demo - Chọn để đăng nhập</div>
            <div className="demo-item" onClick={() => fillDemo('phuc@company.com')}>
              <span className="demo-role" style={{ background: '#fcecea', color: 'var(--accent)' }}>Admin</span>
              <span>phuc@company.com</span>
            </div>
            <div className="demo-item" onClick={() => fillDemo('kiet@company.com')}>
              <span className="demo-role" style={{ background: '#e6eef6', color: '#1e4e7a' }}>Staff</span>
              <span>kiet@company.com</span>
            </div>
            <div className="demo-item" onClick={() => fillDemo('an@gmail.com')}>
              <span className="demo-role" style={{ background: 'var(--cream)', color: 'var(--muted)' }}>Customer</span>
              <span>an@gmail.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
