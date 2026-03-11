import axios from 'axios'
import { useAuthStore } from '@/stores/auth' // Import Pinia store
import { router } from '@/plugins/1.router' // Import the router instance

// Set base URL - use relative '/api' so Vite proxy handles it in dev, and works behind IIS in prod
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

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

      // Handle other errors (ไม่ log 502/503 เพื่อลด noise เมื่อกล้องหรือ service ไม่พร้อม)
      if (error.response.status !== 502 && error.response.status !== 503) {
        const message = error.response.data?.message || 'เกิดข้อผิดพลาด'
        console.error('API Error:', message)
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network Error:', error.message)
    }
    return Promise.reject(error)
  },
)

export default axios
