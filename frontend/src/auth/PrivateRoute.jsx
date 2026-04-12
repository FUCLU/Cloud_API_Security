import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function PrivateRoute({ children, roles = [] }) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (roles.length > 0) {
    // "user" role có thể vào customer pages
    const hasRole = roles.some(r => user?.roles?.includes(r))
    if (!hasRole) return <Navigate to="/unauthorized" replace />
  }

  return children
}