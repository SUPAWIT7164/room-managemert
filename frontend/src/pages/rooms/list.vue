<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const router = useRouter()
const loading = ref(false)
const rooms = ref([])
const search = ref('')
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

// Fetch rooms list
const fetchRoomList = async () => {
  loading.value = true
  try {
    const response = await api.get('/rooms')
    rooms.value = response.data.data || []
  } catch (error) {
    console.error('Fetch error:', error)
    showSnackbar('error', 'เกิดข้อผิดพลาดในการดึงข้อมูลห้อง')
  } finally {
    loading.value = false
  }
}

// Filtered rooms based on search
const filteredRooms = computed(() => {
  if (!search.value) return rooms.value
  
  const searchLower = search.value.toLowerCase()
  return rooms.value.filter(room => {
    return (
      room.name?.toLowerCase().includes(searchLower) ||
      room.building_name?.toLowerCase().includes(searchLower) ||
      room.area_name?.toLowerCase().includes(searchLower)
    )
  })
})

// Toggle automation
const toggleAutomation = async (room) => {
  const newValue = !room.automation
  
  const result = await showConfirm(
    newValue ? 'เปิดระบบอัตโนมัติ?' : 'ปิดระบบอัตโนมัติ?',
    newValue ? 'คุณต้องการเปิดระบบอัตโนมัติสำหรับห้องนี้หรือไม่?' : 'คุณต้องการปิดระบบอัตโนมัติสำหรับห้องนี้หรือไม่?'
  )
  
  if (result) {
    try {
      await api.post(`/rooms/${room.id}/automation`, { automation: newValue })
      room.automation = newValue
      showSnackbar('success', newValue ? 'เปิดระบบอัตโนมัติสำเร็จ' : 'ปิดระบบอัตโนมัติสำเร็จ')
    } catch (error) {
      console.error('Update error:', error)
      showSnackbar('error', 'เกิดข้อผิดพลาดในการอัปเดตสถานะ')
    }
  }
}

// Toggle auto-approve
const toggleAutoApprove = async (room) => {
  const newValue = !room.auto_approve
  
  const result = await showConfirm(
    newValue ? 'เปิดการอนุมัติอัตโนมัติ?' : 'ปิดการอนุมัติอัตโนมัติ?',
    newValue ? 'คุณต้องการเปิดการอนุมัติอัตโนมัติสำหรับห้องนี้หรือไม่?' : 'คุณต้องการปิดการอนุมัติอัตโนมัติสำหรับห้องนี้หรือไม่?'
  )
  
  if (result) {
    try {
      await api.post(`/rooms/${room.id}/auto-approve`, { auto_approve: newValue })
      room.auto_approve = newValue
      showSnackbar('success', newValue ? 'เปิดการอนุมัติอัตโนมัติสำเร็จ' : 'ปิดการอนุมัติอัตโนมัติสำเร็จ')
    } catch (error) {
      console.error('Update error:', error)
      showSnackbar('error', 'เกิดข้อผิดพลาดในการอัปเดตสถานะ')
    }
  }
}

// Edit room
const editRoom = (roomId) => {
  router.push({ name: 'rooms-edit', params: { id: roomId } })
}

// Delete room
const deleteRoom = async (room) => {
  const result = await showConfirm(
    'ยืนยันการลบ?',
    `คุณต้องการลบห้อง "${room.name}" หรือไม่?`
  )
  
  if (result) {
    try {
      await api.delete(`/rooms/${room.id}`)
      showSnackbar('success', 'ลบห้องสำเร็จ')
      fetchRoomList()
    } catch (error) {
      console.error('Delete error:', error)
      showSnackbar('error', 'เกิดข้อผิดพลาดในการลบห้อง')
    }
  }
}

// Manage approvers
const manageApprovers = (roomId) => {
  router.push({ name: 'rooms-approvers', params: { id: roomId } })
}

// Manage permissions
const managePermissions = (roomId) => {
  router.push({ name: 'rooms-permissions', params: { id: roomId } })
}

// Control door
const controlDoor = async (room, device, action) => {
  const result = await showConfirm(
    'ยืนยันการควบคุมประตู?',
    'คุณต้องการดำเนินการนี้หรือไม่?'
  )
  
  if (result) {
    try {
      const response = await api.post(`/rooms/${room.id}/control-door`, {
        device_id: device.id,
        action: action,
      })
      showSnackbar('success', response.data.message || 'ควบคุมประตูสำเร็จ')
    } catch (error) {
      console.error('Control error:', error)
      showSnackbar('error', 'เกิดข้อผิดพลาดในการควบคุมประตู')
    }
  }
}

// Helper to show confirmation dialog
const showConfirmDialog = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
let confirmResolve = null

const showConfirm = (title, message) => {
  return new Promise((resolve) => {
    confirmTitle.value = title
    confirmMessage.value = message
    confirmResolve = resolve
    showConfirmDialog.value = true
  })
}

const handleConfirm = () => {
  if (confirmResolve) {
    confirmResolve(true)
    confirmResolve = null
  }
  showConfirmDialog.value = false
}

const handleCancel = () => {
  if (confirmResolve) {
    confirmResolve(false)
    confirmResolve = null
  }
  showConfirmDialog.value = false
}

// Helper to show snackbar
const showSnackbar = (color, text) => {
  snackbarColor.value = color
  snackbarText.value = text
  snackbar.value = true
}

onMounted(() => {
  fetchRoomList()
})
</script>

<template>
  <div class="rooms-list-page">
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex justify-space-between align-center">
            <span>
              <VIcon
                icon="tabler-door"
                class="me-2"
              />
              รายการห้อง
            </span>
            <VBtn
              color="primary"
              :to="{ name: 'rooms-create' }"
            >
              <VIcon
                icon="tabler-plus"
                class="me-2"
              />
              เพิ่มห้อง
            </VBtn>
          </VCardTitle>
          
          <VDivider />
          
          <VCardText>
            <!-- Search -->
            <VRow class="mb-4">
              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="search"
                  label="ค้นหา"
                  prepend-inner-icon="tabler-search"
                  variant="outlined"
                  density="compact"
                  clearable
                />
              </VCol>
            </VRow>

            <!-- Loading State -->
            <div
              v-if="loading"
              class="text-center py-8"
            >
              <VProgressCircular
                indeterminate
                color="primary"
                size="64"
              />
            </div>

            <!-- Rooms List -->
            <div
              v-else-if="filteredRooms.length > 0"
              class="rooms-container"
            >
              <VCard
                v-for="room in filteredRooms"
                :key="room.id"
                class="mb-4"
                variant="outlined"
              >
                <VCardText>
                  <VRow>
                    <!-- Room Details -->
                    <VCol
                      cols="12"
                      md="3"
                    >
                      <div class="text-h6 mb-2">
                        <VIcon
                          icon="tabler-door"
                          size="20"
                          class="me-2"
                        />
                        {{ room.name }}
                      </div>
                      <div class="text-body-2 mb-1">
                        <VIcon
                          icon="tabler-users"
                          size="16"
                          class="me-1"
                        />
                        ที่นั่ง: {{ room.capacity || '-' }}
                      </div>
                      <div class="text-body-2 mb-1">
                        <VIcon
                          icon="tabler-building"
                          size="16"
                          class="me-1"
                        />
                        อาคาร: {{ room.building_name || '-' }}
                      </div>
                      <div class="text-body-2 mb-2">
                        <VIcon
                          icon="tabler-map"
                          size="16"
                          class="me-1"
                        />
                        พื้นที่: {{ room.area_name || '-' }}
                      </div>
                      <VChip
                        :color="room.disable ? 'error' : 'success'"
                        size="small"
                      >
                        {{ room.disable ? 'ไม่เปิดใช้งาน' : 'เปิดใช้งาน' }}
                      </VChip>
                    </VCol>

                    <!-- Settings -->
                    <VCol
                      cols="12"
                      md="2"
                    >
                      <div class="text-subtitle-2 mb-2">
                        การตั้งค่าอัตโนมัติ
                      </div>
                      <div class="mb-2">
                        <VCheckbox
                          :model-value="room.automation == 1 || room.automation === true"
                          label="ระบบอัตโนมัติ"
                          density="compact"
                          hide-details
                          @update:model-value="toggleAutomation(room)"
                        />
                      </div>
                      <div>
                        <VCheckbox
                          :model-value="room.auto_approve == 1 || room.auto_approve === true"
                          label="อนุมัติอัตโนมัติ"
                          density="compact"
                          hide-details
                          @update:model-value="toggleAutoApprove(room)"
                        />
                      </div>
                    </VCol>

                    <!-- Approvers -->
                    <VCol
                      cols="12"
                      md="2"
                    >
                      <div class="text-subtitle-2 mb-2">
                        ผู้อนุมัติ
                      </div>
                      <div v-if="room.approvers && room.approvers.length">
                        <VChip
                          v-for="(approver, index) in room.approvers.slice(0, 2)"
                          :key="index"
                          color="primary"
                          size="small"
                          class="me-1 mb-1"
                        >
                          {{ approver.user?.name || approver.name || 'N/A' }}
                        </VChip>
                        <VChip
                          v-if="room.approvers.length > 2"
                          color="default"
                          size="small"
                          class="mb-1"
                        >
                          +{{ room.approvers.length - 2 }}
                        </VChip>
                      </div>
                      <VChip
                        v-else
                        color="default"
                        size="small"
                      >
                        ไม่ได้กำหนด
                      </VChip>
                    </VCol>

                    <!-- Access Users -->
                    <VCol
                      cols="12"
                      md="2"
                    >
                      <div class="text-subtitle-2 mb-2">
                        ผู้เข้าได้ตลอดเวลา
                      </div>
                      <div v-if="room.access_users && room.access_users.length">
                        <VChip
                          v-for="(user, index) in room.access_users.slice(0, 2)"
                          :key="index"
                          color="warning"
                          size="small"
                          class="me-1 mb-1"
                        >
                          {{ user.name || 'N/A' }}
                        </VChip>
                        <VChip
                          v-if="room.access_users.length > 2"
                          color="default"
                          size="small"
                          class="mb-1"
                        >
                          +{{ room.access_users.length - 2 }}
                        </VChip>
                      </div>
                      <VChip
                        v-else
                        color="default"
                        size="small"
                      >
                        ไม่มี
                      </VChip>
                    </VCol>

                    <!-- Actions -->
                    <VCol
                      cols="12"
                      md="3"
                    >
                      <div class="text-subtitle-2 mb-2">
                        การกระทำ
                      </div>
                      <div class="d-flex flex-wrap gap-1">
                        <VBtn
                          color="primary"
                          size="small"
                          variant="flat"
                          @click="editRoom(room.id)"
                        >
                          แก้ไข
                        </VBtn>
                        <VBtn
                          color="error"
                          size="small"
                          variant="flat"
                          @click="deleteRoom(room)"
                        >
                          ลบ
                        </VBtn>
                        <VBtn
                          color="secondary"
                          size="small"
                          variant="flat"
                          @click="manageApprovers(room.id)"
                        >
                          จัดการผู้อนุมัติ
                        </VBtn>
                        <VBtn
                          color="default"
                          size="small"
                          variant="outlined"
                          @click="managePermissions(room.id)"
                        >
                          จัดการสิทธิ์พิเศษ
                        </VBtn>
                      </div>

                      <!-- Door Controls -->
                      <div
                        v-if="room.devices && room.devices.length"
                        class="mt-2"
                      >
                        <div
                          v-for="device in room.devices"
                          :key="device.id"
                          class="d-flex flex-wrap gap-1 mt-1"
                        >
                          <VBtn
                            color="success"
                            size="x-small"
                            variant="outlined"
                            @click="controlDoor(room, device, 'open')"
                          >
                            เปิดประตู{{ device.name && device.name.includes('หน้า') ? 'หน้า' : device.name && device.name.includes('หลัง') ? 'หลัง' : '' }}
                          </VBtn>
                          <VBtn
                            color="warning"
                            size="x-small"
                            variant="outlined"
                            @click="controlDoor(room, device, 'close')"
                          >
                            ปิดประตู{{ device.name && device.name.includes('หน้า') ? 'หน้า' : device.name && device.name.includes('หลัง') ? 'หลัง' : '' }}
                          </VBtn>
                        </div>
                      </div>
                    </VCol>
                  </VRow>
                </VCardText>
              </VCard>
            </div>

            <!-- Empty State -->
            <div
              v-else
              class="text-center py-8"
            >
              <VIcon
                size="64"
                icon="tabler-door-off"
                class="text-disabled mb-4"
              />
              <div class="text-h6 mb-2">
                ไม่มีห้อง
              </div>
              <VBtn
                color="primary"
                variant="outlined"
                :to="{ name: 'rooms-create' }"
              >
                <VIcon
                  icon="tabler-plus"
                  class="me-2"
                />
                สร้างห้องใหม่
              </VBtn>
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
          {{ confirmTitle }}
        </VCardTitle>
        <VCardText>
          {{ confirmMessage }}
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            @click="handleCancel"
          >
            ยกเลิก
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            @click="handleConfirm"
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

<style scoped>
.rooms-list-page {
  padding: 0;
}

.rooms-container {
  /* Removed fixed max-height to allow content to define height */
  overflow-y: auto;
}
</style>
