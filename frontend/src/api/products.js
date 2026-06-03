import { apiFetch } from '../utils/apiFetch'

export function getProducts(token) {
  return apiFetch('/api/v1/products', { token })
}
