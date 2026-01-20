<script setup>
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

definePage({
  meta: {
    layout: 'blank',
    unauthenticatedOnly: true,
  },
})

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

onMounted(async () => {
  try {
    const token = route.query.token
    const userData = route.query.user
    const redirectPath = route.query.redirect || '/bookings/calendar'

    if (!token || !userData) {
      router.replace('/login?error=' + encodeURIComponent('ไม่ได้รับข้อมูลการเข้าสู่ระบบ'))
      return
    }

    // Parse user data
    const user = JSON.parse(decodeURIComponent(userData))

    // Set auth in store
    authStore.setAuth(token, user)

    // Redirect to intended path or dashboard
    router.replace(redirectPath)
  } catch (error) {
    console.error('OAuth callback error:', error)
    router.replace('/login?error=' + encodeURIComponent('เกิดข้อผิดพลาดในการเข้าสู่ระบบ'))
  }
})
</script>

<template>
  <div class="d-flex align-center justify-center" style="min-height: 100vh;">
    <VCard
      flat
      :max-width="400"
      class="text-center pa-8"
    >
      <VCardText>
        <VProgressCircular
          indeterminate
          color="primary"
          size="64"
          class="mb-4"
        />
        <div class="text-h6 mb-2">กำลังเข้าสู่ระบบ...</div>
        <div class="text-body-2 text-medium-emphasis">กรุณารอสักครู่</div>
      </VCardText>
    </VCard>
  </div>
</template>











