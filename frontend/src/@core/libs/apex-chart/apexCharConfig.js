import { hexToRgb } from '@core/utils/colorConverter'

// 👉 Colors variables
const colorVariables = themeColors => {
  const themeSecondaryTextColor = `rgba(${hexToRgb(themeColors.colors['on-surface'])},${themeColors.variables['medium-emphasis-opacity']})`
  const themeDisabledTextColor = `rgba(${hexToRgb(themeColors.colors['on-surface'])},${themeColors.variables['disabled-opacity']})`
  const themeBorderColor = `rgba(${hexToRgb(String(themeColors.variables['border-color']))},${themeColors.variables['border-opacity']})`
  const themePrimaryTextColor = `rgba(${hexToRgb(themeColors.colors['on-surface'])},${themeColors.variables['high-emphasis-opacity']})`
  
  return { themeSecondaryTextColor, themeDisabledTextColor, themeBorderColor, themePrimaryTextColor }
}

export const getLineChartSimpleConfig = themeColors => {
  const { themeBorderColor, themeDisabledTextColor } = colorVariables(themeColors)
  
  return {
    chart: {
      parentHeightOffset: 0,
      zoom: { enabled: false },
      toolbar: { show: false },
    },
    colors: ['#ff9f43'],
    stroke: { curve: 'straight' },
    dataLabels: { enabled: false },
    markers: {
      strokeWidth: 7,
      strokeOpacity: 1,
      colors: ['#ff9f43'],  
      strokeColors: ['#fff'],
    },
    grid: {
      padding: { top: -10 },
      borderColor: themeBorderColor,
      xaxis: {
        lines: { show: true },
      },
    },
    tooltip: {
      custom(data) {
        return `<div class='bar-chart pa-2'>
          <span>${data.series[data.seriesIndex][data.dataPointIndex]}%</span>
        </div>`
      },
    },
    yaxis: {
      labels: {
        style: { colors: themeDisabledTextColor, fontSize: '0.8125rem' },
      },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { color: themeBorderColor },
      crosshairs: {
        stroke: { color: themeBorderColor },
      },
      labels: {
        style: { colors: themeDisabledTextColor, fontSize: '0.8125rem' },
      },
    },
  }
}

export const getBarChartConfig = themeColors => {
  const { themeSecondaryTextColor, themeBorderColor, themeDisabledTextColor } = colorVariables(themeColors)
  
  return {
    chart: {
      parentHeightOffset: 0,
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
      zoom: {
        enabled: true,
        type: 'x',
        autoScaleYaxis: true,
      },
    },
    colors: ['#826af9'],
    dataLabels: { 
      enabled: false,
    },
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: '50%',
        horizontal: false,
        distributed: false,
        dataLabels: {
          position: 'top',
        },
      },
    },
    legend: {
      show: false,
    },
    tooltip: {
      theme: themeColors.dark ? 'dark' : 'light',
      style: {
        fontSize: '0.8125rem',
        fontFamily: 'inherit',
      },
      x: {
        show: true,
      },
      y: {
        formatter: (val) => val?.toFixed(2) || '0',
      },
      marker: {
        show: true,
      },
    },
    grid: {
      show: true,
      borderColor: themeBorderColor,
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
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    },
    yaxis: {
      labels: {
        style: { 
          colors: themeDisabledTextColor, 
          fontSize: '0.8125rem',
          fontFamily: 'inherit',
        },
      },
    },
    xaxis: {
      type: 'datetime',
      axisBorder: { 
        show: false,
      },
      axisTicks: { 
        show: true,
        color: themeBorderColor,
        height: 6,
      },
      crosshairs: {
        show: true,
        stroke: { 
          color: themeBorderColor,
          width: 1,
          dashArray: 4,
        },
      },
      labels: {
        style: { 
          colors: themeDisabledTextColor, 
          fontSize: '0.8125rem',
          fontFamily: 'inherit',
        },
        datetimeUTC: false,
      },
    },
  }
}

export const getAreaChartSplineConfig = themeColors => {
  const areaColors = {
    series3: '#e0cffe',
    series2: '#b992fe',
    series1: '#ab7efd',
  }

  const { themeSecondaryTextColor, themeBorderColor, themeDisabledTextColor } = colorVariables(themeColors)
  
  return {
    chart: {
      parentHeightOffset: 0,
      toolbar: { show: false },
    },
    tooltip: { shared: false },
    dataLabels: { enabled: false },
    stroke: {
      show: false,
      curve: 'straight',
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left',
      fontSize: '13px',
      labels: { colors: themeSecondaryTextColor },
      markers: {
        offsetY: 1,
        offsetX: -3,
      },
      itemMargin: {
        vertical: 3,
        horizontal: 10,
      },
    },
    colors: [areaColors.series3, areaColors.series2, areaColors.series1],
    fill: {
      opacity: 1,
      type: 'solid',
    },
    grid: {
      show: true,
      borderColor: themeBorderColor,
      xaxis: {
        lines: { show: true },
      },
    },
    yaxis: {
      labels: {
        style: { colors: themeDisabledTextColor, fontSize: '0.8125rem' },
      },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { color: themeBorderColor },
      crosshairs: {
        stroke: { color: themeBorderColor },
      },
      labels: {
        style: { colors: themeDisabledTextColor, fontSize: '0.8125rem' },
      },
    },
  }
}

export const getMultiLineChartConfig = themeColors => {
  const lineColors = {
    series1: '#ab7efd',
    series2: '#00d4bd',
    series3: '#ff9f43',
  }

  const { themeSecondaryTextColor, themeBorderColor, themeDisabledTextColor, themePrimaryTextColor } = colorVariables(themeColors)
  
  return {
    chart: {
      parentHeightOffset: 0,
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
      zoom: {
        enabled: true,
        type: 'x',
        autoScaleYaxis: true,
      },
    },
    colors: [lineColors.series1, lineColors.series2, lineColors.series3],
    stroke: {
      width: 3,
      curve: 'smooth',
      lineCap: 'round',
    },
    dataLabels: { enabled: false },
    markers: {
      size: 0,
      strokeWidth: 4,
      strokeOpacity: 1,
      strokeColors: ['#fff'],
      hover: {
        size: 6,
        sizeOffset: 2,
      },
    },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'left',
      fontSize: '13px',
      fontFamily: 'inherit',
      fontWeight: 500,
      labels: { 
        colors: themeSecondaryTextColor,
        useSeriesColors: false,
      },
      markers: {
        width: 8,
        height: 8,
        radius: 4,
        offsetY: 1,
        offsetX: -3,
      },
      itemMargin: {
        vertical: 3,
        horizontal: 10,
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      theme: themeColors.dark ? 'dark' : 'light',
      style: {
        fontSize: '0.8125rem',
        fontFamily: 'inherit',
      },
      x: {
        show: true,
        format: 'dd MMM yyyy HH:mm',
      },
      y: {
        formatter: (val) => val?.toFixed(2) || '0',
      },
      marker: {
        show: true,
      },
    },
    grid: {
      show: true,
      borderColor: themeBorderColor,
      strokeDashArray: 4,
      xaxis: {
        lines: { 
          show: true,
        },
      },
      yaxis: {
        lines: { 
          show: true,
        },
      },
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    },
    xaxis: {
      type: 'datetime',
      axisBorder: { 
        show: false,
      },
      axisTicks: { 
        show: true,
        color: themeBorderColor,
        height: 6,
      },
      crosshairs: {
        show: true,
        stroke: { 
          color: themeBorderColor,
          width: 1,
          dashArray: 4,
        },
      },
      labels: {
        style: { 
          colors: themeDisabledTextColor, 
          fontSize: '0.8125rem',
          fontFamily: 'inherit',
        },
        datetimeUTC: false,
      },
    },
    yaxis: {
      labels: {
        style: { 
          colors: themeDisabledTextColor, 
          fontSize: '0.8125rem',
          fontFamily: 'inherit',
        },
      },
    },
  }
}

export const getHeatMapChartConfig = themeColors => {
  const { themeBorderColor, themeDisabledTextColor } = colorVariables(themeColors)
  
  return {
    chart: {
      parentHeightOffset: 0,
      toolbar: { show: false },
    },
    dataLabels: { enabled: false },
    stroke: { colors: [themeBorderColor] },
    legend: {
      position: 'bottom',
      labels: { colors: themeDisabledTextColor },
    },
    plotOptions: {
      heatmap: {
        enableShades: true,
        colorScale: {
          ranges: [
            { from: 0, to: 10, name: 'Low', color: '#00A100' },
            { from: 11, to: 20, name: 'Medium', color: '#F9CE1D' },
            { from: 21, to: 30, name: 'High', color: '#FF0000' },
          ],
        },
      },
    },
    xaxis: {
      labels: { style: { colors: themeDisabledTextColor } },
    },
    yaxis: {
      labels: { style: { colors: themeDisabledTextColor } },
    },
  }
}

export const getColumnChartConfig = themeColors => {
  const { themeBorderColor, themeDisabledTextColor } = colorVariables(themeColors)
  
  return {
    chart: {
      parentHeightOffset: 0,
      toolbar: { show: false },
    },
    colors: ['#826af9'],
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: '50%',
        distributed: false,
      },
    },
    dataLabels: { enabled: false },
    grid: {
      borderColor: themeBorderColor,
      xaxis: { lines: { show: true } },
    },
    xaxis: {
      axisBorder: { show: false },
      labels: { style: { colors: themeDisabledTextColor } },
    },
    yaxis: {
      labels: { style: { colors: themeDisabledTextColor } },
    },
  }
}

export const getDonutChartConfig = themeColors => {
  const { themeDisabledTextColor } = colorVariables(themeColors)
  
  return {
    chart: {
      parentHeightOffset: 0,
    },
    colors: ['#826af9', '#9055fd', '#ab7efd', '#c0a1fd'],
    labels: [],
    dataLabels: {
      enabled: true,
      formatter: val => `${parseInt(val)}%`,
    },
    legend: {
      position: 'bottom',
      labels: { colors: themeDisabledTextColor },
    },
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { show: true },
            value: { show: true },
            total: {
              show: true,
              label: 'Total',
            },
          },
        },
      },
    },
  }
}

export const getRadarChartConfig = themeColors => {
  const { themeBorderColor, themeDisabledTextColor } = colorVariables(themeColors)
  
  return {
    chart: {
      parentHeightOffset: 0,
      toolbar: { show: false },
    },
    colors: ['#826af9', '#00d4bd'],
    stroke: { width: 0 },
    dataLabels: { enabled: false },
    plotOptions: {
      radar: {
        polygons: {
          strokeColors: themeBorderColor,
          connectorColors: themeBorderColor,
        },
      },
    },
    xaxis: {
      labels: { style: { colors: themeDisabledTextColor } },
    },
    yaxis: { show: false },
  }
}

export const getScatterChartConfig = themeColors => {
  const { themeBorderColor, themeDisabledTextColor } = colorVariables(themeColors)
  
  return {
    chart: {
      parentHeightOffset: 0,
      toolbar: { show: false },
      zoom: { enabled: true },
    },
    colors: ['#826af9', '#00d4bd', '#ff9f43'],
    grid: {
      borderColor: themeBorderColor,
      xaxis: { lines: { show: true } },
    },
    xaxis: {
      tickAmount: 10,
      labels: { style: { colors: themeDisabledTextColor } },
    },
    yaxis: {
      labels: { style: { colors: themeDisabledTextColor } },
    },
  }
}

export const getRadialBarChartConfig = themeColors => {
  const { themeDisabledTextColor } = colorVariables(themeColors)
  
  return {
    chart: {
      parentHeightOffset: 0,
    },
    colors: ['#826af9', '#00d4bd', '#ff9f43'],
    plotOptions: {
      radialBar: {
        hollow: { size: '30%' },
        track: {
          margin: 10,
        },
        dataLabels: {
          name: {
            fontSize: '22px',
          },
          value: {
            fontSize: '16px',
          },
          total: {
            show: true,
            label: 'Total',
          },
        },
      },
    },
    legend: {
      show: true,
      position: 'bottom',
      labels: { colors: themeDisabledTextColor },
    },
    labels: [],
  }
}

export const getCandlestickChartConfig = themeColors => {
  const { themeBorderColor, themeDisabledTextColor } = colorVariables(themeColors)
  
  return {
    chart: {
      parentHeightOffset: 0,
      toolbar: { show: false },
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#00d4bd',
          downward: '#ff4757',
        },
      },
    },
    grid: {
      borderColor: themeBorderColor,
      xaxis: { lines: { show: true } },
    },
    xaxis: {
      type: 'datetime',
      labels: { style: { colors: themeDisabledTextColor } },
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: { style: { colors: themeDisabledTextColor } },
    },
  }
}
