<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const loading = ref(false)
const visitors = ref([])

const fetchVisitors = async () => {
  loading.value = true
  try {
    const response = await api.get('/visitors')
    visitors.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching visitors:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchVisitors()
})
</script>

<template>
  <div>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-user-plus"
              class="me-2"
            />
            รายการผู้เยี่ยมชม
          </VCardTitle>
          <VCardText>
            <div v-if="loading">
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VTable v-else-if="visitors.length > 0">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>อีเมล</th>
                  <th>เบอร์โทร</th>
                  <th>วันที่เยี่ยมชม</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="visitor in visitors"
                  :key="visitor.id"
                >
                  <td>{{ visitor.name }}</td>
                  <td>{{ visitor.email || 'N/A' }}</td>
                  <td>{{ visitor.phone || 'N/A' }}</td>
                  <td>{{ visitor.visit_date ? new Date(visitor.visit_date).toLocaleDateString('th-TH') : 'N/A' }}</td>
                  <td>
                    <VChip
                      :color="visitor.status === 'approved' ? 'success' : visitor.status === 'pending' ? 'warning' : 'error'"
                      size="small"
                    >
                      {{ visitor.status }}
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
                ไม่มีผู้เยี่ยมชม
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
















