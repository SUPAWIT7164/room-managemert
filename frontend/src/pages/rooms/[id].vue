<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const route = useRoute()
const router = useRouter()
const room = ref(null)
const todayBookings = ref([])
const loading = ref(true)
const loadingBookings = ref(true)
const error = ref(null)

const roomId = computed(() => route.params.id)

// Base URL for uploads (same origin as API but /uploads path)
const uploadsBaseUrl = computed(() => {
  const base = import.meta.env.VITE_API_BASE_URL || '/api'
  return base.replace(/\/api\/?$/, '') || ''
})

const roomImageUrl = computed(() => {
  if (!room.value?.image) return null
  const img = room.value.image
  if (img.startsWith('http')) return img
  return `${uploadsBaseUrl.value}/uploads/${img}`
})

const fetchRoom = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await api.get(`/rooms/${roomId.value}`)
    room.value = response.data.data
  } catch (e) {
    console.error('Error fetching room:', e)
    error.value = e.response?.data?.message || 'ไม่พบห้อง'
  } finally {
    loading.value = false
  }
}

const fetchTodayBookings = async () => {
  loadingBookings.value = true
  try {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    const response = await api.get('/bookings/calendar', {
      params: { start: dateStr, end: dateStr, room_ids: roomId.value },
    })
    const list = response.data.data || []
    todayBookings.value = list
      .filter(b => {
        const status = (b.status || '').toLowerCase()
        const cancelled = b.cancel === 1 || b.cancelled === 1 || status === 'cancelled' || status === 'ยกเลิก'
        const rejected = b.reject === 1 || b.rejected === 1 || status === 'rejected' || status === 'ปฏิเสธ'
        return !cancelled && !rejected
      })
      .sort((a, b) => {
        const t1 = (a.start_datetime || a.start || '').toString()
        const t2 = (b.start_datetime || b.start || '').toString()
        return t1.localeCompare(t2)
      })
  } catch (e) {
    console.error('Error fetching today bookings:', e)
    todayBookings.value = []
  } finally {
    loadingBookings.value = false
  }
}

function formatTime(datetimeStr) {
  if (!datetimeStr) return '–'
  const s = datetimeStr.toString().trim()
  // "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss"
  const match = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
  return '–'
}

function bookingTimeRange(booking) {
  const start = booking.start_datetime || booking.start
  const end = booking.end_datetime || booking.end
  return `${formatTime(start)} - ${formatTime(end)}`
}

const goBackToBooking = () => {
  router.push({ name: 'bookings-avaliable' })
}

const goToRoomList = () => {
  router.push({ name: 'rooms-list' })
}

onMounted(async () => {
  await fetchRoom()
  if (!error.value && roomId.value) fetchTodayBookings()
})
</script>

<template>
  <div class="room-detail-page">
    <div class="mb-4">
      <VBtn
        variant="text"
        color="default"
        @click="goBackToBooking"
      >
        <VIcon
          icon="tabler-arrow-left"
          start
        />
        กลับไปหน้าตารางการจอง
      </VBtn>
    </div>

    <VCard v-if="loading">
      <VCardText class="text-center py-12">
        <VProgressCircular
          indeterminate
          color="primary"
          size="64"
        />
        <div class="text-body-1 mt-3">
          กำลังโหลดรายละเอียดห้อง...
        </div>
      </VCardText>
    </VCard>

    <VAlert
      v-else-if="error"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ error }}
      <template #append>
        <VBtn
          variant="text"
          size="small"
          @click="goBackToBooking"
        >
          กลับ
        </VBtn>
      </template>
    </VAlert>

    <VRow v-else-if="room">
      <!-- Left: Image + Room details (like old col-lg-8) -->
      <VCol
        cols="12"
        lg="8"
        class="mb-4"
      >
        <VCard class="room-detail-card">
          <VCardText>
            <div class="text-center mb-4">
              <div class="image-upload-overlay">
                <img
                  v-if="roomImageUrl"
                  :src="roomImageUrl"
                  :alt="room.name"
                  class="room-image"
                >
                <img
                  v-else
                  src="https://placehold.co/400x240/e8eaf6/5c6bc0?text=ห้องประชุม"
                  :alt="room.name"
                  class="room-image"
                >
              </div>
            </div>

            <div class="room-details">
              <h3 class="room-details-title">
                {{ room.name }}
              </h3>

              <VRow class="mb-3">
                <VCol
                  cols="12"
                  sm="4"
                  class="info-label"
                >
                  ประเภทห้อง:
                </VCol>
                <VCol
                  cols="12"
                  sm="8"
                >
                  {{ room.room_type_name || 'ไม่ระบุ' }}
                </VCol>
              </VRow>

              <VRow class="mb-3">
                <VCol
                  cols="12"
                  sm="4"
                  class="info-label"
                >
                  พื้นที่:
                </VCol>
                <VCol
                  cols="12"
                  sm="8"
                >
                  {{ room.area_name || 'ไม่ระบุ' }}
                </VCol>
              </VRow>

              <VRow class="mb-3">
                <VCol
                  cols="12"
                  sm="4"
                  class="info-label"
                >
                  จำนวนที่นั่ง:
                </VCol>
                <VCol
                  cols="12"
                  sm="8"
                >
                  {{ room.capacity ?? room.seat ?? 'ไม่ระบุ' }}
                </VCol>
              </VRow>

              <VRow class="mb-3">
                <VCol
                  cols="12"
                  sm="4"
                  class="info-label"
                >
                  จำนวนที่นั่งสอบ:
                </VCol>
                <VCol
                  cols="12"
                  sm="8"
                >
                  {{ room.exam_seat ?? 'ไม่ระบุ' }}
                </VCol>
              </VRow>

              <VRow class="mb-3">
                <VCol
                  cols="12"
                  sm="4"
                  class="info-label"
                >
                  ฟังก์ชันการใช้งาน:
                </VCol>
                <VCol
                  cols="12"
                  sm="8"
                >
                  {{ room.function || 'ไม่ระบุ' }}
                </VCol>
              </VRow>

              <VRow class="mb-3">
                <VCol
                  cols="12"
                  sm="4"
                  class="info-label"
                >
                  รายละเอียด:
                </VCol>
                <VCol
                  cols="12"
                  sm="8"
                >
                  {{ room.description || 'ไม่มีรายละเอียดเพิ่มเติม' }}
                </VCol>
              </VRow>

              <VRow class="mb-3">
                <VCol
                  cols="12"
                  sm="4"
                  class="info-label"
                >
                  สถานะ:
                </VCol>
                <VCol
                  cols="12"
                  sm="8"
                >
                  <VChip
                    :color="room.disable ? 'error' : 'success'"
                    size="small"
                  >
                    {{ room.disable ? 'งดใช้งาน' : 'เปิดใช้งาน' }}
                  </VChip>
                </VCol>
              </VRow>

              <div class="text-center booking-btn mt-6">
                <div class="d-flex justify-center gap-2 flex-wrap">
                  <VBtn
                    variant="outlined"
                    color="secondary"
                    @click="goBackToBooking"
                  >
                    <VIcon
                      icon="tabler-arrow-left"
                      start
                    />
                    กลับไปหน้าตารางการจอง
                  </VBtn>
                  <VBtn
                    variant="tonal"
                    color="primary"
                    @click="goBackToBooking"
                  >
                    <VIcon
                      icon="tabler-calendar"
                      start
                    />
                    ไปจองห้อง
                  </VBtn>
                  <VBtn
                    variant="outlined"
                    color="default"
                    @click="goToRoomList"
                  >
                    <VIcon
                      icon="tabler-list"
                      start
                    />
                    รายการห้อง
                  </VBtn>
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Right: ตารางการใช้งานวันนี้ (like old col-lg-4) -->
      <VCol
        cols="12"
        lg="4"
      >
        <VCard class="today-bookings-card">
          <VCardTitle class="d-flex align-center">
            <VIcon
              icon="tabler-calendar-check"
              class="me-2"
            />
            ตารางการใช้งานวันนี้
          </VCardTitle>
          <VDivider />
          <VCardText>
            <div
              v-if="loadingBookings"
              class="d-flex justify-center py-8"
            >
              <VProgressCircular
                indeterminate
                color="primary"
                size="40"
              />
            </div>
            <div
              v-else-if="todayBookings.length === 0"
              class="no-bookings"
            >
              <VIcon
                icon="tabler-calendar-x"
                size="48"
                class="mb-2 text-medium-emphasis"
              />
              <p class="text-body-2 text-medium-emphasis mb-0">
                ไม่มีการจองห้องในวันนี้
              </p>
            </div>
            <div
              v-else
              class="booking-list"
            >
              <div
                v-for="(booking, index) in todayBookings"
                :key="booking.id || index"
                class="booking-item"
              >
                <div class="booking-time">
                  {{ bookingTimeRange(booking) }}
                </div>
                <div class="booking-name">
                  {{ booking.title || booking.name || 'ไม่ระบุชื่อการจอง' }}
                </div>
                <div class="booking-booker">
                  <VIcon
                    icon="tabler-user"
                    size="14"
                    class="me-1"
                  />
                  {{ booking.booker_name || booking.booker || 'ไม่ระบุผู้จอง' }}
                </div>
                <div class="booking-objective">
                  <VIcon
                    icon="tabler-bookmark"
                    size="14"
                    class="me-1"
                  />
                  {{ booking.objective || 'ไม่ระบุวัตถุประสงค์' }}
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style scoped>
.room-detail-page {
  /* max-width managed by global .v-container */
}

.room-detail-card,
.today-bookings-card {
  background: rgba(var(--v-theme-surface), 0.98);
}

.room-image {
  max-width: 100%;
  width: auto;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.room-image:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.image-upload-overlay {
  position: relative;
  display: inline-block;
}

.room-details {
  margin-top: 20px;
}

.room-details-title {
  color: rgb(var(--v-theme-primary));
  margin-bottom: 20px;
  font-size: 1.5rem;
  font-weight: 600;
}

.info-label {
  font-weight: bold;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.booking-btn :deep(.v-btn) {
  text-transform: none;
}

/* ตารางการใช้งานวันนี้ */
.no-bookings {
  text-align: center;
  padding: 24px 16px;
}

.booking-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.booking-item {
  background: rgba(var(--v-theme-surface-variant), 0.5);
  border-radius: 8px;
  padding: 12px 14px;
  border: 1px solid rgba(var(--v-theme-outline), 0.2);
  transition: all 0.3s ease;
}

.booking-item:hover {
  background: rgba(var(--v-theme-surface-variant), 0.8);
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.08);
}

.booking-time {
  font-weight: bold;
  color: rgb(var(--v-theme-primary));
  font-size: 1rem;
  margin-bottom: 4px;
}

.booking-name {
  color: rgba(var(--v-theme-on-surface), 0.9);
  margin: 4px 0;
  font-weight: 500;
}

.booking-booker {
  color: rgba(var(--v-theme-on-surface), 0.65);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
}

.booking-objective {
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-style: italic;
  margin-top: 4px;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .room-image {
    max-width: 80%;
    margin-left: auto;
    margin-right: auto;
  }
}

@media (max-width: 599.98px) {
  .room-image {
    max-width: 90%;
  }

  .room-details-title {
    font-size: 1.25rem;
  }

  .booking-item {
    padding: 10px 12px;
  }
}
</style>
