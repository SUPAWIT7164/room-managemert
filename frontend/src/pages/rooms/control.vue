<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick, toRaw, markRaw } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import Chart from 'chart.js/auto'
import VueApexCharts from 'vue3-apexcharts'
import { DEFAULT_DEVICE_TYPES, getDeviceTypeIcon, getDeviceTypeLabel } from '@/config/deviceTypes'

// Import images
import roomBackgroundImageUrl from '@/assets/images/สื่อ (14).jpg'
import fanImageUrl from '@/assets/images/fan.png'
import buildingImageUrl from '@/assets/images/A1006.jpg'

const roomBackgroundImage = roomBackgroundImageUrl
const fanImage = fanImageUrl
const buildingImage = buildingImageUrl

// โหลดรูปจาก assets/images ตามชื่อไฟล์ที่เก็บใน DB (เช่น meetingroom.jpg)
const assetsImagesMap = import.meta.glob('/src/assets/images/**/*', { eager: true, as: 'url' })

function getImageFromAssets(filename) {
  if (!filename || typeof filename !== 'string') return null
  const clean = filename.trim()
  if (!clean) return null
  if (clean.includes('/') || clean.startsWith('http')) return null
  for (const [path, url] of Object.entries(assetsImagesMap)) {
    const normalized = path.replace(/\\/g, '/')
    if (normalized.endsWith(clean) || normalized.endsWith('/' + clean)) return url
  }
  return null
}

// รูปอาคาร: ถ้า DB เก็บชื่อไฟล์ (เช่น A1006.jpg) → หาจาก assets/images
// ถ้าเป็น full URL หรือ path จาก backend → ใช้ origin + path
function buildingImageSrc(b) {
  if (!b?.image) return buildingImage
  if (b.image.startsWith('http')) return b.image
  const fromAssets = getImageFromAssets(b.image)
  if (fromAssets) return fromAssets
  if (typeof window === 'undefined') return b.image
  const apiBase = import.meta.env.VITE_API_BASE_URL || ''
  const backendOrigin = apiBase.startsWith('http') ? apiBase.replace(/\/api\/?$/, '') : ''
  const origin = backendOrigin || window.location.origin
  return origin.replace(/\/$/, '') + (b.image.startsWith('/') ? b.image : '/' + b.image)
}

// รูป area (floor plan) หรือ room: ถ้า DB เก็บชื่อไฟล์ (เช่น meetingroom.jpg) → หาจาก assets/images
// ถ้าเป็น full URL หรือ path จาก backend → ใช้ imageSrcFromDb
function imageSrcFromDb(imageUrl, fallback) {
  if (!imageUrl || typeof imageUrl !== 'string') return fallback
  if (imageUrl.startsWith('http')) return imageUrl
  const fromAssets = getImageFromAssets(imageUrl)
  if (fromAssets) return fromAssets
  if (typeof window === 'undefined') return imageUrl
  const apiBase = import.meta.env.VITE_API_BASE_URL || ''
  const backendOrigin = apiBase.startsWith('http') ? apiBase.replace(/\/api\/?$/, '') : ''
  const origin = backendOrigin || window.location.origin
  return origin.replace(/\/$/, '') + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl)
}

definePage({
  meta: {
    requiresAuth: true,
  },
})

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const loading = ref(false)
const buildings = ref([])
const areas = ref([])
const rooms = ref([])
const selectedRoomId = ref(null)

// Check navigation state — ใช้ area (id จากตาราง areas) แทน floor
const selectedBuilding = computed(() => route.query.building)
const selectedAreaId = computed(() => route.query.area) // area = areas.id
const selectedRoomFromQuery = computed(() => route.query.room)
/** Area object จาก DB (เมื่อมี area id ใน query) */
const selectedArea = computed(() => {
  const id = _toNumOrNull(selectedAreaId.value)
  if (id == null) return null
  return areas.value.find(a => Number(a.id) === id) || null
})
/** เลขชั้น — ดึงจาก area ที่เลือก (สำหรับ logic ที่ยังอ้าง floor) */
const selectedFloor = computed(() => {
  if (selectedArea.value?.floor != null) return selectedArea.value.floor
  const f = _toNumOrNull(route.query.floor)
  return f
})
const showBuildingList = computed(() => !selectedAreaId.value)
const showFloorPlan = computed(() => selectedAreaId.value && !selectedRoomFromQuery.value)
const showRoomControl = computed(() => selectedAreaId.value && selectedRoomFromQuery.value)

// รูป floor plan: ใช้เฉพาะรูปจาก DB (areas.image)
const currentFloorArea = computed(() => {
  if (selectedArea.value) return selectedArea.value
  const buildingId = Number(selectedBuilding.value)
  const floorNum = Number(selectedFloor.value)
  if (!buildingId || floorNum == null) return null
  return areas.value.find(a => Number(a.building_id ?? a.buildingId) === buildingId && Number(a.floor) === floorNum) || null
})

/** ชื่อ area จาก DB (ใช้แสดงในหัวข้อ) — ถ้ามี area ที่เลือกใช้ชื่อนั้น ไม่ฉะนั้น fallback */
function getFloorDisplayName(buildingId, floorNum) {
  const bid = Number(buildingId)
  const f = Number(floorNum)
  if (!bid && bid !== 0) return `ชั้น ${floorNum ?? ''}`
  const list = areas.value.filter(a => Number(a.building_id ?? a.buildingId) === bid && Number(a.floor ?? a.Floor) === f)
  if (list.length === 0) return `ชั้น ${f}`
  return list.map(a => a.name || '').filter(Boolean).join(', ') || `ชั้น ${f}`
}
const selectedAreaDisplayName = computed(() =>
  selectedArea.value?.name ?? getFloorDisplayName(selectedBuilding.value, selectedFloor.value),
)
const floorPlanImageDisplay = computed(() => {
  const area = currentFloorArea.value
  if (area?.image) return imageSrcFromDb(area.image, '')
  return ''
})

// รูปห้อง (สำหรับหน้าควบคุมห้อง): ดึงจาก room.image ของห้องที่เลือก
const selectedRoom = computed(() => {
  if (!selectedRoomId.value) return null
  return rooms.value.find(r => Number(r.id) === Number(selectedRoomId.value)) || null
})
const roomBackgroundImageDisplay = computed(() => {
  const room = selectedRoom.value
  if (room?.image) return imageSrcFromDb(room.image, roomBackgroundImageUrl)
  return roomBackgroundImageUrl
})

// ---- Query helpers (prepare for real control API deep-links)
// URL รูปแบบ: /rooms/control?building=1&area=1&room=28 (area = areas.id)
const _norm = v => String(v ?? '').trim().toLowerCase()
const _toNumOrNull = v => {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) && !Number.isNaN(n) ? n : null
}

const resolveAreaFromQuery = () => {
  const areaId = _toNumOrNull(selectedAreaId.value)
  if (areaId != null) {
    const dbArea = areas.value.find(a => Number(a.id) === areaId)
    if (dbArea) return { source: 'db', area: dbArea }
  }
  return null
}

const resolveRoomIdFromQuery = () => {
  const roomQueryRaw = selectedRoomFromQuery.value
  if (roomQueryRaw === undefined || roomQueryRaw === null || String(roomQueryRaw).trim() === '') return null

  // ใช้เฉพาะห้องที่มี x1,y1,x2,y2 (roomsWithPositionInArea)
  const candidateRooms = roomsWithPositionInArea.value

  const qStr = String(roomQueryRaw).trim()
  const qNorm = _norm(qStr)
  const qNum = _toNumOrNull(qStr)

  // 1) Treat as room.id first (backward compatible)
  if (qNum !== null) {
    const byId = candidateRooms.find(r => Number(r.id) === qNum)
    if (byId) return byId.id
  }

  // 2) If numeric but not an id, try match "เลขห้อง" inside name (e.g. "ห้อง 28", "Room 28")
  if (qNum !== null) {
    const re = new RegExp(`(^|\\D)${qNum}(\\D|$)`)
    const byNumberInName = candidateRooms.find(r => re.test(String(r.name ?? '')))
    if (byNumberInName) return byNumberInName.id
  }

  // 3) Non-numeric: match by exact/partial name
  const byExactName = candidateRooms.find(r => _norm(r.name) === qNorm)
  if (byExactName) return byExactName.id
  const byPartialName = candidateRooms.find(r => _norm(r.name).includes(qNorm))
  if (byPartialName) return byPartialName.id

  return null
}

const resolveRoomIdFromAreaOnly = () => {
  // ใช้เฉพาะห้องที่มี x1,y1,x2,y2 (roomsWithPositionInArea)
  const areaRooms = roomsWithPositionInArea.value
  return areaRooms[0]?.id ?? null
}

const isSuperAdmin = computed(() => authStore.isSuperAdmin)

// Show all buildings (removed filter for "อาคาร A" only)
const filteredBuildings = computed(() => {
  return [...buildings.value].sort((a, b) => Number(a.id) - Number(b.id))
})

// รายการ area ของอาคารที่เลือก (สำหรับ dropdown)
const availableAreas = computed(() => {
  const buildingId = Number(selectedBuilding.value)
  if (!buildingId) return []
  return areas.value
    .filter(a => Number(a.building_id ?? a.buildingId) === buildingId)
    .sort((a, b) => (Number(a.floor ?? 0) - Number(b.floor ?? 0)) || String(a.name || '').localeCompare(String(b.name || '')))
    .map(a => ({ value: Number(a.id), title: a.name || `Area ${a.id}` }))
})

/** Areas ของอาคาร (สำหรับการ์ดรายการตึก — แสดงเป็นรายการ area แทน floor) */
function getAreasForBuilding(buildingId) {
  const bid = Number(buildingId)
  return areas.value
    .filter(a => Number(a.building_id ?? a.buildingId) === bid)
    .sort((a, b) => (Number(a.floor ?? 0) - Number(b.floor ?? 0)) || String(a.name || '').localeCompare(String(b.name || '')))
}
function getRoomCountInArea(areaId) {
  return rooms.value.filter(r => Number(r.area_id ?? r.areaId) === Number(areaId)).length
}

// ห้องที่มี area-box (มี x1,y1,x2,y2 และขนาด >= 5%) — ใช้สำหรับ floor plan
const roomsWithPositionInArea = computed(() => {
  const areaId = _toNumOrNull(selectedAreaId.value)
  if (areaId == null) return []
  return rooms.value.filter(r => {
    if (Number(r.area_id ?? r.areaId) !== areaId) return false
    const x1 = _toNumOrNull(r.x1)
    const y1 = _toNumOrNull(r.y1)
    const x2 = _toNumOrNull(r.x2)
    const y2 = _toNumOrNull(r.y2)
    if (x1 == null || y1 == null || x2 == null || y2 == null) return false
    const w = x2 - x1
    const h = y2 - y1
    return w >= 5 && h >= 5
  })
})

// ห้องทั้งหมดใน area (สำหรับ dropdown — แสดงทุกห้องที่มี area_id ตรง ไม่กรองตาม x1,y1,x2,y2)
const roomsInArea = computed(() => {
  let areaId = _toNumOrNull(selectedAreaId.value)
  if (areaId == null && selectedBuilding.value != null && selectedFloor.value != null) {
    const area = currentFloorArea.value
    if (area) areaId = Number(area.id)
  }
  if (areaId == null) return []
  return rooms.value.filter(r => Number(r.area_id ?? r.areaId) === areaId)
})

// Get available rooms — แสดงเฉพาะห้องที่มี x1,y1,x2,y2 ใน DB (ไม่แสดงห้องที่ไม่มีข้อมูล position เช่น DISCUSSION)
const availableRooms = computed(() => {
  try {
    return roomsWithPositionInArea.value.map(room => {
      const rawName = room.name ?? room.Name
      const rawArea = room.area_name ?? room.Area_name
      const name = (rawName && String(rawName).trim()) || (rawArea && String(rawArea).trim()) || null
      return { value: Number(room.id), title: name || `ห้อง ${room.id}` }
    })
  } catch (error) {
    console.error('Error computing available rooms:', error)
    return []
  }
})

// ชื่อห้องที่เลือก (ดึงจากรายการห้องในชั้นนั้น — ใช้ name หรือ area_name)
const selectedRoomTitle = computed(() => {
  if (!selectedRoomId.value) return ''
  const item = availableRooms.value.find(r => Number(r.value) === Number(selectedRoomId.value))
  return (item && item.title) ? item.title : `ห้อง ${selectedRoomId.value}`
})

// Floor Plan Edit States
const floorPlanEditMode = ref(false)
// area box แสดงเฉพาะเมื่อ room มี x1,y1,x2,y2 จาก DB — เริ่มต้นเป็น [] ไม่ใช้ demo data
const floorPlanAreas = ref([])
const floorPlanPeopleCount = ref(null)
const floorPlanPeopleCountEnabled = ref(false)
const peopleCountRefreshInterval = ref(null)
// อุปกรณ์ระดับ area (area_id, room_id NULL) สำหรับแสดง icon บน floor plan
const floorPlanAreaDevices = ref({ light: [], ac: [], erv: [], vent_fan: [] })
// สถานะต่ออุปกรณ์ (เหมือน deviceStates ของ room) — ใช้เมื่อแสดง icon บน floor plan area
const floorPlanAreaDeviceStates = ref({ light: [], ac: [], erv: [], vent_fan: [] })
// Settings สำหรับ area devices (speed, mode, temperature) — ใช้ getErvSpeed, getACIcon ฯลฯ
const floorPlanAreaDeviceSettings = ref({
  erv: { speed: [], mode: [] },
  ac: { mode: [], temperature: [] },
  light: { brightness: [] },
  vent_fan: {}
})

// Mapping between area names and specific room names (for areas not yet connected to database)
const areaRoomMapping = {
  'Mercury': 'ห้องประชุม Mercury',
  'Earth': 'ห้องประชุม Earth',
  'Jupiter': 'ห้องประชุม Jupiter',
  'Mars': 'ห้องประชุม Mars',
  'Venus': 'ห้องประชุม Venus',
}
const selectedAreaForEdit = ref(null)
const editingAreaName = ref(null)
const editingAreaNameValue = ref('')
const saveFloorPlanLoading = ref(false)
const resizingArea = ref(null)
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })
const draggingArea = ref(null)
const dragAreaStart = ref({ x: 0, y: 0 })

// System Control States
const showSystemControlDialog = ref(false)
const showConfirmSystemControlDialog = ref(false) // Second confirmation dialog
const systemControlAction = ref(null) // 'turnOn' or 'turnOff'
const systemControlLoading = ref(false)
const systemControlTargetRoomId = ref(null) // Store which room button was clicked
const floorDeviceStates = ref({
  light: [],
  ac: [],
  erv: [],
  vent_fan: []
}) // Store device states for all rooms in floor/area

// System Control Button Position and Size (for single button - deprecated)
const systemControlPosition = ref({ top: 20, right: 20 })
const systemControlSize = ref({ width: 80, height: 80 }) // Icon circle size
const draggingSystemControl = ref(false)
const dragSystemControlStart = ref({ x: 0, y: 0, top: 0, right: 0 })
const resizingSystemControl = ref(false)
const resizeSystemControlStart = ref({ x: 0, y: 0, width: 0, height: 0 })

// Per-room device states (for individual room control buttons)
const roomDeviceStates = ref({}) // { roomId: { light: [], ac: [], erv: [], vent_fan: [] } }
const loadingRoomStates = ref({}) // { roomId: true/false }
const roomStatesRefreshInterval = ref(null) // Interval for auto-refreshing room states

// Per-room system control button positions
const roomControlPositions = ref({}) // { roomId: { top: number, left: number } }
const draggingRoomControl = ref(null) // roomId that is being dragged
const dragRoomControlStart = ref({ x: 0, y: 0, top: 0, left: 0 })

// รายการประเภทอุปกรณ์ที่สั่งงานได้ (จาก API หรือ default) ใช้แสดง icon และ label
const controllableDeviceTypes = ref([...DEFAULT_DEVICE_TYPES])
const allSystemsOn = computed(() => {
  // If in room control view, use selected room's device states
  if (showRoomControl.value && selectedRoomId.value) {
    const hasLightOn = deviceStates.light && deviceStates.light.some(state => state === true)
    const hasAcOn = deviceStates.ac && deviceStates.ac.some(state => state === true)
    const hasErvOn = deviceStates.erv && deviceStates.erv.some(state => state === true)
    return hasLightOn || hasAcOn || hasErvOn
  }
  
  // Otherwise, check if any device is on in the current floor/area (for floor plan view)
  const lightStates = floorDeviceStates.value.light || []
  const acStates = floorDeviceStates.value.ac || []
  const ervStates = floorDeviceStates.value.erv || []
  const ventFanStates = floorDeviceStates.value.vent_fan || []
  
  const hasLightOn = lightStates.length > 0 && lightStates.some(state => state === true)
  const hasAcOn = acStates.length > 0 && acStates.some(state => state === true)
  const hasErvOn = ervStates.length > 0 && ervStates.some(state => state === true)
  const hasVentFanOn = ventFanStates.length > 0 && ventFanStates.some(state => state === true)
  
  const result = hasLightOn || hasAcOn || hasErvOn || hasVentFanOn
  
  // Debug logging
  if (result) {
    console.log('allSystemsOn computed - Device states:', {
      light: lightStates,
      ac: acStates,
      erv: ervStates,
      vent_fan: ventFanStates,
      hasLightOn,
      hasAcOn,
      hasErvOn,
      hasVentFanOn,
      result
    })
  }
  
  return result
})

// Get rooms for each area in floor plan
const areaRoomsMap = computed(() => {
  const map = {}
  if (!selectedBuilding.value || (!selectedFloor.value && !selectedAreaId.value)) return map
  
  const areaId = _toNumOrNull(selectedAreaId.value)
  const roomsInCurrentArea = roomsInArea.value
  
  floorPlanAreas.value.forEach(area => {
    let room = null

    // Virtual area (area-22) — อุปกรณ์ area_id แสดง icon คอนโทรล ใช้ห้องแรกใน area เป็น proxy สำหรับ control
    if (typeof area.id === 'string' && area.id.startsWith('area-')) {
      const aid = parseInt(area.id.replace('area-', ''), 10)
      if (roomsInCurrentArea.length > 0) {
        room = roomsInCurrentArea[0]
        map[area.id] = { ...room, name: area.name || room.name }
      }
      return
    }

    // Area ที่สร้างจาก room (area.id = room.id) — map โดยตรง
    if (area.id != null) {
      room = rooms.value.find(r => Number(r.id) === Number(area.id))
      if (room) {
        map[area.id] = room
        return
      }
    }

    // Check if area has room mapping
    if (areaRoomMapping[area.name]) {
      const roomName = areaRoomMapping[area.name]
      console.log(`Looking for room: ${roomName} for area: ${area.name}`)
      
      // Try exact match first
      room = rooms.value.find(r => r.name === roomName)
      
      // If not found, try partial match (case insensitive) for Mercury or any room name
      if (!room) {
        const searchTerm = roomName.toLowerCase()
        room = rooms.value.find(r => {
          if (!r.name) return false
          const roomNameLower = r.name.toLowerCase()
          return roomNameLower.includes(searchTerm) || searchTerm.includes(roomNameLower)
        })
      }
      
      // If still not found and looking for Mercury, try any variation
      if (!room && roomName.toLowerCase().includes('mercury')) {
        room = rooms.value.find(r => {
          if (!r.name) return false
          return r.name.toLowerCase().includes('mercury')
        })
      }
      
      if (room) {
        console.log(`Found room: ${room.name} (ID: ${room.id}) for area: ${area.name}`)
      } else {
        console.warn(`Room not found for area: ${area.name}, searched for: ${roomName}`)
        console.warn(`Available room names:`, rooms.value.map(r => r.name))
      }
    } else {
      let dbArea = null
      if (area.id != null) {
        dbArea = areas.value.find(a => Number(a.id) === Number(area.id))
      }
      if (!dbArea) {
        dbArea = areas.value.find(a => {
          const areaBuildingId = String(a.building_id)
          const areaFloor = String(a.floor)
          const buildingIdStr = String(selectedBuilding.value)
          const floorNumberStr = String(selectedFloor.value)
          return a.name === area.name && areaBuildingId === buildingIdStr && areaFloor === floorNumberStr
        })
      }
      
      if (dbArea) {
        const areaRooms = rooms.value.filter(r => r.area_id === dbArea.id)
        if (areaRooms.length > 0) {
          room = areaRooms[0]
        }
      }
    }
    
    if (room) {
      map[area.id] = room
      console.log(`Mapped area ${area.name} to room ${room.name} (ID: ${room.id})`)
    } else {
      console.warn(`No room found for area ${area.name}`)
    }
  })
  
  return map
})

// Check if room's systems are on
const isRoomSystemsOn = (roomId) => {
  const states = roomDeviceStates.value[roomId]
  if (!states) return false
  
  const hasLightOn = states.light && states.light.some(state => state === true || state === 1 || state === 'on')
  const hasAcOn = states.ac && states.ac.some(state => state === true || state === 1 || state === 'on')
  const hasErvOn = states.erv && states.erv.some(state => state === true || state === 1 || state === 'on')
  const hasVentFanOn = states.vent_fan && states.vent_fan.some(state => state === true || state === 1 || state === 'on')
  
  return hasLightOn || hasAcOn || hasErvOn || hasVentFanOn
}

// Room Control States
const showDeviceModal = ref(false)
const selectedDevice = reactive({ type: '', index: -1 })
const editMode = ref(false)
const dragging = ref(false)
const draggedDevice = ref({ type: '', index: -1 })
const dragOffset = ref({ x: 0, y: 0 })
const roomLayout = ref(null)

const deviceStates = reactive({
  light: [],
  ac: [],
  erv: [],
  vent_fan: [],
})

const ervSettings = reactive({
  speed: [],
  mode: [],
})

const acSettings = reactive({
  mode: [],
})

// Light brightness (Home Assistant light brightness typically 0-255)
const lightSettings = reactive({
  brightness: [],
})

const controls = reactive({
  light: false,
  ac: false,
  erv: false,
  vent_fan: false,
})

const acTemperature = ref(25)
const acTemperatures = reactive([])

// Timestamp to prevent overwriting recent changes
const lastUpdateTime = ref(Date.now())

const environmentalData = reactive({
  co2: 497,
  temp: 25.8,
  noise: 45.5,
  humidity: 57,
  motion: 'Active',
  pm25: 46,
  pm10: 55,
  pressure: 978.3,
  hcho: 0.02,
  tvoc: 1.45,
})

// ===== Energy Usage =====
const energyPeriod = ref('1d')
const energyCustomStart = ref('')
const energyCustomEnd = ref('')
const energyLoading = ref(false)
const energyData = reactive({
  records: [],
  summary: { totalEnergy: 0, avgPower: 0, maxPower: 0, recordCount: 0 },
})
const energyUsedFallback = ref(false)
const energyIsMock = ref(false) // true = ใช้ข้อมูลตัวอย่าง (ยังไม่มีใน DB)

/** สร้างข้อมูลพลังงานตัวอย่างสำหรับแสดงเมื่อยังไม่มีข้อมูลใน DB */
function getMockEnergyData(period) {
  const now = new Date()
  let count = 24
  let stepMs = 60 * 60 * 1000 // 1 ชม.
  if (period === '7d') {
    count = 28
    stepMs = 6 * 60 * 60 * 1000 // 6 ชม.
  } else if (period === '1m') {
    count = 30
    stepMs = 24 * 60 * 60 * 1000 // 1 วัน
  }
  const records = []
  let cumEnergy = 0
  const basePower = 80
  const peakPower = 350
  for (let i = 0; i < count; i++) {
    const t = new Date(now.getTime() - (count - i) * stepMs)
    const hour = t.getHours()
    const power = Math.round(basePower + (peakPower - basePower) * (0.3 + 0.5 * Math.sin((hour - 8) / 12 * Math.PI)) + (Math.random() - 0.5) * 40)
    const safePower = Math.max(20, Math.min(400, power))
    cumEnergy += (safePower / 1000) * (stepMs / 3600000)
    records.push({
      recorded_at: t.toISOString(),
      power: safePower,
      energy: Math.round(cumEnergy * 100) / 100,
      voltage: 220,
      current: safePower / 220,
    })
  }
  const powers = records.map(r => r.power)
  const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length
  const maxPower = Math.max(...powers)
  return {
    records,
    summary: {
      totalEnergy: Math.round(cumEnergy * 100) / 100,
      avgPower: Math.round(avgPower),
      maxPower: Math.round(maxPower),
      recordCount: records.length,
    },
  }
}

const energyChartOptions = computed(() => ({
  chart: { type: 'area', height: 300, toolbar: { show: true }, zoom: { enabled: true } },
  colors: ['#2196f3', '#ff9800'],
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
  xaxis: {
    type: 'datetime',
    labels: { datetimeUTC: false, format: energyPeriod.value === '1d' ? 'HH:mm' : 'dd/MM' },
  },
  yaxis: [
    { title: { text: 'Power (W)' }, labels: { formatter: v => v?.toFixed(0) } },
    { opposite: true, title: { text: 'Energy (kWh)' }, labels: { formatter: v => v?.toFixed(2) } },
  ],
  tooltip: { x: { format: 'dd MMM yyyy HH:mm' }, shared: true },
  legend: { position: 'top' },
}))
const energyChartSeries = computed(() => [
  { name: 'Power (W)', type: 'area', data: energyData.records.map(r => ({ x: new Date(r.recorded_at).getTime(), y: parseFloat(r.power || 0) })) },
  { name: 'Energy (kWh)', type: 'line', data: energyData.records.map(r => ({ x: new Date(r.recorded_at).getTime(), y: parseFloat(r.energy || 0) })) },
])

const loadEnergyData = async () => {
  if (!selectedRoomId.value) return
  energyLoading.value = true
  energyIsMock.value = false
  try {
    const params = {}
    if (energyPeriod.value === 'custom' && energyCustomStart.value && energyCustomEnd.value) {
      params.start = energyCustomStart.value
      params.end = energyCustomEnd.value
    } else {
      params.period = energyPeriod.value
    }
    const res = await api.get(`/energy/room/${selectedRoomId.value}`, { params })
    if (res.data?.success && (res.data.data.records || []).length > 0) {
      energyData.records = res.data.data.records || []
      Object.assign(energyData.summary, res.data.data.summary || {})
      energyUsedFallback.value = !!res.data.data.usedFallback
    } else {
      // ยังไม่มีข้อมูลใน DB — ใช้ข้อมูลตัวอย่าง (mock)
      const mock = getMockEnergyData(energyPeriod.value)
      energyData.records = mock.records
      Object.assign(energyData.summary, mock.summary)
      energyUsedFallback.value = false
      energyIsMock.value = true
    }
  } catch (e) {
    console.warn('[Energy] Failed to load energy data, using mock:', e?.message)
    const mock = getMockEnergyData(energyPeriod.value)
    energyData.records = mock.records
    Object.assign(energyData.summary, mock.summary)
    energyUsedFallback.value = false
    energyIsMock.value = true
  } finally {
    energyLoading.value = false
  }
}

// Loading state for sensor data
const loadingSensorData = ref(false)
const sensorDataRefreshInterval = ref(null)
const isUpdatingChart = ref(false) // Flag to prevent concurrent chart updates

const co2Chart = ref(null)
const co2ChartInstance = ref(null)
const isChartInitializing = ref(false)
const chartRetryCount = ref(0)
const co2MinMax = reactive({
  min: 455,
  max: 802,
  minTime: '12:34 PM',
  maxTime: '6:37 PM',
})

const devicePositions = reactive({
  light: [],
  ac: [],
  erv: [],
  vent_fan: [],
  /** จุดยึดแถว AM319 (device_type = am319 ในตาราง devices) — แสดง 9 sensor เรียงในแนวนอน */
  am319: [],
})

/** ลำดับการแสดงบนแปลนห้อง (ค่าจาก environmental_data ตาม room_id) */
const am319SensorOrder = [
  'temperature',
  'humidity',
  'co2',
  'tvoc',
  'pm25',
  'pm10',
  'pressure',
  'hcho',
  'noise',
]

// Sensor type definitions for AM319 & Noise
const sensorTypeDefinitions = {
  co2: { label: 'CO2', icon: 'tabler-cloud', color: '#4caf50', unit: 'ppm', key: 'co2' },
  temperature: { label: 'Temperature', icon: 'tabler-temperature', color: '#2196f3', unit: '°C', key: 'temp' },
  noise: { label: 'Noise', icon: 'tabler-volume', color: '#ff9800', unit: 'dB', key: 'noise' },
  humidity: { label: 'Humidity', icon: 'tabler-droplet', color: '#00bcd4', unit: '%', key: 'humidity' },
  motion: { label: 'Motion', icon: 'tabler-walk', color: '#f44336', unit: '', key: 'motion' },
  pm25: { label: 'PM2.5', icon: 'tabler-grain', color: '#9c27b0', unit: 'µg/m³', key: 'pm25' },
  pm10: { label: 'PM10', icon: 'tabler-grain', color: '#607d8b', unit: 'µg/m³', key: 'pm10' },
  tvoc: { label: 'TVOC', icon: 'tabler-molecule', color: '#795548', unit: 'mg/m³', key: 'tvoc' },
  pressure: { label: 'Pressure', icon: 'tabler-gauge', color: '#37474f', unit: 'hPa', key: 'pressure' },
  hcho: { label: 'HCHO', icon: 'tabler-flask', color: '#e91e63', unit: 'mg/m³', key: 'hcho' },
}

// Sensor overlays on room layout — each entry: { id, type, x, y }
const sensorOverlays = ref([])
const showSensorAddMenu = ref(false)
const sensorNextId = ref(1)

const addSensorOverlay = (type) => {
  sensorOverlays.value.push({
    id: sensorNextId.value++,
    type,
    x: 10 + Math.random() * 60,
    y: 10 + Math.random() * 60,
  })
  showSensorAddMenu.value = false
  saveSensorOverlays()
}

const removeSensorOverlay = (id) => {
  sensorOverlays.value = sensorOverlays.value.filter(s => s.id !== id)
  saveSensorOverlays()
}

const getSensorValue = (sensorType) => {
  const def = sensorTypeDefinitions[sensorType]
  if (!def) return ''
  const val = environmentalData[def.key]
  if (sensorType === 'motion') return val || 'N/A'
  if (val == null || val === '') return '--'
  if (typeof val === 'number' && Number.isFinite(val)) {
    if (sensorType === 'co2' || sensorType === 'pm25' || sensorType === 'pm10') return Math.round(val)
    if (sensorType === 'hcho' || sensorType === 'tvoc') return Number(val.toFixed(3))
    if (sensorType === 'temperature' || sensorType === 'humidity' || sensorType === 'noise' || sensorType === 'pressure')
      return Number(val.toFixed(1))
  }
  return val
}

const getSensorUnit = (sensorType) => sensorTypeDefinitions[sensorType]?.unit || ''

// Drag for sensor overlays
const draggingSensor = ref(false)
const draggedSensorId = ref(null)
const sensorDragOffset = ref({ x: 0, y: 0 })

const startSensorDrag = (event, sensorId) => {
  if (!editMode.value || !isSuperAdmin.value) return
  event.preventDefault()
  event.stopPropagation()

  draggingSensor.value = true
  draggedSensorId.value = sensorId

  const el = event.currentTarget
  const layoutRect = roomLayout.value?.getBoundingClientRect()
  if (!layoutRect) return

  const elRect = el.getBoundingClientRect()
  sensorDragOffset.value = {
    x: event.clientX - (elRect.left + elRect.width / 2),
    y: event.clientY - (elRect.top + elRect.height / 2),
  }

  document.addEventListener('mousemove', onSensorDrag)
  document.addEventListener('mouseup', stopSensorDrag)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'grabbing'
}

const onSensorDrag = (event) => {
  if (!draggingSensor.value || !roomLayout.value) return
  const layoutRect = roomLayout.value.getBoundingClientRect()
  const x = ((event.clientX - sensorDragOffset.value.x - layoutRect.left) / layoutRect.width) * 100
  const y = ((event.clientY - sensorDragOffset.value.y - layoutRect.top) / layoutRect.height) * 100
  const sensor = sensorOverlays.value.find(s => s.id === draggedSensorId.value)
  if (sensor) {
    sensor.x = Math.max(2, Math.min(90, x))
    sensor.y = Math.max(2, Math.min(90, y))
  }
}

const stopSensorDrag = () => {
  if (!draggingSensor.value) return
  draggingSensor.value = false
  draggedSensorId.value = null
  document.removeEventListener('mousemove', onSensorDrag)
  document.removeEventListener('mouseup', stopSensorDrag)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  saveSensorOverlays()
}

const saveSensorOverlays = () => {
  if (!selectedRoomId.value) return
  const key = `sensorOverlays_room_${selectedRoomId.value}`
  localStorage.setItem(key, JSON.stringify(sensorOverlays.value))
}

const loadSensorOverlays = () => {
  if (!selectedRoomId.value) return
  const key = `sensorOverlays_room_${selectedRoomId.value}`
  const saved = localStorage.getItem(key)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      sensorOverlays.value = parsed
      sensorNextId.value = parsed.reduce((max, s) => Math.max(max, s.id + 1), 1)
    } catch { sensorOverlays.value = [] }
  } else {
    sensorOverlays.value = []
  }
}

// Fetch Buildings for selection page
// อาคารจาก buildings, รายการชั้น (floors) จาก areas, จำนวนห้อง (count) จาก rooms
const fetchBuildings = async () => {
  loading.value = true
  try {
    const [buildingsResponse, areasResponse, roomsResponse] = await Promise.all([
      api.get('/buildings', { params: { withFloors: '1' } }),
      api.get('/areas'),
      api.get('/rooms'),
    ])
    
    const rawBuildings = buildingsResponse.data.data || []
    areas.value = areasResponse.data.data || []
    const allRooms = roomsResponse.data.data || roomsResponse.data || []
    
    console.log('[Rooms Control] Fetched data:', {
      buildingsCount: rawBuildings.length,
      areasCount: areas.value.length,
      roomsCount: allRooms.length,
      buildings: rawBuildings.map(b => ({ id: b.id, name: b.name, floorsFromApi: !!b.floors }))
    })
    
    rooms.value = allRooms

    // ถ้า API ส่ง building.floors มาแล้ว (จาก areas + rooms) ใช้เลย ไม่ต้องคำนวณฝั่ง client
    if (rawBuildings.length && rawBuildings.some(b => b.floors && Array.isArray(b.floors))) {
      buildings.value = rawBuildings
    } else {
      // Fallback: คำนวณ floors จากตาราง areas คอลัมน์ floor เท่านั้น และจำนวนห้องจาก rooms
      buildings.value = rawBuildings.map(building => {
        const bid = Number(building.id)
        const buildingAreas = areas.value.filter(area => Number(area.building_id ?? area.buildingId) === bid)
        const floors = {}
        buildingAreas.forEach(area => {
          const aid = Number(area.id)
          const areaRooms = allRooms.filter(room => Number(room.area_id ?? room.areaId) === aid)
          const floorNum = area.floor != null ? Number(area.floor) : 0
          if (!floors[floorNum]) {
            floors[floorNum] = { floor: floorNum, count: 0 }
          }
          floors[floorNum].count += areaRooms.length
        })
        return {
          ...building,
          floors: Object.values(floors).sort((a, b) => a.floor - b.floor),
        }
      })
    }
  } catch (error) {
    console.error('Error fetching buildings:', error)
    // Show error message to user
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data)
    }
    // Set empty arrays to show "no buildings" message
    buildings.value = []
    areas.value = []
    rooms.value = []
  } finally {
    loading.value = false
  }
}

const loadFloorPlanPeopleCount = async () => {
  try {
    const params = {}
    const areaId = _toNumOrNull(selectedAreaId.value)
    if (areaId != null) params.area_id = areaId
    const roomId = _toNumOrNull(selectedRoomFromQuery.value)
    if (roomId != null) params.room_id = roomId

    const res = await api.get('/floor-plan/people-counts', { params })
    const count = res?.data?.data?._all?.count
    const enabled = res?.data?.data?._all?.enabled
    floorPlanPeopleCountEnabled.value = enabled === true
    floorPlanPeopleCount.value = typeof count === 'number' ? count : null
  } catch (error) {
    console.warn('[Rooms Control] loadFloorPlanPeopleCount failed:', error?.message)
    floorPlanPeopleCountEnabled.value = false
    floorPlanPeopleCount.value = null
  }
}

const peopleCountBadgePosition = computed(() => {
  const area = selectedArea.value
  if (!area) return null

  const x1 = _toNumOrNull(area.x1)
  const y1 = _toNumOrNull(area.y1)
  const x2 = _toNumOrNull(area.x2)
  const y2 = _toNumOrNull(area.y2)

  if (x1 == null || y1 == null || x2 == null || y2 == null) return null

  return {
    left: (x1 + x2) / 2,
    top: Math.max(4, y1 - 3),
  }
})

const startPeopleCountAutoRefresh = () => {
  stopPeopleCountAutoRefresh()
  loadFloorPlanPeopleCount()
  peopleCountRefreshInterval.value = setInterval(loadFloorPlanPeopleCount, 30000)
}

const stopPeopleCountAutoRefresh = () => {
  if (peopleCountRefreshInterval.value) {
    clearInterval(peopleCountRefreshInterval.value)
    peopleCountRefreshInterval.value = null
  }
}

// Fetch Rooms for control page (DEPRECATED - use fetchBuildings instead)
const fetchRooms = async () => {
  loading.value = true
  try {
    const response = await api.get('/rooms')
    const allRooms = response.data.data || response.data || []
    rooms.value = allRooms
    
    // Don't auto-select room - respect query parameter instead
    // Auto-select Mercury room only if no room is selected and no query parameter
    if (!selectedRoomId.value && !selectedRoomFromQuery.value) {
      const mercuryRoom = allRooms.find(r => r.name && r.name.toLowerCase().includes('mercury'))
      if (mercuryRoom) {
        selectedRoomId.value = mercuryRoom.id
        loadRoomDevices()
      }
    }
  } catch (error) {
    console.error('Error fetching rooms:', error)
  } finally {
    loading.value = false
  }
}

const loadRoomDevices = async () => {
  if (!selectedRoomId.value) return

  // Sync device states from Home Assistant first (if applicable)
  // This ensures DB has the latest state from Home Assistant
  try {
    await syncDeviceStatesFromHomeAssistant()
  } catch (syncError) {
    console.warn('Failed to sync from Home Assistant, will use DB state:', syncError)
  }

  // Initialize device positions - เริ่มต้นเป็น empty (จะโหลดจาก DB)
  devicePositions.light = []
  devicePositions.ac = []
  devicePositions.erv = []
  devicePositions.vent_fan = []
  devicePositions.am319 = []

  // Initialize with empty arrays (will be populated from API data)
  const tempDeviceStates = {
    light: [],
    ac: [],
    erv: [],
    vent_fan: [],
  }
  
  const tempAcSettings = {
    mode: [], // จะโหลดจาก API
  }
  
  const tempAcTemperatures = []
  
  const tempErvSettings = {
    speed: [],
    mode: [],
  }

  let devicesFromApi = null
  try {
    // Load device states from API (now includes synced data from HA)
    const response = await api.get(`/rooms/${selectedRoomId.value}/devices`)
    console.log('=== API Response ===')
    console.log('Full response:', response.data)
    if (response.data && response.data.data) {
      const devices = response.data.data
      devicesFromApi = devices
      // deviceIdsByType for new device_id-based control route
      if (devices.deviceIdsByType) {
        // light is not HA mapping, but we keep ids for control-by-id
        // store as arrays by index (order by devices.id)
        // Use refs already present (acDeviceIds/ervDeviceIds) for minimal changes
        if (Array.isArray(devices.deviceIdsByType.ac)) {
          acDeviceIds.value = {}
          devices.deviceIdsByType.ac.forEach((id, i) => { acDeviceIds.value[i] = id })
        }
        if (Array.isArray(devices.deviceIdsByType.erv)) {
          ervDeviceIds.value = {}
          devices.deviceIdsByType.erv.forEach((id, i) => { ervDeviceIds.value[i] = id })
        }
        if (Array.isArray(devices.deviceIdsByType.light)) {
          lightDeviceIds.value = {}
          devices.deviceIdsByType.light.forEach((id, i) => { lightDeviceIds.value[i] = id })
        }
        if (Array.isArray(devices.deviceIdsByType.vent_fan)) {
          ventFanDeviceIds.value = {}
          devices.deviceIdsByType.vent_fan.forEach((id, i) => { ventFanDeviceIds.value[i] = id })
        }
      }
      console.log('Device states from API:', devices.deviceStates)
      if (devices.deviceStates) {
        // Load light states (ใช้จำนวนจริงจาก DB)
        if (devices.deviceStates.light && devices.deviceStates.light.length > 0) {
          const lightEntries = devices.deviceStates.light || []
          const brightnesses = lightEntries.map(entry => {
            const b = entry?.settings?.brightness ?? entry?.brightness
            // Default to 128 when missing
            return b != null && !Number.isNaN(Number(b)) ? Number(b) : 128
          })
          lightSettings.brightness.splice(0, lightSettings.brightness.length, ...brightnesses)

          tempDeviceStates.light = lightEntries.map(state =>
            (state && (state.status === true || state.status === 1 || state.status === 'on')) || state === true
          )
        } else {
          lightSettings.brightness.splice(0, lightSettings.brightness.length)
        }
        
        // Load AC states (ใช้จำนวนจริงจาก DB)
        if (devices.deviceStates.ac && devices.deviceStates.ac.length > 0) {
          const acCount = devices.deviceStates.ac.length
          const acStates = devices.deviceStates.ac.map(ac => {
            if (ac && ac !== null) {
              return ac.status === true || ac.status === 1 || ac.status === 'on'
            }
            return false
          })
          tempDeviceStates.ac = acStates
          console.log('Loaded AC states:', tempDeviceStates.ac)
          
          // Load device IDs for AC units (for Home Assistant integration)
          devices.deviceStates.ac.forEach((ac, i) => {
            if (ac && (ac.device_id || ac.deviceId)) {
              acDeviceIds.value[i] = ac.device_id || ac.deviceId
            }
          })
          
          // Load mode from settings object
          const modes = devices.deviceStates.ac.map(ac => {
            if (ac && ac !== null) {
              if (ac.mode) return ac.mode
              if (ac.settings && ac.settings.mode) return ac.settings.mode
            }
            return 'off'
          })
          console.log('Loaded AC modes from API:', modes)
          tempAcSettings.mode = modes
          
          // Load temperature from settings object
          const temps = devices.deviceStates.ac.map(ac => {
            if (ac && ac !== null) {
              if (ac.temperature !== undefined) return ac.temperature
              if (ac.settings && ac.settings.temperature !== undefined) return ac.settings.temperature
            }
            return 25
          })
          console.log('Loaded AC temperatures from API:', temps)
          tempAcTemperatures.push(...temps)
        }
        
        // Load ERV states (ใช้จำนวนจริงจาก DB)
        if (devices.deviceStates.erv && devices.deviceStates.erv.length > 0) {
          console.log('=== ERV Data from API ===')
          console.log('Raw ERV data:', JSON.stringify(devices.deviceStates.erv, null, 2))
          
          const ervStates = devices.deviceStates.erv.map(state => {
            const s = state?.status ?? state
            return s === true || s === 1 || s === 'on'
          })
          tempDeviceStates.erv = ervStates
          
          // Load device IDs for ERV units (for Home Assistant integration)
          devices.deviceStates.erv.forEach((erv, idx) => {
            if (erv && (erv.device_id || erv.deviceId)) {
              ervDeviceIds.value[idx] = erv.device_id || erv.deviceId
            }
          })
          
          // Load speed data from settings object
          const speeds = devices.deviceStates.erv.map(erv => {
            if (erv?.settings && erv.settings.speed) return erv.settings.speed
            return 'low'
          })
          console.log('✅ Loaded ERV speeds from API:', speeds)
          tempErvSettings.speed = speeds
          
          // Load mode data from settings object
          const modes = devices.deviceStates.erv.map(erv => {
            if (erv?.settings && erv.settings.mode) return erv.settings.mode
            return 'normal'
          })
          console.log('✅ Loaded ERV modes from API:', modes)
          tempErvSettings.mode = modes
        } else {
          console.log('⚠️ No ERV data in API response')
        }

        if (devices.deviceStates.vent_fan && devices.deviceStates.vent_fan.length > 0) {
          tempDeviceStates.vent_fan = devices.deviceStates.vent_fan.map(state => {
            const s = state?.status ?? state
            return s === true || s === 1 || s === 'on'
          })
          devices.deviceStates.vent_fan.forEach((fan, idx) => {
            if (fan && (fan.device_id || fan.deviceId)) {
              ventFanDeviceIds.value[idx] = fan.device_id || fan.deviceId
            }
          })
        }
      }
    }
  } catch (error) {
    console.error('Error loading device states:', error)
  }

  // Apply loaded data to reactive state (use splice to maintain reactivity)
  deviceStates.light.splice(0, deviceStates.light.length, ...tempDeviceStates.light)
  deviceStates.ac.splice(0, deviceStates.ac.length, ...tempDeviceStates.ac)
  deviceStates.erv.splice(0, deviceStates.erv.length, ...tempDeviceStates.erv)
  deviceStates.vent_fan.splice(0, deviceStates.vent_fan.length, ...tempDeviceStates.vent_fan)
  
  acSettings.mode.splice(0, acSettings.mode.length, ...tempAcSettings.mode)
  acTemperatures.splice(0, acTemperatures.length, ...tempAcTemperatures)
  
  ervSettings.speed.splice(0, ervSettings.speed.length, ...tempErvSettings.speed)
  ervSettings.mode.splice(0, ervSettings.mode.length, ...tempErvSettings.mode)
  
  console.log('Final ERV settings after load:', {
    speed: ervSettings.speed,
    mode: ervSettings.mode
  })

  // Update control switches based on device states (รองรับ boolean และ { status })
  const rowToBool = (s) => {
    if (s == null) return false
    if (typeof s === 'object') return !!s.status
    return s === true || s === 1 || s === 'on'
  }
  controls.light = deviceStates.light.some(rowToBool)
  controls.ac = deviceStates.ac.some(rowToBool)
  controls.erv = deviceStates.erv.some(rowToBool)
  controls.vent_fan = deviceStates.vent_fan.some(rowToBool)

  // Initialize CO2 chart
  initCO2Chart()
  
  // Load device positions — ใช้ positions จาก getDevices ถ้ามี ไม่ฉะนั้นโหลดจาก device-positions API
  if (devicesFromApi?.positions) {
    applyDevicePositions(devicesFromApi.positions)
  } else {
    await loadDevicePositions()
  }
  
  // Sensor overlay แบบ manual (localStorage) — ใช้เฉพาะเมื่อห้องไม่มีแถว AM319 จาก DB
  if (devicesFromApi?.positions?.am319?.length) {
    sensorOverlays.value = []
  } else {
    loadSensorOverlays()
  }
  
  // ดึงค่าเซ็นเซอร์: ถ้ามี am319 ในห้อง → environmental_data ตาม room_id, ไม่เช่นนั้น → HA endpoint เดิม
  startSensorDataAutoRefresh()
}

const toggleControl = async (type) => {
  if (!selectedRoomId.value) return

  const newState = controls[type]
  const roomId = Number(selectedRoomId.value)
  const isHARoom = roomId === 28 // ห้อง Mercury ที่ใช้ Home Assistant
  const action = newState ? 'on' : 'off'
  
  try {
    // อัปเดต DB ก่อน
    const payload = {
      status: newState,
    }
    
    await api.post(`/rooms/${selectedRoomId.value}/devices/${type}`, payload)
    
    // ถ้าเป็นห้อง HA ให้เรียก Home Assistant API จริงด้วย
    if (isHARoom) {
      console.log(`[Toggle Control] Room ${roomId} is HA room - calling Home Assistant API for ${type}: ${action}`)
      
      if (type === 'light') {
        await api.post(`/devices/light/${HA_LIGHT_ENTITY_ID}/control`, { action })
        console.log(`[Toggle Control] HA Light API called: ${action}`)
        
      } else if (type === 'ac') {
        const haPayload = { action }
        if (newState) {
          haPayload.temperature = 25
          haPayload.hvac_mode = 'cool'
        }
        await api.post(`/devices/air/${HA_AIR_DEVICE_ID}/control`, haPayload)
        console.log(`[Toggle Control] HA AC API called: ${action}`)
      } else if (type === 'erv') {
        await api.post(`/devices/erv/${HA_ERV_DEVICE_ID}/control`, { action })
        console.log(`[Toggle Control] HA ERV API called: ${action}`)
      }
    }
    
    // Update all device states
    if (type === 'light') {
      deviceStates.light = deviceStates.light.map(() => newState)
    } else if (type === 'ac') {
      deviceStates.ac = deviceStates.ac.map(() => newState)
    } else if (type === 'erv') {
      deviceStates.erv = deviceStates.erv.map(() => newState)
    } else if (type === 'vent_fan') {
      deviceStates.vent_fan = deviceStates.vent_fan.map(() => newState)
    }
  } catch (error) {
    console.error(`Error toggling ${type}:`, error)
    controls[type] = !newState // Revert on error
  }
}

// Home Assistant Air Control Device ID
const HA_AIR_DEVICE_ID = 'CC3F1D03BAE3'

// Home Assistant ERV Control Device ID
const HA_ERV_DEVICE_ID = 'ERV_U1'

// Home Assistant Light Entity ID
const HA_LIGHT_ENTITY_ID = 'light.lights_17'
const HA_LIGHT_DEVICE_ID = 'LIGHTS_17'

// Store device IDs for AC units (mapped by index)
const lightDeviceIds = ref({}) // { index: devices.id }
const acDeviceIds = ref({}) // { index: deviceId }

// Store device IDs for ERV units (mapped by index)
const ervDeviceIds = ref({}) // { index: deviceId }
const ventFanDeviceIds = ref({}) // { index: deviceId }

// Sync device states from Home Assistant to DB
const syncDeviceStatesFromHomeAssistant = async () => {
  try {
    // Check if this is room 28 (Mercury room) which has Home Assistant devices
    // Use == instead of === to handle both string "28" and number 28 from URL query
    const roomId = Number(selectedRoomId.value)
    console.log('[Sync] Checking room for HA sync:', selectedRoomId.value, '(type:', typeof selectedRoomId.value, ', asNumber:', roomId, ')')
    
    if (roomId === 28) {
      // Sync AC (index 1 = air_02)
      try {
        console.log('[Sync] Syncing AC state from Home Assistant...')
        const acResponse = await api.post(`/devices/sync/air/${HA_AIR_DEVICE_ID}`)
        console.log('[Sync] AC state synced from Home Assistant:', acResponse.data)
      } catch (acError) {
        console.error('[Sync] Failed to sync AC:', acError)
        console.error('[Sync] AC error details:', acError.response?.data || acError.message)
      }

      // Sync ERV (index 0 = ERV_U1)
      try {
        console.log('[Sync] Syncing ERV state from Home Assistant...')
        const ervResponse = await api.post(`/devices/sync/erv/${HA_ERV_DEVICE_ID}`)
        console.log('[Sync] ERV state synced from Home Assistant:', ervResponse.data)
      } catch (ervError) {
        console.error('[Sync] Failed to sync ERV:', ervError)
        console.error('[Sync] ERV error details:', ervError.response?.data || ervError.message)
      }

      // Sync Light (index 0 = light.lights_17)
      try {
        console.log('[Sync] Syncing Light state from Home Assistant...')
        const lightResponse = await api.post(`/devices/sync/light/${HA_LIGHT_DEVICE_ID}`)
        console.log('[Sync] Light state synced from Home Assistant:', lightResponse.data)
      } catch (lightError) {
        console.error('[Sync] Failed to sync Light:', lightError)
        console.error('[Sync] Light error details:', lightError.response?.data || lightError.message)
      }
    } else {
      console.log('[Sync] Skipping HA sync - room is not 28 (current:', roomId, ')')
    }
  } catch (error) {
    console.error('[Sync] Failed to sync device states from Home Assistant:', error)
    // Don't throw error, just log warning - we'll still load from DB
  }
}

// Map frontend mode values to API mode values
// Home Assistant รองรับ: "off", "dry", "fan_only", "cool"
const mapModeToAPI = (mode) => {
  const modeMap = {
    'off': 'off',
    'cool': 'cool',
    'dry': 'dry',
    'fan_only': 'fan_only',
    // Backward compatibility
    'heat': 'cool',  // ไม่รองรับ heat mode แล้ว แปลงเป็น cool
    'heat/cool': 'cool',  // ไม่รองรับ auto mode แล้ว แปลงเป็น cool
    'auto': 'cool',
    'fan only': 'fan_only'
  }
  return modeMap[mode] || mode
}

// Control air conditioner via Home Assistant API
const controlAirViaHomeAssistant = async (action, temperature = null, hvacMode = 'off') => {
  try {
    const payload = {
      action: action, // 'on' or 'off'
    }
    
    if (action === 'on' && temperature !== null) {
      payload.temperature = temperature
      // Map mode to API format
      payload.hvac_mode = mapModeToAPI(hvacMode)
    }
    
    const response = await api.post(`/devices/air/${HA_AIR_DEVICE_ID}/control`, payload)
    return response.data
  } catch (error) {
    console.error('Error controlling air via Home Assistant:', error)
    throw error
  }
}

// Set air temperature via Home Assistant API
const setAirTemperatureViaHomeAssistant = async (temperature) => {
  try {
    const response = await api.post(`/devices/air/${HA_AIR_DEVICE_ID}/temperature`, {
      temperature: temperature
    })
    return response.data
  } catch (error) {
    console.error('Error setting air temperature via Home Assistant:', error)
    throw error
  }
}

// Set air mode via Home Assistant API
const setAirModeViaHomeAssistant = async (hvacMode) => {
  try {
    const response = await api.post(`/devices/air/${HA_AIR_DEVICE_ID}/mode`, {
      hvac_mode: hvacMode
    })
    return response.data
  } catch (error) {
    console.error('Error setting air mode via Home Assistant:', error)
    throw error
  }
}

// Control ERV via Home Assistant API
const controlErvViaHomeAssistant = async (action) => {
  try {
    const response = await api.post(`/devices/erv/${HA_ERV_DEVICE_ID}/control`, {
      action: action // 'on' or 'off'
    })
    return response.data
  } catch (error) {
    console.error('Error controlling ERV via Home Assistant:', error)
    throw error
  }
}

// Set ERV mode via Home Assistant API
const setErvModeViaHomeAssistant = async (mode) => {
  try {
    const response = await api.post(`/devices/erv/${HA_ERV_DEVICE_ID}/mode`, {
      mode: mode // 'heat' or 'normal'
    })
    return response.data
  } catch (error) {
    console.error('Error setting ERV mode via Home Assistant:', error)
    throw error
  }
}

// Set ERV level via Home Assistant API
const setErvLevelViaHomeAssistant = async (level) => {
  try {
    const response = await api.post(`/devices/erv/${HA_ERV_DEVICE_ID}/level`, {
      level: level // 'low' or 'high'
    })
    return response.data
  } catch (error) {
    console.error('Error setting ERV level via Home Assistant:', error)
    throw error
  }
}

// Control light via Home Assistant API
const controlLightViaHomeAssistant = async (action) => {
  try {
    const response = await api.post(`/devices/light/${HA_LIGHT_ENTITY_ID}/control`, {
      action: action // 'on' or 'off'
    })
    return response.data
  } catch (error) {
    console.error('Error controlling light via Home Assistant:', error)
    throw error
  }
}

// Check if device should use Home Assistant API
// Check by device ID or by index
/** ห้อง Mercury (HA) — ใช้ room id + ลำดับอุปกรณ์หลัง ORDER BY devices.id */
const MERCURY_ROOM_HA_ROOM_ID = 28

const shouldUseHomeAssistant = (type, index) => {
  if (isFloorPlanAreaDeviceModal.value) return false
  if (selectedRoomId.value !== MERCURY_ROOM_HA_ROOM_ID) return false
  if (type === 'ac') return index === 0
  if (type === 'erv') return index === 0
  // For light, rely on backend control so we can pass/remember brightness via settings
  if (type === 'light') return false
  return false
}

const toggleDevice = async (type, index) => {
  // ถ้าเป็น area device ใช้ area API
  const isAreaDevice = isFloorPlanAreaDeviceModal.value
  const areaId = selectedAreaId.value

  if (!isAreaDevice && !selectedRoomId.value) return
  if (isAreaDevice && !areaId) return

  const isOn = deviceStates[type][index]
  deviceStates[type][index] = !isOn
  lastUpdateTime.value = Date.now()

  try {
    // Check if this device should use Home Assistant API (only for room devices)
    if (!isAreaDevice && shouldUseHomeAssistant(type, index)) {
      if (type === 'ac') {
        const action = !isOn ? 'on' : 'off'
        const temperature = acTemperatures[index] || 25
        // When turning AC ON from icon control, default to "cool"
        // (if mode is missing/undefined/off, otherwise respect user's selected mode)
        if (action === 'on') {
          const curMode = acSettings.mode[index]
          if (curMode == null || curMode === '' || curMode === 'off') {
            acSettings.mode[index] = 'cool'
          }
        }
        const hvacMode = acSettings.mode[index] ?? 'cool'
        const apiMode = mapModeToAPI(hvacMode)
        await controlAirViaHomeAssistant(action, temperature, apiMode)
      } else if (type === 'erv') {
        const action = !isOn ? 'on' : 'off'
        await controlErvViaHomeAssistant(action)
      } else if (type === 'light') {
        const action = !isOn ? 'on' : 'off'
        await controlLightViaHomeAssistant(action)
      }
    } else {
      const payload = {
        status: !isOn,
      }
      
      if (type === 'ac' && acSettings.mode[index]) {
        payload.mode = acSettings.mode[index]
        payload.temperature = acTemperatures[index] || 25
      }
      
      if (type === 'light' && !isOn) {
        const brightness = getLightBrightness(index)
        if (brightness != null && !Number.isNaN(Number(brightness))) {
          payload.settings = { brightness: Number(brightness) }
        }
      }
      
      if (type === 'erv' && ervSettings.speed[index]) {
        payload.speed = ervSettings.speed[index]
        payload.mode = ervSettings.mode[index] || 'normal'
      }

      const deviceId = type === 'ac'
        ? acDeviceIds.value[index]
        : type === 'erv'
          ? ervDeviceIds.value[index]
          : type === 'vent_fan'
            ? ventFanDeviceIds.value[index]
            : lightDeviceIds.value[index]
      if (deviceId == null) {
        throw new Error(`ไม่มี device_id สำหรับ ${type}[${index}]`)
      }
      if (isAreaDevice) {
        await api.post(`/areas/${areaId}/devices/by-id/${deviceId}`, payload)
      } else {
        await api.post(`/rooms/${selectedRoomId.value}/devices/by-id/${deviceId}`, payload)
      }
    }
    
    // Update control switch (รองรับทั้ง boolean และ object {status})
    const toBool = (s) => {
      if (s == null) return false
      if (typeof s === 'object') return !!s.status
      return s === true || s === 1 || s === 'on'
    }
    if (type === 'light') {
      controls.light = (deviceStates.light || []).some(toBool)
    } else if (type === 'ac') {
      controls.ac = (deviceStates.ac || []).some(toBool)
    } else if (type === 'erv') {
      controls.erv = (deviceStates.erv || []).some(toBool)
    } else if (type === 'vent_fan') {
      controls.vent_fan = (deviceStates.vent_fan || []).some(toBool)
    }
  } catch (error) {
    console.error(`Error toggling device:`, error)
    deviceStates[type][index] = isOn // Revert on error
  }
}

const DEFAULT_LIGHT_BRIGHTNESS = 128

const getLightBrightness = (index) => {
  if (isFloorPlanAreaDeviceModal.value) {
    return (
      floorPlanAreaDeviceSettings.value?.light?.brightness?.[index] ??
      floorPlanAreaDeviceSettings.value?.light?.brightness?.[0] ??
      DEFAULT_LIGHT_BRIGHTNESS
    )
  }
  return lightSettings.brightness[index] ?? lightSettings.brightness[0] ?? DEFAULT_LIGHT_BRIGHTNESS
}

const updateLightBrightness = async (index, brightness) => {
  const isAreaDevice = isFloorPlanAreaDeviceModal.value
  const areaId = selectedAreaId.value

  if (!isAreaDevice && !selectedRoomId.value) return
  if (isAreaDevice && !areaId) return

  const deviceId = lightDeviceIds.value?.[index]
  if (deviceId == null) {
    throw new Error(`ไม่มี device_id สำหรับ light[${index}]`)
  }

  const b = Number(brightness)
  if (Number.isNaN(b)) return
  const nextBrightness = Math.max(1, Math.min(255, b))

  const prevOn = deviceStates.light[index]
  const prevBrightness = getLightBrightness(index)

  // Update local UI state immediately
  if (isAreaDevice) {
    if (!floorPlanAreaDeviceSettings.value.light) {
      floorPlanAreaDeviceSettings.value.light = { brightness: [] }
    }
    floorPlanAreaDeviceSettings.value.light.brightness[index] = nextBrightness
  } else {
    lightSettings.brightness[index] = nextBrightness
  }

  deviceStates.light[index] = true
  controls.light = true
  lastUpdateTime.value = Date.now()

  try {
    const payload = {
      status: true,
      settings: { brightness: nextBrightness },
    }
    const endpoint = isAreaDevice
      ? `/areas/${areaId}/devices/by-id/${deviceId}`
      : `/rooms/${selectedRoomId.value}/devices/by-id/${deviceId}`
    await api.post(endpoint, payload)
  } catch (error) {
    console.error('Error updating light brightness:', error)
    // Revert on error
    deviceStates.light[index] = prevOn
    controls.light = (deviceStates.light || []).some(s => s === true || s === 1 || s === 'on')
    if (isAreaDevice) {
      floorPlanAreaDeviceSettings.value.light.brightness[index] = prevBrightness
    } else {
      lightSettings.brightness[index] = prevBrightness
    }
  }
}

const getDeviceState = (type, index) => {
  const s = deviceStates[type]?.[index]
  if (s == null) return false
  if (typeof s === 'object') return !!s.status
  return s === true || s === 1 || s === 'on'
}

/** สถานะอุปกรณ์สำหรับ icon บน floor plan area — ใช้ floorPlanAreaDeviceStates หรือ deviceStates (เมื่อ modal เปิด) */
const getFloorPlanAreaDeviceState = (type, idx) => {
  if (isFloorPlanAreaDeviceModal.value && deviceStates[type]?.[idx] !== undefined) {
    const s = deviceStates[type][idx]
    return s === true || s === 1 || s === 'on' || !!(s && typeof s === 'object' && s.status)
  }
  const arr = floorPlanAreaDeviceStates.value[type]
  return !!(arr && arr[idx])
}

/** ERV speed สำหรับ floor plan area icon */
const getFloorPlanAreaErvSpeed = (idx) => {
  if (isFloorPlanAreaDeviceModal.value && ervSettings.speed?.[idx]) return ervSettings.speed[idx]
  return floorPlanAreaDeviceSettings.value.erv?.speed?.[idx] || 'low'
}

/** ERV mode สำหรับ floor plan area icon */
const getFloorPlanAreaErvMode = (idx) => {
  if (isFloorPlanAreaDeviceModal.value && ervSettings.mode?.[idx]) return ervSettings.mode[idx]
  return floorPlanAreaDeviceSettings.value.erv?.mode?.[idx] || 'normal'
}

/** AC mode สำหรับ floor plan area icon (getACIcon ใช้) */
const getFloorPlanAreaACMode = (idx) => {
  if (isFloorPlanAreaDeviceModal.value && acSettings.mode?.[idx]) return acSettings.mode[idx]
  return floorPlanAreaDeviceSettings.value.ac?.mode?.[idx] || 'off'
}

const getFloorPlanAreaACIcon = (idx) => {
  const mode = getFloorPlanAreaACMode(idx)
  const icons = { 'off': 'tabler-power', 'cool': 'tabler-snowflake', 'dry': 'tabler-droplet', 'fan_only': 'tabler-wind', 'heat': 'tabler-flame', 'heat/cool': 'tabler-temperature', 'fan only': 'tabler-wind' }
  return icons[mode] || 'tabler-snowflake'
}

const getFloorPlanAreaACModeLabel = (idx) => {
  const mode = getFloorPlanAreaACMode(idx)
  const labels = { 'off': 'ปิด', 'cool': 'Cool', 'dry': 'Dry', 'fan_only': 'Fan Only', 'heat': 'Heat', 'heat/cool': 'Heat/Cool', 'fan only': 'Fan Only' }
  return labels[mode] || 'Cool'
}

const getACMode = (index) => {
  return acSettings.mode && acSettings.mode[index] ? acSettings.mode[index] : 'off'
}

const getACModeLabel = (index) => {
  const mode = getACMode(index)
  const labels = {
    'off': 'ปิด',
    'cool': 'Cool',
    'dry': 'Dry',
    'fan_only': 'Fan Only',
    // Backward compatibility
    'heat': 'Heat',
    'heat/cool': 'Heat/Cool',
    'fan only': 'Fan Only',
  }
  return labels[mode] || 'Cool'
}

const getACIcon = (index) => {
  const mode = getACMode(index)
  const icons = {
    'off': 'tabler-power',
    'cool': 'tabler-snowflake',
    'dry': 'tabler-droplet',
    'fan_only': 'tabler-wind',
    // Backward compatibility
    'heat': 'tabler-flame',
    'heat/cool': 'tabler-temperature',
    'fan only': 'tabler-wind',
  }
  return icons[mode] || 'tabler-snowflake'
}

const getACColor = (index) => {
  const mode = getACMode(index)
  const colors = {
    'off': 'default',
    'cool': 'primary',
    'dry': 'info',
    'fan_only': 'info',
    // Backward compatibility
    'heat': 'error',
    'heat/cool': 'warning',
    'fan only': 'info',
  }
  return colors[mode] || 'primary'
}

const getErvMode = (index) => {
  return ervSettings.mode && ervSettings.mode[index] ? ervSettings.mode[index] : 'normal'
}

const getErvSpeed = (index) => {
  return ervSettings.speed && ervSettings.speed[index] ? ervSettings.speed[index] : 'low'
}

const updateERVSpeed = async (index, speed) => {
  const isAreaDevice = isFloorPlanAreaDeviceModal.value
  const areaId = selectedAreaId.value
  
  if (!isAreaDevice && !selectedRoomId.value) return
  if (isAreaDevice && !areaId) return
  
  ervSettings.speed[index] = speed
  lastUpdateTime.value = Date.now()
  
  console.log(`Updating ERV ${index} speed to:`, speed)
  
  try {
    // Check if this device should use Home Assistant API (only for room devices)
    if (!isAreaDevice && shouldUseHomeAssistant('erv', index)) {
      const level = speed === 'high' ? 'high' : 'low'
      await setErvLevelViaHomeAssistant(level)
    } else {
      const currentStatus = getDeviceState('erv', index)
      const payload = {
        status: currentStatus,
        speed: speed,
        mode: ervSettings.mode[index] || 'normal',
      }
      console.log('Sending ERV speed update:', payload)
      const deviceId = ervDeviceIds.value[index]
      if (deviceId == null) throw new Error(`ไม่มี device_id สำหรับ erv[${index}]`)
      const endpoint = isAreaDevice
        ? `/areas/${areaId}/devices/by-id/${deviceId}`
        : `/rooms/${selectedRoomId.value}/devices/by-id/${deviceId}`
      const response = await api.post(endpoint, payload)
      console.log('ERV speed update response:', response.data)
    }
  } catch (error) {
    console.error('Error updating ERV speed:', error)
  }
}

const updateERVMode = async (index, mode) => {
  const isAreaDevice = isFloorPlanAreaDeviceModal.value
  const areaId = selectedAreaId.value
  
  if (!isAreaDevice && !selectedRoomId.value) return
  if (isAreaDevice && !areaId) return
  
  ervSettings.mode[index] = mode
  lastUpdateTime.value = Date.now()
  
  console.log(`Updating ERV ${index} mode to:`, mode)
  
  try {
    // Check if this device should use Home Assistant API (only for room devices)
    if (!isAreaDevice && shouldUseHomeAssistant('erv', index)) {
      const haMode = mode === 'heat' ? 'heat' : 'normal'
      await setErvModeViaHomeAssistant(haMode)
    } else {
      const currentStatus = getDeviceState('erv', index)
      const payload = {
        status: currentStatus,
        speed: ervSettings.speed[index] || 'low',
        mode: mode,
      }
      console.log('Sending ERV mode update:', payload)
      const deviceId = ervDeviceIds.value[index]
      if (deviceId == null) throw new Error(`ไม่มี device_id สำหรับ erv[${index}]`)
      const endpoint = isAreaDevice
        ? `/areas/${areaId}/devices/by-id/${deviceId}`
        : `/rooms/${selectedRoomId.value}/devices/by-id/${deviceId}`
      const response = await api.post(endpoint, payload)
      console.log('ERV mode update response:', response.data)
    }
  } catch (error) {
    console.error('Error updating ERV mode:', error)
  }
}

const updateACMode = async (index, mode) => {
  const isAreaDevice = isFloorPlanAreaDeviceModal.value
  const areaId = selectedAreaId.value
  
  if (!isAreaDevice && !selectedRoomId.value) return
  if (isAreaDevice && !areaId) return
  
  acSettings.mode[index] = mode
  lastUpdateTime.value = Date.now()
  
  // Map frontend mode values to API mode values
  const apiMode = mapModeToAPI(mode)
  
  // If AC is on, update via API
  if (getDeviceState('ac', index)) {
    try {
      // Check if this device should use Home Assistant API (only for room devices)
      if (!isAreaDevice && shouldUseHomeAssistant('ac', index)) {
        await setAirModeViaHomeAssistant(apiMode)
      } else {
        const payload = {
          status: true,
          mode: apiMode,
          temperature: acTemperatures[index] || 25,
        }
        const deviceId = acDeviceIds.value[index]
        if (deviceId == null) throw new Error(`ไม่มี device_id สำหรับ ac[${index}]`)
        const endpoint = isAreaDevice
          ? `/areas/${areaId}/devices/by-id/${deviceId}`
          : `/rooms/${selectedRoomId.value}/devices/by-id/${deviceId}`
        await api.post(endpoint, payload)
      }
    } catch (error) {
      console.error('Error updating AC mode:', error)
    }
  }
}

const updateACTemperature = async (index, temperature) => {
  const isAreaDevice = isFloorPlanAreaDeviceModal.value
  const areaId = selectedAreaId.value
  
  if (!isAreaDevice && !selectedRoomId.value) return
  if (isAreaDevice && !areaId) return
  
  acTemperatures[index] = temperature
  lastUpdateTime.value = Date.now()
  
  // If AC is on, update via API
  if (getDeviceState('ac', index)) {
    try {
      // Check if this device should use Home Assistant API (only for room devices)
      if (!isAreaDevice && shouldUseHomeAssistant('ac', index)) {
        await setAirTemperatureViaHomeAssistant(temperature)
      } else {
        const apiMode = mapModeToAPI(acSettings.mode[index] || 'cool')
        const payload = {
          status: true,
          mode: apiMode,
          temperature: temperature,
        }
        const deviceId = acDeviceIds.value[index]
        if (deviceId == null) throw new Error(`ไม่มี device_id สำหรับ ac[${index}]`)
        const endpoint = isAreaDevice
          ? `/areas/${areaId}/devices/by-id/${deviceId}`
          : `/rooms/${selectedRoomId.value}/devices/by-id/${deviceId}`
        await api.post(endpoint, payload)
      }
    } catch (error) {
      console.error('Error updating AC temperature:', error)
    }
  }
}

const getControlStatus = (type) => {
  const isOn = controls[type]
  return isOn ? 'เปิด' : 'ปิด'
}

const openDeviceModal = (type, index) => {
  if (editMode.value) return
  selectedDevice.type = type
  selectedDevice.index = index
  showDeviceModal.value = true
}

const closeDeviceModal = async () => {
  const wasFloorPlanArea = isFloorPlanAreaDeviceModal.value
  showDeviceModal.value = false
  selectedDevice.type = ''
  selectedDevice.index = -1
  if (wasFloorPlanArea) {
    isFloorPlanAreaDeviceModal.value = false
    const lightDevs = floorPlanAreaDevices.value.light || []
    const acDevs = floorPlanAreaDevices.value.ac || []
    const ervDevs = floorPlanAreaDevices.value.erv || []
    const ventFanDevs = floorPlanAreaDevices.value.vent_fan || []
    const toBool = (s) => !!(s === true || s === 1 || s === 'on' || (s && s.status))
    floorPlanAreaDeviceStates.value = {
      light: (deviceStates.light || []).slice(0, lightDevs.length).map(toBool),
      ac: (deviceStates.ac || []).slice(0, acDevs.length).map(toBool),
      erv: (deviceStates.erv || []).slice(0, ervDevs.length).map(toBool),
      vent_fan: (deviceStates.vent_fan || []).slice(0, ventFanDevs.length).map(toBool)
    }
    floorPlanAreaDeviceSettings.value = {
      erv: {
        speed: (ervSettings.speed || []).slice(0, ervDevs.length),
        mode: (ervSettings.mode || []).slice(0, ervDevs.length)
      },
      ac: {
        mode: (acSettings.mode || []).slice(0, acDevs.length),
        temperature: (Array.isArray(acTemperatures) ? acTemperatures : []).slice(0, acDevs.length)
      }
    }
    floorDeviceStates.value = {
      light: [deviceStates.light?.some(s => s === true || s === 1 || s === 'on' || (s && s.status)) ?? false],
      ac: [deviceStates.ac?.some(s => s === true || s === 1 || s === 'on' || (s && s.status)) ?? false],
      erv: [deviceStates.erv?.some(s => s === true || s === 1 || s === 'on' || (s && s.status)) ?? false],
      vent_fan: [deviceStates.vent_fan?.some(s => s === true || s === 1 || s === 'on' || (s && s.status)) ?? false]
    }
    selectedRoomId.value = null
    const hasAreaDevices = lightDevs.length > 0 || acDevs.length > 0 || ervDevs.length > 0 || ventFanDevs.length > 0
    if (hasAreaDevices) {
      await loadAreaDeviceStates()
    } else {
      await checkFloorDeviceStates()
    }
    await loadAllRoomDeviceStates()
  }
}

const toggleEditMode = () => {
  editMode.value = !editMode.value
}

// Drag and Drop Functions
const startDrag = (event, type, index) => {
  if (!editMode.value || !isSuperAdmin.value) return
  
  event.preventDefault()
  event.stopPropagation()
  
  dragging.value = true
  draggedDevice.value = { type, index }
  
  const iconElement = event.currentTarget
  const layoutRect = roomLayout.value?.getBoundingClientRect()
  if (!layoutRect) return
  
  const iconRect = iconElement.getBoundingClientRect()
  const iconCenterX = iconRect.left + iconRect.width / 2
  const iconCenterY = iconRect.top + iconRect.height / 2
  
  dragOffset.value = {
    x: event.clientX - iconCenterX,
    y: event.clientY - iconCenterY,
  }
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  
  // Prevent text selection
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'grabbing'
}

const onDrag = (event) => {
  if (!dragging.value || !roomLayout.value) return
  
  const layoutRect = roomLayout.value.getBoundingClientRect()
  const x = ((event.clientX - dragOffset.value.x - layoutRect.left) / layoutRect.width) * 100
  const y = ((event.clientY - dragOffset.value.y - layoutRect.top) / layoutRect.height) * 100
  
  // Constrain to layout bounds
  const constrainedX = Math.max(5, Math.min(95, x))
  const constrainedY = Math.max(5, Math.min(95, y))
  
  const { type, index } = draggedDevice.value
  if (devicePositions[type] && devicePositions[type][index]) {
    devicePositions[type][index].x = constrainedX
    devicePositions[type][index].y = constrainedY
  }
}

const stopDrag = async () => {
  if (!dragging.value) return
  
  dragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  
  // Restore cursor and selection
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  
  draggedDevice.value = { type: '', index: -1 }
  
  // Save positions after drag ends
  await saveDevicePositions()
}

// หมายเหตุ: ลบ default positions แล้ว — ใช้ตำแหน่งจาก DB โดยตรง
// ถ้าไม่มีอุปกรณ์ใน DB จะไม่แสดงไอคอน

const applyDevicePositions = (positions) => {
  // ใช้ตำแหน่งจาก DB โดยตรง ไม่ใช้ default
  if (positions.ac && Array.isArray(positions.ac)) {
    devicePositions.ac = [...positions.ac]
  }
  if (positions.erv && Array.isArray(positions.erv)) {
    devicePositions.erv = [...positions.erv]
  }
  if (positions.vent_fan && Array.isArray(positions.vent_fan)) {
    devicePositions.vent_fan = [...positions.vent_fan]
  }
  if (positions.light && Array.isArray(positions.light)) {
    devicePositions.light = [...positions.light]
  }
  if (positions.am319 && Array.isArray(positions.am319)) {
    devicePositions.am319 = [...positions.am319]
  }
}

// Load device positions from API (ใช้ตำแหน่งจาก DB โดยตรง ไม่ใช้ default)
const loadDevicePositions = async () => {
  if (!selectedRoomId.value) return
  
  try {
    const response = await api.get(`/rooms/${selectedRoomId.value}/device-positions`)
    if (response.data && response.data.success && response.data.data) {
      const positions = response.data.data
      
      if (positions.ac && Array.isArray(positions.ac)) {
        devicePositions.ac = positions.ac
      }
      
      if (positions.erv && Array.isArray(positions.erv)) {
        devicePositions.erv = positions.erv
      }
      if (positions.vent_fan && Array.isArray(positions.vent_fan)) {
        devicePositions.vent_fan = positions.vent_fan
      }
      
      if (positions.light && Array.isArray(positions.light)) {
        devicePositions.light = positions.light
      }
      
      if (positions.am319 && Array.isArray(positions.am319)) {
        devicePositions.am319 = positions.am319
      }
    }
    // ถ้าไม่มีข้อมูลจาก API ให้ใช้ array เปล่า (ไม่แสดงไอคอน)
  } catch (error) {
    console.log('Device positions API error:', error.message)
    // ถ้า error ให้ใช้ array เปล่า (ไม่แสดงไอคอน)
  }
}

// Save device positions to API (ลงตาราง devices ผ่าน x, y columns)
const saveDevicePositions = async () => {
  if (!selectedRoomId.value) {
    console.warn('saveDevicePositions: ไม่มีห้องที่เลือก (selectedRoomId เป็น null)')
    return
  }
  
  const positions = {
    erv: [...devicePositions.erv],
    ac: [...devicePositions.ac],
    vent_fan: [...devicePositions.vent_fan],
    light: [...devicePositions.light],
    am319: [...devicePositions.am319],
  }
  
  console.log('กำลังบันทึกตำแหน่ง:', positions)
  
  try {
    const response = await api.post(`/rooms/${selectedRoomId.value}/device-positions`, { positions })
    console.log('บันทึกตำแหน่งสำเร็จ roomId=', selectedRoomId.value, response.data)
    
    // แสดงข้อความสำเร็จ
    if (response.data && response.data.success) {
      alert('บันทึกตำแหน่งอุปกรณ์สำเร็จ')
    }
  } catch (error) {
    console.error('Error saving device positions:', error)
    alert('เกิดข้อผิดพลาดในการบันทึกตำแหน่ง: ' + (error.response?.data?.message || error.message))
  }
}

const getPM25Status = (value) => {
  if (value < 50) return 'ดี'
  if (value < 100) return 'ปานกลาง'
  return 'ไม่ดี'
}

const getPM25ChipColor = (value) => {
  if (value <= 25) return 'success'
  if (value <= 50) return 'info'
  if (value <= 100) return 'warning'
  return 'error'
}

// ดึงค่าเซ็นเซอร์จาก environmental_data ผ่าน GET /rooms/:id/environmental
const fetchRoomEnvironmentalData = async () => {
  if (!selectedRoomId.value || loadingSensorData.value) return
  loadingSensorData.value = true
  try {
    const response = await api.get(`/rooms/${selectedRoomId.value}/environmental`)
    const d = response.data?.data
    if (!d) return
    const setNum = (key, v) => {
      if (v == null || v === '') return
      const n = parseFloat(v)
      if (!Number.isNaN(n) && Number.isFinite(n)) environmentalData[key] = n
    }
    setNum('co2', d.co2)
    setNum('temp', d.temp)
    setNum('noise', d.noise)
    setNum('humidity', d.humidity)
    setNum('pm25', d.pm25)
    setNum('pm10', d.pm10)
    setNum('pressure', d.pressure)
    setNum('hcho', d.hcho)
    setNum('tvoc', d.tvoc)
    if (d.motion != null && d.motion !== '') environmentalData.motion = d.motion
    if (co2ChartInstance.value && environmentalData.co2 != null) {
      const co2Value = parseFloat(environmentalData.co2)
      if (!Number.isNaN(co2Value) && isFinite(co2Value)) updateCO2Chart(co2Value)
    }
    console.log('[Sensor] Room environmental_data updated:', environmentalData)
  } catch (error) {
    console.warn('[Sensor] Failed to fetch room environmental data:', error)
  } finally {
    loadingSensorData.value = false
  }
}

// Fetch AM319 sensor data from API
const fetchAm319SensorData = async () => {
  if (loadingSensorData.value) return
  
  loadingSensorData.value = true
  try {
    const response = await api.get('/devices/sensor/am319')
    const sensorData = response.data.data
    
    if (sensorData && sensorData.formatted) {
      const formatted = sensorData.formatted
      
      // Update environmental data
      if (formatted.co2 !== null && formatted.co2 !== undefined) {
        environmentalData.co2 = parseFloat(formatted.co2) || 0
      }
      if (formatted.temperature !== null && formatted.temperature !== undefined) {
        environmentalData.temp = parseFloat(formatted.temperature) || 0
      }
      if (formatted.humidity !== null && formatted.humidity !== undefined) {
        environmentalData.humidity = parseFloat(formatted.humidity) || 0
      }
      if (formatted.motion !== null && formatted.motion !== undefined) {
        environmentalData.motion = formatted.motion === 'on' ? 'Active' : 'Inactive'
      }
      if (formatted.pm2_5 !== null && formatted.pm2_5 !== undefined) {
        environmentalData.pm25 = parseFloat(formatted.pm2_5) || 0
      }
      if (formatted.pm10 !== null && formatted.pm10 !== undefined) {
        environmentalData.pm10 = parseFloat(formatted.pm10) || 0
      }
      if (formatted.pressure !== null && formatted.pressure !== undefined) {
        environmentalData.pressure = parseFloat(formatted.pressure) || 0
      }
      if (formatted.hcho !== null && formatted.hcho !== undefined) {
        environmentalData.hcho = parseFloat(formatted.hcho) || 0
      }
      if (formatted.tvoc !== null && formatted.tvoc !== undefined) {
        environmentalData.tvoc = parseFloat(formatted.tvoc) || 0
      }
      
      // Update CO2 chart if available
      if (co2ChartInstance.value && environmentalData.co2 !== null && environmentalData.co2 !== undefined) {
        const co2Value = parseFloat(environmentalData.co2)
        if (!isNaN(co2Value) && isFinite(co2Value)) {
          updateCO2Chart(co2Value)
        }
      }
      
      console.log('[Sensor] AM319 data updated:', environmentalData)
    }
  } catch (error) {
    console.warn('[Sensor] Failed to fetch AM319 sensor data:', error)
    // Don't show error to user, just log warning
  } finally {
    loadingSensorData.value = false
  }
}

// Update CO2 chart with new data point
const updateCO2Chart = (co2Value) => {
  // Prevent concurrent updates
  if (isUpdatingChart.value) {
    return
  }
  
  // Check if chart is still valid
  if (!co2ChartInstance.value) {
    return
  }
  
  // Get raw chart instance (unwrap any reactive proxy)
  const chart = toRaw(co2ChartInstance.value)
  if (!chart || !chart.data || !Array.isArray(chart.data.datasets) || !chart.data.datasets[0]) {
    return
  }
  
  // Check if chart is destroyed or not connected
  try {
    if (chart.canvas && !chart.canvas.isConnected) {
      return
    }
  } catch (e) {
    // Chart may be destroyed
    return
  }
  
  isUpdatingChart.value = true
  
  // Use setTimeout to defer update and break reactive chain completely
  setTimeout(() => {
    try {
      // Re-check chart validity
      const currentChart = toRaw(co2ChartInstance.value)
      if (!currentChart || !currentChart.data || !currentChart.data.datasets || !currentChart.data.datasets[0]) {
        isUpdatingChart.value = false
        return
      }
      
      const now = new Date()
      const timeLabel = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      
      // Get raw chart data to avoid reactive proxy issues
      const rawData = toRaw(currentChart.data)
      const rawLabels = rawData.labels || []
      const rawDataset = rawData.datasets[0]
      const rawDatasetData = rawDataset.data || []
      
      // Create plain arrays from raw data (deep copy to avoid any reactive references)
      const currentLabels = Array.isArray(rawLabels) ? JSON.parse(JSON.stringify(rawLabels)) : []
      const currentData = Array.isArray(rawDatasetData) ? JSON.parse(JSON.stringify(rawDatasetData)) : []
      
      // Add new data point
      currentLabels.push(timeLabel)
      currentData.push(co2Value)
      
      // Keep only last 24 data points
      if (currentLabels.length > 24) {
        currentLabels.shift()
        currentData.shift()
      }
      
      // Update chart data by replacing arrays (not mutating reactive proxies)
      currentChart.data.labels = currentLabels
      currentChart.data.datasets[0].data = currentData
      
      // Calculate min/max from plain array (not reactive)
      if (currentData.length > 0) {
        const minValue = Math.min(...currentData)
        const maxValue = Math.max(...currentData)
        const minIndex = currentData.indexOf(minValue)
        const maxIndex = currentData.indexOf(maxValue)
        
        // Update reactive object in next tick to avoid triggering chart update
        setTimeout(() => {
          if (co2MinMax) {
            co2MinMax.min = minValue
            co2MinMax.max = maxValue
            co2MinMax.minTime = currentLabels[minIndex] || 'N/A'
            co2MinMax.maxTime = currentLabels[maxIndex] || 'N/A'
          }
        }, 0)
      }
      
      // Update chart without animation (use 'none' mode)
      currentChart.update('none')
      
      // Reset flag after chart update completes
      setTimeout(() => {
        isUpdatingChart.value = false
      }, 50)
    } catch (error) {
      console.error('[Sensor] Error updating CO2 chart:', error)
      isUpdatingChart.value = false
    }
  }, 0)
}

// Auto-refresh sensor overlay / environmental data ทุก 10 วินาที
const startSensorDataAutoRefresh = () => {
  if (sensorDataRefreshInterval.value) {
    clearInterval(sensorDataRefreshInterval.value)
  }

  const refresh = () => {
    const hasAm319Row = devicePositions.am319 && devicePositions.am319.length > 0
    if (hasAm319Row && selectedRoomId.value) {
      fetchRoomEnvironmentalData()
    } else {
      fetchAm319SensorData()
    }
  }

  refresh()
  sensorDataRefreshInterval.value = setInterval(refresh, 10000)
}

// Stop auto-refresh for sensor data
const stopSensorDataAutoRefresh = () => {
  if (sensorDataRefreshInterval.value) {
    clearInterval(sensorDataRefreshInterval.value)
    sensorDataRefreshInterval.value = null
  }
}

const initCO2Chart = () => {
  // Prevent multiple simultaneous initializations
  if (isChartInitializing.value) return
  isChartInitializing.value = true

  // Destroy existing chart if it exists
  if (co2ChartInstance.value) {
    try {
    co2ChartInstance.value.destroy()
    } catch (error) {
      // Chart may already be destroyed, ignore error
    }
    co2ChartInstance.value = null
  }

  // Wait for next tick and ensure canvas is ready
  nextTick(() => {
    if (!co2Chart.value) {
      isChartInitializing.value = false
      return
    }

    // Use requestAnimationFrame to ensure canvas is fully rendered
    requestAnimationFrame(() => {
      if (!co2Chart.value) {
        isChartInitializing.value = false
        return
      }

      try {
        // Check if canvas element is still in DOM
        if (!co2Chart.value.isConnected || !co2Chart.value.parentElement) {
          isChartInitializing.value = false
          return
        }

        // Check if canvas has dimensions
        if (co2Chart.value.offsetWidth === 0 || co2Chart.value.offsetHeight === 0) {
          // Retry after a short delay if canvas has no dimensions (max 3 retries)
          if (chartRetryCount.value < 3) {
            chartRetryCount.value++
            setTimeout(() => {
              isChartInitializing.value = false
              initCO2Chart()
            }, 200)
          } else {
            isChartInitializing.value = false
            chartRetryCount.value = 0
          }
          return
        }

        // Reset retry count on success
        chartRetryCount.value = 0

        // Double check canvas is still valid
        if (!co2Chart.value || !co2Chart.value.isConnected) {
          isChartInitializing.value = false
          return
        }

        let ctx
        try {
          ctx = co2Chart.value.getContext('2d', { willReadFrequently: false })
        } catch (ctxError) {
          console.warn('Could not get 2d context from canvas:', ctxError)
          isChartInitializing.value = false
          return
        }

        if (!ctx || typeof ctx.save !== 'function') {
          console.warn('Invalid canvas context')
          isChartInitializing.value = false
          return
        }
    
    // Generate sample data for 24 hours
    const labels = []
    const data = []
    const now = new Date()
    
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000)
      labels.push(time.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))
      data.push(Math.floor(Math.random() * 200) + 400) // Random CO2 between 400-600
        }

        // Create chart with error handling
        try {
          // Final check before creating chart
          if (!co2Chart.value || !co2Chart.value.isConnected || !ctx) {
            isChartInitializing.value = false
            return
    }

    // Use markRaw to prevent Vue from making chart instance reactive
    const chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'CO2 (ppm)',
          data,
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46, 204, 113, 0.1)',
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
              animation: {
                duration: 0, // Disable animation to prevent issues during unmount
              },
              interaction: {
                intersect: false,
                mode: 'index',
              },
        plugins: {
          legend: {
            display: false,
          },
                tooltip: {
                  enabled: true,
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            min: 300,
            max: 1000,
          },
                x: {
                  display: true,
          },
        },
      },
          })
          
          // Mark chart instance as non-reactive to prevent Vue from wrapping it
          co2ChartInstance.value = markRaw(chartInstance)
        } catch (chartError) {
          console.error('Error creating Chart.js instance:', chartError)
          co2ChartInstance.value = null
        }
      } catch (error) {
        console.error('Error initializing chart:', error)
      } finally {
        isChartInitializing.value = false
      }
    })
  })
}

const selectAreaById = (buildingId, areaId) => {
  router.push({
    name: 'rooms-control',
    query: {
      building: buildingId,
      area: areaId,
    },
  })
}

const selectArea = async (areaName, areaId) => {
  let targetAreaId = areaId ? Number(areaId) : null
  if (typeof areaId === 'string' && areaId.startsWith('area-')) {
    targetAreaId = parseInt(areaId.replace('area-', ''), 10)
  }
  let firstRoomId

  // areaId อาจเป็น room.id (เมื่อ area box สร้างจาก room ที่มี x1,y1,x2,y2)
  const roomById = targetAreaId && !isNaN(targetAreaId) ? rooms.value.find(r => Number(r.id) === targetAreaId) : null
  if (roomById) {
    targetAreaId = Number(selectedAreaId.value) || Number(roomById.area_id)
    firstRoomId = Number(roomById.id)
  } else if (targetAreaId) {
    const areaRooms = rooms.value.filter(r => Number(r.area_id) === targetAreaId)
    if (areaRooms.length > 0) firstRoomId = Number(areaRooms[0].id)
  }

  if (!targetAreaId && areaName) {
    const buildingId = _toNumOrNull(selectedBuilding.value)
    const floorNumber = _toNumOrNull(selectedFloor.value)
    const targetArea = areas.value.find(a =>
      _norm(a.name) === _norm(areaName)
      && Number(a.building_id) === buildingId
      && Number(a.floor) === floorNumber,
    )
    if (targetArea) {
      targetAreaId = Number(targetArea.id)
      const areaRooms = rooms.value.filter(r => Number(r.area_id) === targetAreaId)
      if (areaRooms.length > 0) firstRoomId = Number(areaRooms[0].id)
    }
  }

  if (targetAreaId == null) return
  router.push({
    name: 'rooms-control',
    query: {
      building: selectedBuilding.value,
      area: targetAreaId,
      ...(firstRoomId ? { room: firstRoomId } : {}),
    },
  })
}

// เปิด modal จาก floor plan area (ใช้ area API โดยตรง ไม่ต้องใช้ proxy room)
const isFloorPlanAreaDeviceModal = ref(false)

/** คลิกไอคอนอุปกรณ์ area บน floor plan → เปิด modal คอนโทรลแบบเดียวกับหน้า room */
const handleFloorPlanDeviceClick = async (type, index) => {
  const areaId = _toNumOrNull(selectedAreaId.value)
  if (areaId == null) return
  
  // ไม่ต้องใช้ proxy room แล้ว เพราะ area devices มี API ของตัวเอง
  selectedRoomId.value = null
  
  const lightDevs = floorPlanAreaDevices.value.light || []
  const acDevs = floorPlanAreaDevices.value.ac || []
  const ervDevs = floorPlanAreaDevices.value.erv || []
  const ventFanDevs = floorPlanAreaDevices.value.vent_fan || []
  const lightStates = floorPlanAreaDeviceStates.value.light || []
  const acStates = floorPlanAreaDeviceStates.value.ac || []
  const ervStates = floorPlanAreaDeviceStates.value.erv || []
  const ventFanStates = floorPlanAreaDeviceStates.value.vent_fan || []
  const areaSettings = floorPlanAreaDeviceSettings.value
  const padArr = (arr, len, def) => [...(arr || []).slice(0, len), ...Array(Math.max(0, len - (arr || []).length)).fill(def)]
  const ervSpeed = padArr(areaSettings.erv?.speed, ervDevs.length, 'low')
  const ervMode = padArr(areaSettings.erv?.mode, ervDevs.length, 'normal')
  const acMode = padArr(areaSettings.ac?.mode, acDevs.length, 'off')
  const acTemp = padArr(areaSettings.ac?.temperature, acDevs.length, 25)
  ervSettings.speed.splice(0, ervSettings.speed.length, ...ervSpeed)
  ervSettings.mode.splice(0, ervSettings.mode.length, ...ervMode)
  acSettings.mode.splice(0, acSettings.mode.length, ...acMode)
  acTemperatures.splice(0, acTemperatures.length, ...acTemp)
  deviceStates.light = lightDevs.length > 0 ? lightDevs.map((_, i) => lightStates[i] ?? false) : []
  deviceStates.ac = acDevs.length > 0 ? [...acDevs.map((_, i) => acStates[i] ?? false), ...Array(Math.max(0, 3 - acDevs.length)).fill(false)].slice(0, 3) : [false, false, false]
  deviceStates.erv = ervDevs.length > 0 ? [...ervDevs.map((_, i) => ervStates[i] ?? false), ...Array(Math.max(0, 3 - ervDevs.length)).fill(false)].slice(0, 3) : [false, false, false]
  deviceStates.vent_fan = ventFanDevs.map((_, i) => ventFanStates[i] ?? false)
  if (lightDevs.length > 0) devicePositions.light = lightDevs.map(d => ({ x: d.x, y: d.y }))
  if (acDevs.length > 0) devicePositions.ac = acDevs.map(d => ({ x: d.x, y: d.y }))
  if (ervDevs.length > 0) devicePositions.erv = ervDevs.map(d => ({ x: d.x, y: d.y }))
  if (ventFanDevs.length > 0) devicePositions.vent_fan = ventFanDevs.map(d => ({ x: d.x, y: d.y }))
  lightDeviceIds.value = {}
  lightDevs.forEach((d, i) => { lightDeviceIds.value[i] = d.id })
  acDeviceIds.value = {}
  acDevs.forEach((d, i) => { acDeviceIds.value[i] = d.id })
  ervDeviceIds.value = {}
  ervDevs.forEach((d, i) => { ervDeviceIds.value[i] = d.id })
  ventFanDeviceIds.value = {}
  ventFanDevs.forEach((d, i) => { ventFanDeviceIds.value[i] = d.id })
  isFloorPlanAreaDeviceModal.value = true
  await nextTick()
  openDeviceModal(type, index)
}

// Handle building dropdown change
const handleBuildingChange = async (buildingId) => {
  // Always load data from fetchBuildings (same as building list page)
  await fetchBuildings()
  
  router.push({
    name: 'rooms-control',
    query: {
      building: buildingId,
    },
  })
}

// Handle area dropdown change
const handleAreaChange = async (areaId) => {
  await fetchBuildings()
  router.push({
    name: 'rooms-control',
    query: {
      building: selectedBuilding.value,
      area: areaId,
    },
  })
}

// Handle room dropdown change
const handleRoomChange = (roomId) => {
  if (roomId == null && loading.value) return
  selectedRoomId.value = roomId ? Number(roomId) : null

  if (roomId && !selectedAreaId.value) {
    const room = rooms.value.find(r => Number(r.id) === Number(roomId))
    if (room) {
      const areaId = Number(room.area_id ?? room.areaId)
      if (areaId) {
        router.push({
          query: {
            building: selectedBuilding.value,
            area: areaId,
            room: roomId,
          },
        })
        return
      }
    }
  }

  router.replace({
    query: {
      ...route.query,
      room: roomId || undefined,
    },
  })
  if (roomId) {
    loadRoomDevices()
  }
}

const backToFloorPlan = () => {
  router.push({
    name: 'rooms-control',
    query: {
      building: selectedBuilding.value,
      area: selectedAreaId.value,
    },
  })
  nextTick(() => {
    const hasAreaDevices = (floorPlanAreaDevices.value.light?.length || 0) + (floorPlanAreaDevices.value.ac?.length || 0) + (floorPlanAreaDevices.value.erv?.length || 0) > 0
    if (hasAreaDevices) loadAreaDeviceStates()
    else checkFloorDeviceStates()
  })
}

// Floor Plan Edit Functions
const toggleFloorPlanEditMode = () => {
  floorPlanEditMode.value = !floorPlanEditMode.value
  if (!floorPlanEditMode.value) {
    selectedAreaForEdit.value = null
    resizingArea.value = null
    draggingArea.value = null
  }
}

const addArea = () => {
  const newId = Math.max(...floorPlanAreas.value.map(a => a.id), 0) + 1
  floorPlanAreas.value.push({
    id: newId,
    name: `Zone ${String.fromCharCode(64 + newId)}`,
    icon: 'tabler-box',
    top: 30,
    left: 30,
    width: 20,
    height: 20,
  })
}

const deleteArea = (areaId) => {
  const index = floorPlanAreas.value.findIndex(a => a.id === areaId)
  if (index > -1) {
    floorPlanAreas.value.splice(index, 1)
  }
}

const startResizeArea = (event, areaId) => {
  event.stopPropagation()
  resizingArea.value = areaId
  const area = floorPlanAreas.value.find(a => a.id === areaId)
  if (area) {
    resizeStart.value = {
      x: event.clientX,
      y: event.clientY,
      width: area.width,
      height: area.height,
      left: area.left,
      top: area.top,
    }
  }
  document.addEventListener('mousemove', onResizeArea)
  document.addEventListener('mouseup', stopResizeArea)
}

const onResizeArea = (event) => {
  if (!resizingArea.value) return
  
  const area = floorPlanAreas.value.find(a => a.id === resizingArea.value)
  if (!area) return
  
  const container = document.querySelector('.floor-plan-container')
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  const deltaX = ((event.clientX - resizeStart.value.x) / containerRect.width) * 100
  const deltaY = ((event.clientY - resizeStart.value.y) / containerRect.height) * 100
  
  // Resize from bottom-right corner
  area.width = Math.max(10, Math.min(90, resizeStart.value.width + deltaX))
  area.height = Math.max(10, Math.min(90, resizeStart.value.height + deltaY))
}

const stopResizeArea = () => {
  resizingArea.value = null
  document.removeEventListener('mousemove', onResizeArea)
  document.removeEventListener('mouseup', stopResizeArea)
}

const startDragArea = (event, areaId) => {
  if (!floorPlanEditMode.value) return
  event.stopPropagation()
  draggingArea.value = areaId
  const area = floorPlanAreas.value.find(a => a.id === areaId)
  if (area) {
    dragAreaStart.value = {
      x: event.clientX,
      y: event.clientY,
      left: area.left,
      top: area.top,
    }
  }
  document.addEventListener('mousemove', onDragArea)
  document.addEventListener('mouseup', stopDragArea)
}

const onDragArea = (event) => {
  if (!draggingArea.value) return
  
  const area = floorPlanAreas.value.find(a => a.id === draggingArea.value)
  if (!area) return
  
  const container = document.querySelector('.floor-plan-container')
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  const deltaX = ((event.clientX - dragAreaStart.value.x) / containerRect.width) * 100
  const deltaY = ((event.clientY - dragAreaStart.value.y) / containerRect.height) * 100
  
  area.left = Math.max(0, Math.min(100 - area.width, dragAreaStart.value.left + deltaX))
  area.top = Math.max(0, Math.min(100 - area.height, dragAreaStart.value.top + deltaY))
}

const stopDragArea = () => {
  draggingArea.value = null
  document.removeEventListener('mousemove', onDragArea)
  document.removeEventListener('mouseup', stopDragArea)
}

const saveFloorPlanAreas = async () => {
  saveFloorPlanLoading.value = true
  try {
    const areasToSave = floorPlanAreas.value.filter(a => a.hasPositionFromDb)
    for (const area of areasToSave) {
      const x1 = Number(area.left)
      const y1 = Number(area.top)
      const x2 = Number(area.left) + Number(area.width)
      const y2 = Number(area.top) + Number(area.height)
      await api.put(`/rooms/${area.id}`, { x1, y1, x2, y2 })
    }
    if (areasToSave.length > 0) {
      const roomsResponse = await api.get('/rooms')
      rooms.value = roomsResponse.data.data || roomsResponse.data || []
      await loadFloorPlanAreas()
    }
    const systemControlKey = `systemControl_${selectedBuilding.value}_${selectedAreaId.value}`
    localStorage.setItem(systemControlKey, JSON.stringify({
      position: systemControlPosition.value,
      size: systemControlSize.value
    }))
    floorPlanEditMode.value = false
  } catch (error) {
    console.error('Error saving floor plan areas:', error)
    throw error
  } finally {
    saveFloorPlanLoading.value = false
  }
}

const loadFloorPlanAreas = async () => {
  try {
    // Ensure areas and rooms are loaded for checkFloorDeviceStates
    if (areas.value.length === 0 || rooms.value.length === 0) {
      console.log('Loading areas and rooms for floor plan...')
      const [areasResponse, roomsResponse] = await Promise.all([
        api.get('/areas'),
        api.get('/rooms'),
      ])
      areas.value = areasResponse.data.data || []
      rooms.value = roomsResponse.data.data || []
      console.log(`Loaded ${areas.value.length} areas and ${rooms.value.length} rooms`)
      
      // Log areas in current building and floor
      const buildingIdStr = String(selectedBuilding.value)
      const floorNumberStr = String(selectedFloor.value)
      const currentFloorAreas = areas.value.filter(a => {
        return String(a.building_id) === buildingIdStr && String(a.floor) === floorNumberStr
      })
      console.log(`Areas in Building ${selectedBuilding.value}, Floor ${selectedFloor.value}:`, currentFloorAreas)
      
      // Log rooms: ข้อมูล floor จากตาราง areas คอลัมน์ floor เท่านั้น
      const floorAreaIds = currentFloorAreas.map(a => a.id)
      const currentFloorRooms = rooms.value.filter(r => floorAreaIds.includes(r.area_id))
      console.log(`Rooms in Building ${selectedBuilding.value}, Floor ${selectedFloor.value} (from areas.floor):`, currentFloorRooms)
    }
    
    // สร้าง area boxes จาก rooms ที่มี x1,y1,x2,y2 + virtual area เมื่อมีอุปกรณ์ area_id แต่ไม่มีห้องที่มี position
    const roomsWithPosition = roomsWithPositionInArea.value
    const areaId = _toNumOrNull(selectedAreaId.value)
    const selectedAreaObj = selectedArea.value

    if (roomsWithPosition.length > 0) {
      floorPlanAreas.value = roomsWithPosition.map(room => {
        const x1 = Number(room.x1)
        const y1 = Number(room.y1)
        const x2 = Number(room.x2)
        const y2 = Number(room.y2)
        return {
          id: room.id,
          name: room.name || `Room ${room.id}`,
          icon: 'tabler-layout-grid',
          top: y1,
          left: x1,
          width: Math.max(1, x2 - x1),
          height: Math.max(1, y2 - y1),
          hasPositionFromDb: true,
        }
      })
    } else {
      floorPlanAreas.value = []
    }

    // โหลดอุปกรณ์ระดับ area สำหรับแสดง icon บน floor plan (ทั้งกรณีมี/ไม่มีห้องที่มี position)
    floorPlanAreaDevices.value = { light: [], ac: [], erv: [], vent_fan: [] }
    if (areaId != null) {
      try {
        const areaDevicesRes = await api.get(`/areas/${areaId}/devices`)
        const areaDevicesData = areaDevicesRes.data?.data || areaDevicesRes.data || {}
        const devices = areaDevicesData.devices || []
        const resolveType = (d) => (d.device_type || d.code || (d.device_type_name ? String(d.device_type_name).toLowerCase() : null))
        devices.forEach((d) => {
          let t = resolveType(d)
          if (t === 'fan' || t === 'exhaust_fan' || t === 'ventilation_fan') t = 'vent_fan'
          if (t === 'light' || t === 'ac' || t === 'erv' || t === 'vent_fan') {
            const x = d.x != null ? Number(d.x) : 50
            const y = d.y != null ? Number(d.y) : 50
            floorPlanAreaDevices.value[t].push({ id: d.id, name: d.name, x, y })
          }
        })
        // ใช้ deviceStates จาก area API โดยตรง (ไม่ต้องเรียก room API)
        const ds = areaDevicesData.deviceStates || {}
        const toBool = (s) => !!(s && (s.status === true || s.status === 1 || s.status === 'on')) || s === true
        const lightItems = ds.light || []
        const lightArr = (ds.light || []).map(s => toBool(s))
        const acArr = (ds.ac || []).map(s => toBool(s))
        const ervArr = (ds.erv || []).map(s => toBool(s))
        const ventFanArr = (ds.vent_fan || []).map(s => toBool(s))
        const lightDevs = floorPlanAreaDevices.value.light || []
        const acDevs = floorPlanAreaDevices.value.ac || []
        const ervDevs = floorPlanAreaDevices.value.erv || []
        const ventFanDevs = floorPlanAreaDevices.value.vent_fan || []
        if (lightDevs.length || acDevs.length || ervDevs.length || ventFanDevs.length) {
          floorPlanAreaDeviceStates.value = {
            light: lightDevs.map((_, i) => lightArr[i] ?? lightArr[0] ?? false),
            ac: acDevs.map((_, i) => acArr[i] ?? acArr[0] ?? false),
            erv: ervDevs.map((_, i) => ervArr[i] ?? ervArr[0] ?? false),
            vent_fan: ventFanDevs.map((_, i) => ventFanArr[i] ?? ventFanArr[0] ?? false)
          }
          const acItems = ds.ac || []
          const ervItems = ds.erv || []
          const getLightBrightness = (i) => {
            const item = lightItems[i] ?? lightItems[0]
            const b = item?.settings?.brightness ?? item?.brightness
            return b != null && !Number.isNaN(Number(b)) ? Number(b) : 128
          }
          const getAcMode = (i) => acItems[i]?.settings?.mode || acItems[i]?.mode || 'off'
          const getAcTemp = (i) => acItems[i]?.settings?.temperature ?? acItems[i]?.temperature ?? 25
          const getErvSpeed = (i) => ervItems[i]?.settings?.speed || ervItems[i]?.speed || 'low'
          const getErvMode = (i) => ervItems[i]?.settings?.mode || ervItems[i]?.mode || 'normal'
          floorPlanAreaDeviceSettings.value = {
            light: { brightness: lightDevs.map((_, i) => getLightBrightness(i)) },
            erv: { speed: ervDevs.map((_, i) => getErvSpeed(i)), mode: ervDevs.map((_, i) => getErvMode(i)) },
            ac: { mode: acDevs.map((_, i) => getAcMode(i)), temperature: acDevs.map((_, i) => getAcTemp(i)) }
          }
          // floorDeviceStates สำหรับ allSystemsOn (เมื่อมี area devices)
          floorDeviceStates.value = {
            light: [lightArr.some(Boolean)],
            ac: [acArr.some(Boolean)],
            erv: [ervArr.some(Boolean)],
            vent_fan: [ventFanArr.some(Boolean)]
          }
        }
      } catch (e) {
        console.warn('[Control] Failed to fetch area devices:', e?.message)
      }
    }

    // ถ้าไม่มีห้องที่มี position แต่ area มีอุปกรณ์ area_id → เพิ่ม virtual area box สำหรับแสดง icon คอนโทรล
    if (roomsWithPosition.length === 0 && areaId != null) {
      const hasAreaDevices = (floorPlanAreaDevices.value.light?.length || 0) + (floorPlanAreaDevices.value.ac?.length || 0) + (floorPlanAreaDevices.value.erv?.length || 0) > 0
      if (hasAreaDevices) {
        const areaName = selectedAreaObj?.name || `Area ${areaId}`
        floorPlanAreas.value = [{
          id: `area-${areaId}`,
          name: areaName,
          icon: 'tabler-layout-grid',
          top: 75,
          left: 30,
          width: 40,
          height: 20,
          hasPositionFromDb: false,
        }]
      }
    }

    // Load system control button position and size
    const systemControlKey = `systemControl_${selectedBuilding.value}_${selectedAreaId.value}`
    const savedSystemControl = localStorage.getItem(systemControlKey)
    if (savedSystemControl) {
      const data = JSON.parse(savedSystemControl)
      // Support both old format (just position) and new format (position + size)
      if (data.position) {
        systemControlPosition.value = data.position
        systemControlSize.value = data.size || { width: 80, height: 80 }
      } else {
        // Old format - just position
        systemControlPosition.value = data
        systemControlSize.value = { width: 80, height: 80 }
      }
    } else {
      // Default position and size
      systemControlPosition.value = { top: 20, right: 20 }
      systemControlSize.value = { width: 80, height: 80 }
    }
  } catch (error) {
    console.error('Error loading floor plan areas:', error)
  }
}

const startEditAreaName = (areaId) => {
  const area = floorPlanAreas.value.find(a => a.id === areaId)
  if (area) {
    editingAreaName.value = areaId
    editingAreaNameValue.value = area.name
  }
}

const saveAreaName = (areaId) => {
  const area = floorPlanAreas.value.find(a => a.id === areaId)
  if (area && editingAreaNameValue.value.trim()) {
    area.name = editingAreaNameValue.value.trim()
  }
  editingAreaName.value = null
  editingAreaNameValue.value = ''
}

// System Control Button Drag Functions
const startDragSystemControl = (event) => {
  if (!floorPlanEditMode.value) {
    // If not in edit mode, allow normal click behavior
    return
  }
  event.stopPropagation()
  event.preventDefault()
  draggingSystemControl.value = true
  dragSystemControlStart.value = {
    x: event.clientX,
    y: event.clientY,
    top: systemControlPosition.value.top,
    right: systemControlPosition.value.right,
  }
  document.addEventListener('mousemove', onDragSystemControl)
  document.addEventListener('mouseup', stopDragSystemControl)
}

const onDragSystemControl = (event) => {
  if (!draggingSystemControl.value) return
  
  const container = document.querySelector('.floor-plan-container')
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  const deltaX = event.clientX - dragSystemControlStart.value.x
  const deltaY = event.clientY - dragSystemControlStart.value.y
  
  // Calculate new position in pixels
  const buttonWidth = 80 // Approximate button width
  const buttonHeight = 120 // Approximate button height (icon + label)
  
  let newRight = dragSystemControlStart.value.right - deltaX
  let newTop = dragSystemControlStart.value.top + deltaY
  
  // Constrain to container bounds (in pixels)
  newRight = Math.max(0, Math.min(containerRect.width - buttonWidth, newRight))
  newTop = Math.max(0, Math.min(containerRect.height - buttonHeight, newTop))
  
  systemControlPosition.value = {
    top: newTop,
    right: newRight
  }
}

const stopDragSystemControl = () => {
  draggingSystemControl.value = false
  document.removeEventListener('mousemove', onDragSystemControl)
  document.removeEventListener('mouseup', stopDragSystemControl)
  
  // Save position and size to localStorage
  const systemControlKey = `systemControl_${selectedBuilding.value}_${selectedAreaId.value}`
  localStorage.setItem(systemControlKey, JSON.stringify({
    position: systemControlPosition.value,
    size: systemControlSize.value
  }))
}

// System Control Button Resize Functions
const startResizeSystemControl = (event) => {
  if (!floorPlanEditMode.value) return
  event.stopPropagation()
  event.preventDefault()
  resizingSystemControl.value = true
  resizeSystemControlStart.value = {
    x: event.clientX,
    y: event.clientY,
    width: systemControlSize.value.width,
    height: systemControlSize.value.height,
  }
  document.addEventListener('mousemove', onResizeSystemControl)
  document.addEventListener('mouseup', stopResizeSystemControl)
}

const onResizeSystemControl = (event) => {
  if (!resizingSystemControl.value) return
  
  const deltaX = event.clientX - resizeSystemControlStart.value.x
  const deltaY = event.clientY - resizeSystemControlStart.value.y
  
  // Resize proportionally or independently
  const minSize = 50
  const maxSize = 200
  
  let newWidth = resizeSystemControlStart.value.width + deltaX
  let newHeight = resizeSystemControlStart.value.height + deltaY
  
  // Constrain size
  newWidth = Math.max(minSize, Math.min(maxSize, newWidth))
  newHeight = Math.max(minSize, Math.min(maxSize, newHeight))
  
  systemControlSize.value = {
    width: newWidth,
    height: newHeight
  }
}

const stopResizeSystemControl = () => {
  resizingSystemControl.value = false
  document.removeEventListener('mousemove', onResizeSystemControl)
  document.removeEventListener('mouseup', stopResizeSystemControl)
  
  // Save position and size to localStorage
  const systemControlKey = `systemControl_${selectedBuilding.value}_${selectedAreaId.value}`
  localStorage.setItem(systemControlKey, JSON.stringify({
    position: systemControlPosition.value,
    size: systemControlSize.value
  }))
}

const cancelEditAreaName = () => {
  editingAreaName.value = null
  editingAreaNameValue.value = ''
}

const backToBuildings = () => {
  router.push({ name: 'rooms-control' })
}

// System Control Functions
const toggleSystemControl = () => {
  const newState = !allSystemsOn.value
  systemControlAction.value = newState ? 'turnOn' : 'turnOff'
  showSystemControlDialog.value = true
}

// Load device states for a specific room
const loadRoomDeviceStates = async (roomId) => {
  if (!roomId || loadingRoomStates.value[roomId]) return
  
  loadingRoomStates.value[roomId] = true
  try {
    const response = await api.get(`/rooms/${roomId}/devices`)
    const devices = response.data.data || response.data || {}
    const deviceStates = devices.deviceStates || {}
    
    const states = {
      light: [],
      ac: [],
      erv: [],
      vent_fan: [],
    }
    
    if (deviceStates.light && Array.isArray(deviceStates.light)) {
      states.light = deviceStates.light.map(light => {
        const s = light?.status ?? light
        return s === true || s === 1 || s === 'on'
      })
    }
    
    if (deviceStates.ac && Array.isArray(deviceStates.ac)) {
      states.ac = deviceStates.ac.map(ac => {
        const s = ac?.status ?? ac
        return s === true || s === 1 || s === 'on'
      })
    }
    
    if (deviceStates.erv && Array.isArray(deviceStates.erv)) {
      states.erv = deviceStates.erv.map(erv => {
        const s = erv?.status ?? erv
        return s === true || s === 1 || s === 'on'
      })
    }
    
    if (deviceStates.vent_fan && Array.isArray(deviceStates.vent_fan)) {
      states.vent_fan = deviceStates.vent_fan.map(fan => {
        const s = fan?.status ?? fan
        return s === true || s === 1 || s === 'on'
      })
    }
    
    roomDeviceStates.value[roomId] = states
  } catch (error) {
    console.error(`Error loading device states for room ${roomId}:`, error)
    roomDeviceStates.value[roomId] = { light: [], ac: [], erv: [], vent_fan: [] }
  } finally {
    loadingRoomStates.value[roomId] = false
  }
}

// Toggle system control for a specific room (show dialog first)
const toggleRoomSystemControl = (roomId) => {
  // Store the target room ID
  systemControlTargetRoomId.value = roomId
  
  // Don't set action yet - let user choose in dialog
  systemControlAction.value = null
  
  // Show confirmation dialog
  showSystemControlDialog.value = true
}

// โหลดสถานะอุปกรณ์ area จาก API /areas/:id/devices เท่านั้น (ไม่เรียก room API)
const loadAreaDeviceStates = async () => {
  const areaId = _toNumOrNull(selectedAreaId.value)
  const lightDevs = floorPlanAreaDevices.value.light || []
  const acDevs = floorPlanAreaDevices.value.ac || []
  const ervDevs = floorPlanAreaDevices.value.erv || []
  const ventFanDevs = floorPlanAreaDevices.value.vent_fan || []
  if (areaId == null || (!lightDevs.length && !acDevs.length && !ervDevs.length && !ventFanDevs.length)) return
  try {
    const res = await api.get(`/areas/${areaId}/devices`)
    const data = res.data?.data || res.data || {}
    const ds = data.deviceStates || {}
    const toBool = (s) => !!(s && (s.status === true || s.status === 1 || s.status === 'on')) || s === true
    const lightArr = (ds.light || []).map(s => toBool(s))
    const acArr = (ds.ac || []).map(s => toBool(s))
    const ervArr = (ds.erv || []).map(s => toBool(s))
    const ventFanArr = (ds.vent_fan || []).map(s => toBool(s))
    floorPlanAreaDeviceStates.value = {
      light: lightDevs.map((_, i) => lightArr[i] ?? lightArr[0] ?? false),
      ac: acDevs.map((_, i) => acArr[i] ?? acArr[0] ?? false),
      erv: ervDevs.map((_, i) => ervArr[i] ?? ervArr[0] ?? false),
      vent_fan: ventFanDevs.map((_, i) => ventFanArr[i] ?? ventFanArr[0] ?? false)
    }
    const acItems = ds.ac || []
    const ervItems = ds.erv || []
    const getAcMode = (i) => acItems[i]?.settings?.mode || acItems[i]?.mode || 'off'
    const getAcTemp = (i) => acItems[i]?.settings?.temperature ?? acItems[i]?.temperature ?? 25
    const getErvSpeed = (i) => ervItems[i]?.settings?.speed || ervItems[i]?.speed || 'low'
    const getErvMode = (i) => ervItems[i]?.settings?.mode || ervItems[i]?.mode || 'normal'
    floorPlanAreaDeviceSettings.value = {
      erv: { speed: ervDevs.map((_, i) => getErvSpeed(i)), mode: ervDevs.map((_, i) => getErvMode(i)) },
      ac: { mode: acDevs.map((_, i) => getAcMode(i)), temperature: acDevs.map((_, i) => getAcTemp(i)) }
    }
    floorDeviceStates.value = {
      light: [lightArr.some(Boolean)],
      ac: [acArr.some(Boolean)],
      erv: [ervArr.some(Boolean)],
      vent_fan: [ventFanArr.some(Boolean)]
    }
  } catch (e) {
    console.warn('[Control] loadAreaDeviceStates failed:', e?.message)
  }
}

// Load device states for all rooms in floor plan (สำหรับปุ่มเปิด/ปิดแต่ละห้อง)
const loadAllRoomDeviceStates = async () => {
  const roomIds = Object.values(areaRoomsMap.value).map(room => room.id)
  await Promise.all(roomIds.map(roomId => loadRoomDeviceStates(roomId)))
  const hasAreaDevices = (floorPlanAreaDevices.value.light?.length || 0) + (floorPlanAreaDevices.value.ac?.length || 0) + (floorPlanAreaDevices.value.erv?.length || 0) > 0
  if (hasAreaDevices) {
    await loadAreaDeviceStates()
  }
  loadRoomControlPositions()
}

// Start auto-refresh for room device states
const startRoomStatesAutoRefresh = () => {
  // Clear existing interval if any
  if (roomStatesRefreshInterval.value) {
    clearInterval(roomStatesRefreshInterval.value)
  }
  
  // Set up new interval to refresh every 5 seconds
  roomStatesRefreshInterval.value = setInterval(async () => {
    if (showFloorPlan.value) {
      console.log('Auto-refreshing room device states...')
      await loadAllRoomDeviceStates()
    }
  }, 5000) // Refresh every 5 seconds
}

// Stop auto-refresh for room device states
const stopRoomStatesAutoRefresh = () => {
  if (roomStatesRefreshInterval.value) {
    clearInterval(roomStatesRefreshInterval.value)
    roomStatesRefreshInterval.value = null
  }
}

// Load room control button positions from localStorage
const loadRoomControlPositions = () => {
  if (!selectedBuilding.value || !selectedAreaId.value) return

  const key = `roomControlPositions_${selectedBuilding.value}_${selectedAreaId.value}`
  const saved = localStorage.getItem(key)
  
  // Initialize default positions based on zones
  Object.values(areaRoomsMap.value).forEach(room => {
    // Find area for this room
    const area = floorPlanAreas.value.find(a => areaRoomsMap.value[a.id]?.id === room.id)
    if (area) {
      // Set default positions based on zone
      let buttonLeft = Math.max(0, area.left - 5)
      let buttonTop = area.top + area.height / 2 - 6
      
      if (area.name === 'Zone A') {
        buttonLeft = 0 // Left edge for Zone A (Mercury)
        buttonTop = area.top + area.height / 2 - 6 // Center vertically
      } else if (area.name === 'Zone B') {
        buttonLeft = 30 // Left of Zone B (Earth)
        buttonTop = area.top + area.height / 2 - 6 // Center vertically
      }
      
      // Only use saved position if it exists, otherwise use default
      if (saved) {
        try {
          const savedPositions = JSON.parse(saved)
          if (savedPositions[room.id]) {
            roomControlPositions.value[room.id] = savedPositions[room.id]
            return // Use saved position
          }
        } catch (error) {
          console.error('Error loading room control positions:', error)
        }
      }
      
      // Use default position
      if (!roomControlPositions.value[room.id]) {
        roomControlPositions.value[room.id] = {
          top: buttonTop,
          left: buttonLeft
        }
      }
    }
  })
  
  // Save the default positions if they were just set
  if (!saved) {
    saveRoomControlPositions()
  }
}

// Save room control button positions to localStorage
const saveRoomControlPositions = () => {
  if (!selectedBuilding.value || !selectedAreaId.value) return

  const key = `roomControlPositions_${selectedBuilding.value}_${selectedAreaId.value}`
  localStorage.setItem(key, JSON.stringify(roomControlPositions.value))
}

// Get room control button position (percentage)
const getRoomControlPosition = (roomId) => {
  return roomControlPositions.value[roomId] || { top: 50, left: 50 }
}

// Drag handlers for room control buttons
let currentDragRoomId = null
let dragHandler = null
let dragEndHandler = null

// Start dragging a room control button
const startDragRoomControl = (event, roomId) => {
  if (!floorPlanEditMode.value) return
  
  event.stopPropagation()
  event.preventDefault()
  draggingRoomControl.value = roomId
  currentDragRoomId = roomId
  
  // Get current position of the button (same as area drag)
  const currentPos = getRoomControlPosition(roomId)
  
  dragRoomControlStart.value = {
    x: event.clientX,
    y: event.clientY,
    left: currentPos.left,
    top: currentPos.top,
  }
  
  // Create handlers
  dragHandler = (e) => onDragRoomControl(e)
  dragEndHandler = () => stopDragRoomControl()
  
  document.addEventListener('mousemove', dragHandler)
  document.addEventListener('mouseup', dragEndHandler)
  
  // Prevent text selection
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'grabbing'
}

const onDragRoomControl = (event) => {
  if (!draggingRoomControl.value || !currentDragRoomId) return
  
  const container = document.querySelector('.floor-plan-container')
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  
  // Calculate delta from start position (same as area drag)
  const deltaX = ((event.clientX - dragRoomControlStart.value.x) / containerRect.width) * 100
  const deltaY = ((event.clientY - dragRoomControlStart.value.y) / containerRect.height) * 100
  
  // Calculate new position (start position + delta)
  let left = dragRoomControlStart.value.left + deltaX
  let top = dragRoomControlStart.value.top + deltaY
  
  // Allow full range of movement (no strict constraints)
  // Only prevent going too far outside container
  left = Math.max(-5, Math.min(100, left))
  top = Math.max(-5, Math.min(100, top))
  
  roomControlPositions.value[currentDragRoomId] = {
    top: top,
    left: left
  }
}

const stopDragRoomControl = () => {
  if (draggingRoomControl.value) {
    saveRoomControlPositions()
    draggingRoomControl.value = null
    currentDragRoomId = null
  }
  
  if (dragHandler) {
    document.removeEventListener('mousemove', dragHandler)
    dragHandler = null
  }
  if (dragEndHandler) {
    document.removeEventListener('mouseup', dragEndHandler)
    dragEndHandler = null
  }
  
  // Restore cursor and selection
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

const closeSystemControlDialog = () => {
  showConfirmSystemControlDialog.value = false
  showSystemControlDialog.value = false
  systemControlAction.value = null
  systemControlTargetRoomId.value = null
}

const closeConfirmSystemControlDialog = () => {
  showConfirmSystemControlDialog.value = false
  systemControlAction.value = null
}

// Function to check device states for all rooms in floor/area
const checkFloorDeviceStates = async () => {
  try {
    const buildingId = selectedBuilding.value
    const floorNumber = selectedFloor.value
    const areaId = selectedAreaId.value
    const areaName = selectedArea.value?.name

    if (!buildingId) {
      floorDeviceStates.value = { light: [], ac: [], erv: [], vent_fan: [] }
      return
    }
    
    // Ensure areas are loaded
    if (areas.value.length === 0) {
      try {
        const areasResponse = await api.get('/areas')
        areas.value = areasResponse.data.data || []
      } catch (error) {
        console.error('Error fetching areas:', error)
      }
    }
    
    // Log all areas for debugging
    console.log('All areas:', areas.value.map(a => ({
      id: a.id,
      name: a.name,
      building_id: a.building_id,
      floor: a.floor
    })))
    
    // Fetch all rooms
    const response = await api.get('/rooms')
    const allRooms = response.data.data || response.data || []
    
    console.log(`Total rooms from API: ${allRooms.length}`)
    console.log('All rooms:', allRooms.map(r => ({ 
      id: r.id, 
      name: r.name, 
      building_id: r.building_id, 
      floor: r.floor,
      area_id: r.area_id 
    })))
    console.log(`Looking for building_id: ${buildingId} (type: ${typeof buildingId}), floor: ${floorNumber} (type: ${typeof floorNumber})`)
    
    // ข้อมูล floor ดึงจากตาราง areas คอลัมน์ floor เท่านั้น
    const buildingIdStr = String(buildingId)
    const floorNumberStr = String(floorNumber)
    let targetRooms
    if (areaId != null) {
      targetRooms = allRooms.filter(room => Number(room.area_id) === Number(areaId))
      console.log(`Found ${targetRooms.length} rooms in Area ID ${areaId} (${areaName || ''})`)
    } else {
      const currentFloorAreaIds = areas.value
        .filter(a => String(a.building_id) === buildingIdStr && String(a.floor) === floorNumberStr)
        .map(a => a.id)
      targetRooms = allRooms.filter(room => currentFloorAreaIds.includes(room.area_id))
      console.log(`Found ${targetRooms.length} rooms in Building ${buildingId}, Floor ${floorNumber} (from areas.floor)`)
    }
    
    console.log(`Checking device states for ${targetRooms.length} rooms in Building ${buildingId}, Floor ${floorNumber}${areaName ? `, Area ${areaName}` : ''}`)
    console.log('Target rooms:', targetRooms.map(r => ({ id: r.id, name: r.name, area_id: r.area_id })))
    
    // Fetch device states for all rooms
    const deviceStatePromises = targetRooms.map(async (room) => {
      try {
        const devicesResponse = await api.get(`/rooms/${room.id}/devices`)
        const devices = devicesResponse.data.data || devicesResponse.data || {}
        const deviceStates = devices.deviceStates || {}
        console.log(`Room ${room.id} (${room.name}) device states:`, {
          light: deviceStates.light?.map(l => ({ status: l?.status, raw: l })),
          ac: deviceStates.ac?.map(a => ({ status: a?.status, raw: a })),
          erv: deviceStates.erv?.map(e => ({ status: e?.status, raw: e })),
          vent_fan: deviceStates.vent_fan?.map(f => ({ status: f?.status, raw: f })),
        })
        
        // Debug: Show actual status values
        if (deviceStates.light) {
          const lightStatuses = deviceStates.light.map(l => l?.status)
          console.log(`  Light actual statuses:`, lightStatuses)
          console.log(`  Light has any ON:`, lightStatuses.some(s => s === true || s === 1 || s === 'on'))
        }
        if (deviceStates.ac) {
          const acStatuses = deviceStates.ac.map(a => a?.status)
          console.log(`  AC actual statuses:`, acStatuses)
          console.log(`  AC has any ON:`, acStatuses.some(s => s === true || s === 1 || s === 'on'))
        }
        if (deviceStates.erv) {
          const ervStatuses = deviceStates.erv.map(e => e?.status)
          console.log(`  ERV actual statuses:`, ervStatuses)
          console.log(`  ERV has any ON:`, ervStatuses.some(s => s === true || s === 1 || s === 'on'))
        }
        return deviceStates
      } catch (error) {
        console.error(`Error fetching devices for room ${room.id}:`, error)
        return { light: [], ac: [], erv: [], vent_fan: [] }
      }
    })
    
    const allDeviceStates = await Promise.all(deviceStatePromises)
    
    // Aggregate all device states - check if ANY device is on
    const aggregatedStates = {
      light: [],
      ac: [],
      erv: [],
      vent_fan: []
    }
    
    // Check if any device is on across all rooms
    let hasAnyLightOn = false
    let hasAnyAcOn = false
    let hasAnyErvOn = false
    let hasAnyVentFanOn = false
    
    allDeviceStates.forEach(roomStates => {
      // Check light devices
      if (roomStates.light && Array.isArray(roomStates.light)) {
        const hasLightOn = roomStates.light.some(light => {
          const s = light?.status ?? light
          return s === true || s === 1 || s === 'on'
        })
        hasAnyLightOn = hasAnyLightOn || hasLightOn
      }
      
      // Check AC devices
      if (roomStates.ac && Array.isArray(roomStates.ac)) {
        const hasAcOn = roomStates.ac.some(ac => {
          const s = ac?.status ?? ac
          return s === true || s === 1 || s === 'on'
        })
        hasAnyAcOn = hasAnyAcOn || hasAcOn
      }
      
      // Check ERV devices
      if (roomStates.erv && Array.isArray(roomStates.erv)) {
        const hasErvOn = roomStates.erv.some(erv => {
          const s = erv?.status ?? erv
          return s === true || s === 1 || s === 'on'
        })
        hasAnyErvOn = hasAnyErvOn || hasErvOn
      }
      
      if (roomStates.vent_fan && Array.isArray(roomStates.vent_fan)) {
        const hasVentFanOn = roomStates.vent_fan.some(fan => {
          const s = fan?.status ?? fan
          return s === true || s === 1 || s === 'on'
        })
        hasAnyVentFanOn = hasAnyVentFanOn || hasVentFanOn
      }
    })
    
    // Set aggregated states - use array with at least one element to indicate status
    aggregatedStates.light = [hasAnyLightOn]
    aggregatedStates.ac = [hasAnyAcOn]
    aggregatedStates.erv = [hasAnyErvOn]
    aggregatedStates.vent_fan = [hasAnyVentFanOn]
    
    floorDeviceStates.value = aggregatedStates
    // Init floorPlanAreaDeviceStates จาก floorDeviceStates เมื่อมี area devices และยังไม่มีข้อมูล
    const lightDevs = floorPlanAreaDevices.value.light || []
    const acDevs = floorPlanAreaDevices.value.ac || []
    const ervDevs = floorPlanAreaDevices.value.erv || []
    const ventFanDevs = floorPlanAreaDevices.value.vent_fan || []
    const hasLight = aggregatedStates.light?.[0] ?? false
    const hasAc = aggregatedStates.ac?.[0] ?? false
    const hasErv = aggregatedStates.erv?.[0] ?? false
    const hasVentFan = aggregatedStates.vent_fan?.[0] ?? false
    const needInit = lightDevs.length > 0 || acDevs.length > 0 || ervDevs.length > 0 || ventFanDevs.length > 0
    const current = floorPlanAreaDeviceStates.value
    const lightLen = (current.light || []).length
    const acLen = (current.ac || []).length
    const ervLen = (current.erv || []).length
    const ventFanLen = (current.vent_fan || []).length
    if (needInit && (lightLen < lightDevs.length || acLen < acDevs.length || ervLen < ervDevs.length || ventFanLen < ventFanDevs.length)) {
      floorPlanAreaDeviceStates.value = {
        light: lightDevs.map(() => hasLight),
        ac: acDevs.map(() => hasAc),
        erv: ervDevs.map(() => hasErv),
        vent_fan: ventFanDevs.map(() => hasVentFan)
      }
    }
    console.log('Floor device states:', floorDeviceStates.value)
    console.log(`Has any device on - Light: ${hasAnyLightOn}, AC: ${hasAnyAcOn}, ERV: ${hasAnyErvOn}, VentFan: ${hasVentFan}`)
    console.log('allSystemsOn will be:', hasAnyLightOn || hasAnyAcOn || hasAnyErvOn || hasVentFan)
    console.log('Total rooms checked:', targetRooms.length)
  } catch (error) {
    console.error('Error checking floor device states:', error)
    floorDeviceStates.value = { light: [], ac: [], erv: [], vent_fan: [] }
  }
}

const confirmSystemControl = async () => {
  if (!systemControlAction.value) return
  
  systemControlLoading.value = true
  
  try {
    const buildingId = selectedBuilding.value
    const floorNumber = selectedFloor.value
    const areaId = selectedAreaId.value
    const areaName = selectedArea.value?.name
    const isTurningOn = systemControlAction.value === 'turnOn'

    let targetRooms = []

    if (systemControlTargetRoomId.value) {
      const targetRoom = Object.values(areaRoomsMap.value).find(room => room?.id === systemControlTargetRoomId.value)
      if (targetRoom) {
        targetRooms = [targetRoom]
        console.log(`Targeting specific room: ${targetRoom.name} (ID: ${targetRoom.id})`)
      } else {
        console.warn(`Target room with ID ${systemControlTargetRoomId.value} not found`)
      }
    } else {
      const response = await api.get('/rooms')
      const allRooms = response.data.data || response.data || []
      if (areaId != null) {
        targetRooms = allRooms.filter(room => Number(room.area_id) === Number(areaId))
      } else {
        const currentFloorAreaIds = areas.value
          .filter(a => Number(a.building_id) === Number(buildingId) && Number(a.floor) === Number(floorNumber))
          .map(a => a.id)
        targetRooms = allRooms.filter(room => currentFloorAreaIds.includes(room.area_id))
      }
      console.log(`Found ${targetRooms.length} rooms in Building ${buildingId}${areaId != null ? `, Area ${areaId} (${areaName || ''})` : `, Floor ${floorNumber}`}`)
    }
    
    // Control all systems (light, ac, erv) for each room
    const controlPromises = []
    const action = isTurningOn ? 'on' : 'off'
    
    for (const room of targetRooms) {
      const roomId = Number(room.id)
      const isHARoom = roomId === 28 // ห้อง Mercury ที่ใช้ Home Assistant
      
      if (isHARoom) {
        console.log(`[System Control] Room ${roomId} is HA room - using Home Assistant API directly`)
      }
      
      // Control Light
      controlPromises.push(
        (async () => {
          try {
            await api.post(`/rooms/${room.id}/devices/light`, { status: isTurningOn })
            if (isHARoom) {
              console.log(`[System Control] Calling HA Light API: ${action}`)
              await api.post(`/devices/light/${HA_LIGHT_ENTITY_ID}/control`, { action })
            }
          } catch (err) {
            console.error(`Error controlling light in room ${room.id}:`, err)
          }
        })()
      )
      
      // Control AC
      controlPromises.push(
        (async () => {
          try {
            await api.post(`/rooms/${room.id}/devices/ac`, { status: isTurningOn })
            if (isHARoom) {
              console.log(`[System Control] Calling HA AC API: ${action}`)
              const payload = { action }
              if (isTurningOn) {
                payload.temperature = 25
                payload.hvac_mode = 'cool'
              }
              await api.post(`/devices/air/${HA_AIR_DEVICE_ID}/control`, payload)
            }
          } catch (err) {
            console.error(`Error controlling AC in room ${room.id}:`, err)
          }
        })()
      )
      
      // Control ERV
      controlPromises.push(
        (async () => {
          try {
            await api.post(`/rooms/${room.id}/devices/erv`, { status: isTurningOn })
            if (isHARoom) {
              console.log(`[System Control] Calling HA ERV API: ${action}`)
              await api.post(`/devices/erv/${HA_ERV_DEVICE_ID}/control`, { action })
            }
          } catch (err) {
            console.error(`Error controlling ERV in room ${room.id}:`, err)
          }
        })()
      )
    }
    
    // Wait for all control operations to complete
    const results = await Promise.allSettled(controlPromises)
    
    // Count successes and failures
    const successes = results.filter(r => r.status === 'fulfilled').length
    const failures = results.filter(r => r.status === 'rejected').length
    
    console.log(`Control results: ${successes} succeeded, ${failures} failed`)
    console.log(`Successfully ${isTurningOn ? 'turned on' : 'turned off'} all systems in ${targetRooms.length} rooms`)
    
    // Wait a bit for backend to process
    console.log('Waiting 1 second for backend to process...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Refresh device states after control
    console.log('Refreshing device states...')
    await checkFloorDeviceStates()
    
    // Refresh device states for all rooms in floor plan
    console.log('Refreshing room device states...')
    await loadAllRoomDeviceStates()

    // If currently viewing a specific room, reload its device states too.
    // Otherwise the control panel (VSwitch) can stay stale even if HA/DB changed.
    if (selectedRoomId.value) {
      console.log('Reloading selected room device states...')
      await loadRoomDevices()
    }
    
    // Close all dialogs
    closeConfirmSystemControlDialog()
    closeSystemControlDialog()
  } catch (error) {
    console.error('Error controlling all systems:', error)
    // You can add error handling/toast here
  } finally {
    systemControlLoading.value = false
  }
}

watch(selectedRoomId, () => {
  if (selectedRoomId.value) {
    loadRoomDevices()
    loadEnergyData()
  }
})

watch(energyPeriod, () => {
  if (energyPeriod.value !== 'custom') loadEnergyData()
})

watch(() => route.query, async () => {
  console.log('Route query changed:', route.query)
  console.log('showFloorPlan:', showFloorPlan.value)
  console.log('showRoomControl:', showRoomControl.value)
  
  if (showBuildingList.value) {
    selectedRoomId.value = null
    await fetchBuildings()
  } else if (showRoomControl.value) {
    await fetchBuildings()
    
    const resolvedRoomId = resolveRoomIdFromQuery()
    if (resolvedRoomId) {
      const numId = Number(resolvedRoomId)
      if (selectedRoomId.value !== numId) {
        selectedRoomId.value = numId
        await nextTick()
      }
    } else if (selectedAreaId.value && selectedArea.value) {
      const areaRooms = roomsWithPositionInArea.value
      if (areaRooms.length > 0) {
        const currentRoomInArea = areaRooms.find(r => Number(r.id) === Number(selectedRoomId.value))
        if (!currentRoomInArea) {
          const firstRoomId = Number(areaRooms[0].id)
          selectedRoomId.value = firstRoomId
          router.replace({
            query: { ...route.query, room: firstRoomId },
          })
          await nextTick()
        }
      } else {
        const fallbackRoomId = resolveRoomIdFromAreaOnly()
        if (fallbackRoomId) {
          selectedRoomId.value = Number(fallbackRoomId)
          await nextTick()
        }
      }
    }

  } else if (showFloorPlan.value) {
    selectedRoomId.value = null
    await fetchBuildings()
    await loadFloorPlanAreas()
    await loadFloorPlanPeopleCount()
    // Use nextTick to ensure DOM is ready
    await nextTick()
    const hasAreaDevices = (floorPlanAreaDevices.value.light?.length || 0) + (floorPlanAreaDevices.value.ac?.length || 0) + (floorPlanAreaDevices.value.erv?.length || 0) > 0
    if (!hasAreaDevices) {
      await checkFloorDeviceStates()
    }
    await loadAllRoomDeviceStates()
    startRoomStatesAutoRefresh()
    startPeopleCountAutoRefresh()
  } else {
    // Stop auto-refresh when not in floor plan view
    stopRoomStatesAutoRefresh()
    stopPeopleCountAutoRefresh()
  }
}, { immediate: true })

// โหลดรายการประเภทอุปกรณ์จาก API (เพื่อแสดง icon/label ล่าสุด รวมถึงอุปกรณ์ใหม่)
const fetchDeviceTypes = async () => {
  try {
    const res = await api.get('/devices/types')
    if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length) {
      controllableDeviceTypes.value = res.data.data
      // ให้ controls มี key สำหรับทุก type ที่ API ส่งมา (รองรับอุปกรณ์ใหม่)
      res.data.data.forEach(dt => {
        if (controls[dt.key] === undefined) {
          controls[dt.key] = false
        }
      })
    }
  } catch (e) {
    console.warn('[Control] Could not fetch device types, using defaults:', e?.message)
  }
}

onMounted(async () => {
  fetchDeviceTypes()
})

onBeforeUnmount(() => {
  // Stop sensor data auto-refresh
  stopSensorDataAutoRefresh()
  
  // Destroy chart instance when component is unmounted
  if (co2ChartInstance.value) {
    try {
    co2ChartInstance.value.destroy()
    } catch (error) {
      console.warn('Error destroying chart on unmount:', error)
    }
    co2ChartInstance.value = null
  }
  
  // Clean up drag event listeners
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  
  // Clean up floor plan edit listeners
  document.removeEventListener('mousemove', onResizeArea)
  document.removeEventListener('mouseup', stopResizeArea)
  document.removeEventListener('mousemove', onDragArea)
  document.removeEventListener('mouseup', stopDragArea)
  
  // Stop auto-refresh interval
  stopRoomStatesAutoRefresh()
  stopPeopleCountAutoRefresh()
})
</script>

<template>
  <div class="room-control-wrapper">
    <!-- Building List View -->
    <div v-if="showBuildingList">
    <!-- Page Header -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <div class="d-flex align-center gap-3">
                <VIcon
                  icon="tabler-sliders"
                  size="32"
                  color="primary"
                />
                <h4 class="text-h4 mb-0">
                  ระบบควบคุมห้อง
                </h4>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

      <!-- Buildings Grid -->
      <VRow>
        <VCol
          v-for="building in filteredBuildings"
          :key="building.id"
          cols="12"
          md="6"
          lg="4"
        >
          <VCard class="building-card">
            <div class="building-image-wrapper">
              <VImg
                :src="buildingImageSrc(building)"
                height="200"
                cover
                class="building-image"
              />
            </div>
            
            <VCardTitle class="d-flex align-center">
              <VIcon
                icon="tabler-building"
                class="me-2"
              />
              {{ building.name }}
            </VCardTitle>
            
            <VCardText>
              <div class="text-body-2 text-disabled mb-3">
                {{ getAreasForBuilding(building.id).length }} โซน
              </div>
              
              <div class="floors-list">
                <div
                  v-for="area in getAreasForBuilding(building.id)"
                  :key="area.id"
                  class="floor-item"
                  @click="selectAreaById(building.id, area.id)"
                >
                  <VIcon
                    icon="tabler-layers"
                    size="20"
                    color="primary"
                    class="me-2"
                  />
                  <span class="floor-label">{{ area.name || `Area ${area.id}` }}</span>
                  <VSpacer />
                  <VChip
                    size="small"
                    color="primary"
                    variant="tonal"
                  >
                    {{ getRoomCountInArea(area.id) }} Room{{ getRoomCountInArea(area.id) !== 1 ? 's' : '' }}
                  </VChip>
                  <VIcon
                    icon="tabler-chevron-right"
                    size="20"
                    class="ms-2"
                  />
                </div>
                
                <div
                  v-if="getAreasForBuilding(building.id).length === 0"
                  class="text-center py-4 text-disabled"
                >
                  <VIcon
                    icon="tabler-info-circle"
                    size="20"
                    class="me-1"
                  />
                  ไม่มีโซนในอาคารนี้
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        
        <!-- No Buildings -->
        <VCol
          v-if="!loading && filteredBuildings.length === 0"
          cols="12"
        >
          <VCard>
            <VCardText class="text-center py-12">
              <VIcon
                icon="tabler-building"
                size="80"
                color="primary"
                class="mb-4"
              />
              <h5 class="text-h5 mb-2">
                ไม่พบข้อมูลอาคาร
              </h5>
              <p class="text-body-2 text-disabled">
                กรุณาเพิ่มข้อมูลอาคารก่อนใช้งานระบบควบคุม
              </p>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </div>

    <!-- Floor Plan View -->
    <div v-else-if="showFloorPlan">
      <!-- Page Header -->
    <VRow class="mb-4">
        <VCol cols="12">
          <VCard>
            <VCardText>
              <!-- Dropdown Filters -->
              <VRow class="mb-4">
                <VCol
                  cols="12"
                  md="4"
                >
                  <VSelect
                    v-model="selectedBuilding"
                    :items="filteredBuildings.map(b => ({ value: b.id, title: b.name }))"
                    item-title="title"
                    item-value="value"
                    label="เลือกตึก"
                    density="compact"
                    variant="outlined"
                    @update:model-value="handleBuildingChange"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <VSelect
                    v-model="selectedAreaId"
                    :items="availableAreas"
                    item-title="title"
                    item-value="value"
                    label="เลือกโซน (Area)"
                    density="compact"
                    variant="outlined"
                    :disabled="!selectedBuilding"
                    @update:model-value="handleAreaChange"
                  >
                    <template #selection>
                      {{ selectedAreaDisplayName || selectedAreaId }}
                    </template>
                  </VSelect>
                </VCol>
                <VCol
                  v-if="selectedAreaId"
                  cols="12"
                  md="4"
                >
                  <VSelect
                    v-model="selectedRoomId"
                    :items="availableRooms"
                    item-title="title"
                    item-value="value"
                    label="เลือกห้อง"
                    density="compact"
                    variant="outlined"
                    :disabled="!selectedBuilding || !selectedAreaId"
                    clearable
                    @update:model-value="handleRoomChange"
                  >
                    <template #selection>
                      {{ selectedRoomTitle }}
                    </template>
                  </VSelect>
                </VCol>
              </VRow>

              <div class="d-flex align-center justify-space-between">
                <div class="d-flex align-center gap-3">
                  <VBtn
                    icon
                    variant="text"
                    @click="backToBuildings"
                  >
                    <VIcon icon="tabler-arrow-left" />
                  </VBtn>
                  <div class="d-flex align-center gap-3">
                    <VIcon
                      icon="tabler-map"
                      size="32"
                      color="primary"
                    />
                    <div>
                      <h4 class="text-h4 mb-0">
                  {{ selectedAreaDisplayName }}
                      </h4>
                      <div class="text-caption text-disabled">
                        <span v-if="!floorPlanEditMode"></span>
                        <span v-else>โหมดแก้ไข: ปรับขนาด, ลาก, เพิ่ม/ลบ Area</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="d-flex align-center gap-2">
                  <VBtn
                    v-if="!floorPlanEditMode && isSuperAdmin"
                    color="primary"
                    variant="outlined"
                    prepend-icon="tabler-edit"
                    @click="toggleFloorPlanEditMode"
                  >
                    แก้ไข
                  </VBtn>
                  <template v-else-if="floorPlanEditMode">
                    <VBtn
                      color="success"
                      variant="elevated"
                      prepend-icon="tabler-plus"
                      @click="addArea"
                    >
                      เพิ่ม Area
                    </VBtn>
                    <VBtn
                      color="primary"
                      variant="elevated"
                      prepend-icon="tabler-device-floppy"
                      :loading="saveFloorPlanLoading"
                      :disabled="saveFloorPlanLoading"
                      @click="saveFloorPlanAreas"
                    >
                      บันทึก
                    </VBtn>
                    <VBtn
                      color="default"
                      variant="outlined"
                      prepend-icon="tabler-x"
                      @click="toggleFloorPlanEditMode"
                    >
                      ยกเลิก
                    </VBtn>
                  </template>
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Floor Plan -->
      <VRow>
        <VCol cols="12">
          <VCard class="floor-plan-card">
            <VCardText class="pa-6">
              <div class="floor-plan-container">
                <img
                  v-if="floorPlanImageDisplay"
                  :src="floorPlanImageDisplay"
                  alt="Floor Plan"
                  class="floor-plan-image"
                />

                <div
                  v-else
                  style="width: 100%; min-height: 240px; display: flex; align-items: center; justify-content: center; color: rgba(0,0,0,0.55); background: rgba(245,245,245,0.6);"
                >
                  ไม่พบรูป Floor Plan ในฐานข้อมูล
                </div>
                
                <!-- Areas Overlay — แสดง area-box ที่มี x1,y1,x2,y2 จาก DB หรือ virtual area (อุปกรณ์ area_id) -->
                <div class="areas-overlay">
                  <div
                    v-for="area in floorPlanAreas.filter(a => a.hasPositionFromDb || (typeof a.id === 'string' && a.id.startsWith('area-')))"
                    :key="area.id"
                    class="area-box"
                    :class="{
                      'area-box-clickable': !floorPlanEditMode,
                      'area-box-editing': floorPlanEditMode && !(typeof area.id === 'string' && area.id.startsWith('area-')),
                    }"
                    :style="{
                      top: area.top + '%',
                      left: area.left + '%',
                      width: area.width + '%',
                      height: area.height + '%',
                    }"
                    @click="!floorPlanEditMode && selectArea(area.name, area.id)"
                    @mousedown="floorPlanEditMode && !(typeof area.id === 'string' && area.id.startsWith('area-')) && startDragArea($event, area.id)"
                  >
                    <!-- Resize Handle (ซ่อนสำหรับ virtual area) -->
                    <div
                      v-if="floorPlanEditMode && !(typeof area.id === 'string' && area.id.startsWith('area-'))"
                      class="area-resize-handle"
                      @mousedown.stop="startResizeArea($event, area.id)"
                    >
                      <VIcon
                        icon="tabler-arrows-diagonal"
                        size="16"
                      />
                    </div>
                    
                    <!-- Delete Button (ซ่อนสำหรับ virtual area) -->
                    <VBtn
                      v-if="floorPlanEditMode && !(typeof area.id === 'string' && area.id.startsWith('area-'))"
                      icon
                      size="x-small"
                      color="error"
                      variant="elevated"
                      class="area-delete-btn"
                      @click.stop="deleteArea(area.id)"
                    >
                      <VIcon icon="tabler-x" size="16" />
                    </VBtn>
                    
                    <!-- Area Label -->
                    <div class="area-label">
                      <div
                        v-if="floorPlanEditMode && !(typeof area.id === 'string' && area.id.startsWith('area-')) && editingAreaName === area.id"
                        class="area-name-edit"
                      >
                        <VTextField
                          v-model="editingAreaNameValue"
                          density="compact"
                          variant="outlined"
                          hide-details
                          class="area-name-input"
                          @keyup.enter="saveAreaName(area.id)"
                          @keyup.esc="cancelEditAreaName"
                          @blur="saveAreaName(area.id)"
                        />
                      </div>
                      <div
                        v-else
                        class="text-h6 font-weight-bold area-name-display"
                        :class="{ 'area-name-editable': floorPlanEditMode && !(typeof area.id === 'string' && area.id.startsWith('area-')) }"
                        @dblclick="floorPlanEditMode && !(typeof area.id === 'string' && area.id.startsWith('area-')) && startEditAreaName(area.id)"
                      >
                        {{ areaRoomsMap[area.id]?.name || area.name }}
                        <VIcon
                          v-if="floorPlanEditMode && !(typeof area.id === 'string' && area.id.startsWith('area-'))"
                          icon="tabler-pencil"
                          size="14"
                          class="ms-1 area-edit-icon"
                        />
                      </div>
                      <div
                        v-if="floorPlanEditMode"
                        class="text-caption text-disabled mt-1"
                      >
                        {{ Math.round(area.width) }}% × {{ Math.round(area.height) }}%
                      </div>
                      <!-- ปุ่มควบคุมระบบห้อง (เมื่อ area มีห้องและไม่ใช่โหมดแก้ไข) -->
                      <VBtn
                        v-if="!floorPlanEditMode && areaRoomsMap[area.id]"
                        size="small"
                        :color="isRoomSystemsOn(areaRoomsMap[area.id].id) ? 'warning' : 'default'"
                        variant="elevated"
                        class="area-power-btn mt-2"
                        prepend-icon="tabler-power"
                        @click.stop="toggleRoomSystemControl(areaRoomsMap[area.id].id)"
                      >
                        ควบคุม
                      </VBtn>
                    </div>
                  </div>
                </div>

                <div
                  v-if="peopleCountBadgePosition && floorPlanPeopleCountEnabled"
                  class="people-count-overlay-badge"
                  :style="{ left: peopleCountBadgePosition.left + '%', top: peopleCountBadgePosition.top + '%' }"
                >
                  <VIcon icon="tabler-users" size="20" class="me-2" />
                  <span class="text-h5 font-weight-bold">{{ floorPlanPeopleCount ?? '—' }}</span>
                  <span class="text-body-2 ms-1">คน</span>
                </div>

                <!-- Area Device Icons Overlay — แสดง icon ไฟ/แอร์/ERV บน floor plan ตามตำแหน่ง x,y จากอุปกรณ์ area_id -->
                <div class="floor-plan-devices-overlay">
                  <div
                    v-for="(dev, idx) in floorPlanAreaDevices.light"
                    :key="'light-' + dev.id"
                    class="device-icon light-icon floor-plan-device-icon"
                    :class="{ active: getFloorPlanAreaDeviceState('light', idx) }"
                    :style="{ left: dev.x + '%', top: dev.y + '%' }"
                    :title="getFloorPlanAreaDeviceState('light', idx) ? 'ไฟ: เปิด' : 'ไฟ: ปิด'"
                    @click.stop="handleFloorPlanDeviceClick('light', idx)"
                  >
                    <div class="icon-circle">
                      <VIcon icon="tabler-bulb" />
                    </div>
                  </div>
                  <div
                    v-for="(dev, idx) in floorPlanAreaDevices.ac"
                    :key="'ac-' + dev.id"
                    class="device-icon ac-icon floor-plan-device-icon"
                    :class="{ active: getFloorPlanAreaDeviceState('ac', idx) }"
                    :style="{ left: dev.x + '%', top: dev.y + '%' }"
                    :title="getFloorPlanAreaDeviceState('ac', idx) ? `แอร์: เปิด (${getFloorPlanAreaACModeLabel(idx)})` : 'แอร์: ปิด'"
                    @click.stop="handleFloorPlanDeviceClick('ac', idx)"
                  >
                    <div class="icon-circle">
                      <VIcon :icon="getFloorPlanAreaACIcon(idx)" />
                      <span class="icon-label">A/C</span>
                    </div>
                  </div>
                  <div
                    v-for="(dev, idx) in floorPlanAreaDevices.erv"
                    :key="'erv-' + dev.id"
                    class="device-icon erv-icon floor-plan-device-icon"
                    :class="{
                      'active': getFloorPlanAreaDeviceState('erv', idx),
                      'rotating': getFloorPlanAreaDeviceState('erv', idx),
                      'rotating-high': getFloorPlanAreaDeviceState('erv', idx) && getFloorPlanAreaErvSpeed(idx) === 'high',
                    }"
                    :style="{ left: dev.x + '%', top: dev.y + '%' }"
                    :title="getFloorPlanAreaDeviceState('erv', idx) ? 'ERV: เปิด' : 'ERV: ปิด'"
                    @click.stop="handleFloorPlanDeviceClick('erv', idx)"
                  >
                    <div class="icon-circle">
                      <img :src="fanImage" alt="ERV" class="erv-fan-icon" />
                    </div>
                    <!-- Mode Badge (เหมือนหน้า room) -->
                    <div
                      v-if="getFloorPlanAreaDeviceState('erv', idx)"
                      class="erv-mode-badge"
                      :class="getFloorPlanAreaErvMode(idx) === 'heat' ? 'heat-mode' : 'normal-mode'"
                    >
                      <VIcon
                        v-if="getFloorPlanAreaErvMode(idx) === 'heat'"
                        icon="tabler-arrows-left-right"
                        size="16"
                        title="โหมด Heat"
                      />
                      <VIcon
                        v-else
                        icon="tabler-arrow-big-up-lines"
                        size="16"
                        title="โหมด Normal"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div class="text-center mt-6">
                <VChip
                  color="info"
                  variant="tonal"
                  size="large"
                >
                  <VIcon
                    icon="tabler-hand-click"
                    class="me-2"
                  />
                  คลิกที่ Area เพื่อควบคุมอุปกรณ์ภายในห้อง
                </VChip>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </div>

    <!-- Room Control Panel View -->
    <div v-else>
      <VRow class="mb-4">
        <VCol cols="12">
          <VCard>
            <VCardText>
              <!-- Dropdown Filters -->
              <VRow class="mb-4">
                <VCol
                  cols="12"
                  md="4"
                >
                  <VSelect
                    v-model="selectedBuilding"
                    :items="filteredBuildings.map(b => ({ value: b.id, title: b.name }))"
                    item-title="title"
                    item-value="value"
                    label="เลือกตึก"
                    density="compact"
                    variant="outlined"
                    @update:model-value="handleBuildingChange"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="4"
                >
                  <VSelect
                    v-model="selectedAreaId"
                    :items="availableAreas"
                    item-title="title"
                    item-value="value"
                    label="เลือกโซน (Area)"
                    density="compact"
                    variant="outlined"
                    :disabled="!selectedBuilding"
                    @update:model-value="handleAreaChange"
                  >
                    <template #selection>
                      {{ selectedAreaDisplayName || selectedAreaId }}
                    </template>
                  </VSelect>
                </VCol>
                <VCol
                  v-if="selectedAreaId"
                  cols="12"
                  md="4"
                >
                  <VSelect
                    v-model="selectedRoomId"
                    :items="availableRooms"
                    item-title="title"
                    item-value="value"
                    label="เลือกห้อง"
                    density="compact"
                    variant="outlined"
                    :disabled="!selectedBuilding || !selectedAreaId"
                    clearable
                    @update:model-value="handleRoomChange"
                  >
                    <template #selection>
                      {{ selectedRoomTitle }}
                    </template>
                  </VSelect>
                </VCol>
              </VRow>

              <div class="d-flex align-center gap-3">
                <VBtn
                  icon
                  variant="text"
                  @click="backToFloorPlan"
                >
                  <VIcon icon="tabler-arrow-left" />
                </VBtn>
                <div class="d-flex align-center gap-3">
                  <VIcon
                    icon="tabler-sliders"
                    size="32"
                    color="primary"
                  />
                  <div>
                    <h4 class="text-h4 mb-0">
                      {{ (selectedRoom?.name || selectedRoomTitle) || (selectedAreaDisplayName + ' Control') }}
                    </h4>
                    <div class="text-caption text-disabled">
                      {{ selectedAreaDisplayName }}
                    </div>
                  </div>
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Room Selection -->
      <VRow
        v-if="false"
        class="mb-4"
      >
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-door-open"
              class="me-2"
            />
            เลือกห้อง
          </VCardTitle>
          <VCardText>
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <AppSelect
                  v-model="selectedRoomId"
                  label="ห้องที่มีระบบควบคุม"
                  :items="rooms.map(r => ({ title: r.name, value: r.id }))"
                  placeholder="กรุณาเลือกห้อง"
                  @update:model-value="loadRoomDevices"
                />
                <div class="text-caption text-disabled mt-2">
                  <VIcon
                    icon="tabler-info-circle"
                    size="14"
                    class="me-1"
                  />
                  ระบบควบคุมทำงานเฉพาะห้อง Mercury เท่านั้น
                </div>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Control Panel -->
    <VRow
      v-if="selectedRoomId"
      class="mb-4"
    >
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-settings"
              class="me-2"
            />
            แผงควบคุม
          </VCardTitle>
          <VCardText>
            <VRow>
              <VCol
                v-for="dt in controllableDeviceTypes"
                :key="dt.key"
                cols="12"
                :md="12 / Math.max(1, controllableDeviceTypes.length)"
              >
                <VCard
                  v-if="controls[dt.key] !== undefined"
                  variant="outlined"
                >
                  <VCardText>
                    <div class="d-flex align-center justify-space-between mb-2">
                      <div class="d-flex align-center gap-2">
                        <VIcon
                          :icon="dt.icon"
                          size="24"
                        />
                        <span class="text-h6">{{ dt.label }}</span>
                      </div>
                      <VSwitch
                        :model-value="controls[dt.key]"
                        @update:model-value="(val) => { controls[dt.key] = val; toggleControl(dt.key); }"
                      />
                    </div>
                    <div
                      class="text-body-2"
                      :class="controls[dt.key] ? 'text-success' : 'text-disabled'"
                    >
                      {{ getControlStatus(dt.key) }}
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Room Layout Map -->
    <VRow
      v-if="selectedRoomId"
      class="mb-4"
    >
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-layout"
                class="me-2"
              />
              แผนผังห้อง
            </div>
            <div class="d-flex gap-2">
              <VBtn
                v-if="isSuperAdmin"
                variant="outlined"
                color="secondary"
                size="small"
                :disabled="!selectedRoomId"
                @click="saveDevicePositions"
              >
                <VIcon icon="tabler-device-floppy" class="me-2" />
                บันทึกตำแหน่ง
              </VBtn>
              <VBtn
                v-if="isSuperAdmin"
                :variant="editMode ? 'flat' : 'outlined'"
                :color="editMode ? 'error' : 'primary'"
                size="small"
                @click="toggleEditMode"
              >
                <VIcon
                  :icon="editMode ? 'tabler-pencil-off' : 'tabler-pencil'"
                  class="me-2"
                />
                {{ editMode ? 'ปิดโหมดแก้ไข' : 'โหมดแก้ไข' }}
              </VBtn>
            </div>
          </VCardTitle>
          <VCardText>
            <div class="room-layout-container">
              <div
                ref="roomLayout"
                class="room-layout"
                :style="{ backgroundImage: `url('${roomBackgroundImageDisplay}')` }"
              >
                <!-- AC Icons -->
                <div
                  v-for="(ac, idx) in devicePositions.ac"
                  :key="'ac-' + idx"
                  class="device-icon ac-icon"
                  :style="{ left: ac.x + '%', top: ac.y + '%' }"
                  :class="{
                    'active': getDeviceState('ac', idx),
                    'draggable': editMode && isSuperAdmin,
                    'dragging': dragging && draggedDevice.type === 'ac' && draggedDevice.index === idx,
                  }"
                  @click="!editMode && openDeviceModal('ac', idx)"
                  @mousedown="editMode && isSuperAdmin && startDrag($event, 'ac', idx)"
                  :title="editMode && isSuperAdmin ? 'ลากเพื่อย้ายตำแหน่ง' : (getDeviceState('ac', idx) ? `แอร์: เปิด (${getACModeLabel(idx)})` : 'แอร์: ปิด')"
                >
                  <div class="icon-circle">
                    <VIcon
                      :icon="getACIcon(idx)"
                    />
                    <span class="icon-label">A/C</span>
                  </div>
                </div>
                
                <!-- ERV Icons -->
                <div
                  v-for="(erv, idx) in devicePositions.erv"
                  :key="'erv-' + idx"
                  class="device-icon erv-icon"
                  :style="{ left: erv.x + '%', top: erv.y + '%' }"
                  :class="{
                    'active': getDeviceState('erv', idx),
                    'rotating': getDeviceState('erv', idx),
                    'rotating-high': getDeviceState('erv', idx) && getErvSpeed(idx) === 'high',
                    'draggable': editMode && isSuperAdmin,
                    'dragging': dragging && draggedDevice.type === 'erv' && draggedDevice.index === idx,
                  }"
                  @click="!editMode && openDeviceModal('erv', idx)"
                  @mousedown="editMode && isSuperAdmin && startDrag($event, 'erv', idx)"
                  :title="editMode && isSuperAdmin ? 'ลากเพื่อย้ายตำแหน่ง' : (getDeviceState('erv', idx) ? 'ERV: เปิด' : 'ERV: ปิด')"
                >
                  <div class="icon-circle">
                    <img
                      :src="fanImage"
                      alt="ERV"
                      class="erv-fan-icon"
                    />
                  </div>
                  <!-- Mode Badge -->
                  <div
                    v-if="getDeviceState('erv', idx)"
                    class="erv-mode-badge"
                    :class="getErvMode(idx) === 'heat' ? 'heat-mode' : 'normal-mode'"
                  >
                    <VIcon
                      v-if="getErvMode(idx) === 'heat'"
                      icon="tabler-arrows-left-right"
                      size="16"
                      title="โหมด Heat: แลกเปลี่ยนอากาศ"
                    />
                    <VIcon
                      v-else
                      icon="tabler-arrow-big-up-lines"
                      size="16"
                      title="โหมด Normal: ระบายอากาศ"
                    />
                  </div>
                </div>
                
                <!-- Light Icons -->
                <div
                  v-for="(fan, idx) in devicePositions.vent_fan"
                  :key="'vent-fan-' + idx"
                  class="device-icon erv-icon"
                  :style="{ left: fan.x + '%', top: fan.y + '%' }"
                  :class="{
                    'active': getDeviceState('vent_fan', idx),
                    'rotating': getDeviceState('vent_fan', idx),
                    'draggable': editMode && isSuperAdmin,
                    'dragging': dragging && draggedDevice.type === 'vent_fan' && draggedDevice.index === idx,
                  }"
                  @click="!editMode && openDeviceModal('vent_fan', idx)"
                  @mousedown="editMode && isSuperAdmin && startDrag($event, 'vent_fan', idx)"
                  :title="editMode && isSuperAdmin ? 'ลากเพื่อย้ายตำแหน่ง' : (getDeviceState('vent_fan', idx) ? 'พัดลมระบายอากาศ: เปิด' : 'พัดลมระบายอากาศ: ปิด')"
                >
                  <div class="icon-circle">
                    <img
                      :src="fanImage"
                      alt="Ventilation Fan"
                      class="erv-fan-icon"
                    />
                  </div>
                </div>

                <!-- Light Icons -->
                <div
                  v-for="(light, idx) in devicePositions.light"
                  :key="'light-' + idx"
                  class="device-icon light-icon"
                  :style="{ left: light.x + '%', top: light.y + '%' }"
                  :class="{
                    'active': getDeviceState('light', idx),
                    'draggable': editMode && isSuperAdmin,
                    'dragging': dragging && draggedDevice.type === 'light' && draggedDevice.index === idx,
                  }"
                  @click="!editMode && openDeviceModal('light', idx)"
                  @mousedown="editMode && isSuperAdmin && startDrag($event, 'light', idx)"
                  :title="editMode && isSuperAdmin ? 'ลากเพื่อย้ายตำแหน่ง' : (getDeviceState('light', idx) ? 'ไฟ: เปิด' : 'ไฟ: ปิด')"
                >
                  <div class="icon-circle">
                    <VIcon icon="tabler-bulb" />
                  </div>
                </div>

                <!-- AM319: แถว 9 sensor (device_type am319 ใน devices + ค่าจาก environmental_data ตาม room_id) -->
                <div
                  v-if="devicePositions.am319 && devicePositions.am319.length > 0"
                  class="am319-sensor-row"
                  :style="{
                    left: devicePositions.am319[0].x + '%',
                    top: devicePositions.am319[0].y + '%',
                  }"
                  :class="{
                    'draggable': editMode && isSuperAdmin,
                    'dragging': dragging && draggedDevice.type === 'am319' && draggedDevice.index === 0,
                  }"
                  @mousedown="editMode && isSuperAdmin && startDrag($event, 'am319', 0)"
                >
                  <div
                    v-for="stype in am319SensorOrder"
                    :key="'am319-tile-' + stype"
                    class="sensor-overlay sensor-overlay--inline"
                    :style="{ '--sensor-color': sensorTypeDefinitions[stype]?.color || '#666' }"
                  >
                    <div class="sensor-overlay-card">
                      <VIcon
                        :icon="sensorTypeDefinitions[stype]?.icon || 'tabler-device-analytics'"
                        size="18"
                        :color="sensorTypeDefinitions[stype]?.color"
                      />
                      <div class="sensor-overlay-label">
                        {{ sensorTypeDefinitions[stype]?.label }}
                      </div>
                      <div class="sensor-overlay-value">
                        {{ getSensorValue(stype) }}
                        <span class="sensor-overlay-unit">{{ getSensorUnit(stype) }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Sensor Overlay Icons -->
                <div
                  v-for="sensor in sensorOverlays"
                  :key="'sensor-' + sensor.id"
                  class="sensor-overlay"
                  :style="{
                    left: sensor.x + '%',
                    top: sensor.y + '%',
                    '--sensor-color': sensorTypeDefinitions[sensor.type]?.color || '#666',
                  }"
                  :class="{
                    'draggable': editMode && isSuperAdmin,
                    'dragging': draggingSensor && draggedSensorId === sensor.id,
                  }"
                  @mousedown="editMode && isSuperAdmin && startSensorDrag($event, sensor.id)"
                >
                  <div class="sensor-overlay-card">
                    <VBtn
                      v-if="editMode && isSuperAdmin"
                      icon
                      size="x-small"
                      color="error"
                      variant="flat"
                      class="sensor-remove-btn"
                      @click.stop="removeSensorOverlay(sensor.id)"
                    >
                      <VIcon icon="tabler-x" size="12" />
                    </VBtn>
                    <VIcon
                      :icon="sensorTypeDefinitions[sensor.type]?.icon || 'tabler-device-analytics'"
                      size="18"
                      :color="sensorTypeDefinitions[sensor.type]?.color"
                    />
                    <div class="sensor-overlay-label">
                      {{ sensorTypeDefinitions[sensor.type]?.label }}
                    </div>
                    <div class="sensor-overlay-value">
                      <template v-if="sensor.type === 'motion'">
                        <VChip
                          :color="getSensorValue(sensor.type) === 'Active' ? 'success' : 'default'"
                          size="x-small"
                          variant="tonal"
                        >
                          {{ getSensorValue(sensor.type) }}
                        </VChip>
                      </template>
                      <template v-else>
                        {{ getSensorValue(sensor.type) }}
                        <span class="sensor-overlay-unit">{{ getSensorUnit(sensor.type) }}</span>
                      </template>
                    </div>
                  </div>
                </div>

                <!-- Add Sensor Button (edit mode only) -->
                <div
                  v-if="editMode && isSuperAdmin"
                  class="sensor-add-floating"
                >
                  <VMenu v-model="showSensorAddMenu" location="top">
                    <template #activator="{ props }">
                      <VBtn
                        v-bind="props"
                        icon
                        size="small"
                        color="success"
                        variant="flat"
                        class="sensor-add-btn"
                      >
                        <VIcon icon="tabler-plus" />
                      </VBtn>
                    </template>
                    <VList density="compact" class="sensor-type-menu">
                      <VListSubheader>เพิ่ม Sensor</VListSubheader>
                      <VListItem
                        v-for="(def, key) in sensorTypeDefinitions"
                        :key="key"
                        @click="addSensorOverlay(key)"
                      >
                        <template #prepend>
                          <VIcon :icon="def.icon" :color="def.color" size="20" />
                        </template>
                        <VListItemTitle>{{ def.label }}</VListItemTitle>
                      </VListItem>
                    </VList>
                  </VMenu>
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- No Room Selected Message -->
    <VRow v-if="!selectedRoomId">
      <VCol cols="12">
        <VCard>
          <VCardText class="text-center py-12">
            <VIcon
              icon="tabler-door-open"
              size="80"
              color="primary"
              class="mb-4"
            />
            <h5 class="text-h5 mb-2">
              กรุณาเลือกห้อง
            </h5>
            <p class="text-body-2 text-disabled">
              เลือกห้องที่ต้องการควบคุมจากรายการด้านบน
            </p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Environmental Monitoring (ปิดการแสดงผล) -->
    <VRow
      v-if="false"
      class="mb-4"
    >
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-home"
              class="me-2"
            />
            สภาพแวดล้อมภายในห้อง • AM319 & Noise
          </VCardTitle>
          <VCardText>
            <!-- Main Readings Grid -->
              <VRow class="mb-4">
              <VCol
                cols="6"
                md="2"
              >
                <VCard
                  variant="flat"
                    class="sensor-card sensor-card-co2"
                >
                    <VCardText class="text-center pa-4">
                      <div class="sensor-icon-wrapper sensor-icon-success mb-3">
                    <VIcon
                      icon="tabler-circle"
                          size="40"
                      color="success"
                    />
                      </div>
                      <div class="text-caption text-disabled mb-2 font-weight-medium">
                      CO2
                    </div>
                      <div class="text-h5 font-weight-bold mb-1">
                        {{ environmentalData.co2 }}
                      </div>
                      <div class="text-caption text-disabled">
                        ppm
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="6"
                md="2"
              >
                <VCard
                  variant="flat"
                    class="sensor-card sensor-card-temp"
                >
                    <VCardText class="text-center pa-4">
                      <div class="sensor-icon-wrapper sensor-icon-info mb-3">
                    <VIcon
                      icon="tabler-temperature"
                          size="40"
                      color="info"
                    />
                      </div>
                      <div class="text-caption text-disabled mb-2 font-weight-medium">
                      อุณหภูมิ
                    </div>
                      <div class="text-h5 font-weight-bold mb-1">
                        {{ environmentalData.temp }}
                      </div>
                      <div class="text-caption text-disabled">
                        °C
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="6"
                md="2"
              >
                <VCard
                  variant="flat"
                    class="sensor-card sensor-card-noise"
                >
                    <VCardText class="text-center pa-4">
                      <div class="sensor-icon-wrapper sensor-icon-success mb-3">
                    <VIcon
                      icon="tabler-volume"
                          size="40"
                      color="success"
                    />
                      </div>
                      <div class="text-caption text-disabled mb-2 font-weight-medium">
                      เสียง
                    </div>
                      <div class="text-h5 font-weight-bold mb-1">
                        {{ environmentalData.noise }}
                      </div>
                      <div class="text-caption text-disabled">
                        dB
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="6"
                md="2"
              >
                <VCard
                  variant="flat"
                    class="sensor-card sensor-card-humidity"
                >
                    <VCardText class="text-center pa-4">
                      <div class="sensor-icon-wrapper sensor-icon-success mb-3">
                    <VIcon
                      icon="tabler-droplet"
                          size="40"
                      color="success"
                    />
                      </div>
                      <div class="text-caption text-disabled mb-2 font-weight-medium">
                      ความชื้น
                    </div>
                      <div class="text-h5 font-weight-bold mb-1">
                        {{ environmentalData.humidity }}
                      </div>
                      <div class="text-caption text-disabled">
                        %
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="6"
                md="2"
              >
                <VCard
                  variant="flat"
                    class="sensor-card sensor-card-motion"
                >
                    <VCardText class="text-center pa-4">
                      <div class="sensor-icon-wrapper sensor-icon-error mb-3">
                    <VIcon
                      icon="tabler-user"
                          size="40"
                      color="error"
                    />
                      </div>
                      <div class="text-caption text-disabled mb-2 font-weight-medium">
                      การเคลื่อนไหว
                    </div>
                      <div class="text-h6 font-weight-bold">
                        <VChip
                          :color="environmentalData.motion === 'Active' ? 'success' : 'default'"
                          size="small"
                          variant="tonal"
                        >
                      {{ environmentalData.motion }}
                        </VChip>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="6"
                md="2"
              >
                <VCard
                  variant="flat"
                    class="sensor-card sensor-card-pm25"
                >
                    <VCardText class="text-center pa-4">
                      <div class="sensor-icon-wrapper sensor-icon-warning mb-3">
                    <VIcon
                      icon="tabler-circle-filled"
                          size="40"
                      color="warning"
                    />
                      </div>
                      <div class="text-caption text-disabled mb-2 font-weight-medium">
                      PM2.5
                    </div>
                      <div class="text-h5 font-weight-bold mb-1">
                        {{ environmentalData.pm25 }}
                    </div>
                      <div class="text-caption text-disabled mb-1">
                        µg/m³
                    </div>
                      <VChip
                        :color="getPM25ChipColor(environmentalData.pm25)"
                        size="x-small"
                        variant="tonal"
                      >
                        {{ getPM25Status(environmentalData.pm25) }}
                      </VChip>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>

            <!-- CO2 24h Trend Chart -->
              <VCard
                variant="outlined"
                class="co2-chart-card"
              >
                <VCardTitle class="co2-chart-title">
                  <div class="d-flex align-center">
                    <div class="co2-chart-icon-wrapper me-3">
                <VIcon
                        icon="tabler-chart-line"
                        size="24"
                        color="success"
                />
                    </div>
                    <div>
                      <div class="text-h6 font-weight-bold">
                CO2 • 24h Trend
                      </div>
                      <div class="text-caption text-disabled">
                        การเปลี่ยนแปลงระดับ CO2 ใน 24 ชั่วโมงล่าสุด
                      </div>
                    </div>
                  </div>
              </VCardTitle>
              <VCardText>
                  <div class="co2-trend-header mb-4">
                    <div class="text-center mb-3">
                      <div class="text-h3 font-weight-bold text-success mb-1">
                        {{ environmentalData.co2 }}
                  </div>
                      <div class="text-body-2 text-disabled">
                        ppm (ปัจจุบัน)
                    </div>
                    </div>
                    <VRow class="mt-3">
                      <VCol cols="6">
                        <div class="co2-stat-card co2-stat-min">
                          <div class="text-caption text-disabled mb-1">
                            <VIcon
                              icon="tabler-arrow-down"
                              size="14"
                              class="me-1"
                            />
                            ต่ำสุด
                  </div>
                          <div class="text-body-1 font-weight-bold">
                            {{ co2MinMax.min }} ppm
                </div>
                          <div class="text-caption text-disabled">
                            {{ co2MinMax.minTime }}
                          </div>
                        </div>
                      </VCol>
                      <VCol cols="6">
                        <div class="co2-stat-card co2-stat-max">
                          <div class="text-caption text-disabled mb-1">
                            <VIcon
                              icon="tabler-arrow-up"
                              size="14"
                              class="me-1"
                            />
                            สูงสุด
                          </div>
                          <div class="text-body-1 font-weight-bold">
                            {{ co2MinMax.max }} ppm
                          </div>
                          <div class="text-caption text-disabled">
                            {{ co2MinMax.maxTime }}
                          </div>
                        </div>
                      </VCol>
                    </VRow>
                  </div>
                  <div class="co2-chart-container">
                <canvas
                  ref="co2Chart"
                      style="max-height: 250px; width: 100%; height: 250px;"
                />
                  </div>
              </VCardText>
            </VCard>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Energy Usage -->
    <VRow
      v-if="selectedRoomId"
      class="mb-4"
    >
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-bolt"
              class="me-2"
            />
            การใช้พลังงาน • {{ selectedRoomTitle }}
          </VCardTitle>
          <VCardText>
            <div class="d-flex flex-wrap align-center gap-2 mb-4">
              <VBtnToggle
                v-model="energyPeriod"
                mandatory
                density="compact"
                color="primary"
              >
                <VBtn value="1d">
                  1 วัน
                </VBtn>
                <VBtn value="7d">
                  7 วัน
                </VBtn>
                <VBtn value="1m">
                  1 เดือน
                </VBtn>
                <VBtn value="custom">
                  เลือกเอง
                </VBtn>
              </VBtnToggle>

              <template v-if="energyPeriod === 'custom'">
                <VTextField
                  v-model="energyCustomStart"
                  type="date"
                  label="เริ่ม"
                  density="compact"
                  variant="outlined"
                  hide-details
                  style="max-width: 170px"
                />
                <VTextField
                  v-model="energyCustomEnd"
                  type="date"
                  label="ถึง"
                  density="compact"
                  variant="outlined"
                  hide-details
                  style="max-width: 170px"
                />
                <VBtn
                  color="primary"
                  density="compact"
                  @click="loadEnergyData"
                >
                  ค้นหา
                </VBtn>
              </template>
            </div>

            <VRow class="mb-4">
              <VCol
                cols="6"
                md="3"
              >
                <VCard
                  variant="flat"
                  class="sensor-card"
                >
                  <VCardText class="text-center pa-4">
                    <div class="sensor-icon-wrapper sensor-icon-info mb-2">
                      <VIcon
                        icon="tabler-bolt"
                        size="32"
                        color="info"
                      />
                    </div>
                    <div class="text-caption text-disabled mb-1">
                      พลังงานรวม
                    </div>
                    <div class="text-h5 font-weight-bold">
                      {{ energyData.summary.totalEnergy }}
                    </div>
                    <div class="text-caption text-disabled">
                      kWh
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="6"
                md="3"
              >
                <VCard
                  variant="flat"
                  class="sensor-card"
                >
                  <VCardText class="text-center pa-4">
                    <div class="sensor-icon-wrapper sensor-icon-success mb-2">
                      <VIcon
                        icon="tabler-chart-bar"
                        size="32"
                        color="success"
                      />
                    </div>
                    <div class="text-caption text-disabled mb-1">
                      กำลังเฉลี่ย
                    </div>
                    <div class="text-h5 font-weight-bold">
                      {{ energyData.summary.avgPower }}
                    </div>
                    <div class="text-caption text-disabled">
                      W
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="6"
                md="3"
              >
                <VCard
                  variant="flat"
                  class="sensor-card"
                >
                  <VCardText class="text-center pa-4">
                    <div class="sensor-icon-wrapper sensor-icon-warning mb-2">
                      <VIcon
                        icon="tabler-arrow-up"
                        size="32"
                        color="warning"
                      />
                    </div>
                    <div class="text-caption text-disabled mb-1">
                      กำลังสูงสุด
                    </div>
                    <div class="text-h5 font-weight-bold">
                      {{ energyData.summary.maxPower }}
                    </div>
                    <div class="text-caption text-disabled">
                      W
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="6"
                md="3"
              >
                <VCard
                  variant="flat"
                  class="sensor-card"
                >
                  <VCardText class="text-center pa-4">
                    <div class="sensor-icon-wrapper sensor-icon-error mb-2">
                      <VIcon
                        icon="tabler-database"
                        size="32"
                        color="error"
                      />
                    </div>
                    <div class="text-caption text-disabled mb-1">
                      จำนวนข้อมูล
                    </div>
                    <div class="text-h5 font-weight-bold">
                      {{ energyData.summary.recordCount }}
                    </div>
                    <div class="text-caption text-disabled">
                      records
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>

            <VCard
              variant="outlined"
            >
              <VCardText>
                <div v-if="energyLoading" class="text-center py-8">
                  <VProgressCircular
                    indeterminate
                    color="primary"
                  />
                  <div class="text-caption text-disabled mt-2">
                    กำลังโหลดข้อมูลพลังงาน...
                  </div>
                </div>
                <div v-else-if="energyData.records.length === 0" class="text-center py-8">
                  <VIcon
                    icon="tabler-chart-line"
                    size="60"
                    color="disabled"
                    class="mb-2"
                  />
                  <div class="text-body-2 text-disabled mb-2">
                    ไม่มีข้อมูลพลังงานในช่วงเวลาที่เลือก
                  </div>
                  <div class="text-caption text-disabled">
                    ลองเลือก «เลือกเอง» แล้วกำหนดช่วงวันที่กว้างขึ้น
                  </div>
                </div>
                <template v-else>
                  <VAlert
                    v-if="energyIsMock"
                    type="warning"
                    variant="tonal"
                    density="compact"
                    class="mb-3"
                  >
                    ข้อมูลตัวอย่าง — ยังไม่มีข้อมูลพลังงานใน DB สำหรับห้องนี้
                  </VAlert>
                  <VAlert
                    v-else-if="energyUsedFallback"
                    type="info"
                    variant="tonal"
                    density="compact"
                    class="mb-3"
                  >
                    แสดงข้อมูลล่าสุดที่มีในระบบ (ไม่ตรงกับช่วงที่เลือก)
                  </VAlert>
                  <VueApexCharts
                    type="area"
                    :height="300"
                    :options="energyChartOptions"
                    :series="energyChartSeries"
                  />
                </template>
              </VCardText>
            </VCard>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
    </div>

    <!-- Device Control Dialog — ใช้ร่วมกันทั้ง floor plan และ room control -->
    <VDialog
      v-model="showDeviceModal"
      max-width="600"
      scrollable
    >
      <VCard v-if="selectedDevice.type && selectedDevice.index >= 0">
        <VCardTitle class="d-flex align-center justify-space-between">
          <div class="d-flex align-center">
            <VIcon
              :icon="selectedDevice.type === 'ac' ? getACIcon(selectedDevice.index) : getDeviceTypeIcon(controllableDeviceTypes, selectedDevice.type)"
              class="me-2"
            />
            {{ getDeviceTypeLabel(controllableDeviceTypes, selectedDevice.type) }}
          </div>
          <VBtn
            icon
            variant="text"
            size="small"
            @click="closeDeviceModal"
          >
            <VIcon icon="tabler-x" />
          </VBtn>
        </VCardTitle>

        <VCardText>
            <!-- ERV Icon Control (Clickable) -->
            <div
              v-if="selectedDevice.type === 'erv'"
              class="text-center mb-6"
            >
              <div
                class="modal-erv-icon-container"
                :class="{
                  'erv-active': getDeviceState('erv', selectedDevice.index),
                  'erv-rotating': getDeviceState('erv', selectedDevice.index),
                  'erv-rotating-high': getDeviceState('erv', selectedDevice.index) && getErvSpeed(selectedDevice.index) === 'high'
                }"
                @click="toggleDevice('erv', selectedDevice.index)"
              >
                <div class="modal-erv-icon-wrapper">
                  <img
                    :src="fanImage"
                    alt="ERV"
                    class="modal-erv-icon-large"
                  />
                  <div class="modal-erv-glow" />
                </div>
              </div>
              <div class="mt-4">
            <VChip
                  :color="getDeviceState('erv', selectedDevice.index) ? 'success' : 'default'"
              size="large"
                  variant="tonal"
                >
                  <VIcon
                    :icon="getDeviceState('erv', selectedDevice.index) ? 'tabler-power' : 'tabler-power-off'"
                    class="me-2"
                    size="16"
                  />
                  {{ getDeviceState('erv', selectedDevice.index) ? 'เปิด' : 'ปิด' }}
            </VChip>
              </div>
              <div class="text-caption text-disabled mt-2">
                คลิกที่ icon เพื่อเปิด/ปิด
              </div>
          </div>

            <!-- AC Icon Control (Clickable) -->
            <div
              v-if="selectedDevice.type === 'ac'"
              class="text-center mb-6"
            >
              <div
                class="modal-ac-icon-container"
                :class="{
                  'ac-active': getDeviceState('ac', selectedDevice.index),
                }"
                @click="toggleDevice('ac', selectedDevice.index)"
              >
                <div class="modal-ac-icon-wrapper">
                  <VIcon
                    :icon="getACIcon(selectedDevice.index)"
                    class="modal-ac-icon-large"
                    :color="getACColor(selectedDevice.index)"
                  />
                  <div class="modal-ac-glow" />
                </div>
              </div>
              <div class="mt-4">
                <VChip
                  :color="getDeviceState('ac', selectedDevice.index) ? 'success' : 'default'"
                  size="large"
                  variant="tonal"
                >
                  <VIcon
                    :icon="getDeviceState('ac', selectedDevice.index) ? 'tabler-power' : 'tabler-power-off'"
                    class="me-2"
                    size="16"
                  />
                  {{ getDeviceState('ac', selectedDevice.index) ? 'เปิด' : 'ปิด' }}
                </VChip>
              </div>
              <div class="text-caption text-disabled mt-2">
                คลิกที่ icon เพื่อเปิด/ปิด
              </div>
            </div>

            <!-- Light Icon Control (Clickable) -->
          <div
            v-if="selectedDevice.type === 'light'"
              class="text-center mb-6"
            >
              <div
                class="modal-light-icon-container"
                :class="{
                  'light-active': getDeviceState('light', selectedDevice.index),
                }"
                @click="toggleDevice('light', selectedDevice.index)"
          >
                <div class="modal-light-icon-wrapper">
                <VIcon
                  icon="tabler-bulb"
                    class="modal-light-icon-large"
                    color="warning"
                  />
                  <div class="modal-light-glow" />
                </div>
              </div>
              <div class="mt-4">
                <VChip
                  :color="getDeviceState('light', selectedDevice.index) ? 'success' : 'default'"
                  size="large"
                  variant="tonal"
                >
                  <VIcon
                    :icon="getDeviceState('light', selectedDevice.index) ? 'tabler-power' : 'tabler-power-off'"
                  class="me-2"
                    size="16"
                  />
                  {{ getDeviceState('light', selectedDevice.index) ? 'เปิด' : 'ปิด' }}
                </VChip>
              </div>
              <div class="text-caption text-disabled mt-2">
                คลิกที่ icon เพื่อเปิด/ปิด
            </div>
          </div>

          <!-- Light Brightness Control -->
          <div v-if="selectedDevice.type === 'light'">
            <VCard
              variant="outlined"
              class="mb-4 light-control-card"
            >
              <VCardText>
                <div class="d-flex align-center mb-3">
                  <VAvatar
                    size="40"
                    color="warning"
                    variant="tonal"
                    class="me-3"
                  >
                    <VIcon
                      icon="tabler-sliders"
                      size="20"
                    />
                  </VAvatar>
                  <div>
                    <div class="text-h6 mb-0">
                      ความสว่าง
                    </div>
                    <div class="text-caption text-disabled">
                      ปรับความสว่างของไฟ (Home Assistant)
                    </div>
                  </div>
                </div>

                <div class="text-center mb-2">
                  <span class="text-h5 font-weight-bold">
                    {{ getLightBrightness(selectedDevice.index) }}
                  </span>
                  <span class="text-caption text-disabled">
                    / 255
                  </span>
                </div>

                <VSlider
                  :model-value="getLightBrightness(selectedDevice.index)"
                  min="1"
                  max="255"
                  step="1"
                  color="warning"
                  @update:model-value="updateLightBrightness(selectedDevice.index, $event)"
                />

                <div class="d-flex justify-space-between text-caption text-disabled mt-2">
                  <span>1</span>
                  <span>255</span>
                </div>
              </VCardText>
            </VCard>
          </div>

          <!-- AC Control -->
          <div v-if="selectedDevice.type === 'ac'">
              <!-- AC Mode Control -->
              <VCard
                variant="outlined"
                class="mb-4 ac-control-card"
              >
                <VCardText>
                  <div class="d-flex align-center mb-3">
                    <VAvatar
                      size="40"
                      :color="getACColor(selectedDevice.index)"
                      variant="tonal"
                      class="me-3"
                    >
                <VIcon
                  icon="tabler-settings"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-h6 mb-0">
                        โหมดการทำงาน
                      </div>
                      <div class="text-caption text-disabled">
                        เลือกโหมดการทำงาน
                      </div>
                    </div>
              </div>
              <VBtnToggle
                v-model="acSettings.mode[selectedDevice.index]"
                mandatory
                    variant="outlined"
                    density="comfortable"
                    class="w-100"
                @update:model-value="updateACMode(selectedDevice.index, $event)"
              >
                    <VBtn
                      value="off"
                      class="flex-fill"
                    >
                      <VIcon
                        icon="tabler-power"
                        size="18"
                        class="me-2"
                      />
                  ปิด
                </VBtn>
                    <VBtn
                      value="cool"
                      class="flex-fill"
                    >
                      <VIcon
                        icon="tabler-snowflake"
                        size="18"
                        class="me-2"
                      />
                  Cool
                </VBtn>
                    <VBtn
                      value="dry"
                      class="flex-fill"
                    >
                      <VIcon
                        icon="tabler-droplet"
                        size="18"
                        class="me-2"
                      />
                  Dry
                </VBtn>
                    <VBtn
                      value="fan_only"
                      class="flex-fill"
                    >
                      <VIcon
                        icon="tabler-wind"
                        size="18"
                        class="me-2"
                      />
                      Fan
                </VBtn>
              </VBtnToggle>
                </VCardText>
              </VCard>

              <!-- Temperature Control -->
              <VCard
                variant="outlined"
                class="mb-4 ac-control-card"
              >
                <VCardText>
                  <div class="d-flex align-center mb-3">
                    <VAvatar
                      size="40"
                      color="info"
                      variant="tonal"
                      class="me-3"
                    >
                <VIcon
                  icon="tabler-temperature"
                        size="20"
                />
                    </VAvatar>
                    <div>
                      <div class="text-h6 mb-0">
                อุณหภูมิ
              </div>
                      <div class="text-caption text-disabled">
                        ปรับอุณหภูมิที่ต้องการ
                      </div>
                    </div>
                  </div>
                  
                  <div class="d-flex align-center justify-center gap-4 mb-3">
                <VBtn
                  icon
                  variant="outlined"
                      size="large"
                  :disabled="(acTemperatures[selectedDevice.index] || acTemperature) <= 16"
                      @click="updateACTemperature(selectedDevice.index, Math.max(16, (acTemperatures[selectedDevice.index] || acTemperature) - 1))"
                >
                  <VIcon icon="tabler-minus" />
                </VBtn>
                    <div class="text-h3 font-weight-bold">
                  {{ acTemperatures[selectedDevice.index] || acTemperature }}°C
                </div>
                <VBtn
                  icon
                  variant="outlined"
                      size="large"
                  :disabled="(acTemperatures[selectedDevice.index] || acTemperature) >= 30"
                      @click="updateACTemperature(selectedDevice.index, Math.min(30, (acTemperatures[selectedDevice.index] || acTemperature) + 1))"
                >
                  <VIcon icon="tabler-plus" />
                </VBtn>
              </div>
                  
              <VSlider
                v-model="acTemperatures[selectedDevice.index]"
                :model-value="acTemperatures[selectedDevice.index] || acTemperature"
                min="16"
                max="30"
                step="1"
                    :color="getACColor(selectedDevice.index)"
                    @update:model-value="updateACTemperature(selectedDevice.index, $event)"
              />
                  
                  <div class="d-flex justify-space-between text-caption text-disabled mt-2">
                    <span>16°C</span>
                    <span>30°C</span>
            </div>

                  <!-- Quick Temperature Buttons -->
                  <div class="d-flex gap-2 mt-4">
                    <VBtn
                      variant="outlined"
                      size="small"
                      density="compact"
                      class="flex-fill"
                      @click="updateACTemperature(selectedDevice.index, 20)"
                    >
                      20°C
                    </VBtn>
                    <VBtn
                      variant="outlined"
                      size="small"
                      density="compact"
                      class="flex-fill"
                      @click="updateACTemperature(selectedDevice.index, 24)"
                    >
                      24°C
                    </VBtn>
                    <VBtn
                      variant="outlined"
                      size="small"
                      density="compact"
                      class="flex-fill"
                      @click="updateACTemperature(selectedDevice.index, 26)"
                    >
                      26°C
                    </VBtn>
            </div>
                </VCardText>
              </VCard>
          </div>

          <!-- ERV Control -->
          <div v-if="selectedDevice.type === 'erv'">
              <!-- Speed Control -->
              <VCard
                variant="outlined"
                class="mb-4 erv-control-card"
              >
                <VCardText>
                  <div class="d-flex align-center mb-3">
                    <VAvatar
                      size="40"
                      color="info"
                      variant="tonal"
                      class="me-3"
                    >
                <VIcon
                  icon="tabler-gauge"
                        size="20"
                />
                    </VAvatar>
                    <div>
                      <div class="text-h6 mb-0">
                แรงลม
                      </div>
                      <div class="text-caption text-disabled">
                        ความเร็วการหมุน
                      </div>
                    </div>
              </div>
              <VBtnToggle
                v-model="ervSettings.speed[selectedDevice.index]"
                mandatory
                    variant="outlined"
                    density="comfortable"
                    class="w-100"
                @update:model-value="updateERVSpeed(selectedDevice.index, $event)"
              >
                    <VBtn
                      value="low"
                      class="flex-fill"
                    >
                      <VIcon
                        icon="tabler-gauge"
                        size="18"
                        class="me-2"
                      />
                  Low
                </VBtn>
                    <VBtn
                      value="high"
                      class="flex-fill"
                    >
                      <VIcon
                        icon="tabler-gauge-filled"
                        size="18"
                        class="me-2"
                      />
                  High
                </VBtn>
              </VBtnToggle>
                </VCardText>
              </VCard>

              <!-- Mode Control -->
              <VCard
                variant="outlined"
                class="mb-4 erv-control-card"
              >
                <VCardText>
                  <div class="d-flex align-center mb-3">
                    <VAvatar
                      size="40"
                      color="warning"
                      variant="tonal"
                      class="me-3"
                    >
                <VIcon
                  icon="tabler-settings"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-h6 mb-0">
                        โหมดการทำงาน
                      </div>
                      <div class="text-caption text-disabled">
                        เลือกโหมดการทำงาน
                      </div>
                    </div>
              </div>
              <VBtnToggle
                v-model="ervSettings.mode[selectedDevice.index]"
                mandatory
                    variant="outlined"
                    density="comfortable"
                    class="w-100"
                @update:model-value="updateERVMode(selectedDevice.index, $event)"
              >
                    <VBtn
                      value="normal"
                      class="flex-fill"
                    >
                      <VIcon
                        icon="tabler-wind"
                        size="18"
                        class="me-2"
                      />
                  Normal
                </VBtn>
                    <VBtn
                      value="heat"
                      class="flex-fill"
                    >
                      <VIcon
                        icon="tabler-flame"
                        size="18"
                        class="me-2"
                      />
                  Heat
                </VBtn>
              </VBtnToggle>
                </VCardText>
              </VCard>
            </div>
        </VCardText>

        <VCardActions>
          <VSpacer />
          <VBtn
            variant="outlined"
            @click="closeDeviceModal"
          >
            ปิด
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- System Control Confirmation Dialog -->
    <VDialog
      v-model="showSystemControlDialog"
      max-width="600"
      persistent
    >
      <VCard>
        <VCardTitle class="d-flex align-center gap-3">
          <VIcon
            icon="tabler-settings"
            color="primary"
            size="32"
          />
          <span class="text-h5">
            ควบคุมระบบ
          </span>
        </VCardTitle>
        
        <VDivider />
        
        <VCardText class="pt-6">
          <div class="text-body-1 mb-4">
            <template v-if="systemControlTargetRoomId">
              เลือกการควบคุมระบบใน
              <strong>{{ areaRoomsMap[Object.keys(areaRoomsMap).find(key => areaRoomsMap[key]?.id === systemControlTargetRoomId)]?.name || 'ห้องนี้' }}</strong>
            </template>
            <template v-else>
              เลือกการควบคุมระบบใน
              <strong>Building {{ selectedBuilding }}, {{ selectedAreaDisplayName }}</strong>
            </template>
          </div>
          <VAlert
            type="info"
            variant="tonal"
            class="mb-0"
          >
            <div class="text-body-2">
              <strong>หมายเหตุ:</strong>
              การเปิดระบบจะเปิดเฉพาะอุปกรณ์ที่ปิดอยู่ 
              การปิดระบบจะปิดอุปกรณ์ทั้งหมด (ไฟ, แอร์, ERV, พัดลมระบายอากาศ) 
            </div>
          </VAlert>
        </VCardText>

        <VDivider />
        
        <VCardActions class="pa-4 d-flex gap-2">
          <VBtn
            color="default"
            variant="outlined"
            :disabled="systemControlLoading"
            @click="closeSystemControlDialog"
          >
            ยกเลิก
          </VBtn>
          <VSpacer />
          <VBtn
            color="success"
            variant="elevated"
            :loading="systemControlLoading"
            prepend-icon="tabler-power"
            @click="systemControlAction = 'turnOn'; showSystemControlDialog = false; showConfirmSystemControlDialog = true"
          >
            เปิดระบบทั้งหมด
          </VBtn>
          <VBtn
            color="error"
            variant="elevated"
            :loading="systemControlLoading"
            prepend-icon="tabler-power-off"
            @click="systemControlAction = 'turnOff'; showSystemControlDialog = false; showConfirmSystemControlDialog = true"
          >
            ปิดระบบทั้งหมด
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- System Control Confirmation Dialog -->
    <VDialog
      v-model="showConfirmSystemControlDialog"
      max-width="500"
      persistent
    >
      <VCard>
        <VCardTitle class="d-flex align-center gap-3">
          <VIcon
            :icon="systemControlAction === 'turnOn' ? 'tabler-power' : 'tabler-power-off'"
            :color="systemControlAction === 'turnOn' ? 'success' : 'error'"
            size="32"
          />
          <span class="text-h5">
            {{ systemControlAction === 'turnOn' ? 'เปิดระบบทั้งหมด' : 'ปิดระบบทั้งหมด' }}
          </span>
        </VCardTitle>
        
        <VDivider />
        
        <VCardText class="pt-6">
          <div class="text-body-1 mb-4">
            คุณต้องการ{{ systemControlAction === 'turnOn' ? 'เปิด' : 'ปิด' }}ระบบทั้งหมดหรือไม่?
          </div>
          <VAlert
            :type="systemControlAction === 'turnOn' ? 'info' : 'warning'"
            variant="tonal"
            class="mb-0"
          >
            <div class="text-body-2">
              <strong>หมายเหตุ:</strong>
              <template v-if="systemControlAction === 'turnOn'">
                การดำเนินการนี้จะเปิดเฉพาะอุปกรณ์ที่ปิดอยู่ (ไฟ, แอร์, ERV)
              </template>
              <template v-else>
                การดำเนินการนี้จะปิดอุปกรณ์ทั้งหมด (ไฟ, แอร์, ERV)
              </template>
            </div>
          </VAlert>
        </VCardText>

        <VDivider />
        
        <VCardActions class="pa-4">
          <VSpacer />
          <VBtn
            color="default"
            variant="outlined"
            :disabled="systemControlLoading"
            @click="closeConfirmSystemControlDialog"
          >
            ยกเลิก
          </VBtn>
          <VBtn
            :color="systemControlAction === 'turnOn' ? 'success' : 'error'"
            variant="elevated"
            :loading="systemControlLoading"
            prepend-icon="tabler-check"
            @click="confirmSystemControl"
          >
            ยืนยัน
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Loading Overlay -->
    <VOverlay
      v-model="loading"
      class="align-center justify-center"
    >
      <VProgressCircular
        indeterminate
        size="64"
        color="primary"
      />
    </VOverlay>
  </div>
</template>

<style scoped>
.room-control-wrapper {
  padding: 0;
}

.building-card {
  transition: all 0.3s ease;
  overflow: hidden;
}

.building-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.building-image-wrapper {
  position: relative;
  overflow: hidden;
}

.building-image {
  transition: transform 0.3s ease;
}

.building-card:hover .building-image {
  transform: scale(1.05);
}

.building-placeholder {
  height: 12.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  opacity: 0.1;
}

.floors-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.floor-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.5);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  cursor: pointer;
  transition: all 0.2s ease;
}

.floor-item:hover {
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgb(var(--v-theme-primary));
  transform: translateX(4px);
}

.floor-label {
  font-weight: 500;
  font-size: 0.9375rem;
}


.room-layout-container {
  position: relative;
  width: 100%;
  padding-bottom: 60%;
  background: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
}

.room-layout {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #fff;
  border: 2px solid #e0e0e0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.device-icon {
  position: absolute;
  cursor: pointer;
  transform: translate(-50%, -50%);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  z-index: 10;
}

.device-icon:hover:not(.draggable) {
  transform: translate(-50%, -50%) scale(1.2);
  z-index: 20;
}

.icon-circle {
  width: 3.125rem;
  height: 3.125rem;
  border-radius: 50%;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 3px solid #e9ecef;
  transition: all 0.3s ease;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.device-icon.active .icon-circle {
  background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
  border-color: #27ae60;
  box-shadow: 0 4px 16px rgba(46, 204, 113, 0.4);
}

.device-icon.active .icon-circle i,
.device-icon.active .icon-circle .icon-label {
  color: #fff;
}

.icon-circle i {
  font-size: 1.2rem;
  color: #667eea;
  margin-bottom: 2px;
}

/* Light Icon - Orange Color */
.light-icon .icon-circle {
  border-color: #ff9800;
  background: #fff;
}

.light-icon .icon-circle i {
  color: #ff9800;
}

.light-icon.active .icon-circle {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  border-color: #f57c00;
  box-shadow: 0 4px 16px rgba(255, 152, 0, 0.5);
}

.light-icon.active .icon-circle i {
  color: #fff;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.8));
}

/* AC Icon - Blue */
.ac-icon .icon-circle {
  border-color: #2196f3;
  background: #fff;
}

.ac-icon .icon-circle i {
  color: #2196f3;
}

.ac-icon.active .icon-circle {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  border-color: #1976d2;
  box-shadow: 0 4px 16px rgba(33, 150, 243, 0.5);
}

.ac-icon.active .icon-circle i,
.ac-icon.active .icon-circle .icon-label {
  color: #fff;
}

/* ERV Icon - Purple */
.erv-icon .icon-circle {
  border-color: #9b59b6;
  background: #fff;
}

.erv-icon.active .icon-circle {
  background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
  border-color: #8e44ad;
  box-shadow: 0 4px 16px rgba(155, 89, 182, 0.5);
}

.erv-icon.active .icon-circle .erv-fan-icon {
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.8));
}

.icon-label {
  font-size: 0.6rem;
  font-weight: 700;
  color: #667eea;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

/* Draggable styles */
.device-icon.draggable {
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.device-icon.draggable:hover .icon-circle {
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.5);
  border-color: rgba(102, 126, 234, 0.8);
  border-width: 4px;
}

.device-icon.draggable:hover {
  cursor: grab;
  transform: translate(-50%, -50%);
  z-index: 10;
}

.device-icon.draggable:active {
  cursor: grabbing;
  transform: translate(-50%, -50%);
}

.device-icon.dragging {
  cursor: grabbing !important;
  opacity: 0.7;
  z-index: 100;
  transform: scale(1.15);
  pointer-events: none;
}

.erv-fan-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.3));
}

.device-icon.erv-icon.rotating .erv-fan-icon {
  animation: rotate 2s linear infinite;
}

.device-icon.erv-icon.rotating-high .erv-fan-icon {
  animation: rotate 0.8s linear infinite;
}

/* ERV Mode Badge */
.erv-mode-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: white;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 15;
  transition: all 0.3s ease;
}

.erv-mode-badge.heat-mode {
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%);
  border-color: #ff5252;
}

.erv-mode-badge.normal-mode {
  background: linear-gradient(135deg, #4dabf7 0%, #74c0fc 100%);
  border-color: #339af0;
  color: white;
}

.erv-mode-badge .v-icon {
  color: white;
}

.device-icon:hover .erv-mode-badge {
  transform: scale(1.2);
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Modal ERV Icon */
.modal-erv-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  transition: transform 0.3s ease;
}

.modal-erv-icon-rotating {
  animation: rotate 2s linear infinite;
}

.modal-erv-icon-rotating-high {
  animation: rotate 0.8s linear infinite;
}

/* Modal ERV Icon Container (Clickable) */
.modal-erv-icon-container {
  display: inline-block;
  cursor: pointer;
  padding: 0;
  border-radius: 50%;
  position: relative;
  transition: all 0.3s ease;
  user-select: none;
}

.modal-erv-icon-wrapper {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(var(--v-theme-surface), 0.8) 0%, rgba(var(--v-theme-surface), 0.6) 100%);
  border: 4px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: all 0.3s ease;
  overflow: hidden;
}

.modal-erv-icon-container:hover .modal-erv-icon-wrapper {
  transform: scale(1.05);
  border-color: rgb(var(--v-theme-info));
  background: linear-gradient(135deg, rgba(var(--v-theme-info), 0.15) 0%, rgba(var(--v-theme-info), 0.1) 100%);
  box-shadow: 0 8px 24px rgba(var(--v-theme-info), 0.2);
}

.modal-erv-icon-container.erv-active .modal-erv-icon-wrapper {
  background: linear-gradient(135deg, rgba(var(--v-theme-info), 0.25) 0%, rgba(var(--v-theme-info), 0.15) 100%);
  border-color: rgb(var(--v-theme-info));
  box-shadow: 0 8px 32px rgba(var(--v-theme-info), 0.4), 0 0 0 4px rgba(var(--v-theme-info), 0.1);
}

.modal-erv-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--v-theme-info), 0.3) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.modal-erv-icon-container.erv-active .modal-erv-glow {
  opacity: 1;
  animation: pulse-glow 2s ease-in-out infinite;
}

.modal-erv-icon-large {
  width: 100px;
  height: 100px;
  object-fit: contain;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  transition: transform 0.3s ease;
  position: relative;
  z-index: 1;
}

.modal-erv-icon-container:hover .modal-erv-icon-large {
  filter: drop-shadow(0 6px 12px rgba(var(--v-theme-info), 0.4));
}

.modal-erv-icon-container.erv-active .modal-erv-icon-large {
  filter: drop-shadow(0 8px 16px rgba(var(--v-theme-info), 0.6));
}

.modal-erv-icon-container.erv-rotating .modal-erv-icon-large {
  animation: rotate 2s linear infinite;
}

.modal-erv-icon-container.erv-rotating-high .modal-erv-icon-large {
  animation: rotate 0.8s linear infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    opacity: 0.3;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1.1);
  }
}

.erv-control-card {
  transition: all 0.3s ease;
  border: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.erv-control-card:hover {
  border-color: rgba(var(--v-theme-info), 0.5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

/* Modal AC Icon Container (Clickable) */
.modal-ac-icon-container {
  display: inline-block;
  cursor: pointer;
  padding: 0;
  border-radius: 50%;
  position: relative;
  transition: all 0.3s ease;
  user-select: none;
}

.modal-ac-icon-wrapper {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(var(--v-theme-surface), 0.8) 0%, rgba(var(--v-theme-surface), 0.6) 100%);
  border: 4px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: all 0.3s ease;
  overflow: hidden;
}

.modal-ac-icon-container:hover .modal-ac-icon-wrapper {
  transform: scale(1.05);
  border-color: rgb(var(--v-theme-primary));
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.15) 0%, rgba(var(--v-theme-primary), 0.1) 100%);
  box-shadow: 0 8px 24px rgba(var(--v-theme-primary), 0.2);
}

.modal-ac-icon-container.ac-active .modal-ac-icon-wrapper {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.25) 0%, rgba(var(--v-theme-primary), 0.15) 100%);
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 8px 32px rgba(var(--v-theme-primary), 0.4), 0 0 0 4px rgba(var(--v-theme-primary), 0.1);
}

.modal-ac-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--v-theme-primary), 0.3) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.modal-ac-icon-container.ac-active .modal-ac-glow {
  opacity: 1;
  animation: pulse-glow 2s ease-in-out infinite;
}

.modal-ac-icon-large {
  font-size: 80px !important;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  transition: all 0.3s ease;
}

.modal-ac-icon-container:hover .modal-ac-icon-large {
  filter: drop-shadow(0 6px 12px rgba(var(--v-theme-primary), 0.4));
}

.modal-ac-icon-container.ac-active .modal-ac-icon-large {
  filter: drop-shadow(0 8px 16px rgba(var(--v-theme-primary), 0.6));
}

.ac-control-card {
  transition: all 0.3s ease;
  border: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.ac-control-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

/* Modal Light Icon Container (Clickable) */
.modal-light-icon-container {
  display: inline-block;
  cursor: pointer;
  padding: 0;
  border-radius: 50%;
  position: relative;
  transition: all 0.3s ease;
  user-select: none;
}

.modal-light-icon-wrapper {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(var(--v-theme-surface), 0.8) 0%, rgba(var(--v-theme-surface), 0.6) 100%);
  border: 4px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: all 0.3s ease;
  overflow: hidden;
}

.modal-light-icon-container:hover .modal-light-icon-wrapper {
  transform: scale(1.05);
  border-color: rgb(var(--v-theme-warning));
  background: linear-gradient(135deg, rgba(var(--v-theme-warning), 0.15) 0%, rgba(var(--v-theme-warning), 0.1) 100%);
  box-shadow: 0 8px 24px rgba(var(--v-theme-warning), 0.2);
}

.modal-light-icon-container.light-active .modal-light-icon-wrapper {
  background: linear-gradient(135deg, rgba(var(--v-theme-warning), 0.25) 0%, rgba(var(--v-theme-warning), 0.15) 100%);
  border-color: rgb(var(--v-theme-warning));
  box-shadow: 0 8px 32px rgba(var(--v-theme-warning), 0.4), 0 0 0 4px rgba(var(--v-theme-warning), 0.1);
}

.modal-light-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--v-theme-warning), 0.3) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.modal-light-icon-container.light-active .modal-light-glow {
  opacity: 1;
  animation: pulse-glow 2s ease-in-out infinite;
}

.modal-light-icon-large {
  font-size: 80px !important;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  transition: all 0.3s ease;
}

.modal-light-icon-container:hover .modal-light-icon-large {
  filter: drop-shadow(0 6px 12px rgba(var(--v-theme-warning), 0.4));
}

.modal-light-icon-container.light-active .modal-light-icon-large {
  filter: drop-shadow(0 8px 16px rgba(var(--v-theme-warning), 0.6));
  animation: light-pulse 2s ease-in-out infinite;
}

@keyframes light-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.05);
  }
}

/* Sensor Cards */
.sensor-card {
  border: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(var(--v-theme-surface), 0.5);
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}

.sensor-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, transparent, rgba(var(--v-theme-primary), 0.5), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.sensor-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.sensor-card:hover::before {
  opacity: 1;
}

.sensor-card-co2:hover {
  border-color: rgba(var(--v-theme-success), 0.5);
  box-shadow: 0 8px 24px rgba(var(--v-theme-success), 0.2);
}

.sensor-card-temp:hover {
  border-color: rgba(var(--v-theme-info), 0.5);
  box-shadow: 0 8px 24px rgba(var(--v-theme-info), 0.2);
}

.sensor-card-noise:hover {
  border-color: rgba(var(--v-theme-success), 0.5);
  box-shadow: 0 8px 24px rgba(var(--v-theme-success), 0.2);
}

.sensor-card-humidity:hover {
  border-color: rgba(var(--v-theme-success), 0.5);
  box-shadow: 0 8px 24px rgba(var(--v-theme-success), 0.2);
}

.sensor-card-motion:hover {
  border-color: rgba(var(--v-theme-error), 0.5);
  box-shadow: 0 8px 24px rgba(var(--v-theme-error), 0.2);
}

.sensor-card-pm25:hover {
  border-color: rgba(var(--v-theme-warning), 0.5);
  box-shadow: 0 8px 24px rgba(var(--v-theme-warning), 0.2);
}

.sensor-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(var(--v-theme-surface), 0.8) 0%, rgba(var(--v-theme-surface), 0.6) 100%);
  transition: all 0.3s ease;
  position: relative;
}

.sensor-icon-wrapper::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  padding: 2px;
  background: linear-gradient(135deg, transparent, rgba(var(--v-theme-primary), 0.3), transparent);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.sensor-card:hover .sensor-icon-wrapper {
  transform: scale(1.1) rotate(5deg);
}

.sensor-card:hover .sensor-icon-wrapper::after {
  opacity: 1;
}

.sensor-icon-success::after {
  background: linear-gradient(135deg, transparent, rgba(var(--v-theme-success), 0.4), transparent);
}

.sensor-icon-info::after {
  background: linear-gradient(135deg, transparent, rgba(var(--v-theme-info), 0.4), transparent);
}

.sensor-icon-error::after {
  background: linear-gradient(135deg, transparent, rgba(var(--v-theme-error), 0.4), transparent);
}

.sensor-icon-warning::after {
  background: linear-gradient(135deg, transparent, rgba(var(--v-theme-warning), 0.4), transparent);
}

/* CO2 Chart Card */
.co2-chart-card {
  border: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 16px;
  transition: all 0.3s ease;
  background: rgba(var(--v-theme-surface), 0.5);
  backdrop-filter: blur(10px);
}

.co2-chart-card:hover {
  border-color: rgba(var(--v-theme-success), 0.3);
  box-shadow: 0 8px 24px rgba(var(--v-theme-success), 0.15);
}

.co2-chart-title {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-bottom: 16px;
  margin-bottom: 0;
}

.co2-chart-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(var(--v-theme-success), 0.15) 0%, rgba(var(--v-theme-success), 0.1) 100%);
  border: 2px solid rgba(var(--v-theme-success), 0.2);
}

.co2-trend-header {
  background: linear-gradient(135deg, rgba(var(--v-theme-surface), 0.8) 0%, rgba(var(--v-theme-surface), 0.6) 100%);
  padding: 24px;
  border-radius: 16px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  backdrop-filter: blur(10px);
}

.co2-stat-card {
  padding: 16px;
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), 0.5);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  transition: all 0.3s ease;
}

.co2-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.co2-stat-min {
  border-left: 4px solid rgb(var(--v-theme-info));
}

.co2-stat-max {
  border-left: 4px solid rgb(var(--v-theme-error));
}

.co2-chart-container {
  position: relative;
  padding: 16px;
  background: rgba(var(--v-theme-surface), 0.3);
  border-radius: 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

/* Sensor Overlay on Room Layout */
.sensor-overlay {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 15;
  pointer-events: auto;
  transition: transform 0.15s ease;
}

.sensor-overlay.draggable {
  cursor: grab;
  user-select: none;
}

.sensor-overlay.draggable:active,
.sensor-overlay.dragging {
  cursor: grabbing;
  z-index: 100;
}

.sensor-overlay.dragging .sensor-overlay-card {
  opacity: 0.8;
  transform: scale(1.08);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

/* แถว AM319: 9 การ์ดเรียงแนวนอน — จุด x,y จาก devices.device_type = am319 */
.am319-sensor-row {
  position: absolute;
  z-index: 14;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px;
  max-width: 96%;
  overflow: visible;
  pointer-events: auto;
}

.am319-sensor-row.draggable {
  cursor: grab;
  user-select: none;
}

.am319-sensor-row.draggable:active,
.am319-sensor-row.dragging {
  cursor: grabbing;
}

.sensor-overlay--inline {
  position: relative;
  transform: none;
  flex: 0 0 auto;
}

.am319-sensor-row .sensor-overlay-card {
  min-width: 62px;
  padding: 5px 6px 4px;
}

.sensor-overlay-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px 5px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
  border: 1.5px solid var(--sensor-color, #666);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  min-width: 70px;
  text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  color: #fff;
}

.sensor-overlay:hover .sensor-overlay-card {
  transform: scale(1.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

.sensor-overlay-label {
  font-size: 0.6rem;
  font-weight: 600;
  opacity: 0.85;
  letter-spacing: 0.3px;
  white-space: nowrap;
  color: var(--sensor-color, #ccc);
}

.sensor-overlay-value {
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1.1;
  white-space: nowrap;
}

.sensor-overlay-unit {
  font-size: 0.55rem;
  font-weight: 500;
  opacity: 0.7;
  margin-left: 1px;
}

.sensor-remove-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 18px !important;
  height: 18px !important;
  min-width: 18px !important;
  z-index: 5;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sensor-overlay:hover .sensor-remove-btn {
  opacity: 1;
}

.sensor-add-floating {
  position: absolute;
  bottom: 10px;
  right: 10px;
  z-index: 20;
}

.sensor-add-btn {
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

.sensor-type-menu {
  min-width: 180px;
}

/* Floor Plan Styles */
.floor-plan-card {
  border: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 16px;
  transition: all 0.3s ease;
  background: rgba(var(--v-theme-surface), 0.5);
  backdrop-filter: blur(10px);
}

.floor-plan-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.floor-plan-container {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.floor-plan-image {
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
}

.floor-plan-devices-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 20;
}

.floor-plan-devices-overlay .floor-plan-device-icon {
  pointer-events: auto;
  position: absolute;
  transform: translate(-50%, -50%);
  cursor: pointer;
  z-index: 25;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.areas-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.people-count-overlay-badge {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 22;
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.92);
  color: rgb(var(--v-theme-on-primary));
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}

.area-box {
  position: absolute;
  border: 2px solid rgba(var(--v-theme-primary), 0.4);
  background: rgba(var(--v-theme-primary), 0.03);
  border-radius: 12px;
  pointer-events: all;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(1px);
}

.area-box::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.1) 0%, rgba(var(--v-theme-primary), 0.05) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.area-box:hover {
  border-color: rgba(var(--v-theme-primary), 0.6);
  background: rgba(var(--v-theme-primary), 0.08);
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(var(--v-theme-primary), 0.15), 
              0 0 40px rgba(var(--v-theme-primary), 0.1),
              inset 0 0 20px rgba(var(--v-theme-primary), 0.02);
}

.area-box:hover::before {
  opacity: 1;
}

.area-box:active {
  transform: scale(0.98);
}

.area-label {
  position: relative;
  z-index: 1;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
  padding: 12px;
  background: rgba(var(--v-theme-surface), 0.9);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.area-box:hover .area-label {
  background: rgba(var(--v-theme-surface), 1);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.area-label .v-icon {
  color: rgb(var(--v-theme-primary));
  transition: transform 0.3s ease;
}

.area-box:hover .area-label .v-icon {
  transform: scale(1.2);
}

.area-power-btn {
  flex-shrink: 0;
  text-transform: none;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* Pulse animation for area boxes */
@keyframes area-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(var(--v-theme-primary), 0);
  }
}

.area-box-clickable {
  animation: area-pulse 2s infinite;
}

.area-box-clickable:hover {
  animation: none;
}

/* Edit Mode Styles */
.area-box-editing {
  border-color: rgba(var(--v-theme-warning), 0.5) !important;
  background: rgba(var(--v-theme-warning), 0.05) !important;
  cursor: move;
}

.area-box-editing:hover {
  border-color: rgba(var(--v-theme-warning), 0.7) !important;
  background: rgba(var(--v-theme-warning), 0.1) !important;
}

.area-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 1.5rem;
  height: 1.5rem;
  background: rgb(var(--v-theme-warning));
  border: 2px solid rgb(var(--v-theme-surface));
  border-radius: 4px 0 0 0;
  cursor: nwse-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  color: rgb(var(--v-theme-on-warning));
  transition: all 0.2s ease;
}

.area-resize-handle:hover {
  width: 1.75rem;
  height: 1.75rem;
  background: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
}

.area-delete-btn {
  position: absolute;
  top: -12px;
  right: -12px;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.area-delete-btn:hover {
  transform: scale(1.1);
}

.area-box-editing .area-label {
  background: rgba(var(--v-theme-surface), 0.95);
  border: 1px solid rgba(var(--v-theme-warning), 0.5);
}

/* Area Name Editing Styles */
.area-name-display {
  cursor: default;
  user-select: none;
}

.area-name-editable {
  cursor: text;
  position: relative;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.area-name-editable:hover {
  background: rgba(var(--v-theme-primary), 0.1);
}

.area-edit-icon {
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.area-name-editable:hover .area-edit-icon {
  opacity: 1;
}

.area-name-edit {
  width: 100%;
  max-width: 12.5rem;
}

.area-name-input {
  font-size: 1.25rem;
  font-weight: bold;
}

.area-name-input :deep(.v-field__input) {
  padding: 4px 8px !important;
  min-height: auto !important;
  font-size: 1.25rem !important;
  font-weight: bold !important;
  text-align: center;
}

/* ===== Responsive ===== */
@media (max-width: 959.98px) {
  .building-placeholder {
    height: 9.375rem;
  }

  .icon-circle {
    width: 2.5rem;
    height: 2.5rem;
  }

  .icon-circle i {
    font-size: 1rem;
  }

  .area-label {
    padding: 0.5rem;
    font-size: 0.85rem;
  }
}

@media (max-width: 599.98px) {
  .room-layout-container {
    padding-bottom: 80%;
  }

  .building-placeholder {
    height: 7.5rem;
  }

  .icon-circle {
    width: 2.125rem;
    height: 2.125rem;
  }

  .icon-circle i {
    font-size: 0.875rem;
  }

  .area-label {
    padding: 0.375rem;
    font-size: 0.75rem;
  }

  .area-name-edit {
    max-width: 9.375rem;
  }

  .area-name-input :deep(.v-field__input) {
    font-size: 1rem !important;
  }
}
</style>
