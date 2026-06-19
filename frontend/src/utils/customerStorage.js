export function getCustomerIdentity(user) {
  const rawId = user?.sub || user?.email || user?.username
  return rawId ? String(rawId).trim().toLowerCase() : ''
}

export function getCustomerStorageKey(prefix, user) {
  const identity = getCustomerIdentity(user)
  return identity ? `${prefix}:${identity}` : ''
}
