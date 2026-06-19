import { createContext, useCallback, useEffect, useState } from 'react'
import {
  login as kcLogin,
  logout as kcLogout,
  loginWithGoogle as kcLoginWithGoogle,
  clearLoginState,
  getSession,
} from './keycloak'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [totpCode, setTotpCode] = useState(null)

  const clearAuth = useCallback(() => {
    setUser(null)
    sessionStorage.removeItem('expected_login_email')
    clearLoginState()
  }, [])

  const loadSession = useCallback(async () => {
    const session = await getSession()
    setUser(session.authenticated ? session.user : null)
    return session
  }, [])

  useEffect(() => {
    let cancelled = false

    getSession()
      .then(session => {
        if (!cancelled) setUser(session.authenticated ? session.user : null)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: null,
        authReady,
        totpCode,
        isAuthenticated: Boolean(user),
        login: (options) => kcLogin(options),
        logout: async () => {
          clearAuth()
          await kcLogout()
        },
        resetAuth: clearAuth,
        initFromSession: loadSession,
        loginWithGoogle: () => kcLoginWithGoogle(),
        setTotpCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
