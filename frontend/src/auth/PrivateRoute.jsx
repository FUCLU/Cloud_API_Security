import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { canAccessRoute } from './roleAccess'

export default function PrivateRoute({ children, roles = [] }) {
  const { isAuthenticated, user, authReady } = useAuth()

  if (!authReady) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        Đang kiểm tra phiên đăng nhập...
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (roles.length > 0) {
    if (!canAccessRoute(user?.roles ?? [], roles)) return <Navigate to="/unauthorized" replace />
  }

  return children
}
