<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import api from '@/utils/api'
import moment from 'moment'
import 'moment/locale/th'
import $ from 'jquery'
import 'daterangepicker'
import ApexCharts from 'apexcharts'

definePage({
  meta: {
    requiresAuth: true,
    admin: true,
  },
})

const loading = ref(false)
const reportData = ref([])
const dateRangeInput = ref(null)

// Initialize dates: 1st of current month to today
moment.locale('th')
const startDate = ref(moment().startOf('month').format('YYYY-MM-DD'))
const endDate = ref(moment().format('YYYY-MM-DD'))

// Chart element ref
const chartEl = ref(null)
let chart = null

// Summary statistics
const totalAccess = computed(() => {
  if (!reportData.value || reportData.value.length === 0) return 0
  return reportData.value.reduce((sum, item) => sum + (Number(item.totalAccess) || 0), 0)
})

const totalDays = computed(() => reportData.value.length)

const averagePerDay = computed(() => {
  if (totalDays.value === 0) return 0
  return Math.round(totalAccess.value / totalDays.value)
})

const maxPerDay = computed(() => {
  if (!reportData.value || reportData.value.length === 0) return 0
  const counts = reportData.value.map(item => Number(item.totalAccess) || 0)
  return Math.max(...counts)
})

const fetchReportData = async (start, end) => {
  loading.value = true
  try {
    const response = await api.post('/reports/access', {
      start_date: start,
      end_date: end,
    })

    const rawData = response.data.data || []
    
    // Group by date and sum total_access
    const groupedData = {}
    rawData.forEach(item => {
      const date = item.access_date
      if (!groupedData[date]) {
        groupedData[date] = {
          date: date,
          totalAccess: 0,
        }
      }
      groupedData[date].totalAccess += Number(item.total_access) || 0
    })
    
    // Convert to array and sort by date
    reportData.value = Object.values(groupedData).sort((a, b) => {
      return new Date(a.date) - new Date(b.date)
    })
    
    // Wait for DOM update and then update chart
    await nextTick()
    // Give a bit more time for the DOM to be fully ready
    setTimeout(() => {
      updateChart()
    }, 200)
  } catch (error) {
    console.error('Error fetching report data:', error)
    alert('ไม่สามารถโหลดข้อมูลรายงานได้: ' + (error.response?.data?.message || error.message))
  } finally {
    loading.value = false
  }
}

const updateChart = async () => {
  // Wait for DOM to be ready
  await nextTick()
  
  if (!chartEl.value) {
    console.warn('Chart element not found, retrying...')
    setTimeout(() => updateChart(), 100)
    return
  }

  // Destroy existing chart if any
  if (chart) {
    try {
      chart.destroy()
    } catch (error) {
      console.warn('Error destroying chart:', error)
    }
    chart = null
  }

  // Check if we have data
  if (!reportData.value || reportData.value.length === 0) {
    console.warn('No report data to display')
    return
  }

  // Prepare data
  const dates = reportData.value.map(item => moment(item.date).format('DD/MM/YYYY'))
  const counts = reportData.value.map(item => Number(item.totalAccess) || 0)

  // Verify element is in DOM
  if (!chartEl.value || !document.contains(chartEl.value)) {
    console.warn('Chart element not in DOM, retrying...')
    setTimeout(() => updateChart(), 100)
    return
  }

  const chartOptions = {
    chart: {
      type: 'bar',
      height: 350,
      toolbar: {
        show: true,
      },
    },
    series: [{
      name: 'จำนวนการเข้าใช้งาน',
      data: counts,
    }],
    xaxis: {
      categories: dates,
      title: {
        text: 'วันที่',
      },
    },
    yaxis: {
      title: {
        text: 'จำนวนการเข้าใช้งาน',
      },
    },
    colors: ['#667eea'],
    title: {
      text: 'จำนวนการเข้าใช้งานแต่ละวัน',
      align: 'center',
    },
    dataLabels: {
      enabled: false,
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '70%',
      },
    },
  }

  try {
    chart = new ApexCharts(chartEl.value, chartOptions)
    await chart.render()
    console.log('Chart rendered successfully')
  } catch (error) {
    console.error('Error rendering chart:', error)
  }
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
      if (typeof window !== 'undefined') {
        window.moment = window.moment || moment
      }

      if (typeof $ === 'undefined') {
        console.error('jQuery is not available')
        setTimeout(() => tryInitialize(retries + 1), 200)
        return
      }

      const inputElement = dateRangeInput.value
      const $input = $(inputElement)

      if ($input.length === 0) {
        console.error('Failed to wrap element with jQuery')
        setTimeout(() => tryInitialize(retries + 1), 200)
        return
      }

      if ($input.data('daterangepicker')) {
        console.log('Removing existing daterangepicker')
        $input.data('daterangepicker').remove()
      }

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

      const picker = $input.data('daterangepicker')
      if (picker) {
        console.log('✅ Date range picker initialized successfully')
        
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

// Watch for reportData changes to update chart
watch(
  () => reportData.value,
  () => {
    if (reportData.value && reportData.value.length > 0) {
      nextTick(() => {
        setTimeout(() => {
          updateChart()
        }, 300)
      })
    }
  },
  { deep: true }
)

// Watch for chartEl to be ready
watch(
  () => chartEl.value,
  (newVal) => {
    if (newVal && reportData.value && reportData.value.length > 0) {
      nextTick(() => {
        setTimeout(() => {
          updateChart()
        }, 300)
      })
    }
  }
)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.moment = moment
  }
  
  moment.locale('th')
  initializeDateRangePicker()
  fetchReportData(startDate.value, endDate.value)
})

onBeforeUnmount(() => {
  if (chart) {
    chart.destroy()
    chart = null
  }

  if (dateRangeInput.value) {
    const $input = $(dateRangeInput.value)
    if ($input.data('daterangepicker')) {
      $input.data('daterangepicker').remove()
    }
  }
})
</script>

<template>
  <div class="statistic-page">
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
                  icon="tabler-chart-line"
                />
              </VAvatar>
              <div>
                <h4 class="text-h4 mb-1">
                  รายงานการเข้าใช้บริการ
                </h4>
                <p class="text-body-2 mb-0">
                  สถิติการเข้าใช้บริการระบบจองห้องประชุม
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
                <label for="dateRangeStatistic">เลือกช่วงวันที่</label>
                <input
                  ref="dateRangeInput"
                  id="dateRangeStatistic"
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

    <!-- Summary Cards -->
    <VRow
      v-if="!loading && reportData.length > 0"
      class="mb-4"
    >
      <VCol cols="12">
        <VCard>
          <VCardText>
            <VRow class="text-center">
              <VCol
                cols="12"
                sm="6"
                md="3"
              >
                <h6 class="mb-2">
                  รวมการเข้าใช้งาน
                </h6>
                <h4 class="text-primary mb-0">
                  {{ totalAccess.toLocaleString() }}
                </h4>
              </VCol>
              <VCol
                cols="12"
                sm="6"
                md="3"
              >
                <h6 class="mb-2">
                  จำนวนวันที่มีข้อมูล
                </h6>
                <h4 class="text-success mb-0">
                  {{ totalDays }}
                </h4>
              </VCol>
              <VCol
                cols="12"
                sm="6"
                md="3"
              >
                <h6 class="mb-2">
                  เฉลี่ยต่อวัน
                </h6>
                <h4 class="text-info mb-0">
                  {{ averagePerDay.toLocaleString() }}
                </h4>
              </VCol>
              <VCol
                cols="12"
                sm="6"
                md="3"
              >
                <h6 class="mb-2">
                  สูงสุดในวันเดียว
                </h6>
                <h4 class="text-warning mb-0">
                  {{ maxPerDay.toLocaleString() }}
                </h4>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Chart -->
    <VRow class="mb-4">
      <VCol cols="12">
        <VCard>
          <VCardTitle>
            <VIcon
              icon="tabler-chart-bar"
              class="me-2"
            />
            จำนวนการเข้าใช้งานแต่ละวัน
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
                size="64"
              />
            </div>
            <div
              v-else-if="reportData.length === 0"
              class="d-flex justify-center align-center"
              style="height: 350px;"
            >
              <div class="text-center">
                <VIcon
                  icon="tabler-chart-line-off"
                  size="64"
                  color="disabled"
                  class="mb-4"
                />
                <p class="text-body-1 text-disabled">
                  ไม่มีข้อมูลในช่วงเวลานี้
                </p>
              </div>
            </div>
            <div
              v-else
              ref="chartEl"
              id="access-statistic-chart"
              style="min-height: 350px; width: 100%;"
            />
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style scoped>
.statistic-page {
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

/* ApexCharts styling */
#access-statistic-chart {
  position: relative;
}

:deep(#access-statistic-chart .apexcharts-canvas) {
  margin: 0 auto;
}
</style>

