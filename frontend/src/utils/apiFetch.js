const API_BASE = import.meta.env.VITE_API_BASE || ''

export async function apiFetch(path, options = {}) {
  const method = options.method || 'GET'
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`

  const headers = new Headers(options.headers || {})

  return fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
  })
}
