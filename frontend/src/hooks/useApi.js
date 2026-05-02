import { useAuth } from './useAuth'
import { createDpopProof } from '../utils/dpop'

export function useApi() {
  const { accessToken, totpCode } = useAuth()

  // Wrapper để gọi API với Authorization + X-TOTP-Code headers
  async function apiCall(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase()
    const requestUrl = new URL(url, window.location.origin).toString()

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Thêm Authorization header
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
      headers.DPoP = await createDpopProof({
        htu: requestUrl,
        htm: method,
        accessToken,
      })
    }

    // Thêm TOTP header nếu có
    if (totpCode) {
      headers['X-TOTP-Code'] = totpCode
    }

    const response = await fetch(requestUrl, {
      ...options,
      method,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  }

  return { apiCall }
}
