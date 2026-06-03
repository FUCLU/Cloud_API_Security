import { apiFetch } from '../utils/apiFetch'

export function getUsers(token) {
  return apiFetch('/api/v1/users', { token })
}
