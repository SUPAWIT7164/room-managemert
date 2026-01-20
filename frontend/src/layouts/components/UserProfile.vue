<script setup>
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'
import { useAuthStore } from '@/stores/auth'
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api'

const router = useRouter()
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

// Get the image to display (prioritize face image, then avatar/photo, then null)
const displayImage = computed(() => {
  return faceImage.value || userData.value?.avatar || userData.value?.photo || null
})

const logout = async () => {
  // Use auth store logout
  await authStore.logout()

  // Redirect to login page
  await router.push('/login')
}

const userProfileList = [
  { type: 'divider' },
  {
    type: 'navItem',
    icon: 'tabler-user',
    title: 'โปรไฟล์',
    to: '/profile',
  },
  {
    type: 'navItem',
    icon: 'tabler-settings',
    title: 'ตั้งค่า',
    to: '/settings',
  },
]
</script>

<template>
  <VBadge
    v-if="userData"
    dot
    bordered
    location="bottom right"
    offset-x="1"
    offset-y="2"
    color="success"
  >
    <VAvatar
      size="38"
      class="cursor-pointer"
      :color="!displayImage ? 'primary' : undefined"
      :variant="!displayImage ? 'tonal' : undefined"
    >
      <VImg
        v-if="displayImage"
        :src="displayImage"
        alt="รูปผู้ใช้"
      />
      <VIcon
        v-else
        icon="tabler-user"
      />

      <!-- SECTION Menu -->
      <VMenu
        activator="parent"
        width="240"
        location="bottom end"
        offset="12px"
      >
        <VList>
          <VListItem>
            <div class="d-flex gap-2 align-center">
              <VListItemAction>
                <VBadge
                  dot
                  location="bottom right"
                  offset-x="3"
                  offset-y="3"
                  color="success"
                  bordered
                >
                  <VAvatar
                    :color="!displayImage ? 'primary' : undefined"
                    :variant="!displayImage ? 'tonal' : undefined"
                  >
                    <VImg
                      v-if="displayImage"
                      :src="displayImage"
                      alt="รูปผู้ใช้"
                    />
                    <VIcon
                      v-else
                      icon="tabler-user"
                    />
                  </VAvatar>
                </VBadge>
              </VListItemAction>

              <div>
                <h6 class="text-h6 font-weight-medium">
                  {{ userData.fullName || userData.username }}
                </h6>
                <VListItemSubtitle class="text-capitalize text-disabled">
                  {{ userData.role }}
                </VListItemSubtitle>
              </div>
            </div>
          </VListItem>

          <PerfectScrollbar :options="{ wheelPropagation: false }">
            <template
              v-for="item in userProfileList"
              :key="item.title"
            >
              <VListItem
                v-if="item.type === 'navItem'"
                :to="item.to"
              >
                <template #prepend>
                  <VIcon
                    :icon="item.icon"
                    size="22"
                  />
                </template>

                <VListItemTitle>{{ item.title }}</VListItemTitle>

                <template
                  v-if="item.badgeProps"
                  #append
                >
                  <VBadge
                    rounded="sm"
                    class="me-3"
                    v-bind="item.badgeProps"
                  />
                </template>
              </VListItem>

              <VDivider
                v-else
                class="my-2"
              />
            </template>

            <div class="px-4 py-2">
              <VBtn
                block
                size="small"
                color="error"
                append-icon="tabler-logout"
                @click="logout"
              >
                ออกจากระบบ
              </VBtn>
            </div>
          </PerfectScrollbar>
        </VList>
      </VMenu>
      <!-- !SECTION -->
    </VAvatar>
  </VBadge>
</template>
