<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const loading = ref(false)
const rooms = ref([])

const fetchRooms = async () => {
  loading.value = true
  try {
    const response = await api.get('/rooms')
    rooms.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching rooms:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchRooms()
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
              สร้างห้องใหม่
            </VBtn>
          </VCardTitle>
          <VCardText>
            <div v-if="loading">
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VTable v-else-if="rooms.length > 0">
              <thead>
                <tr>
                  <th>ชื่อห้อง</th>
                  <th>อาคาร</th>
                  <th>พื้นที่</th>
                  <th>ความจุ</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="room in rooms"
                  :key="room.id"
                >
                  <td>{{ room.name }}</td>
                  <td>{{ room.building_name || 'N/A' }}</td>
                  <td>{{ room.area_name || 'N/A' }}</td>
                  <td>{{ room.capacity }}</td>
                  <td>
                    <VChip
                      :color="room.disable ? 'error' : 'success'"
                      size="small"
                    >
                      {{ room.disable ? 'ปิดใช้งาน' : 'เปิดใช้งาน' }}
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
                icon="tabler-door-off"
                class="text-disabled mb-4"
              />
              <div class="text-h6 mb-2">
                ไม่มีห้อง
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>












