<script setup>
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// Get user data from auth store
const userData = computed(() => authStore.user)

const logout = async () => {
  // Use auth store logout
  await authStore.logout()

  // Redirect to login page
  await router.push('/login')
}
</script>

<template>
  <div
    v-if="userData"
    class="vertical-nav-user-profile-wrapper"
  >
    <VDivider class="mb-3" />
    
    <div class="d-flex align-center gap-3 px-4 py-3">
      <VBadge
        dot
        bordered
        location="bottom right"
        offset-x="2"
        offset-y="2"
        color="success"
      >
        <VAvatar
          size="40"
          :color="!(userData && userData.avatar) ? 'primary' : undefined"
          :variant="!(userData && userData.avatar) ? 'tonal' : undefined"
        >
          <VImg
            v-if="userData && userData.avatar"
            :src="userData.avatar"
          />
          <VIcon
            v-else
            icon="tabler-user"
          />
        </VAvatar>
      </VBadge>

      <div class="flex-grow-1">
        <h6 class="text-sm font-weight-medium text-high-emphasis">
          {{ userData.fullName || userData.username || userData.name }}
        </h6>
        <span class="text-xs text-capitalize text-disabled">
          {{ userData.role === 'admin' ? 'ผู้ดูแลระบบ' : userData.role === 'approver' ? 'ผู้อนุมัติ' : 'ผู้ใช้งาน' }}
        </span>
      </div>

      <VMenu
        activator="parent"
        width="200"
        location="top end"
        offset="8px"
      >
        <VList density="compact">
          <VListItem
            prepend-icon="tabler-user"
            title="โปรไฟล์"
            to="/profile"
          />
          <VListItem
            prepend-icon="tabler-settings"
            title="ตั้งค่า"
            to="/settings"
          />
          <VDivider class="my-1" />
          <VListItem
            prepend-icon="tabler-logout"
            title="ออกจากระบบ"
            class="text-error"
            @click="logout"
          />
        </VList>
      </VMenu>
      
      <VBtn
        icon
        size="small"
        variant="text"
      >
        <VIcon
          icon="tabler-dots-vertical"
          size="20"
        />
      </VBtn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.vertical-nav-user-profile-wrapper {
  margin-top: auto;
  background-color: rgba(var(--v-theme-surface));
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>










