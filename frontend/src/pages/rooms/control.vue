<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'
import Chart from 'chart.js/auto'

// Import images
import roomBackgroundImageUrl from '@/assets/images/สื่อ (14).jpg'
import fanImageUrl from '@/assets/images/fan.png'
import buildingImageUrl from '@/assets/images/A1006.jpg'
import floorPlanImageUrl from '@/assets/images/สื่อ (15) (1).jpg'

const roomBackgroundImage = roomBackgroundImageUrl
const fanImage = fanImageUrl
const buildingImage = buildingImageUrl
const floorPlanImage = floorPlanImageUrl

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

const isSuperAdmin = computed(() => authStore.isSuperAdmin)

// Filter buildings to show only Building A
const filteredBuildings = computed(() => {
  return buildings.value.filter(building => building.name === 'อาคาร A')
})

// Get available floors for selected building
const availableFloors = computed(() => {
  if (!selectedBuilding.value) return []
  const building = buildings.value.find(b => b.id === Number(selectedBuilding.value))
  if (!building || !building.floors) return []
  return building.floors.map(floor => ({
    value: floor.floor,
    title: `ชั้น ${floor.floor}`,
  }))
})

// Get available rooms for selected building and floor
const availableRooms = computed(() => {
  if (!selectedBuilding.value || !selectedFloor.value) return []
  
  try {
    // Get areas for this building and floor
    const buildingId = Number(selectedBuilding.value)
    const floorNumber = Number(selectedFloor.value)
    
    const currentFloorAreas = areas.value.filter(area => {
      return area.building_id === buildingId && area.floor === floorNumber
    })
    
    if (currentFloorAreas.length === 0) return []
    
    // Get rooms in these areas
    const currentFloorRooms = rooms.value.filter(room => {
      return currentFloorAreas.some(area => area.id === room.area_id)
    })
    
    return currentFloorRooms.map(room => ({
      value: room.id,
      title: room.name || `ห้อง ${room.id}`,
    }))
  } catch (error) {
    console.error('Error computing available rooms:', error)
    return []
  }
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

// Fetch Buildings for selection page
const fetchBuildings = async () => {
  loading.value = true
  try {
    const [buildingsResponse, areasResponse, roomsResponse] = await Promise.all([
      api.get('/buildings'),
      api.get('/areas'),
      api.get('/rooms'),
    ])
    
    buildings.value = buildingsResponse.data.data || []
    areas.value = areasResponse.data.data || []
    const allRooms = roomsResponse.data.data || []
    
    // Store rooms in rooms.value for dropdown usage
    rooms.value = allRooms
    
    // Process data to add floor and room counts
    buildings.value = buildings.value.map(building => {
      const buildingAreas = areas.value.filter(area => area.building_id === building.id)
      const floors = {}
      
      buildingAreas.forEach(area => {
        const areaRooms = allRooms.filter(room => room.area_id === area.id)
        if (!floors[area.floor]) {
          floors[area.floor] = {
            floor: area.floor,
            count: 0,
          }
        }
        floors[area.floor].count += areaRooms.length
      })
      
      return {
        ...building,
        floors: Object.values(floors).sort((a, b) => a.floor - b.floor),
      }
    })
  } catch (error) {
    console.error('Error fetching buildings:', error)
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
    mode: new Array(3).fill('cool'),
  }
  
  const tempAcTemperatures = new Array(3).fill(25)
  
  const tempErvSettings = {
    speed: new Array(3).fill('low'),
    mode: new Array(3).fill('normal'),
  }

  try {
    // Load device states from API
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
          const acStates = devices.deviceStates.ac.map(state => 
            state.status === true || state.status === 1 || state.status === 'on'
          )
          // Pad to 3 units if needed
          while (acStates.length < 3) {
            acStates.push(false)
          }
          tempDeviceStates.ac = acStates.slice(0, 3)
          
          // Load mode from settings object (if exists)
          const modes = devices.deviceStates.ac.map(ac => {
            // Try direct property first, then settings object
            if (ac.mode) {
              return ac.mode
            } else if (ac.settings && ac.settings.mode) {
              return ac.settings.mode
            }
            return 'cool' // default value
          })
          while (modes.length < 3) {
            modes.push('cool')
          }
          console.log('Loaded AC modes from API:', modes)
          tempAcSettings.mode = modes.slice(0, 3)
          
          // Load temperature from settings object (if exists)
          const temps = devices.deviceStates.ac.map(ac => {
            // Try direct property first, then settings object
            if (ac.temperature !== undefined) {
              return ac.temperature
            } else if (ac.settings && ac.settings.temperature !== undefined) {
              return ac.settings.temperature
            }
            return 25 // default value
          })
          while (temps.length < 3) {
            temps.push(25)
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
}

const toggleControl = async (type) => {
  if (!selectedRoomId.value) return

  const newState = controls[type]
  
  try {
    const payload = {
      status: newState,
    }
    
    await api.post(`/rooms/${selectedRoomId.value}/devices/${type}`, payload)
    
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

const toggleDevice = async (type, index) => {
  if (!selectedRoomId.value) return

  const isOn = deviceStates[type][index]
  deviceStates[type][index] = !isOn
  lastUpdateTime.value = Date.now()

  try {
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
  return acSettings.mode && acSettings.mode[index] ? acSettings.mode[index] : 'cool'
}

const getACModeLabel = (index) => {
  const mode = getACMode(index)
  const labels = {
    'cool': 'Cool',
    'heat': 'Heat',
    'heat/cool': 'Heat/Cool',
    'fan only': 'Fan Only',
  }
  return labels[mode] || 'Cool'
}

const getACIcon = (index) => {
  const mode = getACMode(index)
  const icons = {
    'cool': 'tabler-snowflake',
    'heat': 'tabler-flame',
    'heat/cool': 'tabler-temperature',
    'fan only': 'tabler-wind',
  }
  return icons[mode] || 'tabler-snowflake'
}

const getACColor = (index) => {
  const mode = getACMode(index)
  const colors = {
    'cool': 'primary',
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
  
  // Always update via API (regardless of on/off state) to persist settings
  try {
    const currentStatus = getDeviceState('erv', index)
    const payload = {
      status: currentStatus, // Use current status (on/off)
      speed: speed,
      mode: ervSettings.mode[index] || 'normal',
    }
    console.log('Sending ERV speed update:', payload)
    const response = await api.post(`/rooms/${selectedRoomId.value}/devices/erv/${index}`, payload)
    console.log('ERV speed update response:', response.data)
  } catch (error) {
    console.error('Error updating ERV speed:', error)
  }
}

const updateERVMode = async (index, mode) => {
  if (!selectedRoomId.value) return
  
  ervSettings.mode[index] = mode
  lastUpdateTime.value = Date.now()
  
  console.log(`Updating ERV ${index} mode to:`, mode)
  
  // Always update via API (regardless of on/off state) to persist settings
  try {
    const currentStatus = getDeviceState('erv', index)
    const payload = {
      status: currentStatus, // Use current status (on/off)
      speed: ervSettings.speed[index] || 'low',
      mode: mode,
    }
    console.log('Sending ERV mode update:', payload)
    const response = await api.post(`/rooms/${selectedRoomId.value}/devices/erv/${index}`, payload)
    console.log('ERV mode update response:', response.data)
  } catch (error) {
    console.error('Error updating ERV mode:', error)
  }
}

const updateACMode = async (index, mode) => {
  if (!selectedRoomId.value) return
  
  acSettings.mode[index] = mode
  lastUpdateTime.value = Date.now()
  
  // If AC is on, update via API
  if (getDeviceState('ac', index)) {
    try {
      await api.post(`/rooms/${selectedRoomId.value}/devices/ac/${index}`, {
        status: true,
        mode: mode,
        temperature: acTemperatures[index] || 25,
      })
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
      await api.post(`/rooms/${selectedRoomId.value}/devices/ac/${index}`, {
        status: true,
        mode: acSettings.mode[index] || 'cool',
        temperature: temperature,
      })
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

// Save device positions to API
const saveDevicePositions = async () => {
  if (!selectedRoomId.value) return
  
  const positions = {
    erv: [...devicePositions.erv],
    ac: [...devicePositions.ac],
    light: [...devicePositions.light],
  }
  
  try {
    await api.post(`/rooms/${selectedRoomId.value}/device-positions`, { positions })
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

    co2ChartInstance.value = new Chart(ctx, {
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
  // Always load data from fetchBuildings (same as building list page)
  await fetchBuildings()
  
  // Check if this area has a specific room mapping (for areas not yet connected to database)
  let firstRoomId = null
  
  if (areaRoomMapping[areaName]) {
    // Find room by name from mapping
    const targetRoomName = areaRoomMapping[areaName]
    const targetRoom = rooms.value.find(r => r.name === targetRoomName)
    if (targetRoom) {
      firstRoomId = targetRoom.id
      console.log(`Area ${areaName} mapped to room ${targetRoomName} (ID: ${firstRoomId})`)
    } else {
      console.warn(`Room "${targetRoomName}" not found for area "${areaName}"`)
    }
  } else {
    // Find the area from database
    const targetArea = areas.value.find(a => {
      const areaBuildingId = String(a.building_id)
      const areaFloor = String(a.floor)
      const buildingIdStr = String(selectedBuilding.value)
      const floorNumberStr = String(selectedFloor.value)
      return a.name === areaName && areaBuildingId === buildingIdStr && areaFloor === floorNumberStr
    })
    
    // Find first room in this area
    if (targetArea) {
      const areaRooms = rooms.value.filter(room => room.area_id === targetArea.id)
      if (areaRooms.length > 0) {
        firstRoomId = areaRooms[0].id
      }
    }
  }
  
  router.push({
    name: 'rooms-control',
    query: {
      building: selectedBuilding.value,
      floor: selectedFloor.value,
      area: areaName,
      room: firstRoomId,
    },
  })
  
  // Load room devices if room is selected
  if (firstRoomId) {
    await nextTick()
    selectedRoomId.value = firstRoomId
    loadRoomDevices()
  }
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
      
      // Log rooms in current building and floor
      const currentFloorRooms = rooms.value.filter(r => {
        return String(r.building_id) === buildingIdStr && String(r.floor) === floorNumberStr
      })
      console.log(`Rooms in Building ${selectedBuilding.value}, Floor ${selectedFloor.value}:`, currentFloorRooms)
    }
    
    const floorPlanKey = `floorPlan_${selectedBuilding.value}_${selectedFloor.value}`
    const saved = localStorage.getItem(floorPlanKey)
    if (saved) {
      floorPlanAreas.value = JSON.parse(saved)
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
    
    // Filter rooms by building, floor, and optionally area
    // Convert to string for comparison to handle both string and number types
    const buildingIdStr = String(buildingId)
    const floorNumberStr = String(floorNumber)
    
    let targetRooms = allRooms.filter(room => {
      const roomBuildingId = String(room.building_id)
      const roomFloor = String(room.floor)
      const match = roomBuildingId === buildingIdStr && roomFloor === floorNumberStr
      if (!match) {
        console.log(`Room ${room.id} (${room.name}) doesn't match: building ${roomBuildingId} vs ${buildingIdStr}, floor ${roomFloor} vs ${floorNumberStr}`)
      }
      return match
    })
    
    console.log(`Found ${targetRooms.length} rooms in Building ${buildingId}, Floor ${floorNumber} (before area filter)`)
    
    // If area is specified, filter by area
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
      // Fetch all rooms in the building/floor
      const response = await api.get('/rooms')
      const allRooms = response.data.data || response.data || []
      
      // Filter rooms by building and floor
      targetRooms = allRooms.filter(room => {
        return room.building_id == buildingId && room.floor == floorNumber
      })
      
      // If area is specified, filter by area
      if (areaName) {
        const targetArea = areas.value.find(a => a.name === areaName && a.building_id == buildingId && a.floor == floorNumber)
        if (targetArea) {
          targetRooms = targetRooms.filter(room => room.area_id === targetArea.id)
        }
      }
      
      console.log(`Found ${targetRooms.length} rooms in Building ${buildingId}, Floor ${floorNumber}${areaName ? `, Area ${areaName}` : ''}`)
    }
    
    // Control all systems (light, ac, erv) for each room
    const controlPromises = []
    
    for (const room of targetRooms) {
      // Control Light
      controlPromises.push(
        api.post(`/rooms/${room.id}/devices/light`, { status: isTurningOn })
          .catch(err => console.error(`Error controlling light in room ${room.id}:`, err))
      )
      
      // Control AC
      controlPromises.push(
        api.post(`/rooms/${room.id}/devices/ac`, { status: isTurningOn })
          .catch(err => console.error(`Error controlling AC in room ${room.id}:`, err))
      )
      
      // Control ERV
      controlPromises.push(
        api.post(`/rooms/${room.id}/devices/erv`, { status: isTurningOn })
          .catch(err => console.error(`Error controlling ERV in room ${room.id}:`, err))
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
    // Check query parameter FIRST before loading data
    const roomIdFromQuery = selectedRoomFromQuery.value ? Number(selectedRoomFromQuery.value) : null
    
    // Load data from fetchBuildings (same as building list page) for dropdown
    await fetchBuildings()
    
    // Load room data if room is specified in query (priority: query > current selection)
    if (roomIdFromQuery) {
      // Always use room from query parameter when page loads/refreshes
      if (selectedRoomId.value !== roomIdFromQuery) {
        selectedRoomId.value = roomIdFromQuery
        await nextTick()
        loadRoomDevices()
      }
    } else if (selectedArea.value) {
      // If area is selected but no room in query, select first room in area
      const targetArea = areas.value.find(a => {
        const areaBuildingId = String(a.building_id)
        const areaFloor = String(a.floor)
        const buildingIdStr = String(selectedBuilding.value)
        const floorNumberStr = String(selectedFloor.value)
        return a.name === selectedArea.value && areaBuildingId === buildingIdStr && areaFloor === floorNumberStr
      })
      
      if (targetArea) {
        const areaRooms = rooms.value.filter(room => room.area_id === targetArea.id)
        if (areaRooms.length > 0) {
          // Only auto-select first room if no room is currently selected
          if (!selectedRoomId.value) {
            const firstRoomId = areaRooms[0].id
            selectedRoomId.value = firstRoomId
            // Update URL with room
            router.replace({
              query: {
                ...route.query,
                room: firstRoomId,
              },
            })
            await nextTick()
            loadRoomDevices()
          }
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

onMounted(async () => {
  console.log('Component mounted')
  console.log('showFloorPlan:', showFloorPlan.value)
  
  if (showBuildingList.value) {
    await fetchBuildings()
  } else if (showRoomControl.value) {
    // Check query parameter FIRST before loading data
    const roomIdFromQuery = selectedRoomFromQuery.value ? Number(selectedRoomFromQuery.value) : null
    
    // Load data from fetchBuildings (same as building list page) for dropdown
    await fetchBuildings()
    
    // Load room data if room is specified in query (priority: query > current selection)
    if (roomIdFromQuery) {
      // Always use room from query parameter when page loads/refreshes
      selectedRoomId.value = roomIdFromQuery
      await nextTick()
      loadRoomDevices()
    } else if (selectedArea.value) {
      // If area is selected but no room in query, select first room in area
      const targetArea = areas.value.find(a => {
        const areaBuildingId = String(a.building_id)
        const areaFloor = String(a.floor)
        const buildingIdStr = String(selectedBuilding.value)
        const floorNumberStr = String(selectedFloor.value)
        return a.name === selectedArea.value && areaBuildingId === buildingIdStr && areaFloor === floorNumberStr
      })
      
      if (targetArea) {
        const areaRooms = rooms.value.filter(room => room.area_id === targetArea.id)
        if (areaRooms.length > 0) {
          // Only auto-select first room if no room is currently selected
          if (!selectedRoomId.value) {
            const firstRoomId = areaRooms[0].id
            selectedRoomId.value = firstRoomId
            // Update URL with room
            router.replace({
              query: {
                ...route.query,
                room: firstRoomId,
              },
            })
            await nextTick()
            loadRoomDevices()
          }
        }
      }
    }
  } else if (showFloorPlan.value) {
    // Load data from fetchBuildings (same as building list page) for dropdown
    await fetchBuildings()
    await loadFloorPlanAreas()
    await nextTick()
    console.log('Calling checkFloorDeviceStates from onMounted...')
    await checkFloorDeviceStates()
    // Load device states for all rooms in floor plan
    await loadAllRoomDeviceStates()
    // Start auto-refresh for room states
    startRoomStatesAutoRefresh()
  }
})

onBeforeUnmount(() => {
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
                v-if="building.image"
                :src="building.image"
                height="200"
                cover
                class="building-image"
              />
              <VImg
                v-else
                :src="buildingImage"
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
                {{ building.floors?.length || 0 }} Area
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
                    label="เลือกห้อง"
                    density="compact"
                    variant="outlined"
                    :disabled="!selectedBuilding || !selectedFloor"
                    clearable
                    @update:model-value="handleRoomChange"
                  />
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
                  :src="floorPlanImage"
                  alt="Floor Plan"
                  class="floor-plan-image"
                />
                
                <!-- System Control Icons for each room -->
                <template
                  v-for="area in floorPlanAreas"
                >
                  <div
                    v-if="areaRoomsMap[area.id]"
                    :key="`control-${area.id}`"
                    :data-room-control="areaRoomsMap[area.id].id"
                    class="system-control-icon-wrapper"
                    :class="{ 
                      'system-on': isRoomSystemsOn(areaRoomsMap[area.id].id), 
                      'system-off': !isRoomSystemsOn(areaRoomsMap[area.id].id),
                      'draggable': floorPlanEditMode
                    }"
                    :style="{
                      top: `${getRoomControlPosition(areaRoomsMap[area.id].id).top}%`,
                      left: `${getRoomControlPosition(areaRoomsMap[area.id].id).left}%`,
                      position: 'absolute',
                    }"
                    @click="!floorPlanEditMode && toggleRoomSystemControl(areaRoomsMap[area.id].id)"
                    @mousedown="floorPlanEditMode && startDragRoomControl($event, areaRoomsMap[area.id].id)"
                  >
                    <div 
                      class="system-control-icon-circle"
                      :style="{
                        width: '54px',
                        height: '50px'
                      }"
                    >
                      <VIcon
                        icon="tabler-power"
                        size="22"
                        :color="isRoomSystemsOn(areaRoomsMap[area.id].id) ? 'warning' : 'default'"
                      />
                    </div>
                    <div class="system-control-label">
                      {{ isRoomSystemsOn(areaRoomsMap[area.id].id) ? 'เปิด' : 'ปิด' }}
                    </div>
                    <div class="system-control-room-name">
                      {{ areaRoomsMap[area.id].name }}
                    </div>
                    <!-- Resize Handle for edit mode -->
                    <div
                      v-if="floorPlanEditMode"
                      class="system-control-resize-handle"
                      @mousedown.stop
                    >
                      <VIcon icon="tabler-arrows-move" size="16" />
                    </div>
                  </div>
                </template>
                
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
                      <VIcon
                        :icon="area.icon"
                        size="24"
                        class="mb-1"
                      />
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
                        {{ area.name }}
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
                    label="เลือกห้อง"
                    density="compact"
                    variant="outlined"
                    :disabled="!selectedBuilding || !selectedFloor"
                    @update:model-value="handleRoomChange"
                  />
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
                      {{ selectedArea }} Control
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
                cols="12"
                md="4"
              >
                <VCard variant="outlined">
                  <VCardText>
                    <div class="d-flex align-center justify-space-between mb-2">
                      <div class="d-flex align-center gap-2">
                        <VIcon
                          icon="tabler-bulb"
                          size="24"
                        />
                        <span class="text-h6">ไฟ</span>
                      </div>
                      <VSwitch
                        :model-value="controls.light"
                        @update:model-value="(val) => { controls.light = val; toggleControl('light'); }"
                      />
                    </div>
                    <div
                      class="text-body-2"
                      :class="controls.light ? 'text-success' : 'text-disabled'"
                    >
                      {{ getControlStatus('light') }}
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <VCard variant="outlined">
                  <VCardText>
                    <div class="d-flex align-center justify-space-between mb-2">
                      <div class="d-flex align-center gap-2">
                        <VIcon
                          icon="tabler-snowflake"
                          size="24"
                        />
                        <span class="text-h6">แอร์</span>
                      </div>
                      <VSwitch
                        :model-value="controls.ac"
                        @update:model-value="(val) => { controls.ac = val; toggleControl('ac'); }"
                      />
                    </div>
                    <div
                      class="text-body-2"
                      :class="controls.ac ? 'text-success' : 'text-disabled'"
                    >
                      {{ getControlStatus('ac') }}
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <VCard variant="outlined">
                  <VCardText>
                    <div class="d-flex align-center justify-space-between mb-2">
                      <div class="d-flex align-center gap-2">
                        <VIcon
                          icon="tabler-wind"
                          size="24"
                        />
                        <span class="text-h6">ERV</span>
                      </div>
                      <VSwitch
                        :model-value="controls.erv"
                        @update:model-value="(val) => { controls.erv = val; toggleControl('erv'); }"
                      />
                    </div>
                    <div
                      class="text-body-2"
                      :class="controls.erv ? 'text-success' : 'text-disabled'"
                    >
                      {{ getControlStatus('erv') }}
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
          </VCardTitle>
          <VCardText>
            <div class="room-layout-container">
              <div
                ref="roomLayout"
                class="room-layout"
                :style="{ backgroundImage: `url('${roomBackgroundImage}')` }"
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
              v-if="selectedDevice.type === 'light'"
              icon="tabler-bulb"
              class="me-2"
            />
            <VIcon
              v-else-if="selectedDevice.type === 'ac'"
              :icon="getACIcon(selectedDevice.index)"
              class="me-2"
            />
              <VIcon
              v-else-if="selectedDevice.type === 'erv'"
                icon="tabler-wind"
                class="me-2"
            />
            {{ selectedDevice.type === 'light' ? 'ไฟ' : selectedDevice.type === 'ac' ? 'แอร์' : 'ERV' }}
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
                      value="heat/cool"
                      class="flex-fill"
                    >
                      <VIcon
                        icon="tabler-temperature"
                        size="18"
                        class="me-2"
                      />
                      Auto
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
                    <VBtn
                      value="fan only"
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
  height: 200px;
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
  width: 50px;
  height: 50px;
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

/* System Control Icon */
.system-control-icon-wrapper {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  pointer-events: all;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.system-control-icon-wrapper:hover:not(.draggable) {
  transform: scale(1.05);
}

.system-control-icon-wrapper:hover:not(.draggable) .system-control-icon-circle {
  transform: scale(1.05);
}

.system-control-icon-wrapper:active:not(.draggable) {
  transform: scale(0.95);
}

.system-control-icon-wrapper.draggable {
  cursor: move;
}

.system-control-icon-wrapper.draggable:hover {
  opacity: 0.9;
}

.system-control-icon-wrapper.draggable:hover .system-control-icon-circle {
  transform: scale(1.02);
}

.system-control-icon-circle {
  width: 80px;
  height: 80px;
  min-width: 50px;
  min-height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  /* Default style (OFF state) - gray/neutral */
  background: linear-gradient(135deg, rgba(var(--v-theme-surface), 0.8) 0%, rgba(var(--v-theme-surface), 0.6) 100%);
  border: 4px solid rgba(var(--v-border-color), var(--v-border-opacity));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* ON state - yellow/warning like light bulb */
.system-control-icon-wrapper.system-on .system-control-icon-circle {
  background: linear-gradient(135deg, rgba(var(--v-theme-warning), 0.25) 0%, rgba(var(--v-theme-warning), 0.15) 100%);
  border-color: rgb(var(--v-theme-warning));
  box-shadow: 0 8px 32px rgba(var(--v-theme-warning), 0.4), 
              0 0 0 4px rgba(var(--v-theme-warning), 0.1);
}

/* OFF state - keep neutral appearance */
.system-control-icon-wrapper.system-off .system-control-icon-circle {
  background: linear-gradient(135deg, rgba(var(--v-theme-surface), 0.8) 0%, rgba(var(--v-theme-surface), 0.6) 100%);
  border: 4px solid rgba(var(--v-border-color), var(--v-border-opacity));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* Hover effect */
.system-control-icon-wrapper:hover:not(.draggable) .system-control-icon-circle {
  transform: scale(1.05);
  border-color: rgb(var(--v-theme-warning));
  background: linear-gradient(135deg, rgba(var(--v-theme-warning), 0.15) 0%, rgba(var(--v-theme-warning), 0.1) 100%);
  box-shadow: 0 8px 24px rgba(var(--v-theme-warning), 0.2);
}

/* Glow effect for ON state */
.system-control-icon-circle::before {
  content: '';
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

.system-control-icon-wrapper.system-on .system-control-icon-circle::before {
  opacity: 1;
  animation: pulse-glow 2s ease-in-out infinite;
}

/* Icon styling */
.system-control-icon-circle .v-icon {
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
}

/* OFF state - default/gray icon for visibility */
.system-control-icon-wrapper.system-off .system-control-icon-circle .v-icon {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  opacity: 0.8;
}

/* ON state - yellow/warning like light bulb with glow */
.system-control-icon-wrapper.system-on .system-control-icon-circle .v-icon {
  filter: drop-shadow(0 8px 16px rgba(var(--v-theme-warning), 0.6));
  animation: light-pulse 2s ease-in-out infinite;
}

.system-control-label {
  background: rgba(var(--v-theme-surface), 0.95);
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.system-control-icon-wrapper.system-on .system-control-label {
  color: rgb(var(--v-theme-warning));
}

.system-control-icon-wrapper.system-off .system-control-label {
  color: rgb(var(--v-theme-on-surface));
}

.system-control-room-name {
  margin-top: 4px;
  background: rgba(var(--v-theme-surface), 0.95);
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  text-align: center;
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.system-control-icon-wrapper.system-on .system-control-room-name {
  background: rgba(var(--v-theme-warning), 0.1);
  color: rgb(var(--v-theme-warning));
}

.system-control-icon-wrapper.system-off .system-control-room-name {
  background: rgba(var(--v-theme-surface), 0.95);
  color: rgb(var(--v-theme-on-surface));
}

/* Resize Handle */
.system-control-resize-handle {
  position: absolute;
  bottom: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  background: rgb(var(--v-theme-primary));
  border: 2px solid rgb(var(--v-theme-surface));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: nwse-resize;
  z-index: 20;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.system-control-resize-handle:hover {
  transform: scale(1.2);
  background: rgb(var(--v-theme-primary-darken-1));
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.5);
}

.system-control-resize-handle:active {
  transform: scale(1.1);
}

.system-control-resize-handle .v-icon {
  color: rgb(var(--v-theme-on-primary));
  font-size: 12px;
}

/* Animation keyframes */
@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
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
  width: 24px;
  height: 24px;
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
  width: 28px;
  height: 28px;
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
  max-width: 200px;
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
</style>
