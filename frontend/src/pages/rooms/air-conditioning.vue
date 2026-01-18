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
  ac: [],
  erv: [],
})
const acSettings = reactive({
  mode: [],
})
const acTemperatures = reactive([])
const ervSettings = reactive({
  speed: [],
  mode: [],
})
const controls = reactive({
  ac: false,
  erv: false,
})

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

  // Initialize AC positions (default: 2 AC units)
  const defaultACCount = 2
  deviceStates.ac = new Array(defaultACCount).fill(false)
  acSettings.mode = new Array(defaultACCount).fill('cool')
  acTemperatures.length = defaultACCount
  for (let i = 0; i < defaultACCount; i++) {
    acTemperatures[i] = 25
  }

  // Initialize ERV (default: 1 ERV unit)
  const defaultERVCount = 1
  deviceStates.erv = new Array(defaultERVCount).fill(false)
  ervSettings.speed = new Array(defaultERVCount).fill('low')
  ervSettings.mode = new Array(defaultERVCount).fill('normal')

  try {
    // Load device states from API
    const response = await api.get(`/rooms/${selectedRoomId.value}/devices`)
    if (response.data && response.data.data) {
      const devices = response.data.data
      if (devices.deviceStates) {
        // Load AC states
        if (devices.deviceStates.ac) {
          deviceStates.ac = devices.deviceStates.ac.map(state => 
            state.status === true || state.status === 1 || state.status === 'on'
          )
          
          if (devices.deviceStates.ac[0]?.mode) {
            acSettings.mode = devices.deviceStates.ac.map(ac => ac.mode || 'cool')
          }
          if (devices.deviceStates.ac[0]?.temperature) {
            acTemperatures.splice(0, acTemperatures.length, ...devices.deviceStates.ac.map(ac => ac.temperature || 25))
          }
        }
        
        // Load ERV states
        if (devices.deviceStates.erv) {
          deviceStates.erv = devices.deviceStates.erv.map(state => 
            state.status === true || state.status === 1 || state.status === 'on'
          )
          if (devices.deviceStates.erv[0]?.speed) {
            ervSettings.speed = devices.deviceStates.erv.map(erv => erv.speed || 'low')
          }
          if (devices.deviceStates.erv[0]?.mode) {
            ervSettings.mode = devices.deviceStates.erv.map(erv => erv.mode || 'normal')
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading device states:', error)
  }

  // Update control switch based on device states
  controls.ac = deviceStates.ac.some(state => state)
  controls.erv = deviceStates.erv.some(state => state)
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
    if (type === 'ac') {
      deviceStates.ac = deviceStates.ac.map(() => newState)
    } else if (type === 'erv') {
      deviceStates.erv = deviceStates.erv.map(() => newState)
    }
  } catch (error) {
    console.error(`Error toggling ${type}:`, error)
    controls[type] = !newState // Revert on error
  }
}

const toggleDevice = async (index) => {
  if (!selectedRoomId.value) return

  const isOn = deviceStates.ac[index]
  deviceStates.ac[index] = !isOn

  try {
    const payload = {
      status: !isOn,
      mode: acSettings.mode[index] || 'cool',
      temperature: acTemperatures[index] || 25,
    }

    await api.post(`/rooms/${selectedRoomId.value}/devices/ac/${index}`, payload)
    
    // Update control switch
    controls.ac = deviceStates.ac.some(state => state)
  } catch (error) {
    console.error('Error toggling AC device:', error)
    deviceStates.ac[index] = isOn // Revert on error
  }
}

const updateACMode = async (index, mode) => {
  if (!selectedRoomId.value) return

  acSettings.mode[index] = mode

  try {
    const payload = {
      status: deviceStates.ac[index],
      mode: mode,
      temperature: acTemperatures[index] || 25,
    }

    await api.post(`/rooms/${selectedRoomId.value}/devices/ac/${index}`, payload)
  } catch (error) {
    console.error('Error updating AC mode:', error)
  }
}

const updateACTemperature = async (index, temperature) => {
  if (!selectedRoomId.value) return

  acTemperatures[index] = temperature

  try {
    const payload = {
      status: deviceStates.ac[index],
      mode: acSettings.mode[index] || 'cool',
      temperature: temperature,
    }

    await api.post(`/rooms/${selectedRoomId.value}/devices/ac/${index}`, payload)
  } catch (error) {
    console.error('Error updating AC temperature:', error)
  }
}

const getDeviceState = (index) => {
  return deviceStates.ac && deviceStates.ac[index] === true
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

const getControlStatus = (type) => {
  const isOn = controls[type]
  return isOn ? 'เปิด' : 'ปิด'
}

const getErvMode = (index) => {
  return ervSettings.mode && ervSettings.mode[index] ? ervSettings.mode[index] : 'normal'
}

const getErvSpeed = (index) => {
  return ervSettings.speed && ervSettings.speed[index] ? ervSettings.speed[index] : 'low'
}

const getErvDeviceState = (index) => {
  return deviceStates.erv && deviceStates.erv[index] === true
}

const toggleERVDevice = async (index) => {
  if (!selectedRoomId.value) return

  const isOn = deviceStates.erv[index]
  deviceStates.erv[index] = !isOn

  try {
    const payload = {
      status: !isOn,
      speed: ervSettings.speed[index] || 'low',
      mode: ervSettings.mode[index] || 'normal',
    }

    await api.post(`/rooms/${selectedRoomId.value}/devices/erv/${index}`, payload)
    
    // Update control switch
    controls.erv = deviceStates.erv.some(state => state)
  } catch (error) {
    console.error('Error toggling ERV device:', error)
    deviceStates.erv[index] = isOn // Revert on error
  }
}

const updateERVSpeed = async (index, speed) => {
  if (!selectedRoomId.value) return

  ervSettings.speed[index] = speed

  try {
    const payload = {
      status: deviceStates.erv[index],
      speed: speed,
      mode: ervSettings.mode[index] || 'normal',
    }

    await api.post(`/rooms/${selectedRoomId.value}/devices/erv/${index}`, payload)
  } catch (error) {
    console.error('Error updating ERV speed:', error)
  }
}

const updateERVMode = async (index, mode) => {
  if (!selectedRoomId.value) return

  ervSettings.mode[index] = mode

  try {
    const payload = {
      status: deviceStates.erv[index],
      speed: ervSettings.speed[index] || 'low',
      mode: mode,
    }

    await api.post(`/rooms/${selectedRoomId.value}/devices/erv/${index}`, payload)
  } catch (error) {
    console.error('Error updating ERV mode:', error)
  }
}

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
  <div class="air-conditioning-control">
    <!-- Page Header -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <div class="d-flex align-center justify-space-between">
              <div class="d-flex align-center gap-3">
                <VIcon
                  icon="tabler-snowflake"
                  size="32"
                  color="primary"
                />
                <h4 class="text-h4 mb-0">
                  ควบคุมแอร์
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
                  label="ห้องที่มีระบบควบคุมแอร์"
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
                <div class="d-flex align-center justify-space-between">
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      size="56"
                      :color="controls.ac ? 'primary' : 'default'"
                      variant="tonal"
                    >
                      <VIcon
                        icon="tabler-snowflake"
                        size="28"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-h6">
                        ควบคุมแอร์ทั้งหมด
                      </div>
                      <div
                        class="text-body-2"
                        :class="controls.ac ? 'text-success' : 'text-disabled'"
                      >
                        {{ getControlStatus('ac') }}
                      </div>
                    </div>
                  </div>
                  <VSwitch
                    :model-value="controls.ac"
                    @update:model-value="(val) => { controls.ac = val; toggleControl('ac'); }"
                    color="primary"
                    size="large"
                  />
                </div>
              </VCardText>
            </VCard>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- AC Units Grid -->
    <VRow
      v-if="selectedRoomId && deviceStates.ac.length > 0"
      class="mb-4"
    >
      <VCol
        v-for="(ac, index) in deviceStates.ac"
        :key="index"
        cols="12"
        md="6"
        lg="4"
      >
        <VCard
          class="ac-unit-card"
          :class="{ 'ac-active': getDeviceState(index) }"
        >
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center gap-2">
              <VIcon
                :icon="getACIcon(index)"
                :color="getACColor(index)"
                size="24"
              />
              <span>แอร์ {{ index + 1 }}</span>
            </div>
            <VSwitch
              :model-value="getDeviceState(index)"
              @update:model-value="toggleDevice(index)"
              :color="getACColor(index)"
            />
          </VCardTitle>

          <VCardText>
            <!-- Status -->
            <div class="text-center mb-4">
              <VChip
                :color="getDeviceState(index) ? 'success' : 'default'"
                size="large"
                class="mb-2"
              >
                {{ getDeviceState(index) ? 'เปิด' : 'ปิด' }}
              </VChip>
              <div class="text-caption text-disabled mt-1">
                โหมด: {{ getACModeLabel(index) }}
              </div>
            </div>

            <!-- Mode Selection -->
            <div class="mb-4">
              <div class="text-body-2 text-disabled mb-2">
                โหมดการทำงาน
              </div>
              <VBtnToggle
                v-model="acSettings.mode[index]"
                mandatory
                variant="outlined"
                density="compact"
                class="w-100"
                @update:model-value="updateACMode(index, $event)"
              >
                <VBtn
                  value="cool"
                  size="small"
                  class="flex-fill"
                >
                  <VIcon
                    icon="tabler-snowflake"
                    size="16"
                    class="me-1"
                  />
                  Cool
                </VBtn>
                <VBtn
                  value="heat"
                  size="small"
                  class="flex-fill"
                >
                  <VIcon
                    icon="tabler-flame"
                    size="16"
                    class="me-1"
                  />
                  Heat
                </VBtn>
                <VBtn
                  value="heat/cool"
                  size="small"
                  class="flex-fill"
                >
                  <VIcon
                    icon="tabler-temperature"
                    size="16"
                    class="me-1"
                  />
                  Auto
                </VBtn>
                <VBtn
                  value="fan only"
                  size="small"
                  class="flex-fill"
                >
                  <VIcon
                    icon="tabler-wind"
                    size="16"
                    class="me-1"
                  />
                  Fan
                </VBtn>
              </VBtnToggle>
            </div>

            <!-- Temperature Control -->
            <div class="mb-4">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="text-body-2 text-disabled">
                  อุณหภูมิ
                </div>
                <div class="text-h4">
                  {{ acTemperatures[index] || 25 }}°C
                </div>
              </div>
              
              <div class="d-flex align-center justify-center gap-2 mb-2">
                <VBtn
                  icon
                  variant="outlined"
                  size="small"
                  :disabled="(acTemperatures[index] || 25) <= 16"
                  @click="updateACTemperature(index, Math.max(16, (acTemperatures[index] || 25) - 1))"
                >
                  <VIcon icon="tabler-minus" />
                </VBtn>
                <VSlider
                  v-model="acTemperatures[index]"
                  :model-value="acTemperatures[index] || 25"
                  min="16"
                  max="30"
                  step="1"
                  class="mx-4"
                  :color="getACColor(index)"
                  @update:model-value="updateACTemperature(index, $event)"
                />
                <VBtn
                  icon
                  variant="outlined"
                  size="small"
                  :disabled="(acTemperatures[index] || 25) >= 30"
                  @click="updateACTemperature(index, Math.min(30, (acTemperatures[index] || 25) + 1))"
                >
                  <VIcon icon="tabler-plus" />
                </VBtn>
              </div>
              
              <div class="d-flex justify-space-between text-caption text-disabled">
                <span>16°C</span>
                <span>30°C</span>
              </div>
            </div>

            <!-- Quick Temperature Buttons -->
            <div class="d-flex gap-2">
              <VBtn
                variant="outlined"
                size="small"
                density="compact"
                class="flex-fill"
                @click="updateACTemperature(index, 20)"
              >
                20°C
              </VBtn>
              <VBtn
                variant="outlined"
                size="small"
                density="compact"
                class="flex-fill"
                @click="updateACTemperature(index, 24)"
              >
                24°C
              </VBtn>
              <VBtn
                variant="outlined"
                size="small"
                density="compact"
                class="flex-fill"
                @click="updateACTemperature(index, 26)"
              >
                26°C
              </VBtn>
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
              color="primary"
              class="mb-4"
            />
            <h5 class="text-h5 mb-2">
              กรุณาเลือกห้อง
            </h5>
            <p class="text-body-2 text-disabled">
              เลือกห้องที่ต้องการควบคุมแอร์จากรายการด้านบน
            </p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- ERV Control Section -->
    <VRow
      v-if="selectedRoomId"
      class="mb-4"
    >
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-wind"
              class="me-2"
            />
            ควบคุม ERV (Energy Recovery Ventilator)
          </VCardTitle>
          <VCardText>
            <!-- Master ERV Control -->
            <VCard
              variant="outlined"
              class="mb-4"
            >
              <VCardText>
                <div class="d-flex align-center justify-space-between">
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      size="56"
                      :color="controls.erv ? 'info' : 'default'"
                      variant="tonal"
                    >
                      <VIcon
                        icon="tabler-wind"
                        size="28"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-h6">
                        ควบคุม ERV ทั้งหมด
                      </div>
                      <div
                        class="text-body-2"
                        :class="controls.erv ? 'text-success' : 'text-disabled'"
                      >
                        {{ getControlStatus('erv') }}
                      </div>
                    </div>
                  </div>
                  <VSwitch
                    :model-value="controls.erv"
                    @update:model-value="(val) => { controls.erv = val; toggleControl('erv'); }"
                    color="info"
                    size="large"
                  />
                </div>
              </VCardText>
            </VCard>

            <!-- ERV Units Grid -->
            <VRow v-if="deviceStates.erv.length > 0">
              <VCol
                v-for="(erv, index) in deviceStates.erv"
                :key="index"
                cols="12"
                md="6"
                lg="4"
              >
                <VCard
                  class="erv-unit-card"
                  :class="{ 'erv-active': getErvDeviceState(index) }"
                >
                  <VCardTitle class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center gap-2">
                      <VIcon
                        icon="tabler-wind"
                        color="info"
                        size="24"
                      />
                      <span>ERV {{ index + 1 }}</span>
                    </div>
                    <VSwitch
                      :model-value="getErvDeviceState(index)"
                      @update:model-value="toggleERVDevice(index)"
                      color="info"
                    />
                  </VCardTitle>

                  <VCardText>
                    <!-- Status -->
                    <div class="text-center mb-4">
                      <VChip
                        :color="getErvDeviceState(index) ? 'success' : 'default'"
                        size="large"
                        class="mb-2"
                      >
                        {{ getErvDeviceState(index) ? 'เปิด' : 'ปิด' }}
                      </VChip>
                      <div class="text-caption text-disabled mt-1">
                        ความเร็ว: {{ getErvSpeed(index) === 'high' ? 'High' : 'Low' }}
                      </div>
                    </div>

                    <!-- Speed Selection -->
                    <div class="mb-4">
                      <div class="text-body-2 text-disabled mb-2">
                        ความเร็วลม
                      </div>
                      <VBtnToggle
                        v-model="ervSettings.speed[index]"
                        mandatory
                        variant="outlined"
                        density="compact"
                        class="w-100"
                        @update:model-value="updateERVSpeed(index, $event)"
                      >
                        <VBtn
                          value="low"
                          size="small"
                          class="flex-fill"
                        >
                          <VIcon
                            icon="tabler-gauge"
                            size="16"
                            class="me-1"
                          />
                          Low
                        </VBtn>
                        <VBtn
                          value="high"
                          size="small"
                          class="flex-fill"
                        >
                          <VIcon
                            icon="tabler-gauge-filled"
                            size="16"
                            class="me-1"
                          />
                          High
                        </VBtn>
                      </VBtnToggle>
                    </div>

                    <!-- Mode Selection -->
                    <div>
                      <div class="text-body-2 text-disabled mb-2">
                        โหมดการทำงาน
                      </div>
                      <VBtnToggle
                        v-model="ervSettings.mode[index]"
                        mandatory
                        variant="outlined"
                        density="compact"
                        class="w-100"
                        @update:model-value="updateERVMode(index, $event)"
                      >
                        <VBtn
                          value="normal"
                          size="small"
                          class="flex-fill"
                        >
                          <VIcon
                            icon="tabler-wind"
                            size="16"
                            class="me-1"
                          />
                          Normal
                        </VBtn>
                        <VBtn
                          value="heat"
                          size="small"
                          class="flex-fill"
                        >
                          <VIcon
                            icon="tabler-flame"
                            size="16"
                            class="me-1"
                          />
                          Heat
                        </VBtn>
                      </VBtnToggle>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- No AC Units -->
    <VRow
      v-if="selectedRoomId && deviceStates.ac.length === 0"
      class="mb-4"
    >
      <VCol cols="12">
        <VCard>
          <VCardText class="text-center py-12">
            <VIcon
              icon="tabler-snowflake"
              size="80"
              color="primary"
              class="mb-4"
            />
            <h5 class="text-h5 mb-2">
              ไม่พบข้อมูลแอร์
            </h5>
            <p class="text-body-2 text-disabled">
              ห้องนี้ยังไม่มีข้อมูลแอร์ที่สามารถควบคุมได้
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
        color="primary"
      />
    </VOverlay>
  </div>
</template>

<style scoped>
.air-conditioning-control {
  padding: 0;
}

.ac-unit-card {
  transition: all 0.3s ease;
  border: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.ac-unit-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.ac-unit-card.ac-active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.05);
}

.ac-unit-card.ac-active .v-card-title {
  color: rgb(var(--v-theme-primary));
}

.erv-unit-card {
  transition: all 0.3s ease;
  border: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.erv-unit-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.erv-unit-card.erv-active {
  border-color: rgb(var(--v-theme-info));
  background: rgba(var(--v-theme-info), 0.05);
}

.erv-unit-card.erv-active .v-card-title {
  color: rgb(var(--v-theme-info));
}

.flex-fill {
  flex: 1 1 auto;
}
</style>
