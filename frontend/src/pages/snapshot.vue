<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const authStore = useAuthStore()

// ---- State ----
const loading = ref(false)
const loopRunning = ref(false)
const loopInterval = ref(1)
const isProcessing = ref(false)
const latestImage = ref(null)
const latestProcessedImage = ref(null)
const logs = ref([])
const statusInfo = ref(null)
const error = ref(null)
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')
const statusTimer = ref(null)

// ---- People Counting State ----
const countingLoading = ref(false)
const countingRunning = ref(false)
const countingInterval = ref(30)           // ค่าเริ่มต้น 30 วินาที
const countingStatus = ref(null)
const countingHistory = ref([])
const countingTimer = ref(null)

// ---- ROI Drawing State ----
const roiDrawing = ref(false)              // กำลังวาด ROI อยู่
const roiPoints = ref([])                  // จุดที่วาด [{x, y}] (normalized 0-1)
const roiSaved = ref(false)                // ROI ถูกบันทึกแล้ว
const roiImageRef = ref(null)              // ref ไปยัง image container
const roiCanvasRef = ref(null)             // ref ไปยัง canvas

// Interval options สำหรับ select
const intervalOptions = [
  { title: '10 วินาที', value: 10 },
  { title: '15 วินาที', value: 15 },
  { title: '20 วินาที', value: 20 },
  { title: '30 วินาที', value: 30 },
  { title: '45 วินาที', value: 45 },
  { title: '60 วินาที (1 นาที)', value: 60 },
  { title: '90 วินาที (1.5 นาที)', value: 90 },
  { title: '120 วินาที (2 นาที)', value: 120 },
  { title: '180 วินาที (3 นาที)', value: 180 },
  { title: '300 วินาที (5 นาที)', value: 300 },
]

/**
 * คำนวณ Base URL สำหรับ serve static files (snapshot images)
 * รองรับทั้ง:
 *   - /api → '' (relative, ผ่าน Vite proxy / IIS)
 *   - https://bms-dev.lanna.co.th/api → https://bms-dev.lanna.co.th
 *   - URL ที่ไม่มี /api suffix
 */
const backendBaseUrl = computed(() => {
  const base = import.meta.env.VITE_API_BASE_URL || '/api'

  // ลบ /api หรือ /api/ ที่ท้าย URL
  const cleaned = base.replace(/\/api\/?$/, '')
  return cleaned || ''
})

// ---- API Functions ----

/**
 * ถ่ายภาพทันที (POST /api/snapshot)
 */
async function captureNow() {
  loading.value = true
  error.value = null
  try {
    const response = await api.post('/snapshot')
    if (response.data.success) {
      const data = response.data.data
      latestImage.value = data.snapshot
      latestProcessedImage.value = data.processed
      showSnackbar('ถ่ายภาพสำเร็จ', 'success')
      // Refresh logs
      await fetchLogs()
    } else {
      error.value = response.data.message || 'ไม่สามารถถ่ายภาพได้'
      showSnackbar(error.value, 'error')
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'เกิดข้อผิดพลาด'
    error.value = msg
    showSnackbar(msg, 'error')
  } finally {
    loading.value = false
  }
}

/**
 * เริ่ม loop อัตโนมัติ (POST /api/snapshot/start-loop)
 */
async function startLoop() {
  error.value = null
  try {
    const response = await api.post('/snapshot/start-loop', {
      interval: loopInterval.value,
    })
    if (response.data.success) {
      loopRunning.value = true
      showSnackbar(response.data.message, 'success')
      // เริ่ม polling
      startStatusPolling()
    } else {
      showSnackbar(response.data.message, 'warning')
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'เกิดข้อผิดพลาด'
    error.value = msg
    showSnackbar(msg, 'error')
  }
}

/**
 * หยุด loop (POST /api/snapshot/stop-loop)
 */
async function stopLoop() {
  error.value = null
  try {
    const response = await api.post('/snapshot/stop-loop')
    if (response.data.success) {
      loopRunning.value = false
      showSnackbar(response.data.message, 'info')
      stopStatusPolling()
      // Refresh สถานะสุดท้าย
      await fetchStatus()
      await fetchLogs()
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'เกิดข้อผิดพลาด'
    showSnackbar(msg, 'error')
  }
}

/**
 * ดึงสถานะ loop (GET /api/snapshot/status)
 */
async function fetchStatus() {
  try {
    const response = await api.get('/snapshot/status')
    if (response.data.success) {
      statusInfo.value = response.data.data
      loopRunning.value = response.data.data.isRunning
      isProcessing.value = response.data.data.isProcessing

      // อัพเดทภาพล่าสุดจาก lastCapture
      if (response.data.data.lastCapture) {
        const last = response.data.data.lastCapture
        if (last.snapshot) latestImage.value = last.snapshot
        if (last.processed) latestProcessedImage.value = last.processed
      }
    }
  } catch (err) {
    // Silent fail — GET /status ไม่ต้อง auth จึงไม่ควร error
    console.warn('[Snapshot] fetchStatus error:', err.message)
  }
}

/**
 * ดึง logs (GET /api/snapshot/logs)
 */
async function fetchLogs() {
  try {
    const response = await api.get('/snapshot/logs', { params: { limit: 50 } })
    if (response.data.success) {
      logs.value = response.data.data
    }
  } catch (err) {
    console.warn('[Snapshot] fetchLogs error:', err.message)
  }
}

/**
 * ดึงภาพล่าสุด (GET /api/snapshot/latest)
 */
async function fetchLatest() {
  try {
    const response = await api.get('/snapshot/latest')
    if (response.data.success && response.data.data) {
      latestImage.value = response.data.data
    }
  } catch (err) {
    console.warn('[Snapshot] fetchLatest error:', err.message)
  }
}

// ---- People Counting API Functions ----

/**
 * นับคนทันที 1 ครั้ง (POST /api/snapshot/count-now)
 */
async function countPeopleNow() {
  countingLoading.value = true
  error.value = null
  try {
    // แจ้งเตือนถ้ามี ROI
    if (roiSaved.value && roiPoints.value.length >= 3) {
      showSnackbar('กำลังนับคนในพื้นที่ที่วาด...', 'info')
    }
    
    const response = await api.post('/snapshot/count-now')
    if (response.data.success) {
      const data = response.data.data
      let message = response.data.message
      
      // เพิ่มข้อมูล ROI ในข้อความ
      if (data?.roiUsed) {
        if (data.count === 0) {
          message = `ไม่พบคนในพื้นที่ที่วาด (ROI)`
        } else {
          message = `นับคนในพื้นที่ที่วาด: ${data.count} คน`
        }
      }
      
      showSnackbar(message, data.count === 0 && data.roiUsed ? 'warning' : 'success')
      await fetchCountingStatus()
      await fetchCountingHistory()
    } else {
      error.value = response.data.message || 'ไม่สามารถนับคนได้'
      showSnackbar(error.value, 'error')
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'เกิดข้อผิดพลาด'
    error.value = msg
    showSnackbar(msg, 'error')
  } finally {
    countingLoading.value = false
  }
}

/**
 * เริ่ม loop นับคนอัตโนมัติ (POST /api/snapshot/start-counting)
 */
async function startCounting() {
  error.value = null
  try {
    const response = await api.post('/snapshot/start-counting', {
      intervalSeconds: countingInterval.value,
    })
    if (response.data.success) {
      countingRunning.value = true
      showSnackbar(response.data.message, 'success')
      startCountingPolling()
    } else {
      showSnackbar(response.data.message, 'warning')
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'เกิดข้อผิดพลาด'
    error.value = msg
    showSnackbar(msg, 'error')
  }
}

/**
 * หยุด loop นับคน (POST /api/snapshot/stop-counting)
 */
async function stopCounting() {
  error.value = null
  try {
    const response = await api.post('/snapshot/stop-counting')
    if (response.data.success) {
      countingRunning.value = false
      showSnackbar(response.data.message, 'info')
      stopCountingPolling()
      await fetchCountingStatus()
      await fetchCountingHistory()
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'เกิดข้อผิดพลาด'
    showSnackbar(msg, 'error')
  }
}

/**
 * อัปเดต interval นับคน (PUT /api/snapshot/counting-interval)
 */
async function updateCountingInterval() {
  try {
    const response = await api.put('/snapshot/counting-interval', {
      intervalSeconds: countingInterval.value,
    })
    if (response.data.success) {
      showSnackbar(response.data.message, 'success')
      await fetchCountingStatus()
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'เกิดข้อผิดพลาด'
    showSnackbar(msg, 'error')
  }
}

/**
 * ดึงสถานะ counting (GET /api/snapshot/counting-status)
 */
async function fetchCountingStatus() {
  try {
    const response = await api.get('/snapshot/counting-status')
    if (response.data.success) {
      countingStatus.value = response.data.data
      countingRunning.value = response.data.data.isRunning
      
      // อัปเดต ROI จาก status (ถ้ามี)
      if (response.data.data.roi && Array.isArray(response.data.data.roi) && response.data.data.roi.length >= 3) {
        roiPoints.value = response.data.data.roi
        roiSaved.value = true
        nextTick(() => drawROICanvas())
      }
    }
  } catch (err) {
    console.warn('[Snapshot] fetchCountingStatus error:', err.message)
  }
}

/**
 * ดึงประวัตินับคน (GET /api/snapshot/counting-history)
 */
async function fetchCountingHistory() {
  try {
    const response = await api.get('/snapshot/counting-history', { params: { limit: 50 } })
    if (response.data.success) {
      countingHistory.value = response.data.data
    }
  } catch (err) {
    console.warn('[Snapshot] fetchCountingHistory error:', err.message)
  }
}

// ---- ROI Functions ----

/**
 * โหลด ROI จาก backend
 */
async function loadROI() {
  try {
    const response = await api.get('/snapshot/counting-roi')
    if (response.data.success && response.data.data?.roi) {
      roiPoints.value = response.data.data.roi
      roiSaved.value = true
    } else {
      roiPoints.value = []
      roiSaved.value = false
    }
  } catch (err) {
    console.warn('[ROI] loadROI error:', err.message)
  }
}

/**
 * บันทึก ROI ไปยัง backend
 */
async function saveROI() {
  try {
    const response = await api.post('/snapshot/counting-roi', {
      roi: roiPoints.value.length >= 3 ? roiPoints.value : null,
    })
    if (response.data.success) {
      roiSaved.value = roiPoints.value.length >= 3
      roiDrawing.value = false
      showSnackbar(response.data.message, 'success')
    } else {
      showSnackbar(response.data.message, 'error')
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'เกิดข้อผิดพลาด'
    showSnackbar(msg, 'error')
  }
}

/**
 * เริ่มวาด ROI ใหม่
 */
function startDrawROI() {
  roiDrawing.value = true
  roiPoints.value = []
  roiSaved.value = false
}

/**
 * ล้าง ROI ทั้งหมด
 */
async function clearROI() {
  roiPoints.value = []
  roiSaved.value = false
  roiDrawing.value = false
  await saveROI()
}

/**
 * ยกเลิกการวาด ROI
 */
function cancelDrawROI() {
  roiDrawing.value = false
  // โหลด ROI เดิมกลับมา
  loadROI()
}

/**
 * ลบจุดสุดท้าย
 */
function undoLastPoint() {
  if (roiPoints.value.length > 0) {
    roiPoints.value.pop()
  }
}

/**
 * Handle click บน canvas เพื่อเพิ่มจุด ROI
 */
function onCanvasClick(event) {
  if (!roiDrawing.value) return
  
  const canvas = roiCanvasRef.value
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  
  // Clamp 0-1
  const nx = Math.max(0, Math.min(1, x))
  const ny = Math.max(0, Math.min(1, y))
  
  roiPoints.value.push({ x: nx, y: ny })
  drawROICanvas()
}

/**
 * วาด ROI polygon บน canvas
 */
function drawROICanvas() {
  const canvas = roiCanvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  
  // Clear canvas
  ctx.clearRect(0, 0, w, h)
  
  const points = roiPoints.value
  if (points.length === 0) return
  
  // วาด semi-transparent overlay ด้านนอก polygon (ถ้ามีอย่างน้อย 3 จุด)
  if (points.length >= 3) {
    // วาด overlay ทึบทั้งภาพ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.fillRect(0, 0, w, h)
    
    // ตัด polygon ออก (เปิดให้เห็นภาพภายใน)
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.moveTo(points[0].x * w, points[0].y * h)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * w, points[i].y * h)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  
  // วาดเส้น polygon
  ctx.strokeStyle = roiDrawing.value ? '#FF6D00' : '#00E676'
  ctx.lineWidth = 2.5
  ctx.setLineDash(roiDrawing.value ? [8, 4] : [])
  ctx.beginPath()
  ctx.moveTo(points[0].x * w, points[0].y * h)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * w, points[i].y * h)
  }
  if (points.length >= 3) {
    ctx.closePath()
  }
  ctx.stroke()
  
  // วาดจุดแต่ละจุด
  for (let i = 0; i < points.length; i++) {
    const px = points[i].x * w
    const py = points[i].y * h
    
    // วงกลม
    ctx.beginPath()
    ctx.arc(px, py, 6, 0, Math.PI * 2)
    ctx.fillStyle = i === 0 ? '#FF6D00' : '#FFFFFF'
    ctx.fill()
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1.5
    ctx.setLineDash([])
    ctx.stroke()
    
    // เลขลำดับ
    ctx.fillStyle = '#333'
    ctx.font = 'bold 11px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), px, py)
  }
}

/**
 * Resize canvas ให้ตรงกับ image container
 */
function resizeROICanvas() {
  const canvas = roiCanvasRef.value
  const container = roiImageRef.value
  if (!canvas || !container) return
  
  canvas.width = container.offsetWidth
  canvas.height = container.offsetHeight
  
  drawROICanvas()
}

// ---- Counting Polling ----
function startCountingPolling() {
  stopCountingPolling()
  countingTimer.value = setInterval(async () => {
    await fetchCountingStatus()
    await fetchCountingHistory()
  }, 5000) // ทุก 5 วินาที
}

function stopCountingPolling() {
  if (countingTimer.value) {
    clearInterval(countingTimer.value)
    countingTimer.value = null
  }
}

// ---- Polling (ทุก 10 วินาที เมื่อ loop ทำงาน) ----
function startStatusPolling() {
  stopStatusPolling()
  statusTimer.value = setInterval(async () => {
    await fetchStatus()
    await fetchLogs()
  }, 10000)
}

function stopStatusPolling() {
  if (statusTimer.value) {
    clearInterval(statusTimer.value)
    statusTimer.value = null
  }
}

// ---- Helpers ----
function showSnackbar(text, color = 'success') {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

function getImageUrl(filePath) {
  if (!filePath) return ''
  // เพิ่ม cache-bust param เพื่อให้โหลดภาพใหม่ทุกครั้ง
  return `${backendBaseUrl.value}${filePath}?t=${Date.now()}`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function formatFileSize(bytes) {
  if (!bytes || typeof bytes !== 'number') return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

// ---- ROI ResizeObserver ----
let roiResizeObserver = null

// เมื่อ countingStatus เปลี่ยน (มีภาพใหม่) → วาด ROI overlay ใหม่
watch(
  () => countingStatus.value?.lastSnapshotPath,
  () => {
    nextTick(() => {
      setTimeout(() => {
        resizeROICanvas()
      }, 500) // รอให้ภาพโหลดก่อน
    })
  },
)

// เมื่อ roiPoints เปลี่ยน → วาดใหม่
watch(
  roiPoints,
  () => {
    nextTick(() => drawROICanvas())
  },
  { deep: true },
)

// ---- Lifecycle ----
onMounted(async () => {
  // GET endpoints ไม่ต้อง auth จึงใช้งานได้แม้ DB ล่ม
  await fetchStatus()
  await fetchLatest()
  await fetchLogs()
  await fetchCountingStatus()
  await fetchCountingHistory()
  await loadROI()

  // ถ้า loop กำลังทำงานอยู่ → เริ่ม polling
  if (loopRunning.value) {
    startStatusPolling()
  }
  // ถ้า counting loop ทำงานอยู่ → เริ่ม polling
  if (countingRunning.value) {
    startCountingPolling()
  }

  // ตั้ง ResizeObserver เพื่อ resize canvas ตาม container
  nextTick(() => {
    const container = roiImageRef.value
    if (container) {
      roiResizeObserver = new ResizeObserver(() => resizeROICanvas())
      roiResizeObserver.observe(container)
    }
    resizeROICanvas()
  })
})

onBeforeUnmount(() => {
  stopStatusPolling()
  stopCountingPolling()
  if (roiResizeObserver) {
    roiResizeObserver.disconnect()
    roiResizeObserver = null
  }
})
</script>

<template>
  <div class="snapshot-view">
    <!-- Page Header -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard
          class="page-header-gradient"
          style="background: linear-gradient(135deg, #1976D2 0%, #1565C0 50%, #0D47A1 100%);"
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
                    icon="tabler-camera"
                    color="white"
                  />
                </VAvatar>
                <div>
                  <h1 class="text-h3 text-white mb-1">
                    IP Camera Snapshot
                  </h1>
                  <p
                    class="text-body-1 text-white"
                    style="opacity: 0.9;"
                  >
                    ดึงภาพนิ่งจากกล้อง IP Camera พร้อม Image Processing
                  </p>
                </div>
              </div>
              <!-- Loop Status Badge -->
              <VChip
                :color="loopRunning ? 'success' : 'default'"
                :variant="loopRunning ? 'elevated' : 'tonal'"
                size="large"
                class="font-weight-bold"
              >
                <VIcon
                  :icon="loopRunning ? 'tabler-player-play' : 'tabler-player-stop'"
                  class="me-1"
                />
                {{ loopRunning ? `Loop ทำงานอยู่ (ทุก ${statusInfo?.intervalMinutes || loopInterval} นาที)` : 'Loop หยุดอยู่' }}
              </VChip>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Status Cards -->
    <VRow class="mb-4">
      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="52"
                :color="loopRunning ? 'success' : 'grey'"
                variant="tonal"
              >
                <VIcon
                  :icon="loopRunning ? 'tabler-repeat' : 'tabler-repeat-off'"
                  size="28"
                />
              </VAvatar>
              <div>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  สถานะ Loop
                </p>
                <h4 :class="loopRunning ? 'text-success' : 'text-grey'">
                  {{ loopRunning ? 'กำลังทำงาน' : 'หยุดอยู่' }}
                </h4>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="52"
                color="primary"
                variant="tonal"
              >
                <VIcon
                  icon="tabler-camera"
                  size="28"
                />
              </VAvatar>
              <div>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  ถ่ายภาพทั้งหมด
                </p>
                <h4>{{ statusInfo?.totalCaptures || 0 }} ครั้ง</h4>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="52"
                color="error"
                variant="tonal"
              >
                <VIcon
                  icon="tabler-alert-triangle"
                  size="28"
                />
              </VAvatar>
              <div>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  Error ทั้งหมด
                </p>
                <h4>{{ statusInfo?.totalErrors || 0 }} ครั้ง</h4>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="52"
                color="info"
                variant="tonal"
              >
                <VIcon
                  icon="tabler-clock"
                  size="28"
                />
              </VAvatar>
              <div>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  Interval
                </p>
                <h4>{{ statusInfo?.intervalMinutes || loopInterval }} นาที</h4>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Controls + Latest Image -->
    <VRow class="mb-4">
      <!-- Controls -->
      <VCol
        cols="12"
        md="4"
      >
        <VCard>
          <VCardTitle class="d-flex align-center gap-2">
            <VIcon
              icon="tabler-settings"
              size="22"
            />
            ตั้งค่า & ควบคุม
          </VCardTitle>
          <VCardText>
            <!-- Interval Selection -->
            <div class="mb-6">
              <p class="text-body-2 text-medium-emphasis mb-2">
                ระยะเวลา Loop (นาที)
              </p>
              <VSlider
                v-model="loopInterval"
                :min="1"
                :max="5"
                :step="1"
                :disabled="loopRunning"
                thumb-label="always"
                color="primary"
                show-ticks="always"
                tick-size="4"
              >
                <template #append>
                  <VChip
                    color="primary"
                    size="small"
                    class="font-weight-bold"
                  >
                    {{ loopInterval }} นาที
                  </VChip>
                </template>
              </VSlider>
            </div>

            <!-- Action Buttons -->
            <div class="d-flex flex-column gap-3">
              <VBtn
                color="primary"
                size="large"
                block
                :loading="loading"
                :disabled="isProcessing"
                @click="captureNow"
              >
                <VIcon
                  icon="tabler-camera"
                  class="me-2"
                />
                ถ่ายภาพทันที
              </VBtn>

              <VBtn
                v-if="!loopRunning"
                color="success"
                size="large"
                block
                @click="startLoop"
              >
                <VIcon
                  icon="tabler-player-play"
                  class="me-2"
                />
                เริ่ม Loop (ทุก {{ loopInterval }} นาที)
              </VBtn>

              <VBtn
                v-else
                color="error"
                size="large"
                block
                @click="stopLoop"
              >
                <VIcon
                  icon="tabler-player-stop"
                  class="me-2"
                />
                หยุด Loop
              </VBtn>
            </div>

            <!-- Processing Indicator -->
            <VAlert
              v-if="isProcessing"
              type="info"
              variant="tonal"
              class="mt-4"
              density="compact"
            >
              <template #prepend>
                <VProgressCircular
                  indeterminate
                  size="20"
                  width="2"
                  class="me-2"
                />
              </template>
              กำลังประมวลผลภาพ...
            </VAlert>

            <!-- Error Alert -->
            <VAlert
              v-if="error"
              type="error"
              variant="tonal"
              class="mt-4"
              density="compact"
              closable
              @click:close="error = null"
            >
              {{ error }}
            </VAlert>

            <!-- Last capture info -->
            <div
              v-if="statusInfo?.lastCapture"
              class="mt-4"
            >
              <VDivider class="mb-3" />
              <p class="text-body-2 text-medium-emphasis mb-1">
                <VIcon
                  icon="tabler-clock"
                  size="14"
                  class="me-1"
                />
                ถ่ายล่าสุด: {{ formatDate(statusInfo.lastCapture.timestamp) }}
              </p>
              <p
                v-if="statusInfo.lastCapture.duration"
                class="text-body-2 text-medium-emphasis mb-0"
              >
                <VIcon
                  icon="tabler-hourglass"
                  size="14"
                  class="me-1"
                />
                ใช้เวลา: {{ statusInfo.lastCapture.duration }}ms
              </p>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Latest Image -->
      <VCol
        cols="12"
        md="8"
      >
        <VCard>
          <VCardTitle class="d-flex align-center gap-2">
            <VIcon
              icon="tabler-photo"
              size="22"
            />
            ภาพล่าสุด
          </VCardTitle>
          <VCardText>
            <VRow>
              <!-- Original Image -->
              <VCol
                cols="12"
                md="6"
              >
                <p class="text-body-2 text-medium-emphasis mb-2 font-weight-bold">
                  <VIcon
                    icon="tabler-photo"
                    size="16"
                    class="me-1"
                  />
                  ภาพต้นฉบับ
                </p>
                <div
                  class="image-container rounded-lg overflow-hidden"
                  style="background: #f5f5f5; min-height: 240px; display: flex; align-items: center; justify-content: center;"
                >
                  <VImg
                    v-if="latestImage?.filePath"
                    :src="getImageUrl(latestImage.filePath)"
                    max-height="360"
                    contain
                    class="rounded"
                  />
                  <div
                    v-else
                    class="text-center text-medium-emphasis pa-8"
                  >
                    <VIcon
                      icon="tabler-camera-off"
                      size="48"
                      class="mb-2"
                    />
                    <p class="text-body-2">
                      ยังไม่มีภาพ — กดปุ่ม "ถ่ายภาพทันที"
                    </p>
                  </div>
                </div>
                <div
                  v-if="latestImage"
                  class="mt-2"
                >
                  <VChip
                    size="x-small"
                    color="primary"
                    variant="tonal"
                    class="me-1"
                  >
                    {{ latestImage.fileName }}
                  </VChip>
                  <VChip
                    size="x-small"
                    variant="tonal"
                    class="me-1"
                  >
                    {{ formatFileSize(latestImage.fileSize) }}
                  </VChip>
                </div>
              </VCol>

              <!-- Processed Image -->
              <VCol
                cols="12"
                md="6"
              >
                <p class="text-body-2 text-medium-emphasis mb-2 font-weight-bold">
                  <VIcon
                    icon="tabler-adjustments"
                    size="16"
                    class="me-1"
                  />
                  ภาพ Processed (resize + grayscale + blur)
                </p>
                <div
                  class="image-container rounded-lg overflow-hidden"
                  style="background: #f5f5f5; min-height: 240px; display: flex; align-items: center; justify-content: center;"
                >
                  <VImg
                    v-if="latestProcessedImage?.processedPath"
                    :src="getImageUrl(latestProcessedImage.processedPath)"
                    max-height="360"
                    contain
                    class="rounded"
                  />
                  <div
                    v-else
                    class="text-center text-medium-emphasis pa-8"
                  >
                    <VIcon
                      icon="tabler-photo-cog"
                      size="48"
                      class="mb-2"
                    />
                    <p class="text-body-2">
                      ยังไม่มีภาพ processed
                    </p>
                  </div>
                </div>
                <div
                  v-if="latestProcessedImage?.metadata"
                  class="mt-2"
                >
                  <VChip
                    size="x-small"
                    color="secondary"
                    variant="tonal"
                    class="me-1"
                  >
                    {{ formatFileSize(latestProcessedImage.metadata.originalSize) }} → {{ formatFileSize(latestProcessedImage.metadata.processedSize) }}
                  </VChip>
                  <VChip
                    v-if="latestProcessedImage.metadata.grayscale"
                    size="x-small"
                    variant="tonal"
                    class="me-1"
                  >
                    Grayscale
                  </VChip>
                  <VChip
                    v-if="latestProcessedImage.metadata.blur"
                    size="x-small"
                    variant="tonal"
                    class="me-1"
                  >
                    Blur: {{ latestProcessedImage.metadata.blur }}
                  </VChip>
                  <VChip
                    v-if="latestProcessedImage.metadata.resizeWidth"
                    size="x-small"
                    variant="tonal"
                    class="me-1"
                  >
                    {{ latestProcessedImage.metadata.resizeWidth }}px
                  </VChip>
                </div>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- ==================== People Counting Section ==================== -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard
          style="background: linear-gradient(135deg, #6A1B9A 0%, #4A148C 50%, #311B92 100%);"
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
                    icon="tabler-users"
                    color="white"
                  />
                </VAvatar>
                <div>
                  <h1 class="text-h3 text-white mb-1">
                    People Counting
                  </h1>
                  <p
                    class="text-body-1 text-white"
                    style="opacity: 0.9;"
                  >
                    นับจำนวนคนในภาพอัตโนมัติและบันทึกลงฐานข้อมูล
                  </p>
                </div>
              </div>
              <!-- Counting Status Badge -->
              <div class="d-flex align-center gap-3">
                <VChip
                  v-if="countingStatus?.lastCount != null"
                  color="white"
                  variant="elevated"
                  size="x-large"
                  class="font-weight-bold"
                  style="font-size: 1.2rem;"
                >
                  <VIcon
                    icon="tabler-users"
                    class="me-2"
                  />
                  {{ countingStatus.lastCount }} คน
                </VChip>
                <VChip
                  :color="countingRunning ? 'success' : 'default'"
                  :variant="countingRunning ? 'elevated' : 'tonal'"
                  size="large"
                  class="font-weight-bold"
                >
                  <VIcon
                    :icon="countingRunning ? 'tabler-player-play' : 'tabler-player-stop'"
                    class="me-1"
                  />
                  {{ countingRunning ? `นับทุก ${countingStatus?.intervalSeconds || countingInterval} วินาที` : 'ไม่ได้เปิดนับ' }}
                </VChip>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- People Counting Status Cards -->
    <VRow class="mb-4">
      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="52"
                color="deep-purple"
                variant="tonal"
              >
                <VIcon
                  icon="tabler-users"
                  size="28"
                />
              </VAvatar>
              <div>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  จำนวนคนล่าสุด
                </p>
                <h3 class="text-deep-purple">
                  {{ countingStatus?.lastCount ?? '-' }} คน
                </h3>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="52"
                :color="countingRunning ? 'success' : 'grey'"
                variant="tonal"
              >
                <VIcon
                  :icon="countingRunning ? 'tabler-repeat' : 'tabler-repeat-off'"
                  size="28"
                />
              </VAvatar>
              <div>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  สถานะนับคน
                </p>
                <h4 :class="countingRunning ? 'text-success' : 'text-grey'">
                  {{ countingRunning ? 'กำลังนับอัตโนมัติ' : 'หยุดอยู่' }}
                </h4>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="52"
                color="info"
                variant="tonal"
              >
                <VIcon
                  icon="tabler-chart-bar"
                  size="28"
                />
              </VAvatar>
              <div>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  นับทั้งหมด
                </p>
                <h4>{{ countingStatus?.totalCounts || 0 }} ครั้ง</h4>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="52"
                color="warning"
                variant="tonal"
              >
                <VIcon
                  icon="tabler-clock"
                  size="28"
                />
              </VAvatar>
              <div>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  นับล่าสุด
                </p>
                <h4 class="text-body-2">
                  {{ countingStatus?.lastCountTime ? formatDate(countingStatus.lastCountTime) : '-' }}
                </h4>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- People Counting Controls + Latest Counted Image -->
    <VRow class="mb-4">
      <!-- Counting Controls -->
      <VCol
        cols="12"
        md="4"
      >
        <VCard>
          <VCardTitle class="d-flex align-center gap-2">
            <VIcon
              icon="tabler-settings"
              size="22"
            />
            ตั้งค่าการนับคน
          </VCardTitle>
          <VCardText>
            <!-- Interval Selection -->
            <div class="mb-6">
              <p class="text-body-2 text-medium-emphasis mb-2">
                ระยะเวลาการนับ (วินาที)
              </p>
              <VSelect
                v-model="countingInterval"
                :items="intervalOptions"
                item-title="title"
                item-value="value"
                :disabled="countingRunning"
                label="เลือก Interval"
                variant="outlined"
                density="compact"
              />
            </div>

            <!-- Action Buttons -->
            <div class="d-flex flex-column gap-3">
              <VBtn
                color="deep-purple"
                size="large"
                block
                :loading="countingLoading"
                :disabled="countingStatus?.isProcessing"
                @click="countPeopleNow"
              >
                <VIcon
                  icon="tabler-users"
                  class="me-2"
                />
                นับคนทันที
              </VBtn>

              <VBtn
                v-if="!countingRunning"
                color="success"
                size="large"
                block
                @click="startCounting"
              >
                <VIcon
                  icon="tabler-player-play"
                  class="me-2"
                />
                เริ่มนับอัตโนมัติ (ทุก {{ countingInterval }}s)
              </VBtn>

              <VBtn
                v-else
                color="error"
                size="large"
                block
                @click="stopCounting"
              >
                <VIcon
                  icon="tabler-player-stop"
                  class="me-2"
                />
                หยุดนับอัตโนมัติ
              </VBtn>
            </div>

            <!-- AI Warning -->
            <VAlert
              v-if="countingStatus?.aiUnavailable"
              type="warning"
              variant="tonal"
              class="mt-4"
              density="compact"
            >
              AI ตรวจจับไม่พร้อม — ผลนับคนอาจเป็น 0
              <br>
              <small>ต้องติดตั้ง @vladmandic/human + @tensorflow/tfjs-node</small>
            </VAlert>

            <!-- Processing Indicator -->
            <VAlert
              v-if="countingStatus?.isProcessing"
              type="info"
              variant="tonal"
              class="mt-4"
              density="compact"
            >
              <template #prepend>
                <VProgressCircular
                  indeterminate
                  size="20"
                  width="2"
                  class="me-2"
                />
              </template>
              กำลังนับคน...
            </VAlert>

            <!-- Error count -->
            <div
              v-if="countingStatus?.totalErrors > 0"
              class="mt-3"
            >
              <VChip
                color="error"
                size="small"
                variant="tonal"
              >
                Error: {{ countingStatus.totalErrors }} ครั้ง
              </VChip>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Latest Counted Image + ROI Drawing -->
      <VCol
        cols="12"
        md="8"
      >
        <VCard>
          <VCardTitle class="d-flex align-center gap-2">
            <VIcon
              icon="tabler-scan-eye"
              size="22"
            />
            ภาพล่าสุดที่นับคน
            <VSpacer />
            <!-- ROI Status -->
            <VChip
              v-if="roiSaved && roiPoints.length >= 3"
              color="warning"
              size="small"
              variant="tonal"
              class="me-2"
            >
              <VIcon
                icon="tabler-polygon"
                size="14"
                class="me-1"
              />
              ROI: {{ roiPoints.length }} จุด
            </VChip>
            <VChip
              v-if="countingStatus?.lastCount != null"
              color="deep-purple"
              size="large"
              class="font-weight-bold"
            >
              <VIcon
                icon="tabler-users"
                class="me-1"
              />
              {{ countingStatus.lastCount }} คน
            </VChip>
          </VCardTitle>
          <VCardText>
            <!-- ROI Drawing Toolbar -->
            <div class="d-flex align-center gap-2 mb-3 flex-wrap">
              <VBtn
                v-if="!roiDrawing"
                color="warning"
                variant="tonal"
                size="small"
                @click="startDrawROI"
              >
                <VIcon
                  icon="tabler-polygon"
                  class="me-1"
                />
                วาดพื้นที่นับคน (ROI)
              </VBtn>

              <template v-if="roiDrawing">
                <VChip
                  color="warning"
                  size="small"
                  variant="elevated"
                >
                  <VIcon
                    icon="tabler-click"
                    size="14"
                    class="me-1"
                  />
                  คลิกบนภาพเพื่อวาดจุด ({{ roiPoints.length }} จุด)
                </VChip>

                <VBtn
                  color="success"
                  variant="tonal"
                  size="small"
                  :disabled="roiPoints.length < 3"
                  @click="saveROI"
                >
                  <VIcon
                    icon="tabler-check"
                    class="me-1"
                  />
                  บันทึก ROI
                </VBtn>

                <VBtn
                  color="default"
                  variant="tonal"
                  size="small"
                  :disabled="roiPoints.length === 0"
                  @click="undoLastPoint"
                >
                  <VIcon
                    icon="tabler-arrow-back-up"
                    class="me-1"
                  />
                  ย้อนกลับ
                </VBtn>

                <VBtn
                  color="error"
                  variant="text"
                  size="small"
                  @click="cancelDrawROI"
                >
                  ยกเลิก
                </VBtn>
              </template>

              <VBtn
                v-if="!roiDrawing && roiSaved && roiPoints.length >= 3"
                color="error"
                variant="text"
                size="small"
                @click="clearROI"
              >
                <VIcon
                  icon="tabler-trash"
                  class="me-1"
                />
                ล้าง ROI
              </VBtn>
            </div>

            <!-- Image + Canvas Container -->
            <div
              ref="roiImageRef"
              class="roi-image-container rounded-lg overflow-hidden"
              :class="{ 'roi-drawing-mode': roiDrawing }"
              style="background: #1a1a1a; min-height: 320px; position: relative;"
            >
              <img
                v-if="countingStatus?.lastSnapshotPath"
                :src="getImageUrl(countingStatus.lastSnapshotPath)"
                style="width: 100%; height: auto; display: block;"
                @load="resizeROICanvas"
              >
              <div
                v-else
                class="text-center pa-8"
                style="color: rgba(255,255,255,0.5); min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center;"
              >
                <VIcon
                  icon="tabler-users-minus"
                  size="64"
                  class="mb-3"
                />
                <p class="text-body-1">
                  ยังไม่มีภาพ — กดปุ่ม "นับคนทันที" เพื่อเริ่ม
                </p>
              </div>

              <!-- ROI Canvas Overlay -->
              <canvas
                ref="roiCanvasRef"
                class="roi-canvas-overlay"
                :style="{ cursor: roiDrawing ? 'crosshair' : 'default' }"
                @click="onCanvasClick"
              />

              <!-- People Count Overlay -->
              <div
                v-if="countingStatus?.lastSnapshotPath && countingStatus?.lastCount != null"
                class="count-overlay"
              >
                <span class="count-badge">
                  {{ countingStatus.lastCount }}
                </span>
                <span class="count-label">คน</span>
              </div>

              <!-- Drawing Mode Indicator -->
              <div
                v-if="roiDrawing"
                class="drawing-mode-indicator"
              >
                <VIcon
                  icon="tabler-polygon"
                  size="16"
                  class="me-1"
                />
                กำลังวาดพื้นที่
              </div>
            </div>

            <!-- Instructions -->
            <VAlert
              v-if="roiDrawing"
              type="info"
              variant="tonal"
              class="mt-3"
              density="compact"
            >
              <strong>วิธีวาด:</strong> คลิกบนภาพเพื่อวางจุด อย่างน้อย 3 จุดขึ้นไป → กดปุ่ม "บันทึก ROI"
              <br>
              ระบบจะนับเฉพาะคนที่อยู่ภายในพื้นที่ที่วาดเท่านั้น
            </VAlert>

            <!-- ROI Active Alert -->
            <VAlert
              v-if="!roiDrawing && roiSaved && roiPoints.length >= 3"
              type="warning"
              variant="tonal"
              class="mt-3"
              density="compact"
            >
              <VIcon
                icon="tabler-polygon"
                class="me-2"
              />
              <strong>ROI เปิดใช้งาน:</strong> ระบบจะนับเฉพาะคนที่อยู่ในพื้นที่ที่วาด ({{ roiPoints.length }} จุด)
              <br>
              <small>กดปุ่ม "ล้าง ROI" เพื่อนับคนทั้งภาพ</small>
            </VAlert>

            <!-- Timestamp -->
            <div
              v-if="countingStatus?.lastCountTime"
              class="mt-2 d-flex align-center gap-2"
            >
              <VIcon
                icon="tabler-clock"
                size="14"
              />
              <span class="text-body-2 text-medium-emphasis">
                {{ formatDate(countingStatus.lastCountTime) }}
              </span>
              <VChip
                v-if="roiSaved && roiPoints.length >= 3"
                size="x-small"
                color="warning"
                variant="tonal"
              >
                นับเฉพาะใน ROI
              </VChip>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- People Counting History Log -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center gap-2">
              <VIcon
                icon="tabler-chart-line"
                size="22"
              />
              ประวัติการนับคน ({{ countingHistory.length }} รายการ)
            </div>
            <VBtn
              variant="text"
              color="deep-purple"
              size="small"
              @click="fetchCountingHistory"
            >
              <VIcon
                icon="tabler-refresh"
                class="me-1"
              />
              รีเฟรช
            </VBtn>
          </VCardTitle>
          <VCardText>
            <div
              v-if="countingHistory.length === 0"
              class="text-center text-medium-emphasis pa-8"
            >
              <VIcon
                icon="tabler-chart-dots"
                size="48"
                class="mb-2"
              />
              <p class="text-body-2">
                ยังไม่มีประวัตินับคน
              </p>
            </div>

            <div
              v-else
              class="table-responsive"
            >
            <VTable
              density="compact"
              hover
            >
              <thead>
                <tr>
                  <th style="width: 50px;">
                    #
                  </th>
                  <th>เวลา</th>
                  <th>สถานะ</th>
                  <th style="width: 120px;">
                    จำนวนคน
                  </th>
                  <th>ภาพ</th>
                  <th>บันทึก DB</th>
                  <th style="width: 100px;">
                    ระยะเวลา
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(entry, index) in countingHistory"
                  :key="entry.id"
                >
                  <td class="text-medium-emphasis">
                    {{ index + 1 }}
                  </td>
                  <td>
                    <span class="text-body-2">{{ formatDate(entry.timestamp) }}</span>
                  </td>
                  <td>
                    <VChip
                      :color="entry.success ? 'success' : 'error'"
                      size="x-small"
                    >
                      {{ entry.success ? 'สำเร็จ' : 'ผิดพลาด' }}
                    </VChip>
                  </td>
                  <td>
                    <VChip
                      v-if="entry.success"
                      color="deep-purple"
                      size="small"
                      variant="tonal"
                      class="font-weight-bold"
                    >
                      <VIcon
                        icon="tabler-users"
                        size="14"
                        class="me-1"
                      />
                      {{ entry.count }} คน
                    </VChip>
                    <span
                      v-else
                      class="text-medium-emphasis"
                    >-</span>
                  </td>
                  <td>
                    <span
                      v-if="entry.snapshotPath"
                      class="text-body-2"
                    >
                      {{ entry.snapshotPath.split('/').pop() }}
                    </span>
                    <span
                      v-else
                      class="text-medium-emphasis"
                    >-</span>
                  </td>
                  <td>
                    <VChip
                      v-if="entry.savedToDb"
                      color="info"
                      size="x-small"
                      variant="tonal"
                    >
                      saved
                    </VChip>
                    <VTooltip
                      v-else-if="entry.error"
                      :text="entry.error"
                      location="top"
                    >
                      <template #activator="{ props }">
                        <VChip
                          v-bind="props"
                          color="error"
                          size="x-small"
                          variant="tonal"
                        >
                          error
                        </VChip>
                      </template>
                    </VTooltip>
                    <span
                      v-else
                      class="text-medium-emphasis"
                    >-</span>
                  </td>
                  <td>
                    <span class="text-body-2">{{ entry.duration }}ms</span>
                  </td>
                </tr>
              </tbody>
            </VTable>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Capture Logs -->
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center gap-2">
              <VIcon
                icon="tabler-list"
                size="22"
              />
              ประวัติการถ่ายภาพ ({{ logs.length }} รายการ)
            </div>
            <VBtn
              variant="text"
              color="primary"
              size="small"
              @click="fetchLogs"
            >
              <VIcon
                icon="tabler-refresh"
                class="me-1"
              />
              รีเฟรช
            </VBtn>
          </VCardTitle>
          <VCardText>
            <div
              v-if="logs.length === 0"
              class="text-center text-medium-emphasis pa-8"
            >
              <VIcon
                icon="tabler-history"
                size="48"
                class="mb-2"
              />
              <p class="text-body-2">
                ยังไม่มีประวัติการถ่ายภาพ
              </p>
            </div>

            <div
              v-else
              class="table-responsive"
            >
            <VTable
              density="compact"
              hover
            >
              <thead>
                <tr>
                  <th style="width: 50px;">
                    #
                  </th>
                  <th>เวลา</th>
                  <th>สถานะ</th>
                  <th>ไฟล์</th>
                  <th>ขนาด</th>
                  <th>Processing</th>
                  <th style="width: 100px;">
                    ระยะเวลา
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(log, index) in logs"
                  :key="log.id"
                >
                  <td class="text-medium-emphasis">
                    {{ index + 1 }}
                  </td>
                  <td>
                    <span class="text-body-2">{{ formatDate(log.timestamp) }}</span>
                  </td>
                  <td>
                    <VChip
                      :color="log.success ? 'success' : 'error'"
                      size="x-small"
                    >
                      {{ log.success ? 'สำเร็จ' : 'ผิดพลาด' }}
                    </VChip>
                  </td>
                  <td>
                    <span
                      v-if="log.snapshot"
                      class="text-body-2"
                    >
                      {{ log.snapshot.fileName }}
                    </span>
                    <span
                      v-else
                      class="text-medium-emphasis"
                    >-</span>
                  </td>
                  <td>
                    <span v-if="log.snapshot">{{ formatFileSize(log.snapshot.fileSize) }}</span>
                    <span
                      v-else
                      class="text-medium-emphasis"
                    >-</span>
                  </td>
                  <td>
                    <VChip
                      v-if="log.processed"
                      color="info"
                      size="x-small"
                      variant="tonal"
                    >
                      processed
                    </VChip>
                    <VTooltip
                      v-else-if="log.error"
                      :text="log.error"
                      location="top"
                    >
                      <template #activator="{ props }">
                        <VChip
                          v-bind="props"
                          color="error"
                          size="x-small"
                          variant="tonal"
                        >
                          error
                        </VChip>
                      </template>
                    </VTooltip>
                    <span
                      v-else
                      class="text-medium-emphasis"
                    >-</span>
                  </td>
                  <td>
                    <span class="text-body-2">{{ log.duration }}ms</span>
                  </td>
                </tr>
              </tbody>
            </VTable>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Snackbar -->
    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="bottom end"
    >
      {{ snackbarText }}
      <template #actions>
        <VBtn
          variant="text"
          @click="snackbar = false"
        >
          ปิด
        </VBtn>
      </template>
    </VSnackbar>
  </div>
</template>

<style scoped>
.snapshot-view {
  padding: 8px;
}

.image-container {
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.image-container:hover {
  border-color: rgba(0, 0, 0, 0.15);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* People Count Overlay */
.count-overlay {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(106, 27, 154, 0.85);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 8px 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 10;
}

.count-badge {
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}

.count-label {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

/* ROI Image Container */
.roi-image-container {
  position: relative;
  border: 2px solid transparent;
  transition: border-color 0.3s ease;
}

.roi-image-container.roi-drawing-mode {
  border-color: #FF6D00;
  box-shadow: 0 0 0 2px rgba(255, 109, 0, 0.3);
}

/* ROI Canvas Overlay */
.roi-canvas-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
  pointer-events: auto;
}

/* Drawing Mode Indicator */
.drawing-mode-indicator {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  background: rgba(255, 109, 0, 0.9);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  padding: 6px 12px;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  z-index: 10;
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 109, 0, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(255, 109, 0, 0); }
}

.table-responsive {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  width: 100%;
}

/* ===== Responsive ===== */
@media (max-width: 599.98px) {
  .snapshot-view {
    padding: 4px;
  }

  .count-overlay {
    top: 8px;
    right: 8px;
    padding: 6px 12px;
    border-radius: 8px;
  }

  .count-badge {
    font-size: 1.5rem;
  }

  .count-label {
    font-size: 0.75rem;
  }
}
</style>
