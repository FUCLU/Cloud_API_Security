import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/login.css'
import logo from '../../../src/logo.png'

const ACCOUNTS = {
  'phuc@company.com': { role: 'admin',    mfa: true,  name: 'Lưu Hồng Phúc' },
  'hung@company.com': { role: 'admin',    mfa: true,  name: 'Phan Thái Hưng' },
  'kiet@company.com': { role: 'staff',    mfa: true,  name: 'Võ Tưởng Tuấn Kiệt' },
  'an@gmail.com':     { role: 'customer', mfa: false, name: 'Nguyễn Văn An' },
  'bich@gmail.com':   { role: 'customer', mfa: false, name: 'Trần Thị Bích' },
}

const ROLE_UI = {
  admin:    { label: '🔴 Administrator', bg: '#c84b2f', color: '#fff' },
  staff:    { label: '🔵 Staff',         bg: '#1e4e7a', color: '#fff' },
  customer: { label: '⚪ Customer',       bg: '#ede8dc', color: '#0f0e0d' },
}

export default function Login() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('demo1234')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(30)
  const [showRedirect, setShowRedirect] = useState(false)
  const otpRefs = useRef([])
  const timerRef = useRef(null)

  // OTP countdown timer
  useEffect(() => {
    if (step === 2 && user?.mfa) {
      startTimer()
    }
    return () => clearInterval(timerRef.current)
  }, [step, user])

  function startTimer() {
    clearInterval(timerRef.current)
    setCountdown(30)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setOtp(['', '', '', '', '', ''])
          return 30
        }
        return prev - 1
      })
    }, 1000)
  }

  function fillDemo(demoEmail) {
    setEmail(demoEmail)
    setPassword('demo1234')
  }

  function doLogin() {
    if (!email || !password) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      const found = ACCOUNTS[email.trim().toLowerCase()] || {
        role: 'customer', mfa: false,
        name: email.split('@')[0]
      }
      setUser(found)
      setStep(2)
    }, 800)
  }

  function backStep1() {
    clearInterval(timerRef.current)
    setStep(1)
    setOtp(['', '', '', '', '', ''])
    setShowRedirect(false)
  }

  function handleOtpChange(val, idx) {
    if (!/^\d?$/.test(val)) return
    const newOtp = [...otp]
    newOtp[idx] = val
    setOtp(newOtp)
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus()
    if (idx === 5 && val) setTimeout(doMFA, 180)
  }

  function handleOtpKeyDown(e, idx) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      const newOtp = [...otp]
      newOtp[idx - 1] = ''
      setOtp(newOtp)
      otpRefs.current[idx - 1]?.focus()
    }
  }

  function fillOTP() {
    setOtp(['1', '2', '3', '4', '5', '6'])
    setTimeout(doMFA, 200)
  }

  function doMFA() {
    const code = otp.join('')
    if (code.length < 6) return
    setMfaLoading(true)
    setTimeout(() => {
      clearInterval(timerRef.current)
      setMfaLoading(false)
      doRedirect()
    }, 650)
  }

  function doRedirect() {
    setShowRedirect(true)
    setTimeout(() => {
      if (user.role === 'admin') navigate('/admin/dashboard')
      else if (user.role === 'staff') navigate('/staff/dashboard')
      else navigate('/customer/productcatalog')
    }, 1100)
  }

  const ui = user ? ROLE_UI[user.role] : null

  return (
    <div className="login-page">
      {/* LEFT */}
      <div className="left">
        <div className="left-content">
            <div className="brand">
            <img className = "brand-icon" src={logo} alt="logo" />
            <div>
                <div className="brand-name">E - MARKET</div>
            </div>
            </div>
            <div className="hero">
            <h1>Mua sắm thả ga,<br></br> giao hàng tận nhà</h1>
            </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="right">
        <div className="form-wrap">
          <div className="form-title">Đăng nhập</div>
          <div className="form-sub">
            {step === 1
              ? 'Nhập thông tin tài khoản của bạn.'
              : `Xin chào, ${user?.name}. Hoàn tất xác thực để tiếp tục.`}
          </div>

          {/* Step indicator */}
          <div className="step-track">
            <div className="step-dots">
              <div className={`sdot ${step === 1 ? 'active' : 'done'}`}>{step === 1 ? '1' : '✓'}</div>
              <div className={`sline ${step === 2 ? 'done' : ''}`}></div>
              <div className={`sdot ${step === 2 ? 'active' : ''}`}>2</div>
            </div>
            <div className="slabels">
              <span className={`slabel ${step === 1 ? 'active' : ''}`}>Email & mật khẩu</span>
              <span className={`slabel ${step === 2 ? 'active' : ''}`}>Xác thực MFA</span>
            </div>
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="step show">
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

              {/* Demo accounts */}
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
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="step show">
              {/* 2A: TOTP */}
              {user?.mfa && (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px', lineHeight: 1.6 }}>
                    Nhập mã <strong>6 chữ số</strong> từ ứng dụng Authenticator của bạn.
                  </p>
                  <div style={{ padding: '8px 12px', background: '#fff4e8', border: '1px solid #f5c8a0', borderRadius: '7px', fontSize: '11.5px', color: '#b05a10', marginBottom: '12px' }}>
                    💡 <strong>Demo:</strong> Nhập bất kỳ 6 số nào (VD:{' '}
                    <span onClick={fillOTP} style={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}>123456</span>) để tiếp tục
                  </div>
                  <div className="otp-timer">Mã hết hạn sau <b>{countdown}</b>s</div>
                  <div className="otp-row">
                    {otp.map((val, idx) => (
                      <input
                        key={idx}
                        maxLength={1}
                        value={val}
                        ref={el => otpRefs.current[idx] = el}
                        onChange={e => handleOtpChange(e.target.value, idx)}
                        onKeyDown={e => handleOtpKeyDown(e, idx)}
                        className={val ? 'filled' : ''}
                      />
                    ))}
                  </div>
                  <button className="btn-main" onClick={doMFA} disabled={mfaLoading}>
                    {mfaLoading
                      ? <span style={{ display: 'flex' }}><div className="spinner"></div></span>
                      : <span>Xác thực</span>
                    }
                  </button>
                </div>
              )}

              {/* 2B: Customer — bỏ qua MFA */}
              {!user?.mfa && (
                <div className="success-state">
                  <div className="success-icon">✅</div>
                  <div className="success-title">Xác thực thành công!</div>
                  <div className="success-sub">Tài khoản chưa bật MFA.<br />Khuyến nghị bật TOTP để bảo vệ tốt hơn.</div>
                  <button className="btn-main" onClick={doRedirect}>Vào trang của tôi →</button>
                  <button className="btn-back" style={{ marginTop: '8px', color: 'var(--green)' }}
                    onClick={() => alert('Chuyển đến trang bật TOTP trong Profile')}>
                    Bật MFA ngay
                  </button>
                </div>
              )}

              <button className="btn-back" onClick={backStep1}>← Quay lại</button>

              {/* Redirect banner */}
              {showRedirect && ui && (
                <div className="redirect-banner" style={{ display: 'block' }}>
                  <span className="redirect-role" style={{ background: ui.bg, color: ui.color }}>{ui.label}</span>
                  <div className="redirect-msg">Chào mừng, {user?.name}!</div>
                  <div className="redirect-sub">Đang chuyển hướng...</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
