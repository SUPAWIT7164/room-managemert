<script setup>
import { ref, onMounted, computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { useTheme } from 'vuetify'
import { getMultiLineChartConfig, getBarChartConfig } from '@core/libs/apex-chart/apexCharConfig'

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const vuetifyTheme = useTheme()

const selectedMeter = ref('all')
const dateRange = ref([])
const timeGranularity = ref('hourly')
const loading = ref(false)
const statusMessage = ref(null)
const statusType = ref('info')
const devices = ref([
  { id: 1, name: 'Power Meter - อาคาร 1' },
  { id: 2, name: 'Power Meter - อาคาร 2' },
  { id: 3, name: 'Power Meter - อาคาร 3' },
])

const chartData = ref({
  power: [],
  current: [],
  voltage: [],
  energy: [],
})

// Initialize date range to today
onMounted(() => {
  const today = new Date()
  dateRange.value = [today, today]
  loadEnergyData()
})

// Generate mock data with aggregation based on granularity
const generateMockData = (granularity) => {
  const data = []
  const now = new Date()
  
  let dataPoints = 0
  let timeInterval = 0
  let timeLabel = ''
  
  switch (granularity) {
    case 'hourly':
      // รายชั่วโมง: แสดง 24 ชั่วโมงล่าสุด
      dataPoints = 24
      timeInterval = 60 * 60 * 1000 // 1 ชั่วโมง
      timeLabel = 'hour'
      break
    case 'daily':
      // รายวัน: แสดง 7 วันล่าสุด (ค่าเฉลี่ยต่อวัน)
      dataPoints = 7
      timeInterval = 24 * 60 * 60 * 1000 // 1 วัน
      timeLabel = 'day'
      break
    case 'weekly':
      // รายสัปดาห์: แสดง 4 สัปดาห์ล่าสุด (ค่าเฉลี่ยต่อสัปดาห์)
      dataPoints = 4
      timeInterval = 7 * 24 * 60 * 60 * 1000 // 1 สัปดาห์
      timeLabel = 'week'
      break
    case 'monthly':
      // รายเดือน: แสดง 12 เดือนล่าสุด (ค่าเฉลี่ยต่อเดือน)
      dataPoints = 12
      timeInterval = 30 * 24 * 60 * 60 * 1000 // ประมาณ 1 เดือน
      timeLabel = 'month'
      break
    default:
      dataPoints = 24
      timeInterval = 60 * 60 * 1000
  }
  
  // สร้างข้อมูลตามจำนวนจุดที่กำหนด (ไม่เกิน 12-24 จุด)
  for (let i = dataPoints; i >= 0; i--) {
    const time = new Date(now.getTime() - i * timeInterval)
    
    // สำหรับรายวัน/สัปดาห์/เดือน ใช้ค่าเฉลี่ยที่สูงกว่าเล็กน้อย
    const baseMultiplier = granularity === 'hourly' ? 1 : (granularity === 'daily' ? 1.2 : (granularity === 'weekly' ? 1.5 : 2))
    
    data.push({
      time: time.toISOString(),
      AVG_ELECP1: (Math.random() * 5 + 10 * baseMultiplier).toFixed(2),
      AVG_ELECP2: (Math.random() * 5 + 10 * baseMultiplier).toFixed(2),
      AVG_ELECP3: (Math.random() * 5 + 10 * baseMultiplier).toFixed(2),
      AVG_ELECI1: (Math.random() * 10 + 20 * baseMultiplier).toFixed(2),
      AVG_ELECI2: (Math.random() * 10 + 20 * baseMultiplier).toFixed(2),
      AVG_ELECI3: (Math.random() * 10 + 20 * baseMultiplier).toFixed(2),
      AVG_ELECV1: (Math.random() * 5 + 220).toFixed(2),
      AVG_ELECV2: (Math.random() * 5 + 220).toFixed(2),
      AVG_ELECV3: (Math.random() * 5 + 220).toFixed(2),
      DIFF_ELECU: (Math.random() * 3 + 2 * baseMultiplier).toFixed(2),
    })
  }
  
  return data
}

const loadEnergyData = async () => {
  loading.value = true
  statusMessage.value = 'กำลังโหลดข้อมูล...'
  statusType.value = 'info'
  
  try {
    // ลดเวลา delay ตามจำนวนข้อมูล (ข้อมูลน้อย = เร็วขึ้น)
    const delayTime = timeGranularity.value === 'hourly' ? 300 : 
                      timeGranularity.value === 'daily' ? 200 : 
                      timeGranularity.value === 'weekly' ? 150 : 100
    
    // Simulate API call (ลดเวลา delay)
    await new Promise(resolve => setTimeout(resolve, delayTime))
    
    // Generate mock data based on granularity (จะได้ข้อมูลไม่เกิน 12-24 จุด)
    const mockData = generateMockData(timeGranularity.value)
    
    // Prepare chart data (ใช้ requestAnimationFrame เพื่อไม่ block UI)
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        chartData.value = {
          power: {
            phase1: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.AVG_ELECP1) })),
            phase2: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.AVG_ELECP2) })),
            phase3: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.AVG_ELECP3) })),
          },
          current: {
            phase1: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.AVG_ELECI1) })),
            phase2: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.AVG_ELECI2) })),
            phase3: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.AVG_ELECI3) })),
          },
          voltage: {
            phase1: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.AVG_ELECV1) })),
            phase2: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.AVG_ELECV2) })),
            phase3: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.AVG_ELECV3) })),
          },
          energy: mockData.map(d => ({ x: new Date(d.time).getTime(), y: parseFloat(d.DIFF_ELECU) })),
        }
        resolve()
      })
    })
    
    const granularityLabels = {
      hourly: 'รายชั่วโมง',
      daily: 'รายวัน',
      weekly: 'รายสัปดาห์',
      monthly: 'รายเดือน',
    }
    
    statusMessage.value = `โหลดข้อมูลสำเร็จ: ${mockData.length} จุดข้อมูล (${granularityLabels[timeGranularity.value]})`
    statusType.value = 'success'
    
    setTimeout(() => {
      statusMessage.value = null
    }, 3000)
  } catch (error) {
    console.error('Error loading energy data:', error)
    statusMessage.value = 'เกิดข้อผิดพลาดในการโหลดข้อมูล'
    statusType.value = 'error'
  } finally {
    loading.value = false
  }
}

// Helper function to get date format based on granularity
const getDateFormat = (granularity) => {
  switch (granularity) {
    case 'hourly':
      return 'dd MMM yyyy HH:mm'
    case 'daily':
      return 'dd MMM yyyy'
    case 'weekly':
      return 'dd MMM yyyy'
    case 'monthly':
      return 'MMM yyyy'
    default:
      return 'dd MMM yyyy HH:mm'
  }
}

const getXAxisFormat = (granularity) => {
  switch (granularity) {
    case 'hourly':
      return 'HH:mm'
    case 'daily':
      return 'dd MMM'
    case 'weekly':
      return 'dd MMM'
    case 'monthly':
      return 'MMM yyyy'
    default:
      return 'HH:mm'
  }
}

// Chart options using Vuexy theme
const powerChartConfig = computed(() => {
  const baseConfig = getMultiLineChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#ab7efd', '#00d4bd', '#ff9f43'],
    tooltip: {
      ...baseConfig.tooltip,
      x: {
        ...baseConfig.tooltip.x,
        format: getDateFormat(timeGranularity.value),
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${val?.toFixed(2) || '0'} kW`,
      },
    },
    xaxis: {
      ...baseConfig.xaxis,
      labels: {
        ...baseConfig.xaxis.labels,
        format: getXAxisFormat(timeGranularity.value),
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
    tooltip: {
      ...baseConfig.tooltip,
      x: {
        ...baseConfig.tooltip.x,
        format: getDateFormat(timeGranularity.value),
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${val?.toFixed(2) || '0'} A`,
      },
    },
    xaxis: {
      ...baseConfig.xaxis,
      labels: {
        ...baseConfig.xaxis.labels,
        format: getXAxisFormat(timeGranularity.value),
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
    tooltip: {
      ...baseConfig.tooltip,
      x: {
        ...baseConfig.tooltip.x,
        format: getDateFormat(timeGranularity.value),
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${val?.toFixed(2) || '0'} V`,
      },
    },
    xaxis: {
      ...baseConfig.xaxis,
      labels: {
        ...baseConfig.xaxis.labels,
        format: getXAxisFormat(timeGranularity.value),
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
        format: getXAxisFormat(timeGranularity.value),
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
        format: getDateFormat(timeGranularity.value),
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
                md="4"
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
                md="4"
              >
                <VSelect
                  v-model="timeGranularity"
                  :items="[
                    { value: 'hourly', title: 'รายชั่วโมง' },
                    { value: 'daily', title: 'รายวัน' },
                    { value: 'weekly', title: 'รายสัปดาห์' },
                    { value: 'monthly', title: 'รายเดือน' },
                  ]"
                  label="ความละเอียดเวลา"
                  @update:model-value="loadEnergyData"
                />
              </VCol>

              <VCol
                cols="12"
                md="4"
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
              <!-- Power Chart -->
              <VCard class="mb-6">
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
                    type="line"
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

              <!-- Current Chart -->
              <VCard class="mb-6">
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
                    type="line"
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

              <!-- Voltage Chart -->
              <VCard class="mb-6">
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
                    type="line"
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

              <!-- Energy Chart (Bar) -->
              <VCard>
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

            <!-- Info Alert -->
            <VAlert
              type="info"
              variant="tonal"
              class="mt-4"
            >
              <VAlertTitle>ข้อมูลจำลอง</VAlertTitle>
              <div>ข้อมูลที่แสดงเป็นข้อมูลจำลองสำหรับการทดสอบระบบ ข้อมูลจริงจะมาจากอุปกรณ์วัดพลังงานที่เชื่อมต่อกับระบบ</div>
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

