import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleCallback } from '../auth/keycloak'
import { useAuth } from '../hooks/useAuth'

export default function CallbackPage() {
  const { initFromTokens, user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  // Bước 1: exchange code → tokens
  useEffect(() => {
    handleCallback()
      .then(initFromTokens)
      .catch(err => {
        console.error('[Callback]', err)
        setError(err.message)
      })
  }, [])

  // Bước 2: có user → redirect theo role
  useEffect(() => {
    if (!user) return
    if (user.roles.includes('admin'))      navigate('/admin/dashboard',       { replace: true })
    else if (user.roles.includes('staff')) navigate('/staff/dashboard',        { replace: true })
    else                                   navigate('/customer/productcatalog', { replace: true })
  }, [user])

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <h2 style={{ color: 'red' }}>Đăng nhập thất bại</h2>
      <p style={{ color: '#666' }}>{error}</p>
      <button onClick={() => navigate('/login')}>← Thử lại</button>
    </div>
  )

  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      <p>Đang xử lý đăng nhập...</p>
    </div>
  )
}