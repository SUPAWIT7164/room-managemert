import axios from 'axios'
import { useAuthStore } from '@/stores/auth' // Import Pinia store
import { router } from '@/plugins/1.router' // Import the router instance

// Set base URL - Backend runs on port 5000 with /api prefix
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

// Request interceptor
axios.interceptors.request.use(
  config => {
    const authStore = useAuthStore() // Access Pinia store
    const token = authStore.token // Get token from Pinia store
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  },
)

// Response interceptor
axios.interceptors.response.use(
  response => response,
  error => {
    // Ignore aborted requests (ECONNABORTED) - these are usually intentional
    if (error.code === 'ECONNABORTED' || error.message === 'Request aborted') {
      return Promise.reject(error) // Still reject but don't log as error
    }

    if (error.response) {
      // Handle 401 Unauthorized (but not for logout endpoint to avoid infinite loop)
      if (error.response.status === 401 && !error.config.url.includes('/auth/logout')) {
        const authStore = useAuthStore() // Access Pinia store
        authStore.clearAuth() // Clear auth state
        router.push('/login') // Redirect to login
      }

      // Handle other errors
      const message = error.response.data?.message || 'เกิดข้อผิดพลาด'
      console.error('API Error:', message)
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network Error:', error.message)
    }
    return Promise.reject(error)
  },
)

export default axios
