<script setup>
import { ref, onMounted, computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { useTheme } from 'vuetify'
import { getMultiLineChartConfig, getBarChartConfig } from '@core/libs/apex-chart/apexCharConfig'
import AppDateTimePicker from '@/@core/components/app-form-elements/AppDateTimePicker.vue'

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const vuetifyTheme = useTheme()

const selectedMeter = ref('all')
const dateRange = ref([])
const timeGranularity = ref('24h')
const customDateRange = ref('')
const showCustomDatePicker = ref(false)
const selectedView = ref('all') // 'all', 'flow', 'consumption', 'cost'
const loading = ref(false)
const statusMessage = ref(null)
const statusType = ref('info')
const devices = ref([
  { id: 1, name: 'มิเตอร์น้ำ - อาคาร 1' },
  { id: 2, name: 'มิเตอร์น้ำ - อาคาร 2' },
  { id: 3, name: 'มิเตอร์น้ำ - อาคาร 3' },
])

const chartData = ref({
  flow: [],
  consumption: [],
  cost: [],
})

// Statistics data
const statistics = ref({
  totalConsumption: 0,
  averageFlow: 0,
  totalCost: 0,
  peakFlow: 0,
  currentConsumption: 0, // ค่าปัจจุบันของปริมาณการใช้น้ำ (ลบ.ม.)
  currentFlow: 0, // ค่าปัจจุบันของอัตราการไหล (ลบ.ม./ชม.)
})

// Initialize date range to today
onMounted(() => {
  const today = new Date()
  dateRange.value = [today, today]
  const todayStr = today.toISOString().split('T')[0]
  customDateRange.value = `${todayStr} to ${todayStr}`
  loadWaterData()
})

// Watch timeGranularity to show/hide custom date picker
const handleGranularityChange = (value) => {
  if (value === 'custom') {
    showCustomDatePicker.value = true
  } else {
    showCustomDatePicker.value = false
    loadWaterData()
  }
}

// Watch customDateRange changes and reload data
const handleCustomDateRangeChange = (value) => {
  if (timeGranularity.value === 'custom' && value) {
    const dateParts = value.split(' to ')
    if (dateParts.length === 2) {
      loadWaterData()
    }
  }
}

// Generate mock data with aggregation based on granularity
const generateMockData = (granularity, customStartDate = null, customEndDate = null) => {
  const data = []
  
  let startDate = null
  let endDate = null
  let dataPoints = 0
  let timeInterval = 0
  let timeLabel = ''
  
  if (granularity === 'custom' && customStartDate && customEndDate) {
    startDate = new Date(customStartDate)
    endDate = new Date(customEndDate)
    
    const diffTime = Math.abs(endDate - startDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 1) {
      timeInterval = 60 * 60 * 1000
      dataPoints = Math.min(24, diffDays * 24)
    } else if (diffDays <= 7) {
      timeInterval = 24 * 60 * 60 * 1000
      dataPoints = diffDays
    } else if (diffDays <= 30) {
      timeInterval = 24 * 60 * 60 * 1000
      dataPoints = Math.min(30, diffDays)
    } else {
      timeInterval = diffDays > 90 ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      dataPoints = diffDays > 90 ? Math.floor(diffDays / 7) : diffDays
    }
    timeLabel = 'custom'
  } else {
    endDate = new Date()
    
    switch (granularity) {
      case '24h':
        dataPoints = 24
        timeInterval = 60 * 60 * 1000
        timeLabel = 'hour'
        break
      case '7d':
        dataPoints = 7
        timeInterval = 24 * 60 * 60 * 1000
        timeLabel = 'day'
        break
      case '1m':
        dataPoints = 30
        timeInterval = 24 * 60 * 60 * 1000
        timeLabel = 'day'
        break
      default:
        dataPoints = 24
        timeInterval = 60 * 60 * 1000
    }
  }
  
  const baseMultiplier = granularity === '24h' || timeLabel === 'hour' ? 1 : (granularity === '7d' || (timeLabel === 'day' && dataPoints <= 7) ? 1.2 : 1.5)
  
  for (let i = 0; i <= dataPoints; i++) {
    const time = granularity === 'custom' && startDate 
      ? new Date(startDate.getTime() + i * timeInterval)
      : new Date(endDate.getTime() - (dataPoints - i) * timeInterval)
    
    if (granularity === 'custom' && time > endDate) {
      break
    }
    
    // ข้อมูลการใช้น้ำ (ลิตร/ชั่วโมง) - มีการเปลี่ยนแปลงตามช่วงเวลา
    const hourOfDay = time.getHours()
    const isWorkingHours = hourOfDay >= 8 && hourOfDay <= 18
    const flowMultiplier = isWorkingHours ? 1.5 : 0.5
    const flowRate = (Math.random() * 30 + 80 * baseMultiplier * flowMultiplier).toFixed(2)
    
    // ข้อมูลการใช้น้ำสะสม (ลิตร) - สะสมตามอัตราการไหล
    const consumption = (parseFloat(flowRate) * (timeInterval / (60 * 60 * 1000)) + Math.random() * 100).toFixed(2)
    
    // ต้นทุนการใช้น้ำ (บาท) - ประมาณ 0.015 บาท/ลิตร
    const cost = (parseFloat(consumption) * 0.015).toFixed(2)
    
    data.push({
      time: time.toISOString(),
      FLOW_RATE: flowRate,
      CONSUMPTION: consumption,
      COST: cost,
    })
  }
  
  return data
}

const loadWaterData = async () => {
  loading.value = true
  statusMessage.value = 'กำลังโหลดข้อมูล...'
  statusType.value = 'info'
  
  try {
    if (timeGranularity.value === 'custom') {
      if (!customDateRange.value || !customDateRange.value.includes(' to ')) {
        statusMessage.value = 'กรุณาเลือกช่วงวันที่'
        statusType.value = 'warning'
        loading.value = false
        return
      }
    }
    
    const delayTime = timeGranularity.value === '24h' ? 300 : 
                      timeGranularity.value === '7d' ? 200 : 
                      timeGranularity.value === '1m' ? 150 : 100
    
    await new Promise(resolve => setTimeout(resolve, delayTime))
    
    let customStart = null
    let customEnd = null
    if (timeGranularity.value === 'custom' && customDateRange.value && customDateRange.value.includes(' to ')) {
      const dateParts = customDateRange.value.split(' to ')
      customStart = dateParts[0]
      customEnd = dateParts[1]
    }
    const mockData = generateMockData(timeGranularity.value, customStart, customEnd)
    
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        // Convert to cubic meters for chart display (multiply by 1000 to show in liters then divide by 1000 in formatter)
        chartData.value = {
          flow: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.FLOW_RATE) })),
          consumption: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.CONSUMPTION) })),
          cost: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.COST) })),
        }
        
        // Calculate statistics
        const totalConsumption = mockData.reduce((sum, d) => sum + parseFloat(d.CONSUMPTION), 0)
        const averageFlow = mockData.reduce((sum, d) => sum + parseFloat(d.FLOW_RATE), 0) / mockData.length
        const totalCost = mockData.reduce((sum, d) => sum + parseFloat(d.COST), 0)
        const peakFlow = Math.max(...mockData.map(d => parseFloat(d.FLOW_RATE)))
        
        // Get current values (latest data point)
        const latestData = mockData[mockData.length - 1]
        const currentConsumption = latestData ? (parseFloat(latestData.CONSUMPTION) / 1000).toFixed(2) : '0.00'
        const currentFlow = latestData ? (parseFloat(latestData.FLOW_RATE) / 1000).toFixed(2) : '0.00'
        
        statistics.value = {
          totalConsumption: (totalConsumption / 1000).toFixed(2), // Convert to cubic meters
          averageFlow: averageFlow.toFixed(2),
          totalCost: totalCost.toFixed(2),
          peakFlow: peakFlow.toFixed(2),
          currentConsumption: currentConsumption,
          currentFlow: currentFlow,
        }
        
        resolve()
      })
    })
    
    const granularityLabels = {
      '24h': '24 ชั่วโมง',
      '7d': '7 วัน',
      '1m': '1 เดือน',
      'custom': 'เลือกเอง',
    }
    
    let dateRangeLabel = ''
    if (timeGranularity.value === 'custom' && customDateRange.value && customDateRange.value.includes(' to ')) {
      const dateParts = customDateRange.value.split(' to ')
      dateRangeLabel = ` (${new Date(dateParts[0]).toLocaleDateString('th-TH')} - ${new Date(dateParts[1]).toLocaleDateString('th-TH')})`
    }
    
    statusMessage.value = `โหลดข้อมูลสำเร็จ: ${mockData.length} จุดข้อมูล (${granularityLabels[timeGranularity.value]}${dateRangeLabel})`
    statusType.value = 'success'
    
    setTimeout(() => {
      statusMessage.value = null
    }, 3000)
  } catch (error) {
    console.error('Error loading water data:', error)
    statusMessage.value = 'เกิดข้อผิดพลาดในการโหลดข้อมูล'
    statusType.value = 'error'
  } finally {
    loading.value = false
  }
}

const getDateFormat = (granularity) => {
  switch (granularity) {
    case '24h':
      return 'dd MMM yyyy HH:mm'
    case '7d':
      return 'dd MMM yyyy'
    case '1m':
      return 'dd MMM yyyy'
    case 'custom':
      if (customDateRange.value && customDateRange.value.includes(' to ')) {
        const dateParts = customDateRange.value.split(' to ')
        const diffTime = Math.abs(new Date(dateParts[1]) - new Date(dateParts[0]))
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays <= 1) {
          return 'dd MMM yyyy HH:mm'
        }
      }
      return 'dd MMM yyyy'
    default:
      return 'dd MMM yyyy HH:mm'
  }
}

const getXAxisFormat = (granularity) => {
  switch (granularity) {
    case '24h':
      return 'HH:mm'
    case '7d':
      return 'dd MMM'
    case '1m':
      return 'dd MMM'
    case 'custom':
      if (customDateRange.value && customDateRange.value.includes(' to ')) {
        const dateParts = customDateRange.value.split(' to ')
        const diffTime = Math.abs(new Date(dateParts[1]) - new Date(dateParts[0]))
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays <= 1) {
          return 'HH:mm'
        } else if (diffDays <= 7) {
          return 'dd MMM'
        } else if (diffDays <= 30) {
          return 'dd MMM'
        } else {
          return 'dd MMM yyyy'
        }
      }
      return 'dd MMM'
    default:
      return 'HH:mm'
  }
}

const flowChartConfig = computed(() => {
  const baseConfig = getMultiLineChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#ff9800'],
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
        format: getDateFormat(timeGranularity.value),
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${(val / 1000)?.toFixed(2) || '0'} ลบ.ม./ชม.`,
      },
    },
    xaxis: {
      ...baseConfig.xaxis,
      type: 'datetime',
      labels: {
        ...baseConfig.xaxis.labels,
        datetimeUTC: false,
        format: getXAxisFormat(timeGranularity.value),
      },
    },
    yaxis: {
      ...baseConfig.yaxis,
      title: {
        text: 'อัตราการไหล (ลบ.ม./ชม.)',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: (val) => (val / 1000)?.toFixed(2) || '0',
      },
    },
  }
})

const consumptionChartConfig = computed(() => {
  const baseConfig = getMultiLineChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#ff9800'],
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
    xaxis: {
      ...baseConfig.xaxis,
      type: 'datetime',
      labels: {
        ...baseConfig.xaxis.labels,
        datetimeUTC: false,
        format: getXAxisFormat(timeGranularity.value),
      },
    },
    yaxis: {
      ...baseConfig.yaxis,
      title: {
        text: 'ปริมาณการใช้น้ำ (ลบ.ม.)',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: (val) => (val / 1000)?.toFixed(2) || '0',
      },
    },
    tooltip: {
      ...baseConfig.tooltip,
      x: {
        ...baseConfig.tooltip.x,
        format: getDateFormat(timeGranularity.value),
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${(val / 1000)?.toFixed(2) || '0'} ลบ.ม.`,
      },
    },
  }
})

const costChartConfig = computed(() => {
  const baseConfig = getBarChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#ea5455'],
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
        format: getXAxisFormat(timeGranularity.value),
      },
    },
    yaxis: {
      ...baseConfig.yaxis,
      title: {
        text: 'ต้นทุน (บาท)',
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
        format: getDateFormat(timeGranularity.value),
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${val?.toFixed(2) || '0'} บาท`,
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
                icon="tabler-droplet"
                class="me-2"
              />
              <span>รายงานการใช้น้ำ</span>
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

            <!-- Statistics Summary Cards -->
            <VRow class="mb-6">
              <VCol
                cols="12"
                sm="6"
                md="3"
              >
                <VCard>
                  <VCardText class="d-flex align-center pa-4">
                    <VAvatar
                      size="50"
                      color="primary"
                      variant="tonal"
                      class="me-3"
                    >
                      <VIcon
                        size="30"
                        icon="tabler-droplet-filled"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-caption text-uppercase text-disabled mb-1">
                        ปริมาณการใช้น้ำ
                      </div>
                      <h3 class="text-h3 font-weight-bold text-primary">
                        {{ statistics.totalConsumption }}
                      </h3>
                      <span class="text-body-2 text-disabled">ลูกบาศก์เมตร</span>
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
                  <VCardText class="d-flex align-center pa-4">
                    <VAvatar
                      size="50"
                      color="success"
                      variant="tonal"
                      class="me-3"
                    >
                      <VIcon
                        size="30"
                        icon="tabler-gauge"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-caption text-uppercase text-disabled mb-1">
                        อัตราการไหลเฉลี่ย
                      </div>
                      <h3 class="text-h3 font-weight-bold text-success">
                        {{ statistics.averageFlow }}
                      </h3>
                      <span class="text-body-2 text-disabled">ลิตร/ชั่วโมง</span>
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
                  <VCardText class="d-flex align-center pa-4">
                    <VAvatar
                      size="50"
                      color="warning"
                      variant="tonal"
                      class="me-3"
                    >
                      <VIcon
                        size="30"
                        icon="tabler-trending-up"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-caption text-uppercase text-disabled mb-1">
                        อัตราการไหลสูงสุด
                      </div>
                      <h3 class="text-h3 font-weight-bold text-warning">
                        {{ statistics.peakFlow }}
                      </h3>
                      <span class="text-body-2 text-disabled">ลิตร/ชั่วโมง</span>
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
                  <VCardText class="d-flex align-center pa-4">
                    <VAvatar
                      size="50"
                      color="error"
                      variant="tonal"
                      class="me-3"
                    >
                      <VIcon
                        size="30"
                        icon="tabler-currency-baht"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-caption text-uppercase text-disabled mb-1">
                        ต้นทุนรวม
                      </div>
                      <h3 class="text-h3 font-weight-bold text-error">
                        {{ statistics.totalCost }}
                      </h3>
                      <span class="text-body-2 text-disabled">บาท/ชม.</span>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>

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
                  @update:model-value="loadWaterData"
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
                    { value: 'custom', title: 'เลือกเอง' },
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
                  v-model="selectedView"
                  :items="[
                    { value: 'all', title: 'แสดงทั้งหมด' },
                    { value: 'flow', title: 'อัตราการไหล' },
                    { value: 'consumption', title: 'ปริมาณการใช้น้ำ' },
                    { value: 'cost', title: 'ต้นทุน' },
                  ]"
                  label="เลือกมุมมอง"
                />
              </VCol>

              <VCol
                v-if="showCustomDatePicker"
                cols="12"
                md="12"
              >
                <AppDateTimePicker
                  v-model="customDateRange"
                  label="เลือกช่วงวันที่"
                  :config="{ mode: 'range', dateFormat: 'Y-m-d', locale: 'th' }"
                  placeholder="เลือกวันที่เริ่มต้น - วันที่สิ้นสุด"
                  @update:model-value="handleCustomDateRangeChange"
                />
              </VCol>

              <VCol
                cols="12"
                md="3"
              >
                <VBtn
                  block
                  color="primary"
                  :loading="loading"
                  @click="loadWaterData"
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
            <div v-else-if="chartData.flow && chartData.flow.length > 0">
              <!-- Flow Rate Chart -->
              <VCard
                v-if="selectedView === 'all' || selectedView === 'flow'"
                class="mb-6"
              >
                <VCardItem class="d-flex flex-wrap justify-space-between gap-4">
                  <div class="flex-grow-1">
                    <VCardTitle class="text-h5 mb-1">
                      <VIcon
                        icon="tabler-droplet-filled"
                        size="24"
                        class="me-2"
                        color="primary"
                      />
                      อัตราการไหลของน้ำ
                    </VCardTitle>
                    <VCardSubtitle class="text-body-2">
                      24 ชั่วโมงล่าสุด
                    </VCardSubtitle>
                  </div>
                  <div class="d-flex align-center">
                    <div class="text-right">
                      <div class="text-caption text-disabled mb-1">
                        ค่าปัจจุบัน
                      </div>
                      <div class="text-h4 font-weight-bold text-primary">
                        {{ statistics.currentFlow }} <span class="text-body-2">ลบ.ม./ชม.</span>
                      </div>
                    </div>
                  </div>
                </VCardItem>

                <VDivider />

                <VCardText>
                  <div class="mb-2">
                    <span class="d-inline-flex align-center">
                      <span
                        class="me-2"
                        style="width: 12px; height: 12px; background-color: #00d4bd; border-radius: 2px;"
                      />
                      <span class="text-body-2">อัตราการไหลของน้ำ</span>
                    </span>
                  </div>
                  <VueApexCharts
                    type="area"
                    height="400"
                    :options="flowChartConfig"
                    :series="[{ name: 'อัตราการไหลของน้ำ', data: chartData.flow }]"
                  />
                </VCardText>
              </VCard>

              <!-- Consumption Chart -->
              <VCard
                v-if="selectedView === 'all' || selectedView === 'consumption'"
                class="mb-6"
              >
                <VCardItem class="d-flex flex-wrap justify-space-between gap-4">
                  <div class="flex-grow-1">
                    <VCardTitle class="text-h5 mb-1">
                      <VIcon
                        icon="tabler-bucket"
                        size="24"
                        class="me-2"
                        color="info"
                      />
                      ปริมาณการใช้น้ำสะสม
                    </VCardTitle>
                    <VCardSubtitle class="text-body-2">
                      24 ชั่วโมงล่าสุด
                    </VCardSubtitle>
                  </div>
                  <div class="d-flex align-center">
                    <div class="text-right">
                      <div class="text-caption text-disabled mb-1">
                        ค่าปัจจุบัน
                      </div>
                      <div class="text-h4 font-weight-bold text-primary">
                        {{ statistics.currentConsumption }} <span class="text-body-2">ลบ.ม.</span>
                      </div>
                    </div>
                  </div>
                </VCardItem>

                <VDivider />

                <VCardText>
                  <div class="mb-2">
                    <span class="d-inline-flex align-center">
                      <span
                        class="me-2"
                        style="width: 12px; height: 12px; background-color: #7367f0; border-radius: 2px;"
                      />
                      <span class="text-body-2">ปริมาณการใช้น้ำสะสม</span>
                    </span>
                  </div>
                  <VueApexCharts
                    type="area"
                    height="400"
                    :options="consumptionChartConfig"
                    :series="[{ name: 'ปริมาณการใช้น้ำสะสม', data: chartData.consumption }]"
                  />
                </VCardText>
              </VCard>

              <!-- Cost Chart -->
              <VCard
                v-if="selectedView === 'all' || selectedView === 'cost'"
              >
                <VCardItem class="d-flex flex-wrap justify-space-between gap-4">
                  <div>
                    <VCardTitle class="text-h5 mb-1">
                      <VIcon
                        icon="tabler-currency-baht"
                        size="24"
                        class="me-2"
                        color="error"
                      />
                      ต้นทุนการใช้น้ำ (บาท)
                    </VCardTitle>
                    <VCardSubtitle class="text-body-2">
                      ต้นทุนการใช้น้ำในแต่ละช่วงเวลา
                    </VCardSubtitle>
                  </div>
                </VCardItem>

                <VDivider />

                <VCardText>
                  <VueApexCharts
                    type="bar"
                    height="400"
                    :options="costChartConfig"
                    :series="[{ name: 'ต้นทุน', data: chartData.cost }]"
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
                ไม่พบข้อมูลการใช้น้ำ
              </VAlertTitle>
              <div>กรุณาเลือกช่วงเวลาอื่นหรือตรวจสอบการเชื่อมต่ออุปกรณ์</div>
            </VAlert>

            <!-- Info Alert -->
            <VAlert
              type="info"
              variant="tonal"
              class="mt-4"
            >
              <VAlertTitle>ข้อมูลจำลอง</VAlertTitle>
              <div>ข้อมูลที่แสดงเป็นข้อมูลจำลองสำหรับการทดสอบระบบ ข้อมูลจริงจะมาจากอุปกรณ์วัดน้ำที่เชื่อมต่อกับระบบ</div>
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
</style>

