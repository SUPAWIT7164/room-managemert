<script setup>
import { ref, onMounted, computed, onBeforeUnmount, nextTick } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { useTheme } from 'vuetify'
import { getMultiLineChartConfig, getBarChartConfig } from '@core/libs/apex-chart/apexCharConfig'
import moment from 'moment'
import 'moment/locale/th'
import $ from 'jquery'
import 'daterangepicker'
import api from '@/utils/api'

// Make moment available globally for daterangepicker
if (typeof window !== 'undefined') {
  window.moment = window.moment || moment
  window.$ = window.$ || $
  window.jQuery = window.jQuery || $
}

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const vuetifyTheme = useTheme()

const selectedMeter = ref('all')
const timeGranularity = ref('24h')
const selectedUnit = ref('all') // 'all', 'kW', 'A', 'V', 'kWh'
const loading = ref(false)
const statusMessage = ref(null)
const statusType = ref('info')
const devices = ref([])
/** hour | day | week — จาก API สำหรับรูปแบบแกนเวลา */
const chartBucket = ref('day')

// Date range picker
const dateRangeInput = ref(null)
const startDate = ref(null)
const endDate = ref(null)

// ช่วงวันที่ตามความละเอียดเวลา (สอดคล้องกับตัวเลือก 24h / 7d / 1m)
const syncDatesFromGranularity = () => {
  const end = moment()
  let start
  switch (timeGranularity.value) {
    case '24h':
      start = moment().subtract(24, 'hours')
      break
    case '7d':
      start = moment().subtract(7, 'days')
      break
    case '1m':
      start = moment().subtract(1, 'month')
      break
    default:
      start = moment().startOf('month')
  }
  startDate.value = start.format('YYYY-MM-DD')
  endDate.value = end.format('YYYY-MM-DD')
}

const refreshDatePickerUi = () => {
  nextTick(() => {
    const el = dateRangeInput.value || document.getElementById('dateRangeEnergy')
    if (!el) return
    const jQuery = (typeof window !== 'undefined' && window.$) || $
    const $input = jQuery(el)
    const picker = $input.data('daterangepicker')
    if (picker && startDate.value && endDate.value) {
      picker.setStartDate(moment(startDate.value, 'YYYY-MM-DD'))
      picker.setEndDate(moment(endDate.value, 'YYYY-MM-DD'))
    }
  })
}

const fetchDevices = async () => {
  try {
    const response = await api.get('/energy/devices')
    if (response?.data?.success)
      devices.value = response.data.data || []
  } catch {
    devices.value = []
  }
}

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const emptyChartShape = () => ({
  power: { phase1: [], phase2: [], phase3: [] },
  current: { phase1: [], phase2: [], phase3: [] },
  voltage: { phase1: [], phase2: [], phase3: [] },
  energy: [],
})

const chartData = ref(emptyChartShape())

// Initialize date range picker
const initializeDateRangePicker = () => {
  const tryInitialize = async (retries = 0) => {
    if (retries > 20) {
      console.error('Failed to initialize date range picker after maximum retries')
      return
    }
    
    await nextTick()
    
    let inputElement = dateRangeInput.value
    if (!inputElement) {
      inputElement = document.getElementById('dateRangeEnergy')
    }
    
    if (!inputElement) {
      console.warn(`Date range input not found, retrying... (${retries}/20)`)
      setTimeout(() => tryInitialize(retries + 1), 150)
      return
    }
    
    try {
      // Ensure moment and jQuery are available globally
      if (typeof window !== 'undefined') {
        window.moment = window.moment || moment
        window.$ = window.$ || $
        window.jQuery = window.jQuery || $
      }
      
      // Check if jQuery is available
      const jQueryAvailable = typeof $ !== 'undefined' || (typeof window !== 'undefined' && typeof window.$ !== 'undefined')
      if (!jQueryAvailable) {
        console.error('jQuery is not available')
        setTimeout(() => tryInitialize(retries + 1), 200)
        return
      }
      
      // Use window.$ if available, otherwise use imported $
      const jQuery = (typeof window !== 'undefined' && window.$) || $
      const $input = jQuery(inputElement)
      
      // Check if jQuery wrapped the element properly
      if ($input.length === 0) {
        console.error('Failed to wrap element with jQuery')
        setTimeout(() => tryInitialize(retries + 1), 200)
        return
      }
      
      // Remove existing daterangepicker if any
      if ($input.data('daterangepicker')) {
        $input.data('daterangepicker').remove()
      }
      
      // Initialize daterangepicker
      $input.daterangepicker({
        locale: {
          format: 'DD/MM/YYYY',
          applyLabel: 'ตกลง',
          cancelLabel: 'ยกเลิก',
          daysOfWeek: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
          monthNames: [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
          ],
        },
        startDate: moment(startDate.value || undefined, 'YYYY-MM-DD'),
        endDate: moment(endDate.value || undefined, 'YYYY-MM-DD'),
      }, (start, end) => {
        console.log('Date range selected:', start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'))
        startDate.value = start.format('YYYY-MM-DD')
        endDate.value = end.format('YYYY-MM-DD')
        loadEnergyData()
      })
      
      // Verify daterangepicker was initialized
      const picker = $input.data('daterangepicker')
      if (picker) {
        // Update the ref if it wasn't set
        if (!dateRangeInput.value) {
          dateRangeInput.value = inputElement
        }
      } else {
        setTimeout(() => tryInitialize(retries + 1), 200)
      }
    } catch (error) {
      console.error('Error initializing date range picker:', error)
      setTimeout(() => tryInitialize(retries + 1), 200)
    }
  }
  
  // Start initialization after a short delay to ensure DOM is ready
  setTimeout(() => {
    tryInitialize()
  }, 300)
}

// Handle date range click
const handleDateRangeClick = (event) => {
  event.preventDefault()
  event.stopPropagation()
  if (dateRangeInput.value) {
    const jQuery = (typeof window !== 'undefined' && window.$) || $
    const $input = jQuery(dateRangeInput.value)
    if ($input.data('daterangepicker')) {
      $input.data('daterangepicker').show()
    } else {
      dateRangeInput.value.click()
    }
  }
}

onMounted(async () => {
  moment.locale('th')
  syncDatesFromGranularity()
  initializeDateRangePicker()
  await fetchDevices()
  await loadEnergyData()
  refreshDatePickerUi()
})

onBeforeUnmount(() => {
  // Destroy daterangepicker
  if (dateRangeInput.value) {
    const jQuery = (typeof window !== 'undefined' && window.$) || $
    const $input = jQuery(dateRangeInput.value)
    if ($input.data('daterangepicker')) {
      $input.data('daterangepicker').remove()
    }
  }
})

const handleGranularityChange = () => {
  syncDatesFromGranularity()
  refreshDatePickerUi()
  loadEnergyData()
}

const loadEnergyData = async () => {
  loading.value = true
  statusMessage.value = 'กำลังโหลดข้อมูล...'
  statusType.value = 'info'

  try {
    if (!startDate.value || !endDate.value) {
      statusMessage.value = 'กรุณาเลือกช่วงวันที่'
      statusType.value = 'warning'
      loading.value = false
      return
    }

    const params = {
      period: timeGranularity.value,
      start: startDate.value,
      end: endDate.value,
    }
    if (selectedMeter.value !== 'all')
      params.device_id = selectedMeter.value

    const response = await api.get('/energy/report', { params })
    if (!response?.data?.success)
      throw new Error(response?.data?.message || 'Request failed')

    const payload = response.data.data
    const records = payload?.records || []
    chartBucket.value = payload?.bucket || 'day'

    /** ในฐานข้อมูล power เป็นวัตต์ — แปลงเป็น kW ให้สอดคล้องป้ายกราฟ */
    const toKw = w => parseFloat(w || 0) / 1000
    const num = v => parseFloat(v || 0)

    chartData.value = {
      power: {
        phase1: records.map(d => ({ x: new Date(d.bucket_start).getTime(), y: toKw(d.avg_power) })),
        phase2: records.map(d => ({ x: new Date(d.bucket_start).getTime(), y: toKw(d.avg_power2) })),
        phase3: records.map(d => ({ x: new Date(d.bucket_start).getTime(), y: toKw(d.avg_power3) })),
      },
      current: {
        phase1: records.map(d => ({ x: new Date(d.bucket_start).getTime(), y: num(d.avg_current) })),
        phase2: records.map(d => ({ x: new Date(d.bucket_start).getTime(), y: num(d.avg_current2) })),
        phase3: records.map(d => ({ x: new Date(d.bucket_start).getTime(), y: num(d.avg_current3) })),
      },
      voltage: {
        phase1: records.map(d => ({ x: new Date(d.bucket_start).getTime(), y: num(d.avg_voltage) })),
        phase2: records.map(d => ({ x: new Date(d.bucket_start).getTime(), y: num(d.avg_voltage2) })),
        phase3: records.map(d => ({ x: new Date(d.bucket_start).getTime(), y: num(d.avg_voltage3) })),
      },
      energy: records.map(d => ({ x: new Date(d.bucket_start).getTime(), y: num(d.energy_delta) })),
    }

    const granularityLabels = { '24h': '24 ชั่วโมง', '7d': '7 วัน', '1m': '1 เดือน' }
    const rangeLabel = `${formatDate(startDate.value)} - ${formatDate(endDate.value)}`
    statusMessage.value = records.length
      ? `โหลดข้อมูลสำเร็จ: ${records.length} จุด (${granularityLabels[timeGranularity.value] || ''} · ${rangeLabel})`
      : `ไม่พบข้อมูลในช่วง ${rangeLabel}`
    statusType.value = records.length ? 'success' : 'warning'

    setTimeout(() => {
      statusMessage.value = null
    }, 3000)
  } catch (error) {
    console.error('Error loading energy data:', error)
    statusMessage.value = 'เกิดข้อผิดพลาดในการโหลดข้อมูล'
    statusType.value = 'error'
    chartData.value = emptyChartShape()
  } finally {
    loading.value = false
  }
}

/** รูปแบบแกนเวลาตาม bucket ที่ API รวมข้อมูล (hour / day / week) */
const getDateFormat = () => {
  switch (chartBucket.value) {
    case 'hour':
      return 'dd MMM yyyy HH:mm'
    case 'day':
    case 'week':
      return 'dd MMM yyyy'
    default:
      return 'dd MMM yyyy'
  }
}

const getXAxisFormat = () => {
  switch (chartBucket.value) {
    case 'hour':
      return 'HH:mm'
    case 'day':
      return 'dd MMM'
    case 'week':
      return 'dd MMM yyyy'
    default:
      return 'dd MMM'
  }
}

// Chart options using Vuexy theme - styled like environment page
const powerChartConfig = computed(() => {
  const baseConfig = getMultiLineChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#ab7efd', '#00d4bd', '#ff9f43'],
    chart: {
      ...baseConfig.chart,
      type: 'area',
      stacked: false,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 100],
      },
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    tooltip: {
      ...baseConfig.tooltip,
      x: {
        ...baseConfig.tooltip.x,
        format: getDateFormat(),
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${val?.toFixed(2) || '0'} kW`,
      },
    },
    xaxis: {
      ...baseConfig.xaxis,
      type: 'datetime',
      labels: {
        ...baseConfig.xaxis.labels,
        datetimeUTC: false,
        format: getXAxisFormat(),
      },
    },
    yaxis: {
      ...baseConfig.yaxis,
      title: {
        text: 'กำลังไฟฟ้า (kW)',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: (val) => val?.toFixed(2) || '0',
      },
    },
  }
})

const currentChartConfig = computed(() => {
  const baseConfig = getMultiLineChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#7367f0', '#28c76f', '#ea5455'],
    chart: {
      ...baseConfig.chart,
      type: 'area',
      stacked: false,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 100],
      },
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    tooltip: {
      ...baseConfig.tooltip,
      x: {
        ...baseConfig.tooltip.x,
        format: getDateFormat(),
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${val?.toFixed(2) || '0'} A`,
      },
    },
    xaxis: {
      ...baseConfig.xaxis,
      type: 'datetime',
      labels: {
        ...baseConfig.xaxis.labels,
        datetimeUTC: false,
        format: getXAxisFormat(),
      },
    },
    yaxis: {
      ...baseConfig.yaxis,
      title: {
        text: 'กระแสไฟฟ้า (A)',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: (val) => val?.toFixed(2) || '0',
      },
    },
  }
})

const voltageChartConfig = computed(() => {
  const baseConfig = getMultiLineChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#00cfe8', '#ffa1a1', '#fdd835'],
    chart: {
      ...baseConfig.chart,
      type: 'area',
      stacked: false,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 100],
      },
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    tooltip: {
      ...baseConfig.tooltip,
      x: {
        ...baseConfig.tooltip.x,
        format: getDateFormat(),
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${val?.toFixed(2) || '0'} V`,
      },
    },
    xaxis: {
      ...baseConfig.xaxis,
      type: 'datetime',
      labels: {
        ...baseConfig.xaxis.labels,
        datetimeUTC: false,
        format: getXAxisFormat(),
      },
    },
    yaxis: {
      ...baseConfig.yaxis,
      title: {
        text: 'แรงดันไฟฟ้า (V)',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: (val) => val?.toFixed(2) || '0',
      },
    },
  }
})

const energyChartConfig = computed(() => {
  const baseConfig = getBarChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#826af9'],
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: '50%',
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      ...baseConfig.xaxis,
      type: 'datetime',
      labels: {
        ...baseConfig.xaxis.labels,
        datetimeUTC: false,
        format: getXAxisFormat(),
      },
    },
    yaxis: {
      ...baseConfig.yaxis,
      title: {
        text: 'การใช้พลังงาน (kWh)',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: (val) => val?.toFixed(2) || '0',
      },
    },
    tooltip: {
      ...baseConfig.tooltip,
      x: {
        ...baseConfig.tooltip.x,
        format: getDateFormat(),
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${val?.toFixed(2) || '0'} kWh`,
      },
    },
  }
})
</script>

<template>
  <div>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-chart-line"
                class="me-2"
              />
              <span>รายงานการใช้พลังงาน</span>
            </div>
          </VCardTitle>

          <VDivider />

          <VCardText>
            <!-- Status Message -->
            <VAlert
              v-if="statusMessage"
              :type="statusType"
              variant="tonal"
              class="mb-4"
              closable
              @click:close="statusMessage = null"
            >
              {{ statusMessage }}
            </VAlert>

            <!-- Filters -->
            <VRow class="mb-4">
              <VCol
                cols="12"
                md="3"
              >
                <VSelect
                  v-model="selectedMeter"
                  :items="[
                    { value: 'all', title: 'แสดงทั้งหมด' },
                    ...devices.map(d => ({ value: d.id, title: d.name }))
                  ]"
                  label="เลือกอุปกรณ์"
                  @update:model-value="loadEnergyData"
                />
              </VCol>

              <VCol
                cols="12"
                md="3"
              >
                <VSelect
                  v-model="timeGranularity"
                  :items="[
                    { value: '24h', title: '24 ชั่วโมง' },
                    { value: '7d', title: '7 วัน' },
                    { value: '1m', title: '1 เดือน' },
                  ]"
                  label="ความละเอียดเวลา"
                  @update:model-value="handleGranularityChange"
                />
              </VCol>

              <VCol
                cols="12"
                md="3"
              >
                <VSelect
                  v-model="selectedUnit"
                  :items="[
                    { value: 'all', title: 'แสดงทั้งหมด' },
                    { value: 'kW', title: 'กำลังไฟฟ้า (kW)' },
                    { value: 'A', title: 'กระแสไฟฟ้า (A)' },
                    { value: 'V', title: 'แรงดันไฟฟ้า (V)' },
                    { value: 'kWh', title: 'การใช้พลังงาน (kWh)' },
                  ]"
                  label="เลือกหน่วย"
                />
              </VCol>

              <VCol
                cols="12"
                md="3"
              >
                <div class="date-range-wrapper">
                  <VTextField
                    :model-value="startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : 'เลือกช่วงวันที่'"
                    label="เลือกช่วงวันที่"
                    prepend-inner-icon="tabler-calendar"
                    variant="outlined"
                    density="comfortable"
                    readonly
                    class="filter-input date-range-text-field"
                    @click="handleDateRangeClick"
                  />
                  <input
                    ref="dateRangeInput"
                    id="dateRangeEnergy"
                    type="text"
                    class="date-range-hidden-input"
                  />
                </div>
              </VCol>

              <VCol
                cols="12"
                md="3"
              >
                <VBtn
                  block
                  color="primary"
                  :loading="loading"
                  @click="loadEnergyData"
                >
                  <VIcon
                    icon="tabler-refresh"
                    class="me-2"
                  />
                  รีเฟรชข้อมูล
                </VBtn>
              </VCol>
            </VRow>

            <!-- Loading State -->
            <div
              v-if="loading"
              class="text-center py-12"
            >
              <VProgressCircular
                indeterminate
                color="primary"
                size="64"
              />
              <div class="text-h6 mt-4">กำลังโหลดข้อมูล...</div>
            </div>

            <!-- Charts -->
            <div v-else-if="chartData.power.phase1 && chartData.power.phase1.length > 0">
              <!-- Power Chart (kW) -->
              <VCard
                v-if="selectedUnit === 'all' || selectedUnit === 'kW'"
                class="mb-6"
              >
                <VCardItem class="d-flex flex-wrap justify-space-between gap-4">
                  <div>
                    <VCardTitle class="text-h5 mb-1">
                      <VIcon
                        icon="tabler-bolt"
                        size="24"
                        class="me-2"
                        color="primary"
                      />
                      กำลังไฟฟ้า (kW)
                    </VCardTitle>
                    <VCardSubtitle class="text-body-2">
                      การใช้กำลังไฟฟ้าแยกตามเฟส
                    </VCardSubtitle>
                  </div>
                </VCardItem>

                <VDivider />

                <VCardText>
                  <VueApexCharts
                    type="area"
                    height="400"
                    :options="powerChartConfig"
                    :series="[
                      { name: 'Phase 1', data: chartData.power.phase1 },
                      { name: 'Phase 2', data: chartData.power.phase2 },
                      { name: 'Phase 3', data: chartData.power.phase3 },
                    ]"
                  />
                </VCardText>
              </VCard>

              <!-- Current Chart (A) -->
              <VCard
                v-if="selectedUnit === 'all' || selectedUnit === 'A'"
                class="mb-6"
              >
                <VCardItem class="d-flex flex-wrap justify-space-between gap-4">
                  <div>
                    <VCardTitle class="text-h5 mb-1">
                      <VIcon
                        icon="tabler-current"
                        size="24"
                        class="me-2"
                        color="success"
                      />
                      กระแสไฟฟ้า (A)
                    </VCardTitle>
                    <VCardSubtitle class="text-body-2">
                      กระแสไฟฟ้าแยกตามเฟส
                    </VCardSubtitle>
                  </div>
                </VCardItem>

                <VDivider />

                <VCardText>
                  <VueApexCharts
                    type="area"
                    height="400"
                    :options="currentChartConfig"
                    :series="[
                      { name: 'Phase 1', data: chartData.current.phase1 },
                      { name: 'Phase 2', data: chartData.current.phase2 },
                      { name: 'Phase 3', data: chartData.current.phase3 },
                    ]"
                  />
                </VCardText>
              </VCard>

              <!-- Voltage Chart (V) -->
              <VCard
                v-if="selectedUnit === 'all' || selectedUnit === 'V'"
                class="mb-6"
              >
                <VCardItem class="d-flex flex-wrap justify-space-between gap-4">
                  <div>
                    <VCardTitle class="text-h5 mb-1">
                      <VIcon
                        icon="tabler-flash"
                        size="24"
                        class="me-2"
                        color="warning"
                      />
                      แรงดันไฟฟ้า (V)
                    </VCardTitle>
                    <VCardSubtitle class="text-body-2">
                      แรงดันไฟฟ้าแยกตามเฟส
                    </VCardSubtitle>
                  </div>
                </VCardItem>

                <VDivider />

                <VCardText>
                  <VueApexCharts
                    type="area"
                    height="400"
                    :options="voltageChartConfig"
                    :series="[
                      { name: 'Phase 1', data: chartData.voltage.phase1 },
                      { name: 'Phase 2', data: chartData.voltage.phase2 },
                      { name: 'Phase 3', data: chartData.voltage.phase3 },
                    ]"
                  />
                </VCardText>
              </VCard>

              <!-- Energy Chart (kWh) -->
              <VCard
                v-if="selectedUnit === 'all' || selectedUnit === 'kWh'"
              >
                <VCardItem class="d-flex flex-wrap justify-space-between gap-4">
                  <div>
                    <VCardTitle class="text-h5 mb-1">
                      <VIcon
                        icon="tabler-battery"
                        size="24"
                        class="me-2"
                        color="info"
                      />
                      การใช้พลังงาน (kWh)
                    </VCardTitle>
                    <VCardSubtitle class="text-body-2">
                      พลังงานรวมที่ใช้ในแต่ละช่วงเวลา
                    </VCardSubtitle>
                  </div>
                </VCardItem>

                <VDivider />

                <VCardText>
                  <VueApexCharts
                    type="bar"
                    height="400"
                    :options="energyChartConfig"
                    :series="[{ name: 'การใช้พลังงาน', data: chartData.energy }]"
                  />
                </VCardText>
              </VCard>
            </div>

            <!-- No Data State -->
            <VAlert
              v-else
              type="warning"
              variant="tonal"
              prominent
            >
              <VAlertTitle>
                <VIcon
                  icon="tabler-info-circle"
                  class="me-2"
                />
                ไม่พบข้อมูลการใช้พลังงาน
              </VAlertTitle>
              <div>กรุณาเลือกช่วงเวลาอื่นหรือตรวจสอบการเชื่อมต่ออุปกรณ์</div>
            </VAlert>

          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/libs/apex-chart.scss";

.apexcharts-canvas {
  margin: 0 auto;
}

/* Date Range Picker Styling */
.date-range-wrapper {
  position: relative;
}

.date-range-text-field {
  cursor: pointer;
  pointer-events: none;
}

.date-range-text-field :deep(.v-field) {
  cursor: pointer;
  pointer-events: auto;
}

.date-range-hidden-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 56px; /* Match VTextField height for density="comfortable" */
  opacity: 0;
  cursor: pointer;
  z-index: 2;
  pointer-events: auto;
  border: none;
  background: transparent;
}

/* Filter Input Styling */
.filter-input :deep(.v-field) {
  background-color: rgba(255, 255, 255, 0.8);
  transition: all 0.2s ease;
}

.filter-input :deep(.v-field:hover) {
  background-color: rgba(255, 255, 255, 1);
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.08);
}

.filter-input :deep(.v-field--focused) {
  background-color: rgba(255, 255, 255, 1);
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

/* Ensure daterangepicker is visible */
:deep(.daterangepicker) {
  z-index: 9999 !important;
  display: block !important;
}
</style>

