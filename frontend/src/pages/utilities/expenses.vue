<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { useTheme } from 'vuetify'
import { getMultiLineChartConfig, getBarChartConfig } from '@core/libs/apex-chart/apexCharConfig'
import api from '@/utils/api'

definePage({
  meta: {
    requiresAuth: true,
  },
})

const vuetifyTheme = useTheme()

const loading = ref(false)
const selectedPeriod = ref('month') // 'week', 'month', 'year'
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)
const selectedWeek = ref(null)

// Chart refs for toolbar control
const costChartRef = ref(null)
const usageChartRef = ref(null)

// Store chart instances directly
const costChartInstance = ref(null)
const usageChartInstance = ref(null)

// Zoom state for charts
const costChartZoom = ref({ min: undefined, max: undefined })
const usageChartZoom = ref({ min: undefined, max: undefined })

// Data
const expenses = ref({
  electricity: {
    current: 0,
    previous: 0,
    total: 0,
    unit: 'kWh',
    rate: 3.5, // บาทต่อหน่วย
    cost: 0,
  },
  water: {
    current: 0,
    previous: 0,
    total: 0,
    unit: 'ลบ.ม.',
    rate: 15, // บาทต่อหน่วย
    cost: 0,
  },
  history: [],
})

// Statistics
const statistics = computed(() => {
  const totalCost = expenses.value.electricity.cost + expenses.value.water.cost
  const electricityChange = expenses.value.electricity.previous > 0
    ? ((expenses.value.electricity.current - expenses.value.electricity.previous) / expenses.value.electricity.previous * 100).toFixed(1)
    : 0
  const waterChange = expenses.value.water.previous > 0
    ? ((expenses.value.water.current - expenses.value.water.previous) / expenses.value.water.previous * 100).toFixed(1)
    : 0

  return {
    totalCost,
    electricityChange: parseFloat(electricityChange),
    waterChange: parseFloat(waterChange),
  }
})

// Chart data
const chartData = ref({
  electricity: [],
  water: [],
  total: [],
})

// Month names in Thai
const monthNames = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
]

// Usage chart data - group by month for year view
const usageChartData = computed(() => {
  if (!expenses.value?.history || !Array.isArray(expenses.value.history) || expenses.value.history.length === 0) {
    return {
      electricity: [],
      water: [],
    }
  }
  
  // For year view, group by month and return datetime format
  if (selectedPeriod.value === 'year') {
    const year = selectedYear.value || new Date().getFullYear()
    const monthlyData = {}
    
    // Initialize all 12 months with zero values
    for (let month = 0; month < 12; month++) {
      const monthDate = new Date(year, month, 1) // Use 1st of month as representative date
      monthlyData[month] = {
        date: monthDate.getTime(),
        electricity: 0,
        water: 0,
      }
    }
    
    // Sum up data from expenses.history
    expenses.value.history.forEach(d => {
      if (!d || !d.date) return
      try {
        const date = new Date(d.date)
        if (isNaN(date.getTime())) return
        
        const dataYear = date.getFullYear()
        const month = date.getMonth()
        
        // Only process data from the selected year
        if (dataYear === year && month >= 0 && month < 12) {
          monthlyData[month].electricity += (parseFloat(d.electricity?.usage) || 0)
          monthlyData[month].water += (parseFloat(d.water?.usage) || 0)
        }
      } catch (e) {
        // Skip invalid dates
        console.warn('Invalid date in expenses history:', d.date)
      }
    })
    
    // Convert to array and sort by date, then return datetime format
    const monthlyArray = Object.values(monthlyData).sort((a, b) => a.date - b.date)
    
    return {
      electricity: monthlyArray.map(d => ({
        x: d.date,
        y: parseFloat((d.electricity || 0).toFixed(2)),
      })),
      water: monthlyArray.map(d => ({
        x: d.date,
        y: parseFloat((d.water || 0).toFixed(2)),
      })),
    }
  }
  
  // For week and month, use daily data with datetime format
  return {
    electricity: expenses.value.history.map(d => {
      try {
        return {
          x: new Date(d.date).getTime(),
          y: parseFloat(d.electricity?.usage || 0),
        }
      } catch (e) {
        return { x: 0, y: 0 }
      }
    }).filter(d => d.x > 0),
    water: expenses.value.history.map(d => {
      try {
        return {
          x: new Date(d.date).getTime(),
          y: parseFloat(d.water?.usage || 0),
        }
      } catch (e) {
        return { x: 0, y: 0 }
      }
    }).filter(d => d.x > 0),
  }
})

// Usage chart series data
const usageChartSeries = computed(() => {
  // Ensure usageChartData has valid structure
  if (!usageChartData.value) {
    return [
      { name: 'ค่าไฟ (kWh)', data: [] },
      { name: 'ค่าน้ำ (ลบ.ม.)', data: [] },
    ]
  }
  
  // For all views, use array of objects with x, y (for datetime type)
  const electricityData = Array.isArray(usageChartData.value.electricity) 
    ? usageChartData.value.electricity 
    : []
  const waterData = Array.isArray(usageChartData.value.water) 
    ? usageChartData.value.water 
    : []
  
  return [
    { 
      name: 'ค่าไฟ (kWh)', 
      data: electricityData
    },
    { 
      name: 'ค่าน้ำ (ลบ.ม.)', 
      data: waterData
    },
  ]
})

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(amount)
}

// Format number
const formatNumber = (num) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

// Generate mock data
const generateMockData = () => {
  const data = []
  let days = 0
  let startDate = new Date()
  
  if (selectedPeriod.value === 'week') {
    days = 7
    startDate.setDate(startDate.getDate() - 6) // Last 7 days including today
  } else if (selectedPeriod.value === 'month') {
    days = 30
    startDate.setDate(startDate.getDate() - 29) // Last 30 days
  } else if (selectedPeriod.value === 'year') {
    // For year, generate data for the selected year
    const year = selectedYear.value || new Date().getFullYear()
    startDate = new Date(year, 0, 1) // January 1st of selected year
    const endDate = new Date(year, 11, 31) // December 31st of selected year
    days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1 // Total days in year
  }
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    if (selectedPeriod.value === 'year') {
      date.setDate(date.getDate() + i)
    } else {
      date.setDate(startDate.getDate() + i)
    }
    
    // Skip if date is in the future
    if (date > new Date()) {
      continue
    }
    
    const electricityUsage = (Math.random() * 50 + 100).toFixed(2)
    const waterUsage = (Math.random() * 10 + 20).toFixed(2)
    const electricityCost = parseFloat(electricityUsage) * expenses.value.electricity.rate
    const waterCost = parseFloat(waterUsage) * expenses.value.water.rate
    
    data.push({
      date: date.toISOString().split('T')[0],
      electricity: {
        usage: parseFloat(electricityUsage),
        cost: electricityCost,
      },
      water: {
        usage: parseFloat(waterUsage),
        cost: waterCost,
      },
      total: electricityCost + waterCost,
    })
  }
  
  return data
}

// Load expenses data
const loadExpensesData = async () => {
  loading.value = true
  
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Generate mock data
    const mockData = generateMockData()
    
    // Calculate totals
    const electricityTotal = mockData.reduce((sum, d) => sum + d.electricity.usage, 0)
    const waterTotal = mockData.reduce((sum, d) => sum + d.water.usage, 0)
    const electricityCostTotal = mockData.reduce((sum, d) => sum + d.electricity.cost, 0)
    const waterCostTotal = mockData.reduce((sum, d) => sum + d.water.cost, 0)
    
    // Get current and previous period
    const currentPeriodData = mockData.slice(-7) // Last 7 days
    const previousPeriodData = mockData.slice(-14, -7) // Previous 7 days
    
    const currentElectricity = currentPeriodData.reduce((sum, d) => sum + d.electricity.usage, 0)
    const previousElectricity = previousPeriodData.reduce((sum, d) => sum + d.electricity.usage, 0)
    const currentWater = currentPeriodData.reduce((sum, d) => sum + d.water.usage, 0)
    const previousWater = previousPeriodData.reduce((sum, d) => sum + d.water.usage, 0)
    
    expenses.value = {
      electricity: {
        current: currentElectricity,
        previous: previousElectricity,
        total: electricityTotal,
        unit: 'kWh',
        rate: 3.5,
        cost: electricityCostTotal,
      },
      water: {
        current: currentWater,
        previous: previousWater,
        total: waterTotal,
        unit: 'ลบ.ม.',
        rate: 15,
        cost: waterCostTotal,
      },
      history: mockData,
    }
    
    // Prepare chart data
    chartData.value = {
      electricity: mockData.map(d => ({
        x: new Date(d.date).getTime(),
        y: d.electricity.cost,
      })),
      water: mockData.map(d => ({
        x: new Date(d.date).getTime(),
        y: d.water.cost,
      })),
      total: mockData.map(d => ({
        x: new Date(d.date).getTime(),
        y: d.total,
      })),
    }
  } catch (error) {
    console.error('Error loading expenses data:', error)
  } finally {
    loading.value = false
  }
}

// Chart configurations
const costChartConfig = computed(() => {
  const baseConfig = getMultiLineChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#7367f0', '#00d4bd', '#ff9f43'],
    chart: {
      ...baseConfig.chart,
      type: 'area',
      stacked: false,
      zoom: {
        enabled: true,
        type: 'x',
        autoScaleYaxis: true,
      },
      toolbar: {
        show: true,
        offsetX: 0,
        offsetY: 0,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
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
      width: 2.5,
    },
    markers: {
      size: 0,
      hover: {
        size: 5,
      },
    },
    grid: {
      borderColor: vuetifyTheme.current.value.dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
      padding: {
        top: 50, // Add top padding to avoid overlapping with toolbar and legend
        right: 0,
        bottom: 0,
        left: 0,
      },
    },
    tooltip: {
      ...baseConfig.tooltip,
      shared: true,
      intersect: false,
      x: {
        ...baseConfig.tooltip.x,
        format: 'dd MMM yyyy',
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => formatCurrency(val),
      },
    },
    xaxis: {
      ...baseConfig.xaxis,
      type: 'datetime',
      min: costChartZoom.value.min,
      max: costChartZoom.value.max,
      labels: {
        ...baseConfig.xaxis.labels,
        datetimeUTC: false,
        format: selectedPeriod.value === 'week' ? 'dd MMM' : selectedPeriod.value === 'month' ? 'dd MMM' : 'dd MMM yyyy',
        showDuplicates: false,
        formatter: (value) => {
          if (!value) return ''
          try {
            const date = new Date(value)
            if (selectedPeriod.value === 'year') {
              return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
            } else if (selectedPeriod.value === 'month') {
              return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })
            } else {
              return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })
            }
          } catch (e) {
            return ''
          }
        },
      },
      tickAmount: selectedPeriod.value === 'year' ? 12 : undefined,
    },
    yaxis: {
      ...baseConfig.yaxis,
      title: {
        text: 'ค่าใช้จ่าย (บาท)',
        style: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: baseConfig.yaxis.labels.style.colors,
        },
      },
      labels: {
        ...baseConfig.yaxis.labels,
        formatter: (val) => formatCurrency(val),
      },
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      offsetY: 40, // Add offset to avoid overlapping with toolbar
      offsetX: 0,
      floating: false,
      markers: {
        width: 12,
        height: 12,
        radius: 6,
      },
    },
  }
})

const usageChartConfig = computed(() => {
  const baseConfig = getBarChartConfig(vuetifyTheme.current.value)
  
  return {
    ...baseConfig,
    colors: ['#7367f0', '#00d4bd'],
    chart: {
      ...baseConfig.chart,
      zoom: {
        enabled: true,
        type: 'x',
        autoScaleYaxis: true,
      },
      toolbar: {
        show: true,
        offsetX: 0,
        offsetY: 0,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
    },
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: '60%',
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => formatNumber(val),
      offsetY: -20,
      style: {
        fontSize: '12px',
        fontWeight: 500,
        colors: [vuetifyTheme.current.value.dark ? '#fff' : '#304758'],
      },
    },
    grid: {
      borderColor: vuetifyTheme.current.value.dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
      padding: {
        top: 50, // Add top padding to avoid overlapping with toolbar and legend
        right: 0,
        bottom: 0,
        left: 0,
      },
    },
    xaxis: {
      ...baseConfig.xaxis,
      type: 'datetime',
      min: usageChartZoom.value.min,
      max: usageChartZoom.value.max,
      labels: {
        ...baseConfig.xaxis.labels,
        datetimeUTC: false,
        format: selectedPeriod.value === 'week' ? 'dd MMM' : selectedPeriod.value === 'month' ? 'dd MMM' : 'dd MMM yyyy',
        showDuplicates: false,
        formatter: (value) => {
          if (!value) return ''
          try {
            const date = new Date(value)
            if (selectedPeriod.value === 'year') {
              // For year view, show day and month
              return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
            } else if (selectedPeriod.value === 'month') {
              return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })
            } else {
              return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })
            }
          } catch (e) {
            return ''
          }
        },
      },
      tickAmount: selectedPeriod.value === 'year' ? 12 : undefined,
    },
    yaxis: [
      {
        title: {
          text: 'ค่าไฟ (kWh)',
          style: {
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: baseConfig.yaxis.labels.style.colors,
          },
        },
        labels: {
          formatter: (val) => formatNumber(val),
        },
      },
      {
        opposite: true,
        title: {
          text: 'ค่าน้ำ (ลบ.ม.)',
          style: {
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: baseConfig.yaxis.labels.style.colors,
          },
        },
        labels: {
          formatter: (val) => formatNumber(val),
        },
      },
    ],
    tooltip: {
      ...baseConfig.tooltip,
      shared: true,
      intersect: false,
      x: {
        ...baseConfig.tooltip.x,
        format: 'dd MMM yyyy',
      },
      y: {
        ...baseConfig.tooltip.y,
        formatter: (val) => formatNumber(val),
      },
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      offsetY: 40, // Add offset to avoid overlapping with toolbar
      offsetX: 0,
      floating: false,
      markers: {
        width: 12,
        height: 12,
        radius: 6,
      },
    },
  }
})

// Handle chart rendered event
const handleChartRendered = (chartRef, storedInstance) => {
  // Use setTimeout to ensure chart is fully rendered
  setTimeout(() => {
    nextTick(() => {
      if (chartRef?.value) {
        const component = chartRef.value
        
        // Try multiple ways to get chart instance
        if (component.chart) {
          storedInstance.value = component.chart
          return
        }
        
        if (component.$apexcharts) {
          storedInstance.value = component.$apexcharts
          return
        }
        
        if (typeof component.getChart === 'function') {
          try {
            const chart = component.getChart()
            if (chart) {
              storedInstance.value = chart
              return
            }
          } catch (e) {
            // Ignore errors
          }
        }
        
        // Also try to get from ApexCharts global
        if (typeof window !== 'undefined' && window.ApexCharts && component.$el) {
          try {
            const chartContainer = component.$el.querySelector('.apexcharts-inner') || 
                                  component.$el.querySelector('[id^="apexcharts"]')
            if (chartContainer) {
              const chartId = chartContainer.getAttribute('id') || 
                             chartContainer.closest('[id]')?.getAttribute('id')
              if (chartId && window.ApexCharts.exec) {
                const chart = window.ApexCharts.exec(chartId, 'getChart')
                if (chart) {
                  storedInstance.value = chart
                }
              }
            }
          } catch (e) {
            // Ignore errors
          }
        }
      }
    })
  }, 100)
}

// Toolbar functions - Get chart instance from vue3-apexcharts component
const getChartInstance = async (chartRef, storedInstance, retries = 0) => {
  // First try to use stored instance
  if (storedInstance?.value) {
    return storedInstance.value
  }
  
  await nextTick()
  
  if (!chartRef?.value) {
    // Retry if chart ref is not ready yet
    if (retries < 5) {
      await new Promise(resolve => setTimeout(resolve, 100))
      return getChartInstance(chartRef, storedInstance, retries + 1)
    }
    return null
  }
  
  const component = chartRef.value
  
  // vue3-apexcharts exposes chart instance in different ways
  // Method 1: Via chart property (most reliable for vue3-apexcharts)
  if (component.chart) {
    storedInstance.value = component.chart
    return component.chart
  }
  
  // Method 2: Direct access via $apexcharts
  if (component.$apexcharts) {
    storedInstance.value = component.$apexcharts
    return component.$apexcharts
  }
  
  // Method 3: Via getChart method if available
  if (typeof component.getChart === 'function') {
    try {
      const chart = component.getChart()
      if (chart) {
        storedInstance.value = chart
        return chart
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Method 4: Access via ApexCharts global using chart ID
  if (typeof window !== 'undefined' && window.ApexCharts) {
    try {
      // Try to find chart container in component's element
      let chartContainer = null
      if (component.$el) {
        chartContainer = component.$el.querySelector('.apexcharts-inner') || 
                        component.$el.querySelector('[id^="apexcharts"]')
      }
      
      if (chartContainer) {
        const chartId = chartContainer.getAttribute('id') || 
                       chartContainer.closest('[id]')?.getAttribute('id')
        if (chartId) {
          const chart = window.ApexCharts.exec(chartId, 'getChart')
          if (chart) {
            storedInstance.value = chart
            return chart
          }
        }
      }
      
      // Try to find chart by iterating through all ApexCharts instances
      if (window.ApexCharts.exec) {
        // Get all chart IDs from DOM
        const allChartContainers = document.querySelectorAll('[id^="apexcharts"]')
        for (const container of allChartContainers) {
          const chartId = container.getAttribute('id')
          if (chartId) {
            try {
              const chart = window.ApexCharts.exec(chartId, 'getChart')
              if (chart && component.$el && component.$el.contains(container)) {
                storedInstance.value = chart
                return chart
              }
            } catch (e) {
              // Continue to next chart
            }
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Retry if chart instance not found yet
  if (retries < 5) {
    await new Promise(resolve => setTimeout(resolve, 100))
    return getChartInstance(chartRef, storedInstance, retries + 1)
  }
  
  return null
}

const handleZoomIn = async (chartRef, zoomState, storedInstance) => {
  // Skip zoom for category type (year view)
  if (selectedPeriod.value === 'year') {
    return
  }
  
  // Wait a bit to ensure chart is ready
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 50))
  
  const chart = await getChartInstance(chartRef, storedInstance)
  if (!chart) {
    return
  }
  
  try {
    const globals = chart.w?.globals
    if (!globals) return
    
    // Get current zoom state from chart or reactive state
    let currentMin = zoomState.value.min ?? globals.minXAxis ?? globals.initialMinX
    let currentMax = zoomState.value.max ?? globals.maxXAxis ?? globals.initialMaxX
    
    // Get initial bounds
    const initialMin = globals.initialMinX ?? currentMin
    const initialMax = globals.initialMaxX ?? currentMax
    
    if (currentMin === undefined || currentMax === undefined || initialMin === undefined || initialMax === undefined) {
      return
    }
    
    const center = (currentMin + currentMax) / 2
    const currentRange = currentMax - currentMin
    const newRange = Math.max(currentRange * 0.7, (initialMax - initialMin) * 0.1)
    
    let newMin = Math.max(initialMin, center - newRange / 2)
    let newMax = Math.min(initialMax, center + newRange / 2)
    
    // Update reactive state first
    zoomState.value = { min: newMin, max: newMax }
    
    // Update chart - use zoomX if available, otherwise updateOptions
    if (typeof chart.zoomX === 'function') {
      chart.zoomX(newMin, newMax)
    } else if (typeof chart.updateOptions === 'function') {
      chart.updateOptions({
        xaxis: {
          min: newMin,
          max: newMax,
        },
      }, false, false)
    }
  } catch (error) {
    console.error('Error zooming in:', error)
  }
}

const handleZoomOut = async (chartRef, zoomState, storedInstance) => {
  // Skip zoom for category type (year view)
  if (selectedPeriod.value === 'year') {
    return
  }
  
  // Wait a bit to ensure chart is ready
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 50))
  
  const chart = await getChartInstance(chartRef, storedInstance)
  if (!chart) {
    return
  }
  
  try {
    const globals = chart.w?.globals
    if (!globals) return
    
    // Get current zoom state from chart or reactive state
    let currentMin = zoomState.value.min ?? globals.minXAxis ?? globals.initialMinX
    let currentMax = zoomState.value.max ?? globals.maxXAxis ?? globals.initialMaxX
    
    // Get initial bounds
    const initialMin = globals.initialMinX ?? currentMin
    const initialMax = globals.initialMaxX ?? currentMax
    
    if (currentMin === undefined || currentMax === undefined || initialMin === undefined || initialMax === undefined) {
      return
    }
    
    const center = (currentMin + currentMax) / 2
    const currentRange = currentMax - currentMin
    const newRange = Math.min(currentRange * 1.4, initialMax - initialMin)
    
    let newMin = Math.max(initialMin, center - newRange / 2)
    let newMax = Math.min(initialMax, center + newRange / 2)
    
    // If we've reached the initial bounds, reset zoom
    if (Math.abs(newMin - initialMin) < 0.001 && Math.abs(newMax - initialMax) < 0.001) {
      zoomState.value = { min: undefined, max: undefined }
      if (typeof chart.resetZoom === 'function') {
        chart.resetZoom()
      } else if (typeof chart.updateOptions === 'function') {
        chart.updateOptions({
          xaxis: {
            min: undefined,
            max: undefined,
          },
        }, false, false)
      }
      return
    }
    
    // Update reactive state first
    zoomState.value = { min: newMin, max: newMax }
    
    // Update chart - use zoomX if available, otherwise updateOptions
    if (typeof chart.zoomX === 'function') {
      chart.zoomX(newMin, newMax)
    } else if (typeof chart.updateOptions === 'function') {
      chart.updateOptions({
        xaxis: {
          min: newMin,
          max: newMax,
        },
      }, false, false)
    }
  } catch (error) {
    console.error('Error zooming out:', error)
  }
}

const handleResetZoom = async (chartRef, zoomState, storedInstance) => {
  // Skip zoom for category type (year view)
  if (selectedPeriod.value === 'year') {
    return
  }
  
  // Wait a bit to ensure chart is ready
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 50))
  
  const chart = await getChartInstance(chartRef, storedInstance)
  
  try {
    // Reset reactive state first
    zoomState.value = { min: undefined, max: undefined }
    
    if (chart) {
      // Use resetZoom if available, otherwise use updateOptions
      if (typeof chart.resetZoom === 'function') {
        chart.resetZoom()
      } else if (typeof chart.updateOptions === 'function') {
        chart.updateOptions({
          xaxis: {
            min: undefined,
            max: undefined,
          },
        }, false, false)
      }
    }
  } catch (error) {
    console.error('Error resetting zoom:', error)
  }
}

// Wrapper functions for cost chart
const handleCostChartZoomIn = () => {
  handleZoomIn(costChartRef, costChartZoom, costChartInstance)
}

const handleCostChartZoomOut = () => {
  handleZoomOut(costChartRef, costChartZoom, costChartInstance)
}

const handleCostChartResetZoom = () => {
  handleResetZoom(costChartRef, costChartZoom, costChartInstance)
}

const handleCostChartDownloadSVG = () => {
  handleDownloadSVG(costChartRef, 'กราฟค่าใช้จ่าย', costChartInstance)
}

const handleCostChartDownloadPNG = () => {
  handleDownloadPNG(costChartRef, 'กราฟค่าใช้จ่าย', costChartInstance)
}

// Wrapper functions for usage chart
const handleUsageChartZoomIn = () => {
  handleZoomIn(usageChartRef, usageChartZoom, usageChartInstance)
}

const handleUsageChartZoomOut = () => {
  handleZoomOut(usageChartRef, usageChartZoom, usageChartInstance)
}

const handleUsageChartResetZoom = () => {
  handleResetZoom(usageChartRef, usageChartZoom, usageChartInstance)
}

const handleUsageChartDownloadSVG = () => {
  handleDownloadSVG(usageChartRef, 'กราฟการใช้งาน', usageChartInstance)
}

const handleUsageChartDownloadPNG = () => {
  handleDownloadPNG(usageChartRef, 'กราฟการใช้งาน', usageChartInstance)
}

const handleDownloadSVG = async (chartRef, filename, storedInstance) => {
  const chart = await getChartInstance(chartRef, storedInstance)
  if (chart && typeof chart.dataURI === 'function') {
    chart.dataURI({
      type: 'svg',
    }).then((uri) => {
      const link = document.createElement('a')
      link.href = uri
      link.download = `${filename}.svg`
      link.click()
    }).catch((error) => {
      console.error('Error downloading SVG:', error)
    })
  }
}

const handleDownloadPNG = async (chartRef, filename, storedInstance) => {
  const chart = await getChartInstance(chartRef, storedInstance)
  if (chart && typeof chart.dataURI === 'function') {
    chart.dataURI({
      type: 'png',
    }).then((uri) => {
      const link = document.createElement('a')
      link.href = uri
      link.download = `${filename}.png`
      link.click()
    }).catch((error) => {
      console.error('Error downloading PNG:', error)
    })
  }
}

const handleDownloadCSV = () => {
  // Generate CSV from expenses data
  const headers = ['วันที่', 'ค่าไฟ (kWh)', 'ค่าไฟ (บาท)', 'ค่าน้ำ (ลบ.ม.)', 'ค่าน้ำ (บาท)', 'รวม (บาท)']
  const rows = expenses.value.history.map(item => [
    new Date(item.date).toLocaleDateString('th-TH'),
    item.electricity.usage,
    item.electricity.cost,
    item.water.usage,
    item.water.cost,
    item.total,
  ])
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n')
  
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `ค่าใช้จ่ายค่าไฟและค่าน้ำ_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

// Watch period changes
const handlePeriodChange = () => {
  loadExpensesData()
}

onMounted(() => {
  loadExpensesData()
})
</script>

<template>
  <div>
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">
        ค่าใช้จ่ายค่าไฟและค่าน้ำ
      </h1>
      <p class="text-body-1 text-medium-emphasis">
        ข้อมูลค่าใช้จ่ายค่าไฟและค่าน้ำของระบบ
      </p>
    </div>

    <VRow>
      <!-- Summary Cards -->
      <VCol
        cols="12"
        md="4"
      >
        <VCard
          class="expense-card expense-card-electricity"
          elevation="2"
        >
          <VCardText>
            <div class="d-flex align-center justify-space-between mb-4">
              <VAvatar
                size="56"
                color="primary"
                variant="tonal"
              >
                <VIcon
                  size="28"
                  icon="tabler-bolt"
                />
              </VAvatar>
              <VChip
                :color="statistics.electricityChange >= 0 ? 'error' : 'success'"
                size="small"
                variant="tonal"
              >
                <VIcon
                  :icon="statistics.electricityChange >= 0 ? 'tabler-trending-up' : 'tabler-trending-down'"
                  size="16"
                  class="me-1"
                />
                {{ Math.abs(statistics.electricityChange) }}%
              </VChip>
            </div>
            <div class="text-body-2 text-medium-emphasis mb-1">
              ค่าใช้จ่ายค่าไฟ
            </div>
            <div class="text-h3 font-weight-bold mb-2">
              {{ formatCurrency(expenses.electricity.cost) }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              <span class="font-weight-medium">{{ formatNumber(expenses.electricity.total) }}</span> {{ expenses.electricity.unit }}
              <span class="mx-1">•</span>
              <span>{{ formatNumber(expenses.electricity.rate) }} บาท/{{ expenses.electricity.unit }}</span>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="4"
      >
        <VCard
          class="expense-card expense-card-water"
          elevation="2"
        >
          <VCardText>
            <div class="d-flex align-center justify-space-between mb-4">
              <VAvatar
                size="56"
                color="info"
                variant="tonal"
              >
                <VIcon
                  size="28"
                  icon="tabler-droplet"
                />
              </VAvatar>
              <VChip
                :color="statistics.waterChange >= 0 ? 'error' : 'success'"
                size="small"
                variant="tonal"
              >
                <VIcon
                  :icon="statistics.waterChange >= 0 ? 'tabler-trending-up' : 'tabler-trending-down'"
                  size="16"
                  class="me-1"
                />
                {{ Math.abs(statistics.waterChange) }}%
              </VChip>
            </div>
            <div class="text-body-2 text-medium-emphasis mb-1">
              ค่าใช้จ่ายค่าน้ำ
            </div>
            <div class="text-h3 font-weight-bold mb-2">
              {{ formatCurrency(expenses.water.cost) }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              <span class="font-weight-medium">{{ formatNumber(expenses.water.total) }}</span> {{ expenses.water.unit }}
              <span class="mx-1">•</span>
              <span>{{ formatNumber(expenses.water.rate) }} บาท/{{ expenses.water.unit }}</span>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="4"
      >
        <VCard
          class="expense-card expense-card-total"
          elevation="2"
        >
          <VCardText>
            <div class="d-flex align-center justify-space-between mb-4">
              <VAvatar
                size="56"
                color="success"
                variant="tonal"
              >
                <VIcon
                  size="28"
                  icon="tabler-currency-baht"
                />
              </VAvatar>
            </div>
            <div class="text-body-2 text-medium-emphasis mb-1">
              ค่าใช้จ่ายรวม
            </div>
            <div class="text-h3 font-weight-bold mb-2">
              {{ formatCurrency(statistics.totalCost) }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              รวมค่าไฟและค่าน้ำทั้งหมด
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Filters and Controls -->
      <VCol cols="12">
        <VCard elevation="2">
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-filter"
                class="me-2"
              />
              <span>ตัวกรองข้อมูล</span>
            </div>
          </VCardTitle>
          <VDivider />
          <VCardText>
            <VRow>
              <VCol
                cols="12"
                md="3"
              >
                <VSelect
                  v-model="selectedPeriod"
                  :items="[
                    { value: 'week', title: 'รายสัปดาห์' },
                    { value: 'month', title: 'รายเดือน' },
                    { value: 'year', title: 'รายปี' },
                  ]"
                  label="ช่วงเวลา"
                  @update:model-value="handlePeriodChange"
                />
              </VCol>
              <VCol
                cols="12"
                md="3"
              >
                <VSelect
                  v-model="selectedYear"
                  :items="Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)"
                  label="ปี"
                  @update:model-value="handlePeriodChange"
                />
              </VCol>
              <VCol
                cols="12"
                md="3"
              >
                <VSelect
                  v-if="selectedPeriod === 'month'"
                  v-model="selectedMonth"
                  :items="Array.from({ length: 12 }, (_, i) => ({
                    value: i + 1,
                    title: new Date(2000, i, 1).toLocaleDateString('th-TH', { month: 'long' })
                  }))"
                  label="เดือน"
                  @update:model-value="handlePeriodChange"
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
                  prepend-icon="tabler-refresh"
                  @click="loadExpensesData"
                >
                  รีเฟรชข้อมูล
                </VBtn>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Cost Chart -->
      <VCol cols="12">
        <VCard
          elevation="2"
          :loading="loading"
        >
          <VCardTitle>
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-chart-line"
                class="me-2"
              />
              <span>กราฟค่าใช้จ่าย</span>
            </div>
          </VCardTitle>
          <VDivider />
          <VCardText>
            <VueApexCharts
              ref="costChartRef"
              type="area"
              height="400"
              :options="costChartConfig"
              :series="[
                { name: 'ค่าไฟ', data: chartData.electricity },
                { name: 'ค่าน้ำ', data: chartData.water },
                { name: 'รวม', data: chartData.total },
              ]"
              @rendered="handleChartRendered(costChartRef, costChartInstance)"
            />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Usage Chart -->
      <VCol cols="12">
        <VCard
          elevation="2"
          :loading="loading"
        >
          <VCardTitle>
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-chart-bar"
                class="me-2"
              />
              <span>กราฟการใช้งาน</span>
            </div>
          </VCardTitle>
          <VDivider />
          <VCardText>
            <VueApexCharts
              ref="usageChartRef"
              type="bar"
              height="400"
              :options="usageChartConfig"
              :series="usageChartSeries"
              @rendered="handleChartRendered(usageChartRef, usageChartInstance)"
            />
          </VCardText>
        </VCard>
      </VCol>

      <!-- Expense Table -->
      <VCol cols="12">
        <VCard elevation="2">
          <VCardTitle class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <VIcon
                icon="tabler-table"
                class="me-2"
              />
              <span>รายละเอียดค่าใช้จ่าย</span>
            </div>
            <VMenu>
              <template #activator="{ props }">
                <VBtn
                  v-bind="props"
                  variant="text"
                  size="small"
                  prepend-icon="tabler-download"
                >
                  ส่งออกข้อมูล
                </VBtn>
              </template>
              <VList>
                <VListItem
                  @click="handleDownloadCSV"
                >
                  <template #prepend>
                    <VIcon icon="tabler-file-type-csv" />
                  </template>
                  <VListItemTitle>Download CSV</VListItemTitle>
                </VListItem>
              </VList>
            </VMenu>
          </VCardTitle>
          <VDivider />
          <VCardText>
            <div class="table-responsive">
              <VTable>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th class="text-end">
                      ค่าไฟ (kWh)
                    </th>
                    <th class="text-end">
                      ค่าไฟ (บาท)
                    </th>
                    <th class="text-end">
                      ค่าน้ำ (ลบ.ม.)
                    </th>
                    <th class="text-end">
                      ค่าน้ำ (บาท)
                    </th>
                    <th class="text-end">
                      รวม (บาท)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, index) in expenses.history.slice(-10).reverse()"
                    :key="index"
                  >
                    <td>
                      {{ new Date(item.date).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      }) }}
                    </td>
                    <td class="text-end">
                      {{ formatNumber(item.electricity.usage) }}
                    </td>
                    <td class="text-end">
                      {{ formatCurrency(item.electricity.cost) }}
                    </td>
                    <td class="text-end">
                      {{ formatNumber(item.water.usage) }}
                    </td>
                    <td class="text-end">
                      {{ formatCurrency(item.water.cost) }}
                    </td>
                    <td class="text-end font-weight-bold">
                      {{ formatCurrency(item.total) }}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <th>รวม</th>
                    <th class="text-end">
                      {{ formatNumber(expenses.electricity.total) }}
                    </th>
                    <th class="text-end">
                      {{ formatCurrency(expenses.electricity.cost) }}
                    </th>
                    <th class="text-end">
                      {{ formatNumber(expenses.water.total) }}
                    </th>
                    <th class="text-end">
                      {{ formatCurrency(expenses.water.cost) }}
                    </th>
                    <th class="text-end font-weight-bold">
                      {{ formatCurrency(statistics.totalCost) }}
                    </th>
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
.expense-card {
  transition: all 0.3s ease;
  border-radius: 12px;
}

.expense-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}

.expense-card-electricity {
  border-left: 4px solid rgb(var(--v-theme-primary));
}

.expense-card-water {
  border-left: 4px solid rgb(var(--v-theme-info));
}

.expense-card-total {
  border-left: 4px solid rgb(var(--v-theme-success));
}

/* Table Styling - Same as bookings/report */
.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.table-responsive :deep(.v-table) {
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

/* Table Header */
.table-responsive :deep(.v-table thead tr) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.table-responsive :deep(.v-table thead th) {
  color: white !important;
  font-weight: 700 !important;
  font-size: 0.875rem;
  text-align: left;
  padding: 16px 12px !important;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 2px solid #e0e0e0;
  white-space: nowrap;
}

.table-responsive :deep(.v-table thead th:last-child) {
  border-right: none;
}

/* Table Body */
.table-responsive :deep(.v-table tbody tr) {
  transition: background-color 0.2s ease;
}

.table-responsive :deep(.v-table tbody tr:nth-child(odd)) {
  background-color: #ffffff;
}

.table-responsive :deep(.v-table tbody tr:nth-child(even)) {
  background-color: #f9fafb;
}

.table-responsive :deep(.v-table tbody tr:hover) {
  background-color: #f0f4ff !important;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.1);
}

.table-responsive :deep(.v-table tbody td) {
  padding: 14px 12px !important;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
  color: #374151;
  vertical-align: middle;
}

.table-responsive :deep(.v-table tbody td:last-child) {
  border-right: none;
}

.table-responsive :deep(.v-table tbody tr:last-child td) {
  border-bottom: none;
}

/* Date Column */
.table-responsive :deep(.v-table tbody td:first-child) {
  font-weight: 500;
  color: #111827;
  min-width: 150px;
}

/* Number Columns */
.table-responsive :deep(.v-table tbody td.text-end) {
  font-weight: 500;
  color: #667eea;
  text-align: right;
}

/* Table Footer */
.table-responsive :deep(.v-table tfoot tr) {
  background-color: #fff9e6 !important;
}

.table-responsive :deep(.v-table tfoot th) {
  font-weight: 700 !important;
  padding: 16px 12px !important;
  border-top: 2px solid #e0e0e0;
  border-right: 1px solid #e5e7eb;
  color: #111827 !important;
}

.table-responsive :deep(.v-table tfoot th:last-child) {
  border-right: none;
}

/* Responsive */
@media (max-width: 1200px) {
  .table-responsive :deep(.v-table thead th),
  .table-responsive :deep(.v-table tbody td),
  .table-responsive :deep(.v-table tfoot th) {
    padding: 10px 8px !important;
    font-size: 0.8125rem;
  }
}

</style>

<style lang="scss">
@use "@core/scss/template/libs/apex-chart.scss";

// Adjust toolbar and legend positions to avoid overlapping
:deep(.apexcharts-toolbar) {
  top: 0px !important;
  right: 3px !important;
  z-index: 10;
}

:deep(.apexcharts-legend) {
  &.apexcharts-align-right.apx-legend-position-top {
    top: 40px !important; // Move legend down to avoid toolbar
    right: 0px !important;
    left: auto !important;
    max-height: 30px !important; // Limit legend height
  }
}

// Ensure chart container has enough space at top
:deep(.apexcharts-canvas) {
  padding-top: 50px !important;
}

// Adjust chart area to account for toolbar and legend
:deep(.apexcharts-inner) {
  margin-top: 50px !important;
}
</style>

