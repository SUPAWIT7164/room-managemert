<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const router = useRouter()

const loading = ref(false)
const devices = ref([])
const showDeleteDialog = ref(false)
const deleteDialogData = ref({ id: null, name: null })
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

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

onMounted(() => {
  fetchDevices()
})
</script>

<template>
  <div>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex justify-space-between align-center">
            <span>
              <VIcon
                icon="tabler-device-desktop"
                class="me-2"
              />
              รายการอุปกรณ์
            </span>
            <VBtn
              color="primary"
              :to="{ name: 'devices-create' }"
            >
              <VIcon
                icon="tabler-plus"
                class="me-2"
              />
              สร้างอุปกรณ์ใหม่
            </VBtn>
          </VCardTitle>
          <VCardText>
            <div v-if="loading" class="text-center py-8">
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VTable
              v-else-if="devices.length > 0"
              class="text-no-wrap"
            >
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่ออุปกรณ์</th>
                  <th>รหัสอุปกรณ์</th>
                  <th>ประเภท</th>
                  <th>ห้อง</th>
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
                  <td>{{ device.device_id || '-' }}</td>
                  <td>{{ device.type || '-' }}</td>
                  <td>{{ device.room_name || '-' }}</td>
                  <td>
                    <VChip
                      :color="device.is_active ? 'success' : 'error'"
                      size="small"
                    >
                      {{ device.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน' }}
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
              <VBtn
                color="primary"
                variant="outlined"
                :to="{ name: 'devices-create' }"
              >
                <VIcon
                  icon="tabler-plus"
                  class="me-2"
                />
                สร้างอุปกรณ์ใหม่
              </VBtn>
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
