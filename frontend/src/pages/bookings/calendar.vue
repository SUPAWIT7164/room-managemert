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

// Date range - default to today only (string-based, NO Date object)
// Get today's date as string "YYYY-MM-DD"
const getTodayString = () => {
  const now = new Date() // Only use Date for getting current date (not for parsing booking times)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const startDate = ref(getTodayString())
const endDate = ref(getTodayString())

// Log date range for debugging
watch([startDate, endDate], ([newStart, newEnd]) => {
  console.log('[Calendar] Date range changed:', { start: newStart, end: newEnd })
})

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

// Generate time slots from 07:00 to 20:00 with 30-minute intervals (extended to show bookings up to 19:00)
const timeSlots = []
for (let h = 7; h < 20; h++) {
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
  const filtered = rooms.value.filter(room => selectedRooms.value.includes(String(room.id)))
  console.log('[Calendar] Filtered rooms:', filtered.length, 'out of', rooms.value.length, 'rooms')
  console.log('[Calendar] Selected room IDs:', selectedRooms.value)
  return filtered
})

// Computed: date range array (string-based, NO Date object)
const dateRange = computed(() => {
  const dates = []
  const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
  
  // Parse start and end dates (YYYY-MM-DD format)
  const parseDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return { year, month, day }
  }
  
  const formatDate = (year, month, day) => {
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  
  const formatDateDDMMYYYY = (year, month, day) => {
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  }
  
  const getDayOfWeek = (year, month, day) => {
    // Use Date only for getting day of week (not for parsing booking times)
    const date = new Date(year, month - 1, day)
    return date.getDay()
  }
  
  const start = parseDate(startDate.value)
  const end = parseDate(endDate.value)
  
  // Generate dates between start and end (inclusive)
  let current = { ...start }
  
  while (true) {
    const currentDateStr = formatDate(current.year, current.month, current.day)
    const endDateStr = formatDate(end.year, end.month, end.day)
    
    if (currentDateStr > endDateStr) break
    
    const dayOfWeek = getDayOfWeek(current.year, current.month, current.day)
    
    dates.push({
      date: currentDateStr,
      dayOfWeek: dayOfWeek,
      dayName: dayNames[dayOfWeek],
      formattedDate: formatDateDDMMYYYY(current.year, current.month, current.day),
    })
    
    // Move to next day
    current.day++
    if (current.day > new Date(current.year, current.month, 0).getDate()) {
      current.day = 1
      current.month++
      if (current.month > 12) {
        current.month = 1
        current.year++
      }
    }
  }
  
  console.log('[Calendar] Date range computed:', {
    start: startDate.value,
    end: endDate.value,
    dates: dates.map(d => d.date)
  })
  
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

// Get booking status (ongoing, upcoming, completed) - like old project
const getBookingStatus = (booking) => {
  if (!booking) return 'upcoming'
  
  const bookingStartTime = booking.start_datetime || booking.start || booking.start_time
  const bookingEndTime = booking.end_datetime || booking.end || booking.end_time
  
  if (!bookingStartTime || !bookingEndTime) return 'upcoming'
  
  // Parse datetime as local time using helper function (string-based, NO Date object)
  const bookingStartParsed = parseLocalDateTime(bookingStartTime)
  const bookingEndParsed = parseLocalDateTime(bookingEndTime)
  
  if (!bookingStartParsed || !bookingStartParsed.isValid || !bookingEndParsed || !bookingEndParsed.isValid) {
    return 'upcoming'
  }
  
  // Compare with current time using string-based comparison
  // Get current time as string "YYYY-MM-DD HH:mm:ss" format
  const now = moment() // Keep moment() only for getting current time (not for parsing booking times)
  const nowString = now.format('YYYY-MM-DD HH:mm:ss')
  const nowParsed = parseLocalDateTime(nowString)
  
  if (!nowParsed || !nowParsed.isValid) {
    return 'upcoming'
  }
  
  // Compare dates and times using string comparison
  // Format: "YYYY-MM-DD HH:mm"
  const bookingStartFull = `${bookingStartParsed.date} ${bookingStartParsed.time}`
  const bookingEndFull = `${bookingEndParsed.date} ${bookingEndParsed.time}`
  const nowFull = `${nowParsed.date} ${nowParsed.time}`
  
  if (nowFull >= bookingStartFull && nowFull <= bookingEndFull) {
    return 'ongoing'
  } else if (nowFull > bookingEndFull) {
    return 'completed'
  } else {
    return 'upcoming'
  }
}

// Get status text for display
const getStatusText = (status) => {
  const statusMap = {
    'ongoing': '🟢 กำลังดำเนินการ',
    'upcoming': '🟡 กำลังจะเริ่ม',
    'completed': '⚫ เสร็จสิ้นแล้ว'
  }
  return statusMap[status] || '❓ ไม่ทราบสถานะ'
}

const isLunchBreak = (time) => {
  return time === '12:00' || time === '12:30'
}

const isPastSlot = (date, time) => {
  // Get current time as string "YYYY-MM-DD HH:mm:ss" format
  // Note: Using moment() only for getting current time (not for parsing booking times)
  const now = moment()
  const nowString = now.format('YYYY-MM-DD HH:mm:ss')
  const nowParsed = parseLocalDateTime(nowString)
  
  if (!nowParsed || !nowParsed.isValid) {
    return false
  }
  
  // Compare using string comparison (YYYY-MM-DD HH:mm format)
  const slotFull = `${date} ${time}`
  const nowFull = `${nowParsed.date} ${nowParsed.time}`
  
  return slotFull < nowFull
}

// Debug counter to track matching attempts
let debugMatchCount = 0
const MAX_DEBUG_LOGS = 50 // Increase to see more matches

// Helper function to parse datetime string as local time (NO Date object, NO timezone conversion)
// Returns: { date: 'YYYY-MM-DD', time: 'HH:mm', hour: 'HH', minute: 'mm', full: 'YYYY-MM-DD HH:mm:ss' }
const parseLocalDateTime = (dateTimeValue) => {
  if (!dateTimeValue) return null
  
  // Only accept string input - no Date object, no moment object
  if (typeof dateTimeValue !== 'string') {
    console.warn('[parseLocalDateTime] Non-string input:', dateTimeValue)
    return null
  }
  
  // Extract date and time parts from string (no timezone conversion)
  // Support formats: "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm", "YYYY-MM-DDTHH:mm:ss", "YYYY-MM-DDTHH:mm:ssZ"
  let datePart = ''
  let timePart = ''
  
  // Handle ISO format with T or Z
  if (dateTimeValue.includes('T') || dateTimeValue.includes('Z')) {
    const match = dateTimeValue.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)/)
    if (match) {
      datePart = match[1]
      timePart = match[2].substring(0, 8) // Take only HH:mm:ss (ignore milliseconds)
    } else {
      console.warn('[parseLocalDateTime] Invalid ISO format:', dateTimeValue)
      return null
    }
  } else if (dateTimeValue.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)) {
    // Format: "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss"
    const parts = dateTimeValue.split(' ')
    if (parts.length >= 2) {
      datePart = parts[0]
      timePart = parts[1].substring(0, 8) // Take only HH:mm:ss
    } else {
      console.warn('[parseLocalDateTime] Invalid format:', dateTimeValue)
      return null
    }
  } else {
    console.warn('[parseLocalDateTime] Unsupported format:', dateTimeValue)
    return null
  }
  
  // Validate format
  if (!datePart.match(/^\d{4}-\d{2}-\d{2}$/) || !timePart.match(/^\d{2}:\d{2}:\d{2}$/)) {
    console.warn('[parseLocalDateTime] Invalid date/time parts:', { datePart, timePart })
    return null
  }
  
  // Extract hour and minute
  const hour = timePart.substring(0, 2)
  const minute = timePart.substring(3, 5)
  const timeHHmm = `${hour}:${minute}`
  
  // Return object with string-based values (NO Date object)
  return {
    date: datePart,
    time: timeHHmm, // HH:mm format
    hour: hour,
    minute: minute,
    full: `${datePart} ${timePart}`, // YYYY-MM-DD HH:mm:ss
    isValid: true
  }
}

const getBookingForSlot = (roomId, date, time) => {
  // Early return if no bookings or rooms
  if (!bookings.value.length || !rooms.value.length) {
    return null
  }
  
  // Find the room to check auto_approve setting
  const room = rooms.value.find(r => String(r.id) === String(roomId))
  if (!room) {
    return null
  }
  const roomAutoApprove = room ? (room.auto_approve === 1 || room.auto_approve === true) : false
  
  // Debug: Log when checking for specific booking (ID 154) at 11:30
  if (debugMatchCount < MAX_DEBUG_LOGS && time === '11:30' && date === '2026-01-26') {
    console.log(`[Calendar] 🔍 getBookingForSlot called for slot ${time}`, {
      roomId,
      date,
      time,
      totalBookings: bookings.value.length,
      bookingsForRoom: bookings.value.filter(b => {
        const bookingRoomId = b.room_id || b.room
        return String(bookingRoomId) === String(roomId)
      }).map(b => ({
        id: b.id,
        name: b.name || b.title,
        start_datetime: b.start_datetime || b.start || b.start_time,
        status: b.status
      }))
    })
    debugMatchCount++
  }
  
  const booking = bookings.value.find(b => {
    // Check if booking matches room
    const bookingRoomId = b.room_id || b.room
    if (String(bookingRoomId) !== String(roomId)) return false
    
    // Get booking start and end times (support multiple field names)
    const bookingStartTime = b.start_datetime || b.start || b.start_time
    const bookingEndTime = b.end_datetime || b.end || b.end_time
    
    if (!bookingStartTime || !bookingEndTime) {
      if (debugMatchCount < MAX_DEBUG_LOGS) {
        console.warn('[Calendar] Booking missing start/end time:', { booking: b.id, roomId, date, time })
        debugMatchCount++
      }
      return false
    }
    
    // Parse datetime as local time using helper function (string-based, NO Date object)
    const bookingStartParsed = parseLocalDateTime(bookingStartTime)
    const bookingEndParsed = parseLocalDateTime(bookingEndTime)
    
    if (!bookingStartParsed || !bookingStartParsed.isValid || !bookingEndParsed || !bookingEndParsed.isValid) {
      if (debugMatchCount < MAX_DEBUG_LOGS) {
        console.warn('[Calendar] Invalid datetime parsing:', { 
          booking: b.id, 
          bookingStartTime, 
          bookingEndTime,
          startValid: bookingStartParsed?.isValid,
          endValid: bookingEndParsed?.isValid
        })
        debugMatchCount++
      }
      return false
    }
    
    // Check if booking matches date (string comparison)
    const bookingDate = bookingStartParsed.date
    if (bookingDate !== date) {
      if (debugMatchCount < MAX_DEBUG_LOGS && String(bookingRoomId) === String(roomId)) {
        console.log(`[Calendar] Date mismatch: booking date ${bookingDate} !== slot date ${date}`, { 
          booking: b.id, 
          roomId,
          originalStartTime: bookingStartTime,
          parsedDate: bookingDate,
          slotDate: date
        })
        debugMatchCount++
      }
      return false
    }
    
    // Check if booking matches time slot (only show at start slot, like old project)
    // Use string-based time comparison (HH:mm format)
    const bookingStart = bookingStartParsed.time // Already in HH:mm format
    const bookingEnd = bookingEndParsed.time // Already in HH:mm format
    
    // Only match if this is the start slot of the booking (like old project)
    if (time !== bookingStart) {
      // Debug: Log time mismatch for bookings that should match
      if (debugMatchCount < MAX_DEBUG_LOGS && String(bookingRoomId) === String(roomId) && bookingDate === date) {
        console.log(`[Calendar] ⚠️ Time mismatch for booking ${b.id}:`, {
          slotTime: time,
          bookingStart,
          bookingStartTime,
          parsedBookingStart: bookingStart,
          bookingName: b.name || b.title,
          roomId,
          date
        })
        debugMatchCount++
      }
      return false
    }
    
    // Filter by approval status - new structure: status BIT (1 = approved, 0/NULL = pending), cancel BIT, reject BIT
    const bookingStatus = b.status
    const isCancelled = b.cancel === 1 || b.cancel === true
    const isRejected = b.reject === 1 || b.reject === true
    
    // Check if approved: status === 1, 'approved', 'confirmed', or true
    const isApproved = (
      bookingStatus === 1 || 
      bookingStatus === 'approved' || 
      bookingStatus === 'confirmed' || 
      bookingStatus === true ||
      bookingStatus === '1'
    )
    
    // Check if pending: status === null, undefined, 0, 'pending', '0', false
    const isPending = (
      bookingStatus === null || 
      bookingStatus === undefined || 
      bookingStatus === 0 || 
      bookingStatus === 'pending' || 
      bookingStatus === '0' ||
      bookingStatus === false ||
      (typeof bookingStatus === 'string' && bookingStatus.toLowerCase() === 'pending')
    )
    
    // If room has auto-approve, show all bookings (approved, pending, or null status) that are not cancelled/rejected
    // If room requires approval, show only approved bookings that are not cancelled/rejected
    let statusMatch = false
    if (roomAutoApprove) {
      // Room with auto-approve: show all bookings (approved, pending, or null status) that are not cancelled/rejected
      if (isCancelled || isRejected) {
        statusMatch = false
      } else {
        // Show all bookings that are not cancelled/rejected (approved, pending, or null)
        statusMatch = true
      }
    } else {
      // Room requires approval: show only approved bookings that are not cancelled/rejected
      if (isCancelled || isRejected) {
        statusMatch = false
      } else {
        // Show only approved bookings (status === 1)
        statusMatch = isApproved
      }
    }
    
    if (!statusMatch && debugMatchCount < MAX_DEBUG_LOGS) {
      console.log(`[Calendar] Status mismatch for booking ${b.id}:`, {
        bookingStatus,
        statusLower,
        isCancelled,
        isRejected,
        roomAutoApprove,
        roomId,
        date,
        time
      })
      debugMatchCount++
    }
    
    return statusMatch
  })
  
  if (booking) {
    if (debugMatchCount < MAX_DEBUG_LOGS) {
      const matchedStartParsed = parseLocalDateTime(booking.start_datetime || booking.start || booking.start_time)
      const matchedEndParsed = parseLocalDateTime(booking.end_datetime || booking.end || booking.end_time)
      console.log(`[Calendar] ✅ Matched booking ${booking.id} for room ${roomId}, date ${date}, time ${time}`, {
        bookingName: booking.name || booking.title,
        bookingStart: matchedStartParsed?.time || 'N/A',
        bookingEnd: matchedEndParsed?.time || 'N/A',
        bookingStatus: booking.status || booking.booking_status || booking.approval_status || 'null',
        roomAutoApprove
      })
      debugMatchCount++
    }
    return booking
  }
  
  return null
}

const isBookingStartSlot = (roomId, date, time) => {
  // Debug: Log when checking for booking 154 at 11:30
  if (debugMatchCount < MAX_DEBUG_LOGS && time === '11:30' && date === '2026-01-26' && roomId === '30') {
    console.log(`[Calendar] 🔍 isBookingStartSlot called for slot ${time}`, {
      roomId,
      date,
      time
    })
    debugMatchCount++
  }
  
  const booking = getBookingForSlot(roomId, date, time)
  if (!booking) {
    // Debug: Log why booking is not found for this slot
    if (debugMatchCount < MAX_DEBUG_LOGS) {
      const allBookingsForRoom = bookings.value.filter(b => {
        const bookingRoomId = b.room_id || b.room
        return String(bookingRoomId) === String(roomId)
      })
      const bookingsForDate = allBookingsForRoom.filter(b => {
        const bookingStartTime = b.start_datetime || b.start || b.start_time
        if (!bookingStartTime) return false
        const bookingStartParsed = parseLocalDateTime(bookingStartTime)
        if (!bookingStartParsed || !bookingStartParsed.isValid) return false
        const bookingDate = bookingStartParsed.date
        return bookingDate === date
      })
      if (bookingsForDate.length > 0) {
        console.log(`[Calendar] ⚠️ isBookingStartSlot: No booking found for slot ${time}`, {
          roomId,
          date,
          time,
          'Bookings for this room/date': bookingsForDate.map(b => {
            const parsed = parseLocalDateTime(b.start_datetime || b.start || b.start_time)
            return {
              id: b.id,
              name: b.name || b.title,
              start: parsed?.time || 'N/A',
              status: b.status
            }
          })
        })
        debugMatchCount++
      }
    }
    return false
  }
  const bookingStartTimeValue = booking.start_datetime || booking.start || booking.start_time
  if (!bookingStartTimeValue) {
    console.warn('[Calendar] isBookingStartSlot: booking missing start time', { booking: booking.id, roomId, date, time })
    return false
  }
  
  // Parse datetime as local time using helper function (string-based, NO Date object)
  const bookingStartParsed = parseLocalDateTime(bookingStartTimeValue)
  
  if (!bookingStartParsed || !bookingStartParsed.isValid) {
    console.warn('[Calendar] isBookingStartSlot: Invalid booking start time', { booking: booking.id, bookingStartTimeValue })
    return false
  }
  
  // Use string-based time comparison (HH:mm format)
  const bookingStart = bookingStartParsed.time // Already in HH:mm format
  const isStart = time === bookingStart
  
  // Debug: Log all calls for booking 154 at 11:30
  if (debugMatchCount < MAX_DEBUG_LOGS && booking.id === '154' && time === '11:30') {
    console.log(`[Calendar] 🎯 isBookingStartSlot check for booking ${booking.id}:`, {
      roomId,
      date,
      time,
      bookingStart,
      originalTime: bookingStartTimeValue,
      parsedTime: bookingStart,
      bookingName: booking.name || booking.title,
      isStart,
      timeMatch: time === bookingStart,
      timeType: typeof time,
      bookingStartType: typeof bookingStart
    })
    debugMatchCount++
  }
  
  // Debug first few matches
  if (isStart && debugMatchCount < MAX_DEBUG_LOGS) {
    console.log(`[Calendar] 🎯 isBookingStartSlot: TRUE for booking ${booking.id}`, {
      roomId,
      date,
      time,
      bookingStart,
      originalTime: bookingStartTimeValue,
      parsedTime: bookingStart,
      bookingName: booking.name || booking.title
    })
    debugMatchCount++
  }
  
  return isStart
}

// Check if a slot is part of a booking (but not the start slot)
const isSlotPartOfBooking = (roomId, date, time) => {
  // Check all bookings to see if this slot is within any booking's time range
  if (!bookings.value.length) return false
  
  const room = rooms.value.find(r => String(r.id) === String(roomId))
  if (!room) return false
  
  // Check if this slot is part of any booking (but not the start slot)
  for (const booking of bookings.value) {
    const bookingRoomId = booking.room_id || booking.room
    if (String(bookingRoomId) !== String(roomId)) continue
    
    const bookingStartTime = booking.start_datetime || booking.start || booking.start_time
    const bookingEndTime = booking.end_datetime || booking.end || booking.end_time
    
    if (!bookingStartTime || !bookingEndTime) continue
    
    // Parse datetime as local time using helper function (string-based, NO Date object)
    const bookingStartParsed = parseLocalDateTime(bookingStartTime)
    const bookingEndParsed = parseLocalDateTime(bookingEndTime)
    
    if (!bookingStartParsed || !bookingStartParsed.isValid || !bookingEndParsed || !bookingEndParsed.isValid) {
      continue
    }
    
    const bookingDate = bookingStartParsed.date
    if (bookingDate !== date) continue
    
    // Use string-based time comparison (HH:mm format)
    const bookingStart = bookingStartParsed.time // Already in HH:mm format
    const bookingEnd = bookingEndParsed.time // Already in HH:mm format
    
    // Check if this slot is within the booking range but not the start slot
    // String comparison works for HH:mm format (e.g., "11:30" > "11:00" && "11:30" < "12:00")
    if (time > bookingStart && time < bookingEnd) {
      // Check status (same logic as getBookingForSlot) - new structure
      const bookingStatus = booking.status
      const isCancelled = booking.cancel === 1 || booking.cancel === true
      const isRejected = booking.reject === 1 || booking.reject === true
      
      // Check if approved: status === 1, 'approved', 'confirmed', or true
      const isApproved = (
        bookingStatus === 1 || 
        bookingStatus === 'approved' || 
        bookingStatus === 'confirmed' || 
        bookingStatus === true ||
        bookingStatus === '1'
      )
      
      const roomAutoApprove = room ? (room.auto_approve === 1 || room.auto_approve === true) : false
      
      let statusMatch = false
      if (roomAutoApprove) {
        // Room with auto-approve: show all bookings that are not cancelled/rejected
        if (isCancelled || isRejected) {
          statusMatch = false
        } else {
          statusMatch = true
        }
      } else {
        // Room requires approval: show only approved bookings that are not cancelled/rejected
        if (isCancelled || isRejected) {
          statusMatch = false
        } else {
          statusMatch = isApproved
        }
      }
      
      if (statusMatch) {
        return true
      }
    }
  }
  
  return false
}

const getBookingSpan = (roomId, date, time) => {
  const booking = getBookingForSlot(roomId, date, time)
  if (!booking) return 1
  
  const bookingStartTimeValue = booking.start_datetime || booking.start || booking.start_time
  const bookingEndTimeValue = booking.end_datetime || booking.end || booking.end_time
  
  if (!bookingStartTimeValue || !bookingEndTimeValue) return 1
  
  // Parse datetime as local time using helper function (string-based, NO Date object)
  const bookingStartParsed = parseLocalDateTime(bookingStartTimeValue)
  const bookingEndParsed = parseLocalDateTime(bookingEndTimeValue)
  
  if (!bookingStartParsed || !bookingStartParsed.isValid || !bookingEndParsed || !bookingEndParsed.isValid) {
    return 1
  }
  
  // Calculate duration in minutes using string-based calculation
  // Convert HH:mm to minutes: hour * 60 + minute
  const startMinutes = parseInt(bookingStartParsed.hour) * 60 + parseInt(bookingStartParsed.minute)
  const endMinutes = parseInt(bookingEndParsed.hour) * 60 + parseInt(bookingEndParsed.minute)
  const durationMinutes = endMinutes - startMinutes
  
  const slotDuration = 30 // minutes per slot
  const spanSlots = Math.ceil(durationMinutes / slotDuration)
  
  return Math.max(1, spanSlots) // Ensure at least 1 slot
}

const getBookingPillStyle = (roomId, date, time) => {
  const booking = getBookingForSlot(roomId, date, time)
  if (!booking) return {}
  
  const span = getBookingSpan(roomId, date, time)
  const totalSlots = timeSlots.length
  
  // IMPORTANT: The 'time' parameter is the slot's start time where the booking pill should be rendered
  // This is the slot that matches the booking's start time (checked by isBookingStartSlot)
  // So we should use this 'time' parameter directly to find the slot index, not the booking's start_datetime
  // This ensures the pill is positioned at the correct slot that triggered the render
  
  // Find the index of the slot that matches the 'time' parameter (this is where the pill should be positioned)
  const startSlotIndex = timeSlots.findIndex(slot => slot.start === time)
  
  // Also get booking start time for validation and debug logging
  const bookingStartTimeValue = booking.start_datetime || booking.start || booking.start_time
  const bookingStartParsed = bookingStartTimeValue ? parseLocalDateTime(bookingStartTimeValue) : null
  const bookingStartTime = bookingStartParsed?.time || time
  
  // Validate that the time parameter matches the booking's actual start time
  if (bookingStartParsed && bookingStartParsed.isValid && bookingStartTime !== time) {
    console.warn(`[Calendar] Time parameter mismatch for booking ${booking.id}:`, {
      'time parameter': time,
      'booking start time': bookingStartTime,
      'booking start_datetime': bookingStartTimeValue
    })
  }
  
  // Debug: Log for booking 156 (12:00), 157, and other bookings to see what's happening
  if (booking.id === '156' || booking.id === '154' || booking.id === '157' || (debugMatchCount < MAX_DEBUG_LOGS && (time === '12:00' || time === '11:30' || time === '12:30'))) {
    console.log(`[Calendar] 🔍 getBookingPillStyle DEBUG for booking ${booking.id}:`, {
      'Called with time parameter': time,
      'Booking start_datetime': bookingStartTimeValue,
      'Parsed bookingStartTime': bookingStartTime,
      'Parsed date': bookingStartParsed?.date,
      'startSlotIndex (using time parameter)': startSlotIndex,
      'startSlotIndex (using bookingStartTime)': bookingStartParsed ? timeSlots.findIndex(slot => slot.start === bookingStartTime) : -1,
      'Slot at startSlotIndex': timeSlots[startSlotIndex],
      'Slot at startSlotIndex-1': timeSlots[startSlotIndex - 1],
      'Slot at startSlotIndex+1': timeSlots[startSlotIndex + 1],
      'All slots with 12:00': timeSlots.map((slot, idx) => ({ idx, start: slot.start, end: slot.end })).filter(s => s.start === '12:00'),
      'All slots with 11:30': timeSlots.map((slot, idx) => ({ idx, start: slot.start, end: slot.end })).filter(s => s.start === '11:30'),
      'All slots with 11:00': timeSlots.map((slot, idx) => ({ idx, start: slot.start, end: slot.end })).filter(s => s.start === '11:00'),
      'timeSlots length': timeSlots.length,
      'First few slots': timeSlots.slice(0, 10).map((slot, idx) => ({ idx, start: slot.start, end: slot.end })),
      'Slots around 11:00-12:30': timeSlots.map((slot, idx) => ({ idx, start: slot.start, end: slot.end })).filter(s => {
        const hour = parseInt(s.start.split(':')[0])
        return hour >= 11 && hour <= 12
      })
    })
    if (booking.id !== '156' && booking.id !== '154' && booking.id !== '157') {
      debugMatchCount++
    }
  }
  
  // Debug: Log time parsing (especially for booking 156, 154, and 157)
  if (debugMatchCount < MAX_DEBUG_LOGS || booking.id === '156' || booking.id === '154' || booking.id === '157') {
    console.log(`[Calendar] getBookingPillStyle time parsing for booking ${booking.id}:`, {
      bookingId: booking.id,
      bookingName: booking.name || booking.title,
      'Called with time parameter': time,
      originalTime: bookingStartTimeValue,
      parsedTime: bookingStartTime,
      parsedDate: bookingStartParsed.date,
      startSlotIndex,
      'Slot at index': timeSlots[startSlotIndex],
      'Slot at index-1': timeSlots[startSlotIndex - 1],
      'Slot at index+1': timeSlots[startSlotIndex + 1],
      span,
      totalSlots,
      isUTC: typeof bookingStartTimeValue === 'string' && bookingStartTimeValue.includes('T') && bookingStartTimeValue.includes('Z'),
      'Expected slot': timeSlots.find(slot => slot.start === bookingStartTime),
      'All slots around time': timeSlots.filter(slot => {
        const slotHour = parseInt(slot.start.split(':')[0])
        const bookingHour = parseInt(bookingStartTime.split(':')[0])
        return Math.abs(slotHour - bookingHour) <= 1
      }),
      'All slots with 12:00': timeSlots.map((slot, idx) => ({ idx, start: slot.start, end: slot.end })).filter(s => s.start === '12:00'),
      'All slots with 11:30': timeSlots.map((slot, idx) => ({ idx, start: slot.start, end: slot.end })).filter(s => s.start === '11:30'),
      'All slots with 11:00': timeSlots.map((slot, idx) => ({ idx, start: slot.start, end: slot.end })).filter(s => s.start === '11:00')
    })
    if (booking.id !== '156' && booking.id !== '154' && booking.id !== '157') {
      debugMatchCount++
    }
  }
  
  if (startSlotIndex === -1) {
    console.warn(`[Calendar] Could not find slot index for time parameter: ${time}`, {
      bookingId: booking.id,
      bookingStartTime,
      'time parameter': time,
      'All slots': timeSlots.map((slot, idx) => ({ idx, start: slot.start }))
    })
    return {}
  }
  
  // Room name width is 250px (fixed, matching CSS)
  const roomNameWidth = 250
  
  // Calculate using flexbox-based approach
  // Since we're using flexbox, each slot has flex: 1, meaning they take equal space
  // The total width available for slots is: 100% - 250px (room name width)
  // Each slot takes: (100% - 250px) / totalSlots
  
  // Calculate the percentage each slot represents of the total container width
  // But we need to account for the room name taking 250px
  // Better approach: use CSS Grid column positioning or simpler calc
  
  // Simplified calculation: 
  // - Each slot is flex: 1, so they're equal width
  // - Left position = roomNameWidth + (startSlotIndex * slotWidth)
  // - Width = span * slotWidth
  // - slotWidth = (100% - roomNameWidth) / totalSlots
  
  // Calculate positioning - room row uses flexbox
  // Structure: room-name (250px fixed) + time-slots (flex: 1 each, equal width)
  // Each time slot takes equal space: (100% - 250px) / totalSlots
  
  // Calculate fractions (0 to 1)
  const leftFraction = startSlotIndex / totalSlots
  const widthFraction = span / totalSlots
  
  // Calculate positioning to ensure booking pill is INSIDE the time slot box, not on grid lines
  // The room row structure: [room-name: 250px] [slot0|border] [slot1|border] [slot2|border] ...
  // Each time slot has border-left: 1px, so we need to account for borders
  
  // IMPORTANT: Booking pill is now positioned relative to room-row (not time-slot)
  // So we need to calculate from the start of room-row
  
  // Calculate left position - must start from the LEFT edge of the time slot (inside the box)
  // left = room-name-width + (startSlotIndex / totalSlots) * remaining-width + borders-before-start
  // remaining-width = 100% - 250px
  // borders-before-start = startSlotIndex * 1px (each slot has 1px left border)
  const borderWidth = 1 // Each time slot has 1px left border
  const bordersBeforeStart = startSlotIndex * borderWidth
  
  // Calculate left using expanded calc() to avoid nested calc issues
  // left = 250px + leftFraction * (100% - 250px) + bordersBeforeStart
  // Expand: left = 250px + leftFraction * 100% - leftFraction * 250px + bordersBeforeStart
  // But we need to add 1px to start INSIDE the slot box (not on the border line)
  const leftPercent = (leftFraction * 100).toFixed(4)
  const leftPxOffset = (leftFraction * roomNameWidth).toFixed(2)
  const leftOffset = `calc(${roomNameWidth}px + ${leftPercent}% - ${leftPxOffset}px + ${bordersBeforeStart}px + 1px)`
  
  // Calculate width - must span exactly the slots (accounting for borders between slots)
  // width = widthFraction * (100% - 250px) - borders-between-slots - 2px (1px left + 1px right margin)
  // borders-between-slots = (span - 1) * 1px (borders between the slots in the span)
  const bordersBetweenSlots = (span - 1) * borderWidth
  const widthPercent = (widthFraction * 100).toFixed(4)
  const widthPxOffset = (widthFraction * roomNameWidth).toFixed(2)
  // Subtract 2px total: 1px for left margin (to be inside box) + 1px for right margin (to avoid next border)
  const width = `calc(${widthPercent}% - ${widthPxOffset}px - ${bordersBetweenSlots}px - 2px)`
  
  // Debug output (especially for booking 156, 157)
  if (debugMatchCount < MAX_DEBUG_LOGS || booking.id === '156' || booking.id === '154' || booking.id === '157') {
    console.log(`[Calendar] getBookingPillStyle calculation for booking ${booking.id}:`, {
      bookingId: booking.id,
      bookingName: booking.name || booking.title,
      'Called with time parameter': time,
      bookingStartTime,
      startSlotIndex,
      span,
      totalSlots,
      leftFraction: leftFraction.toFixed(6),
      widthFraction: widthFraction.toFixed(6),
      bordersBeforeStart,
      bordersBetweenSlots,
      leftOffset,
      width,
      'Expected position': `Slot ${startSlotIndex} (${timeSlots[startSlotIndex]?.start}) to ${startSlotIndex + span - 1} (${timeSlots[startSlotIndex + span - 1]?.start})`,
      'Time slot at index': timeSlots[startSlotIndex],
      'Next slot': timeSlots[startSlotIndex + 1],
      'All slots 11:00-12:30': timeSlots.map((slot, idx) => ({ idx, start: slot.start, end: slot.end })).filter(s => {
        const hour = parseInt(s.start.split(':')[0])
        return hour >= 11 && hour <= 12
      }),
      'Calculation breakdown': {
        'leftPercent': `${leftPercent}%`,
        'leftPxOffset': `${leftPxOffset}px`,
        'bordersBeforeStart': `${bordersBeforeStart}px`,
        'widthPercent': `${widthPercent}%`,
        'widthPxOffset': `${widthPxOffset}px`,
        'bordersBetweenSlots': `${bordersBetweenSlots}px`,
        'roomNameWidth': `${roomNameWidth}px`,
        'Formula': {
          left: `${roomNameWidth}px + ${leftPercent}% - ${leftPxOffset}px + ${bordersBeforeStart}px + 1px`,
          width: `${widthPercent}% - ${widthPxOffset}px - ${bordersBetweenSlots}px - 2px`,
          'Actual left': leftOffset,
          'Actual width': width
        },
        'Math check': {
          'leftFraction': leftFraction,
          'leftFraction * 100': (leftFraction * 100).toFixed(4),
          'leftFraction * roomNameWidth': (leftFraction * roomNameWidth).toFixed(2),
          'Expected left (simplified)': `calc(${roomNameWidth}px + ${(leftFraction * 100).toFixed(4)}% - ${(leftFraction * roomNameWidth).toFixed(2)}px + ${bordersBeforeStart}px + 1px)`
        }
      }
    })
    debugMatchCount++
  }
  
  return {
    position: 'absolute',
    left: leftOffset,
    top: '0',
    width: width,
    height: '100%',
    zIndex: 5,
    backgroundColor: getObjectiveColor(booking.objective || booking.purpose || 'ประชุม'),
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
      backgroundColor: getObjectiveColor(booking.objective || booking.purpose || 'ประชุม'),
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

  // Calculate new end time (keep same duration) - using string-based calculation
  const oldStartParsed = parseLocalDateTime(draggingBooking.value.start || draggingBooking.value.start_datetime)
  const oldEndParsed = parseLocalDateTime(draggingBooking.value.end || draggingBooking.value.end_datetime)
  
  if (!oldStartParsed || !oldStartParsed.isValid || !oldEndParsed || !oldEndParsed.isValid) {
    console.warn('[Calendar] handleDrop: Invalid booking times', draggingBooking.value)
    return
  }
  
  // Calculate duration in minutes using string-based calculation
  const startMinutes = parseInt(oldStartParsed.hour) * 60 + parseInt(oldStartParsed.minute)
  const endMinutes = parseInt(oldEndParsed.hour) * 60 + parseInt(oldEndParsed.minute)
  const duration = endMinutes - startMinutes
  
  // Calculate new end time
  const newStartMinutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1])
  const newEndMinutes = newStartMinutes + duration
  
  // Convert minutes back to HH:mm format
  const newEndHour = Math.floor(newEndMinutes / 60)
  const newEndMinute = newEndMinutes % 60
  const newEndTime = `${String(newEndHour).padStart(2, '0')}:${String(newEndMinute).padStart(2, '0')}`

  // Update edit form
  editForm.date = date
  editForm.start_time = time
  editForm.end_time = newEndTime
  editForm.room_id = roomId

  // Update viewing booking
  if (viewingBooking.value && viewingBooking.value.id === draggingBooking.value.id) {
    viewingBooking.value.room = roomId
    viewingBooking.value.room_id = roomId
    viewingBooking.value.start = `${date} ${time}:00`
    viewingBooking.value.end = `${date} ${newEndTime}:00`
  }

  // Update bookings array to reflect the change immediately
  const bookingIndex = bookings.value.findIndex(b => b.id === draggingBooking.value.id)
  if (bookingIndex !== -1) {
    bookings.value[bookingIndex].start = `${date} ${time}:00`
    bookings.value[bookingIndex].end = `${date} ${newEndTime}:00`
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
  // Parse date string (YYYY-MM-DD) and format as Thai date
  const [year, month, day] = selectedDate.value.split('-').map(Number)
  const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  
  // Use Date only for getting day of week (not for parsing booking times)
  const date = new Date(year, month - 1, day)
  const dayOfWeek = date.getDay()
  
  return `${dayNames[dayOfWeek]}, ${day} ${monthNames[month - 1]} ${year}`
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
  // Set end time 30 minutes after start (string-based calculation)
  const [startHour, startMinute] = time.split(':').map(Number)
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = startMinutes + 30
  const endHour = Math.floor(endMinutes / 60)
  const endMinute = endMinutes % 60
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
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

    // Debug: Log what we're sending to backend
    console.log('[submitBooking] Sending booking data:', {
      room_id: bookingForm.room_id,
      name: bookingForm.name,
      start_time: bookingForm.start_time,
      end_time: bookingForm.end_time,
      selectedDate: selectedDate.value,
      start_datetime: startDateTime,
      end_datetime: endDateTime
    })

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
    selectedRooms.value = rooms.value.map(r => String(r.id))
    console.log('[Calendar] Fetched rooms:', rooms.value.length, 'rooms')
    console.log('[Calendar] Room IDs:', rooms.value.map(r => ({ id: r.id, id_type: typeof r.id, name: r.name, auto_approve: r.auto_approve })))
    
    // After rooms are loaded, re-check bookings if they exist
    if (bookings.value.length > 0) {
      console.log('[Calendar] Re-checking bookings after rooms loaded...')
      bookings.value.forEach((b, index) => {
        const matchingRoom = rooms.value.find(r => String(r.id) === String(b.room_id))
        console.log(`[Calendar] Booking ${index + 1} (${b.id}) room check:`, {
          booking_room_id: b.room_id,
          booking_room_id_type: typeof b.room_id,
          matching_room: matchingRoom ? { id: matchingRoom.id, name: matchingRoom.name } : 'NOT FOUND',
          all_room_ids: rooms.value.map(r => ({ id: r.id, id_type: typeof r.id }))
        })
      })
    }
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
    console.log('[Calendar] Fetched bookings:', bookings.value.length, 'bookings')
    console.log('[Calendar] Bookings data:', bookings.value)
    if (bookings.value.length > 0) {
      bookings.value.forEach((b, index) => {
        const bookingStartTime = b.start_datetime || b.start || b.start_time
        const bookingEndTime = b.end_datetime || b.end || b.end_time
        
        // Parse datetime as local time using helper function (string-based, NO Date object)
        const bookingStartParsed = parseLocalDateTime(bookingStartTime)
        const bookingEndParsed = parseLocalDateTime(bookingEndTime)
        
        const bookingDate = bookingStartParsed ? bookingStartParsed.date : 'N/A'
        const bookingStart = bookingStartParsed ? bookingStartParsed.time : 'N/A'
        const bookingEnd = bookingEndParsed ? bookingEndParsed.time : 'N/A'
        
        console.log(`[Calendar] Booking ${index + 1}:`, {
          id: b.id,
          room_id: b.room_id,
          room_id_type: typeof b.room_id,
          title: b.title,
          name: b.name,
          start_datetime: b.start_datetime,
          start: b.start,
          start_time: b.start_time,
          end_datetime: b.end_datetime,
          end: b.end,
          end_time: b.end_time,
          parsed_date: bookingDate,
          parsed_start: bookingStart,
          parsed_end: bookingEnd,
          'Original start format': typeof bookingStartTime === 'string' ? {
            hasT: bookingStartTime.includes('T'),
            hasZ: bookingStartTime.includes('Z'),
            hasPlus: bookingStartTime.includes('+'),
            length: bookingStartTime.length,
            sample: bookingStartTime.substring(0, 30)
          } : typeof bookingStartTime,
          'Parsed info': bookingStartParsed ? {
            isValid: bookingStartParsed.isValid,
            date: bookingStartParsed.date,
            time: bookingStartParsed.time,
            full: bookingStartParsed.full
          } : 'N/A',
          status: b.status,
          booking_status: b.booking_status,
          approval_status: b.approval_status,
          objective: b.objective,
          allFields: Object.keys(b)
        })
        
        // Log detailed comparison (check after rooms are loaded)
        const matchingRoom = rooms.value.find(r => String(r.id) === String(b.room_id))
        const roomIdMatch = !!matchingRoom
        const roomAutoApprove = matchingRoom ? (matchingRoom.auto_approve === 1 || matchingRoom.auto_approve === true) : false
        const dateInRange = bookingDate >= startDate.value && bookingDate <= endDate.value
        // Time in range: check if booking time overlaps with calendar time range (07:00-20:00)
        // Booking overlaps if: booking starts before calendar ends AND booking ends after calendar starts
        const timeInRange = bookingStart !== 'N/A' && bookingEnd !== 'N/A' && bookingStart < '20:00' && bookingEnd > '07:00'
        const hasStatus = !!(b.status || b.booking_status || b.approval_status)
        const statusValue = b.status || b.booking_status || b.approval_status || 'null'
        
        // Determine if booking will show based on status and room auto_approve
        // New structure: status BIT (1 = approved, 0/NULL = pending)
        const isCancelled = b.cancel === 1 || b.cancel === true
        const isRejected = b.reject === 1 || b.reject === true
        const isApproved = (
          statusValue === 1 || 
          statusValue === 'approved' || 
          statusValue === 'confirmed' || 
          statusValue === true ||
          statusValue === '1'
        )
        
        let willShow = false
        if (roomIdMatch && dateInRange && timeInRange) {
          if (roomAutoApprove) {
            // Room with auto-approve: show all bookings that are not cancelled/rejected
            willShow = !isCancelled && !isRejected
          } else {
            // Room requires approval: show only approved bookings that are not cancelled/rejected
            willShow = isApproved && !isCancelled && !isRejected
          }
        }
        
        // Check if booking will actually be found by getBookingForSlot
        const testSlotTime = bookingStart !== 'N/A' ? bookingStart : null
        const testBooking = testSlotTime ? getBookingForSlot(b.room_id, bookingDate, testSlotTime) : null
        const willBeFound = !!testBooking && testBooking.id === b.id
        
        console.log(`[Calendar] Booking ${index + 1} details:`, {
          'Room ID match': roomIdMatch,
          'Matching room': matchingRoom ? { id: matchingRoom.id, name: matchingRoom.name, auto_approve: matchingRoom.auto_approve } : 'NOT FOUND',
          'Room auto_approve': roomAutoApprove,
          'All room IDs': rooms.value.map(r => ({ id: r.id, id_type: typeof r.id, name: r.name })),
          'Date in range': dateInRange,
          'Booking date': bookingDate,
          'Date range': { start: startDate.value, end: endDate.value },
          'Time in range': timeInRange,
          'Booking time': { start: bookingStart, end: bookingEnd },
          'Raw booking times': { start_datetime: b.start_datetime, start: b.start, start_time: b.start_time, end_datetime: b.end_datetime, end: b.end, end_time: b.end_time },
          'Calendar time range': '07:00-20:00',
          'Time check': {
            'bookingStart < 20:00': bookingStart !== 'N/A' ? bookingStart < '20:00' : 'N/A',
            'bookingEnd > 07:00': bookingEnd !== 'N/A' ? bookingEnd > '07:00' : 'N/A',
            'bookingStart value': bookingStart,
            'bookingEnd value': bookingEnd
          },
          'Has status': hasStatus,
          'Status value': statusValue,
          'Status details': {
            'status': b.status,
            'booking_status': b.booking_status,
            'approval_status': b.approval_status,
            'cancel': b.cancel,
            'cancelled': b.cancelled,
            'reject': b.reject,
            'rejected': b.rejected
          },
          'Will show in calendar': willShow,
          'Will be found by getBookingForSlot': willBeFound,
          'Test slot time': testSlotTime,
          'Test booking found': testBooking ? { id: testBooking.id, name: testBooking.name || testBooking.title } : null
        })
      })
    }
  } catch (error) {
    console.error('Error fetching bookings:', error)
    bookings.value = []
  }
}

const toggleSelectAll = () => {
  if (selectAllRooms.value) {
    selectedRooms.value = rooms.value.map(r => String(r.id))
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
  const bookingStart = booking.start || booking.start_datetime
  const bookingEnd = booking.end || booking.end_datetime
  
  // Parse booking times using string-based logic (NO Date object)
  const bookingStartParsed = parseLocalDateTime(bookingStart)
  const bookingEndParsed = parseLocalDateTime(bookingEnd)
  
  if (bookingStartParsed && bookingStartParsed.isValid) {
    editForm.date = bookingStartParsed.date
    editForm.start_time = bookingStartParsed.time
  } else {
    editForm.date = ''
    editForm.start_time = ''
  }
  
  if (bookingEndParsed && bookingEndParsed.isValid) {
    editForm.end_time = bookingEndParsed.time
  } else {
    editForm.end_time = ''
  }
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
    saving.value = false
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

// Generate time options for select (extended to 20:00 to match calendar range)
const timeOptions = []
for (let h = 7; h <= 20; h++) {
  timeOptions.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 20) {
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
      const today = moment() // Get current date using moment
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
  if (rooms.value.length > 0) {
    fetchBookingsForRange()
  }
})

onMounted(async () => {
  // Ensure moment is available globally before using daterangepicker
  if (typeof window !== 'undefined') {
    window.moment = moment
  }
  
  moment.locale('th')
  
  // Fetch rooms first, then bookings
  await fetchRooms()
  initializeDateRangePicker()
  await fetchBookingsForRange()
  
  // Log final state after everything is loaded
  console.log('[Calendar] Final state after mount:', {
    roomsCount: rooms.value.length,
    bookingsCount: bookings.value.length,
    selectedRoomsCount: selectedRooms.value.length,
    dateRange: { start: startDate.value, end: endDate.value }
  })
})

// Tooltip functions - like old project
const showBookingTooltip = (event, booking) => {
  if (!booking) return
  
  // Remove existing tooltip
  hideBookingTooltip()
  
  const tooltip = document.createElement('div')
  tooltip.className = 'booking-tooltip'
  tooltip.style.cssText = `
    position: absolute;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 12px;
    border-radius: 8px;
    font-size: 0.85em;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    max-width: 300px;
    white-space: normal;
    line-height: 1.4;
    pointer-events: none;
  `
  
  const bookingStartTime = booking.start_datetime || booking.start || booking.start_time
  const bookingEndTime = booking.end_datetime || booking.end || booking.end_time
  const bookingStatus = getBookingStatus(booking)
  
  let bookingStart = 'N/A'
  let bookingEnd = 'N/A'
  
  if (bookingStartTime) {
    const bookingStartParsed = parseLocalDateTime(bookingStartTime)
    if (bookingStartParsed && bookingStartParsed.isValid) {
      bookingStart = bookingStartParsed.time // Already in HH:mm format
    }
  }
  
  if (bookingEndTime) {
    const bookingEndParsed = parseLocalDateTime(bookingEndTime)
    if (bookingEndParsed && bookingEndParsed.isValid) {
      bookingEnd = bookingEndParsed.time // Already in HH:mm format
    }
  }
  
  tooltip.innerHTML = `
    <div style="margin-bottom: 8px;">
      <strong style="color: #fff; font-size: 1.1em;">${booking.name || booking.title || 'การจอง'}</strong>
    </div>
    <div style="margin-bottom: 4px;">
      <strong>ผู้จอง:</strong> ${booking.booker_name || booking.booker || 'ไม่ระบุ'}
    </div>
    <div style="margin-bottom: 4px;">
      <strong>เวลา:</strong> ${bookingStart} - ${bookingEnd}
    </div>
    ${booking.objective ? `<div style="margin-bottom: 4px;"><strong>วัตถุประสงค์:</strong> ${booking.objective}</div>` : ''}
    ${booking.description ? `<div style="margin-bottom: 4px;"><strong>รายละเอียด:</strong> ${booking.description}</div>` : ''}
    ${booking.instructor ? `<div style="margin-bottom: 4px;"><strong>ผู้สอน/วิทยากร:</strong> ${booking.instructor}</div>` : ''}
    ${booking.attendees ? `<div style="margin-bottom: 4px;"><strong>ผู้เข้าร่วม:</strong> ${booking.attendees}</div>` : ''}
    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
      <small>${getStatusText(bookingStatus)}</small>
    </div>
  `
  
  document.body.appendChild(tooltip)
  
  const rect = event.currentTarget.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  
  // Position tooltip
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2)
  let top = rect.top - tooltipRect.height - 10
  
  // Adjust if tooltip goes off screen
  if (left < 10) left = 10
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10
  }
  if (top < 10) {
    top = rect.bottom + 10
  }
  
  tooltip.style.left = left + 'px'
  tooltip.style.top = top + 'px'
  
  // Store tooltip reference
  event.currentTarget._tooltip = tooltip
}

const hideBookingTooltip = () => {
  const tooltips = document.querySelectorAll('.booking-tooltip')
  tooltips.forEach(tooltip => tooltip.remove())
}

onBeforeUnmount(() => {
  // Destroy daterangepicker
  if (dateRangeInput.value) {
    const $input = $(dateRangeInput.value)
    if ($input.data('daterangepicker')) {
      $input.data('daterangepicker').remove()
    }
  }
  // Remove any remaining tooltips
  hideBookingTooltip()
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
                v-for="room in filteredRooms"
                :key="room.id"
                cols="6"
                md="4"
                lg="3"
                xl="2"
              >
                <VCheckbox
                  :id="'room-' + room.id"
                  :model-value="selectedRooms.includes(String(room.id))"
                  :label="room.name"
                  @update:model-value="(val) => {
                    const roomIdStr = String(room.id)
                    if (val) {
                      if (!selectedRooms.includes(roomIdStr)) selectedRooms.push(roomIdStr)
                    } else {
                      selectedRooms = selectedRooms.filter(id => String(id) !== roomIdStr)
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
                      <!-- Booking pills container - positioned relative to room-row -->
                      <template v-for="slot in timeSlots" :key="slot.start">
                        <div
                          v-if="isBookingStartSlot(room.id, day.date, slot.start)"
                          class="booking-pill"
                          :class="{ 'dragging': draggingBooking && draggingBooking.id === getBookingForSlot(room.id, day.date, slot.start)?.id }"
                          :style="getBookingPillStyle(room.id, day.date, slot.start)"
                          :data-span="getBookingSpan(room.id, day.date, slot.start)"
                          :draggable="canDragBooking(getBookingForSlot(room.id, day.date, slot.start))"
                          :data-booking-id="getBookingForSlot(room.id, day.date, slot.start)?.id"
                          @mousedown.stop="handleBookingMouseDown(room.id, day.date, slot.start)"
                          @click.stop="handleBookingClick(room.id, day.date, slot.start)"
                          @dragstart="handleDragStart($event, room.id, day.date, slot.start)"
                          @dragend="handleDragEnd"
                          @mouseenter="showBookingTooltip($event, getBookingForSlot(room.id, day.date, slot.start))"
                          @mouseleave="hideBookingTooltip"
                        >
                          <span class="booking-title">{{ (getBookingForSlot(room.id, day.date, slot.start)?.name || getBookingForSlot(room.id, day.date, slot.start)?.title || 'การจอง') }}</span>
                          <span 
                            class="status-indicator" 
                            :class="'status-' + getBookingStatus(getBookingForSlot(room.id, day.date, slot.start))"
                          ></span>
                        </div>
                      </template>
                      <!-- Time slots -->
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
                        <!-- Hide slots that are part of a booking (but not the start slot) -->
                        <template v-if="getBookingForSlot(room.id, day.date, slot.start) && !isBookingStartSlot(room.id, day.date, slot.start)">
                          <!-- This slot is part of a booking that started earlier - it's covered by the booking pill -->
                          <!-- The slot should be visually hidden or styled to show it's part of a booking -->
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
  overflow-y: visible;
  padding: 0;
  margin: 0;
  scrollbar-width: thin;
  scrollbar-color: #667eea #f1f1f1;
  background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
  width: 100%;
  /* Ensure booking pills can overflow */
  position: relative;
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
  /* Ensure relative positioning for absolute children */
  overflow: visible;
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
  position: relative;
  overflow: visible;
  border-left: 1px solid #edf2f7;
  background: transparent !important;
  /* Ensure booking pill container is properly positioned */
  isolation: isolate;
}

/* Slots that are part of a booking (but not the start slot) */
.time-slot:has(.booking-pill) {
  overflow: visible;
}

.time-slot:not(.booked-slot):has(+ .time-slot.booked-slot .booking-pill) {
  /* This is a workaround - we'll handle it differently */
}

.time-slot.drag-over {
  background: rgba(102, 126, 234, 0.2) !important;
  border: 2px dashed #667eea !important;
  border-radius: 8px;
}

.booking-pill {
  height: 52px;
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
  contain: layout style paint !important;
  isolation: isolate;
  will-change: auto;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  margin: 0 !important;
  right: auto !important;
  bottom: auto !important;
  /* Ensure the pill spans correctly across multiple slots */
  pointer-events: auto;
  /* Ensure proper positioning - start from left edge of slot, not grid line */
  transform-origin: left top;
  /* Ensure pill is inside the time slot box, not on grid lines */
  border-radius: 4px;
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

/* Status Indicator - like old project */
.status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  position: absolute;
  top: 4px;
  right: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  animation: pulse 2s infinite;
}

.status-indicator.status-ongoing {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  animation: pulse 1s infinite;
}

.status-indicator.status-upcoming {
  background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);
}

.status-indicator.status-completed {
  background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* Booking Tooltip - like old project */
.booking-tooltip {
  position: absolute;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.85em;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  animation: fadeIn 0.3s ease-out;
  max-width: 300px;
  white-space: normal;
  line-height: 1.4;
  pointer-events: none;
}

.booking-tooltip::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid rgba(0, 0, 0, 0.9);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
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
 
/* ===== Responsive ===== */
@media (max-width: 959.98px) {
  .room-column-header,
  .room-name {
    width: 180px;
    min-width: 180px;
    max-width: 180px;
    padding: 10px 12px;
    font-size: 0.85rem;
  }

  .booking-tooltip {
    max-width: 240px;
    font-size: 0.8rem;
  }
}

@media (max-width: 599.98px) {
  .room-column-header,
  .room-name {
    width: 140px;
    min-width: 140px;
    max-width: 140px;
    padding: 8px 10px;
    font-size: 0.8rem;
  }

  .time-column-header {
    min-width: 48px;
    padding: 10px 4px;
    font-size: 0.75rem;
  }

  .time-slot {
    min-width: 48px;
    height: 44px;
  }

  .time-start {
    font-size: 0.8rem;
  }

  .time-end {
    font-size: 0.75rem;
  }

  .day-name {
    font-size: 1.2rem;
  }

  .day-date {
    font-size: 0.85rem;
  }

  .booking-tooltip {
    max-width: 200px;
    font-size: 0.75rem;
    padding: 8px 10px;
  }
}
</style>
