<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick, toRaw, markRaw } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import Chart from 'chart.js/auto'
import { DEFAULT_DEVICE_TYPES, getDeviceTypeIcon, getDeviceTypeLabel } from '@/config/deviceTypes'

// Import images
import roomBackgroundImageUrl from '@/assets/images/สื่อ (14).jpg'
import fanImageUrl from '@/assets/images/fan.png'
import buildingImageUrl from '@/assets/images/A1006.jpg'
import floorPlanImageUrl from '@/assets/images/สื่อ (15) (1).jpg'

const roomBackgroundImage = roomBackgroundImageUrl
const fanImage = fanImageUrl
const buildingImage = buildingImageUrl

// รูปอาคาร: ถ้ามี building.image จาก DB ใช้ (เติม origin ของ backend สำหรับ /uploads)
// ถ้า VITE_API_BASE_URL เป็น full URL (เช่น http://localhost:5000/api) ใช้ origin นั้น ไม่ฉะนั้นใช้ window.origin (ต้อง proxy /uploads)
function buildingImageSrc(b) {
  if (!b?.image) return buildingImage
  if (b.image.startsWith('http')) return b.image
  if (typeof window === 'undefined') return b.image
  const apiBase = import.meta.env.VITE_API_BASE_URL || ''
  const backendOrigin = apiBase.startsWith('http') ? apiBase.replace(/\/api\/?$/, '') : ''
  const origin = backendOrigin || window.location.origin
  return origin.replace(/\/$/, '') + (b.image.startsWith('/') ? b.image : '/' + b.image)
}

// รูป area (floor plan) หรือ room: ถ้ามี .image จาก DB ใช้ URL ที่เข้าถึงได้ผ่านเว็บ ไม่ฉะนั้นใช้ fallback
function imageSrcFromDb(imageUrl, fallback) {
  if (!imageUrl || typeof imageUrl !== 'string') return fallback
  if (imageUrl.startsWith('http')) return imageUrl
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

// Check navigation state
const selectedFloor = computed(() => route.query.floor)
const selectedBuilding = computed(() => route.query.building)
const selectedArea = computed(() => route.query.area)
const selectedRoomFromQuery = computed(() => route.query.room)
const showBuildingList = computed(() => !selectedFloor.value)
const showFloorPlan = computed(() => selectedFloor.value && !selectedArea.value)
const showRoomControl = computed(() => selectedFloor.value && selectedArea.value)

// รูป floor plan: ดึงจาก area ของชั้นที่เลือก (area.image) ถ้ามี ไม่ฉะนั้นใช้รูป default
const currentFloorArea = computed(() => {
  const buildingId = Number(selectedBuilding.value)
  const floorNum = Number(selectedFloor.value)
  if (!buildingId || !floorNum) return null
  return areas.value.find(a => Number(a.building_id ?? a.buildingId) === buildingId && Number(a.floor) === floorNum) || null
})
const floorPlanImageDisplay = computed(() => {
  const area = currentFloorArea.value
  if (area?.image) return imageSrcFromDb(area.image, floorPlanImageUrl)
  return floorPlanImageUrl
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
// รองรับ URL รูปแบบ: /rooms/control?building=1&floor=3&area=Mercury&room=28
// โดย room อาจเป็น "room id" หรือ "เลขห้อง/ชื่อห้อง" → map เป็น room.id ที่แท้จริง
const _norm = v => String(v ?? '').trim().toLowerCase()
const _toNumOrNull = v => {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) && !Number.isNaN(n) ? n : null
}

const resolveAreaFromQuery = () => {
  const buildingId = _toNumOrNull(selectedBuilding.value)
  const floorNumber = _toNumOrNull(selectedFloor.value)
  const areaName = _norm(selectedArea.value)
  if (!buildingId || floorNumber === null || !areaName) return null

  // Prefer DB area match (building + floor + name)
  const dbArea = areas.value.find(a =>
    Number(a.building_id) === buildingId
    && Number(a.floor) === floorNumber
    && _norm(a.name) === areaName,
  )
  if (dbArea) return { source: 'db', area: dbArea }

  // Fallback: floorPlanArea name exists but not in DB yet
  return { source: 'plan', area: { name: selectedArea.value } }
}

const resolveRoomIdFromQuery = () => {
  const roomQueryRaw = selectedRoomFromQuery.value
  if (roomQueryRaw === undefined || roomQueryRaw === null || String(roomQueryRaw).trim() === '') return null

  const buildingId = _toNumOrNull(selectedBuilding.value)
  const floorNumber = _toNumOrNull(selectedFloor.value)
  const areaMatch = resolveAreaFromQuery()

  // Candidate rooms (prefer rooms under matched DB area)
  let candidateRooms = rooms.value
  if (areaMatch?.source === 'db') {
    candidateRooms = rooms.value.filter(r => Number(r.area_id) === Number(areaMatch.area.id))
  } else if (buildingId && floorNumber !== null) {
    // If DB area not found, still constrain by building/floor if possible
    const candidateAreaIds = areas.value
      .filter(a => Number(a.building_id) === buildingId && Number(a.floor) === floorNumber)
      .map(a => Number(a.id))
    if (candidateAreaIds.length) {
      candidateRooms = rooms.value.filter(r => candidateAreaIds.includes(Number(r.area_id)))
    }
  }

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
  const areaMatch = resolveAreaFromQuery()
  if (!areaMatch) return null

  // If DB area exists, pick first room in that area
  if (areaMatch.source === 'db') {
    const areaRooms = rooms.value.filter(r => Number(r.area_id) === Number(areaMatch.area.id))
    return areaRooms[0]?.id ?? null
  }

  // Fallback: use hardcoded mapping (areas not yet connected to DB)
  const mappedRoomName = areaRoomMapping[selectedArea.value]
  if (mappedRoomName) {
    const room = rooms.value.find(r => _norm(r.name) === _norm(mappedRoomName))
      || rooms.value.find(r => _norm(r.name).includes(_norm(mappedRoomName)))
    return room?.id ?? null
  }

  return null
}

const isSuperAdmin = computed(() => authStore.isSuperAdmin)

// Show all buildings (removed filter for "อาคาร A" only)
const filteredBuildings = computed(() => {
  return buildings.value
})

// Get available floors for selected building (จาก building.floors หรือ derive จาก areas)
const availableFloors = computed(() => {
  if (!selectedBuilding.value) return []
  const buildingId = Number(selectedBuilding.value)
  const building = buildings.value.find(b => Number(b.id) === buildingId)
  if (building && building.floors && building.floors.length > 0) {
    return building.floors.map(floor => ({
      value: Number(floor.floor ?? floor),
      title: `ชั้น ${floor.floor ?? floor}`,
    }))
  }
  // Fallback: ดึงชั้นจาก areas ของอาคารนี้
  const buildingAreas = areas.value.filter(a => Number(a.building_id ?? a.buildingId) === buildingId)
  const floorSet = new Set()
  buildingAreas.forEach(a => {
    const f = Number(a.floor ?? a.Floor)
    if (!Number.isNaN(f)) floorSet.add(f)
  })
  return Array.from(floorSet).sort((a, b) => a - b).map(f => ({
    value: f,
    title: `ชั้น ${f}`,
  }))
})

// Get available rooms for selected building, floor, and area
const availableRooms = computed(() => {
  if (!selectedBuilding.value || !selectedFloor.value) return []
  
  try {
    const buildingId = Number(selectedBuilding.value)
    const floorNumber = Number(selectedFloor.value)
    
    const currentFloorAreas = areas.value.filter(area => {
      const aBuildingId = Number(area.building_id ?? area.buildingId)
      const aFloor = Number(area.floor ?? area.Floor)
      return aBuildingId === buildingId && aFloor === floorNumber
    })
    
    if (currentFloorAreas.length === 0) return []

    // ถ้ามี area ที่เลือกอยู่ → กรองเฉพาะห้องของ area นั้น
    let targetAreas = currentFloorAreas
    if (selectedArea.value) {
      const areaName = _norm(selectedArea.value)
      const matched = currentFloorAreas.filter(a => _norm(a.name) === areaName)
      if (matched.length > 0) targetAreas = matched
    }
    
    const areaIds = targetAreas.map(a => Number(a.id))
    const filteredRooms = rooms.value.filter(room => {
      const rid = Number(room.area_id ?? room.areaId)
      return areaIds.includes(rid)
    })
    
    return filteredRooms.map(room => {
      const rawName = room.name ?? room.Name
      const rawArea = room.area_name ?? room.Area_name
      const name = (rawName && String(rawName).trim()) || (rawArea && String(rawArea).trim()) || null
      return {
        value: room.id,
        title: name || `ห้อง ${room.id}`,
      }
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
const floorPlanAreas = ref([
  { id: 1, name: 'Mercury', icon: 'tabler-box', top: 15, left: 8, width: 25, height: 30 },
  { id: 2, name: 'Earth', icon: 'tabler-layout-grid', top: 20, left: 38, width: 28, height: 40 },
  { id: 3, name: 'Jupiter', icon: 'tabler-home', top: 25, left: 70, width: 22, height: 35 },
  { id: 4, name: 'Mars', icon: 'tabler-square', top: 55, left: 8, width: 25, height: 30 },
  { id: 5, name: 'Venus', icon: 'tabler-apps', top: 60, left: 38, width: 28, height: 25 },
])

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
  erv: []
}) // Store device states for all rooms in floor/area

// System Control Button Position and Size (for single button - deprecated)
const systemControlPosition = ref({ top: 20, right: 20 })
const systemControlSize = ref({ width: 80, height: 80 }) // Icon circle size
const draggingSystemControl = ref(false)
const dragSystemControlStart = ref({ x: 0, y: 0, top: 0, right: 0 })
const resizingSystemControl = ref(false)
const resizeSystemControlStart = ref({ x: 0, y: 0, width: 0, height: 0 })

// Per-room device states (for individual room control buttons)
const roomDeviceStates = ref({}) // { roomId: { light: [], ac: [], erv: [] } }
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
  
  const hasLightOn = lightStates.length > 0 && lightStates.some(state => state === true)
  const hasAcOn = acStates.length > 0 && acStates.some(state => state === true)
  const hasErvOn = ervStates.length > 0 && ervStates.some(state => state === true)
  
  const result = hasLightOn || hasAcOn || hasErvOn
  
  // Debug logging
  if (result) {
    console.log('allSystemsOn computed - Device states:', {
      light: lightStates,
      ac: acStates,
      erv: ervStates,
      hasLightOn,
      hasAcOn,
      hasErvOn,
      result
    })
  }
  
  return result
})

// Get rooms for each area in floor plan
const areaRoomsMap = computed(() => {
  const map = {}
  if (!selectedBuilding.value || !selectedFloor.value) return map
  
  console.log('Computing areaRoomsMap...')
  console.log('Available rooms:', rooms.value.map(r => ({ id: r.id, name: r.name })))
  
  floorPlanAreas.value.forEach(area => {
    let room = null
    
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
      // Find room from database area
      const dbArea = areas.value.find(a => {
        const areaBuildingId = String(a.building_id)
        const areaFloor = String(a.floor)
        const buildingIdStr = String(selectedBuilding.value)
        const floorNumberStr = String(selectedFloor.value)
        return a.name === area.name && areaBuildingId === buildingIdStr && areaFloor === floorNumberStr
      })
      
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
  
  return hasLightOn || hasAcOn || hasErvOn
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
})

const ervSettings = reactive({
  speed: [],
  mode: [],
})

const acSettings = reactive({
  mode: [],
})

const controls = reactive({
  light: false,
  ac: false,
  erv: false,
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
})

// Sensor type definitions for AM319 & Noise
const sensorTypeDefinitions = {
  co2: { label: 'CO2', icon: 'tabler-cloud', color: '#4caf50', unit: 'ppm', key: 'co2' },
  temperature: { label: 'Temperature', icon: 'tabler-temperature', color: '#2196f3', unit: '°C', key: 'temp' },
  noise: { label: 'Noise', icon: 'tabler-volume', color: '#ff9800', unit: 'dB', key: 'noise' },
  humidity: { label: 'Humidity', icon: 'tabler-droplet', color: '#00bcd4', unit: '%', key: 'humidity' },
  motion: { label: 'Motion', icon: 'tabler-walk', color: '#f44336', unit: '', key: 'motion' },
  pm25: { label: 'PM2.5', icon: 'tabler-grain', color: '#9c27b0', unit: 'µg/m³', key: 'pm25' },
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
  return val != null ? val : '--'
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
    const allRooms = roomsResponse.data.data || []
    
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

  // Initialize device positions (default layout)
  devicePositions.light = [
    { x: 15, y: 20 }, { x: 25, y: 20 }, { x: 35, y: 20 }, { x: 45, y: 20 },
    { x: 55, y: 20 }, { x: 65, y: 20 }, { x: 75, y: 20 }, { x: 85, y: 20 },
    { x: 15, y: 80 }, { x: 25, y: 80 }, { x: 35, y: 80 }, { x: 45, y: 80 },
    { x: 55, y: 80 }, { x: 65, y: 80 },
  ]
  
  devicePositions.ac = [
    { x: 20, y: 50 }, { x: 50, y: 50 }, { x: 80, y: 50 },
  ]
  
  devicePositions.erv = [
    { x: 30, y: 30 }, { x: 50, y: 30 }, { x: 70, y: 30 },
  ]

  // Ensure minimum device counts (AC: 3, ERV: 3)
  if (devicePositions.ac.length < 3) {
    devicePositions.ac = [
      { x: 20, y: 50 }, { x: 50, y: 50 }, { x: 80, y: 50 },
    ]
  }
  if (devicePositions.erv.length < 3) {
    devicePositions.erv = [
      { x: 30, y: 30 }, { x: 50, y: 30 }, { x: 70, y: 30 },
    ]
  }

  // Initialize with default values (will be overwritten by API data)
  const maxLightBulbs = 14
  const tempDeviceStates = {
    light: new Array(Math.min(devicePositions.light.length, maxLightBulbs)).fill(false),
    ac: new Array(3).fill(false),
    erv: new Array(3).fill(false),
  }
  
  const tempAcSettings = {
    mode: new Array(3).fill('off'), // Default to 'off' to match Home Assistant
  }
  
  const tempAcTemperatures = new Array(3).fill(25)
  
  const tempErvSettings = {
    speed: new Array(3).fill('low'),
    mode: new Array(3).fill('normal'),
  }

  try {
    // Load device states from API (now includes synced data from HA)
    const response = await api.get(`/rooms/${selectedRoomId.value}/devices`)
    console.log('=== API Response ===')
    console.log('Full response:', response.data)
    if (response.data && response.data.data) {
      const devices = response.data.data
      console.log('Device states from API:', devices.deviceStates)
      if (devices.deviceStates) {
        // Load light states
        if (devices.deviceStates.light) {
          const lightStatesToLoad = devices.deviceStates.light.slice(0, maxLightBulbs)
          tempDeviceStates.light = lightStatesToLoad.map(state => 
            state.status === true || state.status === 1 || state.status === 'on'
          )
        }
        
        // Load AC states (ensure 3 units)
        if (devices.deviceStates.ac) {
          // Handle sparse array (may have null values)
          const acStates = []
          for (let i = 0; i < 3; i++) {
            if (devices.deviceStates.ac[i] && devices.deviceStates.ac[i] !== null) {
              // Has data at this index
              acStates[i] = devices.deviceStates.ac[i].status === true || 
                           devices.deviceStates.ac[i].status === 1 || 
                           devices.deviceStates.ac[i].status === 'on'
            } else {
              // No data at this index, default to false
              acStates[i] = false
            }
          }
          // Ensure we have exactly 3 elements
          while (acStates.length < 3) {
            acStates.push(false)
          }
          tempDeviceStates.ac = acStates.slice(0, 3)
          console.log('Loaded AC states:', tempDeviceStates.ac)
          
          // Load device IDs for AC units (for Home Assistant integration)
          for (let i = 0; i < 3; i++) {
            if (devices.deviceStates.ac[i] && devices.deviceStates.ac[i] !== null) {
              const ac = devices.deviceStates.ac[i]
              if (ac.device_id || ac.deviceId) {
                acDeviceIds.value[i] = ac.device_id || ac.deviceId
              }
            }
          }
          
          // Load mode from settings object (if exists) - handle sparse array
          const modes = []
          for (let i = 0; i < 3; i++) {
            if (devices.deviceStates.ac[i] && devices.deviceStates.ac[i] !== null) {
              const ac = devices.deviceStates.ac[i]
              // Try direct property first, then settings object
              if (ac.mode) {
                modes[i] = ac.mode
              } else if (ac.settings && ac.settings.mode) {
                modes[i] = ac.settings.mode
              } else {
                modes[i] = 'off' // default value
              }
            } else {
              modes[i] = 'off' // default value for missing index
            }
          }
          console.log('Loaded AC modes from API:', modes)
          tempAcSettings.mode = modes.slice(0, 3)
          
          // Load temperature from settings object (if exists) - handle sparse array
          const temps = []
          for (let i = 0; i < 3; i++) {
            if (devices.deviceStates.ac[i] && devices.deviceStates.ac[i] !== null) {
              const ac = devices.deviceStates.ac[i]
              // Try direct property first, then settings object
              if (ac.temperature !== undefined) {
                temps[i] = ac.temperature
              } else if (ac.settings && ac.settings.temperature !== undefined) {
                temps[i] = ac.settings.temperature
              } else {
                temps[i] = 25 // default value
              }
            } else {
              temps[i] = 25 // default value for missing index
            }
          }
          console.log('Loaded AC temperatures from API:', temps)
          for (let i = 0; i < 3; i++) {
            tempAcTemperatures[i] = temps[i]
          }
        }
        
        // Load ERV states (ensure 3 units)
        if (devices.deviceStates.erv) {
          console.log('=== ERV Data from API ===')
          console.log('Raw ERV data:', JSON.stringify(devices.deviceStates.erv, null, 2))
          
          const ervStates = devices.deviceStates.erv.map(state => 
            state.status === true || state.status === 1 || state.status === 'on'
          )
          // Pad to 3 units if needed
          while (ervStates.length < 3) {
            ervStates.push(false)
          }
          tempDeviceStates.erv = ervStates.slice(0, 3)
          
          // Load device IDs for ERV units (for Home Assistant integration)
          devices.deviceStates.erv.forEach((erv, idx) => {
            if (erv.device_id || erv.deviceId) {
              ervDeviceIds.value[idx] = erv.device_id || erv.deviceId
            }
          })
          
          // Load speed data from settings object (fixed path)
          const speeds = devices.deviceStates.erv.map(erv => {
            // Check if settings exists and has speed property
            if (erv.settings && erv.settings.speed) {
              return erv.settings.speed
            }
            return 'low' // default value
          })
          while (speeds.length < 3) {
            speeds.push('low')
          }
          console.log('✅ Loaded ERV speeds from API:', speeds)
          tempErvSettings.speed = speeds.slice(0, 3)
          
          // Load mode data from settings object (fixed path)
          const modes = devices.deviceStates.erv.map(erv => {
            // Check if settings exists and has mode property
            if (erv.settings && erv.settings.mode) {
              return erv.settings.mode
            }
            return 'normal' // default value
          })
          while (modes.length < 3) {
            modes.push('normal')
          }
          console.log('✅ Loaded ERV modes from API:', modes)
          tempErvSettings.mode = modes.slice(0, 3)
        } else {
          console.log('⚠️ No ERV data in API response')
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
  
  acSettings.mode.splice(0, acSettings.mode.length, ...tempAcSettings.mode)
  acTemperatures.splice(0, acTemperatures.length, ...tempAcTemperatures)
  
  ervSettings.speed.splice(0, ervSettings.speed.length, ...tempErvSettings.speed)
  ervSettings.mode.splice(0, ervSettings.mode.length, ...tempErvSettings.mode)
  
  console.log('Final ERV settings after load:', {
    speed: ervSettings.speed,
    mode: ervSettings.mode
  })

  // Update control switches based on device states
  controls.light = deviceStates.light.some(state => state)
  controls.ac = deviceStates.ac.some(state => state)
  controls.erv = deviceStates.erv.some(state => state)

  // Initialize CO2 chart
  initCO2Chart()
  
  // Load device positions
  loadDevicePositions()
  
  // Load sensor overlays for this room
  loadSensorOverlays()
  
  // Start fetching AM319 sensor data
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
const acDeviceIds = ref({}) // { index: deviceId }

// Store device IDs for ERV units (mapped by index)
const ervDeviceIds = ref({}) // { index: deviceId }

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
const shouldUseHomeAssistant = (type, index) => {
  if (type === 'ac') {
    // Check by device ID if available
    const deviceId = acDeviceIds.value[index]
    if (deviceId === HA_AIR_DEVICE_ID) {
      return true
    }
    // Fallback: Use index 1 for air_02 (second AC unit)
    return index === 1
  }
  
  if (type === 'erv') {
    // Check by device ID if available
    const deviceId = ervDeviceIds.value[index]
    if (deviceId === HA_ERV_DEVICE_ID) {
      return true
    }
    // Fallback: Use index 0 for ERV_U1 (first ERV unit)
    return index === 0
  }
  
  if (type === 'light') {
    // Use index 0 for light.lights_17 (first light unit in room 28)
    // สามารถขยายได้ในอนาคตถ้ามี light หลายตัว
    return index === 0
  }
  
  return false
}

const toggleDevice = async (type, index) => {
  if (!selectedRoomId.value) return

  const isOn = deviceStates[type][index]
  deviceStates[type][index] = !isOn
  lastUpdateTime.value = Date.now()

  try {
    // Check if this device should use Home Assistant API
    if (shouldUseHomeAssistant(type, index)) {
      if (type === 'ac') {
        const action = !isOn ? 'on' : 'off'
        const temperature = acTemperatures[index] || 25
        const hvacMode = acSettings.mode[index] || 'off'
        // Map mode to API format
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
      
      if (type === 'erv' && ervSettings.speed[index]) {
        payload.speed = ervSettings.speed[index]
        payload.mode = ervSettings.mode[index] || 'normal'
      }

      await api.post(`/rooms/${selectedRoomId.value}/devices/${type}/${index}`, payload)
    }
    
    // Update control switch
    if (type === 'light') {
      controls.light = deviceStates.light.some(state => state)
    } else if (type === 'ac') {
      controls.ac = deviceStates.ac.some(state => state)
    } else if (type === 'erv') {
      controls.erv = deviceStates.erv.some(state => state)
    }
  } catch (error) {
    console.error(`Error toggling device:`, error)
    deviceStates[type][index] = isOn // Revert on error
  }
}

const getDeviceState = (type, index) => {
  return deviceStates[type] && deviceStates[type][index] === true
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
  if (!selectedRoomId.value) return
  
  ervSettings.speed[index] = speed
  lastUpdateTime.value = Date.now()
  
  console.log(`Updating ERV ${index} speed to:`, speed)
  
  try {
    // Check if this device should use Home Assistant API
    if (shouldUseHomeAssistant('erv', index)) {
      // Map speed to level: 'low' -> 'low', 'high' -> 'high'
      const level = speed === 'high' ? 'high' : 'low'
      await setErvLevelViaHomeAssistant(level)
    } else {
      // Always update via API (regardless of on/off state) to persist settings
      const currentStatus = getDeviceState('erv', index)
      const payload = {
        status: currentStatus, // Use current status (on/off)
        speed: speed,
        mode: ervSettings.mode[index] || 'normal',
      }
      console.log('Sending ERV speed update:', payload)
      const response = await api.post(`/rooms/${selectedRoomId.value}/devices/erv/${index}`, payload)
      console.log('ERV speed update response:', response.data)
    }
  } catch (error) {
    console.error('Error updating ERV speed:', error)
  }
}

const updateERVMode = async (index, mode) => {
  if (!selectedRoomId.value) return
  
  ervSettings.mode[index] = mode
  lastUpdateTime.value = Date.now()
  
  console.log(`Updating ERV ${index} mode to:`, mode)
  
  try {
    // Check if this device should use Home Assistant API
    if (shouldUseHomeAssistant('erv', index)) {
      // Map mode: 'normal' -> 'normal', 'heat' -> 'heat'
      const haMode = mode === 'heat' ? 'heat' : 'normal'
      await setErvModeViaHomeAssistant(haMode)
    } else {
      // Always update via API (regardless of on/off state) to persist settings
      const currentStatus = getDeviceState('erv', index)
      const payload = {
        status: currentStatus, // Use current status (on/off)
        speed: ervSettings.speed[index] || 'low',
        mode: mode,
      }
      console.log('Sending ERV mode update:', payload)
      const response = await api.post(`/rooms/${selectedRoomId.value}/devices/erv/${index}`, payload)
      console.log('ERV mode update response:', response.data)
    }
  } catch (error) {
    console.error('Error updating ERV mode:', error)
  }
}

const updateACMode = async (index, mode) => {
  if (!selectedRoomId.value) return
  
  acSettings.mode[index] = mode
  lastUpdateTime.value = Date.now()
  
  // Map frontend mode values to API mode values
  const apiMode = mapModeToAPI(mode)
  
  // If AC is on, update via API
  if (getDeviceState('ac', index)) {
    try {
      // Check if this device should use Home Assistant API
      if (shouldUseHomeAssistant('ac', index)) {
        await setAirModeViaHomeAssistant(apiMode)
      } else {
        await api.post(`/rooms/${selectedRoomId.value}/devices/ac/${index}`, {
          status: true,
          mode: apiMode,
          temperature: acTemperatures[index] || 25,
        })
      }
    } catch (error) {
      console.error('Error updating AC mode:', error)
    }
  }
}

const updateACTemperature = async (index, temperature) => {
  if (!selectedRoomId.value) return
  
  acTemperatures[index] = temperature
  lastUpdateTime.value = Date.now()
  
  // If AC is on, update via API
  if (getDeviceState('ac', index)) {
    try {
      // Check if this device should use Home Assistant API
      if (shouldUseHomeAssistant('ac', index)) {
        await setAirTemperatureViaHomeAssistant(temperature)
      } else {
        // Map mode to API format
        const apiMode = mapModeToAPI(acSettings.mode[index] || 'cool')
        await api.post(`/rooms/${selectedRoomId.value}/devices/ac/${index}`, {
          status: true,
          mode: apiMode,
          temperature: temperature,
        })
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

const closeDeviceModal = () => {
  showDeviceModal.value = false
  selectedDevice.type = ''
  selectedDevice.index = -1
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

// Load device positions from API
const loadDevicePositions = async () => {
  if (!selectedRoomId.value) return
  
  // Default positions (required: AC 3, ERV 3)
  const defaultACPositions = [
    { x: 20, y: 50 }, { x: 50, y: 50 }, { x: 80, y: 50 },
  ]
  const defaultERVPositions = [
    { x: 30, y: 30 }, { x: 50, y: 30 }, { x: 70, y: 30 },
  ]
  const defaultLightPositions = [
    { x: 15, y: 20 }, { x: 25, y: 20 }, { x: 35, y: 20 }, { x: 45, y: 20 },
    { x: 55, y: 20 }, { x: 65, y: 20 }, { x: 75, y: 20 }, { x: 85, y: 20 },
    { x: 15, y: 80 }, { x: 25, y: 80 }, { x: 35, y: 80 }, { x: 45, y: 80 },
    { x: 55, y: 80 }, { x: 65, y: 80 },
  ]
  
  try {
    const response = await api.get(`/rooms/${selectedRoomId.value}/device-positions`)
    if (response.data && response.data.success && response.data.data) {
      const positions = response.data.data
      
      // Only use API positions if they meet minimum requirements
      // AC must have 3 units
      if (positions.ac && Array.isArray(positions.ac) && positions.ac.length >= 3) {
        devicePositions.ac = positions.ac.slice(0, 3) // Take first 3
      } else {
        devicePositions.ac = [...defaultACPositions]
      }
      
      // ERV must have 3 units
      if (positions.erv && Array.isArray(positions.erv) && positions.erv.length >= 3) {
        devicePositions.erv = positions.erv.slice(0, 3) // Take first 3
      } else {
        devicePositions.erv = [...defaultERVPositions]
      }
      
      // Light positions (use API if available, otherwise default)
      if (positions.light && Array.isArray(positions.light) && positions.light.length > 0) {
        devicePositions.light = positions.light
      } else {
        devicePositions.light = [...defaultLightPositions]
      }
    } else {
      // No API data, use defaults
      devicePositions.ac = [...defaultACPositions]
      devicePositions.erv = [...defaultERVPositions]
      devicePositions.light = [...defaultLightPositions]
    }
  } catch (error) {
    console.log('Device positions API error, using default positions:', error.message)
    // Use default positions if API fails
    devicePositions.ac = [...defaultACPositions]
    devicePositions.erv = [...defaultERVPositions]
    devicePositions.light = [...defaultLightPositions]
  }
  
  // Final check to ensure minimum requirements
  if (!devicePositions.ac || devicePositions.ac.length < 3) {
    devicePositions.ac = [...defaultACPositions]
  }
  if (!devicePositions.erv || devicePositions.erv.length < 3) {
    devicePositions.erv = [...defaultERVPositions]
  }
  if (!devicePositions.light || devicePositions.light.length === 0) {
    devicePositions.light = [...defaultLightPositions]
  }
}

// Save device positions to API (ลง rooms.x1,y1,x2,y2 และ device_positions)
const saveDevicePositions = async () => {
  if (!selectedRoomId.value) {
    console.warn('saveDevicePositions: ไม่มีห้องที่เลือก (selectedRoomId เป็น null)')
    return
  }
  
  const positions = {
    erv: [...devicePositions.erv],
    ac: [...devicePositions.ac],
    light: [...devicePositions.light],
  }
  
  try {
    await api.post(`/rooms/${selectedRoomId.value}/device-positions`, { positions })
    console.log('บันทึกตำแหน่งสำเร็จ roomId=', selectedRoomId.value)
  } catch (error) {
    console.error('Error saving device positions:', error)
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

// Start auto-refresh for sensor data
const startSensorDataAutoRefresh = () => {
  if (sensorDataRefreshInterval.value) {
    clearInterval(sensorDataRefreshInterval.value)
  }
  
  // Fetch immediately
  fetchAm319SensorData()
  
  // Then fetch every 30 seconds
  sensorDataRefreshInterval.value = setInterval(() => {
    fetchAm319SensorData()
  }, 30000)
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

const selectFloor = (buildingId, floor) => {
  router.push({
    name: 'rooms-control',
    query: {
      building: buildingId,
      floor: floor,
    },
  })
}

const selectArea = async (areaName) => {
  // Navigate to control page with area in query (area page removed)
  router.push({
    name: 'rooms-control',
    query: {
      building: selectedBuilding.value,
      floor: selectedFloor.value,
      area: areaName,
    },
  })
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

// Handle floor dropdown change
const handleFloorChange = async (floor) => {
  // Always load data from fetchBuildings (same as building list page)
  await fetchBuildings()
  
  router.push({
    name: 'rooms-control',
    query: {
      building: selectedBuilding.value,
      floor: floor,
    },
  })
}

// Handle room dropdown change
const handleRoomChange = (roomId) => {
  selectedRoomId.value = roomId
  // Update URL with room
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
      floor: selectedFloor.value,
    },
  })
  // Refresh device states when returning to floor plan
  nextTick(() => {
    checkFloorDeviceStates()
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
  try {
    // Save to localStorage or API
    const floorPlanKey = `floorPlan_${selectedBuilding.value}_${selectedFloor.value}`
    localStorage.setItem(floorPlanKey, JSON.stringify(floorPlanAreas.value))
    
    // Save system control button position and size
    const systemControlKey = `systemControl_${selectedBuilding.value}_${selectedFloor.value}`
    localStorage.setItem(systemControlKey, JSON.stringify({
      position: systemControlPosition.value,
      size: systemControlSize.value
    }))
    
    // Optionally save to API
    // await api.post(`/buildings/${selectedBuilding.value}/floors/${selectedFloor.value}/areas`, {
    //   areas: floorPlanAreas.value
    // })
    
    floorPlanEditMode.value = false
  } catch (error) {
    console.error('Error saving floor plan areas:', error)
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
    
    const floorPlanKey = `floorPlan_${selectedBuilding.value}_${selectedFloor.value}`
    const saved = localStorage.getItem(floorPlanKey)
    if (saved) {
      floorPlanAreas.value = JSON.parse(saved)
    } else {
      // ไม่มี layout ที่บันทึกไว้ → สร้าง area boxes จาก areas ใน DB ของ building+floor นี้
      const buildingId = Number(selectedBuilding.value)
      const floorNum = Number(selectedFloor.value)
      const currentFloorAreas = areas.value.filter(
        a => Number(a.building_id ?? a.buildingId) === buildingId && Number(a.floor) === floorNum
      )
      if (currentFloorAreas.length > 0) {
        const cols = 2
        const rows = Math.ceil(currentFloorAreas.length / cols)
        const cellW = 45
        const cellH = Math.min(40, Math.max(25, 85 / rows))
        const gap = 5
        floorPlanAreas.value = currentFloorAreas.map((area, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          return {
            id: area.id,
            name: area.name || `Area ${area.id}`,
            icon: 'tabler-layout-grid',
            top: gap + row * cellH,
            left: gap + col * (100 - gap * 2) / cols,
            width: cellW,
            height: cellH - 2,
          }
        })
      } else {
        floorPlanAreas.value = []
      }
    }

    // Load system control button position and size
    const systemControlKey = `systemControl_${selectedBuilding.value}_${selectedFloor.value}`
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
  const systemControlKey = `systemControl_${selectedBuilding.value}_${selectedFloor.value}`
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
  const systemControlKey = `systemControl_${selectedBuilding.value}_${selectedFloor.value}`
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
      erv: []
    }
    
    if (deviceStates.light && Array.isArray(deviceStates.light)) {
      states.light = deviceStates.light.map(light => light.status === true || light.status === 1 || light.status === 'on')
    }
    
    if (deviceStates.ac && Array.isArray(deviceStates.ac)) {
      states.ac = deviceStates.ac.map(ac => ac.status === true || ac.status === 1 || ac.status === 'on')
    }
    
    if (deviceStates.erv && Array.isArray(deviceStates.erv)) {
      states.erv = deviceStates.erv.map(erv => erv.status === true || erv.status === 1 || erv.status === 'on')
    }
    
    roomDeviceStates.value[roomId] = states
  } catch (error) {
    console.error(`Error loading device states for room ${roomId}:`, error)
    roomDeviceStates.value[roomId] = { light: [], ac: [], erv: [] }
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

// Load device states for all rooms in floor plan
const loadAllRoomDeviceStates = async () => {
  const roomIds = Object.values(areaRoomsMap.value).map(room => room.id)
  await Promise.all(roomIds.map(roomId => loadRoomDeviceStates(roomId)))
  // Load button positions for all rooms
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
  if (!selectedBuilding.value || !selectedFloor.value) return
  
  const key = `roomControlPositions_${selectedBuilding.value}_${selectedFloor.value}`
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
  if (!selectedBuilding.value || !selectedFloor.value) return
  
  const key = `roomControlPositions_${selectedBuilding.value}_${selectedFloor.value}`
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
    const areaName = selectedArea.value
    
    if (!buildingId || !floorNumber) {
      floorDeviceStates.value = { light: [], ac: [], erv: [] }
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
    const currentFloorAreaIds = areas.value
      .filter(a => String(a.building_id) === buildingIdStr && String(a.floor) === floorNumberStr)
      .map(a => a.id)
    let targetRooms = allRooms.filter(room => currentFloorAreaIds.includes(room.area_id))
    
    console.log(`Found ${targetRooms.length} rooms in Building ${buildingId}, Floor ${floorNumber} (from areas.floor) (before area filter)`)
    
    if (areaName) {
      const targetArea = areas.value.find(a => {
        const areaBuildingId = String(a.building_id)
        const areaFloor = String(a.floor)
        return a.name === areaName && areaBuildingId === buildingIdStr && areaFloor === floorNumberStr
      })
      if (targetArea) {
        targetRooms = targetRooms.filter(room => room.area_id === targetArea.id)
        console.log(`Filtered to ${targetRooms.length} rooms in Area ${areaName} (ID: ${targetArea.id})`)
      } else {
        console.warn(`Area "${areaName}" not found in Building ${buildingId}, Floor ${floorNumber}`)
      }
    } else {
      console.log(`No area filter - checking all ${targetRooms.length} rooms in floor`)
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
          light: deviceStates.light?.map(l => ({ status: l.status, raw: l })),
          ac: deviceStates.ac?.map(a => ({ status: a.status, raw: a })),
          erv: deviceStates.erv?.map(e => ({ status: e.status, raw: e }))
        })
        
        // Debug: Show actual status values
        if (deviceStates.light) {
          const lightStatuses = deviceStates.light.map(l => l.status)
          console.log(`  Light actual statuses:`, lightStatuses)
          console.log(`  Light has any ON:`, lightStatuses.some(s => s === true || s === 1 || s === 'on'))
        }
        if (deviceStates.ac) {
          const acStatuses = deviceStates.ac.map(a => a.status)
          console.log(`  AC actual statuses:`, acStatuses)
          console.log(`  AC has any ON:`, acStatuses.some(s => s === true || s === 1 || s === 'on'))
        }
        if (deviceStates.erv) {
          const ervStatuses = deviceStates.erv.map(e => e.status)
          console.log(`  ERV actual statuses:`, ervStatuses)
          console.log(`  ERV has any ON:`, ervStatuses.some(s => s === true || s === 1 || s === 'on'))
        }
        return deviceStates
      } catch (error) {
        console.error(`Error fetching devices for room ${room.id}:`, error)
        return { light: [], ac: [], erv: [] }
      }
    })
    
    const allDeviceStates = await Promise.all(deviceStatePromises)
    
    // Aggregate all device states - check if ANY device is on
    const aggregatedStates = {
      light: [],
      ac: [],
      erv: []
    }
    
    // Check if any device is on across all rooms
    let hasAnyLightOn = false
    let hasAnyAcOn = false
    let hasAnyErvOn = false
    
    allDeviceStates.forEach(roomStates => {
      // Check light devices
      if (roomStates.light && Array.isArray(roomStates.light)) {
        const hasLightOn = roomStates.light.some(light => {
          return light.status === true || light.status === 1 || light.status === 'on'
        })
        hasAnyLightOn = hasAnyLightOn || hasLightOn
      }
      
      // Check AC devices
      if (roomStates.ac && Array.isArray(roomStates.ac)) {
        const hasAcOn = roomStates.ac.some(ac => {
          return ac.status === true || ac.status === 1 || ac.status === 'on'
        })
        hasAnyAcOn = hasAnyAcOn || hasAcOn
      }
      
      // Check ERV devices
      if (roomStates.erv && Array.isArray(roomStates.erv)) {
        const hasErvOn = roomStates.erv.some(erv => {
          return erv.status === true || erv.status === 1 || erv.status === 'on'
        })
        hasAnyErvOn = hasAnyErvOn || hasErvOn
      }
    })
    
    // Set aggregated states - use array with at least one element to indicate status
    aggregatedStates.light = [hasAnyLightOn]
    aggregatedStates.ac = [hasAnyAcOn]
    aggregatedStates.erv = [hasAnyErvOn]
    
    floorDeviceStates.value = aggregatedStates
    console.log('Floor device states:', floorDeviceStates.value)
    console.log(`Has any device on - Light: ${hasAnyLightOn}, AC: ${hasAnyAcOn}, ERV: ${hasAnyErvOn}`)
    console.log('allSystemsOn will be:', hasAnyLightOn || hasAnyAcOn || hasAnyErvOn)
    console.log('Total rooms checked:', targetRooms.length)
  } catch (error) {
    console.error('Error checking floor device states:', error)
    floorDeviceStates.value = { light: [], ac: [], erv: [] }
  }
}

const confirmSystemControl = async () => {
  if (!systemControlAction.value) return
  
  systemControlLoading.value = true
  
  try {
    const buildingId = selectedBuilding.value
    const floorNumber = selectedFloor.value
    const areaName = selectedArea.value
    const isTurningOn = systemControlAction.value === 'turnOn'
    
    let targetRooms = []
    
    // If specific room is targeted, control only that room
    if (systemControlTargetRoomId.value) {
      // Find the specific room from areaRoomsMap
      const targetRoom = Object.values(areaRoomsMap.value).find(room => room?.id === systemControlTargetRoomId.value)
      if (targetRoom) {
        targetRooms = [targetRoom]
        console.log(`Targeting specific room: ${targetRoom.name} (ID: ${targetRoom.id})`)
      } else {
        console.warn(`Target room with ID ${systemControlTargetRoomId.value} not found`)
      }
    } else {
      // Otherwise, control all rooms in building/floor/area
      // ข้อมูล floor จากตาราง areas คอลัมน์ floor เท่านั้น
      const response = await api.get('/rooms')
      const allRooms = response.data.data || response.data || []
      const currentFloorAreaIds = areas.value
        .filter(a => Number(a.building_id) === Number(buildingId) && Number(a.floor) === Number(floorNumber))
        .map(a => a.id)
      targetRooms = allRooms.filter(room => currentFloorAreaIds.includes(room.area_id))
      
      if (areaName) {
        const targetArea = areas.value.find(a => a.name === areaName && a.building_id == buildingId && a.floor == floorNumber)
        if (targetArea) {
          targetRooms = targetRooms.filter(room => room.area_id === targetArea.id)
        }
      }
      
      console.log(`Found ${targetRooms.length} rooms in Building ${buildingId}, Floor ${floorNumber} (from areas.floor)${areaName ? `, Area ${areaName}` : ''}`)
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
  }
})

watch(() => route.query, async () => {
  console.log('Route query changed:', route.query)
  console.log('showFloorPlan:', showFloorPlan.value)
  console.log('showRoomControl:', showRoomControl.value)
  
  if (showBuildingList.value) {
    await fetchBuildings()
  } else if (showRoomControl.value) {
    await fetchBuildings()
    
    const resolvedRoomId = resolveRoomIdFromQuery()
    if (resolvedRoomId) {
      if (selectedRoomId.value !== resolvedRoomId) {
        selectedRoomId.value = resolvedRoomId
        await nextTick()
      }
    } else if (selectedArea.value) {
      const targetArea = areas.value.find(a => {
        const areaBuildingId = String(a.building_id)
        const areaFloor = String(a.floor)
        const buildingIdStr = String(selectedBuilding.value)
        const floorNumberStr = String(selectedFloor.value)
        return a.name === selectedArea.value && areaBuildingId === buildingIdStr && areaFloor === floorNumberStr
      })
      
      if (targetArea) {
        const areaRooms = rooms.value.filter(room => Number(room.area_id) === Number(targetArea.id))
        if (areaRooms.length > 0) {
          const currentRoomInArea = areaRooms.find(r => Number(r.id) === Number(selectedRoomId.value))
          if (!currentRoomInArea) {
            const firstRoomId = areaRooms[0].id
            selectedRoomId.value = firstRoomId
            router.replace({
              query: {
                ...route.query,
                room: firstRoomId,
              },
            })
            await nextTick()
          }
        }
      } else {
        const fallbackRoomId = resolveRoomIdFromAreaOnly()
        if (fallbackRoomId) {
          selectedRoomId.value = fallbackRoomId
          await nextTick()
        }
      }
    }
  } else if (showFloorPlan.value) {
    // Load data from fetchBuildings (same as building list page) for dropdown
    await fetchBuildings()
    await loadFloorPlanAreas()
    // Use nextTick to ensure DOM is ready
    await nextTick()
    console.log('Calling checkFloorDeviceStates from watch...')
    await checkFloorDeviceStates()
    // Load device states for all rooms in floor plan
    await loadAllRoomDeviceStates()
    // Start auto-refresh for room states
    startRoomStatesAutoRefresh()
  } else {
    // Stop auto-refresh when not in floor plan view
    stopRoomStatesAutoRefresh()
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
  console.log('Component mounted')
  console.log('showFloorPlan:', showFloorPlan.value)

  fetchDeviceTypes()

  if (showBuildingList.value) {
    await fetchBuildings()
  } else if (showRoomControl.value) {
    await fetchBuildings()
    
    const resolvedRoomId = resolveRoomIdFromQuery()
    if (resolvedRoomId) {
      selectedRoomId.value = resolvedRoomId
      await nextTick()
    } else if (selectedArea.value) {
      const targetArea = areas.value.find(a => {
        const areaBuildingId = String(a.building_id)
        const areaFloor = String(a.floor)
        const buildingIdStr = String(selectedBuilding.value)
        const floorNumberStr = String(selectedFloor.value)
        return a.name === selectedArea.value && areaBuildingId === buildingIdStr && areaFloor === floorNumberStr
      })
      
      if (targetArea) {
        const areaRooms = rooms.value.filter(room => Number(room.area_id) === Number(targetArea.id))
        if (areaRooms.length > 0) {
          const currentRoomInArea = areaRooms.find(r => Number(r.id) === Number(selectedRoomId.value))
          if (!currentRoomInArea) {
            const firstRoomId = areaRooms[0].id
            selectedRoomId.value = firstRoomId
            router.replace({
              query: {
                ...route.query,
                room: firstRoomId,
              },
            })
            await nextTick()
          }
        }
      } else {
        const fallbackRoomId = resolveRoomIdFromAreaOnly()
        if (fallbackRoomId) {
          selectedRoomId.value = fallbackRoomId
          await nextTick()
        }
      }
    }
  } else if (showFloorPlan.value) {
    await fetchBuildings()
    await loadFloorPlanAreas()
    await nextTick()
    console.log('Calling checkFloorDeviceStates from onMounted...')
    await checkFloorDeviceStates()
    await loadAllRoomDeviceStates()
    startRoomStatesAutoRefresh()
  }
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
                {{ building.floors?.length || 0 }} ชั้น
              </div>
              
              <div class="floors-list">
                <div
                  v-for="floor in building.floors"
                  :key="floor.floor"
                  class="floor-item"
                  @click="selectFloor(building.id, floor.floor)"
                >
                  <VIcon
                    icon="tabler-layers"
                    size="20"
                    color="primary"
                    class="me-2"
                  />
                  <span class="floor-label">Floor {{ floor.floor }}</span>
                  <VSpacer />
                  <VChip
                    size="small"
                    color="primary"
                    variant="tonal"
                  >
                    {{ floor.count }} Room{{ floor.count > 1 ? 's' : '' }}
                  </VChip>
                  <VIcon
                    icon="tabler-chevron-right"
                    size="20"
                    class="ms-2"
                  />
                </div>
                
                <div
                  v-if="!building.floors || building.floors.length === 0"
                  class="text-center py-4 text-disabled"
                >
                  <VIcon
                    icon="tabler-info-circle"
                    size="20"
                    class="me-1"
                  />
                  ไม่มีห้องในอาคารนี้
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
                    v-model="selectedFloor"
                    :items="availableFloors"
                    item-title="title"
                    item-value="value"
                    label="เลือกชั้น"
                    density="compact"
                    variant="outlined"
                    :disabled="!selectedBuilding"
                    @update:model-value="handleFloorChange"
                  />
                </VCol>
                <VCol
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
                    :disabled="!selectedBuilding || !selectedFloor"
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
                        Floor Plan • Floor {{ selectedFloor }}
                      </h4>
                      <div class="text-caption text-disabled">
                        <span v-if="!floorPlanEditMode">คลิกที่ Area เพื่อควบคุมห้อง</span>
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
                  :src="floorPlanImageDisplay"
                  alt="Floor Plan"
                  class="floor-plan-image"
                />
                
                <!-- Areas Overlay -->
                <div class="areas-overlay">
                  <div
                    v-for="area in floorPlanAreas"
                    :key="area.id"
                    class="area-box"
                    :class="{
                      'area-box-clickable': !floorPlanEditMode,
                      'area-box-editing': floorPlanEditMode,
                    }"
                    :style="{
                      top: area.top + '%',
                      left: area.left + '%',
                      width: area.width + '%',
                      height: area.height + '%',
                    }"
                    @click="!floorPlanEditMode && selectArea(area.name)"
                    @mousedown="floorPlanEditMode && startDragArea($event, area.id)"
                  >
                    <!-- Resize Handle -->
                    <div
                      v-if="floorPlanEditMode"
                      class="area-resize-handle"
                      @mousedown.stop="startResizeArea($event, area.id)"
                    >
                      <VIcon
                        icon="tabler-arrows-diagonal"
                        size="16"
                      />
                    </div>
                    
                    <!-- Delete Button -->
                    <VBtn
                      v-if="floorPlanEditMode"
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
                        v-if="floorPlanEditMode && editingAreaName === area.id"
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
                        :class="{ 'area-name-editable': floorPlanEditMode }"
                        @dblclick="floorPlanEditMode && startEditAreaName(area.id)"
                      >
                        {{ areaRoomsMap[area.id]?.name || area.name }}
                        <VIcon
                          v-if="floorPlanEditMode"
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
                      <!-- ปุ่ม เปิด/ปิด (เมื่อ area มีห้องและไม่ใช่โหมดแก้ไข) -->
                      <VBtn
                        v-if="!floorPlanEditMode && areaRoomsMap[area.id]"
                        size="small"
                        :color="isRoomSystemsOn(areaRoomsMap[area.id].id) ? 'warning' : 'default'"
                        variant="elevated"
                        class="area-power-btn mt-2"
                        prepend-icon="tabler-power"
                        @click.stop="toggleRoomSystemControl(areaRoomsMap[area.id].id)"
                      >
                        {{ isRoomSystemsOn(areaRoomsMap[area.id].id) ? 'เปิด' : 'ปิด' }}
                      </VBtn>
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
                    v-model="selectedFloor"
                    :items="availableFloors"
                    item-title="title"
                    item-value="value"
                    label="เลือกชั้น"
                    density="compact"
                    variant="outlined"
                    :disabled="!selectedBuilding"
                    @update:model-value="handleFloorChange"
                  />
                </VCol>
                <VCol
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
                    :disabled="!selectedBuilding || !selectedFloor"
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
                      {{ (selectedRoom?.name || selectedRoomTitle) || (selectedArea + ' Control') }}
                    </h4>
                    <div class="text-caption text-disabled">
                      Floor {{ selectedFloor }}
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

    <!-- Environmental Monitoring -->
    <VRow
      v-if="selectedRoomId"
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

    <!-- Device Control Dialog -->
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
    </div>

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
              <strong>Building {{ selectedBuilding }}, Floor {{ selectedFloor }}</strong>
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
              การปิดระบบจะปิดอุปกรณ์ทั้งหมด (ไฟ, แอร์, ERV)
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

.areas-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
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
