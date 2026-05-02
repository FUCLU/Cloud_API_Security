import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleCallback, parseToken } from '../auth/keycloak'
import { useAuth } from '../hooks/useAuth'

export default function CallbackPage() {
  const { initFromTokens, user, resetAuth } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const callbackInfo = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      state: params.get('state') || '',
      code: params.get('code') || '',
      sessionState: params.get('session_state') || '',
      issuer: params.get('iss') || '',
    }
  }, [])

  useEffect(() => {
    handleCallback()
      .then(tokens => {
        const expected = sessionStorage.getItem('expected_login_email')
        const actual = parseToken(tokens.access_token)?.email?.toLowerCase?.()
        sessionStorage.removeItem('expected_login_email')

        if (expected && actual && expected !== actual) {
          resetAuth()
          navigate('/unauthorized', { replace: true })
          return
        }

        initFromTokens(tokens)
      })
      .catch(err => {
        console.error('[Callback]', err)
        resetAuth()
        sessionStorage.removeItem('pkce_verifier')
        sessionStorage.removeItem('pkce_state')
        setError(err.message)
      })
  }, [initFromTokens, navigate, resetAuth])

  useEffect(() => {
    if (!user) return
    if (user.roles.includes('admin')) navigate('/admin/dashboard', { replace: true })
    else if (user.roles.includes('staff')) navigate('/staff/dashboard', { replace: true })
    else navigate('/customer/productcatalog', { replace: true })
  }, [user, navigate])

  const copyCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(1200px 600px at 15% 10%, #ede8dc 0%, #f5f0e8 45%, #f8f6f1 100%)',
        padding: 20,
      }}
    >
      <div
        style={{
          width: 'min(820px, 96vw)',
          border: '1px solid #d4cec4',
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 12px 40px rgba(15, 14, 13, 0.08)',
          padding: 22,
        }}
      >
        <h2 style={{ marginBottom: 8, color: error ? '#c84b2f' : '#0f0e0d' }}>
          {error ? 'Đăng nhập thất bại' : 'Đang xử lý đăng nhập'}
        </h2>
        <p style={{ color: '#6e6a61', marginBottom: 14 }}>
          {error
            ? error
            : 'Hệ thống đang xác thực và điều hướng theo vai trò. Nếu bạn test script replay, có thể copy URL callback bên dưới.'}
        </p>

        <div
          style={{
            background: '#f7f3eb',
            border: '1px solid #e3dccf',
            borderRadius: 12,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <p style={{ fontSize: 12, color: '#6e6a61', marginBottom: 8 }}>Thông tin callback</p>
          <p style={{ fontSize: 12, wordBreak: 'break-all' }}><b>state:</b> {callbackInfo.state || '(không có)'}</p>
          <p style={{ fontSize: 12, wordBreak: 'break-all', marginTop: 6 }}><b>session_state:</b> {callbackInfo.sessionState || '(không có)'}</p>
          <p style={{ fontSize: 12, wordBreak: 'break-all', marginTop: 6 }}><b>iss:</b> {callbackInfo.issuer || '(không có)'}</p>
          <p style={{ fontSize: 12, wordBreak: 'break-all', marginTop: 6 }}><b>code:</b> {callbackInfo.code || '(không có)'}</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={copyCallbackUrl}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #d4cec4',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            {copied ? 'Đã copy callback URL' : 'Copy callback URL'}
          </button>

          {error ? (
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#0f0e0d',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Thử lại
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
