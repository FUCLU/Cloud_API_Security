import { createDpopProof } from '../utils/dpop'
const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL
const REALM = import.meta.env.VITE_REALM
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID
const REDIRECT_URI = `${window.location.origin}/callback`
const BASE = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect`

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

// Kept only for compatibility during migration. Prefer login() + PKCE.
export async function loginWithPassword(email, password, totp = '') {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: CLIENT_ID,
    username: email,
    password,
    scope: 'openid profile email roles',
  })
  if (totp) body.set('totp', totp)

  const tokenEndpoint = `${BASE}/token`
  const dpopProof = await createDpopProof({
    htu: tokenEndpoint,
    htm: 'POST',
  })

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      DPoP: dpopProof,
    },
    body,
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error_description ?? 'Dang nhap that bai')
  }

  return res.json()
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

  const tokenEndpoint = `${BASE}/token`
  const dpopProof = await createDpopProof({
    htu: tokenEndpoint,
    htm: 'POST',
  })

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      DPoP: dpopProof,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
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
  return res.json()
}

export async function refreshTokens(refreshToken) {
  const tokenEndpoint = `${BASE}/token`
  const dpopProof = await createDpopProof({
    htu: tokenEndpoint,
    htm: 'POST',
  })

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      DPoP: dpopProof,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error('Refresh token expired')
  return res.json()
}

export function logout(idToken) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    post_logout_redirect_uri: `${window.location.origin}/login`,
  })
  if (idToken) params.set('id_token_hint', idToken)
  window.location.href = `${BASE}/logout?${params}`
}

export function parseToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export function getRoles(token) {
  return parseToken(token)?.realm_access?.roles ?? []
}
