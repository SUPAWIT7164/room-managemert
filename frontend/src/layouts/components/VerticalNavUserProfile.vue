<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// Get user data from auth store
const userData = computed(() => authStore.user)

// Face image from face registration
const faceImage = ref(null)

// Load face image from API
const loadFaceImage = async () => {
  try {
    const response = await api.get('/face')
    if (response.data.success && response.data.data?.image) {
      faceImage.value = response.data.data.image
    } else {
      faceImage.value = null
    }
  } catch (error) {
    // Silently fail if face image doesn't exist
    console.log('Face image not found or error loading:', error.message)
    faceImage.value = null
  }
}

// Load face image on mount
onMounted(() => {
  if (authStore.isAuthenticated) {
    loadFaceImage()
  }
})

// Watch for route changes to reload face image (e.g., after face registration)
watch(() => route.path, (newPath) => {
  // Reload face image when navigating away from face registration page
  if (newPath !== '/face/register' && authStore.isAuthenticated) {
    loadFaceImage()
  }
})

// Watch for authentication changes
watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated) {
    loadFaceImage()
  } else {
    faceImage.value = null
  }
})

// Get the image to display (prioritize face image, then photo, then null)
const displayImage = computed(() => {
  return faceImage.value || userData.value?.photo || null
})

const logout = async () => {
  // Use auth store logout
  await authStore.logout()

  // Redirect to login page
  await router.push('/login')
}
</script>

<template>
  <div
    v-if="authStore.isAuthenticated"
    class="vertical-nav-user-profile-wrapper pc-user-card"
  >
    <VDivider class="mb-0" />
    
    <VCard
      class="pc-user-card-inner"
      variant="flat"
      rounded="0"
    >
      <VCardText class="pa-4">
        <div class="d-flex align-center">
          <div class="flex-shrink-0 me-3">
            <VAvatar
              size="45"
              :color="!displayImage ? 'primary' : undefined"
              :variant="!displayImage ? 'tonal' : undefined"
              class="profile-round-image"
            >
              <VImg
                v-if="displayImage"
                :src="displayImage"
                alt="รูปผู้ใช้"
              />
              <VIcon
                v-else
                icon="tabler-user"
                size="24"
              />
            </VAvatar>
          </div>

          <div class="flex-grow-1">
            <VMenu
              location="top end"
              offset="8px"
            >
              <template #activator="{ props }">
                <div
                  v-bind="props"
                  class="d-flex align-center cursor-pointer"
                >
                  <div class="flex-grow-1 me-2">
                    <h6 class="text-sm font-weight-medium mb-0">
                      {{ userData?.name || userData?.fullName || userData?.username || 'ผู้ใช้' }}
                    </h6>
                    <small class="text-xs text-disabled">
                      {{ userData?.email || '' }}
                    </small>
                  </div>
                  <div class="flex-shrink-0">
                    <VIcon
                      icon="tabler-chevron-down"
                      size="18"
                    />
                  </div>
                </div>
              </template>

              <VList
                density="compact"
                min-width="200"
              >
                <VListItem
                  prepend-icon="tabler-logout"
                  title="ออกจากระบบ"
                  class="text-error"
                  @click="logout"
                />
              </VList>
            </VMenu>
          </div>
        </div>
      </VCardText>
    </VCard>
  </div>
</template>

<style lang="scss" scoped>
.vertical-nav-user-profile-wrapper {
  margin-top: auto;
  
  .pc-user-card-inner {
    background-color: rgba(var(--v-theme-surface));
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }
  
  .profile-round-image {
    border-radius: 50%;
  }
  
  .cursor-pointer {
    cursor: pointer;
    
    &:hover {
      opacity: 0.8;
    }
  }
}
</style>










