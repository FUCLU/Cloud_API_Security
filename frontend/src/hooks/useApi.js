import { useAuth } from './useAuth'

export function useApi() {
  const { totpCode } = useAuth()

  // Wrapper để gọi API với Authorization + X-TOTP-Code headers
  async function apiCall(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase()
    const requestUrl = new URL(url, window.location.origin).toString()

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Thêm TOTP header nếu có
    if (totpCode) {
      headers['X-TOTP-Code'] = totpCode
    }

    const response = await fetch(requestUrl, {
      ...options,
      method,
      headers,
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  }

  return { apiCall }
}
