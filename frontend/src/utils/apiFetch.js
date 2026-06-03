import { createDpopProof } from './dpop'

const API_BASE = import.meta.env.VITE_KONG_URL || ''

export async function apiFetch(path, options = {}) {
  const method = options.method || 'GET'
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const token = options.token

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `DPoP ${token}`)
    headers.set('DPoP', await createDpopProof({ htm: method, htu: url, accessToken: token }))
  }

  return fetch(url, {
    ...options,
    method,
    headers,
  })
}
