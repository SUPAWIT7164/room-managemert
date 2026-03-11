<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
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

const router = useRouter()
const authStore = useAuthStore()

// ——— Data ———
const loading = ref(false)
const allRooms = ref([])
const selectedRoomIds = ref([])
const selectAllRooms = ref(true)
const startDate = ref(moment().format('YYYY-MM-DD'))
const endDate = ref(moment().format('YYYY-MM-DD'))
const dateRangeInput = ref(null)
const bookings = ref([])

// Time slots เหมือนโปรเจกต์เก่า (old): 07:00–17:00 (20 ช่อง) — ไม่เกิน 17:00 จึงไม่มีคอลัมน์/ไอคอน + ส่วนเกิน
const timeSlots = (() => {
  const slots = []
  for (let h = 7; h < 17; h++) {
    slots.push({ start: `${String(h).padStart(2, '0')}:00`, end: `${String(h).padStart(2, '0')}:30` })
    slots.push({ start: `${String(h).padStart(2, '0')}:30`, end: `${String(h + 1).padStart(2, '0')}:00` })
  }
  return slots
})()

// รายการเวลาในฟอร์มการจอง (dropdown) — 07:00 ถึง 17:00
const timeOptionsForForm = (() => {
  const times = [...new Set(timeSlots.flatMap(s => [s.start, s.end]))].sort()
  return times.map(t => ({ title: t, value: t }))
})()

// Date range for table
const dateRange = computed(() => {
  const dates = []
  const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤศหัสบดี', 'วันศุกร์', 'วันเสาร์']
  const start = new Date(startDate.value)
  const end = new Date(endDate.value)
  const d = new Date(start)
  while (d <= end) {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const day = d.getDate()
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    dates.push({
      date: dateStr,
      dayOfWeek: d.getDay(),
      dayName: dayNames[d.getDay()],
      formattedDate: `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
    })
    d.setDate(d.getDate() + 1)
  }
  return dates
})

// Rooms: แสดงเฉพาะห้องที่เลือก (เหมือน calendar — filteredRooms = rooms ที่ถูกเลือก)
const filteredRooms = computed(() => {
  return allRooms.value.filter(room => selectedRoomIds.value.includes(String(room.id)))
})

// เฉพาะห้องที่มี id และชื่อ เพื่อไม่ให้มีแถวว่างจากข้อมูลห้องไม่ครบ
const displayRooms = computed(() => {
  return filteredRooms.value.filter(
    room => room && room.id != null && (room.name != null && room.name !== '' || (room.title != null && room.title !== ''))
  )
})

// Room capacity map (roomId -> seat)
const roomDetails = computed(() => {
  const m = {}
  allRooms.value.forEach(r => { m[r.id] = r.seat ?? r.capacity ?? 0 })
  return m
})

const isSuperAdmin = computed(() => authStore.user?.role === 'super-admin' || authStore.user?.role === 'admin')

// ——— Help Modal ———
const showHelpModal = ref(false)
const helpStep = ref(1)
const helpSteps = [
  { title: 'เลือกช่วงวันที่', desc: 'คลิกที่ช่อง "เลือกช่วงวันที่" เพื่อเลือกวันที่ที่ต้องการจองห้อง' },
  { title: 'เลือกห้อง', desc: 'เลือกห้องที่ต้องการแสดงโดยคลิกที่ช่อง checkbox ด้านหน้าชื่อห้อง' },
  { title: 'ดูตารางการจอง', desc: 'ระบบจะแสดงตารางการจองห้องในวันที่เลือก โดยช่องสีขาวหมายถึงห้องว่าง ช่องสีต่างๆ หมายถึงห้องที่ถูกจองแล้ว' },
  { title: 'คลิกห้องที่ต้องการจอง', desc: 'คลิกที่ช่องเวลาของห้องที่ต้องการจอง (ช่องสีขาว) เพื่อเปิดหน้าต่างการจอง' },
  { title: 'กรอกข้อมูลการจอง', desc: 'กรอกชื่อการจอง, ห้อง, วันที่, เวลา, รายละเอียด และอีเมลผู้เข้าร่วม (ถ้ามี)' },
  { title: 'ยืนยันการจอง', desc: 'ตรวจสอบข้อมูลให้ถูกต้องแล้วคลิกปุ่ม "ยืนยันการจอง" เพื่อบันทึกการจอง' },
]

// ——— Booking Modal (new / view / edit) ———
const showBookingModal = ref(false)
const bookingMode = ref('new') // 'new' | 'view' | 'edit'
const viewingBooking = ref(null)
const saving = ref(false)
const form = reactive({
  name: 'จองห้อง',
  room_id: '',
  bookingDate: '',
  startTime: '09:00',
  endTime: '09:30',
  description: '',
  objective: 'ประชุม',
  attendeesEmails: [],
})
const attendeesText = ref('')
const capacityLimit = ref(0)
const roomOptions = ref([])
const showAttendeeSuggestions = ref(false)
const attendeeSuggestions = ref([])
const attendeeSearchQuery = ref('')
let attendeeSearchTimer = null

// Buttons visibility in view mode
const showCancelBtn = ref(false)
const showRejectBtn = ref(false)
const showEditBtn = ref(false)
const showConfirmBtn = ref(false)
const showAutoCancelArea = ref(false)
const autoCancelChecked = ref(false)
const autoCancelBookingId = ref(null)

// Objectives and colors
const objectives = ['บรรยาย', 'อบรม', 'ประชุม', 'จัดกิจกรรม', 'สอบ', 'งดใช้']
const objectiveColors = {
  'บรรยาย': '#54C392',
  'อบรม': '#87A2FF',
  'ประชุม': '#FF70AB',
  'จัดกิจกรรม': '#7E60BF',
  'สอบ': '#EC8305',
  'งดใช้': '#F95454',
}
const getObjectiveColor = (obj) => objectiveColors[obj] || '#667eea'

// ——— Snackbar ———
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')
const showToast = (msg, color = 'success') => {
  snackbarText.value = msg
  snackbarColor.value = color
  snackbar.value = true
}

// ——— Parsing & slot helpers ———
const parseDt = (s) => {
  if (!s) {
    console.log('[Available] parseDt: null or undefined input')
    return null
  }
  if (typeof s !== 'string') {
    console.log('[Available] parseDt: not a string, type:', typeof s, 'value:', s)
    return null
  }
  // Match formats: "2024-01-01T09:00" or "2024-01-01 09:00:00" or "2024-01-01 09:00"
  const m = s.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
  if (m) {
    const result = { date: m[1], time: m[2] }
    console.log('[Available] parseDt success:', s, '->', result)
    return result
  }
  console.log('[Available] parseDt failed: no match for', s)
  return null
}
const isPastSlot = (date, time) => {
  const now = moment()
  const slot = `${date} ${time}`
  return moment(slot, 'YYYY-MM-DD HH:mm').isBefore(now)
}
const isLunch = (t) => t === '12:00' || t === '12:30'

// Same logic as calendar: filter by room, date, time, cancel/reject, and status + room auto_approve
// New structure: status BIT (1 = approved, 0/NULL = pending)
const getBookingForSlot = (roomId, date, time) => {
  const room = allRooms.value.find(r => String(r.id) === String(roomId))
  const roomAutoApprove = room ? (room.auto_approve === 1 || room.auto_approve === true) : false
  const result = bookings.value.find(b => {
    const rid = b.room_id ?? b.room?.id ?? b.room
    if (String(rid) !== String(roomId)) return false
    const bookingStatus = b.status
    const isCancelled = b.cancel === 1 || b.cancel === true
    const isRejected = b.reject === 1 || b.reject === true
    if (isCancelled || isRejected) return false
    
    // Check if approved: status === 1, 'approved', 'confirmed', or true
    const isApproved = (
      bookingStatus === 1 || 
      bookingStatus === 'approved' || 
      bookingStatus === 'confirmed' || 
      bookingStatus === true ||
      bookingStatus === '1'
    )
    
    let statusMatch = false
    if (roomAutoApprove) {
      // Room with auto-approve: show all bookings that are not cancelled/rejected
      statusMatch = true
    } else {
      // Room requires approval: show only approved bookings
      statusMatch = isApproved
    }
    if (!statusMatch) {
      // Debug: Log why booking is not shown
      if (String(rid) === String(roomId)) {
        console.log(`[Available] Booking ${b.id} status mismatch:`, {
          bookingStatus,
          isApproved,
          roomAutoApprove,
          roomId,
          date,
          time
        })
      }
      return false
    }
    const start = parseDt(b.start_datetime || b.start || b.start_time)
    const end = parseDt(b.end_datetime || b.end || b.end_time)
    if (!start || start.date !== date) return false
    // Check if time slot is within booking range
    const slotMin = timeSlots.findIndex(s => s.start === time)
    if (slotMin < 0) return false
    const startMin = timeSlots.findIndex(s => s.start === start.time)
    if (startMin < 0) return false
    const endMin = end ? timeSlots.findIndex(s => s.start === end.time) : startMin + 1
    const endSlotIndex = endMin >= 0 ? endMin : startMin + 1
    // Return true if this slot is within the booking range
    const isInRange = slotMin >= startMin && slotMin < endSlotIndex
    if (isInRange && String(rid) === String(roomId)) {
      console.log(`[Available] Found booking ${b.id} for slot:`, {
        roomId,
        date,
        time,
        bookingStart: start.time,
        bookingEnd: end?.time,
        slotMin,
        startMin,
        endSlotIndex,
        isInRange
      })
    }
    return isInRange
  })
  return result ?? null
}

const isBookingStartSlot = (roomId, date, time) => {
  const b = getBookingForSlot(roomId, date, time)
  if (!b) return false
  const start = parseDt(b.start_datetime || b.start || b.start_time)
  return start && start.date === date && start.time === time
}

const getBookingSpan = (roomId, date, time) => {
  const b = getBookingForSlot(roomId, date, time)
  if (!b) return 0
  const start = parseDt(b.start_datetime || b.start || b.start_time)
  const end = parseDt(b.end_datetime || b.end || b.end_time)
  if (!start || !end) return 1
  const si = timeSlots.findIndex(s => s.start === start.time)
  const ei = timeSlots.findIndex(s => s.start === end.time)
  if (si < 0) return 1
  return Math.max(1, (ei >= 0 ? ei : si + 1) - si)
}

// ช่องนี้อยู่ภายในการจอง (ไม่ใช่ช่องเริ่ม) — ไม่ต้องเรนเดอร์ <td> เพื่อไม่ให้มีคอลัมน์เกิน
// New structure: status BIT (1 = approved, 0/NULL = pending)
const isSlotPartOfBooking = (roomId, date, time) => {
  const room = allRooms.value.find(r => String(r.id) === String(roomId))
  const roomAutoApprove = room ? (room.auto_approve === 1 || room.auto_approve === true) : false
  const timeIndex = timeSlots.findIndex(s => s.start === time)
  if (timeIndex < 0) return false
  for (const b of bookings.value) {
    const rid = b.room_id ?? b.room?.id ?? b.room
    if (String(rid) !== String(roomId)) continue
    const bookingStatus = b.status
    const isCancelled = b.cancel === 1 || b.cancel === true
    const isRejected = b.reject === 1 || b.reject === true
    if (isCancelled || isRejected) continue
    
    // Check if approved: status === 1, 'approved', 'confirmed', or true
    const isApproved = (
      bookingStatus === 1 || 
      bookingStatus === 'approved' || 
      bookingStatus === 'confirmed' || 
      bookingStatus === true ||
      bookingStatus === '1'
    )
    
    let statusMatch = false
    if (roomAutoApprove) {
      // Room with auto-approve: show all bookings that are not cancelled/rejected
      statusMatch = true
    } else {
      // Room requires approval: show only approved bookings
      statusMatch = isApproved
    }
    if (!statusMatch) continue
    const bStart = parseDt(b.start_datetime || b.start || b.start_time)
    const bEnd = parseDt(b.end_datetime || b.end || b.end_time)
    if (!bStart || bStart.date !== date) continue
    const startIndex = timeSlots.findIndex(s => s.start === bStart.time)
    if (startIndex < 0) continue
    const endIndex = bEnd ? timeSlots.findIndex(s => s.start === bEnd.time) : startIndex + 1
    const endSlotIndex = endIndex >= 0 ? endIndex : startIndex + 1
    if (timeIndex > startIndex && timeIndex < endSlotIndex) return true
  }
  return false
}

// ช่องที่ต้องแสดงในแถว (ไม่รวมช่องที่อยู่ภายในการจอง) — ใช้กับ v-for แทน v-if+v-for
const getVisibleSlotItems = (roomId, date) => {
  const items = []
  for (const slot of timeSlots) {
    if (!slot || slot.start == null) continue
    if (isBookingStartSlot(roomId, date, slot.start)) {
      items.push({ slot, colspan: getBookingSpan(roomId, date, slot.start) })
    } else if (!isSlotPartOfBooking(roomId, date, slot.start)) {
      items.push({ slot, colspan: 1 })
    }
  }
  return items
}

// ——— Slot click ———
const slotClick = (room, date, time) => {
  if (isPastSlot(date, time)) {
    showToast('คุณไม่สามารถจองช่องเวลาที่ผ่านมาแล้วได้', 'error')
    return
  }
  const b = getBookingForSlot(room.id, date, time)
  if (b) {
    openViewModal(b)
  } else {
    openNewModal(room, date, time)
  }
}

// ——— Modals ———
const openNewModal = async (room, date, time) => {
  bookingMode.value = 'new'
  viewingBooking.value = null
  form.name = 'จองห้อง'
  form.room_id = String(room.id)
  form.bookingDate = date
  form.startTime = time
  const [h, m] = time.split(':').map(Number)
  const endMin = h * 60 + m + 30
  form.endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
  form.description = ''
  form.objective = 'ประชุม'
  form.attendeesEmails = []
  attendeesText.value = ''
  await populateRoomOptions(form.room_id)
  updateCapacityLimit(form.room_id)
  showCancelBtn.value = false
  showRejectBtn.value = false
  showEditBtn.value = false
  showConfirmBtn.value = true
  showAutoCancelArea.value = false
  showBookingModal.value = true
}

const openViewModal = async (booking) => {
  bookingMode.value = 'view'
  viewingBooking.value = booking
  const start = parseDt(booking.start_datetime || booking.start || booking.start_time)
  const end = parseDt(booking.end_datetime || booking.end || booking.end_time)
  form.room_id = String(booking.room_id ?? booking.room?.id ?? booking.room ?? '')
  form.name = booking.name || booking.title || ''
  form.bookingDate = start?.date || ''
  form.startTime = start?.time || ''
  form.endTime = end?.time || ''
  form.description = booking.description || ''
  form.objective = booking.objective || 'ประชุม'
  const parts = booking.participants
  form.attendeesEmails = Array.isArray(parts) ? [...parts] : (typeof parts === 'string' && parts ? parts.split(',').map(e => e.trim()) : [])
  attendeesText.value = form.attendeesEmails.join(', ')
  await populateRoomOptions(form.room_id)
  updateCapacityLimit(form.room_id)

  const uid = authStore.user?.id
  const bookerId = booking.booker_id ?? booking.user_id
  const isOwner = uid != null && bookerId != null && Number(uid) === Number(bookerId)

  showCancelBtn.value = isOwner
  showRejectBtn.value = isSuperAdmin.value && !isOwner
  showEditBtn.value = isOwner
  showConfirmBtn.value = false
  showAutoCancelArea.value = isSuperAdmin.value
  autoCancelBookingId.value = booking.id
  autoCancelChecked.value = !!booking.auto_cancel
  showBookingModal.value = true
}

const closeBookingModal = () => {
  showBookingModal.value = false
  viewingBooking.value = null
}

const enableEditMode = () => {
  bookingMode.value = 'edit'
  showConfirmBtn.value = true
}

const populateRoomOptions = async (preselectId = '') => {
  try {
    const res = await api.get('/rooms')
    const list = res.data?.data || []
    roomOptions.value = list.map(r => ({ id: r.id, name: r.name }))
    if (preselectId && roomOptions.value.some(r => String(r.id) === String(preselectId))) {
      form.room_id = String(preselectId)
    }
  } catch (e) {
    console.error(e)
    roomOptions.value = []
  }
}

const updateCapacityLimit = (roomId) => {
  const r = allRooms.value.find(x => String(x.id) === String(roomId))
  const seat = r?.seat ?? r?.capacity ?? 0
  capacityLimit.value = Math.max(0, Number(seat) - 1)
}

// Enforce attendee limit when parsing attendeesText
const clampedAttendees = computed(() => {
  const arr = attendeesText.value.split(',').map(e => e.trim()).filter(Boolean)
  const cap = capacityLimit.value
  if (cap <= 0) return arr
  return arr.slice(0, cap)
})

watch(attendeesText, () => {
  const arr = attendeesText.value.split(',').map(e => e.trim()).filter(Boolean)
  if (capacityLimit.value > 0 && arr.length > capacityLimit.value) {
    attendeesText.value = arr.slice(0, capacityLimit.value).join(', ')
    showToast(`คุณสามารถเพิ่มผู้เข้าร่วมได้สูงสุด ${capacityLimit.value} คน`, 'warning')
  }
})

watch(() => form.room_id, id => {
  updateCapacityLimit(id)
})

// User search for attendees
watch(attendeeSearchQuery, () => {
  if (attendeeSearchTimer) clearTimeout(attendeeSearchTimer)
  const q = (attendeeSearchQuery.value || '').trim()
  if (q.length < 2) {
    attendeeSuggestions.value = []
    showAttendeeSuggestions.value = false
    return
  }
  attendeeSearchTimer = setTimeout(async () => {
    try {
      const res = await api.get('/users/search', { params: { q } })
      const data = res.data?.data ?? res.data ?? []
      attendeeSuggestions.value = Array.isArray(data) ? data : []
      showAttendeeSuggestions.value = attendeeSuggestions.value.length > 0
    } catch {
      attendeeSuggestions.value = []
      showAttendeeSuggestions.value = false
    }
  }, 300)
})

const addAttendeeFromSuggestion = (user) => {
  const email = user.email || user.name
  if (!email) return
  const cur = attendeesText.value.split(',').map(e => e.trim()).filter(Boolean)
  if (capacityLimit.value > 0 && cur.length >= capacityLimit.value) {
    showToast(`คุณสามารถเพิ่มผู้เข้าร่วมได้สูงสุด ${capacityLimit.value} คน`, 'warning')
    return
  }
  if (!cur.includes(email)) cur.push(email)
  attendeesText.value = cur.join(', ')
  form.attendeesEmails = cur
  showAttendeeSuggestions.value = false
  attendeeSearchQuery.value = ''
}

// Sync form.attendeesEmails with attendeesText when submitting
const getAttendeesEmails = () => {
  return attendeesText.value.split(',').map(e => e.trim()).filter(Boolean)
}

// ——— Submit new booking (same API & payload as calendar) ———
// หมายเหตุ: อีเมลผู้เข้าร่วมไม่บังคับ — ส่งค่าว่างได้
const submitNewBooking = async () => {
  if (!form.room_id || !form.name?.trim()) {
    showToast('กรุณากรอกห้องและชื่อการจอง', 'error')
    return
  }
  if (!form.bookingDate || !form.startTime || !form.endTime) {
    showToast('กรุณากรอกวันที่และเวลาเริ่มต้น-สิ้นสุด', 'error')
    return
  }
  if (form.startTime >= form.endTime) {
    showToast('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', 'error')
    return
  }

  const emails = getAttendeesEmails() // อาจเป็น [] ได้ — ไม่บังคับผู้เข้าร่วม
  const startDateTime = `${form.bookingDate} ${form.startTime}:00`
  const endDateTime = `${form.bookingDate} ${form.endTime}:00`

  try {
    const res = await api.get('/bookings/calendar', { params: { start: form.bookingDate, end: form.bookingDate } })
    const existing = res.data?.data || []
    const roomBookings = existing.filter(b => String(b.room_id ?? b.room?.id ?? b.room) === String(form.room_id) && b.cancel !== 1 && b.reject !== 1)
    const overlap = roomBookings.some(b => {
      const bs = moment(b.start_datetime || b.start, 'YYYY-MM-DD HH:mm')
      const be = moment(b.end_datetime || b.end, 'YYYY-MM-DD HH:mm')
      const ns = moment(startDateTime, 'YYYY-MM-DD HH:mm')
      const ne = moment(endDateTime, 'YYYY-MM-DD HH:mm')
      return (ns.isBefore(be) && ne.isAfter(bs))
    })
    if (overlap) {
      showToast('การจองซ้อนทับกับการจองที่มีอยู่', 'error')
      return
    }
  } catch (e) {
    console.error(e)
  }

  saving.value = true
  try {
    await api.post('/bookings', {
      room_id: form.room_id,
      name: form.name,
      description: form.description,
      start_datetime: startDateTime,
      end_datetime: endDateTime,
      attendees: emails.length || 0,
      attendeesEmails: emails,
    })
    showToast('ส่งคำขอจองห้องเรียบร้อยแล้ว')
    closeBookingModal()
    fetchBookings()
  } catch (e) {
    showToast(e.response?.data?.message || 'เกิดข้อผิดพลาดในการจอง', 'error')
  } finally {
    saving.value = false
  }
}

// ——— Update booking (same API & payload as calendar: title, start_time, end_time) ———
const submitUpdateBooking = async () => {
  if (!viewingBooking.value?.id) return
  saving.value = true
  try {
    const emails = getAttendeesEmails()
    const startDateTime = `${form.bookingDate} ${form.startTime}:00`
    const endDateTime = `${form.bookingDate} ${form.endTime}:00`
    await api.put(`/bookings/${viewingBooking.value.id}`, {
      title: form.name,
      description: form.description,
      start_time: startDateTime,
      end_time: endDateTime,
      attendees: emails.length || 0,
      objective: form.objective,
      room_id: form.room_id || viewingBooking.value.room_id || viewingBooking.value.room,
    })
    showToast('การจองได้รับการอัปเดตเรียบร้อยแล้ว')
    closeBookingModal()
    fetchBookings()
  } catch (e) {
    showToast(e.response?.data?.message || 'เกิดข้อผิดพลาดในการอัปเดต', 'error')
  } finally {
    saving.value = false
  }
}

// ——— Cancel / Reject ———
const cancelBooking = async () => {
  if (!viewingBooking.value?.id) return
  if (!confirm('คุณต้องการยกเลิกการจองนี้ใช่หรือไม่?')) return
  try {
    await api.post(`/bookings/${viewingBooking.value.id}/cancel`)
    showToast('ยกเลิกการจองเรียบร้อยแล้ว')
    closeBookingModal()
    fetchBookings()
  } catch (e) {
    showToast(e.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
  }
}

const rejectBooking = async () => {
  if (!viewingBooking.value?.id) return
  if (!confirm('คุณต้องการปฏิเสธการจองนี้ใช่หรือไม่?')) return
  try {
    await api.post(`/bookings/${viewingBooking.value.id}/reject`)
    showToast('ปฏิเสธการจองเรียบร้อยแล้ว')
    closeBookingModal()
    fetchBookings()
  } catch (e) {
    showToast(e.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
  }
}

const toggleAutoCancel = async () => {
  const id = autoCancelBookingId.value
  if (!id) return
  try {
    await api.post(`/bookings/${id}/auto-cancel`, { auto_cancel: autoCancelChecked.value })
    showToast('อัปเดตสถานะห้ามยกเลิกเรียบร้อยแล้ว')
    fetchBookings()
  } catch (e) {
    showToast(e.response?.data?.message || 'เกิดข้อผิดพลาด', 'error')
  }
}

// ——— Tooltip ———
const tooltipEl = ref(null)
const tooltipBooking = ref(null)
const tooltipPos = ref({ x: 0, y: 0 })
const showTooltip = (ev, booking) => {
  if (!booking) return
  tooltipBooking.value = booking
  const r = ev.currentTarget.getBoundingClientRect()
  tooltipPos.value = { x: r.left + r.width / 2, y: r.top }
}
const hideTooltip = () => { tooltipBooking.value = null }

// ——— Fetch ———
// ดึงข้อมูลแบบเดียวกับ calendar.vue: API เดียวกัน ลำดับและรูปแบบ response เดียวกัน
// - GET /rooms → response.data.data || []
// - GET /bookings/calendar?start=&end= → response.data.data || []
// เหมือน calendar.vue: GET /rooms
const fetchRooms = async () => {
  try {
    const response = await api.get('/rooms')
    allRooms.value = response.data?.data || []
    if (allRooms.value.length > 0 && selectedRoomIds.value.length === 0) {
      selectedRoomIds.value = allRooms.value.map(r => String(r.id))
      selectAllRooms.value = true
    }
  } catch (e) {
    console.error(e)
    allRooms.value = []
  }
}

// เหมือน calendar.vue: GET /bookings/calendar พร้อม params start, end
const fetchBookings = async () => {
  try {
    const response = await api.get('/bookings/calendar', {
      params: {
        start: startDate.value,
        end: endDate.value,
      },
    })
    bookings.value = response.data?.data || []
    console.log('[Available] Fetched bookings:', bookings.value.length, 'bookings')
    if (bookings.value.length > 0) {
      bookings.value.forEach((b, index) => {
        console.log(`[Available] Booking ${index + 1}:`, {
          id: b.id,
          name: b.name || b.title,
          room_id: b.room_id || b.room,
          status: b.status,
          cancel: b.cancel,
          reject: b.reject,
          start_datetime: b.start_datetime || b.start,
          end_datetime: b.end_datetime || b.end,
          objective: b.objective
        })
      })
    }
  } catch (e) {
    console.error('[Available] Error fetching bookings:', e)
    bookings.value = []
  }
}

const onDateChange = (start, end) => {
  startDate.value = start
  endDate.value = end
  fetchBookings()
}

// ——— Room selection (เหมือน calendar) ———
const toggleSelectAllRooms = () => {
  selectAllRooms.value = !selectAllRooms.value
  selectedRoomIds.value = selectAllRooms.value ? allRooms.value.map(r => String(r.id)) : []
}

const onRoomToggle = (roomId, checked) => {
  const idStr = String(roomId)
  if (checked) {
    if (!selectedRoomIds.value.includes(idStr)) {
      selectedRoomIds.value = [...selectedRoomIds.value, idStr]
    }
  } else {
    selectedRoomIds.value = selectedRoomIds.value.filter(id => id !== idStr)
  }
  selectAllRooms.value = allRooms.value.length > 0 && selectedRoomIds.value.length === allRooms.value.length
}

// ——— Date range picker ———
// Same as calendar: fixed 30 days ahead (no quota API)
const initDateRangePicker = () => {
  nextTick(() => {
    if (!dateRangeInput.value) return
    if (typeof window !== 'undefined') {
      window.moment = window.moment || moment
    }
    const maxDays = isSuperAdmin.value ? 365 : 30
    const el = dateRangeInput.value
    const $input = $(el)
    if ($input.data('daterangepicker')) {
      $input.data('daterangepicker').remove()
    }
    $input.daterangepicker({
      startDate: moment(startDate.value),
      endDate: moment(endDate.value),
      minDate: moment(),
      maxDate: moment().add(maxDays, 'days'),
      locale: { format: 'DD/MM/YYYY', applyLabel: 'ตกลง', cancelLabel: 'ยกเลิก', daysOfWeek: ['อา','จ','อ','พ','พฤ','ศ','ส'], monthNames: ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'] },
    }, (start, end) => {
      startDate.value = start.format('YYYY-MM-DD')
      endDate.value = end.format('YYYY-MM-DD')
      fetchBookings()
    })
  })
}

// ——— Lifecycle ———
// ลำดับเหมือน calendar.vue: โหลด rooms ก่อน → ตั้งค่า picker → โหลด bookings
onMounted(async () => {
  moment.locale('th')
  await fetchRooms()
  initDateRangePicker()
  await fetchBookings()
})

// เหมือน calendar.vue: เปลี่ยนช่วงวันที่แล้วโหลด bookings ใหม่เมื่อมีห้อง
watch([startDate, endDate], () => {
  if (allRooms.value.length > 0) fetchBookings()
})

onBeforeUnmount(() => {
  if (dateRangeInput.value && $(dateRangeInput.value).data('daterangepicker')) {
    $(dateRangeInput.value).data('daterangepicker').remove()
  }
})

</script>

<template>
  <div class="avaliable-page">
    <!-- Header (สไตล์เดียวกับ calendar) -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard class="page-header-card">
          <VCardText>
            <div class="d-flex align-center justify-space-between flex-wrap gap-4">
              <div class="d-flex align-center gap-4">
                <VAvatar size="64" color="primary" variant="flat" class="page-header-avatar">
                  <VIcon size="32" icon="tabler-calendar-event" />
                </VAvatar>
                <div>
                  <h4 class="text-h4 mb-1 page-title">ตารางห้องว่าง</h4>
                  <p class="text-body-2 mb-0 text-medium-emphasis">เลือกช่วงวันที่และอาคาร เพื่อดูตารางและจองห้อง</p>
                </div>
              </div>
              <VBtn color="info" variant="tonal" class="help-btn" @click="showHelpModal = true">
                <VIcon icon="tabler-help" class="me-2" />
                วิธีใช้งานการจองห้อง
              </VBtn>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Date range (โครงและสไตล์เหมือน calendar) -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard class="date-range-card">
          <VCardText>
            <VRow>
              <VCol cols="12" md="6" lg="4">
                <label for="dateRangeAvaliable" class="date-range-label">เลือกช่วงวันที่</label>
            <input
              ref="dateRangeInput"
                  id="dateRangeAvaliable"
              type="text"
                  class="form-control"
              readonly
                  style="cursor: pointer;"
            />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- ไม่มีห้องที่เลือก (เมื่อมีห้องในระบบแต่ยังไม่เลือก) -->
    <VRow v-if="allRooms.length > 0 && filteredRooms.length === 0" class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardText class="text-center py-12">
            <VIcon size="80" icon="tabler-alert-circle" color="warning" class="mb-4" />
            <h5 class="text-h5 mb-2">ไม่มีห้องที่เลือก</h5>
            <p class="text-body-2 mb-0">กรุณาเลือกห้องที่ต้องการแสดงจากรายการด้านบน</p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Schedule Grid with Room Selection (เหมือน calendar) -->
    <VRow v-show="allRooms.length > 0" class="mb-4">
      <VCol cols="12">
        <VCard class="schedule-section-card">
          <VCardTitle class="schedule-section-title">
            <VIcon icon="tabler-door-open" class="me-2" />
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
                  :model-value="selectedRoomIds.includes(String(room.id))"
                  :label="room.name"
                  @update:model-value="(v) => onRoomToggle(room.id, v)"
                >
                  <template #prepend>
                    <VIcon icon="tabler-door-open" class="me-2" />
                  </template>
                </VCheckbox>
              </VCol>
              <VCol cols="6" md="4" lg="3" xl="2">
                <VCheckbox
                  id="select-all-rooms"
                  :model-value="selectAllRooms"
                  label="เลือกทั้งหมด / ไม่เลือก"
                  @update:model-value="toggleSelectAllRooms"
                />
              </VCol>
            </VRow>
          </VCardText>

          <!-- Schedule Grid (ตารางห้องว่าง) -->
          <VCardText v-if="filteredRooms.length > 0" class="schedule-grid-wrap pt-0 pb-0">
        <div class="tables-container">
          <VCard
            v-for="day in dateRange"
            :key="day.date"
            class="day-card avaliable-day-card"
          >
            <VCardTitle
              class="day-header"
              :class="'day-' + day.dayOfWeek"
            >
              <VIcon icon="tabler-calendar" class="day-header-calendar-icon me-3" size="24" />
              <div class="day-badge">
                <span class="day-name">{{ day.dayName }}</span>
                <span class="day-date">{{ day.formattedDate }}</span>
              </div>
            </VCardTitle>
            <VCardText class="pa-0">
              <div class="table-scroll table-scroll-wrap">
                <table class="schedule-table">
                  <thead>
                    <tr>
                      <th class="col-room room-column-header">ห้อง</th>
                      <th
                        v-for="slot in timeSlots"
                        :key="slot.start"
                        class="col-time time-column-header"
                        :class="{ 'lunch-time': isLunch(slot.start) }"
                      >
                        <span class="time-start">{{ slot.start }}</span>
                        <span class="time-end">{{ slot.end }}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="room in displayRooms" :key="`${room.id}-${day.date}`" class="room-row">
                      <td class="col-room room-name">
                        <RouterLink
                          :to="{ name: 'rooms-id', params: { id: room.id } }"
                          class="room-link"
                        >
                          {{ room.name }}
                        </RouterLink>
                      </td>
                      <td
                        v-for="(item, slotIndex) in getVisibleSlotItems(room.id, day.date)"
                        :key="item.slot ? item.slot.start : `slot-${slotIndex}`"
                        class="col-time slot"
                        :class="{
                          past: item.slot && isPastSlot(day.date, item.slot.start),
                          lunch: item.slot && isLunch(item.slot.start),
                          booked: item.slot && !!getBookingForSlot(room.id, day.date, item.slot.start),
                          start: item.slot && isBookingStartSlot(room.id, day.date, item.slot.start),
                        }"
                        :colspan="item.colspan"
                        @click="item.slot && slotClick(room, day.date, item.slot.start)"
                        @mouseenter="item.slot && showTooltip($event, getBookingForSlot(room.id, day.date, item.slot.start))"
                        @mouseleave="hideTooltip"
                      >
                        <template v-if="item.slot && isBookingStartSlot(room.id, day.date, item.slot.start)">
                          <span
                            class="booking-label"
                            :style="{ backgroundColor: getObjectiveColor((getBookingForSlot(room.id, day.date, item.slot.start)?.objective)) }"
                          >
                            <span class="booking-label-text">{{ (getBookingForSlot(room.id, day.date, item.slot.start)?.name || getBookingForSlot(room.id, day.date, item.slot.start)?.title || '')?.slice(0,20) }}{{ ((getBookingForSlot(room.id, day.date, item.slot.start)?.name||'').length > 20) ? '...' : '' }}</span>
                          </span>
                        </template>
                        <template v-else-if="item.slot && isPastSlot(day.date, item.slot.start)">
                          <VIcon icon="tabler-ban" color="error" size="small" />
                        </template>
                        <template v-else-if="item.slot">
                          <VIcon icon="tabler-plus" size="small" class="text-medium-emphasis" />
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </VCardText>
          </VCard>
        </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- ไม่มีห้องที่เลือก หรือ ไม่มีห้องในระบบ -->
    <VRow v-if="allRooms.length === 0" class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardText class="text-center py-12">
            <VIcon icon="tabler-building-off" size="64" color="warning" class="mb-4" />
            <p class="mb-0">ไม่พบข้อมูลห้องจากระบบ</p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Help Modal -->
    <VDialog v-model="showHelpModal" max-width="700" persistent content-class="help-dialog">
      <VCard class="help-modal-card">
        <VCardTitle class="d-flex align-center help-modal-title">
          <VIcon icon="tabler-help" class="me-2" />
          วิธีใช้งานการจองห้อง
        </VCardTitle>
        <VCardText class="help-modal-body">
          <div class="help-step-indicator mb-4">
            <span
              v-for="(_, i) in helpSteps"
              :key="i"
              class="help-dot"
              :class="{ active: helpStep === i + 1 }"
            />
          </div>
          <div v-for="(step, i) in helpSteps" :key="i" v-show="helpStep === i + 1" class="help-step-content">
            <div class="step-num mb-3">{{ i + 1 }}</div>
            <h6 class="text-h6 mb-2">{{ step.title }}</h6>
            <p class="text-body-2 text-medium-emphasis">{{ step.desc }}</p>
          </div>
        </VCardText>
        <VCardActions class="d-flex justify-space-between">
          <VBtn :disabled="helpStep <= 1" @click="helpStep--">ก่อนหน้า</VBtn>
          <div class="d-flex gap-2">
            <VBtn v-if="helpStep < helpSteps.length" color="primary" @click="helpStep++">ถัดไป</VBtn>
            <VBtn v-else color="success" @click="showHelpModal = false">เสร็จสิ้น</VBtn>
          </div>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Booking Modal (จองห้องแบบเดียวกับ calendar: คลิกช่องว่าง → เปิดฟอร์ม → ยืนยันการจอง) -->
    <VDialog v-model="showBookingModal" max-width="700" persistent scrollable>
      <VCard>
        <VCardTitle class="d-flex align-center justify-space-between">
          <span>{{ bookingMode === 'new' ? 'จองห้อง' : (bookingMode === 'edit' ? 'แก้ไขการจอง' : 'รายละเอียดการจอง') }}</span>
          <VBtn icon variant="text" size="small" @click="closeBookingModal"><VIcon icon="tabler-x" /></VBtn>
        </VCardTitle>
        <VCardText>
          <VForm @submit.prevent="bookingMode === 'new' ? submitNewBooking() : submitUpdateBooking()">
          <VRow>
            <VCol cols="12">
              <AppTextField v-model="form.name" label="ชื่อการจอง" :disabled="bookingMode === 'view'" />
            </VCol>
            <VCol cols="12" md="6">
              <AppSelect
                v-model="form.room_id"
                label="ห้อง"
                :items="roomOptions.map(r => ({ title: r.name, value: String(r.id) }))"
                :disabled="bookingMode === 'view'"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField v-model="form.bookingDate" label="วันที่" type="date" :disabled="bookingMode === 'view'" />
            </VCol>
            <VCol cols="12" md="6">
              <AppSelect
                v-model="form.startTime"
                label="เวลาเริ่มต้น"
                :items="timeOptionsForForm"
                :disabled="bookingMode === 'view'"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppSelect
                v-model="form.endTime"
                label="เวลาสิ้นสุด"
                :items="timeOptionsForForm"
                :disabled="bookingMode === 'view'"
              />
            </VCol>
            <VCol cols="12">
              <AppSelect
                v-model="form.objective"
                label="วัตถุประสงค์"
                :items="objectives.map(o => ({ title: o, value: o }))"
                :disabled="bookingMode === 'view'"
              />
            </VCol>
            <VCol cols="12">
              <AppTextarea v-model="form.description" label="รายละเอียด" rows="2" :disabled="bookingMode === 'view'" />
            </VCol>
            <VCol cols="12">
              <label class="text-body-2 font-weight-medium mb-1 d-block">อีเมลผู้เข้าร่วม (ไม่บังคับ{{ capacityLimit > 0 ? `, สูงสุด ${capacityLimit} คน` : '' }})</label>
              <AppTextField
                v-model="attendeesText"
                placeholder="ไม่บังคับ — ใส่อีเมลคั่นด้วย comma หรือค้นหาชื่อ/อีเมล (เว้นว่างได้)"
                :disabled="bookingMode === 'view'"
                :rules="[]"
                @focus="attendeeSearchQuery = attendeesText.split(',').pop()?.trim() || ''"
                @input="attendeeSearchQuery = attendeesText.split(',').pop()?.trim() || ''"
              />
              <VCard v-if="showAttendeeSuggestions && attendeeSuggestions.length" class="mt-1 suggestions-dropdown" elevation="4">
                <VList density="compact">
                  <VListItem
                    v-for="u in attendeeSuggestions"
                    :key="u.id"
                    @click="addAttendeeFromSuggestion(u)"
                  >
                    <VListItemTitle>{{ u.name }}</VListItemTitle>
                    <VListItemSubtitle>{{ u.email }}</VListItemSubtitle>
                  </VListItem>
                </VList>
              </VCard>
            </VCol>
            <VCol v-if="showAutoCancelArea" cols="12">
              <VCheckbox v-model="autoCancelChecked" label="ห้ามยกเลิก" @update:model-value="toggleAutoCancel" />
            </VCol>
          </VRow>
          </VForm>
        </VCardText>
        <VCardActions class="d-flex justify-space-between">
          <div>
            <VBtn v-if="showCancelBtn" color="error" variant="outlined" @click="cancelBooking">ยกเลิกการจอง</VBtn>
            <VBtn v-if="showRejectBtn" color="warning" variant="outlined" @click="rejectBooking">ปฏิเสธการจอง</VBtn>
          </div>
          <div class="d-flex gap-2">
            <VBtn variant="outlined" @click="closeBookingModal">ปิด</VBtn>
            <VBtn v-if="showEditBtn && bookingMode === 'view'" color="warning" @click="enableEditMode">แก้ไขตาราง</VBtn>
            <VBtn
              v-if="showConfirmBtn"
              color="primary"
              :loading="saving"
              @click="bookingMode === 'new' ? submitNewBooking() : submitUpdateBooking()"
            >
              {{ bookingMode === 'new' ? 'ยืนยันการจอง' : 'บันทึกการเปลี่ยนแปลง' }}
            </VBtn>
          </div>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Tooltip (floating) -->
    <div
      v-if="tooltipBooking"
      class="booking-tooltip"
      :style="{ left: (tooltipPos.x - 120) + 'px', top: (tooltipPos.y - 140) + 'px' }"
    >
      <div><strong>วัตถุประสงค์:</strong> {{ tooltipBooking.objective }}</div>
      <div><strong>ชื่อการจอง:</strong> {{ tooltipBooking.name || tooltipBooking.title }}</div>
      <div><strong>ผู้จอง:</strong> {{ tooltipBooking.booker_name || tooltipBooking.booker }}</div>
      <div><strong>เวลา:</strong> {{ parseDt(tooltipBooking.start_datetime || tooltipBooking.start)?.time }} - {{ parseDt(tooltipBooking.end_datetime || tooltipBooking.end)?.time }}</div>
    </div>

    <!-- Snackbar -->
    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000" location="top end">
      {{ snackbarText }}
    </VSnackbar>
  </div>
</template>

<style scoped>
/* ——— หน้า (เหมือน calendar) ——— */
.avaliable-page {
  padding: 0;
  min-height: 100%;
  background:
    radial-gradient(ellipse 120% 80% at 50% -20%, rgba(102, 126, 234, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse 80% 60% at 100% 50%, rgba(118, 75, 162, 0.04) 0%, transparent 45%),
    linear-gradient(180deg, rgba(102, 126, 234, 0.03) 0%, transparent 200px);
}

/* ——— Header card ——— */
.page-header-card {
  border-radius: 20px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.05) 50%, rgba(102, 126, 234, 0.04) 100%) !important;
  border: 1px solid rgba(102, 126, 234, 0.15);
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
}
.page-header-card:hover {
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.16), 0 4px 12px rgba(0, 0, 0, 0.06);
  border-color: rgba(102, 126, 234, 0.2);
}
.page-header-avatar {
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.3);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.page-header-card:hover .page-header-avatar {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.35);
}
.page-title {
  font-weight: 800;
  letter-spacing: -0.02em;
  color: rgb(var(--v-theme-on-surface));
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}
.help-btn {
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.02em;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.help-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
}

/* ——— Filter cards (วันที่ + อาคาร) ——— */
.filter-card {
  border-radius: 14px;
  border: 1px solid rgba(102, 126, 234, 0.08);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
}
.filter-card:hover {
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.1);
  border-color: rgba(102, 126, 234, 0.14);
}
.filter-card-title {
  font-weight: 700;
  letter-spacing: 0.01em;
}

/* ——— Schedule section card (เลือกห้อง + ตาราง) ——— */
.schedule-section-card {
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(102, 126, 234, 0.1);
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
  background: linear-gradient(180deg, #fff 0%, #fafbff 100%);
}
.schedule-section-title {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.06) 0%, rgba(118, 75, 162, 0.04) 100%);
  border-bottom: 1px solid rgba(102, 126, 234, 0.1);
  font-weight: 800;
  letter-spacing: 0.02em;
  color: rgb(var(--v-theme-on-surface));
}

/* ——— Date range card ——— */
.date-range-card {
  border-radius: 16px;
  border: 1px solid rgba(102, 126, 234, 0.1);
  box-shadow: 0 2px 12px rgba(102, 126, 234, 0.06);
  background: linear-gradient(180deg, #fff 0%, #fafbff 100%);
}
.date-range-label {
  font-weight: 600;
  color: #334155;
  letter-spacing: 0.02em;
  margin-bottom: 6px;
  display: block;
}

/* ——— Date range input (เหมือน calendar .form-control) ——— */
.form-control {
  display: block;
  width: 100%;
  padding: 0.65rem 1rem;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5;
  color: #1e293b;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
  background-clip: padding-box;
  border: 1px solid rgba(102, 126, 234, 0.2);
  appearance: none;
  border-radius: 12px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.06);
}
.form-control:hover {
  border-color: rgba(102, 126, 234, 0.35);
}
.form-control:focus {
  color: #1e293b;
  background: #fff;
  border-color: #667eea;
  outline: 0;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

/* ให้ daterangepicker แสดงเหนือ overlay */
:deep(.daterangepicker) {
  z-index: 9999 !important;
  display: block !important;
}

/* ——— Empty state ——— */
.empty-state-card {
  border-radius: 16px;
  border: 1px dashed rgba(102, 126, 234, 0.2);
  background: linear-gradient(180deg, rgba(102, 126, 234, 0.02) 0%, transparent 100%);
}
.empty-state-content {
  padding: 48px 24px !important;
}
.empty-state-icon-wrap {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 193, 7, 0.06) 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.empty-state-icon {
  color: rgb(var(--v-theme-warning));
  opacity: 0.9;
}

/* ——— Help modal ——— */
.help-modal-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.12);
}
.help-modal-title {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, rgba(118, 75, 162, 0.9) 100%);
  color: #fff !important;
  font-weight: 700;
}
.help-modal-body {
  padding: 24px 28px !important;
}
.help-step-indicator {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}
.help-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
}
.help-dot.active {
  background: rgb(var(--v-theme-primary));
  transform: scale(1.25);
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.3);
}
.help-step-content {
  min-height: 80px;
}
/* ——— Tables container (เหมือน calendar schedule-grid) ——— */
.tables-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

/* ——— Day card (เหมือน calendar day-schedule) ——— */
.avaliable-day-card {
  background: linear-gradient(180deg, #fff 0%, #fafbff 100%);
  border-radius: 24px;
  box-shadow:
    0 4px 6px -1px rgba(102, 126, 234, 0.06),
    0 10px 28px -4px rgba(102, 126, 234, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  border: 1px solid rgba(102, 126, 234, 0.1);
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease, border-color 0.3s ease;
  width: 100%;
  margin-bottom: 0;
  min-height: 0;
}
.avaliable-day-card:hover {
  box-shadow:
    0 12px 24px -4px rgba(102, 126, 234, 0.14),
    0 20px 48px -8px rgba(102, 126, 234, 0.18),
    0 4px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-4px);
  border-color: rgba(102, 126, 234, 0.18);
}
.avaliable-day-card :deep(.v-card__loader) {
  display: none;
}
.avaliable-day-card :deep(.v-card__text) {
  padding: 0 !important;
  flex: 0 0 auto;
  min-height: 0;
}
.avaliable-day-card :deep(.v-card__underlay) {
  display: none;
}

/* ——— Day header (เหมือน calendar day-header day-0..day-6) + animation ——— */
@keyframes day-header-enter {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes day-header-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes day-icon-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-3px) scale(1.05); }
}
@keyframes day-badge-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes day-date-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.day-header {
  padding: 22px 32px !important;
  min-height: auto !important;
  position: relative;
  overflow: hidden;
  display: flex !important;
  align-items: center;
  border-radius: 24px 24px 0 0;
  animation: day-header-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border-bottom: 3px solid rgba(255, 255, 255, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.day-header:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.day-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.12) 45%,
    rgba(255, 255, 255, 0.06) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: day-header-shimmer 5s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}
.day-header::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 55%;
  height: 100%;
  background: linear-gradient(105deg, transparent 25%, rgba(255, 255, 255, 0.15) 100%);
  pointer-events: none;
  z-index: 0;
}
/* Gradients สีสันสดใส 4-stop พร้อมความลึก */
.day-header.day-0 { background: linear-gradient(135deg, #FF7B7B 0%, #FF6B6B 35%, #EE5A5A 70%, #D64545 100%) !important; }
.day-header.day-1 { background: linear-gradient(135deg, #FFF176 0%, #FFE066 35%, #FFD93D 70%, #F4C430 100%) !important; }
.day-header.day-2 { background: linear-gradient(135deg, #FFB3F0 0%, #FF9FF3 35%, #F368E0 70%, #E056C7 100%) !important; }
.day-header.day-3 { background: linear-gradient(135deg, #6EE7A0 0%, #58D68D 35%, #2ECC71 70%, #27AE60 100%) !important; }
.day-header.day-4 { background: linear-gradient(135deg, #FF9F5C 0%, #FF8C42 35%, #FF6B35 70%, #E85D2C 100%) !important; }
.day-header.day-5 { background: linear-gradient(135deg, #7EC8F0 0%, #5DADE2 35%, #3498DB 70%, #2E86C1 100%) !important; }
.day-header.day-6 { background: linear-gradient(135deg, #D4A5E0 0%, #BB8FCE 35%, #9B59B6 70%, #8E44AD 100%) !important; }

/* Stagger header entrance ตามลำดับการ์ด */
.avaliable-day-card:nth-child(1) .day-header { animation-delay: 0s; }
.avaliable-day-card:nth-child(2) .day-header { animation-delay: 0.06s; }
.avaliable-day-card:nth-child(3) .day-header { animation-delay: 0.12s; }
.avaliable-day-card:nth-child(4) .day-header { animation-delay: 0.18s; }
.avaliable-day-card:nth-child(5) .day-header { animation-delay: 0.24s; }
.avaliable-day-card:nth-child(6) .day-header { animation-delay: 0.3s; }
.avaliable-day-card:nth-child(7) .day-header { animation-delay: 0.36s; }
.avaliable-day-card:nth-child(n+8) .day-header { animation-delay: 0.42s; }

.day-header-calendar-icon {
  color: rgba(255, 255, 255, 0.98);
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  position: relative;
  z-index: 1;
  animation: day-icon-float 2.5s ease-in-out infinite;
  animation-delay: 0.3s;
  transition: filter 0.3s ease;
}
.day-header:hover .day-header-calendar-icon {
  animation-duration: 1.5s;
  filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.25));
}

.day-badge {
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
  gap: 4px;
}
.day-name {
  font-size: 1.75rem;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.15);
  letter-spacing: 0.02em;
  animation: day-badge-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
  line-height: 1.2;
}
.day-date {
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.98);
  font-weight: 600;
  margin-top: 0;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
  animation: day-date-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s both;
  letter-spacing: 0.05em;
  opacity: 0.95;
}

/* ——— ตารางเวลา (เหมือน calendar time-grid) ——— */
.table-scroll {
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-width: thin;
  scrollbar-color: #667eea #f1f1f1;
}
.table-scroll-wrap {
  background: linear-gradient(180deg, #f8fafc 0%, #fff 50%, #fafbff 100%);
  border-radius: 0 0 24px 24px;
  padding: 0;
  margin: 0;
  display: block;
  width: fit-content;
  max-width: 100%;
  box-shadow: inset 0 2px 8px rgba(102, 126, 234, 0.04);
}
.table-scroll-wrap::-webkit-scrollbar {
  height: 10px;
}
.table-scroll-wrap::-webkit-scrollbar-track {
  background: linear-gradient(90deg, #f1f1f1, #e9ecef);
  border-radius: 5px;
}
.table-scroll-wrap::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 5px;
  border: 2px solid #f1f1f1;
}
.schedule-table {
  width: max-content;
  border-collapse: collapse;
  min-width: 900px;
}
.schedule-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
}
.schedule-table thead th {
  border-bottom: 3px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  padding: 14px 6px;
  text-align: center;
  font-weight: 700;
  color: #4a5568;
  font-size: 0.85rem;
}
.schedule-table thead th.room-column-header {
  width: 250px;
  min-width: 250px;
  max-width: 250px;
  padding: 14px 18px;
  text-align: left;
  background: linear-gradient(135deg, #667eea 0%, #5a67d8 100%) !important;
  color: #fff !important;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  box-shadow: 2px 0 8px rgba(102, 126, 234, 0.2);
}
.schedule-table thead th.time-column-header {
  background: #fff;
  min-width: 58px;
}
.schedule-table thead th.time-column-header:hover {
  background: #f7fafc;
}
.schedule-table thead th.time-column-header.lunch-time {
  background: linear-gradient(180deg, #FFF9E6 0%, #FFE8A3 100%) !important;
  color: #B7791F;
  border-left-color: #ECC94B;
}
.time-start {
  font-weight: 800;
  color: #2d3748;
  font-size: 0.9rem;
  display: block;
}
.time-end {
  font-weight: 600;
  color: #718096;
  font-size: 0.85rem;
  margin-top: 2px;
}
.schedule-table tbody tr.room-row {
  border-bottom: 1px solid #edf2f7;
  transition: all 0.25s ease;
}
.schedule-table tbody tr.room-row:nth-child(even) {
  background: rgba(102, 126, 234, 0.02);
}
.schedule-table tbody tr.room-row:hover {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.08) 0%, rgba(102, 126, 234, 0.03) 100%);
}
.schedule-table tbody tr.room-row:last-child {
  border-bottom: none;
}
.schedule-table tbody td {
  border-right: 1px solid #edf2f7;
  padding: 8px 4px;
  text-align: center;
  vertical-align: middle;
  min-height: 52px;
}
.schedule-table .col-room.room-name {
  width: 250px;
  min-width: 250px;
  max-width: 250px;
  padding: 14px 18px !important;
  text-align: left;
  font-weight: 700;
  color: #1e293b;
  background: linear-gradient(90deg, #f1f5f9 0%, #f8fafc 50%, #fff 100%);
  border-right: 3px solid #e2e8f0;
  font-size: 0.95rem;
  white-space: nowrap;
  position: sticky;
  left: 0;
  z-index: 5;
  box-shadow: 4px 0 16px rgba(102, 126, 234, 0.06);
}
.schedule-table .col-time {
  min-width: 58px;
  height: 52px;
}
.schedule-table .slot {
  cursor: pointer;
  min-height: 36px;
  transition: background 0.3s ease;
}
.schedule-table .slot.past {
  background: repeating-linear-gradient(-45deg, #f7fafc, #f7fafc 4px, #edf2f7 4px, #edf2f7 8px);
  cursor: not-allowed;
  opacity: 0.7;
}
.schedule-table .slot.lunch:not(.booked) {
  background: linear-gradient(180deg, rgba(236, 201, 75, 0.12) 0%, rgba(236, 201, 75, 0.06) 100%);
}
.schedule-table .slot:not(.past):not(.booked):hover {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.18) 0%, rgba(118, 75, 162, 0.12) 100%);
}
/* ช่องที่แสดงการจอง (start slot) — ให้ label เต็มเซลล์เหมือนโปรเจคเก่า */
.schedule-table .slot.start {
  padding: 0;
  vertical-align: top;
}
.schedule-table .slot.start .booking-label {
  filter: brightness(1);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 52px;
  box-sizing: border-box;
  border-radius: 0;
}
.schedule-table .booking-label {
  color: #fff;
  padding: 0 10px;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 52px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  letter-spacing: 0.3px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  transition: filter 0.2s ease;
  box-sizing: border-box;
}
.schedule-table .booking-label .booking-label-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.schedule-table .booking-label:hover {
  filter: brightness(1.12);
  transform: scale(1.02);
}
.room-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 700;
  transition: color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  border-radius: 8px;
  padding: 4px 8px;
  margin: -4px -8px;
  display: inline-block;
}
.room-link:hover {
  color: #5a67d8;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.08) 100%);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
}
.suggestions-dropdown { max-height: 200px; overflow-y: auto; }

/* ——— Tooltip (ลอยเหนือตาราง) ——— */
.booking-tooltip {
  position: fixed;
  z-index: 9999;
  background: linear-gradient(145deg, rgba(30, 30, 38, 0.98) 0%, rgba(22, 22, 28, 0.98) 100%);
  color: #fff;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 0.9rem;
  max-width: 280px;
  pointer-events: none;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.booking-tooltip div + div { margin-top: 6px; }
.booking-tooltip strong { color: rgba(255, 255, 255, 0.9); font-weight: 600; }

/* ——— Step number (Help modal) ——— */
.step-num {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, rgba(118, 75, 162, 0.9) 100%);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.1rem;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* ===== Responsive ===== */
@media (max-width: 959.98px) {
  .schedule-table thead th.room-column-header,
  .schedule-table .col-room.room-name {
    width: 180px;
    min-width: 180px;
    max-width: 180px;
    padding: 10px 12px !important;
    font-size: 0.85rem;
  }

  .avaliable-day-card {
    border-radius: 16px;
  }

  .empty-state-content {
    padding: 32px 16px !important;
  }

  .empty-state-icon-wrap {
    width: 80px;
    height: 80px;
  }
}

@media (max-width: 599.98px) {
  .schedule-table {
    min-width: 700px;
  }

  .schedule-table thead th.room-column-header,
  .schedule-table .col-room.room-name {
    width: 140px;
    min-width: 140px;
    max-width: 140px;
    padding: 8px 10px !important;
    font-size: 0.8rem;
  }

  .schedule-table thead th {
    padding: 10px 4px;
    font-size: 0.75rem;
  }

  .schedule-table .col-time {
    min-width: 48px;
  }

  .booking-tooltip {
    max-width: 220px;
    font-size: 0.8rem;
    padding: 10px 14px;
  }

  .avaliable-day-card {
    border-radius: 12px;
  }

  .help-modal-body {
    padding: 16px !important;
  }

  .step-num {
    width: 32px;
    height: 32px;
    font-size: 0.95rem;
  }
}
</style>
