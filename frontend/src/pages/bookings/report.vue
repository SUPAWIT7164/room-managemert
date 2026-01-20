<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { useTheme } from 'vuetify'
import { getMultiLineChartConfig, getBarChartConfig } from '@core/libs/apex-chart/apexCharConfig'
import api from '@/utils/api'
import moment from 'moment'
import 'moment/locale/th'
import $ from 'jquery'
import 'daterangepicker'

// Make moment available globally for daterangepicker
// This must be done before any daterangepicker initialization
if (typeof window !== 'undefined') {
  window.moment = window.moment || moment
}

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const vuetifyTheme = useTheme()

const loading = ref(false)
const reportData = ref([])
const dateRangeInput = ref(null)

// Initialize dates with current month
// Ensure moment locale is set before creating dates
if (typeof window !== 'undefined') {
  moment.locale('th')
}

// Initialize dates: 1st of current month to today
const startDate = ref(moment().startOf('month').format('YYYY-MM-DD'))
const endDate = ref(moment().format('YYYY-MM-DD'))

// Chart data
const chartData = ref({
  bookingCount: [],
  totalHours: [],
  status: {
    approved: [],
    cancelled: [],
    rejected: [],
  },
})

// Chart configurations using template style
const bookingCountChartConfig = computed(() => {
  const baseConfig = getBarChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#667eea'],
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
      type: 'category', // Use category instead of datetime for room names
      categories: reportData.value.map(item => item.room),
      // Remove datetime-related properties from baseConfig
      datetimeUTC: undefined,
      title: {
        text: 'ห้อง',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.xaxis.labels.style.colors,
        },
      },
    },
    yaxis: {
      ...baseConfig.yaxis,
      title: {
        text: 'จำนวนการใช้งาน',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: (val) => val?.toFixed(0) || '0',
      },
    },
    tooltip: {
      ...baseConfig.tooltip,
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${val?.toFixed(0) || '0'} ครั้ง`,
      },
    },
  }
})

const totalHoursChartConfig = computed(() => {
  const baseConfig = getBarChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#764ba2'],
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
      type: 'category', // Use category instead of datetime for room names
      categories: reportData.value.map(item => item.room),
      // Remove datetime-related properties from baseConfig
      datetimeUTC: undefined,
      title: {
        text: 'ห้อง',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.xaxis.labels.style.colors,
        },
      },
    },
    yaxis: {
      ...baseConfig.yaxis,
      title: {
        text: 'จำนวนชั่วโมง',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: (val) => val?.toFixed(1) || '0',
      },
    },
    tooltip: {
      ...baseConfig.tooltip,
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${val?.toFixed(2) || '0'} ชั่วโมง`,
      },
    },
  }
})

const statusChartConfig = computed(() => {
  const baseConfig = getBarChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#1E90FF', '#FFA500', '#FF4500'],
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
      type: 'category', // Use category instead of datetime for room names
      categories: reportData.value.map(item => item.room),
      // Remove datetime-related properties from baseConfig
      datetimeUTC: undefined,
      title: {
        text: 'ห้อง',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.xaxis.labels.style.colors,
        },
      },
    },
    yaxis: {
      ...baseConfig.yaxis,
      title: {
        text: 'จำนวน',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: (val) => val?.toFixed(0) || '0',
      },
    },
    tooltip: {
      ...baseConfig.tooltip,
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => `${val?.toFixed(0) || '0'}`,
      },
    },
  }
})

const fetchReportData = async (start, end) => {
  loading.value = true
  try {
    const response = await api.post('/reports/booking', {
      start_date: start,
      end_date: end,
    })
    
    // Transform data to match expected format
    const data = response.data.data || []
    const transformedData = transformReportData(data)
    
    // Set data first
    reportData.value = transformedData
    
    // Update chart data
    if (transformedData.length > 0) {
      chartData.value = {
        bookingCount: transformedData.map(item => Number(item.booking_count) || 0),
        totalHours: transformedData.map(item => Number(item.total_hours.toFixed(2)) || 0),
        status: {
          approved: transformedData.map(item => Number(item.approve_count) || 0),
          cancelled: transformedData.map(item => Number(item.cancel_count) || 0),
          rejected: transformedData.map(item => Number(item.reject_count) || 0),
        },
      }
    } else {
      chartData.value = {
        bookingCount: [],
        totalHours: [],
        status: {
          approved: [],
          cancelled: [],
          rejected: [],
        },
      }
    }
  } catch (error) {
    console.error('Error fetching report data:', error)
    alert('ไม่สามารถโหลดข้อมูลรายงานได้: ' + (error.response?.data?.message || error.message))
  } finally {
    loading.value = false
  }
}

const transformReportData = (data) => {
  // Group by room
  const roomMap = {}
  
  data.forEach(item => {
    const roomName = item.room_name || item.room || 'ไม่ระบุ'
    
    if (!roomMap[roomName]) {
      roomMap[roomName] = {
        room: roomName,
        booking_count: 0,
        total_hours: 0,
        approve_count: 0,
        cancel_count: 0,
        reject_count: 0,
      }
    }
    
    roomMap[roomName].booking_count++
    
    // Calculate hours
    if (item.start_datetime && item.end_datetime) {
      const start = moment(item.start_datetime)
      const end = moment(item.end_datetime)
      const hours = end.diff(start, 'hours', true)
      roomMap[roomName].total_hours += hours
    }
    
    // Count by status
    if (item.status === 'approved') {
      roomMap[roomName].approve_count++
    } else if (item.status === 'cancelled') {
      roomMap[roomName].cancel_count++
    } else if (item.status === 'rejected') {
      roomMap[roomName].reject_count++
    }
  })
  
  return Object.values(roomMap)
}

// Initialize date range picker
const initializeDateRangePicker = () => {
  const tryInitialize = async (retries = 0) => {
    if (retries > 10) {
      console.error('Failed to initialize date range picker after maximum retries')
      return
    }
    
    await nextTick()
    
    if (!dateRangeInput.value) {
      console.warn(`Date range input not found, retrying... (${retries}/10)`)
      setTimeout(() => tryInitialize(retries + 1), 100)
      return
    }
    
    try {
      // Ensure moment is available globally
      if (typeof window !== 'undefined') {
        window.moment = window.moment || moment
      }
      
      // Ensure jQuery is available
      if (typeof $ === 'undefined') {
        console.error('jQuery is not available')
        setTimeout(() => tryInitialize(retries + 1), 200)
        return
      }
      
      const inputElement = dateRangeInput.value
      const $input = $(inputElement)
      
      // Check if jQuery wrapped the element properly
      if ($input.length === 0) {
        console.error('Failed to wrap element with jQuery')
        setTimeout(() => tryInitialize(retries + 1), 200)
        return
      }
      
      // Remove existing daterangepicker if any
      if ($input.data('daterangepicker')) {
        console.log('Removing existing daterangepicker')
        $input.data('daterangepicker').remove()
      }
      
      // Initialize daterangepicker (same style as room-management-portal)
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
        startDate: moment().startOf('month'), // วันที่ 1 ของเดือน
        endDate: moment(), // วันนี้
      }, (start, end) => {
        console.log('Date range selected:', start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'))
        startDate.value = start.format('YYYY-MM-DD')
        endDate.value = end.format('YYYY-MM-DD')
        fetchReportData(startDate.value, endDate.value)
      })
      
      // Verify daterangepicker was initialized
      const picker = $input.data('daterangepicker')
      if (picker) {
        console.log('✅ Date range picker initialized successfully')
        console.log('Picker instance:', picker)
        
        // Add manual click handler to ensure it opens
        inputElement.addEventListener('click', () => {
          console.log('Input clicked, showing picker')
          if ($input.data('daterangepicker')) {
            $input.data('daterangepicker').show()
          }
        })
      } else {
        console.error('❌ Daterangepicker was not initialized properly')
        setTimeout(() => tryInitialize(retries + 1), 200)
      }
    } catch (error) {
      console.error('Error initializing date range picker:', error)
      setTimeout(() => tryInitialize(retries + 1), 200)
    }
  }
  
  tryInitialize()
}

const calculateTotals = () => {
  if (!reportData.value || reportData.value.length === 0) {
    return {
      booking_count: 0,
      total_hours: 0,
      approve_count: 0,
      cancel_count: 0,
      reject_count: 0,
    }
  }
  
  return reportData.value.reduce((acc, item) => {
    acc.booking_count += Number(item.booking_count) || 0
    acc.total_hours += Number(item.total_hours) || 0
    acc.approve_count += Number(item.approve_count) || 0
    acc.cancel_count += Number(item.cancel_count) || 0
    acc.reject_count += Number(item.reject_count) || 0
    return acc
  }, {
    booking_count: 0,
    total_hours: 0,
    approve_count: 0,
    cancel_count: 0,
    reject_count: 0,
  })
}

const totals = computed(() => calculateTotals())


// Chart series computed
const bookingCountSeries = computed(() => [{
  name: 'จำนวนการใช้งาน',
  data: chartData.value.bookingCount,
}])

const totalHoursSeries = computed(() => [{
  name: 'จำนวนชั่วโมงทั้งหมด',
  data: chartData.value.totalHours,
}])

const statusSeries = computed(() => [
  {
    name: 'อนุมัติแล้ว',
    data: chartData.value.status.approved,
  },
  {
    name: 'ยกเลิก',
    data: chartData.value.status.cancelled,
  },
  {
    name: 'ปฏิเสธ',
    data: chartData.value.status.rejected,
  },
])

onMounted(() => {
  // Ensure moment is available globally before using daterangepicker
  if (typeof window !== 'undefined') {
    window.moment = moment
  }
  
  moment.locale('th')
  initializeDateRangePicker()
  fetchReportData(startDate.value, endDate.value)
})

onBeforeUnmount(() => {
  // Destroy daterangepicker
  if (dateRangeInput.value) {
    const $input = $(dateRangeInput.value)
    if ($input.data('daterangepicker')) {
      $input.data('daterangepicker').remove()
    }
  }
})
</script>

<template>
  <div class="booking-report-page">
    <!-- Page Header -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-4">
              <VAvatar
                size="64"
                color="primary"
                variant="flat"
              >
                <VIcon
                  size="32"
                  icon="tabler-chart-bar"
                />
              </VAvatar>
              <div>
                <h4 class="text-h4 mb-1">
                  รายงานการใช้งานห้อง
                </h4>
                <p class="text-body-2 mb-0">
                  สรุปการใช้งานห้องประชุมตามช่วงวันที่
                </p>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Date Range Picker -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardText>
            <VRow>
              <VCol
                cols="12"
                md="6"
                lg="4"
              >
                <label for="dateRangeCalendar">เลือกช่วงวันที่</label>
                <input
                  ref="dateRangeInput"
                  id="dateRangeCalendar"
                  type="text"
                  class="form-control"
                  style="cursor: pointer;"
                />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Charts -->
    <VRow class="mb-4">
      <!-- Booking Count Chart -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-chart-bar"
              class="me-2"
            />
            จำนวนการใช้งาน
          </VCardTitle>
          <VCardText>
            <div
              v-if="loading"
              class="d-flex justify-center align-center"
              style="height: 350px;"
            >
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VueApexCharts
              v-else-if="chartData.bookingCount && chartData.bookingCount.length > 0"
              type="bar"
              height="350"
              :options="bookingCountChartConfig"
              :series="bookingCountSeries"
            />
            <div
              v-else
              class="text-center py-8 text-disabled"
            >
              ไม่มีข้อมูล
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Total Hours Chart -->
      <VCol
        cols="12"
        md="6"
      >
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-clock"
              class="me-2"
            />
            จำนวนชั่วโมงทั้งหมด
          </VCardTitle>
          <VCardText>
            <div
              v-if="loading"
              class="d-flex justify-center align-center"
              style="height: 350px;"
            >
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VueApexCharts
              v-else-if="chartData.totalHours && chartData.totalHours.length > 0"
              type="bar"
              height="350"
              :options="totalHoursChartConfig"
              :series="totalHoursSeries"
            />
            <div
              v-else
              class="text-center py-8 text-disabled"
            >
              ไม่มีข้อมูล
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Status Chart -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-chart-pie"
              class="me-2"
            />
            สถานะการจอง (อนุมัติแล้ว, ยกเลิก, ปฏิเสธ)
          </VCardTitle>
          <VCardText>
            <div
              v-if="loading"
              class="d-flex justify-center align-center"
              style="height: 350px;"
            >
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <VueApexCharts
              v-else-if="chartData.status.approved && chartData.status.approved.length > 0"
              type="bar"
              height="350"
              :options="statusChartConfig"
              :series="statusSeries"
            />
            <div
              v-else
              class="text-center py-8 text-disabled"
            >
              ไม่มีข้อมูล
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Data Table -->
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-table"
              class="me-2"
            />
            สรุปข้อมูลการใช้งานห้อง
          </VCardTitle>
          <VCardText>
            <div
              v-if="loading"
              class="d-flex justify-center align-center py-12"
            >
              <VProgressCircular
                indeterminate
                color="primary"
                size="64"
              />
            </div>
            <div
              v-else-if="reportData.length > 0"
              class="table-responsive"
            >
              <VTable>
                <thead>
                  <tr>
                    <th>ห้อง</th>
                    <th class="text-end">จำนวนการใช้งาน</th>
                    <th class="text-end">จำนวนชั่วโมงทั้งหมด</th>
                    <th class="text-end">อนุมัติแล้ว</th>
                    <th class="text-end">ยกเลิก</th>
                    <th class="text-end">ปฏิเสธ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in reportData"
                    :key="item.room"
                  >
                    <td>{{ item.room }}</td>
                    <td class="text-end">{{ item.booking_count }}</td>
                    <td class="text-end">{{ item.total_hours.toFixed(2) }}</td>
                    <td class="text-end">{{ item.approve_count }}</td>
                    <td class="text-end">{{ item.cancel_count }}</td>
                    <td class="text-end">{{ item.reject_count }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="font-weight-bold bg-yellow-lighten-5">
                    <th>รวมทั้งหมด</th>
                    <th class="text-end">{{ totals.booking_count }}</th>
                    <th class="text-end">{{ totals.total_hours.toFixed(2) }}</th>
                    <th class="text-end">{{ totals.approve_count }}</th>
                    <th class="text-end">{{ totals.cancel_count }}</th>
                    <th class="text-end">{{ totals.reject_count }}</th>
                  </tr>
                </tfoot>
              </VTable>
            </div>
            <div
              v-else
              class="text-center py-8"
            >
              <VIcon
                size="64"
                icon="tabler-table-off"
                class="text-disabled mb-4"
              />
              <div class="text-h6 mb-2">
                ไม่มีข้อมูล
              </div>
              <div class="text-body-2 text-disabled">
                ไม่พบข้อมูลการใช้งานห้องในช่วงเวลานี้
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style scoped>
.booking-report-page {
  padding: 0;
}

.form-control {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
  color: #212529;
  background-color: #fff;
  background-clip: padding-box;
  border: 1px solid #ced4da;
  appearance: none;
  border-radius: 0.375rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus {
  color: #212529;
  background-color: #fff;
  border-color: #86b7fe;
  outline: 0;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

/* Ensure daterangepicker is visible */
:deep(.daterangepicker) {
  z-index: 9999 !important;
  display: block !important;
}

/* Table Styling - Same as bookings/list */
.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.v-table {
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

/* Table Header */
.v-table thead tr {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.v-table thead th {
  color: white !important;
  font-weight: 700 !important;
  font-size: 0.875rem;
  text-align: left;
  padding: 16px 12px !important;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 2px solid #e0e0e0;
  white-space: nowrap;
}

.v-table thead th:last-child {
  border-right: none;
}

/* Table Body */
.v-table tbody tr {
  transition: background-color 0.2s ease;
}

.v-table tbody tr:nth-child(odd) {
  background-color: #ffffff;
}

.v-table tbody tr:nth-child(even) {
  background-color: #f9fafb;
}

.v-table tbody tr:hover {
  background-color: #f0f4ff !important;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.1);
}

.v-table tbody td {
  padding: 14px 12px !important;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
  color: #374151;
  vertical-align: middle;
}

.v-table tbody td:last-child {
  border-right: none;
}

.v-table tbody tr:last-child td {
  border-bottom: none;
}

/* Room Column */
.v-table tbody td:first-child {
  font-weight: 500;
  color: #111827;
  min-width: 150px;
}

/* Number Columns */
.v-table tbody td.text-end {
  font-weight: 500;
  color: #667eea;
  text-align: right;
}

/* Table Footer */
.v-table tfoot tr {
  background-color: #fff9e6 !important;
}

.v-table tfoot th {
  font-weight: 700 !important;
  padding: 16px 12px !important;
  border-top: 2px solid #e0e0e0;
  border-right: 1px solid #e5e7eb;
  color: #111827 !important;
}

.v-table tfoot th:last-child {
  border-right: none;
}

/* Responsive */
@media (max-width: 1200px) {
  .v-table thead th,
  .v-table tbody td,
  .v-table tfoot th {
    padding: 10px 8px !important;
    font-size: 0.8125rem;
  }
}

/* Loading State */
.text-center.py-8 {
  padding: 3rem 1rem;
}

/* Empty State Icon */
.v-icon[size="64"] {
  opacity: 0.3;
}
</style>

