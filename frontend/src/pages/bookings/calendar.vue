<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { requiredValidator } from '@core/utils/validators'
import api from '@/utils/api'
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
const loading = ref(false)
const rooms = ref([])
const selectedRooms = ref([])
const selectAllRooms = ref(true)
const bookings = ref([])
const selectedDate = ref('')
const submitting = ref(false)
const dateRangeInput = ref(null)

// View/Edit Modal State
const showViewModal = ref(false)
const viewingBooking = ref(null)
const isEditMode = ref(false)
const saving = ref(false)
const editForm = reactive({
  name: '',
  objective: '',
  date: '',
  start_time: '',
  end_time: '',
  description: '',
  attendees: 0,
  room_id: '',
})

// Drag and Drop State
const draggingBooking = ref(null)
const dragOverSlot = ref(null)

// Date range - default to today only
const today = moment()
const startDate = ref(today.format('YYYY-MM-DD'))
const endDate = ref(today.format('YYYY-MM-DD'))

const bookingForm = reactive({
  room_id: '',
  name: '',
  description: '',
  start_time: '09:00',
  end_time: '10:00',
  attendees: '',
  attendeesEmails: [],
})

const newAttendeeEmail = ref('')
const userSuggestions = ref([])
const showSuggestions = ref(false)
const selectedSuggestionIndex = ref(-1)
const emailInputRef = ref(null)
let searchTimeout = null

// Generate time slots from 07:00 to 17:00 with 30-minute intervals
const timeSlots = []
for (let h = 7; h < 17; h++) {
  timeSlots.push({
    start: `${String(h).padStart(2, '0')}:00`,
    end: `${String(h).padStart(2, '0')}:30`,
  })
  timeSlots.push({
    start: `${String(h).padStart(2, '0')}:30`,
    end: `${String(h + 1).padStart(2, '0')}:00`,
  })
}

// Computed: filtered rooms based on selection
const filteredRooms = computed(() => {
  return rooms.value.filter(room => selectedRooms.value.includes(room.id))
})

// Computed: date range array
const dateRange = computed(() => {
  const dates = []
  const start = moment(startDate.value)
  const end = moment(endDate.value)
  const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
  
  for (let m = moment(start); m.isSameOrBefore(end); m.add(1, 'days')) {
    dates.push({
      date: m.format('YYYY-MM-DD'),
      dayOfWeek: m.day(),
      dayName: dayNames[m.day()],
      formattedDate: m.format('DD/MM/YYYY'),
    })
  }
  return dates
})

const getObjectiveColor = (objective) => {
  const colors = {
    'บรรยาย': '#54C392',
    'อบรม': '#87A2FF',
    'ประชุม': '#FF70AB',
    'จัดกิจกรรม': '#7E60BF',
    'สอบ': '#EC8305',
    'งดใช้': '#F95454',
  }
  return colors[objective] || '#667eea'
}

const isLunchBreak = (time) => {
  return time === '12:00' || time === '12:30'
}

const isPastSlot = (date, time) => {
  const now = moment()
  const slotDateTime = moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm')
  return slotDateTime.isBefore(now)
}

const getBookingForSlot = (roomId, date, time) => {
  // Find the room to check auto_approve setting
  const room = rooms.value.find(r => r.id === roomId)
  const roomAutoApprove = room ? (room.auto_approve === 1 || room.auto_approve === true) : false
  
  return bookings.value.find(b => {
    // Check if booking matches room
    if (b.room !== roomId && b.room_id !== roomId) return false
    
    // Check if booking matches date
    const bookingDate = moment(b.start).format('YYYY-MM-DD')
    if (bookingDate !== date) return false
    
    // Check if booking matches time slot
    const bookingStart = moment(b.start).format('HH:mm')
    const bookingEnd = moment(b.end).format('HH:mm')
    if (!(time >= bookingStart && time < bookingEnd)) return false
    
    // Filter by approval status based on room's auto_approve setting
    if (roomAutoApprove) {
      // Room with auto-approve: show both approved and pending bookings
      return b.status === 'approved' || b.status === 'pending'
    } else {
      // Room requires approval: show only approved bookings
      return b.status === 'approved'
    }
  })
}

const isBookingStartSlot = (roomId, date, time) => {
  const booking = getBookingForSlot(roomId, date, time)
  if (!booking) return false
  const bookingStart = moment(booking.start).format('HH:mm')
  return time === bookingStart
}

const getBookingSpan = (roomId, date, time) => {
  const booking = getBookingForSlot(roomId, date, time)
  if (!booking) return 1
  
  const bookingStart = moment(booking.start)
  const bookingEnd = moment(booking.end)
  const slotDuration = 30 // minutes
  const durationMinutes = bookingEnd.diff(bookingStart, 'minutes')
  const spanSlots = Math.ceil(durationMinutes / slotDuration)
  
  return spanSlots
}

const getBookingPillStyle = (roomId, date, time) => {
  const booking = getBookingForSlot(roomId, date, time)
  if (!booking) return {}
  
  const span = getBookingSpan(roomId, date, time)
  const totalSlots = timeSlots.length
  
  // Get actual booking start time (not the time parameter which is the slot's start time)
  const bookingStartTime = moment(booking.start).format('HH:mm')
  
  // Find the index of the starting time slot based on ACTUAL booking start time
  const startSlotIndex = timeSlots.findIndex(slot => slot.start === bookingStartTime)
  
  if (startSlotIndex === -1) return {}
  
  // Room name width is 250px
  const roomNameWidth = 250
  
  // Calculate the slot width as a percentage of the remaining space (after room name)
  // Each slot takes equal space in the flexbox
  const slotWidth = `calc((100% - ${roomNameWidth}px) / ${totalSlots})`
  
  // Calculate left offset: room name width + (slot width * start index)
  const leftOffset = `calc(${roomNameWidth}px + ${slotWidth} * ${startSlotIndex})`
  
  // Calculate width: slot width * span
  const width = `calc(${slotWidth} * ${span})`
  
  return {
    position: 'absolute',
    left: leftOffset,
    top: '0',
    width: width,
    height: '100%',
    zIndex: 5,
    backgroundColor: getObjectiveColor(booking.objective),
    color: '#fff',
  }
}

const getNewSlotClass = (roomId, date, time) => {
  const classes = []
  const booking = getBookingForSlot(roomId, date, time)
  if (booking) {
    classes.push('booked-slot')
  } else if (isPastSlot(date, time)) {
    classes.push('past-slot')
  } else {
    classes.push('available-slot')
  }
  if (isLunchBreak(time)) {
    classes.push('lunch-slot')
  }
  return classes
}

const getSlotStyle = (roomId, date, time) => {
  const booking = getBookingForSlot(roomId, date, time)
  if (booking) {
    return {
      backgroundColor: getObjectiveColor(booking.objective),
      color: '#fff',
    }
  }
  return {}
}

const handleSlotClick = (room, date, time) => {
  if (isPastSlot(date, time)) {
    alert('ไม่สามารถจองช่วงเวลาที่ผ่านมาแล้วได้')
    return
  }
  
  const booking = getBookingForSlot(room.id, date, time)
  if (booking) {
    // Open view/edit modal
    openViewModal(booking)
    return
  }

  // Open booking modal for new booking
  openBookingModal(room, date, time)
}

const handleBookingMouseDown = (roomId, date, time) => {
  const booking = getBookingForSlot(roomId, date, time)
  // If booking is draggable, don't prevent default
  if (booking && canDragBooking(booking)) {
    return true
  }
}

const handleBookingClick = (roomId, date, time) => {
  // Don't open modal if we're dragging or just finished dragging
  if (draggingBooking.value) {
    draggingBooking.value = null
    return
  }
  
  const booking = getBookingForSlot(roomId, date, time)
  if (booking) {
    // Open view/edit modal for editing
    openViewModal(booking)
  }
}

// Drag and Drop Handlers
const handleDragStart = (event, roomId, date, time) => {
  const booking = getBookingForSlot(roomId, date, time)
  if (booking && canDragBooking(booking)) {
    draggingBooking.value = booking
    // Set drag data
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', booking.id)
    }
  } else {
    // Prevent drag if not allowed
    event.preventDefault()
  }
}

const handleDragEnd = () => {
  draggingBooking.value = null
  dragOverSlot.value = null
}

const handleDragOver = (event, roomId, date, time) => {
  if (!draggingBooking.value) return
  if (isPastSlot(date, time)) {
    event.preventDefault()
    return
  }
  
  // Check if slot is available
  const existingBooking = getBookingForSlot(roomId, date, time)
  if (existingBooking && existingBooking.id !== draggingBooking.value.id) {
    event.preventDefault()
    return // Slot is occupied by another booking
  }
  
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dragOverSlot.value = { roomId, date, time }
}

const handleDragLeave = () => {
  // Only clear if we're actually leaving the slot area
  setTimeout(() => {
    if (dragOverSlot.value) {
      dragOverSlot.value = null
    }
  }, 50)
}

const handleDrop = async (roomId, date, time) => {
  if (!draggingBooking.value) return
  if (isPastSlot(date, time)) {
    alert('ไม่สามารถย้ายไปยังช่วงเวลาที่ผ่านมาแล้วได้')
    return
  }

  // Check if slot is available
  const existingBooking = getBookingForSlot(roomId, date, time)
  if (existingBooking && existingBooking.id !== draggingBooking.value.id) {
    alert('ช่วงเวลานี้ถูกจองแล้ว')
    dragOverSlot.value = null
    return
  }

  // Ensure modal is open and in edit mode
  if (!viewingBooking.value || viewingBooking.value.id !== draggingBooking.value.id) {
    openViewModal(draggingBooking.value)
    enableEditMode()
  } else if (!isEditMode.value) {
    enableEditMode()
  }

  // Calculate new end time (keep same duration)
  const oldStart = moment(draggingBooking.value.start)
  const oldEnd = moment(draggingBooking.value.end)
  const duration = oldEnd.diff(oldStart, 'minutes')
  
  const newStart = moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm')
  const newEnd = newStart.clone().add(duration, 'minutes')

  // Update edit form
  editForm.date = date
  editForm.start_time = time
  editForm.end_time = newEnd.format('HH:mm')
  editForm.room_id = roomId

  // Update viewing booking
  if (viewingBooking.value && viewingBooking.value.id === draggingBooking.value.id) {
    viewingBooking.value.room = roomId
    viewingBooking.value.room_id = roomId
    viewingBooking.value.start = `${date} ${time}:00`
    viewingBooking.value.end = `${date} ${newEnd.format('HH:mm')}:00`
  }

  // Update bookings array to reflect the change immediately
  const bookingIndex = bookings.value.findIndex(b => b.id === draggingBooking.value.id)
  if (bookingIndex !== -1) {
    bookings.value[bookingIndex].start = `${date} ${time}:00`
    bookings.value[bookingIndex].end = `${date} ${newEnd.format('HH:mm')}:00`
    bookings.value[bookingIndex].room = roomId
    bookings.value[bookingIndex].room_id = roomId
  }

  // Save changes automatically
  await saveBookingChanges()

  draggingBooking.value = null
  dragOverSlot.value = null
}

const formatSelectedDate = computed(() => {
  if (!selectedDate.value) return ''
  return moment(selectedDate.value).format('dddd, D MMMM YYYY')
})

const resetBookingForm = () => {
  bookingForm.room_id = ''
  bookingForm.name = ''
  bookingForm.description = ''
  bookingForm.start_time = '09:00'
  bookingForm.end_time = '10:00'
  bookingForm.attendees = ''
  bookingForm.attendeesEmails = []
  newAttendeeEmail.value = ''
}

const addAttendee = () => {
  const email = newAttendeeEmail.value.trim()
  if (email && isValidEmail(email) && !bookingForm.attendeesEmails.includes(email)) {
    bookingForm.attendeesEmails.push(email)
    newAttendeeEmail.value = ''
  } else if (email && !isValidEmail(email)) {
    alert('กรุณากรอกอีเมลที่ถูกต้อง')
  }
}

const removeAttendee = (index) => {
  bookingForm.attendeesEmails.splice(index, 1)
}

const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

// Search users for autocomplete
const searchUsers = () => {
  const query = newAttendeeEmail.value.trim()
  
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  // Hide suggestions if query is too short
  if (query.length < 2) {
    showSuggestions.value = false
    userSuggestions.value = []
    selectedSuggestionIndex.value = -1
    return
  }
  
  // Debounce search
  searchTimeout = setTimeout(async () => {
    try {
      const response = await api.get('/users/search', {
        params: { q: query },
      })
      
      if (response.data && response.data.success) {
        userSuggestions.value = response.data.data || []
        showSuggestions.value = userSuggestions.value.length > 0
        selectedSuggestionIndex.value = -1
      }
    } catch (error) {
      console.error('Error searching users:', error)
      userSuggestions.value = []
      showSuggestions.value = false
    }
  }, 300)
}

// Select user from suggestions
const selectUser = (user) => {
  if (user && user.email) {
    if (!bookingForm.attendeesEmails.includes(user.email)) {
      bookingForm.attendeesEmails.push(user.email)
    }
    newAttendeeEmail.value = ''
    showSuggestions.value = false
    userSuggestions.value = []
    selectedSuggestionIndex.value = -1
  }
}

// Handle email input (Enter key)
const handleEmailInput = () => {
  if (selectedSuggestionIndex.value >= 0 && userSuggestions.value[selectedSuggestionIndex.value]) {
    selectUser(userSuggestions.value[selectedSuggestionIndex.value])
  } else {
    addAttendee()
  }
}

// Navigate suggestions with arrow keys
const selectNextSuggestion = () => {
  if (userSuggestions.value.length > 0) {
    selectedSuggestionIndex.value = Math.min(
      selectedSuggestionIndex.value + 1,
      userSuggestions.value.length - 1,
    )
  }
}

const selectPrevSuggestion = () => {
  if (userSuggestions.value.length > 0) {
    selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, 0)
  }
}

// Hide suggestions on blur (with delay to allow click)
const handleInputBlur = () => {
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

const hideSuggestions = () => {
  showSuggestions.value = false
  selectedSuggestionIndex.value = -1
}

const showBookingModal = ref(false)

const openBookingModal = (room, dateStr, time) => {
  selectedDate.value = dateStr
  resetBookingForm()
  bookingForm.room_id = room.id
  bookingForm.start_time = time
  // Set end time 30 minutes after start
  const endTime = moment(time, 'HH:mm').add(30, 'minutes').format('HH:mm')
  bookingForm.end_time = endTime
  showBookingModal.value = true
}

const submitBooking = async () => {
  if (!bookingForm.room_id || !bookingForm.name || !bookingForm.start_time || !bookingForm.end_time) {
    alert('กรุณากรอกข้อมูลที่จำเป็น (ห้อง, ชื่อการจอง, เวลา)')
    return
  }

  if (bookingForm.start_time >= bookingForm.end_time) {
    alert('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น')
    return
  }

  submitting.value = true

  try {
    const startDateTime = `${selectedDate.value} ${bookingForm.start_time}:00`
    const endDateTime = `${selectedDate.value} ${bookingForm.end_time}:00`

    await api.post('/bookings', {
      room_id: bookingForm.room_id,
      name: bookingForm.name,
      description: bookingForm.description,
      start_datetime: startDateTime,
      end_datetime: endDateTime,
      attendees: bookingForm.attendees || 0,
      attendeesEmails: bookingForm.attendeesEmails,
    })

    alert('ส่งคำขอจองห้องเรียบร้อยแล้ว')
    showBookingModal.value = false
    fetchBookingsForRange()
  } catch (error) {
    console.error('Booking error:', error)
    alert(error.response?.data?.message || 'เกิดข้อผิดพลาดในการจอง')
  } finally {
    submitting.value = false
  }
}

const fetchRooms = async () => {
  try {
    const response = await api.get('/rooms')
    rooms.value = response.data.data || []
    // Select all rooms by default
    selectedRooms.value = rooms.value.map(r => r.id)
  } catch (error) {
    console.error('Error fetching rooms:', error)
  }
}

const fetchBookingsForRange = async () => {
  try {
    const response = await api.get('/bookings/calendar', {
      params: {
        start: startDate.value,
        end: endDate.value,
      },
    })
    bookings.value = response.data.data || []
  } catch (error) {
    console.error('Error fetching bookings:', error)
  }
}

const toggleSelectAll = () => {
  if (selectAllRooms.value) {
    selectedRooms.value = rooms.value.map(r => r.id)
  } else {
    selectedRooms.value = []
  }
}

const onRoomSelectionChange = () => {
  selectAllRooms.value = selectedRooms.value.length === rooms.value.length
}

const getSelectedRoomName = () => {
  const room = rooms.value.find(r => r.id === bookingForm.room_id)
  return room ? room.name : ''
}

// View/Edit Modal Functions
const openViewModal = (booking) => {
  viewingBooking.value = booking
  isEditMode.value = false
  // Populate edit form
  editForm.name = booking.name || booking.title || ''
  editForm.objective = booking.objective || ''
  editForm.date = moment(booking.start).format('YYYY-MM-DD')
  editForm.start_time = moment(booking.start).format('HH:mm')
  editForm.end_time = moment(booking.end).format('HH:mm')
  editForm.description = booking.description || ''
  editForm.attendees = booking.attendees || 0
  editForm.room_id = booking.room_id || booking.room || ''
  showViewModal.value = true
}

const closeViewModal = () => {
  showViewModal.value = false
  viewingBooking.value = null
  isEditMode.value = false
}

const enableEditMode = () => {
  isEditMode.value = true
}

const canEditBooking = computed(() => {
  if (!viewingBooking.value) return false
  
  const currentUser = authStore.user
  const userRole = currentUser?.role
  const userId = currentUser?.id
  const bookingUserId = viewingBooking.value.user_id || viewingBooking.value.booker_id || viewingBooking.value.booker
  
  // Admin and super-admin can edit any booking (pending or approved)
  if (userRole === 'admin' || userRole === 'super-admin') {
    return ['pending', 'approved'].includes(viewingBooking.value.status)
  }
  
  // Regular users can only edit their own pending bookings
  if (viewingBooking.value.status === 'pending') {
    if (userId && bookingUserId && userId === bookingUserId) {
      return true
    }
  }
  
  return false
})

const canCancelBooking = computed(() => {
  if (!viewingBooking.value) return false
  // Can cancel if status is pending or approved
  return ['pending', 'approved'].includes(viewingBooking.value.status)
})

const canDragBooking = (booking) => {
  if (!booking) return false
  
  const currentUser = authStore.user
  if (!currentUser) return false
  
  const userRole = currentUser?.role
  const userId = currentUser?.id
  const bookingUserId = booking.user_id || booking.booker_id || booking.booker
  
  // Admin and super-admin can drag any booking (pending or approved)
  if (userRole === 'admin' || userRole === 'super-admin') {
    return ['pending', 'approved'].includes(booking.status)
  }
  
  // Regular users can only drag their own pending bookings
  if (booking.status === 'pending') {
    if (userId && bookingUserId && userId === bookingUserId) {
      return true
    }
  }
  
  return false
}

const saveBookingChanges = async () => {
  if (!viewingBooking.value) return
  
  // Ensure we have the booking ID
  const bookingId = viewingBooking.value.id || viewingBooking.value.booking_id
  if (!bookingId) {
    alert('ไม่พบ ID การจอง')
    return
  }
  
  saving.value = true
  try {
    const startDateTime = `${editForm.date} ${editForm.start_time}:00`
    const endDateTime = `${editForm.date} ${editForm.end_time}:00`

    await api.put(`/bookings/${bookingId}`, {
      title: editForm.name,
      description: editForm.description,
      start_time: startDateTime,
      end_time: endDateTime,
      attendees: editForm.attendees,
      objective: editForm.objective,
      room_id: editForm.room_id || viewingBooking.value.room_id || viewingBooking.value.room,
    })

    alert('บันทึกการเปลี่ยนแปลงเรียบร้อย')
    closeViewModal()
    fetchBookingsForRange()
  } catch (error) {
    console.error('Update error:', error)
    alert(error.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึก')
  } finally {
    saving.value = false9
  }
}

const cancelBooking = async () => {
  if (!viewingBooking.value) return
  
  if (!confirm('คุณต้องการยกเลิกการจองนี้ใช่หรือไม่?')) return

  try {
    await api.post(`/bookings/${viewingBooking.value.id}/cancel`)
    alert('ยกเลิกการจองเรียบร้อย')
    closeViewModal()
    fetchBookingsForRange()
  } catch (error) {
    console.error('Cancel error:', error)
    alert(error.response?.data?.message || 'เกิดข้อผิดพลาดในการยกเลิก')
  }
}

// Generate time options for select
const timeOptions = []
for (let h = 7; h <= 17; h++) {
  timeOptions.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 17) {
    timeOptions.push(`${String(h).padStart(2, '0')}:30`)
  }
}

// Initialize daterangepicker
const initializeDateRangePicker = () => {
  const tryInitialize = async (retries = 0) => {
    if (retries > 10) {
      console.error('Failed to initialize date range picker after maximum retries')
      return
    }
    
    await nextTick()
    
    if (!dateRangeInput.value) {
      console.warn(`Date range input not found, retrying... (${retries}/10)`)
      setTimeout(() => tryInitialize(retries + 1), 100)
      return
    }
    
    try {
      // Ensure moment is available globally
      if (typeof window !== 'undefined') {
        window.moment = window.moment || moment
      }
      
      // Ensure jQuery is available
      if (typeof $ === 'undefined') {
        console.error('jQuery is not available')
        setTimeout(() => tryInitialize(retries + 1), 200)
        return
      }
      
      const inputElement = dateRangeInput.value
      const $input = $(inputElement)
      
      // Check if jQuery wrapped the element properly
      if ($input.length === 0) {
        console.error('Failed to wrap element with jQuery')
        setTimeout(() => tryInitialize(retries + 1), 200)
        return
      }
      
      // Remove existing daterangepicker if any
      if ($input.data('daterangepicker')) {
        console.log('Removing existing daterangepicker')
        $input.data('daterangepicker').remove()
      }
      
      const maxDaysAhead = 30
      const maxDate = today.clone().add(maxDaysAhead, 'days')
      
      // Initialize daterangepicker (same style as room-management-portal)
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
        startDate: moment(),
        endDate: moment(),
      }, (start, end) => {
        console.log('Date range selected:', start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'))
        startDate.value = start.format('YYYY-MM-DD')
        endDate.value = end.format('YYYY-MM-DD')
        fetchBookingsForRange()
      })
      
      // Verify daterangepicker was initialized
      const picker = $input.data('daterangepicker')
      if (picker) {
        console.log('✅ Date range picker initialized successfully')
        console.log('Picker instance:', picker)
        
        // Add manual click handler to ensure it opens
        inputElement.addEventListener('click', () => {
          console.log('Input clicked, showing picker')
          if ($input.data('daterangepicker')) {
            $input.data('daterangepicker').show()
          }
        })
      } else {
        console.error('❌ Daterangepicker was not initialized properly')
        setTimeout(() => tryInitialize(retries + 1), 200)
      }
    } catch (error) {
      console.error('Error initializing date range picker:', error)
      setTimeout(() => tryInitialize(retries + 1), 200)
    }
  }
  
  tryInitialize()
}

const statusLabel = (status) => {
  const labels = {
    'pending': 'รอการอนุมัติ',
    'approved': 'อนุมัติแล้ว',
    'rejected': 'ถูกปฏิเสธ',
    'cancelled': 'ยกเลิกแล้ว',
  }
  return labels[status] || status
}

// Watch for date range changes
watch([startDate, endDate], () => {
  fetchBookingsForRange()
})

onMounted(() => {
  // Ensure moment is available globally before using daterangepicker
  if (typeof window !== 'undefined') {
    window.moment = moment
  }
  
  moment.locale('th')
  fetchRooms()
  initializeDateRangePicker()
  fetchBookingsForRange()
})

onBeforeUnmount(() => {
  // Destroy daterangepicker
  if (dateRangeInput.value) {
    const $input = $(dateRangeInput.value)
    if ($input.data('daterangepicker')) {
      $input.data('daterangepicker').remove()
    }
  }
})
</script>

<template>
  <div class="booking-calendar">
    <!-- Page Header -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="64"
                color="primary"
                variant="flat"
              >
                <VIcon
                  size="32"
                  icon="tabler-calendar"
                />
              </VAvatar>
              <div>
                <h4 class="text-h4 mb-1">
                  ปฏิทินการจอง
                </h4>
                <p class="text-body-2 mb-0">
                  จัดการและดูตารางการจองห้องประชุม
                </p>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Date Range Picker -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <VRow>
              <VCol
                cols="12"
                md="6"
                lg="4"
              >
                <label for="dateRangeCalendar">เลือกช่วงวันที่</label>
                <input
                  ref="dateRangeInput"
                  id="dateRangeCalendar"
                  type="text"
                  class="form-control"
                  style="cursor: pointer;"
                />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- No Room Selected Message -->
    <VRow
      v-if="filteredRooms.length === 0"
      class="mb-4"
    >
      <VCol cols="12">
        <VCard>
          <VCardText class="text-center py-12">
            <VIcon
              size="80"
              icon="tabler-alert-circle"
              color="warning"
              class="mb-4"
            />
            <h5 class="text-h5 mb-2">
              ไม่มีห้องที่เลือก
            </h5>
            <p class="text-body-2">
              กรุณาเลือกห้องที่ต้องการแสดงจากรายการด้านบน
            </p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Schedule Grid with Room Selection -->
    <VRow
      v-show="filteredRooms.length > 0"
      class="mb-4"
    >
      <VCol cols="12">
        <VCard>
          <!-- Room Selection Checkboxes -->
          <VCardTitle>
            <VIcon
              icon="tabler-door-open"
              class="me-2"
            />
            เลือกห้องที่จะแสดง
          </VCardTitle>
          <VCardText>
            <VRow>
              <VCol
                v-for="room in rooms"
                :key="room.id"
                cols="6"
                md="4"
                lg="3"
                xl="2"
              >
                <VCheckbox
                  :id="'room-' + room.id"
                  :model-value="selectedRooms.includes(room.id)"
                  :label="room.name"
                  @update:model-value="(val) => {
                    if (val) {
                      if (!selectedRooms.includes(room.id)) selectedRooms.push(room.id)
                    } else {
                      selectedRooms = selectedRooms.filter(id => id !== room.id)
                    }
                    onRoomSelectionChange()
                  }"
                >
                  <template #prepend>
                    <VIcon
                      icon="tabler-door-open"
                      class="me-2"
                    />
                  </template>
                </VCheckbox>
              </VCol>
              <VCol
                cols="6"
                md="4"
                lg="3"
                xl="2"
              >
                <VCheckbox
                  id="select-all-rooms"
                  :model-value="selectAllRooms"
                  label="เลือกทั้งหมด / ไม่เลือก"
                  @update:model-value="toggleSelectAll"
                >
                  <template #prepend>
                    <VIcon
                      icon="tabler-checkbox"
                      class="me-2"
                    />
                  </template>
                </VCheckbox>
              </VCol>
            </VRow>
          </VCardText>

          <!-- Schedule Grid -->
          <VCardText class="pt-0">
            <div class="schedule-grid">
              <div
                v-for="day in dateRange"
                :key="day.date"
                class="day-schedule mb-4"
              >
                <!-- Day Header -->
                <div
                  class="day-header"
                  :class="'day-' + day.dayOfWeek"
                >
                  <div class="day-badge">
                    <span class="day-name">{{ day.dayName }}</span>
                    <span class="day-date">{{ day.formattedDate }}</span>
                  </div>
                </div>

                <!-- Time Grid -->
                <div class="time-grid-container">
                  <div class="time-grid">
                    <!-- Time Header Row -->
                    <div class="grid-header">
                      <div class="room-column-header">
                        <VIcon
                          icon="tabler-door-open"
                          class="me-2"
                        />
                        ห้อง
                      </div>
                      <div
                        v-for="slot in timeSlots"
                        :key="slot.start"
                        class="time-column-header"
                        :class="{ 'lunch-time': isLunchBreak(slot.start) }"
                      >
                        <span class="time-start">{{ slot.start }}</span>
                        <span class="time-end">{{ slot.end }}</span>
                      </div>
                    </div>

                    <!-- Room Rows -->
                    <div
                      v-for="room in filteredRooms"
                      :key="room.id"
                      class="room-row"
                    >
                      <div class="room-name">
                        <VIcon
                          icon="tabler-building"
                          class="me-2"
                        />
                        {{ room.name }}
                      </div>
                      <div
                        v-for="slot in timeSlots"
                        :key="slot.start"
                        class="time-slot"
                        :class="[...getNewSlotClass(room.id, day.date, slot.start), { 'drag-over': dragOverSlot && dragOverSlot.roomId === room.id && dragOverSlot.date === day.date && dragOverSlot.time === slot.start }]"
                        :style="getSlotStyle(room.id, day.date, slot.start)"
                        @click="handleSlotClick(room, day.date, slot.start)"
                        @dragover="handleDragOver($event, room.id, day.date, slot.start)"
                        @dragleave="handleDragLeave"
                        @drop.prevent="handleDrop(room.id, day.date, slot.start)"
                      >
                        <template v-if="isBookingStartSlot(room.id, day.date, slot.start)">
                          <div
                            class="booking-pill"
                            :class="{ 'dragging': draggingBooking && draggingBooking.id === getBookingForSlot(room.id, day.date, slot.start).id }"
                            :style="getBookingPillStyle(room.id, day.date, slot.start)"
                            :data-span="getBookingSpan(room.id, day.date, slot.start)"
                            :draggable="canDragBooking(getBookingForSlot(room.id, day.date, slot.start))"
                            @mousedown.stop="handleBookingMouseDown(room.id, day.date, slot.start)"
                            @click.stop="handleBookingClick(room.id, day.date, slot.start)"
                            @dragstart="handleDragStart($event, room.id, day.date, slot.start)"
                            @dragend="handleDragEnd"
                          >
                            <span class="booking-title">{{ getBookingForSlot(room.id, day.date, slot.start).name }}</span>
                          </div>
                        </template>
                        <template v-else-if="getBookingForSlot(room.id, day.date, slot.start)">
                          <!-- Empty slot for continuation of booking -->
                        </template>
                        <template v-else-if="!isPastSlot(day.date, slot.start)">
                          <div class="slot-available">
                            <VIcon
                              icon="tabler-plus"
                              size="20"
                            />
                          </div>
                        </template>
                        <template v-else>
                          <div class="slot-past">
                            <VIcon
                              icon="tabler-x"
                              size="16"
                            />
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- View/Edit Booking Dialog -->
    <VDialog
      v-model="showViewModal"
      max-width="700"
      scrollable
    >
      <VCard v-if="viewingBooking">
        <VCardTitle
          :style="{ backgroundColor: getObjectiveColor(viewingBooking.objective), color: '#fff' }"
          class="d-flex align-center justify-space-between"
        >
          <div class="d-flex align-center">
            <VIcon
              icon="tabler-calendar-check"
              class="me-2"
            />
            {{ isEditMode ? 'แก้ไขการจอง' : 'รายละเอียดการจอง' }}
          </div>
          <VBtn
            icon
            variant="text"
            size="small"
            @click="closeViewModal"
          >
            <VIcon icon="tabler-x" />
          </VBtn>
        </VCardTitle>

        <VCardText>
          <!-- Status Badge -->
          <div class="text-center mb-4">
            <VChip
              :color="viewingBooking.status === 'approved' ? 'success' : viewingBooking.status === 'pending' ? 'warning' : 'error'"
              size="large"
            >
              {{ statusLabel(viewingBooking.status) }}
            </VChip>
          </div>

          <VForm @submit.prevent="saveBookingChanges">
            <VRow>
              <!-- Booking Name -->
              <VCol cols="12">
                <AppTextField
                  v-model="editForm.name"
                  label="ชื่อการจอง"
                  :disabled="!isEditMode"
                />
              </VCol>

              <!-- Room -->
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  :model-value="viewingBooking.room_name"
                  label="ห้อง"
                  disabled
                />
              </VCol>

              <!-- Date -->
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model="editForm.date"
                  label="วันที่"
                  type="date"
                  :disabled="!isEditMode"
                />
              </VCol>

              <!-- Start Time -->
              <VCol
                cols="12"
                md="4"
              >
                <AppSelect
                  v-model="editForm.start_time"
                  label="เวลาเริ่ม"
                  :items="timeOptions"
                  :disabled="!isEditMode"
                />
              </VCol>

              <!-- End Time -->
              <VCol
                cols="12"
                md="4"
              >
                <AppSelect
                  v-model="editForm.end_time"
                  label="เวลาสิ้นสุด"
                  :items="timeOptions"
                  :disabled="!isEditMode"
                />
              </VCol>

              <!-- Description -->
              <VCol cols="12">
                <AppTextarea
                  v-model="editForm.description"
                  label="รายละเอียด"
                  rows="3"
                  :disabled="!isEditMode"
                />
              </VCol>

              <!-- Booker Info -->
              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  :model-value="viewingBooking.booker_name"
                  label="ผู้จอง"
                  disabled
                />
              </VCol>

              <!-- Attendees -->
            </VRow>
          </VForm>
        </VCardText>

        <VCardActions class="d-flex justify-space-between">
          <div>
            <VBtn
              v-if="canCancelBooking && !isEditMode"
              color="error"
              variant="outlined"
              @click="cancelBooking"
            >
              <VIcon
                icon="tabler-x-circle"
                class="me-2"
              />
              ยกเลิกการจอง
            </VBtn>
          </div>
          <div class="d-flex gap-2">
            <VBtn
              variant="outlined"
              @click="closeViewModal"
            >
              ปิด
            </VBtn>
            <VBtn
              v-if="canEditBooking && !isEditMode"
              color="warning"
              @click="enableEditMode"
            >
              <VIcon
                icon="tabler-pencil"
                class="me-2"
              />
              แก้ไข
            </VBtn>
            <VBtn
              v-if="isEditMode"
              color="success"
              :loading="saving"
              @click="saveBookingChanges"
            >
              <VIcon
                icon="tabler-check"
                class="me-2"
              />
              บันทึก
            </VBtn>
          </div>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- New Booking Dialog -->
    <VDialog
      v-model="showBookingModal"
      max-width="800"
      scrollable
      :style="{ 'overflow-visible': true }"
    >
      <VCard>
        <VCardTitle class="bg-primary text-white d-flex align-center justify-space-between">
          <div class="d-flex align-center">
            <VIcon
              icon="tabler-calendar-plus"
              class="me-2"
            />
            จองห้องประชุม
          </div>
          <VBtn
            icon
            variant="text"
            size="small"
            @click="showBookingModal = false"
          >
            <VIcon icon="tabler-x" />
          </VBtn>
        </VCardTitle>

        <VCardText>
          <!-- Selected Date Display -->
          <VAlert
            type="info"
            class="mb-4"
          >
            <VIcon
              icon="tabler-calendar-check"
              class="me-2"
            />
            <strong>วันที่เลือก:</strong> {{ formatSelectedDate }}
          </VAlert>

          <VForm @submit.prevent="submitBooking">
            <VRow>
              <!-- Room Display -->
              <VCol cols="12">
                <AppTextField
                  :model-value="getSelectedRoomName()"
                  label="ห้องประชุม"
                  readonly
                />
              </VCol>

              <!-- Title -->
              <VCol cols="12">
                <AppTextField
                  v-model="bookingForm.name"
                  label="ชื่อการจอง"
                  placeholder="ระบุชื่อการจอง"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <!-- Time Selection -->
              <VCol
                cols="12"
                md="6"
              >
                <AppSelect
                  v-model="bookingForm.start_time"
                  label="เวลาเริ่ม"
                  :items="timeOptions"
                  :rules="[requiredValidator]"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <AppSelect
                  v-model="bookingForm.end_time"
                  label="เวลาสิ้นสุด"
                  :items="timeOptions"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <!-- Description -->
              <VCol cols="12">
                <AppTextarea
                  v-model="bookingForm.description"
                  label="รายละเอียด"
                  rows="3"
                  placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                />
              </VCol>

              <!-- Attendees Emails -->
              <VCol cols="12">
                <div class="position-relative">
                  <div ref="emailInputRef">
                    <AppTextField
                      v-model="newAttendeeEmail"
                      label="อีเมลผู้เข้าร่วม"
                      placeholder="ค้นหาหรือกรอกอีเมลผู้เข้าร่วม"
                      @input="searchUsers"
                      @keyup.enter="handleEmailInput"
                      @keydown.down.prevent="selectNextSuggestion"
                      @keydown.up.prevent="selectPrevSuggestion"
                      @keydown.escape="hideSuggestions"
                      @blur="handleInputBlur"
                    >
                      <template #append-inner>
                        <VBtn
                          icon
                          size="small"
                          variant="text"
                          @click="addAttendee"
                        >
                          <VIcon icon="tabler-plus" />
                        </VBtn>
                      </template>
                    </AppTextField>
                  </div>

                  <!-- Suggestions Dropdown -->
                  <VCard
                    v-if="showSuggestions && userSuggestions.length > 0"
                    class="suggestions-dropdown"
                    elevation="8"
                  >
                    <VList density="compact">
                      <VListItem
                        v-for="(user, index) in userSuggestions"
                        :key="user.id"
                        :class="{ 'bg-primary-lighten-5': selectedSuggestionIndex === index }"
                        @click="selectUser(user)"
                        class="cursor-pointer"
                      >
                        <VListItemTitle>{{ user.name }}</VListItemTitle>
                        <VListItemSubtitle>{{ user.email }}</VListItemSubtitle>
                      </VListItem>
                    </VList>
                  </VCard>

                  <!-- Attendees Tags -->
                  <div
                    v-if="bookingForm.attendeesEmails.length > 0"
                    class="d-flex flex-wrap gap-2 mt-2"
                  >
                    <VChip
                      v-for="(email, index) in bookingForm.attendeesEmails"
                      :key="index"
                      closable
                      @click:close="removeAttendee(index)"
                    >
                      {{ email }}
                    </VChip>
                  </div>
                  <div class="text-caption text-disabled mt-1">
                    ค้นหาหรือกรอกอีเมลผู้เข้าร่วม (ไม่บังคับ)
                  </div>
                </div>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VCardActions>
          <VSpacer />
          <VBtn
            variant="outlined"
            @click="showBookingModal = false"
          >
            <VIcon
              icon="tabler-x-circle"
              class="me-2"
            />
            ยกเลิก
          </VBtn>
          <VBtn
            color="primary"
            :loading="submitting"
            @click="submitBooking"
          >
            <VIcon
              icon="tabler-check-circle"
              class="me-2"
            />
            ยืนยันการจอง
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.booking-calendar {
  padding: 0;
}

.form-control {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
  color: #212529;
  background-color: #fff;
  background-clip: padding-box;
  border: 1px solid #ced4da;
  appearance: none;
  border-radius: 0.375rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus {
  color: #212529;
  background-color: #fff;
  border-color: #86b7fe;
  outline: 0;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

/* Ensure daterangepicker is visible */
:deep(.daterangepicker) {
  z-index: 9999 !important;
  display: block !important;
}

/* Schedule Grid Styles */
.schedule-grid {
  display: flex;
  flex-direction: column;
  gap: 28px;
  width: 100%;
}

.day-schedule {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  border: 1px solid rgba(102, 126, 234, 0.08);
  transition: all 0.3s ease;
  width: 100%;
}

.day-schedule:hover {
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.18), 0 4px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

/* Day Header Styles */
.day-header {
  padding: 20px 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.day-header.day-0 { background: linear-gradient(135deg, #FF6B6B 0%, #EE5A5A 50%, #D64545 100%); }
.day-header.day-1 { background: linear-gradient(135deg, #FFE066 0%, #FFD93D 50%, #F4C430 100%); }
.day-header.day-2 { background: linear-gradient(135deg, #FF9FF3 0%, #F368E0 50%, #E056C7 100%); }
.day-header.day-3 { background: linear-gradient(135deg, #58D68D 0%, #2ECC71 50%, #27AE60 100%); }
.day-header.day-4 { background: linear-gradient(135deg, #FF8C42 0%, #FF6B35 50%, #E85D2C 100%); }
.day-header.day-5 { background: linear-gradient(135deg, #5DADE2 0%, #3498DB 50%, #2E86C1 100%); }
.day-header.day-6 { background: linear-gradient(135deg, #BB8FCE 0%, #9B59B6 50%, #8E44AD 100%); }

.day-badge {
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}

.day-name {
  font-size: 1.6rem;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  letter-spacing: -0.5px;
}

.day-date {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
  margin-top: 2px;
}

/* Time Grid Container */
.time-grid-container {
  overflow-x: auto;
  padding: 0;
  margin: 0;
  scrollbar-width: thin;
  scrollbar-color: #667eea #f1f1f1;
  background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
  width: 100%;
}

.time-grid-container::-webkit-scrollbar {
  height: 10px;
}

.time-grid-container::-webkit-scrollbar-track {
  background: linear-gradient(90deg, #f1f1f1, #e9ecef);
  border-radius: 5px;
}

.time-grid-container::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 5px;
  border: 2px solid #f1f1f1;
}

.time-grid {
  display: flex;
  flex-direction: column;
  width: 100%;
  flex-shrink: 0;
}

/* Grid Header */
.grid-header {
  display: flex;
  background: linear-gradient(180deg, #f8f9fa 0%, #eef1f5 100%);
  border-bottom: 3px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 10;
  width: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
}

.room-column-header {
  width: 250px;
  min-width: 250px;
  max-width: 250px;
  padding: 14px 18px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, #667eea 0%, #5a67d8 100%);
  color: #fff;
  font-size: 1rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  box-shadow: 2px 0 8px rgba(102, 126, 234, 0.2);
  box-sizing: border-box;
}

.time-column-header {
  flex: 1;
  min-width: 58px;
  padding: 14px 6px;
  text-align: center;
  font-weight: 700;
  color: #4a5568;
  border-left: 1px solid #e2e8f0;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff;
  transition: filter 0.2s ease, opacity 0.2s ease;
  flex-shrink: 0;
  box-sizing: border-box;
}

.time-column-header:hover {
  background: #f7fafc;
}

.time-column-header.lunch-time {
  background: linear-gradient(180deg, #FFF9E6 0%, #FFE8A3 100%);
  color: #B7791F;
  border-left-color: #ECC94B;
}

.time-start {
  font-weight: 800;
  color: #2d3748;
  font-size: 0.9rem;
}

.time-end {
  font-weight: 600;
  color: #718096;
  font-size: 0.85rem;
  margin-top: 2px;
}

/* Room Rows */
.room-row {
  display: flex;
  border-bottom: 1px solid #edf2f7;
  transition: all 0.25s ease;
  width: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
  position: relative;
}

.room-row:nth-child(even) {
  background: rgba(102, 126, 234, 0.02);
}

.room-row:hover {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.08) 0%, rgba(102, 126, 234, 0.03) 100%);
}

.room-row:last-child {
  border-bottom: none;
}

.room-name {
  width: 250px;
  min-width: 250px;
  max-width: 250px;
  padding: 14px 18px;
  font-weight: 700;
  color: #2d3748;
  background: linear-gradient(90deg, #f8fafc 0%, #fff 100%);
  display: flex;
  align-items: center;
  gap: 12px;
  border-right: 3px solid #e2e8f0;
  font-size: 0.95rem;
  white-space: nowrap;
  position: sticky;
  left: 0;
  z-index: 5;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
}

/* Time Slots */
.time-slot {
  flex: 1;
  min-width: 58px;
  height: 52px;
  border-left: 1px solid #edf2f7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: none !important;
  position: static;
  flex-shrink: 0;
  box-sizing: border-box;
}

.time-slot.available-slot {
  background: #fff;
}

.time-slot.available-slot:hover {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.18) 0%, rgba(118, 75, 162, 0.12) 100%);
}

.slot-available {
  opacity: 0;
  transition: all 0.3s ease;
}

.time-slot.available-slot:hover .slot-available {
  opacity: 1;
}

/* Past Slots */
.time-slot.past-slot {
  background: repeating-linear-gradient(
    -45deg,
    #f7fafc,
    #f7fafc 4px,
    #edf2f7 4px,
    #edf2f7 8px
  );
  cursor: not-allowed;
  opacity: 0.7;
}

.slot-past {
  opacity: 0.4;
}

/* Lunch Slots */
.time-slot.lunch-slot {
  background: linear-gradient(180deg, rgba(236, 201, 75, 0.12) 0%, rgba(236, 201, 75, 0.06) 100%);
}

.time-slot.lunch-slot.available-slot:hover {
  background: linear-gradient(135deg, rgba(236, 201, 75, 0.3) 0%, rgba(236, 201, 75, 0.15) 100%);
}

/* Booked Slots */
.time-slot.booked-slot {
  cursor: pointer;
  border-radius: 0;
  margin: 0;
  padding: 0;
  flex: 1;
  min-width: 58px;
  box-shadow: none;
  box-sizing: border-box;
  position: static;
  overflow: visible;
  border-left: none !important;
  background: transparent !important;
}

.time-slot.drag-over {
  background: rgba(102, 126, 234, 0.2) !important;
  border: 2px dashed #667eea !important;
  border-radius: 8px;
}

.booking-pill {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: none !important;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: inset 0 0 0 0 rgba(0, 0, 0, 0.1);
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  min-width: 60px;
  box-sizing: border-box;
  contain: strict !important;
  isolation: isolate;
  will-change: auto;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: translateZ(0) !important;
  -webkit-transform: translateZ(0) !important;
  margin: 0 !important;
  right: auto !important;
  bottom: auto !important;
}

.booking-pill:hover {
  filter: brightness(1.15) !important;
  opacity: 0.98 !important;
  z-index: 5 !important;
  box-shadow: none !important;
  transform: translateZ(0) !important;
  -webkit-transform: translateZ(0) !important;
  margin: 0 !important;
  padding: 6px 10px !important;
  transition: none !important;
  contain: layout style paint !important;
}

.booking-pill.dragging {
  opacity: 0.5;
  cursor: grabbing;
  transform: scale(0.95);
}

.booking-pill[draggable="true"] {
  cursor: grab !important;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.3);
  transition: filter 0.2s ease, opacity 0.2s ease;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  pointer-events: auto;
}

.booking-pill[draggable="true"]:hover {
  cursor: grab !important;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.6);
  filter: brightness(1.15);
  opacity: 0.98;
  transform: none;
}

.booking-pill[draggable="true"]:active {
  cursor: grabbing !important;
}

.booking-title {
  font-size: 0.78rem;
  font-weight: 700;
  overflow: visible;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  letter-spacing: 0.3px;
  color: #fff;
  display: block;
  text-align: center;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.suggestions-dropdown {
  position: absolute !important;
  top: 100% !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 9999 !important;
  margin-top: 4px !important;
  max-height: 300px !important;
  overflow-y: auto !important;
  border-radius: 4px !important;
  background: rgb(var(--v-theme-surface)) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  width: 100% !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

.suggestions-dropdown .v-list {
  padding: 0 !important;
  background: rgb(var(--v-theme-surface)) !important;
}

.suggestions-dropdown .v-list-item {
  min-height: 48px !important;
}

.suggestions-dropdown .v-list-item-title {
  font-size: 0.875rem !important;
  font-weight: 500 !important;
}

.suggestions-dropdown .v-list-item-subtitle {
  font-size: 0.75rem !important;
  opacity: 0.7 !important;
}

.cursor-pointer {
  cursor: pointer !important;
}

/* Ensure dropdown is visible in modal */
.v-dialog .v-card-text {
  overflow: visible !important;
}

.v-dialog .v-card {
  overflow: visible !important;
}

.v-dialog__content {
  overflow: visible !important;
}

/* Ensure parent container allows overflow */
.position-relative {
  overflow: visible !important;
}
</style>
