<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import api from '@/utils/api'
import moment from 'moment'
import 'moment/locale/th'
import $ from 'jquery'
import 'daterangepicker'
import ApexCharts from 'apexcharts'

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

const loading = ref(false)
const reportData = ref([])
const dateRangeInput = ref(null)

// Initialize dates with current month
// Ensure moment locale is set before creating dates
if (typeof window !== 'undefined') {
  moment.locale('th')
}

// Initialize dates with today
const startDate = ref(moment().format('YYYY-MM-DD'))
const endDate = ref(moment().format('YYYY-MM-DD'))

// Chart element refs
const bookingCountChartEl = ref(null)
const totalHoursChartEl = ref(null)
const statusChartEl = ref(null)

// Chart instances
let bookingCountChart = null
let totalHoursChart = null
let statusChart = null

// Retry counter to prevent infinite loops
let chartRenderRetries = 0
const MAX_CHART_RETRIES = 10

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
    
    // Wait for Vue to update DOM before rendering charts
    await nextTick()
    
    // Update charts and table after DOM is ready
    updateChartsAndTable(transformedData)
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

const updateChartsAndTable = async (data) => {
  if (data.length === 0) {
    // Clear charts
    if (bookingCountChart) {
      bookingCountChart.destroy()
      bookingCountChart = null
    }
    if (totalHoursChart) {
      totalHoursChart.destroy()
      totalHoursChart = null
    }
    if (statusChart) {
      statusChart.destroy()
      statusChart = null
    }
    return
  }
  
  const rooms = data.map(item => item.room)
  const bookingCounts = data.map(item => Number(item.booking_count) || 0)
  const totalHoursData = data.map(item => Number(item.total_hours.toFixed(2)) || 0)
  const approvedCounts = data.map(item => Number(item.approve_count) || 0)
  const cancelledCounts = data.map(item => Number(item.cancel_count) || 0)
  const rejectedCounts = data.map(item => Number(item.reject_count) || 0)
  
  // Reset retry counter
  chartRenderRetries = 0
  
  // Wait for DOM to be ready before rendering charts
  await nextTick()
  renderCharts(rooms, bookingCounts, totalHoursData, approvedCounts, cancelledCounts, rejectedCounts)
}

const renderCharts = (rooms, bookingCounts, totalHoursData, approvedCounts, cancelledCounts, rejectedCounts) => {
  // Check if elements exist using refs
  const bookingCountEl = bookingCountChartEl.value
  const totalHoursEl = totalHoursChartEl.value
  const statusEl = statusChartEl.value
  
  // Verify elements are in DOM
  if (!bookingCountEl || !totalHoursEl || !statusEl) {
    chartRenderRetries++
    if (chartRenderRetries < MAX_CHART_RETRIES) {
      console.warn(`Chart elements not found, retrying... (${chartRenderRetries}/${MAX_CHART_RETRIES})`)
      setTimeout(() => {
        renderCharts(rooms, bookingCounts, totalHoursData, approvedCounts, cancelledCounts, rejectedCounts)
      }, 200)
    } else {
      console.error('Chart elements not found after maximum retries')
    }
    return
  }
  
  // Additional check: verify elements are actually in the DOM
  if (!document.body.contains(bookingCountEl) || 
      !document.body.contains(totalHoursEl) || 
      !document.body.contains(statusEl)) {
    chartRenderRetries++
    if (chartRenderRetries < MAX_CHART_RETRIES) {
      console.warn(`Chart elements not in DOM, retrying... (${chartRenderRetries}/${MAX_CHART_RETRIES})`)
      setTimeout(() => {
        renderCharts(rooms, bookingCounts, totalHoursData, approvedCounts, cancelledCounts, rejectedCounts)
      }, 200)
    } else {
      console.error('Chart elements not in DOM after maximum retries')
    }
    return
  }
  
  // Destroy previous charts
  if (bookingCountChart) {
    bookingCountChart.destroy()
    bookingCountChart = null
  }
  if (totalHoursChart) {
    totalHoursChart.destroy()
    totalHoursChart = null
  }
  if (statusChart) {
    statusChart.destroy()
    statusChart = null
  }
  
  // Booking Count Chart
  bookingCountChart = new ApexCharts(bookingCountEl, {
    chart: {
      type: 'bar',
      height: 350,
    },
    series: [{
      name: 'จำนวนการใช้งาน',
      data: bookingCounts,
    }],
    xaxis: {
      categories: rooms,
    },
    colors: ['#667eea'],
    title: {
      text: 'จำนวนการใช้งาน',
      align: 'center',
    },
  })
  bookingCountChart.render()
  
  // Total Hours Chart
  totalHoursChart = new ApexCharts(totalHoursEl, {
    chart: {
      type: 'bar',
      height: 350,
    },
    series: [{
      name: 'จำนวนชั่วโมงทั้งหมด',
      data: totalHoursData,
    }],
    xaxis: {
      categories: rooms,
    },
    colors: ['#764ba2'],
    title: {
      text: 'จำนวนชั่วโมงทั้งหมด',
      align: 'center',
    },
  })
  totalHoursChart.render()
  
  // Status Chart
  statusChart = new ApexCharts(statusEl, {
    chart: {
      type: 'bar',
      height: 350,
    },
    series: [
      {
        name: 'อนุมัติแล้ว',
        data: approvedCounts,
      },
      {
        name: 'ยกเลิก',
        data: cancelledCounts,
      },
      {
        name: 'ปฏิเสธ',
        data: rejectedCounts,
      },
    ],
    xaxis: {
      categories: rooms,
    },
    colors: ['#1E90FF', '#FFA500', '#FF4500'],
    title: {
      text: 'สถานะการจอง (อนุมัติแล้ว, ยกเลิก, ปฏิเสธ)',
      align: 'center',
    },
  })
  statusChart.render()
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
        startDate: moment(),
        endDate: moment(),
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


// Watch reportData changes and render charts when data is ready
watch(reportData, async (newData) => {
  if (newData && newData.length > 0 && !loading.value) {
    await nextTick()
    const rooms = newData.map(item => item.room)
    const bookingCounts = newData.map(item => Number(item.booking_count) || 0)
    const totalHoursData = newData.map(item => Number(item.total_hours.toFixed(2)) || 0)
    const approvedCounts = newData.map(item => Number(item.approve_count) || 0)
    const cancelledCounts = newData.map(item => Number(item.cancel_count) || 0)
    const rejectedCounts = newData.map(item => Number(item.reject_count) || 0)
    
    chartRenderRetries = 0
    renderCharts(rooms, bookingCounts, totalHoursData, approvedCounts, cancelledCounts, rejectedCounts)
  }
}, { deep: true })

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
  // Destroy charts
  if (bookingCountChart) {
    bookingCountChart.destroy()
    bookingCountChart = null
  }
  if (totalHoursChart) {
    totalHoursChart.destroy()
    totalHoursChart = null
  }
  if (statusChart) {
    statusChart.destroy()
    statusChart = null
  }
  
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
            <div
              v-else
              ref="bookingCountChartEl"
              id="bookingCountChart"
              style="min-height: 350px;"
            />
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
            <div
              v-else
              ref="totalHoursChartEl"
              id="totalHoursChart"
              style="min-height: 350px;"
            />
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
            <div
              v-else
              ref="statusChartEl"
              id="statusChart"
              style="min-height: 350px;"
            />
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
            <div v-else>
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
                  <tr
                    v-if="reportData.length === 0"
                  >
                    <td
                      colspan="6"
                      class="text-center text-disabled"
                    >
                      ไม่มีข้อมูล
                    </td>
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
</style>

