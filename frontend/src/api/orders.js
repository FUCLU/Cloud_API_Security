import { apiFetch } from '../utils/apiFetch'

export function getOrders(token) {
  return apiFetch('/api/v1/orders', { token })
}

export function createOrder(token, payload) {
  return apiFetch('/api/v1/orders', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
