import { useAbility } from '@casl/vue'
import { useAuthStore } from '@/stores/auth'

/**
 * Returns ability result if ACL is configured or else just return true
 * We should allow passing string | undefined to can because for admin ability we omit defining action & subject
 *
 * Useful if you don't know if ACL is configured or not
 * Used in @core files to handle absence of ACL without errors
 *
 * @param {string} action CASL Actions // https://casl.js.org/v4/en/guide/intro#basics
 * @param {string} subject CASL Subject // https://casl.js.org/v4/en/guide/intro#basics
 */
export const can = (action, subject) => {
  const vm = getCurrentInstance()
  if (!vm)
    return false
  
  // Check role-based access control first (for room booking system)
  const authStore = useAuthStore()
  if (authStore && authStore.user) {
    // If item has meta.admin, check if user is admin
    // If item has meta.approver, check if user is approver
    // This will be handled in canViewNavMenuGroup and canViewNavLink
  }
  
  const localCan = vm.proxy && '$can' in vm.proxy
    
  return localCan ? vm.proxy?.$can(action, subject) : true
}

/**
 * Check role-based access for navigation item
 * @param {object} item navigation object item
 */
const checkRoleAccess = item => {
  const authStore = useAuthStore()
  if (!authStore || !authStore.user)
    return true // Allow if not authenticated (will be handled by route guards)
  
  const user = authStore.user
  const meta = item.meta || {}
  
  // Check admin requirement
  if (meta.admin && !authStore.isAdmin)
    return false
  
  // Check approver requirement
  if (meta.approver && !authStore.isApprover)
    return false
  
  return true
}

/**
 * Check if user can view item based on it's ability
 * Based on item's action and subject & Hide group if all of it's children are hidden
 * @param {object} item navigation object item
 */
export const canViewNavMenuGroup = item => {
  // Check role-based access first
  if (!checkRoleAccess(item))
    return false
  
  // If no children, check if item itself can be viewed
  if (!item.children || item.children.length === 0) {
    // If item has action/subject, check CASL permissions
    if (item.action && item.subject)
      return can(item.action, item.subject)
    // Otherwise, allow if role access passed
    return true
  }
  
  const hasAnyVisibleChild = item.children.some(i => {
    // Check role access for child
    if (!checkRoleAccess(i))
      return false
    
    // Check CASL permissions if defined
    if (i.action && i.subject)
      return can(i.action, i.subject)
    
    // If no CASL permissions, allow if role access passed
    return true
  })

  // If no visible children, hide the group
  if (!hasAnyVisibleChild)
    return false

  // If subject and action is defined in item => Return based on children visibility (Hide group if no child is visible)
  // Else check for ability using provided subject and action along with checking if has any visible child
  if (!(item.action && item.subject))
    return hasAnyVisibleChild
  
  return can(item.action, item.subject) && hasAnyVisibleChild
}
export const canNavigate = to => {
  const ability = useAbility()

  // Get the most specific route (last one in the matched array)
  const targetRoute = to.matched[to.matched.length - 1]

  // If the target route has specific permissions, check those first
  if (targetRoute?.meta?.action && targetRoute?.meta?.subject)
    return ability.can(targetRoute.meta.action, targetRoute.meta.subject)

  // If no specific permissions defined in any route, allow access (return true)
  const hasAnyPermissionMeta = to.matched.some(route => route.meta?.action && route.meta?.subject)
  if (!hasAnyPermissionMeta)
    return true

  // If permissions are defined, check if any parent route allows access
  return to.matched.some(route => {
    if (route.meta?.action && route.meta?.subject)
      return ability.can(route.meta.action, route.meta.subject)
    return false
  })
}
