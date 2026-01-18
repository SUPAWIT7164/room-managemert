<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const authStore = useAuthStore()
const loading = ref(false)
const error = ref(null)
const imageUrl = ref('')
const connectionStatus = ref('disconnected') // connected, disconnected, error
const lastUpdateTime = ref(null)
const showDebugInfo = ref(false)
const imageProcessingStatus = ref(null)
const statusRefreshTimer = ref(null)

// Get video stream URL
const getStreamUrl = () => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
  return `${baseURL}/cctv/stream?cameraId=0&t=${Date.now()}`
}

// Initialize video stream
const initStream = () => {
  if (loading.value) return

  loading.value = true
  error.value = null
  connectionStatus.value = 'disconnected'

  // Set video stream URL (MJPEG stream)
  imageUrl.value = getStreamUrl()
}

// Refresh image/stream
const refreshImage = () => {
  initStream()
}

// Image/Video load handler
const onImageLoad = () => {
  loading.value = false
  connectionStatus.value = 'connected'
  lastUpdateTime.value = new Date()
  error.value = null
}

// Image/Video error handler
const onImageError = (event) => {
  loading.value = false
  error.value = 'ไม่สามารถเชื่อมต่อกับวิดีโอสตรีมได้ - กรุณาตรวจสอบการเชื่อมต่อกล้องและข้อมูลการเข้าสู่ระบบ'
  connectionStatus.value = 'error'
  console.error('CCTV Stream Error:', event)
}

// Get status text
const getStatusText = () => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'เชื่อมต่อสำเร็จ'
    case 'error':
      return 'เกิดข้อผิดพลาด'
    default:
      return 'กำลังเชื่อมต่อ...'
  }
}

// Format time
const formatTime = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Fetch Image Processing Status
const fetchImageProcessingStatus = async () => {
  try {
    const response = await api.get('/cctv/image-processing/status')
    if (response.data.success && response.data.data) {
      imageProcessingStatus.value = response.data.data
    }
  } catch (error) {
    console.error('Error fetching image processing status:', error)
  }
}

// Initialize
onMounted(() => {
  initStream()
  fetchImageProcessingStatus()
  // Refresh status every 30 seconds
  statusRefreshTimer.value = setInterval(() => {
    fetchImageProcessingStatus()
  }, 30000)
})

// Cleanup
onBeforeUnmount(() => {
  if (statusRefreshTimer.value) {
    clearInterval(statusRefreshTimer.value)
    statusRefreshTimer.value = null
  }
})
</script>

<template>
  <div class="cctv-view">
    <!-- Page Header -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard
          class="page-header-gradient"
          style="background: linear-gradient(135deg, #FFA500 0%, #FF8C00 50%, #FF7F00 100%);"
        >
          <VCardText>
            <div class="d-flex align-center justify-space-between flex-wrap gap-4">
              <div class="d-flex align-center gap-4">
                <VAvatar
                  size="80"
                  style="background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px);"
                >
                  <VIcon
                    size="40"
                    icon="tabler-camera-video"
                    color="white"
                  />
                </VAvatar>
                <div>
                  <h1 class="text-h3 text-white mb-1">
                    กล้อง CCTV
                  </h1>
                  <p class="text-body-1 text-white">
                    ระบบตรวจสอบและบันทึกภาพแบบ Real-time
                  </p>
                </div>
              </div>
              <VBtn
                color="white"
                :loading="loading"
                @click="refreshImage"
              >
                <VIcon
                  icon="tabler-refresh"
                  class="me-2"
                />
                รีเฟรช
              </VBtn>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Status Cards -->
    <VRow class="mb-4">
      <VCol
        cols="12"
        md="4"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="60"
                :color="connectionStatus === 'connected' ? 'success' : connectionStatus === 'error' ? 'error' : 'warning'"
              >
                <VIcon
                  :icon="connectionStatus === 'connected' ? 'tabler-wifi' : connectionStatus === 'error' ? 'tabler-wifi-off' : 'tabler-hourglass'"
                  size="28"
                />
              </VAvatar>
              <div>
                <div class="text-caption text-disabled mb-1">
                  สถานะการเชื่อมต่อ
                </div>
                <div
                  class="text-h6"
                  :class="connectionStatus === 'connected' ? 'text-success' : connectionStatus === 'error' ? 'text-error' : 'text-warning'"
                >
                  {{ getStatusText() }}
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="4"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="60"
                color="info"
              >
                <VIcon
                  icon="tabler-clock"
                  size="28"
                />
              </VAvatar>
              <div>
                <div class="text-caption text-disabled mb-1">
                  อัพเดทล่าสุด
                </div>
                <div class="text-h6">
                  {{ lastUpdateTime ? formatTime(lastUpdateTime) : 'ยังไม่มีข้อมูล' }}
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        v-if="imageProcessingStatus"
        cols="12"
        md="4"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="60"
                :color="imageProcessingStatus.isRunning ? 'success' : 'warning'"
              >
                <VIcon
                  icon="tabler-camera"
                  size="28"
                />
              </VAvatar>
              <div>
                <div class="text-caption text-disabled mb-1">
                  Image Processing
                </div>
                <div class="text-h6">
                  {{ imageProcessingStatus.isRunning ? 'กำลังทำงาน' : 'หยุดทำงาน' }}
                </div>
                <div
                  v-if="imageProcessingStatus.isRunning"
                  class="text-caption text-disabled mt-1"
                >
                  ทุก {{ imageProcessingStatus.intervalMinutes }} นาที
                </div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Camera Image Container -->
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-camera-video"
                class="me-2"
              />
              ภาพจากกล้อง CCTV
            </div>
            <VChip
              v-if="connectionStatus === 'connected'"
              color="success"
              size="small"
            >
              <VIcon
                icon="tabler-circle-filled"
                size="8"
                class="me-1"
              />
              Live
            </VChip>
          </VCardTitle>

          <VCardText class="pa-0">
            <div
              v-if="!error"
              class="camera-wrapper"
            >
              <img
                :src="imageUrl"
                alt="CCTV Camera"
                class="camera-image"
                :class="{ 'loading': loading }"
                @load="onImageLoad"
                @error="onImageError"
              >
              <VOverlay
                v-if="loading"
                contained
                class="align-center justify-center"
                persistent
              >
                <div class="text-center">
                  <VProgressCircular
                    indeterminate
                    color="primary"
                    size="60"
                    class="mb-4"
                  />
                  <div class="text-h6 text-white mb-1">
                    กำลังดึงภาพจากกล้อง...
                  </div>
                  <div class="text-body-2 text-white">
                    กรุณารอสักครู่
                  </div>
                </div>
              </VOverlay>
              <div
                v-if="connectionStatus === 'connected' && !loading"
                class="camera-overlay-info"
              >
                <VChip
                  color="success"
                  size="small"
                  class="mb-2"
                >
                  <VIcon
                    icon="tabler-wifi"
                    size="14"
                    class="me-1"
                  />
                  Connected
                </VChip>
                <VChip
                  v-if="lastUpdateTime"
                  color="info"
                  size="small"
                >
                  <VIcon
                    icon="tabler-clock"
                    size="14"
                    class="me-1"
                  />
                  {{ formatTime(lastUpdateTime) }}
                </VChip>
              </div>
            </div>

            <!-- Error State -->
            <div
              v-if="error"
              class="error-state-wrapper"
            >
              <div class="text-center">
                <VAvatar
                  size="100"
                  color="error"
                  class="mb-4"
                >
                  <VIcon
                    size="50"
                    icon="tabler-alert-triangle"
                  />
                </VAvatar>
                <h3 class="text-h5 mb-2">
                  ไม่สามารถเชื่อมต่อกล้องได้
                </h3>
                <p class="text-body-1 text-disabled mb-4">
                  {{ error }}
                </p>
                <div class="d-flex gap-2 justify-center flex-wrap">
                  <VBtn
                    color="primary"
                    @click="refreshImage"
                  >
                    <VIcon
                      icon="tabler-refresh"
                      class="me-2"
                    />
                    ลองอีกครั้ง
                  </VBtn>
                  <VBtn
                    variant="outlined"
                    @click="showDebugInfo = !showDebugInfo"
                  >
                    <VIcon
                      icon="tabler-info-circle"
                      class="me-2"
                    />
                    {{ showDebugInfo ? 'ซ่อน' : 'แสดง' }}ข้อมูล Debug
                  </VBtn>
                </div>

                <VExpansionPanels
                  v-if="showDebugInfo"
                  class="mt-4"
                  variant="accordion"
                >
                  <VExpansionPanel>
                    <VExpansionPanelTitle>
                      <VIcon
                        icon="tabler-bug"
                        class="me-2"
                      />
                      ข้อมูล Debug
                    </VExpansionPanelTitle>
                    <VExpansionPanelText>
                      <div class="d-flex flex-column gap-2">
                        <div>
                          <span class="font-weight-bold">URL:</span>
                          <span class="ml-2">{{ imageUrl || 'N/A' }}</span>
                        </div>
                        <div>
                          <span class="font-weight-bold">สถานะ:</span>
                          <span class="ml-2">{{ connectionStatus }}</span>
                        </div>
                        <div>
                          <span class="font-weight-bold">เวลา:</span>
                          <span class="ml-2">{{ new Date().toLocaleString('th-TH') }}</span>
                        </div>
                      </div>
                    </VExpansionPanelText>
                  </VExpansionPanel>
                </VExpansionPanels>
              </div>
            </div>
          </VCardText>

          <!-- Camera Info Footer -->
          <VCardActions>
            <div class="d-flex align-center gap-2 flex-wrap">
              <VIcon
                icon="tabler-info-circle"
                size="16"
              />
              <span class="text-caption">
                วิดีโอสตรีมแบบ Real-time - ภาพจะอัพเดทอัตโนมัติทุก 100ms (~10 FPS)
              </span>
            </div>
            <VSpacer />
            <VChip
              v-if="connectionStatus === 'connected'"
              color="success"
              size="small"
            >
              <VIcon
                icon="tabler-check"
                size="14"
                class="me-1"
              />
              การเชื่อมต่อเสถียร
            </VChip>
          </VCardActions>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style scoped>
.cctv-view {
  padding: 0;
}

.page-header-gradient {
  box-shadow: 0 8px 24px rgba(255, 165, 0, 0.3);
}

.camera-wrapper {
  position: relative;
  width: 100%;
  background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.camera-image {
  max-width: 100%;
  max-height: 75vh;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.camera-image.loading {
  opacity: 0.3;
}

.camera-overlay-info {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 5;
}

.error-state-wrapper {
  padding: 80px 24px;
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
