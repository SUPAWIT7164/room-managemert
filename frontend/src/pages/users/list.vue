<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const authStore = useAuthStore()
const loading = ref(false)
const users = ref([])
const updatingRoles = ref({})
const oldRoles = ref({})
const showConfirmDialog = ref(false)
const confirmDialogData = ref({ userId: null, newRole: null, oldRole: null })
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const roles = [
  { title: 'User', value: 'user' },
  { title: 'Admin', value: 'admin' },
  { title: 'Super Admin', value: 'super-admin' },
]

const fetchUsers = async () => {
  loading.value = true
  try {
    const response = await api.get('/users')
    users.value = response.data.data || []
    
    // Store initial roles for revert on cancel
    users.value.forEach(user => {
      oldRoles.value[user.id] = user.role
    })
  } catch (error) {
    console.error('Error fetching users:', error)
  } finally {
    loading.value = false
  }
}

const handleRoleChange = (userId, newRole, oldRole) => {
  // Show confirmation dialog
  confirmDialogData.value = { userId, newRole, oldRole }
  showConfirmDialog.value = true
}

const cancelRoleChange = () => {
  const { userId, oldRole } = confirmDialogData.value
  
  // Revert the select to old value
  const userIndex = users.value.findIndex(u => u.id === userId)
  if (userIndex !== -1) {
    users.value[userIndex].role = oldRole
  }
  
  showConfirmDialog.value = false
}

const confirmRoleChange = async () => {
  const { userId, newRole } = confirmDialogData.value
  showConfirmDialog.value = false
  
  updatingRoles.value[userId] = true
  try {
    const response = await api.patch(`/users/${userId}/role`, { role: newRole })
    
    // Update local data
    const userIndex = users.value.findIndex(u => u.id === userId)
    if (userIndex !== -1) {
      users.value[userIndex].role = newRole
      oldRoles.value[userId] = newRole
    }
    
    // Show success notification
    snackbarText.value = 'บทบาทผู้ใช้ถูกเปลี่ยนเรียบร้อยแล้ว'
    snackbarColor.value = 'success'
    snackbar.value = true
  } catch (error) {
    console.error('Error updating user role:', error)
    
    // Show error notification
    snackbarText.value = 'ไม่สามารถอัปเดต role ได้: ' + (error.response?.data?.message || error.message)
    snackbarColor.value = 'error'
    snackbar.value = true
    
    // Revert the change on error
    fetchUsers()
  } finally {
    updatingRoles.value[userId] = false
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-users"
              class="me-2"
            />
            รายการผู้ใช้งาน
          </VCardTitle>
          <VCardText>
            <div v-if="loading">
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VTable v-else-if="users.length > 0">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>อีเมล</th>
                  <th>แผนก</th>
                  <th>ตำแหน่ง</th>
                  <th>Role</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="user in users"
                  :key="user.id"
                >
                  <td>{{ user.name }}</td>
                  <td>{{ user.email }}</td>
                  <td>{{ user.department || 'N/A' }}</td>
                  <td>{{ user.position || 'N/A' }}</td>
                  <td>
                    <VSelect
                      v-model="user.role"
                      :items="roles"
                      item-title="title"
                      item-value="value"
                      density="compact"
                      variant="outlined"
                      :loading="updatingRoles[user.id]"
                      @update:model-value="(newValue) => handleRoleChange(user.id, newValue, oldRoles[user.id])"
                      :disabled="authStore.user?.id === user.id || authStore.user?.role !== 'super-admin'"
                    >
                      <template #selection="{ item }">
                        <VChip
                          :color="item.value === 'super-admin' ? 'error' : item.value === 'admin' ? 'warning' : 'info'"
                          size="small"
                        >
                          {{ item.title }}
                        </VChip>
                      </template>
                      <template #item="{ item, props: itemProps }">
                        <VListItem
                          v-bind="itemProps"
                          :title="item.title"
                        >
                          <template #prepend>
                            <VChip
                              :color="item.value === 'super-admin' ? 'error' : item.value === 'admin' ? 'warning' : 'info'"
                              size="small"
                              class="me-2"
                            >
                              {{ item.value }}
                            </VChip>
                          </template>
                        </VListItem>
                      </template>
                    </VSelect>
                  </td>
                  <td>
                    <VChip
                      :color="user.is_active ? 'success' : 'error'"
                      size="small"
                    >
                      {{ user.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน' }}
                    </VChip>
                  </td>
                </tr>
              </tbody>
            </VTable>
            <div
              v-else
              class="text-center py-8"
            >
              <VIcon
                size="64"
                icon="tabler-user-off"
                class="text-disabled mb-4"
              />
              <div class="text-h6 mb-2">
                ไม่มีผู้ใช้งาน
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Confirmation Dialog -->
    <VDialog
      v-model="showConfirmDialog"
      max-width="400"
    >
      <VCard>
        <VCardTitle class="text-h5">
          ยืนยันการเปลี่ยนบทบาท?
        </VCardTitle>
        <VCardText>
          คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนบทบาทผู้ใช้?
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            @click="cancelRoleChange"
          >
            ยกเลิก
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            @click="confirmRoleChange"
          >
            ตกลง
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Snackbar Notification -->
    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
    >
      {{ snackbarText }}
      <template #actions>
        <VBtn
          color="white"
          variant="text"
          @click="snackbar = false"
        >
          ปิด
        </VBtn>
      </template>
    </VSnackbar>
  </div>
</template>












