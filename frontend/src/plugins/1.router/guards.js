import { canNavigate } from '@layouts/plugins/casl'
import { useAuthStore } from '@/stores/auth'

export const setupGuards = router => {
  // 👉 router.beforeEach
  // Docs: https://router.vuejs.org/guide/advanced/navigation-guards.html#global-before-guards
  router.beforeEach(to => {
    const authStore = useAuthStore()
    
    /*
         * If it's a public route, continue navigation. This kind of pages are allowed to visited by login & non-login users. Basically, without any restrictions.
         * Examples of public routes are, 404, under maintenance, etc.
         */
    if (to.meta.public)
      return

    /**
         * Check if user is logged in by checking if token & user data exists
         */
    const isLoggedIn = authStore.isAuthenticated

    /*
          If user is logged in and is trying to access login like page, redirect to home
          else allow visiting the page
          (WARN: Don't allow executing further by return statement because next code will check for permissions)
         */
    if (to.meta.unauthenticatedOnly) {
      if (isLoggedIn)
        return '/dashboard'
      else
        return undefined
    }
    
    // Check if route requires authentication
    if (to.meta.requiresAuth && !isLoggedIn) {
      return {
        name: 'login',
        query: {
          ...to.query,
          to: to.fullPath !== '/' ? to.path : undefined,
        },
      }
    }
    
    // Check admin routes
    if (to.meta.admin && !authStore.isAdmin) {
      return isLoggedIn ? { name: 'not-authorized' } : { name: 'login' }
    }
    
    // Check approver routes
    if (to.meta.approver && !authStore.isApprover) {
      return isLoggedIn ? { name: 'not-authorized' } : { name: 'login' }
    }
    
    // Only check CASL permissions if route has action/subject defined
    // Otherwise, allow access if authenticated
    const hasPermissionMeta = to.matched.some(route => route.meta?.action && route.meta?.subject)
    
    if (hasPermissionMeta && !canNavigate(to) && to.matched.length) {
      /* eslint-disable indent */
            return isLoggedIn
                ? { name: 'not-authorized' }
                : {
                    name: 'login',
                    query: {
                        ...to.query,
                        to: to.fullPath !== '/' ? to.path : undefined,
                    },
                }
            /* eslint-enable indent */
    }
  })
}
