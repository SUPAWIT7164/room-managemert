<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
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
const retryCount = ref(0)
const maxRetries = ref(3)
const retryTimer = ref(null)
const imageLoadTimeout = ref(null)
const lastErrorDetails = ref(null)

// รายการกล้องจาก DB
const cameras = ref([])
const cameraId = ref('0')

// ========== ฟีเจอร์การวาดพื้นที่และการนับคนใหม่ ==========
const drawMode = ref(false)
const areas = ref([]) // [{ id, name, roi: [{x,y}] }]
const currentPoints = ref([]) // points while drawing (normalized 0-1)
const areaNameDialog = ref(false)
const newAreaName = ref('')
const snapshotUrlForDraw = ref('')
const snapshotImgRef = ref(null)
const drawCanvasRef = ref(null)
const drawContainerRef = ref(null)
const peopleCountByAreaId = ref({}) // { [areaId]: count }
const peopleByAreaId = ref({}) // { [areaId]: [{ x, y, width, height }] }
const peopleCountTimestamp = ref(null)
const COUNT_INTERVAL_MS = 30000 // นับทุก 30 วินาที
const countPeopleIntervalId = ref(null)
const countPeopleBackendUnavailable = ref(false)
const countPeopleLoading = ref(false)
const lastCountPeopleError = ref('')
const lastCountPeopleHint = ref('')
const snapshotIsPlaceholder = ref(false)
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarHint = ref('')
const snapshotLoadError = ref(false)
const peopleCountLogs = ref([])
const loadingPeopleLogs = ref(false)

// Base URL for API — use relative '/api' so Vite proxy (dev) and IIS (prod) both work
const apiBaseUrl = computed(() => {
  return import.meta.env.VITE_API_BASE_URL || '/api'
})

const imageRef = ref(null)

// Placeholder image when stream fails (1x1 grey JPEG)
const PLACEHOLDER_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwA/AL+AB//Z'

/**
 * Builds an absolute URL for the CCTV MJPEG stream.
 */
const getStreamUrl = (cameraId = 0) => {
  const id = Number(cameraId)
  if (
    cameraId === '' ||
    cameraId === null ||
    cameraId === undefined ||
    !Number.isFinite(id) ||
    id < 0
  ) {
    console.error('[CCTV] URL construction failed: invalid or missing cameraId', { cameraId })
    return null
  }

  try {
    const inBrowser = typeof window !== 'undefined'
    
    // ใช้ apiBaseUrl โดยตรง
    let baseUrl = apiBaseUrl.value || '/api'
    
    // ถ้า baseUrl ไม่มี /api ให้เพิ่ม
    if (!baseUrl.includes('/api')) {
      baseUrl = baseUrl.replace(/\/$/, '') + '/api'
    }
    
    // สร้าง URL สำหรับ stream
    const streamPath = `/cctv/stream?cameraId=${id}&t=${Date.now()}`
    
    // ถ้า baseUrl เป็น relative path ให้ใช้ window.location.origin
    if (baseUrl.startsWith('/')) {
      if (inBrowser) {
        return `${window.location.origin}${baseUrl}${streamPath}`
      } else {
        return `${baseUrl}${streamPath}`
      }
    }
    
    // ถ้า baseUrl เป็น full URL
    if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
      return `${baseUrl}${streamPath}`
    }
    
    // Fallback: ใช้ window.location.origin
    if (inBrowser) {
      return `${window.location.origin}${baseUrl}${streamPath}`
    }
    
    return `${baseUrl}${streamPath}`
  } catch (err) {
    console.error('[CCTV] URL construction failed:', err.message, err)
    return null
  }
}

// Snapshot URL สำหรับวาดพื้นที่
const getSnapshotUrl = () => {
  const baseUrl = apiBaseUrl.value || '/api'
  // ถ้าเป็น relative (/api) → ใช้ origin + /api/cctv/snapshot
  // ถ้าเป็น full URL → ตัด /api ออกแล้วต่อ /api/cctv/snapshot
  if (baseUrl.startsWith('/')) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/api/cctv/snapshot?cameraId=${cameraId.value}&t=${Date.now()}`
  }
  const backendBaseUrl = baseUrl.replace(/\/api\/?$/, '') || baseUrl
  return `${backendBaseUrl}/api/cctv/snapshot?cameraId=${cameraId.value}&t=${Date.now()}`
}

// โหลดรายการกล้องจาก DB
const loadCameras = async () => {
  try {
    const res = await api.get('/cctv/cameras')
    if (res.data?.success && Array.isArray(res.data.data)) {
      cameras.value = res.data.data
      if (cameras.value.length > 0 && (cameraId.value === '0' || !cameraId.value)) {
        cameraId.value = String(cameras.value[0].id)
      }
      snapshotUrlForDraw.value = getSnapshotUrl()
    } else {
      cameras.value = []
    }
  } catch (e) {
    console.warn('[CCTV] loadCameras failed', e?.message)
    cameras.value = []
  }
}

// โหลดพื้นที่ที่บันทึกไว้
const loadAreas = async () => {
  try {
    const res = await api.get('/cctv/areas')
    if (res.data && res.data.success && Array.isArray(res.data.data)) {
      areas.value = (res.data.data || []).map((a, i) => ({
        id: a.id || `area-${i}-${Date.now()}`,
        name: a.name || `พื้นที่ ${i + 1}`,
        roi: Array.isArray(a.roi) ? a.roi : []
      }))
    } else {
      areas.value = []
    }
  } catch (e) {
    console.warn('[CCTV] loadAreas failed:', e?.message)
    areas.value = []
  }
}

// บันทึกพื้นที่
const saveAreas = async () => {
  try {
    const payload = areas.value.map(a => ({ id: a.id, name: a.name, roi: a.roi }))
    await api.put('/cctv/areas', { areas: payload })
    snackbarText.value = 'บันทึกพื้นที่เรียบร้อยแล้ว'
    snackbarHint.value = ''
    snackbar.value = true
  } catch (e) {
    snackbarText.value = e?.response?.data?.message || 'บันทึกพื้นที่ไม่สำเร็จ'
    snackbarHint.value = e?.response?.data?.error || e?.message || ''
    snackbar.value = true
  }
}

// รีเฟรชภาพนิ่งสำหรับวาด
const refreshSnapshotForDraw = () => {
  snapshotLoadError.value = false
  snapshotUrlForDraw.value = getSnapshotUrl()
  nextTick(() => {
    if (drawMode.value && drawCanvasRef.value) sizeDrawCanvasFromSnapshot()
  })
}

// เริ่มโหมดวาด
const startDrawMode = () => {
  drawMode.value = true
  currentPoints.value = []
  snapshotLoadError.value = false
  snapshotUrlForDraw.value = getSnapshotUrl()
  nextTick(() => {
    if (drawCanvasRef.value) sizeDrawCanvasFromSnapshot()
  })
}

// ยกเลิกการวาด
const cancelDrawMode = () => {
  drawMode.value = false
  currentPoints.value = []
}

// คลิกบน canvas เพื่อเพิ่มจุด
const onDrawCanvasClick = (e) => {
  if (!drawMode.value || !drawCanvasRef.value) return
  const rect = drawCanvasRef.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  currentPoints.value.push({ x, y })
  redrawCanvas()
}

// เสร็จสิ้นการวาด
const finishDrawing = () => {
  if (currentPoints.value.length < 3) {
    snackbarText.value = 'วาดอย่างน้อย 3 จุดเพื่อปิดพื้นที่'
    snackbar.value = true
    return
  }
  newAreaName.value = `พื้นที่ ${areas.value.length + 1}`
  areaNameDialog.value = true
}

// ยืนยันชื่อพื้นที่
const confirmNewArea = () => {
  const name = (newAreaName.value || '').trim() || `พื้นที่ ${areas.value.length + 1}`
  areas.value.push({
    id: `area-${Date.now()}`,
    name,
    roi: [...currentPoints.value]
  })
  areaNameDialog.value = false
  newAreaName.value = ''
  drawMode.value = false
  currentPoints.value = []
  saveAreas()
}

// วาด polygon บน canvas
const redrawCanvas = () => {
  const canvas = drawCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  const drawPoly = (points, color, fill) => {
    if (!points || points.length < 2) return
    ctx.strokeStyle = color
    ctx.fillStyle = fill ? color.replace(')', ', 0.2)').replace('rgb', 'rgba') : 'transparent'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(points[0].x * w, points[0].y * h)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x * w, points[i].y * h)
    ctx.closePath()
    if (fill) ctx.fill()
    ctx.stroke()
  }
  areas.value.forEach(a => { if (a.roi && a.roi.length >= 2) drawPoly(a.roi, 'rgba(33, 150, 243, 0.8)', true) })
  if (currentPoints.value.length >= 2) drawPoly(currentPoints.value, 'rgba(255, 152, 0, 0.9)', true)
  currentPoints.value.forEach((p, i) => {
    ctx.fillStyle = '#ff9800'
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 5, 0, Math.PI * 2)
    ctx.fill()
  })
}

// ลบพื้นที่
const removeArea = (id) => {
  areas.value = areas.value.filter(a => a.id !== id)
  saveAreas()
}

// แปลง ArrayBuffer เป็น base64
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// นับคนในพื้นที่
const fetchCountForArea = async (area) => {
  if (!area?.roi?.length) return
  try {
    let imageBase64 = ''
    try {
      const snapRes = await api.get('/cctv/snapshot', {
        params: { cameraId: cameraId.value },
        responseType: 'arraybuffer'
      })
      snapshotIsPlaceholder.value = snapRes.headers?.['x-snapshot-placeholder'] === 'true'
      if (snapRes.data && snapRes.data.byteLength > 0) {
        imageBase64 = arrayBufferToBase64(snapRes.data)
      }
    } catch (snapErr) {
      const status = snapErr?.response?.status
      const data = snapErr?.response?.data
      peopleCountByAreaId.value[area.id] = null
      peopleByAreaId.value[area.id] = []
      lastCountPeopleError.value = data?.message || 'ไม่สามารถโหลดภาพจากกล้องได้'
      lastCountPeopleHint.value = status === 504 || (snapErr?.message || '').includes('timeout') ? 'กล้องตอบสนองช้า — ลองใหม่หรือตรวจสอบเครือข่าย' : ''
      countPeopleBackendUnavailable.value = true
      nextTick(redrawCanvas)
      return
    }

    const body = {
      cameraId: cameraId.value,
      areaId: area.id,
      roi: area.roi
    }
    if (imageBase64) body.image = imageBase64
    const res = await api.post('/cctv/count-people', body)
    const data = res.data
    peopleCountByAreaId.value[area.id] = data.count ?? 0
    peopleByAreaId.value[area.id] = Array.isArray(data.people) ? data.people : []
    peopleCountTimestamp.value = data.timestamp || new Date().toISOString()
    lastCountPeopleError.value = ''
    lastCountPeopleHint.value = ''
    if (data.aiUnavailable) {
      snackbarText.value = 'นับคนได้ 0 เพราะยังไม่ได้ติดตั้ง AI บนเซิร์ฟเวอร์ — รัน: npm install @vladmandic/human @tensorflow/tfjs-node (ในโฟลเดอร์ backend) แล้วรีสตาร์ท'
      snackbarHint.value = 'หรือตรวจสอบ log ของ backend'
      snackbar.value = true
    }
    loadPeopleCountLogs()
    nextTick(redrawCanvas)
  } catch (e) {
    const status = e?.response?.status
    const data = e?.response?.data
    peopleCountByAreaId.value[area.id] = null
    peopleByAreaId.value[area.id] = []
    if (status === 429) {
      snackbarText.value = data?.message || 'ระบบกำลังประมวลผล — รอสักครู่แล้วลองใหม่'
      snackbar.value = true
      return
    }
    if (status === 502 || status === 503 || status >= 500) {
      countPeopleBackendUnavailable.value = true
      lastCountPeopleError.value = data?.message || 'ไม่สามารถดึงภาพจากกล้องได้'
      lastCountPeopleHint.value = data?.hint || ''
      if (countPeopleIntervalId.value) {
        clearInterval(countPeopleIntervalId.value)
        countPeopleIntervalId.value = null
      }
    }
    nextTick(redrawCanvas)
  }
}

// รีเฟรชการนับคนทั้งหมด
const refreshAllPeopleCounts = async () => {
  if (countPeopleBackendUnavailable.value || areas.value.length === 0) return
  if (countPeopleLoading.value) return
  countPeopleLoading.value = true
  try {
    for (const area of areas.value) {
      await fetchCountForArea(area)
    }
  } finally {
    countPeopleLoading.value = false
  }
}

// เริ่มนับอัตโนมัติ
const startCountPeopleInterval = () => {
  if (countPeopleIntervalId.value) clearInterval(countPeopleIntervalId.value)
  countPeopleBackendUnavailable.value = false
  lastCountPeopleError.value = ''
  lastCountPeopleHint.value = ''
  countPeopleIntervalId.value = setInterval(() => refreshAllPeopleCounts(), COUNT_INTERVAL_MS)
  refreshAllPeopleCounts()
}

// หยุดนับอัตโนมัติ
const stopCountPeopleInterval = () => {
  if (countPeopleIntervalId.value) {
    clearInterval(countPeopleIntervalId.value)
    countPeopleIntervalId.value = null
  }
}

// ขนาด canvas ให้ตรงกับภาพนิ่ง
const sizeDrawCanvasFromSnapshot = () => {
  const img = snapshotImgRef.value
  const canvas = drawCanvasRef.value
  if (!img || !canvas) return
  const w = Math.max(1, img.offsetWidth || img.naturalWidth || 0)
  const h = Math.max(1, img.offsetHeight || img.naturalHeight || 0)
  canvas.width = w
  canvas.height = h
  redrawCanvas()
}

// เมื่อ snapshot โหลดเสร็จ
const onSnapshotLoad = () => {
  snapshotLoadError.value = false
  nextTick(() => {
    if (drawMode.value) sizeDrawCanvasFromSnapshot()
  })
}

// เมื่อ snapshot โหลดไม่สำเร็จ
const onSnapshotError = () => {
  snapshotLoadError.value = true
  snackbarText.value = 'โหลดภาพ snapshot ไม่ได้ — ตรวจสอบการเชื่อมต่อกล้องหรือ backend'
  snackbarHint.value = ''
  snackbar.value = true
}

// โหลดประวัติการนับคน
const loadPeopleCountLogs = async () => {
  loadingPeopleLogs.value = true
  try {
    const res = await api.get('/cctv/people-count-logs', {
      params: { limit: 50, camera_id: cameraId.value === '0' ? undefined : cameraId.value }
    })
    if (res.data?.success && Array.isArray(res.data.data)) {
      peopleCountLogs.value = res.data.data
    } else {
      peopleCountLogs.value = []
    }
  } catch (e) {
    console.warn('[CCTV] loadPeopleCountLogs failed', e?.message)
    peopleCountLogs.value = []
  } finally {
    loadingPeopleLogs.value = false
  }
}

// Initialize video stream
const initStream = async () => {
  if (loading.value) return

  // Clear any existing retry timer
  if (retryTimer.value) {
    clearTimeout(retryTimer.value)
    retryTimer.value = null
  }

  // Clear any existing timeout
  if (imageLoadTimeout.value) {
    clearTimeout(imageLoadTimeout.value)
    imageLoadTimeout.value = null
  }

  loading.value = true
  error.value = null
  connectionStatus.value = 'disconnected'

  // Set video stream URL (MJPEG stream)
  const url = getStreamUrl(cameraId.value)
  if (!url) {
    handleStreamError('ไม่พบ URL ของสตรีม')
    return
  }

  imageUrl.value = url
  console.log('[CCTV] Loading stream from URL:', url)

  // Set timeout for image loading (10 seconds)
  imageLoadTimeout.value = setTimeout(() => {
    if (loading.value && connectionStatus.value === 'disconnected') {
      handleStreamError('หมดเวลารอการเชื่อมต่อ - กรุณาตรวจสอบการเชื่อมต่อกล้อง')
    }
  }, 10000)
}

// Refresh image/stream
const refreshImage = () => {
  retryCount.value = 0
  error.value = null
  
  if (retryTimer.value) {
    clearTimeout(retryTimer.value)
    retryTimer.value = null
  }
  if (imageLoadTimeout.value) {
    clearTimeout(imageLoadTimeout.value)
    imageLoadTimeout.value = null
  }
  
  initStream()
}

// เมื่อเปลี่ยนกล้อง
const onCameraChange = () => {
  refreshImage()
  snapshotUrlForDraw.value = getSnapshotUrl()
  loadPeopleCountLogs()
}

// Image/Video load handler
const onImageLoad = async () => {
  if (imageLoadTimeout.value) {
    clearTimeout(imageLoadTimeout.value)
    imageLoadTimeout.value = null
  }

  loading.value = false
  const isPlaceholder = imageRef.value?.src === PLACEHOLDER_DATA_URL || (imageRef.value?.naturalWidth === 1 && imageRef.value?.naturalHeight === 1)
  if (!isPlaceholder) {
    connectionStatus.value = 'connected'
    lastUpdateTime.value = new Date()
    error.value = null
    retryCount.value = 0
  }

  console.log('[CCTV] Image/stream loaded')
}

// Handle stream error with retry logic
const handleStreamError = (errorMessage) => {
  loading.value = false
  connectionStatus.value = 'error'
  imageUrl.value = PLACEHOLDER_DATA_URL

  if (imageLoadTimeout.value) {
    clearTimeout(imageLoadTimeout.value)
    imageLoadTimeout.value = null
  }

  // Try to retry if we haven't exceeded max retries
  if (retryCount.value < maxRetries.value) {
    retryCount.value++
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount.value - 1), 10000)
    
    error.value = `${errorMessage} - กำลังลองใหม่ (${retryCount.value}/${maxRetries.value})...`
    
    console.warn(`[CCTV] Stream error, retrying in ${retryDelay}ms (attempt ${retryCount.value}/${maxRetries.value})`)
    
    retryTimer.value = setTimeout(() => {
      console.log(`[CCTV] Retrying stream connection...`)
      initStream()
    }, retryDelay)
  } else {
    error.value = `${errorMessage} - ลองใหม่ ${maxRetries.value} ครั้งแล้วไม่สำเร็จ`
    console.error('[CCTV] Stream connection failed after max retries')
  }
}

// Image/Video error handler
const onImageError = async (event) => {
  const url = event.target?.src || imageUrl.value
  const target = event.target
  
  // ตรวจสอบว่าเป็น placeholder หรือไม่
  if (url === PLACEHOLDER_DATA_URL) {
    console.log('[CCTV] Placeholder image loaded (expected)')
    return
  }
  
  // ตรวจสอบว่า image โหลดสำเร็จแต่ไม่มีขนาด (อาจเป็น false positive)
  if (target && target.complete && target.naturalWidth > 0 && target.naturalHeight > 0) {
    console.log('[CCTV] Image loaded successfully despite error event', {
      naturalWidth: target.naturalWidth,
      naturalHeight: target.naturalHeight,
      src: url
    })
    // ไม่ต้องทำอะไร เพราะ image โหลดสำเร็จแล้ว
    return
  }
  
  let httpStatus = null

  // ตรวจสอบ HTTP status สำหรับ stream URL เท่านั้น
  if (url && url.includes('/stream')) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      }).catch(() => null)
      if (response) httpStatus = response.status
    } catch (_) {
      // Ignore fetch errors
    }
  }
  
  const errorDetails = {
    event: {
      type: event.type,
      isTrusted: event.isTrusted,
      timestamp: event._vts || new Date().getTime()
    },
    target: target ? {
      src: target.src,
      alt: target.alt,
      complete: target.complete,
      naturalWidth: target.naturalWidth,
      naturalHeight: target.naturalHeight
    } : null,
    src: url,
    httpStatus: httpStatus,
    timestamp: new Date().toISOString(),
    connectionStatus: connectionStatus.value,
    retryCount: retryCount.value,
    loading: loading.value
  }
  
  lastErrorDetails.value = errorDetails
  
  // Log warning แทน error ถ้า HTTP status เป็น 200 (อาจเป็น false positive)
  if (httpStatus === 200) {
    console.warn('[CCTV] Stream Error Details (HTTP 200 - may be false positive):', errorDetails)
    // ถ้า HTTP 200 แต่ image ไม่โหลด อาจเป็นปัญหา CORS หรือ MIME type
    // ให้ลอง retry
    if (retryCount.value < maxRetries.value) {
      console.log('[CCTV] HTTP 200 but image failed to load, will retry...')
      handleStreamError('ภาพไม่สามารถโหลดได้ (HTTP 200) - อาจเป็นปัญหา CORS หรือ MIME type')
      return
    }
  } else {
    console.error('[CCTV] Stream Error Details:', errorDetails)
  }
  
  let errorMessage = 'ไม่สามารถเชื่อมต่อกับวิดีโอสตรีมได้'
  
  if (httpStatus) {
    if (httpStatus === 500) {
      errorMessage = 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ (500) - กรุณาตรวจสอบการตั้งค่ากล้อง CCTV และสถานะ backend server'
    } else if (httpStatus === 503) {
      errorMessage = 'ไม่สามารถเชื่อมต่อกับกล้องได้ (503) - กรุณาตรวจสอบการตั้งค่าและสถานะกล้อง'
    } else if (httpStatus === 401 || httpStatus === 403) {
      errorMessage = 'การยืนยันตัวตนล้มเหลว - กรุณาตรวจสอบ username และ password ของกล้อง'
    } else if (httpStatus === 404) {
      errorMessage = 'ไม่พบ endpoint ของกล้อง - กรุณาตรวจสอบการตั้งค่า CCTV_BASE_URL'
    } else if (httpStatus >= 500) {
      errorMessage = `เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ (${httpStatus}) - กรุณาตรวจสอบ backend logs`
    } else if (httpStatus >= 400) {
      errorMessage = `เกิดข้อผิดพลาด (${httpStatus}) - กรุณาตรวจสอบการตั้งค่า`
    } else if (httpStatus === 200) {
      errorMessage = 'ภาพไม่สามารถโหลดได้ (HTTP 200) - อาจเป็นปัญหา CORS, MIME type หรือ response ไม่ใช่ image'
    }
  } else if (url) {
    // ตรวจสอบว่า URL ถูกต้องหรือไม่
    if (!url.includes('/api/cctv/stream') && !url.includes('/cctv/stream')) {
      console.error('[CCTV] Invalid stream URL:', url)
      errorMessage = `URL ของสตรีมไม่ถูกต้อง: ${url} - กรุณาตรวจสอบการตั้งค่า VITE_API_BASE_URL`
    } else if (url.includes('localhost') || url.includes('127.0.0.1')) {
      errorMessage += ' - กรุณาตรวจสอบว่าเซิร์ฟเวอร์ backend กำลังทำงานอยู่'
    } else {
      errorMessage += ' - กรุณาตรวจสอบการเชื่อมต่อกล้องและข้อมูลการเข้าสู่ระบบ'
    }
    
    if (!url || url === '') {
      errorMessage = 'ไม่พบ URL ของสตรีม - กรุณาตรวจสอบการตั้งค่า'
    }
  } else {
    errorMessage = 'ไม่พบ URL ของสตรีม - กรุณาตรวจสอบการตั้งค่า'
  }
  
  handleStreamError(errorMessage)
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
onMounted(async () => {
  await loadCameras()
  if (!snapshotUrlForDraw.value) snapshotUrlForDraw.value = getSnapshotUrl()
  initStream()
  fetchImageProcessingStatus()
  await loadAreas()
  loadPeopleCountLogs()
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
  if (retryTimer.value) {
    clearTimeout(retryTimer.value)
    retryTimer.value = null
  }
  if (imageLoadTimeout.value) {
    clearTimeout(imageLoadTimeout.value)
    imageLoadTimeout.value = null
  }
  if (countPeopleIntervalId.value) {
    clearInterval(countPeopleIntervalId.value)
    countPeopleIntervalId.value = null
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
          <VCardTitle class="d-flex align-center justify-space-between flex-wrap gap-2">
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-camera-video"
                class="me-2"
              />
              ภาพจากกล้อง CCTV
            </div>
            <VSelect
              v-if="cameras.length > 0"
              v-model="cameraId"
              :items="cameras"
              item-title="name"
              item-value="id"
              label="เลือกกล้อง"
              density="compact"
              style="max-width: 220px;"
              variant="outlined"
              hide-details
              @update:model-value="onCameraChange"
            />
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
                ref="imageRef"
                :src="imageUrl"
                alt="ภาพจากกล้อง CCTV"
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
                  <div class="text-body-2 text-white mb-2">
                    กรุณารอสักครู่
                  </div>
                  <div
                    v-if="retryCount > 0"
                    class="text-caption text-white"
                  >
                    กำลังลองใหม่ ({{ retryCount }}/{{ maxRetries }})
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
                          <span class="ml-2 text-break">{{ imageUrl || 'N/A' }}</span>
                        </div>
                        <div>
                          <span class="font-weight-bold">สถานะ:</span>
                          <span class="ml-2">{{ connectionStatus }}</span>
                        </div>
                        <div>
                          <span class="font-weight-bold">จำนวนครั้งที่ลองใหม่:</span>
                          <span class="ml-2">{{ retryCount }}/{{ maxRetries }}</span>
                        </div>
                        <div>
                          <span class="font-weight-bold">อัพเดทล่าสุด:</span>
                          <span class="ml-2">{{ lastUpdateTime ? formatTime(lastUpdateTime) : 'ยังไม่มี' }}</span>
                        </div>
                        <div>
                          <span class="font-weight-bold">เวลา:</span>
                          <span class="ml-2">{{ new Date().toLocaleString('th-TH') }}</span>
                        </div>
                        <div>
                          <span class="font-weight-bold">Base URL:</span>
                          <span class="ml-2">{{ apiBaseUrl }}</span>
                        </div>
                        <VDivider v-if="lastErrorDetails" class="my-2" />
                        <div
                          v-if="lastErrorDetails"
                          class="mt-2"
                        >
                          <div class="font-weight-bold mb-2">
                            รายละเอียด Error ล่าสุด:
                          </div>
                          <div class="text-caption text-break pa-2 bg-error-container rounded">
                            <div class="mb-1">
                              <span class="font-weight-bold">เวลา:</span>
                              <span class="ml-2">{{ lastErrorDetails.timestamp }}</span>
                            </div>
                            <div class="mb-1">
                              <span class="font-weight-bold">Event Type:</span>
                              <span class="ml-2">{{ lastErrorDetails.event?.type || 'N/A' }}</span>
                            </div>
                            <div class="mb-1">
                              <span class="font-weight-bold">URL ที่ล้มเหลว:</span>
                              <span class="ml-2 text-break">{{ lastErrorDetails.src || 'N/A' }}</span>
                            </div>
                            <div
                              v-if="lastErrorDetails.httpStatus"
                              class="mb-1"
                            >
                              <span class="font-weight-bold">HTTP Status:</span>
                              <VChip
                                :color="lastErrorDetails.httpStatus >= 500 ? 'error' : lastErrorDetails.httpStatus >= 400 ? 'warning' : 'info'"
                                size="x-small"
                                class="ml-2"
                              >
                                {{ lastErrorDetails.httpStatus }}
                              </VChip>
                            </div>
                            <div
                              v-if="lastErrorDetails.target"
                              class="mt-2"
                            >
                              <div class="font-weight-bold mb-1">
                                Image Target Info:
                              </div>
                              <div class="text-caption">
                                <div>Complete: {{ lastErrorDetails.target.complete }}</div>
                                <div>Natural Size: {{ lastErrorDetails.target.naturalWidth }}x{{ lastErrorDetails.target.naturalHeight }}</div>
                              </div>
                            </div>
                          </div>
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

    <!-- ฟีเจอร์การวาดพื้นที่และการนับคน -->
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between flex-wrap gap-2">
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-polygon"
                class="me-2"
              />
              การวาดพื้นที่และการนับคน
            </div>
            <div class="d-flex gap-2">
              <VBtn
                v-if="!drawMode"
                color="primary"
                size="small"
                @click="startDrawMode"
              >
                <VIcon
                  icon="tabler-pencil"
                  class="me-2"
                />
                วาดพื้นที่ใหม่
              </VBtn>
              <VBtn
                v-if="drawMode"
                color="error"
                size="small"
                @click="cancelDrawMode"
              >
                <VIcon
                  icon="tabler-x"
                  class="me-2"
                />
                ยกเลิก
              </VBtn>
              <VBtn
                v-if="drawMode && currentPoints.length >= 3"
                color="success"
                size="small"
                @click="finishDrawing"
              >
                <VIcon
                  icon="tabler-check"
                  class="me-2"
                />
                เสร็จสิ้น
              </VBtn>
              <VBtn
                v-if="!countPeopleIntervalId && areas.length > 0"
                color="info"
                size="small"
                @click="startCountPeopleInterval"
              >
                <VIcon
                  icon="tabler-player-play"
                  class="me-2"
                />
                เริ่มนับอัตโนมัติ
              </VBtn>
              <VBtn
                v-if="countPeopleIntervalId"
                color="warning"
                size="small"
                @click="stopCountPeopleInterval"
              >
                <VIcon
                  icon="tabler-player-stop"
                  class="me-2"
                />
                หยุดนับ
              </VBtn>
              <VBtn
                v-if="areas.length > 0"
                color="secondary"
                size="small"
                :loading="countPeopleLoading"
                @click="refreshAllPeopleCounts"
              >
                <VIcon
                  icon="tabler-refresh"
                  class="me-2"
                />
                นับตอนนี้
              </VBtn>
            </div>
          </VCardTitle>

          <VCardText>
            <div
              v-if="drawMode"
              class="draw-container-wrapper"
            >
              <div
                ref="drawContainerRef"
                class="draw-container"
              >
                <img
                  ref="snapshotImgRef"
                  :src="snapshotUrlForDraw"
                  alt="Snapshot for drawing"
                  class="snapshot-image"
                  @load="onSnapshotLoad"
                  @error="onSnapshotError"
                >
                <canvas
                  ref="drawCanvasRef"
                  class="draw-canvas"
                  @click="onDrawCanvasClick"
                />
                <div
                  v-if="snapshotLoadError"
                  class="snapshot-error-overlay"
                >
                  <VAlert
                    type="error"
                    variant="tonal"
                  >
                    โหลดภาพ snapshot ไม่ได้
                    <template #append>
                      <VBtn
                        size="small"
                        @click="refreshSnapshotForDraw"
                      >
                        ลองใหม่
                      </VBtn>
                    </template>
                  </VAlert>
                </div>
              </div>
              <div class="draw-instructions mt-2">
                <VChip
                  color="info"
                  size="small"
                >
                  <VIcon
                    icon="tabler-info-circle"
                    size="14"
                    class="me-1"
                  />
                  คลิกบนภาพเพื่อวาดพื้นที่ (อย่างน้อย 3 จุด)
                </VChip>
              </div>
            </div>

            <div
              v-else
              class="areas-list"
            >
              <div
                v-if="areas.length === 0"
                class="text-center py-8"
              >
                <VIcon
                  icon="tabler-polygon-off"
                  size="48"
                  color="disabled"
                  class="mb-2"
                />
                <p class="text-body-1 text-disabled">
                  ยังไม่มีพื้นที่ที่วาดไว้
                </p>
                <p class="text-caption text-disabled">
                  คลิก "วาดพื้นที่ใหม่" เพื่อเริ่มวาด
                </p>
              </div>

              <div
                v-else
                class="d-flex flex-column gap-3"
              >
                <VCard
                  v-for="area in areas"
                  :key="area.id"
                  variant="outlined"
                >
                  <VCardText>
                    <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                      <div class="d-flex align-center gap-2">
                        <VIcon
                          icon="tabler-polygon"
                          color="primary"
                        />
                        <div>
                          <div class="font-weight-bold">
                            {{ area.name }}
                          </div>
                          <div class="text-caption text-disabled">
                            {{ area.roi?.length || 0 }} จุด
                          </div>
                        </div>
                      </div>
                      <div class="d-flex align-center gap-2">
                        <VChip
                          v-if="peopleCountByAreaId[area.id] !== null && peopleCountByAreaId[area.id] !== undefined"
                          color="success"
                          size="small"
                        >
                          <VIcon
                            icon="tabler-users"
                            size="14"
                            class="me-1"
                          />
                          {{ peopleCountByAreaId[area.id] }} คน
                        </VChip>
                        <VChip
                          v-else
                          color="warning"
                          size="small"
                        >
                          <VIcon
                            icon="tabler-hourglass"
                            size="14"
                            class="me-1"
                          />
                          ยังไม่นับ
                        </VChip>
                        <VBtn
                          icon
                          size="small"
                          color="error"
                          @click="removeArea(area.id)"
                        >
                          <VIcon
                            icon="tabler-trash"
                            size="18"
                          />
                        </VBtn>
                      </div>
                    </div>
                  </VCardText>
                </VCard>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- ประวัติการนับคน -->
    <VRow v-if="peopleCountLogs.length > 0">
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-history"
              class="me-2"
            />
            ประวัติการนับคน
          </VCardTitle>
          <VCardText>
            <VDataTable
              :headers="[
                { title: 'เวลา', key: 'recorded_at', sortable: true },
                { title: 'กล้อง', key: 'camera_name', sortable: true },
                { title: 'พื้นที่', key: 'zone_name', sortable: true },
                { title: 'จำนวนคน', key: 'count', sortable: true }
              ]"
              :items="peopleCountLogs"
              :loading="loadingPeopleLogs"
              item-value="id"
            />
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Dialog สำหรับตั้งชื่อพื้นที่ -->
    <VDialog
      v-model="areaNameDialog"
      max-width="400"
    >
      <VCard>
        <VCardTitle>
          ตั้งชื่อพื้นที่
        </VCardTitle>
        <VCardText>
          <VTextField
            v-model="newAreaName"
            label="ชื่อพื้นที่"
            placeholder="เช่น พื้นที่นั่ง, พื้นที่ยืน"
            autofocus
            @keyup.enter="confirmNewArea"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="areaNameDialog = false"
          >
            ยกเลิก
          </VBtn>
          <VBtn
            color="primary"
            @click="confirmNewArea"
          >
            บันทึก
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Snackbar สำหรับแสดงข้อความ -->
    <VSnackbar
      v-model="snackbar"
      :timeout="5000"
      location="top"
    >
      {{ snackbarText }}
      <template
        v-if="snackbarHint"
        #append
      >
        <VTooltip
          location="top"
        >
          <template #activator="{ props }">
            <VIcon
              v-bind="props"
              icon="tabler-info-circle"
              size="20"
            />
          </template>
          <span>{{ snackbarHint }}</span>
        </VTooltip>
      </template>
    </VSnackbar>
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

.draw-container-wrapper {
  width: 100%;
}

.draw-container {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.snapshot-image {
  max-width: 100%;
  max-height: 70vh;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

.draw-canvas {
  position: absolute;
  top: 0;
  left: 0;
  cursor: crosshair;
  touch-action: none;
}

.snapshot-error-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
}

.draw-instructions {
  text-align: center;
}

.areas-list {
  min-height: 200px;
}

/* ===== Responsive ===== */
@media (max-width: 959.98px) {
  .camera-wrapper {
    min-height: 300px;
  }

  .error-state-wrapper {
    min-height: 300px;
    padding: 40px 16px;
  }

  .draw-container {
    min-height: 250px;
  }
}

@media (max-width: 599.98px) {
  .camera-wrapper {
    min-height: 200px;
  }

  .camera-image {
    max-height: 50vh;
  }

  .error-state-wrapper {
    min-height: 200px;
    padding: 24px 12px;
  }

  .draw-container {
    min-height: 180px;
  }

  .snapshot-image {
    max-height: 50vh;
  }

  .camera-overlay-info {
    top: 8px;
    right: 8px;
    gap: 4px;
  }
}
</style>
