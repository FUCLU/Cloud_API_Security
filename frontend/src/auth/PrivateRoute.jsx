import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function PrivateRoute({ children, roles = [] }) {
  const { isAuthenticated, user, authReady } = useAuth()

  if (!authReady) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        Dang kiem tra phien dang nhap...
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (roles.length > 0) {
    const hasRole = roles.some(r => user?.roles?.includes(r))
    if (!hasRole) return <Navigate to="/unauthorized" replace />
  }

  return children
}
