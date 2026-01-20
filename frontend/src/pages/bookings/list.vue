<script setup>
import { ref, onMounted, computed, onBeforeUnmount, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import { useDisplay } from 'vuetify'
import moment from 'moment'
import 'moment/locale/th'
import $ from 'jquery'
import 'daterangepicker'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const authStore = useAuthStore()
const { mobile } = useDisplay()
const loading = ref(false)
const bookings = ref([])
const rooms = ref([])
const authorizedRooms = ref([])

// Pagination
const pagination = ref({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0
})

// Entries per page options
const itemsPerPageOptions = [
  { value: 10, title: '10' },
  { value: 25, title: '25' },
  { value: 50, title: '50' },
  { value: 100, title: '100' },
]

// Filters
const selectedRoomId = ref(null)
const searchQuery = ref('')

// Date range picker
const dateRangeInput = ref(null)
const startDate = ref(null)
const endDate = ref(null)
const today = moment()

// Initialize date range to current month
const initDateRange = () => {
  const firstDay = moment().startOf('month')
  const lastDay = moment().endOf('month')
  startDate.value = firstDay.format('YYYY-MM-DD')
  endDate.value = lastDay.format('YYYY-MM-DD')
}

// Initialize daterangepicker
const initializeDateRangePicker = () => {
  const tryInitialize = async (retries = 0) => {
    if (retries > 20) {
      console.error('Failed to initialize date range picker after maximum retries')
      return
    }
    
    await nextTick()
    
    // Try to find the input element by ID if ref is not available
    let inputElement = dateRangeInput.value
    if (!inputElement) {
      inputElement = document.getElementById('dateRangeList')
    }
    
    if (!inputElement) {
      console.warn(`Date range input not found, retrying... (${retries}/20)`)
      setTimeout(() => tryInitialize(retries + 1), 150)
      return
    }
    
    try {
      // Ensure moment is available globally
      if (typeof window !== 'undefined') {
        window.moment = window.moment || moment
      }
      
      // Ensure jQuery is available globally
      if (typeof window !== 'undefined') {
        window.$ = window.$ || $
        window.jQuery = window.jQuery || $
      }
      
      // Check if jQuery is available
      const jQueryAvailable = typeof $ !== 'undefined' || (typeof window !== 'undefined' && typeof window.$ !== 'undefined')
      if (!jQueryAvailable) {
        console.error('jQuery is not available')
        setTimeout(() => tryInitialize(retries + 1), 200)
        return
      }
      
      // Use window.$ if available, otherwise use imported $
      const jQuery = (typeof window !== 'undefined' && window.$) || $
      const $input = jQuery(inputElement)
      
      // Check if jQuery wrapped the element properly
      if ($input.length === 0) {
        console.error('Failed to wrap element with jQuery')
        setTimeout(() => tryInitialize(retries + 1), 200)
        return
      }
      
      // Remove existing daterangepicker if any
      if ($input.data('daterangepicker')) {
        $input.data('daterangepicker').remove()
      }
      
      const maxDaysAhead = 365
      const maxDate = today.clone().add(maxDaysAhead, 'days')
      
      // Initialize daterangepicker
      $input.daterangepicker({
        locale: {
          format: 'DD/MM/YYYY',
          applyLabel: 'ตกลง',
          cancelLabel: 'ยกเลิก',
          daysOfWeek: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
          monthNames: [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
          ],
        },
        startDate: startDate.value ? moment(startDate.value) : moment(),
        endDate: endDate.value ? moment(endDate.value) : moment(),
        maxDate: maxDate,
      }, (start, end) => {
        startDate.value = start.format('YYYY-MM-DD')
        endDate.value = end.format('YYYY-MM-DD')
        pagination.value.page = 1
        fetchBookings()
      })
      
      // Verify daterangepicker was initialized
      const picker = $input.data('daterangepicker')
      if (picker) {
        // Update the ref if it wasn't set
        if (!dateRangeInput.value) {
          dateRangeInput.value = inputElement
        }
      } else {
        setTimeout(() => tryInitialize(retries + 1), 200)
      }
    } catch (error) {
      console.error('Error initializing date range picker:', error)
      setTimeout(() => tryInitialize(retries + 1), 200)
    }
  }
  
  // Start initialization after a short delay to ensure DOM is ready
  setTimeout(() => {
    tryInitialize()
  }, 300)
}

// Fetch rooms for filter
const fetchRooms = async () => {
  try {
    const response = await api.get('/rooms')
    rooms.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching rooms:', error)
  }
}

// Check authorized rooms for approval
const checkAuthorizedRooms = async () => {
  try {
    // Get all rooms where user is an approver
    const response = await api.get('/approvers/my-rooms')
    if (response.data.success) {
      // Extract room_ids from rooms list
      authorizedRooms.value = (response.data.data || []).map(room => room.id || room.room_id)
    } else {
      authorizedRooms.value = []
    }
  } catch (error) {
    console.error('Error checking authorized rooms:', error)
    // If user is not an approver, this endpoint might return 404 or error
    authorizedRooms.value = []
  }
}

// Fetch bookings with filters
const fetchBookings = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit,
    }
    if (startDate.value) params.start_date = startDate.value
    if (endDate.value) params.end_date = endDate.value
    if (selectedRoomId.value) params.room_id = selectedRoomId.value

    console.log('[BookingsList] Fetching bookings with params:', params)
    const response = await api.get('/bookings', { params })
    
    if (response.data.success) {
      bookings.value = response.data.data || []
      console.log('[BookingsList] Received bookings:', bookings.value.length, 'items')
      console.log('[BookingsList] Pagination from server:', response.data.pagination)
      
      if (response.data.pagination) {
        // Use pagination from server (it should match what we sent)
        pagination.value = {
          ...pagination.value,
          ...response.data.pagination
        }
        console.log('[BookingsList] Updated pagination:', pagination.value)
      }
    } else {
      bookings.value = []
    }
  } catch (error) {
    console.error('Error fetching bookings:', error)
    bookings.value = []
  } finally {
    loading.value = false
  }
}

// Filter bookings by search query (client-side filtering for search only)
const filteredBookings = computed(() => {
  if (!searchQuery.value) return bookings.value
  
  const query = searchQuery.value.toLowerCase()
  return bookings.value.filter(booking => {
    return (
      booking.title?.toLowerCase().includes(query) ||
      booking.room_name?.toLowerCase().includes(query) ||
      booking.booker_name?.toLowerCase().includes(query) ||
      booking.participants?.toLowerCase().includes(query)
    )
  })
})

// Handle page change
const handlePageChange = (page) => {
  pagination.value.page = page
  fetchBookings()
}

// Handle items per page change
const handleItemsPerPageChange = (value) => {
  // Handle both object and primitive value
  const newLimit = typeof value === 'object' ? value.value : parseInt(value, 10)
  console.log('[BookingsList] Changing items per page to:', newLimit, 'from value:', value)
  pagination.value.limit = newLimit
  pagination.value.page = 1 // Reset to first page
  fetchBookings()
}

// Format date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// Format datetime
const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Format time
const formatTime = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Calculate duration in hours
const calculateDuration = (start, end) => {
  if (!start || !end) return 0
  const startTime = new Date(start)
  const endTime = new Date(end)
  const diff = endTime - startTime
  return (diff / (1000 * 60 * 60)).toFixed(1)
}

// Format participants - extract emails from JSON string or array
const formatParticipants = (participants) => {
  if (!participants) return 'ไม่ได้ระบุ'
  
  try {
    // If it's already a string that looks like JSON, parse it
    let parsed
    if (typeof participants === 'string') {
      // Try to parse as JSON
      parsed = JSON.parse(participants)
    } else {
      parsed = participants
    }
    
    // If it's an array, extract emails
    if (Array.isArray(parsed)) {
      const emails = parsed
        .map(item => {
          if (typeof item === 'string') {
            return item
          } else if (item && item.email) {
            return item.email
          }
          return null
        })
        .filter(email => email !== null)
      
      return emails.length > 0 ? emails.join(', ') : 'ไม่ได้ระบุ'
    }
    
    // If it's a single email string
    if (typeof parsed === 'string') {
      return parsed
    }
    
    return 'ไม่ได้ระบุ'
  } catch (error) {
    // If parsing fails, return as is (might be a plain string)
    return typeof participants === 'string' ? participants : 'ไม่ได้ระบุ'
  }
}

// Get status text and color
const getStatus = (booking) => {
  if (booking.cancel === 1 || booking.cancel === true) {
    return { text: 'ยกเลิกแล้ว', color: 'warning' }
  }
  if (booking.reject === 1 || booking.reject === true) {
    return { text: 'ถูกปฏิเสธ', color: 'error' }
  }
  if (booking.status === 1 || booking.status === 'approved' || booking.status === 'confirmed') {
    return { text: 'ยืนยันแล้ว', color: 'success' }
  }
  return { text: 'รอดำเนินการ', color: 'info' }
}

// Check if user can approve
const canApprove = (booking) => {
  if (authStore.isSuperAdmin || authStore.isAdmin) return true
  const roomId = booking.room_id || booking.room
  if (roomId && authorizedRooms.value.includes(Number(roomId))) return true
  return false
}

// Check if user can cancel
const canCancel = (booking) => {
  if (authStore.isSuperAdmin || authStore.isAdmin) return true
  const bookerId = booking.booker_id || booking.user_id
  const status = booking.status
  if (bookerId === authStore.user?.id && (status === 1 || status === 'approved' || status === 'confirmed')) return true
  return false
}

// Check if booking is past
const isPastBooking = (endDateString) => {
  if (!endDateString) return false
  const endDate = new Date(endDateString)
  return endDate < new Date()
}

// Get action buttons
const getActions = (booking) => {
  const actions = []
  const status = getStatus(booking)
  const isPast = isPastBooking(booking.end_datetime || booking.end)

  // If canceled or rejected, show status only
  if (booking.cancel === 1 || booking.cancel === true || booking.reject === 1 || booking.reject === true) {
    return []
  }

  // If past booking, no actions
  if (isPast) {
    return []
  }

  // Approve button (for approvers) - only show if status is pending
  const bookingStatus = booking.status
  const isPending = bookingStatus === 0 || bookingStatus === 'pending' || bookingStatus === '0'
  if (canApprove(booking) && isPending) {
    actions.push({
      label: 'อนุมัติ',
      color: 'success',
      action: 'approve',
      icon: 'tabler-check'
    })
  }

  // Cancel button (for booker)
  if (canCancel(booking)) {
    actions.push({
      label: 'ยกเลิก',
      color: 'warning',
      action: 'cancel',
      icon: 'tabler-x'
    })
  }

  // Reject button (for approvers) - only show if status is pending
  if (canApprove(booking) && isPending) {
    actions.push({
      label: 'ปฏิเสธ',
      color: 'error',
      action: 'reject',
      icon: 'tabler-x'
    })
  }

  return actions
}

// Update booking status
const updateBookingStatus = async (bookingId, action) => {
  try {
    let response
    if (action === 'approve') {
      response = await api.post(`/bookings/${bookingId}/approve`)
    } else if (action === 'reject') {
      response = await api.post(`/bookings/${bookingId}/reject`)
    } else if (action === 'cancel') {
      response = await api.post(`/bookings/${bookingId}/cancel`)
    } else {
      throw new Error(`Unknown action: ${action}`)
    }

    if (response.data.success) {
      // Refresh bookings
      await fetchBookings()
      // Refresh authorized rooms
      await checkAuthorizedRooms()
      // Show success message
      console.log('Status updated successfully:', response.data.message)
    }
  } catch (error) {
    console.error('Error updating booking status:', error)
    throw error
  }
}

// Handle action button click
const handleAction = async (booking, action) => {
  const actionLabels = {
    approve: 'อนุมัติ',
    cancel: 'ยกเลิก',
    reject: 'ปฏิเสธ'
  }

  const confirmMessage = `คุณต้องการ${actionLabels[action]}การจองนี้หรือไม่?`
  
  if (confirm(confirmMessage)) {
    try {
      await updateBookingStatus(booking.id, action)
      // You can add a toast notification here
      alert(`ดำเนินการ${actionLabels[action]}สำเร็จ`)
    } catch (error) {
      console.error('Error:', error)
      alert(`เกิดข้อผิดพลาด: ${error.response?.data?.message || error.message}`)
    }
  }
}

// Handle date range click
const handleDateRangeClick = (event) => {
  event.preventDefault()
  event.stopPropagation()
  if (dateRangeInput.value) {
    const jQuery = (typeof window !== 'undefined' && window.$) || $
    const $input = jQuery(dateRangeInput.value)
    if ($input.data('daterangepicker')) {
      $input.data('daterangepicker').show()
    } else {
      // If picker not initialized yet, trigger click on hidden input
      dateRangeInput.value.click()
    }
  }
}

// Clear filters
const clearFilters = () => {
  selectedRoomId.value = null
  searchQuery.value = ''
  pagination.value.page = 1 // Reset to first page
  initDateRange()
  
  // Update daterangepicker
  if (dateRangeInput.value) {
    const jQuery = (typeof window !== 'undefined' && window.$) || $
    const $input = jQuery(dateRangeInput.value)
    if ($input.data('daterangepicker')) {
      const picker = $input.data('daterangepicker')
      picker.setStartDate(moment(startDate.value))
      picker.setEndDate(moment(endDate.value))
    }
  }
  
  fetchBookings()
}

onMounted(async () => {
  // Ensure moment and jQuery are available globally before using daterangepicker
  if (typeof window !== 'undefined') {
    window.moment = window.moment || moment
    window.$ = window.$ || $
    window.jQuery = window.jQuery || $
  }
  
  moment.locale('th')
  initDateRange()
  
  await Promise.all([
    fetchRooms(),
    checkAuthorizedRooms()
  ])
  
  initializeDateRangePicker()
  fetchBookings()
})

onBeforeUnmount(() => {
  // Destroy daterangepicker
  if (dateRangeInput.value) {
    const jQuery = (typeof window !== 'undefined' && window.$) || $
    const $input = jQuery(dateRangeInput.value)
    if ($input.data('daterangepicker')) {
      $input.data('daterangepicker').remove()
    }
  }
})
</script>

<style scoped>
.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.v-table {
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

/* Table Header */
.v-table thead tr {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.v-table thead th {
  color: white !important;
  font-weight: 700 !important;
  font-size: 0.875rem;
  text-align: left;
  padding: 16px 12px !important;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 2px solid #e0e0e0;
  white-space: nowrap;
}

.v-table thead th:last-child {
  border-right: none;
}

/* Table Body */
.v-table tbody tr {
  transition: background-color 0.2s ease;
}

.v-table tbody tr:nth-child(odd) {
  background-color: #ffffff;
}

.v-table tbody tr:nth-child(even) {
  background-color: #f9fafb;
}

.v-table tbody tr:hover {
  background-color: #f0f4ff !important;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.1);
}

.v-table tbody td {
  padding: 14px 12px !important;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
  color: #374151;
  vertical-align: middle;
}

.v-table tbody td:last-child {
  border-right: none;
}

.v-table tbody tr:last-child td {
  border-bottom: none;
}

/* ID Column */
.v-table tbody td:first-child {
  font-weight: 600;
  color: #667eea;
  font-family: monospace;
  text-align: center;
  min-width: 60px;
}

/* Action Column */
.v-table tbody td:nth-child(2) {
  min-width: 120px;
}

/* Name Column */
.v-table tbody td:nth-child(3) {
  font-weight: 500;
  color: #111827;
  min-width: 150px;
}

/* Room Column */
.v-table tbody td:nth-child(6) {
  font-weight: 500;
  min-width: 150px;
}

/* DateTime Columns */
.v-table tbody td:nth-child(7),
.v-table tbody td:nth-child(8),
.v-table tbody td:nth-child(12) {
  font-size: 0.8125rem;
  color: #6b7280;
  white-space: nowrap;
  min-width: 140px;
}

/* Duration Column */
.v-table tbody td:nth-child(9) {
  text-align: center;
  font-weight: 500;
  color: #667eea;
}

/* Chip Styling */
.v-chip {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.025em;
}

/* Responsive */
@media (max-width: 1200px) {
  .v-table thead th,
  .v-table tbody td {
    padding: 10px 8px !important;
    font-size: 0.8125rem;
  }
}

/* Loading State */
.text-center.py-8 {
  padding: 3rem 1rem;
}

/* Empty State Icon */
.v-icon[size="64"] {
  opacity: 0.3;
}

/* Date Range Picker Input */
.form-control {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid rgba(var(--v-border-opacity), var(--v-border-opacity));
  border-radius: 4px;
  font-size: 0.875rem;
  font-family: inherit;
  background-color: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
  min-height: 40px;
  box-sizing: border-box;
}

.form-control:focus {
  outline: none;
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.1);
}

.form-control:hover {
  border-color: rgba(var(--v-theme-on-surface), 0.38);
}

.form-control::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.38);
}

/* Filter Card Styling */
.filter-card {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%);
  border: 1px solid rgba(102, 126, 234, 0.12);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
}

.filter-card:hover {
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.12);
  border-color: rgba(102, 126, 234, 0.2);
}

.filter-card .v-card-text {
  padding: 20px;
}

/* Filter Input Styling */
.filter-input :deep(.v-field) {
  background-color: rgba(255, 255, 255, 0.8);
  transition: all 0.2s ease;
}

.filter-input :deep(.v-field:hover) {
  background-color: rgba(255, 255, 255, 1);
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.08);
}

.filter-input :deep(.v-field--focused) {
  background-color: rgba(255, 255, 255, 1);
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.filter-input :deep(.v-field__prepend-inner) {
  color: rgb(var(--v-theme-primary));
}

/* Date Range Wrapper */
.date-range-wrapper {
  position: relative;
}

.date-range-text-field {
  cursor: pointer;
  pointer-events: none;
}

.date-range-text-field :deep(.v-field) {
  cursor: pointer;
  pointer-events: auto;
}

.date-range-hidden-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 56px; /* Match VTextField height for density="comfortable" */
  opacity: 0;
  cursor: pointer;
  z-index: 2;
  pointer-events: auto;
  border: none;
  background: transparent;
}

/* Filter Section Header */
.filter-card .text-h6 {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  letter-spacing: 0.5px;
}

/* Clear Filters Button */
.filter-card .v-btn {
  text-transform: none;
  letter-spacing: 0.3px;
  font-weight: 500;
}

/* Responsive */
@media (max-width: 960px) {
  .filter-card .v-card-text {
    padding: 16px;
  }
  
  .filter-card .d-flex.align-center.mb-4 {
    margin-bottom: 16px !important;
  }
}
</style>

<template>
  <div>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-list"
                class="me-2"
              />
              รายการการจอง
            </div>
          </VCardTitle>
          
          <VCardText>
            <!-- Filters -->
            <VCard
              class="filter-card mb-4"
              variant="outlined"
            >
              <VCardText>
                <div class="d-flex align-center mb-4">
                  <VIcon
                    icon="tabler-filter"
                    class="me-2"
                    color="primary"
                    size="24"
                  />
                  <span class="text-h6">ตัวกรอง</span>
                </div>
                
                <VRow>
                  <VCol
                    cols="12"
                    md="4"
                  >
                    <VTextField
                      v-model="searchQuery"
                      label="ค้นหา"
                      prepend-inner-icon="tabler-search"
                      variant="outlined"
                      density="comfortable"
                      clearable
                      class="filter-input"
                    />
                  </VCol>
                  
                  <VCol
                    cols="12"
                    md="4"
                  >
                    <VSelect
                      v-model="selectedRoomId"
                      :items="rooms"
                      item-title="name"
                      item-value="id"
                      label="เลือกห้อง"
                      variant="outlined"
                      density="comfortable"
                      clearable
                      prepend-inner-icon="tabler-door"
                      class="filter-input"
                      @update:model-value="() => { pagination.page = 1; fetchBookings(); }"
                    >
                      <template #prepend-item>
                        <VListItem
                          title="ทั้งหมด"
                          prepend-icon="tabler-checkbox"
                          @click="selectedRoomId = null; pagination.page = 1; fetchBookings()"
                        />
                      </template>
                    </VSelect>
                  </VCol>
                  
                  <VCol
                    cols="12"
                    md="4"
                  >
                    <div class="date-range-wrapper">
                      <VTextField
                        :model-value="startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : 'เลือกช่วงวันที่'"
                        label="เลือกช่วงวันที่"
                        prepend-inner-icon="tabler-calendar"
                        variant="outlined"
                        density="comfortable"
                        readonly
                        class="filter-input date-range-text-field"
                        @click="handleDateRangeClick"
                      />
                      <input
                        ref="dateRangeInput"
                        id="dateRangeList"
                        type="text"
                        class="date-range-hidden-input"
                      />
                    </div>
                  </VCol>
                </VRow>
                
                <!-- Clear Filters Button -->
                <div class="d-flex justify-end mt-3">
                  <VBtn
                    variant="outlined"
                    color="secondary"
                    size="small"
                    prepend-icon="tabler-x"
                    @click="clearFilters"
                  >
                    ล้างตัวกรอง
                  </VBtn>
                </div>
              </VCardText>
            </VCard>

            <!-- Entries per page and table header -->
            <div
              v-if="!loading"
              class="d-flex align-center justify-space-between mb-4"
            >
              <div class="d-flex align-center gap-2 flex-wrap">
                <span class="text-body-2 text-medium-emphasis">แสดงผล:</span>
                <VSelect
                  :model-value="pagination.limit"
                  :items="itemsPerPageOptions"
                  item-title="title"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  style="min-width: 100px; max-width: 120px;"
                  hide-details
                  @update:model-value="handleItemsPerPageChange"
                />
                <span class="text-body-2 text-medium-emphasis">รายการต่อหน้า</span>
              </div>
            </div>

            <!-- Loading -->
            <div
              v-if="loading"
              class="text-center py-8"
            >
              <VProgressCircular
                indeterminate
                color="primary"
                size="64"
              />
            </div>

            <!-- Data Table -->
            <div
              v-else-if="filteredBookings.length > 0"
              class="table-responsive"
            >
              <VTable>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>การกระทำ</th>
                    <th>ชื่อ</th>
                    <th>ผู้จอง</th>
                    <th>ผู้เข้าร่วม</th>
                    <th>ห้อง</th>
                    <th>เวลาเริ่ม</th>
                    <th>เวลาสิ้นสุด</th>
                    <th>ระยะเวลา (ชั่วโมง)</th>
                    <th>การประชุมออนไลน์</th>
                    <th>สถานะ</th>
                    <th>วันที่สร้าง</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="booking in filteredBookings"
                    :key="booking.id"
                  >
                    <td>{{ booking.id }}</td>
                    <td>
                      <div class="d-flex gap-2">
                        <VBtn
                          v-for="action in getActions(booking)"
                          :key="action.action"
                          :color="action.color"
                          size="small"
                          variant="text"
                          :icon="action.icon"
                          @click="handleAction(booking, action.action)"
                        >
                          <VIcon
                            :icon="action.icon"
                            size="16"
                          />
                        </VBtn>
                        <span
                          v-if="getActions(booking).length === 0"
                          class="text-disabled text-caption"
                        >
                          {{ isPastBooking(booking.end_datetime || booking.end) ? 'หมดเวลาแล้ว' : 
                             (booking.cancel === 1 || booking.cancel === true) ? 'ยกเลิกแล้ว' :
                             (booking.reject === 1 || booking.reject === true) ? 'ถูกปฏิเสธ' : 'ไม่มีสิทธิ์' }}
                        </span>
                      </div>
                    </td>
                    <td>{{ booking.title || booking.name || 'N/A' }}</td>
                    <td>{{ booking.booker_name || booking.booker || 'N/A' }}</td>
                    <td>{{ formatParticipants(booking.participants) }}</td>
                    <td>{{ booking.room_name || booking.room || 'N/A' }}</td>
                    <td>{{ formatDateTime(booking.start_datetime || booking.start) }}</td>
                    <td>{{ formatDateTime(booking.end_datetime || booking.end) }}</td>
                    <td>{{ calculateDuration(booking.start_datetime || booking.start, booking.end_datetime || booking.end) }}</td>
                    <td>
                      <VChip
                        :color="(booking.online_meeting === 1 || booking.online_meeting === true) ? 'success' : 'default'"
                        size="small"
                        variant="tonal"
                      >
                        {{ (booking.online_meeting === 1 || booking.online_meeting === true) ? 'ออนไลน์' : 'ไม่มี' }}
                      </VChip>
                    </td>
                    <td>
                      <VChip
                        :color="getStatus(booking).color"
                        size="small"
                        variant="tonal"
                      >
                        {{ getStatus(booking).text }}
                      </VChip>
                    </td>
                    <td>{{ formatDateTime(booking.created_at) }}</td>
                  </tr>
                </tbody>
              </VTable>
            </div>

            <!-- No Data -->
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
                ไม่มีการจอง
              </div>
              <div class="text-body-2 text-disabled">
                {{ searchQuery || selectedRoomId ? 'ไม่พบข้อมูลที่ตรงกับการกรองนี้' : 'ยังไม่มีการจองในระบบ' }}
              </div>
            </div>

            <!-- Pagination -->
            <VCardActions
              v-if="!loading && filteredBookings.length > 0 && pagination.totalPages > 0"
              class="px-4 py-3"
            >
              <div class="text-caption text-disabled">
                แสดงผล {{ ((pagination.page - 1) * pagination.limit) + 1 }} ถึง {{ Math.min(pagination.page * pagination.limit, pagination.total) }} จาก {{ pagination.total }} รายการ
              </div>
              <VSpacer />
              <div class="d-flex align-center gap-2">
                <VBtn
                  icon
                  variant="text"
                  size="small"
                  :disabled="pagination.page === 1"
                  @click="handlePageChange(pagination.page - 1)"
                >
                  <VIcon icon="tabler-chevron-left" />
                </VBtn>
                <div class="d-flex align-center gap-1">
                  <VBtn
                    v-for="page in pagination.totalPages"
                    :key="page"
                    :variant="pagination.page === page ? 'elevated' : 'text'"
                    :color="pagination.page === page ? 'primary' : 'default'"
                    size="small"
                    @click="handlePageChange(page)"
                  >
                    {{ page }}
                  </VBtn>
                </div>
                <VBtn
                  icon
                  variant="text"
                  size="small"
                  :disabled="pagination.page === pagination.totalPages"
                  @click="handlePageChange(pagination.page + 1)"
                >
                  <VIcon icon="tabler-chevron-right" />
                </VBtn>
              </div>
            </VCardActions>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>
