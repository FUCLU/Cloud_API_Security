export function hasAnyRole(userRoles = [], allowedRoles = []) {
  if (allowedRoles.length === 0) return true
  return allowedRoles.some(role => userRoles.includes(role))
}


export function canAccessRoute(userRoles = [], allowedRoles = []) {
  return hasAnyRole(userRoles, allowedRoles)
}
