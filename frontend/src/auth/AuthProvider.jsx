import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { login as kcLogin, logout as kcLogout, refreshTokens, parseToken, getRoles } from './keycloak'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [accessToken,  setAccessToken]  = useState(null)
  const [refreshToken, setRefreshToken] = useState(null)
  const [idToken,      setIdToken]      = useState(null)
  const [user,         setUser]         = useState(null)
  const timerRef = useRef(null)

  const storeTokens = useCallback((tokens) => {
    setAccessToken(tokens.access_token)
    setRefreshToken(tokens.refresh_token)
    setIdToken(tokens.id_token)

    const payload = parseToken(tokens.access_token)
    setUser({
      sub:      payload.sub,
      email:    payload.email,
      name:     payload.name ?? payload.preferred_username,
      username: payload.preferred_username,
      roles:    getRoles(tokens.access_token),
    })

    // Auto-refresh: 30 giây trước khi expire
    if (timerRef.current) clearTimeout(timerRef.current)
    const expiresIn = payload.exp - Math.floor(Date.now() / 1000)
    const delay     = Math.max((expiresIn - 30) * 1000, 0)

    timerRef.current = setTimeout(async () => {
      try {
        const next = await refreshTokens(tokens.refresh_token)
        storeTokens(next)
      } catch {
        clearAuth()
      }
    }, delay)
  }, [])

  const clearAuth = useCallback(() => {
    setAccessToken(null); setRefreshToken(null)
    setIdToken(null);     setUser(null)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      isAuthenticated: Boolean(accessToken && user),
      login:           () => kcLogin(),
      logout:          () => { kcLogout(idToken); clearAuth() },
      initFromTokens:  storeTokens,
    }}>
      {children}
    </AuthContext.Provider>
  )
}