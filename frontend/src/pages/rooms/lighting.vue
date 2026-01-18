<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const authStore = useAuthStore()
const loading = ref(false)
const rooms = ref([])
const selectedRoomId = ref(null)
const deviceStates = reactive({
  light: [],
})
const lightBrightness = reactive([])
const controls = reactive({
  light: false,
})

const maxLightBulbs = 14 // Maximum number of light bulbs

const fetchRooms = async () => {
  loading.value = true
  try {
    const response = await api.get('/rooms')
    const allRooms = response.data.data || response.data || []
    rooms.value = allRooms
    
    // Auto-select Mercury room if exists
    const mercuryRoom = allRooms.find(r => r.name && r.name.toLowerCase().includes('mercury'))
    if (mercuryRoom) {
      selectedRoomId.value = mercuryRoom.id
      loadRoomDevices()
    }
  } catch (error) {
    console.error('Error fetching rooms:', error)
  } finally {
    loading.value = false
  }
}

const loadRoomDevices = async () => {
  if (!selectedRoomId.value) return

  // Initialize light states (default: 14 light bulbs)
  deviceStates.light = new Array(maxLightBulbs).fill(false)
  lightBrightness.length = maxLightBulbs
  for (let i = 0; i < maxLightBulbs; i++) {
    lightBrightness[i] = 100 // Default brightness 100%
  }

  try {
    // Load device states from API
    const response = await api.get(`/rooms/${selectedRoomId.value}/devices`)
    if (response.data && response.data.data) {
      const devices = response.data.data
      if (devices.deviceStates && devices.deviceStates.light) {
        // Load light states
        const lightStatesToLoad = devices.deviceStates.light.slice(0, maxLightBulbs)
        deviceStates.light = lightStatesToLoad.map(state => 
          state.status === true || state.status === 1 || state.status === 'on'
        )
        
        // Load brightness if available
        if (devices.deviceStates.light[0]?.brightness !== undefined) {
          lightStatesToLoad.forEach((light, index) => {
            lightBrightness[index] = light.brightness || 100
          })
        }
      }
    }
  } catch (error) {
    console.error('Error loading device states:', error)
  }

  // Update control switch based on device states
  controls.light = deviceStates.light.some(state => state)
}

const toggleControl = async () => {
  if (!selectedRoomId.value) return

  const newState = controls.light
  
  try {
    const payload = {
      status: newState,
    }
    
    await api.post(`/rooms/${selectedRoomId.value}/devices/light`, payload)
    
    // Update all light states
    deviceStates.light = deviceStates.light.map(() => newState)
    
    // Set brightness to 100% if turning on
    if (newState) {
      lightBrightness.forEach((_, index) => {
        lightBrightness[index] = 100
      })
    }
  } catch (error) {
    console.error('Error toggling lights:', error)
    controls.light = !newState // Revert on error
  }
}

const toggleDevice = async (index) => {
  if (!selectedRoomId.value) return

  const isOn = deviceStates.light[index]
  deviceStates.light[index] = !isOn

  try {
    const payload = {
      status: !isOn,
      brightness: !isOn ? (lightBrightness[index] || 100) : 0,
    }

    await api.post(`/rooms/${selectedRoomId.value}/devices/light/${index}`, payload)
    
    // Update control switch
    controls.light = deviceStates.light.some(state => state)
  } catch (error) {
    console.error('Error toggling light device:', error)
    deviceStates.light[index] = isOn // Revert on error
  }
}

const updateBrightness = async (index, brightness) => {
  if (!selectedRoomId.value) return

  lightBrightness[index] = brightness

  // Auto turn on if brightness > 0
  if (brightness > 0 && !deviceStates.light[index]) {
    deviceStates.light[index] = true
  }
  // Auto turn off if brightness = 0
  if (brightness === 0 && deviceStates.light[index]) {
    deviceStates.light[index] = false
  }

  try {
    const payload = {
      status: brightness > 0,
      brightness: brightness,
    }

    await api.post(`/rooms/${selectedRoomId.value}/devices/light/${index}`, payload)
    
    // Update control switch
    controls.light = deviceStates.light.some(state => state)
  } catch (error) {
    console.error('Error updating brightness:', error)
  }
}

const setAllBrightness = async (brightness) => {
  if (!selectedRoomId.value) return

  // Update all brightness values
  lightBrightness.forEach((_, index) => {
    lightBrightness[index] = brightness
    deviceStates.light[index] = brightness > 0
  })

  try {
    const payload = {
      status: brightness > 0,
      brightness: brightness,
    }
    
    await api.post(`/rooms/${selectedRoomId.value}/devices/light`, payload)
    
    controls.light = brightness > 0
  } catch (error) {
    console.error('Error setting all brightness:', error)
  }
}

const getDeviceState = (index) => {
  return deviceStates.light && deviceStates.light[index] === true
}

const getBrightness = (index) => {
  return lightBrightness[index] || 0
}

const getControlStatus = () => {
  const isOn = controls.light
  return isOn ? 'เปิด' : 'ปิด'
}

const getBrightnessLabel = (brightness) => {
  if (brightness === 0) return 'ปิด'
  if (brightness <= 25) return 'มืด'
  if (brightness <= 50) return 'สลัว'
  if (brightness <= 75) return 'สว่าง'
  return 'สว่างมาก'
}

const getBrightnessColor = (brightness) => {
  if (brightness === 0) return 'default'
  if (brightness <= 25) return 'error'
  if (brightness <= 50) return 'warning'
  if (brightness <= 75) return 'info'
  return 'success'
}

// Group lights by zones (for better organization)
const lightZones = computed(() => {
  const zones = []
  const lightsPerZone = 4
  
  for (let i = 0; i < deviceStates.light.length; i += lightsPerZone) {
    const zoneLights = []
    for (let j = 0; j < lightsPerZone && (i + j) < deviceStates.light.length; j++) {
      zoneLights.push(i + j)
    }
    if (zoneLights.length > 0) {
      zones.push({
        name: `โซน ${Math.floor(i / lightsPerZone) + 1}`,
        lights: zoneLights,
      })
    }
  }
  
  return zones
})

watch(selectedRoomId, () => {
  if (selectedRoomId.value) {
    loadRoomDevices()
  }
})

onMounted(() => {
  fetchRooms()
})
</script>

<template>
  <div class="lighting-control">
    <!-- Page Header -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <div class="d-flex align-center gap-3">
                <VIcon
                  icon="tabler-bulb"
                  size="32"
                  color="warning"
                />
                <h4 class="text-h4 mb-0">
                  ควบคุมแสงสว่าง
                </h4>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Room Selection -->
    <VRow class="mb-4">
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
                  label="ห้องที่มีระบบควบคุมแสงสว่าง"
                  :items="rooms.map(r => ({ title: r.name, value: r.id }))"
                  placeholder="กรุณาเลือกห้อง"
                  @update:model-value="loadRoomDevices"
                />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Master Control -->
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
            ควบคุมทั้งหมด
          </VCardTitle>
          <VCardText>
            <VCard variant="outlined">
              <VCardText>
                <div class="d-flex align-center justify-space-between mb-4">
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      size="56"
                      :color="controls.light ? 'warning' : 'default'"
                      variant="tonal"
                    >
                      <VIcon
                        icon="tabler-bulb"
                        size="28"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-h6">
                        ควบคุมไฟทั้งหมด
                      </div>
                      <div
                        class="text-body-2"
                        :class="controls.light ? 'text-success' : 'text-disabled'"
                      >
                        {{ getControlStatus() }}
                      </div>
                    </div>
                  </div>
                  <VSwitch
                    :model-value="controls.light"
                    @update:model-value="(val) => { controls.light = val; toggleControl(); }"
                    color="warning"
                    size="large"
                  />
                </div>
                
                <!-- Master Brightness Control -->
                <div>
                  <div class="d-flex align-center justify-space-between mb-2">
                    <div class="text-body-2 text-disabled">
                      ความสว่างทั้งหมด
                    </div>
                    <div class="text-h6">
                      {{ Math.round(lightBrightness.reduce((a, b) => a + (b || 0), 0) / lightBrightness.length) || 0 }}%
                    </div>
                  </div>
                  <VSlider
                    :model-value="Math.round(lightBrightness.reduce((a, b) => a + (b || 0), 0) / lightBrightness.length) || 0"
                    min="0"
                    max="100"
                    step="10"
                    color="warning"
                    @update:model-value="setAllBrightness($event)"
                  />
                  <div class="d-flex justify-space-between mt-2">
                    <VBtn
                      variant="outlined"
                      size="small"
                      density="compact"
                      @click="setAllBrightness(25)"
                    >
                      25%
                    </VBtn>
                    <VBtn
                      variant="outlined"
                      size="small"
                      density="compact"
                      @click="setAllBrightness(50)"
                    >
                      50%
                    </VBtn>
                    <VBtn
                      variant="outlined"
                      size="small"
                      density="compact"
                      @click="setAllBrightness(75)"
                    >
                      75%
                    </VBtn>
                    <VBtn
                      variant="outlined"
                      size="small"
                      density="compact"
                      @click="setAllBrightness(100)"
                    >
                      100%
                    </VBtn>
                  </div>
                </div>
              </VCardText>
            </VCard>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Light Zones -->
    <VRow
      v-if="selectedRoomId && deviceStates.light.length > 0"
      class="mb-4"
    >
      <VCol
        v-for="(zone, zoneIndex) in lightZones"
        :key="zoneIndex"
        cols="12"
        md="6"
        lg="4"
      >
        <VCard class="light-zone-card">
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center gap-2">
              <VIcon
                icon="tabler-bulb"
                color="warning"
                size="20"
              />
              <span>{{ zone.name }}</span>
            </div>
            <VChip
              size="small"
              :color="zone.lights.some(i => getDeviceState(i)) ? 'success' : 'default'"
            >
              {{ zone.lights.filter(i => getDeviceState(i)).length }}/{{ zone.lights.length }}
            </VChip>
          </VCardTitle>

          <VCardText>
            <div class="lights-grid">
              <VCard
                v-for="lightIndex in zone.lights"
                :key="lightIndex"
                class="light-bulb-card"
                :class="{ 'light-active': getDeviceState(lightIndex) }"
                variant="outlined"
              >
                <VCardText class="pa-3">
                  <!-- Light Bulb Icon -->
                  <div class="text-center mb-3">
                    <VIcon
                      icon="tabler-bulb"
                      :size="getDeviceState(lightIndex) ? 48 : 32"
                      :color="getDeviceState(lightIndex) ? 'warning' : 'disabled'"
                      :class="{ 'light-icon-on': getDeviceState(lightIndex) }"
                    />
                  </div>

                  <!-- Light Number -->
                  <div class="text-center mb-2">
                    <VChip
                      size="small"
                      :color="getDeviceState(lightIndex) ? 'warning' : 'default'"
                      variant="tonal"
                    >
                      ไฟ {{ lightIndex + 1 }}
                    </VChip>
                  </div>

                  <!-- Status -->
                  <div class="text-center mb-3">
                    <VChip
                      :color="getBrightnessColor(getBrightness(lightIndex))"
                      size="small"
                    >
                      {{ getBrightnessLabel(getBrightness(lightIndex)) }}
                    </VChip>
                  </div>

                  <!-- Switch -->
                  <div class="d-flex justify-center mb-3">
                    <VSwitch
                      :model-value="getDeviceState(lightIndex)"
                      @update:model-value="toggleDevice(lightIndex)"
                      color="warning"
                    />
                  </div>

                  <!-- Brightness Control -->
                  <div>
                    <div class="d-flex align-center justify-space-between mb-1">
                      <VIcon
                        icon="tabler-brightness"
                        size="16"
                        class="text-disabled"
                      />
                      <span class="text-caption text-disabled">
                        {{ getBrightness(lightIndex) }}%
                      </span>
                    </div>
                    <VSlider
                      :model-value="getBrightness(lightIndex)"
                      min="0"
                      max="100"
                      step="10"
                      color="warning"
                      density="compact"
                      @update:model-value="updateBrightness(lightIndex, $event)"
                    />
                  </div>
                </VCardText>
              </VCard>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- No Room Selected -->
    <VRow v-if="!selectedRoomId">
      <VCol cols="12">
        <VCard>
          <VCardText class="text-center py-12">
            <VIcon
              icon="tabler-door-open"
              size="80"
              color="warning"
              class="mb-4"
            />
            <h5 class="text-h5 mb-2">
              กรุณาเลือกห้อง
            </h5>
            <p class="text-body-2 text-disabled">
              เลือกห้องที่ต้องการควบคุมแสงสว่างจากรายการด้านบน
            </p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- No Lights -->
    <VRow
      v-if="selectedRoomId && deviceStates.light.length === 0"
      class="mb-4"
    >
      <VCol cols="12">
        <VCard>
          <VCardText class="text-center py-12">
            <VIcon
              icon="tabler-bulb"
              size="80"
              color="warning"
              class="mb-4"
            />
            <h5 class="text-h5 mb-2">
              ไม่พบข้อมูลไฟ
            </h5>
            <p class="text-body-2 text-disabled">
              ห้องนี้ยังไม่มีข้อมูลไฟที่สามารถควบคุมได้
            </p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Loading Overlay -->
    <VOverlay
      v-model="loading"
      class="align-center justify-center"
    >
      <VProgressCircular
        indeterminate
        size="64"
        color="warning"
      />
    </VOverlay>
  </div>
</template>

<style scoped>
.lighting-control {
  padding: 0;
}

.light-zone-card {
  transition: all 0.3s ease;
}

.light-zone-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.lights-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.light-bulb-card {
  transition: all 0.3s ease;
  cursor: pointer;
}

.light-bulb-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.light-bulb-card.light-active {
  border-color: rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), 0.05);
}

.light-icon-on {
  filter: drop-shadow(0 0 8px rgba(255, 152, 0, 0.6));
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

@media (max-width: 600px) {
  .lights-grid {
    grid-template-columns: 1fr;
  }
}
</style>
