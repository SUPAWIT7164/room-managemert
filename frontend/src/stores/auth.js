import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/utils/api'

export const useAuthStore = defineStore('auth', () => {
  // Helper function to get storage based on remember me preference
  const getStorage = () => {
    const rememberMe = localStorage.getItem('rememberMe') === 'true'
    return rememberMe ? localStorage : sessionStorage
  }

  // State - check both localStorage and sessionStorage
  const getStoredUser = () => {
    const localUser = localStorage.getItem('user')
    const sessionUser = sessionStorage.getItem('user')
    return localUser ? JSON.parse(localUser) : (sessionUser ? JSON.parse(sessionUser) : null)
  }

  const getStoredToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null
  }

  const user = ref(getStoredUser())
  const token = ref(getStoredToken())
  const hasFaceRegistered = ref(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => ['admin', 'Admin', 'super-admin'].includes(user.value?.role))
  const isSuperAdmin = computed(() => user.value?.role === 'super-admin')
  const isApprover = computed(() => ['admin', 'Admin', 'super-admin', 'approver', 'Approver'].includes(user.value?.role))

  // Actions
  async function login(credentials) {
    try {
      const { rememberMe, ...loginCredentials } = credentials
      const response = await api.post('/auth/login', loginCredentials)

      const data = response?.data
      const payload = data?.data
      if (!payload || !payload.token) {
        const msg = (data && typeof data.message === 'string') ? data.message : 'เซิร์ฟเวอร์ตอบกลับรูปแบบไม่ถูกต้อง'
        const err = new Error(msg)
        err.response = response
        throw err
      }

      const { token: newToken, user: userData } = payload
      setAuth(newToken, userData, rememberMe)

      return data
    } catch (error) {
      throw error
    }
  }

  async function register(userData) {
    try {
      const { rememberMe, ...registerData } = userData
      const response = await api.post('/auth/register', registerData)
      const { token: newToken, user: newUser } = response.data.data
      
      setAuth(newToken, newUser, rememberMe || false)
      
      return response.data
    } catch (error) {
      throw error
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuth()
    }
  }

  async function fetchProfile() {
    try {
      const response = await api.get('/auth/me')
      user.value = response.data.data
      
      // Update user in the appropriate storage
      const storage = getStorage()
      storage.setItem('user', JSON.stringify(response.data.data))
      
      return response.data.data
    } catch (error) {
      throw error
    }
  }

  async function changePassword({ oldPassword, newPassword }) {
    try {
      const response = await api.post('/auth/change-password', {
        oldPassword,
        newPassword,
      })
      return response.data
    } catch (error) {
      throw error
    }
  }

  async function fetchFaceRegistrationStatus(force = false) {
    if (!token.value) {
      hasFaceRegistered.value = null
      return false
    }

    if (!force && hasFaceRegistered.value !== null)
      return hasFaceRegistered.value

    try {
      const response = await api.get('/face/check')
      hasFaceRegistered.value = response?.data?.data?.hasFace === true
      return hasFaceRegistered.value
    } catch (error) {
      // อย่าบล็อกการใช้งานถ้า endpoint ล้มเหลวชั่วคราว
      console.warn('Face status check failed:', error?.message || error)
      hasFaceRegistered.value = null
      return true
    }
  }

  function setFaceRegistrationStatus(value) {
    hasFaceRegistered.value = value === true
  }

  function setAuth(newToken, userData, rememberMe = false) {
    token.value = newToken
    user.value = userData
    hasFaceRegistered.value = null
    
    // Save rememberMe preference
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true')
    } else {
      localStorage.setItem('rememberMe', 'false')
      // Clear localStorage auth data if not remembering
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    
    // Use appropriate storage based on rememberMe
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem('token', newToken)
    storage.setItem('user', JSON.stringify(userData))
  }

  function clearAuth() {
    token.value = null
    user.value = null
    hasFaceRegistered.value = null
    
    // Clear both storages
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('rememberMe')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  }

  return {
    // State
    user,
    token,
    hasFaceRegistered,
    // Getters
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    isApprover,
    // Actions
    login,
    register,
    logout,
    fetchProfile,
    changePassword,
    fetchFaceRegistrationStatus,
    setFaceRegistrationStatus,
    setAuth,
    clearAuth,
  }
})

