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

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const vuetifyTheme = useTheme()

if (typeof window !== 'undefined') {
  window.moment = window.moment || moment
  window.$ = window.$ || $
  window.jQuery = window.jQuery || $
}

const selectedMeter = ref('all')
const timeGranularity = ref('24h')
const selectedView = ref('all') // all|flow|totalizer|pump
const loading = ref(false)
const statusMessage = ref(null)
const statusType = ref('info')
const devices = ref([])

const dateRangeInput = ref(null)
const startDate = ref(null)
const endDate = ref(null)

const chartData = ref({
  flow: [],
  totalizer: [],
  pump: [],
})

const statistics = ref({
  totalUsage: 0,
  averageFlow: 0,
  peakFlow: 0,
  pumpOnRate: 0,
})

const initDateRange = () => {
  const firstDay = moment().startOf('month')
  const lastDay = moment()
  startDate.value = firstDay.format('YYYY-MM-DD')
  endDate.value = lastDay.format('YYYY-MM-DD')
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const initializeDateRangePicker = () => {
  const init = async (retries = 0) => {
    if (retries > 20) return
    await nextTick()
    let inputElement = dateRangeInput.value || document.getElementById('dateRangeWater')
    if (!inputElement) {
      setTimeout(() => init(retries + 1), 150)
      return
    }
    try {
      const jQuery = (typeof window !== 'undefined' && window.$) || $
      const $input = jQuery(inputElement)
      if ($input.data('daterangepicker')) $input.data('daterangepicker').remove()
      $input.daterangepicker({
        locale: { format: 'DD/MM/YYYY', applyLabel: 'ตกลง', cancelLabel: 'ยกเลิก' },
        startDate: moment().startOf('month'),
        endDate: moment(),
      }, (start, end) => {
        startDate.value = start.format('YYYY-MM-DD')
        endDate.value = end.format('YYYY-MM-DD')
        loadWaterData()
      })
    } catch (error) {
      setTimeout(() => init(retries + 1), 200)
    }
  }
  setTimeout(() => init(), 300)
}

const handleDateRangeClick = (event) => {
  event.preventDefault()
  event.stopPropagation()
  if (!dateRangeInput.value) return
  const jQuery = (typeof window !== 'undefined' && window.$) || $
  const $input = jQuery(dateRangeInput.value)
  if ($input.data('daterangepicker')) $input.data('daterangepicker').show()
}

const fetchDevices = async () => {
  try {
    const response = await api.get('/water/devices')
    if (response?.data?.success) {
      devices.value = response.data.data || []
    }
  } catch (error) {
    devices.value = []
  }
}

const loadWaterData = async () => {
  loading.value = true
  statusMessage.value = 'กำลังโหลดข้อมูล...'
  statusType.value = 'info'
  try {
    const params = {
      period: timeGranularity.value,
      start: startDate.value || undefined,
      end: endDate.value || undefined,
    }
    if (selectedMeter.value !== 'all') params.device_id = selectedMeter.value

    const response = await api.get('/water/report', { params })
    const payload = response?.data?.data
    const records = payload?.records || []

    chartData.value = {
      flow: records.map(d => ({ x: new Date(d.recorded_at).getTime(), y: parseFloat(d.flowrate || 0) })),
      totalizer: records.map(d => ({ x: new Date(d.recorded_at).getTime(), y: parseFloat(d.totalizer || 0) })),
      pump: records.map(d => ({ x: new Date(d.recorded_at).getTime(), y: Number(d.waterpump) === 1 ? 1 : 0 })),
    }

    const summary = payload?.summary || {}
    statistics.value = {
      totalUsage: (summary.totalUsage || 0).toFixed(2),
      averageFlow: (summary.avgFlow || 0).toFixed(2),
      peakFlow: (summary.maxFlow || 0).toFixed(2),
      pumpOnRate: (summary.pumpOnRate || 0).toFixed(2),
    }

    statusMessage.value = `โหลดข้อมูลสำเร็จ: ${records.length} จุดข้อมูล (${formatDate(startDate.value)} - ${formatDate(endDate.value)})`
    statusType.value = records.length > 0 ? 'success' : 'warning'
  } catch (error) {
    statusMessage.value = 'เกิดข้อผิดพลาดในการโหลดข้อมูล'
    statusType.value = 'error'
  } finally {
    loading.value = false
    setTimeout(() => { statusMessage.value = null }, 3000)
  }
}

onMounted(async () => {
  moment.locale('th')
  initDateRange()
  initializeDateRangePicker()
  await fetchDevices()
  await loadWaterData()
})

onBeforeUnmount(() => {
  if (!dateRangeInput.value) return
  const jQuery = (typeof window !== 'undefined' && window.$) || $
  const $input = jQuery(dateRangeInput.value)
  if ($input.data('daterangepicker')) $input.data('daterangepicker').remove()
})

const getDateFormat = (granularity) => {
  switch (granularity) {
    case '24h':
      return 'dd MMM yyyy HH:mm'
    case '7d':
      return 'dd MMM yyyy'
    case '1m':
      return 'dd MMM yyyy'
    default:
      return 'dd MMM yyyy'
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
        formatter: (val) => `${val?.toFixed(2) || '0'} m³/h`,
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
        text: 'อัตราการไหล (m³/h)',
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

const totalizerChartConfig = computed(() => {
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
        text: 'มิเตอร์สะสม (m³)',
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
        formatter: (val) => `${val?.toFixed(2) || '0'} m³`,
      },
    },
  }
})

const pumpChartConfig = computed(() => {
  const baseConfig = getBarChartConfig(vuetifyTheme.current.value)
  return {
    ...baseConfig,
    colors: ['#28c76f'],
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
        text: 'สถานะปั๊ม',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: (val) => (val >= 1 ? 'ON' : 'OFF'),
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
        formatter: (val) => (val >= 1 ? 'ON' : 'OFF'),
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
                        {{ statistics.totalUsage }}
                      </h3>
                      <span class="text-body-2 text-disabled">m³</span>
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
                      <span class="text-body-2 text-disabled">m³/h</span>
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
                      <span class="text-body-2 text-disabled">m³/h</span>
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
                        Pump ON
                      </div>
                      <h3 class="text-h3 font-weight-bold text-error">
                        {{ statistics.pumpOnRate }}
                      </h3>
                      <span class="text-body-2 text-disabled">%</span>
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
                  ]"
                  label="ความละเอียดเวลา"
                  @update:model-value="loadWaterData"
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
                    { value: 'totalizer', title: 'มิเตอร์สะสม' },
                    { value: 'pump', title: 'สถานะปั๊ม' },
                  ]"
                  label="เลือกมุมมอง"
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
                    readonly
                    @click="handleDateRangeClick"
                  />
                  <input
                    ref="dateRangeInput"
                    id="dateRangeWater"
                    type="text"
                    class="date-range-hidden-input"
                  >
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
                      ตามช่วงเวลาที่เลือก
                    </VCardSubtitle>
                  </div>
                  <div class="d-flex align-center">
                    <div class="text-right">
                      <div class="text-caption text-disabled mb-1">
                        ค่าปัจจุบัน
                      </div>
                      <div class="text-h4 font-weight-bold text-primary">
                        {{ statistics.averageFlow }} <span class="text-body-2">m³/h</span>
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
                      <span class="text-body-2">Flowrate</span>
                    </span>
                  </div>
                  <VueApexCharts
                    type="area"
                    height="400"
                    :options="flowChartConfig"
                    :series="[{ name: 'Flowrate', data: chartData.flow }]"
                  />
                </VCardText>
              </VCard>

              <!-- Totalizer Chart -->
              <VCard
                v-if="selectedView === 'all' || selectedView === 'totalizer'"
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
                      มิเตอร์สะสม (Totalizer)
                    </VCardTitle>
                    <VCardSubtitle class="text-body-2">
                      ตามช่วงเวลาที่เลือก
                    </VCardSubtitle>
                  </div>
                  <div class="d-flex align-center">
                    <div class="text-right">
                      <div class="text-caption text-disabled mb-1">
                        ค่าปัจจุบัน
                      </div>
                      <div class="text-h4 font-weight-bold text-primary">
                        {{ statistics.totalUsage }} <span class="text-body-2">m³</span>
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
                      <span class="text-body-2">Totalizer</span>
                    </span>
                  </div>
                  <VueApexCharts
                    type="area"
                    height="400"
                    :options="totalizerChartConfig"
                    :series="[{ name: 'Totalizer', data: chartData.totalizer }]"
                  />
                </VCardText>
              </VCard>

              <!-- Pump Chart -->
              <VCard
                v-if="selectedView === 'all' || selectedView === 'pump'"
              >
                <VCardItem class="d-flex flex-wrap justify-space-between gap-4">
                  <div>
                    <VCardTitle class="text-h5 mb-1">
                      <VIcon
                        icon="tabler-activity-heartbeat"
                        size="24"
                        class="me-2"
                        color="error"
                      />
                      สถานะ Water Pump
                    </VCardTitle>
                    <VCardSubtitle class="text-body-2">
                      ON/OFF ตามเวลา
                    </VCardSubtitle>
                  </div>
                </VCardItem>

                <VDivider />

                <VCardText>
                  <VueApexCharts
                    type="bar"
                    height="400"
                    :options="pumpChartConfig"
                    :series="[{ name: 'Water Pump', data: chartData.pump }]"
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

.date-range-wrapper {
  position: relative;
}

.date-range-hidden-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>

