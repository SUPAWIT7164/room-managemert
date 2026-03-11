<script setup>
import { ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import rmutiLogoImage from '@images/RMUTI-logo-color.png'
import logoImage from '@images/unnamed-1.png'

definePage({
  meta: {
    layout: 'blank',
    unauthenticatedOnly: true,
  },
})

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isPasswordVisible = ref(false)
const loading = ref(false)
const oauthLoading = ref(false)
const ldapLoading = ref(false)

const errors = ref({
  username: undefined,
  password: undefined,
})

const refVForm = ref()

// Load saved username and password from localStorage
const savedUsername = localStorage.getItem('savedUsername') || ''
const savedPassword = localStorage.getItem('savedPassword') || ''

const credentials = ref({
  username: savedUsername,
  password: savedPassword,
})

const rememberMe = ref(false)

const login = async () => {
  loading.value = true
  errors.value = { username: undefined, password: undefined }
  
  try {
    await authStore.login({
      username: credentials.value.username,
      password: credentials.value.password,
      rememberMe: rememberMe.value,
    })

    // Save username and password if remember me is checked
    if (rememberMe.value) {
      localStorage.setItem('savedUsername', credentials.value.username)
      localStorage.setItem('savedPassword', credentials.value.password)
    } else {
      localStorage.removeItem('savedUsername')
      localStorage.removeItem('savedPassword')
    }

    // Redirect to bookings avaliable (ตารางห้องว่าง) or return URL
    await nextTick(() => {
      const redirectPath = route.query.to ? String(route.query.to) : '/bookings/avaliable'
      router.replace(redirectPath)
    })
  } catch (error) {
    const message = error.response?.data?.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน'
    errors.value.password = message
  } finally {
    loading.value = false
  }
}

// Check for OAuth error in query params
if (route.query.error) {
  errors.value.password = route.query.error
}

const onSubmit = () => {
  refVForm.value?.validate().then(({ valid: isValid }) => {
    if (isValid)
      login()
  })
}

const loginWithMicrosoft = () => {
  oauthLoading.value = true
  const frontendUrl = window.location.origin
  const redirectUri = route.query.to ? String(route.query.to) : '/bookings/avaliable'
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  
  // Redirect to backend OAuth endpoint
  window.location.href = `${apiBaseUrl}/auth/oauth/microsoft?redirectUri=${encodeURIComponent(redirectUri)}`
}

const loginWithLDAP = async () => {
  ldapLoading.value = true
  errors.value = { username: undefined, password: undefined }
  
  try {
    await authStore.login({
      username: credentials.value.username,
      password: credentials.value.password,
      authType: 'ldap', // Specify LDAP authentication
      rememberMe: rememberMe.value,
    })

    // Save username and password if remember me is checked
    if (rememberMe.value) {
      localStorage.setItem('savedUsername', credentials.value.username)
      localStorage.setItem('savedPassword', credentials.value.password)
    } else {
      localStorage.removeItem('savedUsername')
      localStorage.removeItem('savedPassword')
    }

    // Redirect to bookings avaliable (ตารางห้องว่าง) or return URL
    await nextTick(() => {
      const redirectPath = route.query.to ? String(route.query.to) : '/bookings/avaliable'
      router.replace(redirectPath)
    })
  } catch (error) {
    const message = error.response?.data?.message || 'เข้าสู่ระบบด้วย LDAP ไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน'
    errors.value.password = message
  } finally {
    ldapLoading.value = false
  }
}
</script>

<template>
  <div class="login-page d-flex align-center justify-center justify-md-end">
    <!-- Header Logo and Text -->
    <div class="login-header">
      <img
        :src="logoImage"
        alt="Logo"
        class="header-logo"
      />
      <div class="header-text">
        <div class="header-text-thai">
          มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตสุรินทร์
        </div>
        <div class="header-text-english">
          Rajamangala University of Technology Isan SURIN Campus
        </div>
      </div>
    </div>

    <VCard
      flat
      :max-width="500"
      class="login-card me-md-12"
    >
      <VCardText class="text-center pa-8 pb-4 flex-grow-0">
        <img
          :src="rmutiLogoImage"
          alt="RMUTI Logo"
          class="auth-card-logo"
        />
      </VCardText>
      <VCardText class="pa-8 pt-4 flex-grow-1">
        <VForm
          ref="refVForm"
          @submit.prevent="onSubmit"
        >
          <VRow>
            <!-- username -->
            <VCol cols="12">
              <AppTextField
                v-model="credentials.username"
                label="ชื่อผู้ใช้"
                placeholder="กรุณากรอกชื่อผู้ใช้"
                autofocus
                autocomplete="username"
                :error-messages="errors.username"
              />
            </VCol>

            <!-- password -->
            <VCol cols="12">
              <AppTextField
                v-model="credentials.password"
                label="รหัสผ่าน"
                placeholder="············"
                :type="isPasswordVisible ? 'text' : 'password'"
                autocomplete="current-password"
                :error-messages="errors.password"
                :append-inner-icon="isPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'"
                @click:append-inner="isPasswordVisible = !isPasswordVisible"
              />

              <div class="d-flex align-center flex-wrap justify-space-between my-4">
                <VCheckbox
                  v-model="rememberMe"
                  label="จดจำการเข้าสู่ระบบ"
                  density="compact"
                />
              </div>

              <VBtn
                block
                type="submit"
                :loading="loading"
                size="large"
                class="mb-4"
              >
                เข้าสู่ระบบ
              </VBtn>

              <!-- Divider -->
              <div class="d-flex align-center my-4">
                <VDivider />
                <span class="mx-4 text-body-2 text-medium-emphasis">หรือ</span>
                <VDivider />
              </div>

              <!-- Microsoft 365 OAuth Button -->
              <VBtn
                block
                color="primary"
                variant="outlined"
                size="large"
                :loading="oauthLoading"
                @click="loginWithMicrosoft"
                class="mb-4"
              >
                <VIcon
                  start
                  icon="mdi-microsoft"
                />
                เข้าสู่ระบบด้วย Microsoft 365
              </VBtn>

              <!-- LDAP Login Button -->
              <VBtn
                block
                color="secondary"
                variant="outlined"
                size="large"
                :loading="ldapLoading"
                @click="loginWithLDAP"
                class="mb-4"
              >
                <VIcon
                  start
                  icon="mdi-account-network"
                />
                เข้าสู่ระบบด้วย LDAP
              </VBtn>
            </VCol>

            <!-- create account -->
            <VCol
              cols="12"
              class="text-center"
            >
              <span class="text-body-2 text-medium-emphasis">ยังไม่มีบัญชี?</span>
              <RouterLink
                class="text-primary ms-1 text-body-2 font-weight-medium"
                :to="{ name: 'register' }"
              >
                ลงทะเบียน
              </RouterLink>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth";

.login-page {
  min-height: 100vh;
  background-image: url('@images/A1006.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  position: relative;
  padding: 1rem;
  overflow-x: hidden;
  overflow-y: auto;
}

.login-page::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  z-index: 0;
  pointer-events: none;
}

.login-page > * {
  position: relative;
  z-index: 1;
}

.login-header {
  position: absolute;
  top: 2rem;
  left: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 2;
}

.header-logo {
  height: 100px;
  width: auto;
  object-fit: contain;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.header-text-thai {
  font-size: 24px;
  color: #FF3300;
  font-weight: 500;
  line-height: 1.4;
}

.header-text-english {
  font-size: 18px;
  color: #ffffff;
  font-weight: 400;
  line-height: 1.4;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.auth-card-logo {
  max-width: 220px;
  width: 100%;
  height: auto;
  object-fit: contain;
  display: block;
  margin-left: auto;
  margin-right: auto;
}

.login-card {
  border-radius: 12px !important;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08) !important;
  height: auto !important;
  width: 100%;
  max-width: 500px;
  position: relative;
  overflow: visible;
  display: flex !important;
  flex-direction: column !important;
}

/* Ensure card content maintains consistent height */
.login-card :deep(.v-card-text) {
  flex-shrink: 0 !important;
}

/* Prevent layout shift from error messages - Reserve space always */
.login-card :deep(.v-input__details) {
  min-height: 28px !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  margin-top: 4px !important;
  margin-bottom: 0 !important;
  padding: 0 !important;
  position: relative !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  flex-shrink: 0 !important;
}

/* Force display even when empty - use ::before to reserve space */
.login-card :deep(.v-input__details:empty)::before {
  content: "" !important;
  display: block !important;
  height: 20px !important;
  visibility: hidden !important;
}

/* Force display even when empty */
.login-card :deep(.v-input__details:empty),
.login-card :deep(.v-input__details:not(:has(.v-messages__message))) {
  min-height: 28px !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

/* Override any inline styles that hide the details */
.login-card :deep(.v-input__details[style*="display: none"]),
.login-card :deep(.v-input__details[style*="display:none"]),
.login-card :deep(.v-input__details[style*="height: 0"]),
.login-card :deep(.v-input__details[style*="height:0"]) {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  min-height: 28px !important;
}

.login-card :deep(.v-messages) {
  min-height: 22px !important;
  display: block !important;
  line-height: 22px !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  box-sizing: border-box !important;
  visibility: visible !important;
  opacity: 1 !important;
  flex-shrink: 0 !important;
}

/* Force display even when empty - use ::before to reserve space */
.login-card :deep(.v-messages:empty)::before {
  content: "" !important;
  display: block !important;
  height: 22px !important;
  visibility: hidden !important;
}

/* Force display even when empty */
.login-card :deep(.v-messages:empty) {
  min-height: 22px !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

/* Override any inline styles that hide the messages */
.login-card :deep(.v-messages[style*="display: none"]),
.login-card :deep(.v-messages[style*="display:none"]),
.login-card :deep(.v-messages[style*="height: 0"]),
.login-card :deep(.v-messages[style*="height:0"]) {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  min-height: 22px !important;
}

.login-card :deep(.v-messages__message) {
  margin: 0 !important;
  padding: 0 !important;
  line-height: 22px !important;
  font-size: 12px !important;
  display: inline-block !important;
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

.login-card :deep(.v-text-field) {
  margin-bottom: 0 !important;
}

.login-card :deep(.v-field) {
  margin-bottom: 0 !important;
}

/* Fixed spacing for VCol containing form fields */
.login-card :deep(.v-col) {
  padding-top: 8px !important;
  padding-bottom: 8px !important;
  margin-bottom: 0 !important;
}

/* Ensure app-text-field has consistent spacing */
.login-card :deep(.app-text-field) {
  margin-bottom: 0 !important;
  padding-bottom: 0 !important;
  min-height: auto !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  flex-shrink: 0 !important;
}

/* Ensure input wrapper has flexible height */
.login-card :deep(.v-input) {
  margin-bottom: 0 !important;
  min-height: auto !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  flex-shrink: 0 !important;
}

/* Ensure input control has minimum height */
.login-card :deep(.v-input__control) {
  min-height: 64px !important;
  box-sizing: border-box !important;
  flex-shrink: 0 !important;
}

/* Ensure form fields maintain consistent spacing */
.v-card-text {
  min-height: auto;
}

/* Fixed spacing for form elements */
.login-card :deep(.v-input) {
  margin-bottom: 0 !important;
}

.login-card :deep(.app-text-field) {
  margin-bottom: 0 !important;
}

/* Ensure the card content has consistent padding */
.login-card .v-card-text.pa-8.pt-4 {
  padding-bottom: 32px !important;
}

/* ===== Tablet (≤960px) ===== */
@media (max-width: 960px) {
  .login-page {
    justify-content: center !important;
    padding: 1rem;
  }

  .login-card {
    margin-inline-end: 0 !important;
    min-height: auto !important;
  }

  .login-header {
    position: relative;
    top: auto;
    left: auto;
    margin-bottom: 1.5rem;
    flex-direction: column;
    align-items: center;
    text-align: center;
    width: 100%;
  }

  .header-text-thai {
    font-size: 1.125rem;
  }

  .header-text-english {
    font-size: 0.9375rem;
  }

  .login-page {
    flex-direction: column;
  }
}

/* ===== Mobile (≤768px) ===== */
@media (max-width: 768px) {
  .login-header {
    top: auto;
    left: auto;
    position: relative;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
  }

  .header-logo {
    height: 60px;
  }

  .header-text-thai {
    font-size: 1rem;
  }

  .header-text-english {
    font-size: 0.875rem;
  }

  .login-card {
    max-width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    border-radius: 12px !important;
  }

  .auth-card-logo {
    max-width: 160px;
  }
}

/* ===== Small Mobile (≤480px) ===== */
@media (max-width: 480px) {
  .login-page {
    padding: 0.5rem;
  }

  .header-logo {
    height: 50px;
  }

  .header-text-thai {
    font-size: 0.875rem;
  }

  .header-text-english {
    font-size: 0.75rem;
  }

  .login-card .v-card-text.pa-8 {
    padding: 16px !important;
  }

  .auth-card-logo {
    max-width: 130px;
  }
}
</style>
