<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const loading = ref(false)
const buildings = ref([])

const fetchBuildings = async () => {
  loading.value = true
  try {
    const response = await api.get('/buildings')
    buildings.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching buildings:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchBuildings()
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
                icon="tabler-building"
                class="me-2"
              />
              รายการอาคาร
            </span>
            <VBtn
              color="primary"
              :to="{ name: 'buildings-create' }"
            >
              <VIcon
                icon="tabler-plus"
                class="me-2"
              />
              สร้างอาคารใหม่
            </VBtn>
          </VCardTitle>
          <VCardText>
            <div v-if="loading">
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VTable v-else-if="buildings.length > 0">
              <thead>
                <tr>
                  <th>ชื่ออาคาร</th>
                  <th>รหัส</th>
                  <th>ที่อยู่</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="building in buildings"
                  :key="building.id"
                >
                  <td>{{ building.name }}</td>
                  <td>{{ building.code || 'N/A' }}</td>
                  <td>{{ building.address || 'N/A' }}</td>
                  <td>
                    <VChip
                      :color="building.disable ? 'error' : 'success'"
                      size="small"
                    >
                      {{ building.disable ? 'ปิดใช้งาน' : 'เปิดใช้งาน' }}
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
                icon="tabler-building-off"
                class="text-disabled mb-4"
              />
              <div class="text-h6 mb-2">
                ไม่มีอาคาร
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
















