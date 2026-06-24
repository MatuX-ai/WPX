<script setup>
/**
 * <ChartSlide> - 演示文稿图表页（基于 ECharts）
 *
 * 用法：
 *   <ChartSlide
 *     title="月度销售"
 *     chart-type="bar"
 *     :chart-data="{
 *       categories: ['1月', '2月', '3月', '4月'],
 *       series: [{ name: '销售额', data: [120, 200, 150, 80] }]
 *     }"
 *     theme="light"
 *   />
 *
 * 依赖：
 *   npm i echarts
 *
 * chartData 约定：
 *   {
 *     categories: string[],          // X 轴 / 类目轴
 *     series: [{ name: string, data: number[] }],
 *     // 可选：自定义 option 覆盖项（深度合并）
 *     extra?: object
 *   }
 *
 * 设计要点：
 * - ECharts 通过动态 import 按需加载，减小主 bundle 体积
 * - 主题颜色（轴线、文本、tooltip）随 theme 切换
 * - 组件卸载时正确 dispose
 * - 16:9 固定宽高比
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

const props = defineProps({
  /** 页面标题 */
  title: { type: String, required: true },
  /**
   * 图表类型：'bar' | 'line' | 'pie'
   * - bar: 柱状图
   * - line: 折线图
   * - pie: 饼图（仅取第一个 series 的 data，data 项应为 { name, value }）
   */
  chartType: {
    type: String,
    required: true,
    validator: (v) => ['bar', 'line', 'pie'].includes(v),
  },
  /**
   * 图表数据，结构见文件头注释
   */
  chartData: {
    type: Object,
    required: true,
  },
  /** 主题：light | dark */
  theme: {
    type: String,
    default: 'light',
    validator: (v) => ['light', 'dark'].includes(v),
  },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)

const chartEl = ref(null)
// 用 shallowRef 避免 ECharts 实例被深度响应化
const chartInstance = shallowRef(null)
const loadError = ref('')

const isDark = computed(() => props.theme === 'dark')

const PALETTE = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

/**
 * 根据 chartType + chartData 生成 ECharts option
 */
function buildOption() {
  const isDarkTheme = isDark.value
  const axisColor = isDarkTheme ? '#a3a3a3' : '#475569'
  const splitColor = isDarkTheme ? '#404040' : '#e2e8f0'
  const textColor = isDarkTheme ? '#e0e0e0' : '#1a1a1a'
  const accent = isDarkTheme ? '#60a5fa' : '#7c3aed'

  const data = props.chartData || {}
  const categories = data.categories || []
  const seriesRaw = data.series || []
  const extra = data.extra || {}

  if (props.chartType === 'pie') {
    // 饼图：取第一个 series
    const first = seriesRaw[0] || { data: [] }
    return {
      color: PALETTE,
      backgroundColor: 'transparent',
      textStyle: { color: textColor, fontFamily: 'Inter, system-ui, sans-serif' },
      tooltip: {
        trigger: 'item',
        backgroundColor: isDarkTheme ? '#2d2d2d' : '#ffffff',
        borderColor: splitColor,
        textStyle: { color: textColor },
      },
      legend: {
        bottom: 0,
        textStyle: { color: textColor },
        itemWidth: 12,
        itemHeight: 12,
      },
      series: [
        {
          name: first.name || '',
          type: 'pie',
          radius: ['38%', '68%'],
          center: ['50%', '46%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: isDarkTheme ? '#1e1e1e' : '#ffffff',
            borderWidth: 2,
          },
          label: { color: textColor, fontSize: 13 },
          labelLine: { lineStyle: { color: axisColor } },
          data: first.data || [],
        },
      ],
      ...extra,
    }
  }

  // bar / line 共用直角坐标系
  const series = seriesRaw.map((s, i) => {
    const color = s.color || PALETTE[i % PALETTE.length]
    const base = {
      name: s.name || `系列 ${i + 1}`,
      type: props.chartType,
      data: s.data || [],
      itemStyle: { color },
      emphasis: { focus: 'series' },
    }
    if (props.chartType === 'line') {
      return {
        ...base,
        smooth: s.smooth !== false,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color },
        areaStyle: s.area
          ? {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: color + '66' },
                  { offset: 1, color: color + '08' },
                ],
              },
            }
          : undefined,
      }
    }
    // bar
    return {
      ...base,
      barMaxWidth: 48,
      barMinWidth: 8,
      itemStyle: {
        color,
        borderRadius: [6, 6, 0, 0],
      },
    }
  })

  return {
    color: PALETTE,
    backgroundColor: 'transparent',
    textStyle: { color: textColor, fontFamily: 'Inter, system-ui, sans-serif' },
    grid: { left: '4%', right: '4%', top: '14%', bottom: '12%', containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDarkTheme ? '#2d2d2d' : '#ffffff',
      borderColor: splitColor,
      textStyle: { color: textColor },
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: textColor },
      itemWidth: 12,
      itemHeight: 12,
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: splitColor } },
      axisLabel: { color: axisColor, fontSize: 12 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: axisColor, fontSize: 12 },
      splitLine: { lineStyle: { color: splitColor, type: 'dashed' } },
    },
    series,
    ...extra,
    // 保证主轴色 accent 在最后生效（被 extra 覆盖时可保留）
    _accent: accent,
  }
}

async function initChart() {
  if (!chartEl.value) return
  try {
    const echarts = await import('echarts')
    const inst = echarts.init(chartEl.value, isDark.value ? 'dark' : null, {
      renderer: 'canvas',
    })
    inst.setOption(buildOption())
    chartInstance.value = inst
    loadError.value = ''
  } catch (err) {
    // echarts 未安装或加载失败：给出可读提示，不影响父级布局
    // eslint-disable-next-line no-console
    console.error('[ChartSlide] 加载 ECharts 失败，请执行 npm i echarts', err)
    loadError.value = '图表组件加载失败：请先安装 ECharts（npm i echarts）'
  }
}

function updateChart() {
  if (!chartInstance.value) return
  try {
    chartInstance.value.setOption(buildOption(), true)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[ChartSlide] setOption 失败', err)
  }
}

function handleResize() {
  chartInstance.value?.resize()
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (chartInstance.value) {
    chartInstance.value.dispose()
    chartInstance.value = null
  }
})

// 主题或数据变化时更新图表
watch(
  () => [props.theme, props.chartData, props.chartType],
  () => {
    if (chartInstance.value) {
      updateChart()
    } else {
      // 实例尚未初始化（首次 ECharts 异步加载中），尝试再次初始化
      initChart()
    }
  },
  { deep: true },
)
</script>

<template>
  <div
    class="wpx-slide wpx-slide--chart"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-chart__header">
      <h2 class="wpx-chart__title">{{ title }}</h2>
      <div class="wpx-chart__accent-bar" aria-hidden="true" />
    </header>

    <div class="wpx-chart__body">
      <div
        v-if="!loadError"
        ref="chartEl"
        class="wpx-chart__canvas"
        role="img"
        :aria-label="`${title} 图表`"
      />
      <div v-else class="wpx-chart__error">
        <p class="wpx-chart__error-text">{{ loadError }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wpx-slide {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 5% 6% 6%;
  border-radius: var(--theme-radius-lg, 16px);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(15, 23, 42, 0.14));
  font-family: var(--theme-font-sans, Inter, system-ui, sans-serif);
}

.wpx-slide--light {
  background-color: #ffffff;
  color: #1a1a1a;
}

.wpx-slide--dark {
  background-color: #1e1e1e;
  color: #e0e0e0;
}

.wpx-chart__header {
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.wpx-chart__title {
  font-size: clamp(1.625rem, 3.25vw, 2.375rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.625rem 0;
  line-height: 1.15;
}

.wpx-chart__accent-bar {
  width: 3rem;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    var(--theme-accent, #7c3aed) 0%,
    var(--theme-accent-hover, #6d28d9) 100%
  );
}

.wpx-slide--dark .wpx-chart__accent-bar {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
}

.wpx-chart__body {
  flex: 1;
  position: relative;
  min-height: 0;
}

.wpx-chart__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.wpx-chart__error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--theme-border, #e2e8f0);
  border-radius: var(--theme-radius-md, 10px);
  background: var(--theme-bg-muted, #f1f5f9);
}

.wpx-slide--dark .wpx-chart__error {
  background: #252525;
  border-color: #404040;
}

.wpx-chart__error-text {
  font-size: 0.95rem;
  color: var(--theme-fg-muted, #475569);
  text-align: center;
  padding: 1rem;
  margin: 0;
}
</style>
