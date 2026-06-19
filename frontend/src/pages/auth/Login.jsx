import React, { useState } from 'react'
import logo from '../../../src/logo.png'
import '../../styles/login.css'
import { useAuth } from '../../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login, loginWithGoogle, logout, resetAuth } = useAuth()

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
      setError(err?.message ?? 'Không thể chuyển hướng đăng nhập Keycloak')
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
      setError(err?.message ?? 'Không thể đăng nhập Google')
      setLoading(false)
    }
  }

  function resetDemoSession() {
    setLoading(true)
    setError(null)
    logout()
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
          <div className="auth-header">
            <div className="form-title">Đăng nhập</div>
            <div className="form-sub">Chào mừng trở lại E-Market.</div>
          </div>

          <div className="field">
            <label>EMAIL</label>
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

          <div className="divider"><span>hoặc</span></div>

          <button
            className="btn-google"
            onClick={doGoogleLogin}
            disabled={loading}
          >
            <span className="google-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.37c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.08 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.37 12 5.37z" />
              </svg>
            </span>
            <span>Đăng nhập với Google</span>
          </button>

          <button
            className="btn-switch-account"
            onClick={resetDemoSession}
            disabled={loading}
            title="Xóa phiên SSO hiện tại để đăng nhập lại từ đầu"
          >
            Reset phiên demo
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
