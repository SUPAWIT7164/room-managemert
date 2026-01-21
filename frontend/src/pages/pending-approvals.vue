<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
    approver: true,
  },
})

const authStore = useAuthStore()
const loading = ref(false)
const bookings = ref([])

const fetchPendingApprovals = async () => {
  loading.value = true
  try {
    const response = await api.get('/bookings', {
      params: {
        status: 'pending',
      },
    })
    bookings.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching pending approvals:', error)
  } finally {
    loading.value = false
  }
}

const approveBooking = async (id) => {
  try {
    await api.post(`/bookings/${id}/approve`)
    fetchPendingApprovals()
  } catch (error) {
    console.error('Error approving booking:', error)
  }
}

const rejectBooking = async (id) => {
  try {
    await api.post(`/bookings/${id}/reject`)
    fetchPendingApprovals()
  } catch (error) {
    console.error('Error rejecting booking:', error)
  }
}

onMounted(() => {
  fetchPendingApprovals()
})
</script>

<template>
  <div>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-hourglass"
              class="me-2"
            />
            รออนุมัติ
          </VCardTitle>
          <VCardText>
            <div v-if="loading">
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VTable v-else-if="bookings.length > 0">
              <thead>
                <tr>
                  <th>หัวข้อ</th>
                  <th>ห้อง</th>
                  <th>วันที่</th>
                  <th>เวลา</th>
                  <th>ผู้จอง</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="booking in bookings"
                  :key="booking.id"
                >
                  <td>{{ booking.title }}</td>
                  <td>{{ booking.room_name || 'N/A' }}</td>
                  <td>{{ new Date(booking.start_datetime).toLocaleDateString('th-TH') }}</td>
                  <td>
                    {{ new Date(booking.start_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }}
                    -
                    {{ new Date(booking.end_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }}
                  </td>
                  <td>{{ booking.booker_name || 'N/A' }}</td>
                  <td>
                    <VBtn
                      color="success"
                      size="small"
                      class="me-2"
                      @click="approveBooking(booking.id)"
                    >
                      อนุมัติ
                    </VBtn>
                    <VBtn
                      color="error"
                      size="small"
                      @click="rejectBooking(booking.id)"
                    >
                      ปฏิเสธ
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
                icon="tabler-check"
                class="text-success mb-4"
              />
              <div class="text-h6 mb-2">
                ไม่มีการจองที่รออนุมัติ
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
















