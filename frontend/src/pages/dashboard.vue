<script setup>
import { ref, onMounted, computed } from 'vue'
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
    let timeStr = time
    
    if (timeStr.includes('T') || timeStr.includes(' ')) {
      const parts = timeStr.split(/[T ]/)
      timeStr = parts[parts.length - 1].split('.')[0]
    }
    
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/
    if (!timeRegex.test(timeStr)) {
      return 'N/A'
    }
    
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
    console.error('Error formatting datetime:', error)
    return 'N/A'
  }
}

// Format date helper
const formatDate = (datetime) => {
  if (!datetime) return ''
  try {
    const date = new Date(datetime)
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
    })
  } catch (error) {
    return ''
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

const statusColor = status => {
  const colors = {
    approved: 'success',
    pending: 'warning',
    rejected: 'error',
    cancelled: 'error',
  }
  return colors[status] || 'default'
}

onMounted(() => {
  fetchDashboardData()
})
</script>

<template>
  <div class="dashboard-container">
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">
        ภาพรวมระบบ
      </h1>
      <p class="text-body-1 text-medium-emphasis">
        ข้อมูลสรุปการใช้งานระบบจองห้องประชุม
      </p>
    </div>

    <VRow>
      <!-- Stats Cards with Enhanced Design -->
      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <VCard
          class="stats-card stats-card-primary"
          elevation="2"
          :loading="loading"
        >
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <div class="flex-grow-1">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  การจองวันนี้
                </div>
                <div class="text-h3 font-weight-bold mb-1">
                  {{ stats.todayBookingsCount || 0 }}
                </div>
                <div class="text-caption text-success">
                  <VIcon
                    size="14"
                    icon="tabler-trending-up"
                    class="me-1"
                  />
                  รายการ
                </div>
              </div>
              <VAvatar
                size="64"
                color="primary"
                variant="tonal"
                class="stats-icon"
              >
                <VIcon
                  size="32"
                  icon="tabler-calendar-check"
                />
              </VAvatar>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <VCard
          class="stats-card stats-card-warning"
          elevation="2"
          :loading="loading"
        >
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <div class="flex-grow-1">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  รออนุมัติ
                </div>
                <div class="text-h3 font-weight-bold mb-1">
                  {{ stats.pendingBookings || 0 }}
                </div>
                <div class="text-caption text-warning">
                  <VIcon
                    size="14"
                    icon="tabler-clock"
                    class="me-1"
                  />
                  ต้องตรวจสอบ
                </div>
              </div>
              <VAvatar
                size="64"
                color="warning"
                variant="tonal"
                class="stats-icon"
              >
                <VIcon
                  size="32"
                  icon="tabler-hourglass"
                />
              </VAvatar>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <VCard
          class="stats-card stats-card-success"
          elevation="2"
          :loading="loading"
        >
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <div class="flex-grow-1">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  ห้องทั้งหมด
                </div>
                <div class="text-h3 font-weight-bold mb-1">
                  {{ stats.rooms || 0 }}
                </div>
                <div class="text-caption text-success">
                  <VIcon
                    size="14"
                    icon="tabler-door"
                    class="me-1"
                  />
                  ห้อง
                </div>
              </div>
              <VAvatar
                size="64"
                color="success"
                variant="tonal"
                class="stats-icon"
              >
                <VIcon
                  size="32"
                  icon="tabler-door"
                />
              </VAvatar>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <VCard
          class="stats-card stats-card-info"
          elevation="2"
          :loading="loading"
        >
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <div class="flex-grow-1">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  ผู้เยี่ยมชมวันนี้
                </div>
                <div class="text-h3 font-weight-bold mb-1">
                  {{ stats.todayVisitors || 0 }}
                </div>
                <div class="text-caption text-info">
                  <VIcon
                    size="14"
                    icon="tabler-users"
                    class="me-1"
                  />
                  คน
                </div>
              </div>
              <VAvatar
                size="64"
                color="info"
                variant="tonal"
                class="stats-icon"
              >
                <VIcon
                  size="32"
                  icon="tabler-users"
                />
              </VAvatar>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Today's Bookings - Enhanced -->
      <VCol
        cols="12"
        lg="8"
      >
        <VCard
          class="bookings-card"
          elevation="2"
          :loading="loading"
        >
          <VCardTitle class="d-flex justify-space-between align-center pa-6 pb-4">
            <div class="d-flex align-center">
              <VAvatar
                color="primary"
                variant="tonal"
                size="40"
                class="me-3"
              >
                <VIcon
                  icon="tabler-calendar-event"
                  size="20"
                />
              </VAvatar>
              <div>
                <div class="text-h6 font-weight-bold">
                  การจองวันนี้
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
                </div>
              </div>
            </div>
            <VBtn
              variant="text"
              size="small"
              prepend-icon="tabler-arrow-right"
              :to="{ name: 'bookings-avaliable' }"
            >
              ดูทั้งหมด
            </VBtn>
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-0">
            <div v-if="stats.todayBookings && stats.todayBookings.length > 0">
              <VList
                lines="two"
                class="pa-0"
              >
                <VListItem
                  v-for="booking in stats.todayBookings"
                  :key="booking.id"
                  class="booking-item"
                >
                  <template #prepend>
                    <VAvatar
                      :color="statusColor(booking.status)"
                      variant="tonal"
                      size="48"
                      class="me-4"
                    >
                      <VIcon
                        :icon="booking.status === 'approved' ? 'tabler-check' : booking.status === 'pending' ? 'tabler-clock' : 'tabler-x'"
                        size="24"
                      />
                    </VAvatar>
                  </template>
                  <VListItemTitle class="text-h6 mb-1">
                    {{ booking.title || booking.name || 'N/A' }}
                  </VListItemTitle>
                  <VListItemSubtitle>
                    <div class="d-flex flex-wrap align-center gap-2 mt-1">
                      <VChip
                        :color="statusColor(booking.status)"
                        size="small"
                        variant="tonal"
                      >
                        {{ statusLabel(booking.status) }}
                      </VChip>
                      <span class="text-body-2 text-medium-emphasis">
                        <VIcon
                          size="16"
                          icon="tabler-door"
                          class="me-1"
                        />
                        {{ booking.room_name || booking.room || 'N/A' }}
                      </span>
                      <span class="text-body-2 text-medium-emphasis">
                        <VIcon
                          size="16"
                          icon="tabler-clock"
                          class="me-1"
                        />
                        <span v-if="booking.start_datetime && booking.end_datetime">
                          {{ formatDateTime(booking.start_datetime) }} - {{ formatDateTime(booking.end_datetime) }}
                        </span>
                        <span v-else>
                          {{ formatTime(booking.start_time) }} - {{ formatTime(booking.end_time) }}
                        </span>
                      </span>
                      <span class="text-body-2 text-medium-emphasis">
                        <VIcon
                          size="16"
                          icon="tabler-user"
                          class="me-1"
                        />
                        {{ booking.booker_name || booking.booker || 'N/A' }}
                      </span>
                    </div>
                  </VListItemSubtitle>
                  <VDivider
                    v-if="booking !== stats.todayBookings[stats.todayBookings.length - 1]"
                    class="mt-3"
                  />
                </VListItem>
              </VList>
            </div>
            <div
              v-else
              class="text-center py-12"
            >
              <VAvatar
                size="80"
                color="grey-lighten-4"
                class="mb-4"
              >
                <VIcon
                  size="40"
                  icon="tabler-calendar-x"
                  color="grey"
                />
              </VAvatar>
              <div class="text-h6 font-weight-medium mb-2">
                ไม่มีการจองวันนี้
              </div>
              <div class="text-body-2 text-medium-emphasis">
                ยังไม่มีการจองห้องประชุมในวันนี้
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Quick Actions Sidebar -->
      <VCol
        cols="12"
        lg="4"
      >
        <!-- Quick Actions Card -->
        <VCard
          class="mt-4"
          elevation="2"
        >
          <VCardTitle class="d-flex align-center pa-6 pb-4">
            <VIcon
              icon="tabler-bolt"
              class="me-2"
            />
            เมนูลัด
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-6">
            <div class="d-flex flex-column gap-3">
              <VBtn
                variant="outlined"
                color="primary"
                block
                size="large"
                prepend-icon="tabler-door"
                :to="{ name: 'rooms-list' }"
              >
                ดูห้องทั้งหมด
              </VBtn>
              <VBtn
                variant="outlined"
                color="secondary"
                block
                size="large"
                prepend-icon="tabler-bookmark"
                :to="{ name: 'bookings-avaliable' }"
              >
                การจองของฉัน
              </VBtn>
              <VBtn
                variant="outlined"
                color="info"
                block
                size="large"
                prepend-icon="tabler-calendar"
                :to="{ name: 'bookings-avaliable' }"
              >
                ตารางห้องว่าง
              </VBtn>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Room Availability (Admin) - Enhanced -->
      <VCol
        v-if="authStore.isAdmin"
        cols="12"
      >
        <VCard
          class="room-availability-card"
          elevation="2"
        >
          <VCardTitle class="d-flex justify-space-between align-center pa-6 pb-4">
            <div class="d-flex align-center">
              <VAvatar
                color="primary"
                variant="tonal"
                size="40"
                class="me-3"
              >
                <VIcon
                  icon="tabler-grid"
                  size="20"
                />
              </VAvatar>
              <div>
                <div class="text-h6 font-weight-bold">
                  สถานะห้องประชุม
                </div>
                <div class="text-caption text-medium-emphasis">
                  ข้อมูลสถานะห้องประชุมแบบเรียลไทม์
                </div>
              </div>
            </div>
          </VCardTitle>
          <VDivider />
          <VCardText class="pa-6">
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
                  class="room-card"
                  :class="room.isAvailable ? 'room-available' : 'room-occupied'"
                  elevation="1"
                  hover
                >
                  <VCardText>
                    <div class="d-flex align-center justify-space-between mb-3">
                      <VAvatar
                        :color="room.isAvailable ? 'success' : 'error'"
                        variant="tonal"
                        size="48"
                      >
                        <VIcon
                          :icon="room.isAvailable ? 'tabler-door-open' : 'tabler-door-closed'"
                          size="24"
                        />
                      </VAvatar>
                      <VChip
                        :color="room.isAvailable ? 'success' : 'error'"
                        size="small"
                        variant="flat"
                      >
                        {{ room.isAvailable ? 'ว่าง' : 'ไม่ว่าง' }}
                      </VChip>
                    </div>
                    <div class="text-h6 font-weight-bold mb-1">
                      {{ room.name }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      <VIcon
                        size="16"
                        icon="tabler-building"
                        class="me-1"
                      />
                      {{ room.building_name }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      <VIcon
                        size="16"
                        icon="tabler-map-pin"
                        class="me-1"
                      />
                      {{ room.area_name }}
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>
            <div
              v-else
              class="text-center py-8"
            >
              <VAvatar
                size="64"
                color="grey-lighten-4"
                class="mb-4"
              >
                <VIcon
                  size="32"
                  icon="tabler-door"
                  color="grey"
                />
              </VAvatar>
              <div class="text-body-1 text-medium-emphasis">
                ไม่มีข้อมูลห้องประชุม
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style scoped>
.dashboard-container {
  padding: 0;
}

.stats-card {
  transition: all 0.3s ease;
  border-radius: 12px;
  overflow: hidden;
}

.stats-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}

.stats-icon {
  transition: transform 0.3s ease;
}

.stats-card:hover .stats-icon {
  transform: scale(1.1) rotate(5deg);
}

.bookings-card,
.room-availability-card {
  border-radius: 12px;
}

.booking-item {
  transition: background-color 0.2s ease;
  padding: 16px 24px;
}

.booking-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.room-card {
  transition: all 0.3s ease;
  border-radius: 12px;
  cursor: pointer;
}

.room-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

.room-available {
  border-left: 4px solid rgb(var(--v-theme-success));
}

.room-occupied {
  border-left: 4px solid rgb(var(--v-theme-error));
}

/* ===== Responsive adjustments ===== */
@media (max-width: 959.98px) {
  .stats-card {
    margin-bottom: 16px;
  }

  .booking-item {
    padding: 12px 16px;
  }
}

@media (max-width: 599.98px) {
  .stats-card .text-h3 {
    font-size: 1.5rem !important;
  }

  .stats-icon {
    width: 3rem !important;
    height: 3rem !important;
  }

  .stats-icon .v-icon {
    font-size: 1.5rem !important;
  }

  .booking-item {
    padding: 0.625rem 0.75rem;
  }

  .room-card {
    margin-bottom: 0.5rem;
  }
}
</style>
