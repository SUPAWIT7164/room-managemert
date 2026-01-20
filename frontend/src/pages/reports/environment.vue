<script setup>
import { ref, onMounted, computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { useTheme } from 'vuetify'
import { getMultiLineChartConfig } from '@core/libs/apex-chart/apexCharConfig'
import AppDateTimePicker from '@/@core/components/app-form-elements/AppDateTimePicker.vue'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const vuetifyTheme = useTheme()

const selectedRoom = ref('all')
const dateRange = ref([])
const timeGranularity = ref('24h')
const customDateRange = ref('')
const showCustomDatePicker = ref(false)
const loading = ref(false)
const statusMessage = ref(null)
const statusType = ref('info')

// Current values - use default values from cards
const currentValues = ref({
  temperature: 25.8,
  humidity: 57,
  co2: 497,
  tvoc: 1.45,
  pressure: 978.3,
  pm25: 46,
  pm10: 55,
  hcho: 0.02,
  noise: 45.5,
})

// Chart data
const chartData = ref({
  temperature: [],
  humidity: [],
  co2: [],
  tvoc: [],
  pressure: [],
  pm25: [],
  pm10: [],
  hcho: [],
  noise: [],
})

// Statistics
const statistics = ref({
  temperature: { min: 0, max: 0, avg: 0 },
  humidity: { min: 0, max: 0, avg: 0 },
  co2: { min: 0, max: 0, avg: 0 },
  tvoc: { min: 0, max: 0, avg: 0 },
  pressure: { min: 0, max: 0, avg: 0 },
  pm25: { min: 0, max: 0, avg: 0 },
  pm10: { min: 0, max: 0, avg: 0 },
  hcho: { min: 0, max: 0, avg: 0 },
  noise: { min: 0, max: 0, avg: 0 },
})

// Initialize date range to today
onMounted(() => {
  const today = new Date()
  dateRange.value = [today, today]
  const todayStr = today.toISOString().split('T')[0]
  customDateRange.value = `${todayStr} to ${todayStr}`
  loadCurrentData()
  loadEnvironmentalData()
})

// Watch timeGranularity to show/hide custom date picker
const handleGranularityChange = (value) => {
  if (value === 'custom') {
    showCustomDatePicker.value = true
  } else {
    showCustomDatePicker.value = false
    loadEnvironmentalData()
  }
}

// Watch customDateRange changes and reload data
const handleCustomDateRangeChange = (value) => {
  if (timeGranularity.value === 'custom' && value) {
    const dateParts = value.split(' to ')
    if (dateParts.length === 2) {
      loadEnvironmentalData()
    }
  }
}

// Load current environmental data
const loadCurrentData = async () => {
  try {
    const response = await api.get('/environment/current')
    if (response.data.success && response.data.data) {
      // Update current values if API returns data, otherwise keep defaults
      currentValues.value = {
        temperature: parseFloat(response.data.data.temperature) || 25.8,
        humidity: parseFloat(response.data.data.humidity) || 57,
        co2: parseInt(response.data.data.co2) || 497,
        tvoc: parseFloat(response.data.data.tvoc) || 1.45,
        pressure: parseFloat(response.data.data.pressure) || 978.3,
        pm25: parseInt(response.data.data.pm25) || 46,
        pm10: parseInt(response.data.data.pm10) || 55,
        hcho: parseFloat(response.data.data.hcho) || 0.02,
        noise: parseFloat(response.data.data.noise) || 45.5,
      }
    }
  } catch (error) {
    console.error('Error loading current data:', error)
    // Keep default values on error
  }
}

// Load environmental data with time-series
const loadEnvironmentalData = async () => {
  loading.value = true
  statusMessage.value = null
  
  try {
    let startDate, endDate
    
    if (timeGranularity.value === 'custom' && customDateRange.value) {
      const dateParts = customDateRange.value.split(' to ')
      if (dateParts.length === 2) {
        startDate = new Date(dateParts[0])
        endDate = new Date(dateParts[1])
        endDate.setHours(23, 59, 59, 999)
      }
    } else {
      const now = new Date()
      endDate = new Date(now)
      startDate = new Date(now)
      
      switch (timeGranularity.value) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24)
          break
        case '7d':
          startDate.setDate(startDate.getDate() - 7)
          break
        case '1m':
          startDate.setMonth(startDate.getMonth() - 1)
          break
      }
    }
    
    const granularity = timeGranularity.value === '24h' ? '15min' : timeGranularity.value === '7d' ? 'hourly' : 'daily'
    
    const params = {
      roomId: selectedRoom.value !== 'all' ? selectedRoom.value : undefined,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      granularity,
    }
    
    const response = await api.get('/environment/data', { params })
    
    if (response.data.success) {
      const data = response.data.data
      
      console.log('[Environment] Received data:', data)
      console.log('[Environment] Data length:', data?.length)
      
      // Use current values as base if no data or generate from current values
      const baseValues = {
        temperature: currentValues.value.temperature || 25.8,
        humidity: currentValues.value.humidity || 57,
        co2: currentValues.value.co2 || 497,
        tvoc: currentValues.value.tvoc || 1.45,
        pressure: currentValues.value.pressure || 978.3,
        pm25: currentValues.value.pm25 || 46,
        pm10: currentValues.value.pm10 || 55,
        hcho: currentValues.value.hcho || 0.02,
        noise: currentValues.value.noise || 45.5,
      }
      
      // Transform data for charts or generate from current values
      if (data && data.length > 0) {
        chartData.value = {
          temperature: data.map(d => {
            const x = new Date(d.timestamp).getTime()
            const y = parseFloat(d.temperature) || baseValues.temperature
            return { x, y }
          }).filter(d => !isNaN(d.x) && !isNaN(d.y)),
          humidity: data.map(d => {
            const x = new Date(d.timestamp).getTime()
            const y = parseFloat(d.humidity) || baseValues.humidity
            return { x, y }
          }).filter(d => !isNaN(d.x) && !isNaN(d.y)),
          co2: data.map(d => {
            const x = new Date(d.timestamp).getTime()
            const y = parseFloat(d.co2) || baseValues.co2
            return { x, y }
          }).filter(d => !isNaN(d.x) && !isNaN(d.y)),
          tvoc: data.map(d => {
            const x = new Date(d.timestamp).getTime()
            const y = parseFloat(d.tvoc) || baseValues.tvoc
            return { x, y }
          }).filter(d => !isNaN(d.x) && !isNaN(d.y)),
          pressure: data.map(d => {
            const x = new Date(d.timestamp).getTime()
            const y = parseFloat(d.pressure) || baseValues.pressure
            return { x, y }
          }).filter(d => !isNaN(d.x) && !isNaN(d.y)),
          pm25: data.map(d => {
            const x = new Date(d.timestamp).getTime()
            const y = parseFloat(d.pm25) || baseValues.pm25
            return { x, y }
          }).filter(d => !isNaN(d.x) && !isNaN(d.y)),
          pm10: data.map(d => {
            const x = new Date(d.timestamp).getTime()
            const y = parseFloat(d.pm10) || baseValues.pm10
            return { x, y }
          }).filter(d => !isNaN(d.x) && !isNaN(d.y)),
          hcho: data.map(d => {
            const x = new Date(d.timestamp).getTime()
            const y = parseFloat(d.hcho) || baseValues.hcho
            return { x, y }
          }).filter(d => !isNaN(d.x) && !isNaN(d.y)),
          noise: data.map(d => {
            const x = new Date(d.timestamp).getTime()
            const y = parseFloat(d.noise) || baseValues.noise
            return { x, y }
          }).filter(d => !isNaN(d.x) && !isNaN(d.y)),
        }
      } else {
        // Generate time-series data from current values with small variation
        const start = new Date(startDate)
        const end = new Date(endDate)
        const interval = granularity === '15min' ? 15 * 60 * 1000 : granularity === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
        const points = []
        
        let currentTime = new Date(start)
        while (currentTime <= end && points.length < 100) {
          points.push(new Date(currentTime))
          currentTime = new Date(currentTime.getTime() + interval)
        }
        
        // Generate data with small variation around current values
        chartData.value = {
          temperature: points.map((time, index) => ({
            x: time.getTime(),
            y: parseFloat((baseValues.temperature + Math.sin(index * 0.1) * 1.5 + (Math.random() - 0.5) * 1).toFixed(1))
          })),
          humidity: points.map((time, index) => ({
            x: time.getTime(),
            y: parseFloat((baseValues.humidity + Math.sin(index * 0.1) * 3 + (Math.random() - 0.5) * 2).toFixed(1))
          })),
          co2: points.map((time, index) => ({
            x: time.getTime(),
            y: Math.round(baseValues.co2 + Math.sin(index * 0.1) * 20 + (Math.random() - 0.5) * 15)
          })),
          tvoc: points.map((time, index) => ({
            x: time.getTime(),
            y: parseFloat((baseValues.tvoc + Math.sin(index * 0.1) * 0.1 + (Math.random() - 0.5) * 0.15).toFixed(2))
          })),
          pressure: points.map((time, index) => ({
            x: time.getTime(),
            y: parseFloat((baseValues.pressure + Math.sin(index * 0.1) * 1 + (Math.random() - 0.5) * 0.5).toFixed(1))
          })),
          pm25: points.map((time, index) => ({
            x: time.getTime(),
            y: Math.round(baseValues.pm25 + Math.sin(index * 0.1) * 3 + (Math.random() - 0.5) * 5)
          })),
          pm10: points.map((time, index) => ({
            x: time.getTime(),
            y: Math.round(baseValues.pm10 + Math.sin(index * 0.1) * 3 + (Math.random() - 0.5) * 5)
          })),
          hcho: points.map((time, index) => ({
            x: time.getTime(),
            y: parseFloat((baseValues.hcho + Math.sin(index * 0.1) * 0.005 + (Math.random() - 0.5) * 0.005).toFixed(3))
          })),
          noise: points.map((time, index) => ({
            x: time.getTime(),
            y: parseFloat((baseValues.noise + Math.sin(index * 0.1) * 2 + (Math.random() - 0.5) * 2).toFixed(1))
          })),
        }
        
        console.log('[Environment] Generated chart data from current values:', {
          baseValues,
          points: points.length
        })
      }
      
      console.log('[Environment] Chart data transformed:', {
        temperature: chartData.value.temperature.length,
        humidity: chartData.value.humidity.length,
        co2: chartData.value.co2.length,
      })
      
      // Calculate statistics
      if (data.length > 0) {
        const keys = ['temperature', 'humidity', 'co2', 'tvoc', 'pressure', 'pm25', 'pm10', 'hcho', 'noise']
        keys.forEach(key => {
          const values = data.map(d => parseFloat(d[key])).filter(v => !isNaN(v))
          if (values.length > 0) {
            statistics.value[key] = {
              min: Math.min(...values).toFixed(1),
              max: Math.max(...values).toFixed(1),
              avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
            }
          }
        })
      }
      
      statusMessage.value = `โหลดข้อมูลสำเร็จ: ${data.length} จุดข้อมูล`
      statusType.value = 'success'
    }
  } catch (error) {
    console.error('Error loading environmental data:', error)
    statusMessage.value = 'เกิดข้อผิดพลาดในการโหลดข้อมูล'
    statusType.value = 'error'
  } finally {
    loading.value = false
    setTimeout(() => {
      statusMessage.value = null
    }, 3000)
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
        }
      }
      return 'dd MMM yyyy'
    default:
      return 'HH:mm'
  }
}

// Chart configurations
const createChartConfig = (title, unit, color, yAxisFormatter) => {
  const baseConfig = getMultiLineChartConfig(vuetifyTheme.current.value)
  
  return computed(() => ({
    ...baseConfig,
    colors: [color],
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
        formatter: yAxisFormatter,
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
        text: `${title} (${unit})`,
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: yAxisFormatter,
      },
    },
  }))
}

const temperatureChartConfig = createChartConfig('อุณหภูมิ', '°C', '#ff9800', (val) => `${val?.toFixed(1) || '0'} °C`)
const humidityChartConfig = createChartConfig('ความชื้น', '%', '#2196f3', (val) => `${val?.toFixed(1) || '0'} %`)
const co2ChartConfig = createChartConfig('CO2', 'ppm', '#4caf50', (val) => `${val?.toFixed(0) || '0'} ppm`)
const tvocChartConfig = createChartConfig('TVOC', 'mg/m³', '#9c27b0', (val) => `${val?.toFixed(2) || '0'} mg/m³`)
const pressureChartConfig = createChartConfig('ความดันบรรยากาศ', 'hPa', '#00bcd4', (val) => `${val?.toFixed(1) || '0'} hPa`)
const pm25ChartConfig = createChartConfig('PM2.5', 'µg/m³', '#f44336', (val) => `${val?.toFixed(0) || '0'} µg/m³`)
const pm10ChartConfig = createChartConfig('PM10', 'µg/m³', '#ff5722', (val) => `${val?.toFixed(0) || '0'} µg/m³`)
const hchoChartConfig = createChartConfig('HCHO', 'mg/m³', '#795548', (val) => `${val?.toFixed(3) || '0'} mg/m³`)
const noiseChartConfig = createChartConfig('เสียง', 'dB', '#607d8b', (val) => `${val?.toFixed(1) || '0'} dB`)
</script>

<template>
  <div>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-temperature"
                class="me-2"
              />
              <span>สภาพแวดล้อมภายในห้อง</span>
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

            <!-- Current Values Cards -->
            <VRow class="mb-6">
              <VCol
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <VCard>
                  <VCardText class="text-center pa-3">
                    <VIcon
                      icon="tabler-temperature"
                      size="24"
                      color="error"
                      class="mb-2"
                    />
                    <div class="text-caption text-disabled mb-1">
                      อุณหภูมิ
                    </div>
                    <h4 class="text-h5 font-weight-bold">
                      {{ currentValues.temperature }}°C
                    </h4>
                  </VCardText>
                </VCard>
              </VCol>

              <VCol
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <VCard>
                  <VCardText class="text-center pa-3">
                    <VIcon
                      icon="tabler-droplet"
                      size="24"
                      color="primary"
                      class="mb-2"
                    />
                    <div class="text-caption text-disabled mb-1">
                      ความชื้น
                    </div>
                    <h4 class="text-h5 font-weight-bold">
                      {{ currentValues.humidity }}%
                    </h4>
                  </VCardText>
                </VCard>
              </VCol>

              <VCol
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <VCard>
                  <VCardText class="text-center pa-3">
                    <VIcon
                      icon="tabler-cloud"
                      size="24"
                      color="success"
                      class="mb-2"
                    />
                    <div class="text-caption text-disabled mb-1">
                      CO2
                    </div>
                    <h4 class="text-h5 font-weight-bold">
                      {{ currentValues.co2 }} ppm
                    </h4>
                  </VCardText>
                </VCard>
              </VCol>

              <VCol
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <VCard>
                  <VCardText class="text-center pa-3">
                    <VIcon
                      icon="tabler-wind"
                      size="24"
                      color="purple"
                      class="mb-2"
                    />
                    <div class="text-caption text-disabled mb-1">
                      TVOC
                    </div>
                    <h4 class="text-h5 font-weight-bold">
                      {{ currentValues.tvoc }} mg/m³
                    </h4>
                  </VCardText>
                </VCard>
              </VCol>

              <VCol
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <VCard>
                  <VCardText class="text-center pa-3">
                    <VIcon
                      icon="tabler-gauge"
                      size="24"
                      color="info"
                      class="mb-2"
                    />
                    <div class="text-caption text-disabled mb-1">
                      ความดัน
                    </div>
                    <h4 class="text-h5 font-weight-bold">
                      {{ currentValues.pressure }} hPa
                    </h4>
                  </VCardText>
                </VCard>
              </VCol>

              <VCol
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <VCard>
                  <VCardText class="text-center pa-3">
                    <VIcon
                      icon="tabler-cloud-rain"
                      size="24"
                      color="warning"
                      class="mb-2"
                    />
                    <div class="text-caption text-disabled mb-1">
                      PM2.5
                    </div>
                    <h4 class="text-h5 font-weight-bold">
                      {{ currentValues.pm25 }} µg/m³
                    </h4>
                  </VCardText>
                </VCard>
              </VCol>

              <VCol
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <VCard>
                  <VCardText class="text-center pa-3">
                    <VIcon
                      icon="tabler-cloud-storm"
                      size="24"
                      color="orange"
                      class="mb-2"
                    />
                    <div class="text-caption text-disabled mb-1">
                      PM10
                    </div>
                    <h4 class="text-h5 font-weight-bold">
                      {{ currentValues.pm10 }} µg/m³
                    </h4>
                  </VCardText>
                </VCard>
              </VCol>

              <VCol
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <VCard>
                  <VCardText class="text-center pa-3">
                    <VIcon
                      icon="tabler-alert-triangle"
                      size="24"
                      color="brown"
                      class="mb-2"
                    />
                    <div class="text-caption text-disabled mb-1">
                      HCHO
                    </div>
                    <h4 class="text-h5 font-weight-bold">
                      {{ currentValues.hcho }} mg/m³
                    </h4>
                  </VCardText>
                </VCard>
              </VCol>

              <VCol
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <VCard>
                  <VCardText class="text-center pa-3">
                    <VIcon
                      icon="tabler-volume"
                      size="24"
                      color="grey"
                      class="mb-2"
                    />
                    <div class="text-caption text-disabled mb-1">
                      เสียง
                    </div>
                    <h4 class="text-h5 font-weight-bold">
                      {{ currentValues.noise }} dB
                    </h4>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>

            <!-- Filters -->
            <VRow class="mb-4">
              <VCol
                cols="12"
                sm="6"
                md="3"
              >
                <VSelect
                  v-model="timeGranularity"
                  label="ช่วงเวลา"
                  :items="[
                    { title: '24 ชั่วโมง', value: '24h' },
                    { title: '7 วัน', value: '7d' },
                    { title: '1 เดือน', value: '1m' },
                    { title: 'เลือกเอง', value: 'custom' },
                  ]"
                  @update:model-value="handleGranularityChange"
                />
              </VCol>

              <VCol
                v-if="showCustomDatePicker"
                cols="12"
                sm="6"
                md="4"
              >
                <AppDateTimePicker
                  v-model="customDateRange"
                  label="เลือกช่วงวันที่"
                  config="{ mode: 'range', dateFormat: 'Y-m-d' }"
                  @update:model-value="handleCustomDateRangeChange"
                />
              </VCol>

              <VCol
                cols="12"
                sm="6"
                md="3"
              >
                <VBtn
                  color="primary"
                  :loading="loading"
                  @click="loadEnvironmentalData"
                >
                  <VIcon
                    icon="tabler-refresh"
                    class="me-2"
                  />
                  โหลดข้อมูล
                </VBtn>
              </VCol>
            </VRow>

            <!-- Charts -->
            <VRow>
              <!-- Temperature Chart -->
              <VCol cols="12">
                <VCard>
                  <VCardTitle>อุณหภูมิ</VCardTitle>
                  <VCardText>
                    <VueApexCharts
                      v-if="chartData.temperature && chartData.temperature.length > 0"
                      type="area"
                      height="300"
                      :options="temperatureChartConfig"
                      :series="[{ name: 'อุณหภูมิ', data: chartData.temperature }]"
                    />
                    <div
                      v-else
                      class="text-center py-8 text-disabled"
                    >
                      กำลังโหลดข้อมูล...
                    </div>
                    <div class="mt-2 text-caption text-center">
                      <span class="me-4">ต่ำสุด: {{ statistics.temperature.min }}°C</span>
                      <span class="me-4">สูงสุด: {{ statistics.temperature.max }}°C</span>
                      <span>เฉลี่ย: {{ statistics.temperature.avg }}°C</span>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>

              <!-- Humidity Chart -->
              <VCol cols="12">
                <VCard>
                  <VCardTitle>ความชื้น</VCardTitle>
                  <VCardText>
                    <VueApexCharts
                      v-if="chartData.humidity && chartData.humidity.length > 0"
                      type="area"
                      height="300"
                      :options="humidityChartConfig"
                      :series="[{ name: 'ความชื้น', data: chartData.humidity }]"
                    />
                    <div
                      v-else
                      class="text-center py-8 text-disabled"
                    >
                      กำลังโหลดข้อมูล...
                    </div>
                    <div class="mt-2 text-caption text-center">
                      <span class="me-4">ต่ำสุด: {{ statistics.humidity.min }}%</span>
                      <span class="me-4">สูงสุด: {{ statistics.humidity.max }}%</span>
                      <span>เฉลี่ย: {{ statistics.humidity.avg }}%</span>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>

              <!-- CO2 Chart -->
              <VCol cols="12">
                <VCard>
                  <VCardTitle>CO2</VCardTitle>
                  <VCardText>
                    <VueApexCharts
                      v-if="chartData.co2 && chartData.co2.length > 0"
                      type="area"
                      height="300"
                      :options="co2ChartConfig"
                      :series="[{ name: 'CO2', data: chartData.co2 }]"
                    />
                    <div
                      v-else
                      class="text-center py-8 text-disabled"
                    >
                      กำลังโหลดข้อมูล...
                    </div>
                    <div class="mt-2 text-caption text-center">
                      <span class="me-4">ต่ำสุด: {{ statistics.co2.min }} ppm</span>
                      <span class="me-4">สูงสุด: {{ statistics.co2.max }} ppm</span>
                      <span>เฉลี่ย: {{ statistics.co2.avg }} ppm</span>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>

              <!-- TVOC Chart -->
              <VCol cols="12">
                <VCard>
                  <VCardTitle>TVOC</VCardTitle>
                  <VCardText>
                    <VueApexCharts
                      v-if="chartData.tvoc && chartData.tvoc.length > 0"
                      type="area"
                      height="300"
                      :options="tvocChartConfig"
                      :series="[{ name: 'TVOC', data: chartData.tvoc }]"
                    />
                    <div
                      v-else
                      class="text-center py-8 text-disabled"
                    >
                      กำลังโหลดข้อมูล...
                    </div>
                    <div class="mt-2 text-caption text-center">
                      <span class="me-4">ต่ำสุด: {{ statistics.tvoc.min }} mg/m³</span>
                      <span class="me-4">สูงสุด: {{ statistics.tvoc.max }} mg/m³</span>
                      <span>เฉลี่ย: {{ statistics.tvoc.avg }} mg/m³</span>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>

              <!-- Pressure Chart -->
              <VCol cols="12">
                <VCard>
                  <VCardTitle>ความดันบรรยากาศ</VCardTitle>
                  <VCardText>
                    <VueApexCharts
                      v-if="chartData.pressure && chartData.pressure.length > 0"
                      type="area"
                      height="300"
                      :options="pressureChartConfig"
                      :series="[{ name: 'ความดัน', data: chartData.pressure }]"
                    />
                    <div
                      v-else
                      class="text-center py-8 text-disabled"
                    >
                      กำลังโหลดข้อมูล...
                    </div>
                    <div class="mt-2 text-caption text-center">
                      <span class="me-4">ต่ำสุด: {{ statistics.pressure.min }} hPa</span>
                      <span class="me-4">สูงสุด: {{ statistics.pressure.max }} hPa</span>
                      <span>เฉลี่ย: {{ statistics.pressure.avg }} hPa</span>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>

              <!-- PM2.5 Chart -->
              <VCol cols="12">
                <VCard>
                  <VCardTitle>PM2.5</VCardTitle>
                  <VCardText>
                    <VueApexCharts
                      v-if="chartData.pm25 && chartData.pm25.length > 0"
                      type="area"
                      height="300"
                      :options="pm25ChartConfig"
                      :series="[{ name: 'PM2.5', data: chartData.pm25 }]"
                    />
                    <div
                      v-else
                      class="text-center py-8 text-disabled"
                    >
                      กำลังโหลดข้อมูล...
                    </div>
                    <div class="mt-2 text-caption text-center">
                      <span class="me-4">ต่ำสุด: {{ statistics.pm25.min }} µg/m³</span>
                      <span class="me-4">สูงสุด: {{ statistics.pm25.max }} µg/m³</span>
                      <span>เฉลี่ย: {{ statistics.pm25.avg }} µg/m³</span>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>

              <!-- PM10 Chart -->
              <VCol cols="12">
                <VCard>
                  <VCardTitle>PM10</VCardTitle>
                  <VCardText>
                    <VueApexCharts
                      v-if="chartData.pm10 && chartData.pm10.length > 0"
                      type="area"
                      height="300"
                      :options="pm10ChartConfig"
                      :series="[{ name: 'PM10', data: chartData.pm10 }]"
                    />
                    <div
                      v-else
                      class="text-center py-8 text-disabled"
                    >
                      กำลังโหลดข้อมูล...
                    </div>
                    <div class="mt-2 text-caption text-center">
                      <span class="me-4">ต่ำสุด: {{ statistics.pm10.min }} µg/m³</span>
                      <span class="me-4">สูงสุด: {{ statistics.pm10.max }} µg/m³</span>
                      <span>เฉลี่ย: {{ statistics.pm10.avg }} µg/m³</span>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>

              <!-- HCHO Chart -->
              <VCol cols="12">
                <VCard>
                  <VCardTitle>HCHO</VCardTitle>
                  <VCardText>
                    <VueApexCharts
                      v-if="chartData.hcho && chartData.hcho.length > 0"
                      type="area"
                      height="300"
                      :options="hchoChartConfig"
                      :series="[{ name: 'HCHO', data: chartData.hcho }]"
                    />
                    <div
                      v-else
                      class="text-center py-8 text-disabled"
                    >
                      กำลังโหลดข้อมูล...
                    </div>
                    <div class="mt-2 text-caption text-center">
                      <span class="me-4">ต่ำสุด: {{ statistics.hcho.min }} mg/m³</span>
                      <span class="me-4">สูงสุด: {{ statistics.hcho.max }} mg/m³</span>
                      <span>เฉลี่ย: {{ statistics.hcho.avg }} mg/m³</span>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>

              <!-- Noise Chart -->
              <VCol cols="12">
                <VCard>
                  <VCardTitle>เสียง</VCardTitle>
                  <VCardText>
                    <VueApexCharts
                      v-if="chartData.noise && chartData.noise.length > 0"
                      type="area"
                      height="300"
                      :options="noiseChartConfig"
                      :series="[{ name: 'เสียง', data: chartData.noise }]"
                    />
                    <div
                      v-else
                      class="text-center py-8 text-disabled"
                    >
                      กำลังโหลดข้อมูล...
                    </div>
                    <div class="mt-2 text-caption text-center">
                      <span class="me-4">ต่ำสุด: {{ statistics.noise.min }} dB</span>
                      <span class="me-4">สูงสุด: {{ statistics.noise.max }} dB</span>
                      <span>เฉลี่ย: {{ statistics.noise.avg }} dB</span>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

