/**
 * slides - 幻灯片状态 Store
 *
 * 为 CopilotKit Actions 提供统一的幻灯片数据源。设计原则：
 *  - 所有 mutator 借助 useSlideGenerator 的纯函数实现不可变更新
 *  - state 同时承载 Markdown 大纲（outline）与渲染后的 slides 数组
 *  - 模板选择作为元数据保存，便于后续渲染时按模板注入主题样式
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  addSlide as addSlidePure,
  moveSlide as moveSlidePure,
  removeSlide as removeSlidePure,
  reorderSlides as reorderSlidesPure,
  updateSlideContent as updateSlideContentPure,
  validateSlides,
} from '@/composables/useSlideGenerator'

/** 内置模板清单，与需求文档 §2.2 对齐 */
export const SLIDE_TEMPLATES = [
  {
    id: 'business',
    label: '商务简约风',
    description: '白底蓝调，适合正式场合',
    theme: 'light',
  },
  {
    id: 'tech',
    label: '科技感风',
    description: '深色背景，发光元素，适合发布会',
    theme: 'dark',
  },
  {
    id: 'fresh',
    label: '清新自然风',
    description: '浅绿配色，适合教育/公益',
    theme: 'light',
  },
  {
    id: 'custom',
    label: '自定义',
    description: '请描述你想要的风格',
    theme: 'light',
  },
]

export const useSlidesStore = defineStore('slides', () => {
  /** Markdown 大纲文本（第一步产物） */
  const outline = ref('')
  /** 渲染后的幻灯片数据 [{ component, props }] */
  const slides = ref([])
  /** 主题：light | dark */
  const theme = ref('light')
  /** 当前选中的模板 */
  const selectedTemplate = ref(null)
  /** 最近一次操作的成功消息（chat 反馈用） */
  const lastMessage = ref('')
  /** 最近一次的错误消息 */
  const lastError = ref(null)
  /** 是否正在执行 AI 操作 */
  const busy = ref(false)

  const totalPages = computed(() => slides.value.length)

  const validation = computed(() => validateSlides(slides.value))

  function setOutline(markdown) {
    outline.value = typeof markdown === 'string' ? markdown : ''
    lastError.value = null
  }

  function setSlides(next) {
    if (!Array.isArray(next)) {
      lastError.value = 'slides 必须是数组'
      return false
    }
    slides.value = next.slice()
    lastError.value = null
    return true
  }

  function setTheme(nextTheme) {
    if (nextTheme === 'light' || nextTheme === 'dark') {
      theme.value = nextTheme
    }
  }

  /**
   * 选择模板：templateId 对应 SLIDE_TEMPLATES 之一；custom 时允许传入 description
   * @param {{ templateId: string, custom?: string }} payload
   */
  function setTemplate(payload) {
    const found = SLIDE_TEMPLATES.find((t) => t.id === payload?.templateId)
    if (!found) {
      lastError.value = `未知的模板: ${payload?.templateId}`
      return null
    }

    const next = { ...found }
    if (found.id === 'custom' && payload?.custom) {
      next.description = String(payload.custom).slice(0, 200)
      next.customNote = next.description
    }
    selectedTemplate.value = next
    theme.value = found.theme
    lastError.value = null
    return next
  }

  /**
   * 不可变新增幻灯片。内部委托给 useSlideGenerator 的 addSlide 纯函数。
   * @param {number} [insertAt]
   * @param {{ component?: string, props?: object }} [slideData]
   */
  function addSlide(insertAt, slideData) {
    const idx = typeof insertAt === 'number' ? insertAt : slides.value.length
    const data = slideData && typeof slideData === 'object'
      ? slideData
      : { component: 'TextSlide', props: { title: '新页面', bulletPoints: [] } }
    slides.value = addSlidePure(slides.value, idx, data)
    lastError.value = null
    return idx
  }

  /**
   * 不可变删除指定页
   * @param {number} pageIndex
   */
  function removeSlide(pageIndex) {
    if (typeof pageIndex !== 'number' || pageIndex < 0 || pageIndex >= slides.value.length) {
      lastError.value = `删除失败：第 ${pageIndex + 1} 页不存在`
      return false
    }
    const next = removeSlidePure(slides.value, pageIndex)
    if (next.length === slides.value.length) {
      lastError.value = '删除未生效'
      return false
    }
    slides.value = next
    lastError.value = null
    return true
  }

  /**
   * 不可变修改指定页。changes 为空对象或非对象时直接返回 false。
   * @param {number} pageIndex
   * @param {object} changes
   */
  function modifySlide(pageIndex, changes) {
    if (typeof pageIndex !== 'number' || pageIndex < 0 || pageIndex >= slides.value.length) {
      lastError.value = `修改失败：第 ${pageIndex + 1} 页不存在`
      return false
    }
    if (!changes || typeof changes !== 'object') {
      lastError.value = '修改内容不能为空'
      return false
    }
    slides.value = updateSlideContentPure(slides.value, pageIndex, changes)
    lastError.value = null
    return true
  }

  /**
   * 拖拽排序
   * @param {number} from
   * @param {number} to
   */
  function moveSlide(from, to) {
    const next = moveSlidePure(slides.value, from, to)
    if (next.length !== slides.value.length) {
      lastError.value = '移动失败'
      return false
    }
    slides.value = next
    lastError.value = null
    return true
  }

  function reorderSlides(newOrder) {
    slides.value = reorderSlidesPure(slides.value, newOrder)
    lastError.value = null
  }

  function reset() {
    outline.value = ''
    slides.value = []
    theme.value = 'light'
    selectedTemplate.value = null
    lastMessage.value = ''
    lastError.value = null
    busy.value = false
  }

  function getOutlineText() {
    return outline.value
  }

  function getSlidesSnapshot() {
    return slides.value.slice()
  }

  return {
    outline,
    slides,
    theme,
    selectedTemplate,
    lastMessage,
    lastError,
    busy,
    totalPages,
    validation,
    setOutline,
    setSlides,
    setTheme,
    setTemplate,
    addSlide,
    removeSlide,
    modifySlide,
    moveSlide,
    reorderSlides,
    reset,
    getOutlineText,
    getSlidesSnapshot,
  }
})