import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import {
  login as kcLogin,
  logout as kcLogout,
  refreshTokens,
  parseToken,
  getRoles,
  loginWithGoogle as kcLoginWithGoogle,
} from './keycloak'

export const AuthContext = createContext(null)
const AUTH_STORAGE_KEY = 'auth_ctx'

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null)
  const [refreshToken, setRefreshToken] = useState(null)
  const [idToken, setIdToken] = useState(null)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [totpCode, setTotpCode] = useState(null)
  const timerRef = useRef(null)

  const clearAuth = useCallback(() => {
    setAccessToken(null)
    setRefreshToken(null)
    setIdToken(null)
    setUser(null)
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const storeTokens = useCallback((tokens) => {
    setAccessToken(tokens.access_token)
    setRefreshToken(tokens.refresh_token)
    setIdToken(tokens.id_token)

    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
      })
    )

    const accessPayload = parseToken(tokens.access_token)
    const idPayload = parseToken(tokens.id_token)
    const payload = { ...accessPayload, ...idPayload }
    const roles = getRoles(tokens.access_token)

    setUser({
      sub: payload?.sub,
      email: payload?.email,
      name: payload?.name ?? payload?.preferred_username,
      username: payload?.preferred_username,
      roles: roles.length > 0 ? roles : ['customer'],
    })

    if (timerRef.current) clearTimeout(timerRef.current)
    const now = Math.floor(Date.now() / 1000)
    const expiresIn = (accessPayload?.exp ?? now) - now
    const delay = Math.max((expiresIn - 30) * 1000, 0)

    timerRef.current = setTimeout(async () => {
      try {
        const next = await refreshTokens(tokens.refresh_token)
        storeTokens(next)
      } catch {
        clearAuth()
      }
    }, delay)
  }, [clearAuth])

  useEffect(() => {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY)

    if (!raw || accessToken) {
      setAuthReady(true)
      return
    }

    try {
      const saved = JSON.parse(raw)
      if (saved?.accessToken && saved?.refreshToken && saved?.idToken) {
        storeTokens({
          access_token: saved.accessToken,
          refresh_token: saved.refreshToken,
          id_token: saved.idToken,
        })
      }
    } catch {
      sessionStorage.removeItem(AUTH_STORAGE_KEY)
    } finally {
      setAuthReady(true)
    }
  }, [accessToken, storeTokens])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        authReady,
        totpCode,
        isAuthenticated: Boolean(accessToken && user),
        login: (options) => kcLogin(options),
        logout: () => {
          kcLogout(idToken)
          clearAuth()
        },
        resetAuth: clearAuth,
        initFromTokens: storeTokens,
        loginWithGoogle: () => kcLoginWithGoogle(),
        setTotpCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
