<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const REFRESH_INTERVAL_MS = 0 // ปิด auto-refresh (เดิม 10 * 1000 = ทุก 10 วินาที)

const router = useRouter()

const loading = ref(false)
const devices = ref([])
const showDeleteDialog = ref(false)
const deleteDialogData = ref({ id: null, name: null })
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')
let refreshTimer = null

const fetchDevices = async () => {
  loading.value = true
  try {
    const response = await api.get('/devices')
    devices.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching devices:', error)
    showSnackbar('error', 'ไม่สามารถโหลดข้อมูลอุปกรณ์ได้')
  } finally {
    loading.value = false
  }
}

/** รีเฟรชสถานะอุปกรณ์ใน DB (sync จาก HA) แล้วโหลดรายการใหม่ */
const refreshDeviceStatus = async () => {
  try {
    await api.post('/devices/sync/all')
  } catch (err) {
    console.warn('Device sync (DB) failed:', err?.message || err)
  }
  await fetchDevices()
}

const handleEdit = async (device) => {
  try {
    // Try to navigate to edit page if it exists
    await router.push({ name: 'devices-edit', params: { id: device.id } })
  } catch (error) {
    // If edit route doesn't exist, show message
    showSnackbar('warning', 'หน้าจัดการแก้ไขอุปกรณ์ยังไม่พร้อมใช้งาน')
  }
}

const handleDelete = (device) => {
  deleteDialogData.value = { id: device.id, name: device.name || 'อุปกรณ์' }
  showDeleteDialog.value = true
}

const cancelDelete = () => {
  showDeleteDialog.value = false
  deleteDialogData.value = { id: null, name: null }
}

const confirmDelete = async () => {
  const { id } = deleteDialogData.value
  showDeleteDialog.value = false
  
  try {
    await api.delete(`/devices/${id}`)
    showSnackbar('success', 'ลบอุปกรณ์เรียบร้อยแล้ว')
    await fetchDevices() // Reload devices list
  } catch (error) {
    console.error('Error deleting device:', error)
    showSnackbar('error', 'การลบอุปกรณ์ล้มเหลว: ' + (error.response?.data?.message || error.message))
  } finally {
    deleteDialogData.value = { id: null, name: null }
  }
}

const showSnackbar = (color, text) => {
  snackbarColor.value = color
  snackbarText.value = text
  snackbar.value = true
}

/** แสดงค่า X: ถ้าเก็บเป็น "x1,x2" จะแสดง "x1 , x2" (ทศนิยม 4 ตำแหน่ง) */
const formatX = (val) => {
  if (val == null || val === '') return '-'
  const s = String(val).trim()
  if (s.includes(',')) {
    const parts = s.split(',').map(p => Number(p.trim()))
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      return `${Number(parts[0]).toFixed(4)} , ${Number(parts[1]).toFixed(4)}`
    }
  }
  const n = Number(s)
  return Number.isNaN(n) ? s : Number(n).toFixed(4)
}

/** แสดงค่า Y: ถ้าเก็บเป็น "y1,y2" จะแสดง "y1 , y2" (ทศนิยม 4 ตำแหน่ง) */
const formatY = (val) => {
  if (val == null || val === '') return '-'
  const s = String(val).trim()
  if (s.includes(',')) {
    const parts = s.split(',').map(p => Number(p.trim()))
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      return `${Number(parts[0]).toFixed(4)} , ${Number(parts[1]).toFixed(4)}`
    }
  }
  const n = Number(s)
  return Number.isNaN(n) ? s : Number(n).toFixed(4)
}

onMounted(() => {
  fetchDevices()
  if (REFRESH_INTERVAL_MS > 0) {
    refreshTimer = setInterval(refreshDeviceStatus, REFRESH_INTERVAL_MS)
  }
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<template>
  <div>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-device-desktop"
              class="me-2"
            />
            รายการอุปกรณ์
          </VCardTitle>
          <VCardText>
            <div v-if="loading" class="text-center py-8">
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <div
              v-else-if="devices.length > 0"
              class="table-responsive"
            >
            <VTable class="text-no-wrap">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่ออุปกรณ์</th>
                  <th>IP Address</th>
                  <th>ประเภท</th>
                  <th>ห้อง</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>สถานะ</th>
                  <th class="text-end">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="device in devices"
                  :key="device.id"
                >
                  <td>{{ device.id }}</td>
                  <td>{{ device.name || '-' }}</td>
                  <td>{{ device.ip || device.device_id || '-' }}</td>
                  <td>{{ device.device_category || device.type || '-' }}</td>
                  <td>{{ device.room_name || '-' }}</td>
                  <td>{{ formatX(device.x) }}</td>
                  <td>{{ formatY(device.y) }}</td>
                  <td>
                    <VChip
                      :color="(device.status === 'active' && !device.disable) || device.is_active ? 'success' : 'error'"
                      size="small"
                    >
                      {{ (device.status === 'active' && !device.disable) || device.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน' }}
                    </VChip>
                  </td>
                  <td class="text-end">
                    <VBtn
                      color="warning"
                      size="small"
                      variant="flat"
                      class="me-2"
                      @click="handleEdit(device)"
                    >
                      <VIcon
                        icon="tabler-edit"
                        size="18"
                      />
                    </VBtn>
                    <VBtn
                      color="error"
                      size="small"
                      variant="flat"
                      @click="handleDelete(device)"
                    >
                      <VIcon
                        icon="tabler-trash"
                        size="18"
                      />
                    </VBtn>
                  </td>
                </tr>
              </tbody>
            </VTable>
            </div>
            <div
              v-else
              class="text-center py-8"
            >
              <VIcon
                size="64"
                icon="tabler-device-off"
                class="text-disabled mb-4"
              />
              <div class="text-h6 mb-2">
                ไม่มีอุปกรณ์
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Delete Confirmation Dialog -->
    <VDialog
      v-model="showDeleteDialog"
      max-width="400"
    >
      <VCard>
        <VCardTitle class="text-h5">
          คุณแน่ใจหรือไม่?
        </VCardTitle>
        <VCardText>
          คุณจะไม่สามารถกู้คืนอุปกรณ์ "{{ deleteDialogData.name }}" ได้!
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            color="grey"
            variant="text"
            @click="cancelDelete"
          >
            ยกเลิก
          </VBtn>
          <VBtn
            color="error"
            variant="elevated"
            @click="confirmDelete"
          >
            ใช่, ลบเลย!
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
