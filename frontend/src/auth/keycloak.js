const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL
const REALM = import.meta.env.VITE_REALM
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID
const API_BASE = import.meta.env.VITE_API_BASE || ''
const REDIRECT_URI = `${window.location.origin}/callback`
const BASE = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect`
const LOGIN_STATE_KEYS = ['pkce_verifier', 'pkce_state']

function b64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function generateVerifier() {
  return b64url(crypto.getRandomValues(new Uint8Array(64)))
}

async function generateChallenge(verifier) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(hash)
}

export async function login(options = {}) {
  const { loginHint = '', idpHint = '', prompt = '' } = options

  clearLoginState()
  const verifier = await generateVerifier()
  const challenge = await generateChallenge(verifier)
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)))

  sessionStorage.setItem('pkce_verifier', verifier)
  sessionStorage.setItem('pkce_state', state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email roles',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  if (loginHint) params.set('login_hint', loginHint)
  if (idpHint) params.set('kc_idp_hint', idpHint)
  if (prompt) params.set('prompt', prompt)

  window.location.href = `${BASE}/auth?${params}`
}

export async function loginWithGoogle() {
  return login({ idpHint: 'google', prompt: 'select_account' })
}

export async function handleCallback() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')

  if (error) throw new Error(`Keycloak: ${error} - ${params.get('error_description')}`)
  if (state !== sessionStorage.getItem('pkce_state')) throw new Error('State mismatch')

  const verifier = sessionStorage.getItem('pkce_verifier')
  if (!verifier) throw new Error('Missing PKCE verifier')

  const res = await fetch(`${API_BASE}/api/v1/auth/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: verifier,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Token exchange failed: ${err.detail || res.status}`)
  }

  sessionStorage.removeItem('pkce_verifier')
  sessionStorage.removeItem('pkce_state')
  return res.json()
}

export async function getSession() {
  const res = await fetch(`${API_BASE}/api/v1/auth/session`, {
    method: 'GET',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Session check failed')
  return res.json()
}

export async function logout() {
  clearLoginState()
  sessionStorage.removeItem('expected_login_email')

  const res = await fetch(`${API_BASE}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
  const payload = await res.json().catch(() => ({}))
  if (payload.logout_url) {
    window.location.href = payload.logout_url
    return
  }
  window.location.href = `${window.location.origin}/login`
}

export function clearLoginState() {
  for (const key of LOGIN_STATE_KEYS) {
    sessionStorage.removeItem(key)
  }
}
