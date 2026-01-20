<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const loading = ref(false)
const areas = ref([])

const fetchAreas = async () => {
  loading.value = true
  try {
    const response = await api.get('/areas')
    areas.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching areas:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAreas()
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
                icon="tabler-map"
                class="me-2"
              />
              รายการพื้นที่
            </span>
            <VBtn
              color="primary"
              :to="{ name: 'areas-create' }"
            >
              <VIcon
                icon="tabler-plus"
                class="me-2"
              />
              สร้างพื้นที่ใหม่
            </VBtn>
          </VCardTitle>
          <VCardText>
            <div v-if="loading">
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VTable v-else-if="areas.length > 0">
              <thead>
                <tr>
                  <th>ชื่อพื้นที่</th>
                  <th>อาคาร</th>
                  <th>ชั้น</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="area in areas"
                  :key="area.id"
                >
                  <td>{{ area.name }}</td>
                  <td>{{ area.building_name || 'N/A' }}</td>
                  <td>{{ area.floor || 'N/A' }}</td>
                  <td>
                    <VChip
                      :color="area.disable ? 'error' : 'success'"
                      size="small"
                    >
                      {{ area.disable ? 'ปิดใช้งาน' : 'เปิดใช้งาน' }}
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
                icon="tabler-map-off"
                class="text-disabled mb-4"
              />
              <div class="text-h6 mb-2">
                ไม่มีพื้นที่
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>















