export function getDisplayName(user) {
  return user?.name || user?.username || user?.email || 'Người dùng'
}

export function getDisplayEmail(user) {
  return user?.email || user?.username || 'Chưa có email'
}

export function getPrimaryRole(user) {
  const roles = user?.roles ?? []
  if (roles.includes('admin')) return 'Admin'
  if (roles.includes('staff')) return 'Staff'
  if (roles.includes('customer')) return 'Customer'
  return 'User'
}

export function getInitials(user) {
  const source = getDisplayName(user)
  const words = source
    .replace(/@.*/, '')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(Boolean)

  if (words.length === 0) return 'ND'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}
