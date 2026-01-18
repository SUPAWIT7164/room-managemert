<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const loading = ref(false)
const devices = ref([])

const fetchDevices = async () => {
  loading.value = true
  try {
    const response = await api.get('/devices')
    devices.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching devices:', error)
  } finally {
    loading.value = false
  }
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
            <div v-if="loading">
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VTable v-else-if="devices.length > 0">
              <thead>
                <tr>
                  <th>ชื่ออุปกรณ์</th>
                  <th>ประเภท</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="device in devices"
                  :key="device.id"
                >
                  <td>{{ device.name }}</td>
                  <td>{{ device.type || 'N/A' }}</td>
                  <td>
                    <VChip
                      :color="device.status === 'active' ? 'success' : 'error'"
                      size="small"
                    >
                      {{ device.status }}
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
  </div>
</template>












