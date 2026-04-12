const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL
const REALM        = import.meta.env.VITE_REALM  
const CLIENT_ID    = import.meta.env.VITE_CLIENT_ID
const REDIRECT_URI = `${window.location.origin}/callback`
const BASE         = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect`

// ─── PKCE helpers ─────────────────────────────────────────────────────────────
function b64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateVerifier() {
  return b64url(crypto.getRandomValues(new Uint8Array(64)))
}

async function generateChallenge(verifier) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(hash)
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function login() {
  const verifier  = await generateVerifier()
  const challenge = await generateChallenge(verifier)
  const state     = b64url(crypto.getRandomValues(new Uint8Array(16)))

  sessionStorage.setItem('pkce_verifier', verifier)
  sessionStorage.setItem('pkce_state', state)

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             CLIENT_ID,
    redirect_uri:          REDIRECT_URI,
    scope:                 'openid profile email roles',
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `${BASE}/auth?${params}`
}

// ─── Callback (exchange code → tokens) ────────────────────────────────────────
export async function handleCallback() {
  const params = new URLSearchParams(window.location.search)
  const code   = params.get('code')
  const state  = params.get('state')
  const error  = params.get('error')

  if (error) throw new Error(`Keycloak: ${error} — ${params.get('error_description')}`)

  if (state !== sessionStorage.getItem('pkce_state'))
    throw new Error('State mismatch — possible CSRF')

  const verifier = sessionStorage.getItem('pkce_verifier')
  if (!verifier) throw new Error('Missing PKCE verifier')

  const res = await fetch(`${BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      code,
      code_verifier: verifier,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Token exchange failed: ${err.error_description}`)
  }

  sessionStorage.removeItem('pkce_verifier')
  sessionStorage.removeItem('pkce_state')

  return res.json()  // { access_token, refresh_token, id_token, expires_in }
}

// ─── Silent refresh ───────────────────────────────────────────────────────────
export async function refreshTokens(refreshToken) {
  const res = await fetch(`${BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     CLIENT_ID,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) throw new Error('Refresh token expired')
  return res.json()
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export function logout(idToken) {
  const params = new URLSearchParams({
    client_id:                CLIENT_ID,
    post_logout_redirect_uri: window.location.origin,
    id_token_hint:            idToken,
  })
  window.location.href = `${BASE}/logout?${params}`
}

// ─── Token utils ──────────────────────────────────────────────────────────────
export function parseToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return null }
}

export function getRoles(token) {
  return parseToken(token)?.realm_access?.roles ?? []
}