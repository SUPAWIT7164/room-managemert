<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const authStore = useAuthStore()
const loading = ref(false)
const stats = ref({
  todayBookingsCount: 0,
  pendingBookings: 0,
  rooms: 0,
  todayVisitors: 0,
  todayBookings: [],
  roomAvailability: [],
})

const fetchDashboardData = async () => {
  loading.value = true
  try {
    const response = await api.get('/dashboard/stats')
    stats.value = response.data.data || stats.value
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
  } finally {
    loading.value = false
  }
}

// Format time helper function
const formatTime = (time) => {
  if (!time) return 'N/A'
  
  try {
    // Handle different time formats
    let timeStr = time
    
    // If it's a datetime string, extract time part
    if (timeStr.includes('T') || timeStr.includes(' ')) {
      const parts = timeStr.split(/[T ]/)
      timeStr = parts[parts.length - 1].split('.')[0] // Get time part and remove milliseconds
    }
    
    // Validate time format (HH:mm or HH:mm:ss)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/
    if (!timeRegex.test(timeStr)) {
      return 'N/A'
    }
    
    // Create date object and format
    const date = new Date(`2000-01-01 ${timeStr}`)
    if (isNaN(date.getTime())) {
      return 'N/A'
    }
    
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    console.error('Error formatting time:', time, error)
    return 'N/A'
  }
}

// Format datetime helper function
const formatDateTime = (datetime) => {
  if (!datetime) return 'N/A'
  
  try {
    const date = new Date(datetime)
    if (isNaN(date.getTime())) {
      return 'N/A'
    }
    
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    console.error('Error formatting datetime:', datetime, error)
    return 'N/A'
  }
}

const statusLabel = status => {
  const labels = {
    approved: 'อนุมัติ',
    pending: 'รออนุมัติ',
    rejected: 'ปฏิเสธ',
    cancelled: 'ยกเลิก',
  }
  return labels[status] || status
}

onMounted(() => {
  fetchDashboardData()
})
</script>

<template>
  <div>
    <VRow>
      <!-- Stats Cards -->
      <VCol
        cols="12"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center">
              <VAvatar
                color="primary"
                variant="tonal"
                size="56"
              >
                <VIcon
                  size="28"
                  icon="tabler-calendar-check"
                />
              </VAvatar>
              <div class="ms-4">
                <div class="text-h4 font-weight-bold">
                  {{ stats.todayBookingsCount || 0 }}
                </div>
                <div class="text-body-2">
                  การจองวันนี้
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center">
              <VAvatar
                color="warning"
                variant="tonal"
                size="56"
              >
                <VIcon
                  size="28"
                  icon="tabler-hourglass"
                />
              </VAvatar>
              <div class="ms-4">
                <div class="text-h4 font-weight-bold">
                  {{ stats.pendingBookings || 0 }}
                </div>
                <div class="text-body-2">
                  รออนุมัติ
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center">
              <VAvatar
                color="success"
                variant="tonal"
                size="56"
              >
                <VIcon
                  size="28"
                  icon="tabler-door"
                />
              </VAvatar>
              <div class="ms-4">
                <div class="text-h4 font-weight-bold">
                  {{ stats.rooms || 0 }}
                </div>
                <div class="text-body-2">
                  ห้องทั้งหมด
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center">
              <VAvatar
                color="info"
                variant="tonal"
                size="56"
              >
                <VIcon
                  size="28"
                  icon="tabler-users"
                />
              </VAvatar>
              <div class="ms-4">
                <div class="text-h4 font-weight-bold">
                  {{ stats.todayVisitors || 0 }}
                </div>
                <div class="text-body-2">
                  ผู้เยี่ยมชมวันนี้
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Today's Bookings -->
      <VCol
        cols="12"
        md="8"
      >
        <VCard>
          <VCardTitle class="d-flex justify-space-between align-center">
            <span>การจองวันนี้</span>
            <VBtn
              variant="text"
              size="small"
              :to="{ name: 'bookings-calendar' }"
            >
              ดูทั้งหมด
            </VBtn>
          </VCardTitle>
          <VCardText>
            <VTable v-if="stats.todayBookings && stats.todayBookings.length > 0">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>หัวข้อ</th>
                  <th>ห้อง</th>
                  <th>ผู้จอง</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="booking in stats.todayBookings"
                  :key="booking.id"
                >
                  <td>
                    <span v-if="booking.start_datetime && booking.end_datetime">
                      {{ formatDateTime(booking.start_datetime) }} - {{ formatDateTime(booking.end_datetime) }}
                    </span>
                    <span v-else>
                      {{ formatTime(booking.start_time) }} - {{ formatTime(booking.end_time) }}
                    </span>
                  </td>
                  <td>{{ booking.title || booking.name || 'N/A' }}</td>
                  <td>{{ booking.room_name || booking.room || 'N/A' }}</td>
                  <td>{{ booking.booker_name || booking.booker || 'N/A' }}</td>
                  <td>
                    <VChip
                      :color="booking.status === 'approved' ? 'success' : booking.status === 'pending' ? 'warning' : 'error'"
                      size="small"
                    >
                      {{ statusLabel(booking.status) }}
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
                icon="tabler-calendar-x"
                class="text-disabled mb-4"
              />
              <div class="text-h6 mb-2">
                ไม่มีการจองวันนี้
              </div>
              <div class="text-body-2 text-disabled">
                ยังไม่มีการจองห้องประชุมในวันนี้
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Quick Actions -->
      <VCol
        cols="12"
        md="4"
      >
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-bolt"
              class="me-2"
            />
            เมนูลัด
          </VCardTitle>
          <VCardText>
            <div class="d-flex flex-column gap-3">
              <VBtn
                color="primary"
                block
                :to="{ name: 'bookings-create' }"
              >
                <VIcon
                  icon="tabler-plus"
                  class="me-2"
                />
                จองห้องประชุม
              </VBtn>
              <VBtn
                variant="outlined"
                color="primary"
                block
                :to="{ name: 'rooms-list' }"
              >
                <VIcon
                  icon="tabler-door"
                  class="me-2"
                />
                ดูห้องทั้งหมด
              </VBtn>
              <VBtn
                variant="outlined"
                color="secondary"
                block
                :to="{ name: 'bookings-calendar' }"
              >
                <VIcon
                  icon="tabler-bookmark"
                  class="me-2"
                />
                การจองของฉัน
              </VBtn>
              <VBtn
                variant="outlined"
                color="info"
                block
                :to="{ name: 'bookings-calendar' }"
              >
                <VIcon
                  icon="tabler-calendar"
                  class="me-2"
                />
                ดูปฏิทิน
              </VBtn>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Room Availability (Admin) -->
      <VCol
        v-if="authStore.isAdmin"
        cols="12"
      >
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-grid"
              class="me-2"
            />
            สถานะห้องประชุม
          </VCardTitle>
          <VCardText>
            <VRow v-if="stats.roomAvailability && stats.roomAvailability.length > 0">
              <VCol
                v-for="room in stats.roomAvailability"
                :key="room.id"
                cols="12"
                sm="6"
                md="4"
                lg="3"
              >
                <VCard
                  :border="room.isAvailable ? 'success' : 'error'"
                  variant="outlined"
                >
                  <VCardText>
                    <div class="d-flex justify-space-between align-start mb-2">
                      <div class="text-h6">
                        {{ room.name }}
                      </div>
                      <VChip
                        :color="room.isAvailable ? 'success' : 'error'"
                        size="small"
                      >
                        {{ room.isAvailable ? 'ว่าง' : 'ไม่ว่าง' }}
                      </VChip>
                    </div>
                    <div class="text-body-2 text-disabled">
                      {{ room.building_name }} - {{ room.area_name }}
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>
            <div
              v-else
              class="text-center py-4"
            >
              <div class="text-body-2 text-disabled">
                ไม่มีข้อมูลห้องประชุม
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>



