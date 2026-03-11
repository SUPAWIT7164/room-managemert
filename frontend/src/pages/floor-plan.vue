<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed, watch } from 'vue'
import api from '@/utils/api'

import clearImage from '@/assets/images/clear-image.png'
import conferenceRoomCabaret from '@/assets/images/Conference-Room-Cabaret-3d.jpg'
import floorPlanRoom from '@/assets/images/fc966476d19fd0ba03bad926b24cee41a5b77e41.jpg'
import screenshotFloorPlan from '@/assets/images/Screenshot-2026-03-10-143740.png'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const FLOOR_PLAN_IMAGES = [
  { title: 'ผังชั้น - Clear', url: clearImage },
  { title: 'Conference Room Cabaret 3D', url: conferenceRoomCabaret },
  { title: 'ผังห้อง', url: floorPlanRoom },
  { title: 'ผังชั้น - Screenshot', url: screenshotFloorPlan },
]

const loading = ref(false)
const floorPlanImage = ref('')
const selectedImageIndex = ref(0)
const areas = ref([])
const peopleCounts = ref({})
const refreshTimer = ref(null)
const REFRESH_INTERVAL_MS = 30000

// Drawing state
const drawMode = ref(false)
const currentPoints = ref([])
const areaNameDialog = ref(false)
const newAreaName = ref('')

// Refs
const containerRef = ref(null)
const canvasRef = ref(null)
const imgRef = ref(null)
const imgLoaded = ref(false)

// Snackbar
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('info')

// Edit state
const editMode = ref(false)
const editingAreaId = ref(null)

const totalPeople = computed(() => {
  const counts = peopleCounts.value
  if (!counts || Object.keys(counts).length === 0) return 0
  let total = 0
  const seen = new Set()
  areas.value.forEach(a => {
    const c = counts[a.name]
    if (c && typeof c.count === 'number' && !seen.has(a.name)) {
      total += c.count
      seen.add(a.name)
    }
  })
  return total
})

const loadConfig = async () => {
  try {
    const res = await api.get('/floor-plan/config')
    if (res.data?.success && res.data.data) {
      const cfg = res.data.data
      if (cfg.floorPlanImage) {
        const idx = FLOOR_PLAN_IMAGES.findIndex(img => img.url === cfg.floorPlanImage)
        if (idx >= 0) {
          floorPlanImage.value = FLOOR_PLAN_IMAGES[idx].url
          selectedImageIndex.value = idx
        } else {
          floorPlanImage.value = FLOOR_PLAN_IMAGES[0].url
          selectedImageIndex.value = 0
        }
      }
      if (Array.isArray(cfg.areas)) {
        areas.value = cfg.areas.map((a, i) => ({
          id: a.id || `area-${i}-${Date.now()}`,
          name: a.name || `พื้นที่ ${i + 1}`,
          points: Array.isArray(a.points) ? a.points : [],
          color: a.color || getAreaColor(i),
        }))
      }
    }
  } catch (e) {
    console.warn('[FloorPlan] loadConfig failed:', e?.message)
  }
}

const saveConfig = async () => {
  try {
    const payload = {
      floorPlanImage: floorPlanImage.value,
      areas: areas.value.map(a => ({
        id: a.id,
        name: a.name,
        points: a.points,
        color: a.color,
      })),
    }
    await api.put('/floor-plan/config', payload)
    showSnackbar('บันทึกเรียบร้อย', 'success')
  } catch (e) {
    showSnackbar(e?.response?.data?.message || 'บันทึกไม่สำเร็จ', 'error')
  }
}

const debugInfo = ref(null)

const loadPeopleCounts = async () => {
  try {
    const res = await api.get('/floor-plan/people-counts')
    console.log('[FloorPlan] people-counts response:', JSON.stringify(res.data))
    if (res.data?.success && res.data.data) {
      const raw = res.data.data
      if (raw._all) {
        const allData = raw._all
        const expanded = {}
        areas.value.forEach(a => {
          expanded[a.name] = { ...allData }
        })
        peopleCounts.value = expanded
      } else if (Object.keys(raw).length > 0) {
        peopleCounts.value = raw
      }
    }
  } catch (e) {
    console.warn('[FloorPlan] loadPeopleCounts failed:', e?.message)
  }
}

const loadDebugInfo = async () => {
  try {
    const res = await api.get('/floor-plan/debug-detections')
    debugInfo.value = res.data?.data || res.data
    console.log('[FloorPlan] debug-detections:', JSON.stringify(debugInfo.value))
  } catch (e) {
    debugInfo.value = { error: e?.message || 'ไม่สามารถโหลดข้อมูล debug ได้' }
  }
}

const AREA_COLORS = [
  '#2196F3', '#4CAF50', '#FF9800', '#E91E63',
  '#9C27B0', '#00BCD4', '#FF5722', '#607D8B',
  '#3F51B5', '#009688', '#FFC107', '#795548',
]

const getAreaColor = (index) => AREA_COLORS[index % AREA_COLORS.length]

const showSnackbar = (text, color = 'info') => {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

const onImageSelect = (index) => {
  selectedImageIndex.value = index
  floorPlanImage.value = FLOOR_PLAN_IMAGES[index].url
  imgLoaded.value = false
  nextTick(() => {
    redrawCanvas()
    saveConfig()
  })
}

const onImgLoad = () => {
  imgLoaded.value = true
  nextTick(sizeCanvas)
}

const sizeCanvas = () => {
  const img = imgRef.value
  const canvas = canvasRef.value
  if (!img || !canvas) return
  const w = img.clientWidth || img.offsetWidth || img.naturalWidth || 800
  const h = img.clientHeight || img.offsetHeight || img.naturalHeight || 600
  canvas.width = w
  canvas.height = h
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  redrawCanvas()
}

const redrawCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  areas.value.forEach((area, idx) => {
    if (!area.points || area.points.length < 3) return
    const color = area.color || getAreaColor(idx)

    // Fill polygon
    ctx.beginPath()
    ctx.moveTo(area.points[0].x * w, area.points[0].y * h)
    for (let i = 1; i < area.points.length; i++) {
      ctx.lineTo(area.points[i].x * w, area.points[i].y * h)
    }
    ctx.closePath()
    ctx.fillStyle = hexToRgba(color, 0.25)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Compute centroid for label
    let cx = 0, cy = 0
    area.points.forEach(p => { cx += p.x; cy += p.y })
    cx = (cx / area.points.length) * w
    cy = (cy / area.points.length) * h

    const countData = peopleCounts.value[area.name]
    const count = countData?.count ?? '—'
    const label = area.name
    const countStr = `${count} คน`

    // Background for label
    ctx.font = 'bold 14px sans-serif'
    const labelW = Math.max(ctx.measureText(label).width, ctx.measureText(countStr).width) + 20
    const labelH = 52
    const rx = cx - labelW / 2
    const ry = cy - labelH / 2

    ctx.fillStyle = hexToRgba(color, 0.85)
    roundRect(ctx, rx, ry, labelW, labelH, 8)
    ctx.fill()

    // Area name
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 13px sans-serif'
    ctx.fillText(label, cx, cy - 10)

    // People count
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText(countStr, cx, cy + 12)
  })

  // Draw current drawing points
  if (drawMode.value && currentPoints.value.length > 0) {
    ctx.beginPath()
    ctx.moveTo(currentPoints.value[0].x * w, currentPoints.value[0].y * h)
    for (let i = 1; i < currentPoints.value.length; i++) {
      ctx.lineTo(currentPoints.value[i].x * w, currentPoints.value[i].y * h)
    }
    if (currentPoints.value.length >= 3) ctx.closePath()
    ctx.fillStyle = 'rgba(255, 152, 0, 0.2)'
    ctx.fill()
    ctx.strokeStyle = '#FF9800'
    ctx.lineWidth = 2
    ctx.stroke()

    currentPoints.value.forEach(p => {
      ctx.fillStyle = '#FF9800'
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }
}

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// Drawing
const startDrawMode = () => {
  drawMode.value = true
  currentPoints.value = []
  redrawCanvas()
}

const cancelDrawMode = () => {
  drawMode.value = false
  currentPoints.value = []
  redrawCanvas()
}

const onCanvasClick = (e) => {
  if (!drawMode.value || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  currentPoints.value.push({ x, y })
  redrawCanvas()
}

const finishDrawing = () => {
  if (currentPoints.value.length < 3) {
    showSnackbar('วาดอย่างน้อย 3 จุดเพื่อปิดพื้นที่', 'warning')
    return
  }
  newAreaName.value = `พื้นที่ ${areas.value.length + 1}`
  areaNameDialog.value = true
}

const confirmNewArea = () => {
  const name = (newAreaName.value || '').trim() || `พื้นที่ ${areas.value.length + 1}`
  areas.value.push({
    id: `area-${Date.now()}`,
    name,
    points: [...currentPoints.value],
    color: getAreaColor(areas.value.length),
  })
  areaNameDialog.value = false
  newAreaName.value = ''
  drawMode.value = false
  currentPoints.value = []
  saveConfig()
  redrawCanvas()
}

const removeArea = (id) => {
  areas.value = areas.value.filter(a => a.id !== id)
  saveConfig()
  redrawCanvas()
}

const startAutoRefresh = () => {
  stopAutoRefresh()
  loadPeopleCounts()
  refreshTimer.value = setInterval(() => {
    loadPeopleCounts().then(() => nextTick(redrawCanvas))
  }, REFRESH_INTERVAL_MS)
}

const stopAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

// Resize observer
let resizeObserver = null

onMounted(async () => {
  loading.value = true
  await loadConfig()
  if (!floorPlanImage.value && FLOOR_PLAN_IMAGES.length > 0) {
    floorPlanImage.value = FLOOR_PLAN_IMAGES[0].url
  }
  await loadPeopleCounts()
  loading.value = false

  nextTick(() => {
    sizeCanvas()
    redrawCanvas()
  })

  startAutoRefresh()

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      nextTick(sizeCanvas)
    })
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  stopAutoRefresh()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

watch(peopleCounts, () => {
  nextTick(redrawCanvas)
}, { deep: true })
</script>

<template>
  <div class="floor-plan-page">
    <!-- Header -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard
          style="background: linear-gradient(135deg, #1565C0 0%, #0D47A1 50%, #0A3D91 100%);"
        >
          <VCardText>
            <div class="d-flex align-center justify-space-between flex-wrap gap-4">
              <div class="d-flex align-center gap-4">
                <VAvatar
                  size="80"
                  style="background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px);"
                >
                  <VIcon
                    size="40"
                    icon="tabler-map-2"
                    color="white"
                  />
                </VAvatar>
                <div>
                  <h1 class="text-h3 text-white mb-1">
                    Floor Plan
                  </h1>
                  <p class="text-body-1 text-white" style="opacity: 0.85;">
                    แผนผังชั้นและจำนวนผู้ใช้งานในแต่ละพื้นที่
                  </p>
                </div>
              </div>
              <div class="d-flex gap-2 flex-wrap">
                <VBtn
                  color="white"
                  variant="outlined"
                  @click="loadPeopleCounts().then(() => { redrawCanvas(); showSnackbar('รีเฟรชเรียบร้อย', 'success') })"
                >
                  <VIcon icon="tabler-refresh" class="me-2" />
                  รีเฟรช
                </VBtn>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Stats Cards -->
    <VRow class="mb-4">
      <VCol cols="12" md="4">
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar size="56" color="primary">
                <VIcon icon="tabler-users" size="28" />
              </VAvatar>
              <div>
                <div class="text-caption text-disabled mb-1">จำนวนคนทั้งหมด</div>
                <div class="text-h4 font-weight-bold">{{ totalPeople }}</div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="12" md="4">
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar size="56" color="info">
                <VIcon icon="tabler-map-pin" size="28" />
              </VAvatar>
              <div>
                <div class="text-caption text-disabled mb-1">จำนวนพื้นที่</div>
                <div class="text-h4 font-weight-bold">{{ areas.length }}</div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="12" md="4">
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar size="56" :color="refreshTimer ? 'success' : 'warning'">
                <VIcon :icon="refreshTimer ? 'tabler-player-play' : 'tabler-player-pause'" size="28" />
              </VAvatar>
              <div>
                <div class="text-caption text-disabled mb-1">สถานะ</div>
                <div class="text-h6">{{ refreshTimer ? 'อัปเดตอัตโนมัติ (30 วินาที)' : 'หยุดอัปเดต' }}</div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Floor Plan Image Selector -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center gap-2">
            <VIcon icon="tabler-photo" />
            เลือกรูป Floor Plan
          </VCardTitle>
          <VCardText>
            <div class="floor-plan-gallery d-flex gap-3 flex-wrap">
              <div
                v-for="(img, idx) in FLOOR_PLAN_IMAGES"
                :key="idx"
                class="gallery-item"
                :class="{ 'gallery-item--active': selectedImageIndex === idx }"
                @click="onImageSelect(idx)"
              >
                <img
                  :src="img.url"
                  :alt="img.title"
                  class="gallery-thumb"
                  loading="lazy"
                >
                <div class="gallery-label">{{ img.title }}</div>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Floor Plan Canvas -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between flex-wrap gap-2">
            <div class="d-flex align-center gap-2">
              <VIcon icon="tabler-map-2" />
              แผนผัง Floor Plan
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <VBtn
                v-if="!drawMode"
                color="primary"
                size="small"
                @click="startDrawMode"
              >
                <VIcon icon="tabler-pencil" class="me-2" />
                วาดพื้นที่ใหม่
              </VBtn>
              <VBtn
                v-if="drawMode"
                color="error"
                size="small"
                @click="cancelDrawMode"
              >
                <VIcon icon="tabler-x" class="me-2" />
                ยกเลิก
              </VBtn>
              <VBtn
                v-if="drawMode && currentPoints.length >= 3"
                color="success"
                size="small"
                @click="finishDrawing"
              >
                <VIcon icon="tabler-check" class="me-2" />
                เสร็จสิ้น
              </VBtn>
            </div>
          </VCardTitle>

          <VCardText class="pa-0">
            <div
              ref="containerRef"
              class="floor-plan-container"
            >
              <img
                v-if="floorPlanImage"
                ref="imgRef"
                :src="floorPlanImage"
                alt="Floor Plan"
                class="floor-plan-image"
                crossorigin="anonymous"
                @load="onImgLoad"
              >
              <canvas
                ref="canvasRef"
                class="floor-plan-canvas"
                :class="{ 'canvas-drawing': drawMode }"
                @click="onCanvasClick"
              />

              <!-- Loading overlay -->
              <div v-if="loading" class="floor-plan-loading">
                <VProgressCircular indeterminate color="primary" size="48" />
                <div class="text-body-1 mt-3">กำลังโหลดข้อมูล...</div>
              </div>

              <!-- Draw mode instructions -->
              <div v-if="drawMode" class="draw-mode-badge">
                <VChip color="warning" variant="elevated" size="small">
                  <VIcon icon="tabler-pencil" size="14" class="me-1" />
                  โหมดวาดพื้นที่ — คลิกบนแผนผังเพื่อเพิ่มจุด (อย่างน้อย 3 จุด)
                </VChip>
              </div>
            </div>
          </VCardText>

          <VCardActions>
            <div class="d-flex align-center gap-2">
              <VIcon icon="tabler-info-circle" size="16" />
              <span class="text-caption text-disabled">
                คลิก "วาดพื้นที่ใหม่" เพื่อกำหนดพื้นที่บน Floor Plan ·
                ข้อมูลจำนวนคนอัปเดตอัตโนมัติทุก 30 วินาที
              </span>
            </div>
          </VCardActions>
        </VCard>
      </VCol>
    </VRow>

    <!-- Area List -->
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center gap-2">
            <VIcon icon="tabler-list" />
            รายการพื้นที่
          </VCardTitle>
          <VCardText>
            <div v-if="areas.length === 0" class="text-center py-8">
              <VIcon icon="tabler-map-pin-off" size="48" color="disabled" class="mb-2" />
              <p class="text-body-1 text-disabled">ยังไม่มีพื้นที่</p>
              <p class="text-caption text-disabled">กด "วาดพื้นที่ใหม่" เพื่อเริ่มวาดพื้นที่บน Floor Plan</p>
            </div>

            <VRow v-else>
              <VCol
                v-for="area in areas"
                :key="area.id"
                cols="12"
                sm="6"
                md="4"
                lg="3"
              >
                <VCard variant="outlined" class="area-card">
                  <VCardText>
                    <div class="d-flex align-center gap-3 mb-3">
                      <div
                        class="area-color-dot"
                        :style="{ backgroundColor: area.color || '#2196F3' }"
                      />
                      <div class="flex-grow-1">
                        <div class="font-weight-bold text-body-1">{{ area.name }}</div>
                        <div class="text-caption text-disabled">{{ area.points?.length || 0 }} จุด</div>
                      </div>
                      <VBtn
                        icon
                        size="x-small"
                        color="error"
                        variant="text"
                        @click="removeArea(area.id)"
                      >
                        <VIcon icon="tabler-trash" size="18" />
                      </VBtn>
                    </div>
                    <div class="area-count-display">
                      <VIcon icon="tabler-users" size="20" class="me-2" />
                      <span class="text-h5 font-weight-bold">
                        {{ peopleCounts[area.name]?.count ?? '—' }}
                      </span>
                      <span class="text-body-2 ms-1">คน</span>
                    </div>
                    <div v-if="peopleCounts[area.name]?.recorded_at" class="text-caption text-disabled mt-2">
                      อัปเดต: {{ new Date(peopleCounts[area.name].recorded_at).toLocaleString('th-TH') }}
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Area Name Dialog -->
    <VDialog v-model="areaNameDialog" max-width="400">
      <VCard>
        <VCardTitle>ตั้งชื่อพื้นที่</VCardTitle>
        <VCardText>
          <VTextField
            v-model="newAreaName"
            label="ชื่อพื้นที่"
            placeholder="เช่น ห้องประชุม A, โซน B"
            autofocus
            @keyup.enter="confirmNewArea"
          />
          <div class="text-caption text-disabled mt-2">
            ชื่อพื้นที่ต้องตรงกับ zone_name ในระบบนับคนเพื่อแสดงจำนวนคน
          </div>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="areaNameDialog = false">ยกเลิก</VBtn>
          <VBtn color="primary" @click="confirmNewArea">บันทึก</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Debug Panel -->
    <VRow class="mt-4">
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center gap-2">
              <VIcon icon="tabler-bug" />
              Debug: image_processing_detections
            </div>
            <VBtn size="small" color="secondary" @click="loadDebugInfo">
              <VIcon icon="tabler-refresh" class="me-2" />
              ตรวจสอบข้อมูล
            </VBtn>
          </VCardTitle>
          <VCardText v-if="debugInfo">
            <div class="d-flex flex-column gap-2">
              <div>
                <VChip :color="debugInfo.tableExists ? 'success' : 'error'" size="small" class="me-2">
                  ตาราง: {{ debugInfo.tableExists ? 'มี' : 'ไม่มี' }}
                </VChip>
                <VChip color="info" size="small" class="me-2">
                  แถวทั้งหมด: {{ debugInfo.totalRows ?? '—' }}
                </VChip>
                <VChip color="warning" size="small">
                  recorded_at ล่าสุด: {{ debugInfo.latestRecordedAt ? new Date(debugInfo.latestRecordedAt).toLocaleString('th-TH') : '—' }}
                </VChip>
              </div>
              <div v-if="debugInfo.columns?.length">
                <strong>คอลัมน์:</strong>
                <VChip v-for="col in debugInfo.columns" :key="col.name" size="x-small" class="me-1 mt-1" variant="outlined">
                  {{ col.name }} ({{ col.type }})
                </VChip>
              </div>
              <div v-if="debugInfo.sampleRows?.length">
                <strong>10 แถวล่าสุด:</strong>
                <div style="max-height: 300px; overflow: auto;">
                  <table class="text-caption" style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr>
                        <th v-for="col in Object.keys(debugInfo.sampleRows[0])" :key="col" style="border: 1px solid #ddd; padding: 4px 8px; background: #f5f5f5;">
                          {{ col }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, i) in debugInfo.sampleRows" :key="i">
                        <td v-for="col in Object.keys(row)" :key="col" style="border: 1px solid #ddd; padding: 4px 8px;">
                          {{ row[col] }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div v-if="debugInfo.error" class="text-error">
                Error: {{ debugInfo.error }}
              </div>
              <div v-if="debugInfo.message" class="text-warning">
                {{ debugInfo.message }}
              </div>
            </div>
          </VCardText>
          <VCardText v-else>
            <span class="text-disabled">กด "ตรวจสอบข้อมูล" เพื่อดูข้อมูลในตาราง image_processing_detections</span>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Snackbar -->
    <VSnackbar
      v-model="snackbar"
      :timeout="3000"
      :color="snackbarColor"
      location="top"
    >
      {{ snackbarText }}
    </VSnackbar>
  </div>
</template>

<style scoped>
.floor-plan-page {
  padding: 0;
}

.floor-plan-container {
  position: relative;
  width: 100%;
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.floor-plan-image {
  width: 100%;
  height: auto;
  display: block;
  user-select: none;
  pointer-events: none;
}

.floor-plan-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.floor-plan-canvas.canvas-drawing {
  pointer-events: auto;
  cursor: crosshair;
}

.floor-plan-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  z-index: 10;
}

.draw-mode-badge {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 15;
}

/* Gallery */
.gallery-item {
  cursor: pointer;
  border: 3px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
  width: 140px;
  flex-shrink: 0;
}

.gallery-item:hover {
  border-color: rgba(33, 150, 243, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.gallery-item--active {
  border-color: #1565C0;
  box-shadow: 0 4px 16px rgba(21, 101, 192, 0.3);
}

.gallery-thumb {
  width: 100%;
  height: 90px;
  object-fit: cover;
  display: block;
}

.gallery-label {
  padding: 4px 8px;
  font-size: 11px;
  text-align: center;
  background: #f5f5f5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Area cards */
.area-card {
  transition: all 0.2s ease;
}

.area-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.area-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.area-count-display {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(33, 150, 243, 0.08);
  border-radius: 8px;
}

/* Responsive */
@media (max-width: 959.98px) {
  .gallery-item {
    width: 110px;
  }
  .gallery-thumb {
    height: 70px;
  }
}

@media (max-width: 599.98px) {
  .gallery-item {
    width: 90px;
  }
  .gallery-thumb {
    height: 55px;
  }
  .gallery-label {
    font-size: 10px;
    padding: 2px 4px;
  }
}
</style>
