/**
 * useSlideGenerator - Markdown 大纲 → 演示文稿生成器
 *
 * 提供的能力：
 *   - outlineToSlides(markdownText)  : 解析 Markdown 大纲为 slides 数组
 *   - updateSlideContent()           : 不可变更新指定页内容
 *   - addSlide()                     : 不可变在指定位置插入新幻灯片
 *   - removeSlide()                  : 不可变删除指定幻灯片
 *   - moveSlide()                    : 不可变移动幻灯片
 *   - reorderSlides()                : 不可变批量重排序
 *   - getSlide()                     : 安全读取指定页
 *   - validateSlides()               : 校验 slides 数组结构
 *
 * 设计原则：
 *   - 所有方法均为**纯函数**：输入 → 输出，不修改入参，方便 Vue 响应式
 *   - 同一份逻辑提供两套出口：命名导出（纯函数）和默认 useSlideGenerator() 包装
 *   - 解析结果不假设存在 CoverSlide / EndSlide 边界；调用方可通过
 *     autoWrapBoundary 选项自动加封第一页 / 最后一页
 *   - 解析时忽略空行、HTML 注释，不解析代码块（```）中的 # 标题
 */

/* ───────── 常量 ───────── */

/** 图表相关关键词（中文 + 英文） */
const CHART_KEYWORDS = [
  '图表', '柱状图', '饼图', '折线图', '面积图', '散点图', '雷达图',
  'chart', 'bar chart', 'pie chart', 'line chart', 'area chart',
  'scatter', 'radar', 'histogram', 'graph',
]

/** 匹配 Markdown 图片语法：`![alt](url)` */
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

/** 匹配独立的图片 URL（http/https/data） */
const URL_IMAGE_RE = /(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp)(?:\?[^\s)]*)?|\bdata:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+)/gi

/** 匹配 Markdown 标题行：# / ## / ... / ###### */
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/

/** 匹配 fenced code block（``` 或 ~~~） */
const FENCE_RE = /^(```|~~~)/

/* ───────── 工具函数 ───────── */

/**
 * 去除字符串首尾空白
 */
function trim(s) {
  return typeof s === 'string' ? s.trim() : ''
}

/**
 * 判断是否包含图表关键词
 */
function hasChartKeyword(text) {
  if (!text) return false
  const lower = text.toLowerCase()
  return CHART_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
}

/**
 * 从一段文本中提取图片 URL
 * - 优先匹配 Markdown 图片语法 ![alt](url)
 * - 其次匹配裸 URL（http/https/data）
 * @returns {string[]} 图片 URL 列表（可能为空）
 */
function extractImageUrls(text) {
  if (!text) return []
  const urls = []
  // 1) Markdown 图片语法
  let m
  const mdRe = new RegExp(MD_IMAGE_RE.source, 'g')
  while ((m = mdRe.exec(text)) !== null) {
    urls.push(m[2])
  }
  // 移除已经匹配过的 markdown 图片，避免重复
  const remaining = text.replace(mdRe, '')
  // 2) 裸 URL
  const urlRe = new RegExp(URL_IMAGE_RE.source, 'gi')
  while ((m = urlRe.exec(remaining)) !== null) {
    urls.push(m[0])
  }
  return urls
}

/**
 * 将 ## 要点（每行一个）抽取为 bulletPoints 数组
 * - 去除前缀符号（- * + 数字.）
 * - 去除行内 markdown 加粗/斜体标记
 */
function parseBulletPoints(block) {
  if (!block) return []
  return block
    .split(/\r?\n/)
    .map((line) => trim(line))
    .filter(Boolean)
    .map((line) => line.replace(/^[-*+]\s+/, '').replace(/^\d+[.)]\s+/, ''))
    .map((line) => line.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1'))
}

/**
 * 解析 Markdown 中的一级标题和其下的二级要点块
 * @param {string} text
 * @returns {Array<{ title: string, body: string }>}
 */
function parseOutline(text) {
  if (!text || typeof text !== 'string') return []

  const lines = text.split(/\r?\n/)
  const sections = [] // [{ title, body }]
  let current = null
  let inCodeBlock = false

  for (const raw of lines) {
    const line = raw || ''

    // 切换代码块状态
    if (FENCE_RE.test(line.trim())) {
      inCodeBlock = !inCodeBlock
      // 代码块边界不作为标题
      if (current) current.body += (current.body ? '\n' : '') + line
      continue
    }
    if (inCodeBlock) {
      if (current) current.body += (current.body ? '\n' : '') + line
      continue
    }

    const m = HEADING_RE.exec(line)
    if (m) {
      const level = m[1].length
      const title = trim(m[2])
      if (level === 1) {
        // 一级标题：开新 section
        if (current) sections.push(current)
        current = { title, body: '' }
      } else if (current) {
        // 二级及以下：当作正文的标题行
        current.body += (current.body ? '\n' : '') + line
      } else {
        // 没有 # 父级，孤立的 ## 也算新 section
        current = { title, body: '' }
      }
      continue
    }

    if (current) {
      current.body += (current.body ? '\n' : '') + line
    } else {
      // 大纲开头没有 # 标题：跳过（容忍空段）
    }
  }
  if (current) sections.push(current)
  return sections
}

/**
 * 将单个 section 转成 slide
 * - 包含图表关键词 → ChartSlide
 * - 包含图片 → ImageTextSlide
 * - 否则 → TextSlide（list 布局）
 */
function sectionToSlide(section, theme = 'light') {
  const { title, body } = section
  const allText = `${title}\n${body || ''}`

  if (hasChartKeyword(allText)) {
    return {
      component: 'ChartSlide',
      props: {
        title,
        chartType: detectChartType(body || title),
        chartData: parseChartData(body, title),
        theme,
      },
    }
  }

  const images = extractImageUrls(body)
  if (images.length > 0) {
    return {
      component: 'ImageTextSlide',
      props: {
        title,
        text: stripImages(body),
        imageUrl: images[0],
        imagePosition: 'right',
        theme,
      },
    }
  }

  return {
    component: 'TextSlide',
    props: {
      title,
      bulletPoints: parseBulletPoints(body || ''),
      layout: 'list',
      theme,
    },
  }
}

/**
 * 根据正文粗略推断图表类型
 */
function detectChartType(text) {
  const lower = (text || '').toLowerCase()
  if (lower.includes('饼图') || lower.includes('pie')) return 'pie'
  if (lower.includes('折线') || lower.includes('line') || lower.includes('趋势')) return 'line'
  // 默认柱状图
  return 'bar'
}

/**
 * 粗略解析图表数据：寻找"分类:数值"对，或表格列。
 * 兜底使用占位数据，确保图表仍能渲染。
 */
function parseChartData(body, title) {
  const text = body || ''
  // 模式 1: "类目 12 万 / 13%" 形式
  const lines = text
    .split(/\r?\n/)
    .map(trim)
    .filter(Boolean)

  const categories = []
  const values = []
  const pairRe = /^(.+?)[\s:：]+(-?\d+(?:\.\d+)?)(?:\s*%|万)?$/
  for (const line of lines) {
    const m = pairRe.exec(line)
    if (m) {
      categories.push(trim(m[1]))
      values.push(Number(m[2]))
    }
  }

  if (categories.length > 0) {
    return {
      categories,
      series: [{ name: title || '数据', data: values }],
    }
  }

  // 模式 2: 兜底
  return {
    categories: ['A', 'B', 'C', 'D'],
    series: [{ name: title || '数据', data: [10, 20, 30, 40] }],
  }
}

/**
 * 去除正文中的图片 markdown / URL，返回纯文本
 */
function stripImages(text) {
  if (!text) return ''
  return text
    .replace(MD_IMAGE_RE, '')
    .replace(URL_IMAGE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* ───────── outlineToSlides 主函数 ───────── */

/**
 * 将 Markdown 大纲解析为 slides 数组
 *
 * Markdown 约定：
 *   - `# 标题`             单独一页（标题 + 要点）
 *   - `## 小标题` 与正文   合并到所属 # 页面（## 不会单独成页）
 *   - 正文每行一个要点（支持 - * + 1. 等前缀）
 *   - 包含图表关键词 → ChartSlide
 *   - 包含图片（markdown / url）→ ImageTextSlide
 *
 * @param {string} markdownText
 * @param {object} [options]
 * @param {'light' | 'dark'} [options.theme='light']
 * @param {boolean} [options.autoWrapBoundary=true] 是否自动在头尾加 CoverSlide / EndSlide
 * @param {string} [options.coverTitle]            封面标题（覆盖第一页推断）
 * @param {string} [options.coverSubtitle]         封面副标题
 * @param {string} [options.endText]               结束页文案
 * @param {string} [options.endContact]            结束页联系方式
 * @returns {Array<{ component: string, props: object }>}
 */
function outlineToSlides(markdownText, options = {}) {
  const {
    theme = 'light',
    autoWrapBoundary = true,
    coverTitle,
    coverSubtitle,
    endText = '感谢观看',
    endContact,
  } = options

  const sections = parseOutline(markdownText)

  // 空大纲：仅返回封底两个边界页
  if (sections.length === 0) {
    if (!autoWrapBoundary) return []
    return [
      {
        component: 'CoverSlide',
        props: { title: '未命名演示文稿', subtitle: '请在编辑器中输入大纲', theme },
      },
      {
        component: 'EndSlide',
        props: { text: endText, theme },
      },
    ]
  }

  // 主体内容 slides
  const body = sections.map((s) => sectionToSlide(s, theme))

  if (!autoWrapBoundary) return body

  // 边界包裹
  const head = body[0] || {}
  const cover = {
    component: 'CoverSlide',
    props: {
      title: coverTitle || head.props?.title || '新演示文稿',
      subtitle:
        coverSubtitle ||
        head.props?.subtitle ||
        `共 ${body.length} 页 · 自动生成`,
      theme,
    },
  }
  const end = {
    component: 'EndSlide',
    props: {
      text: endText,
      contactInfo: endContact
        ? typeof endContact === 'string'
          ? { website: endContact }
          : endContact
        : undefined,
      theme,
    },
  }

  // 若首/末页已经是同类型，则覆盖之（避免重复封面 / 结束页）
  const result = []
  if (head.component === 'CoverSlide') {
    result.push({ ...head, props: { ...head.props, ...cover.props } })
  } else {
    result.push(cover)
  }
  for (let i = 1; i < body.length; i += 1) result.push(body[i])
  const last = result[result.length - 1]
  if (last && last.component === 'EndSlide') {
    result[result.length - 1] = { ...last, props: { ...last.props, ...end.props } }
  } else {
    result.push(end)
  }
  return result
}

/* ───────── slides 操作（不可变） ───────── */

/**
 * 不可变更新指定页的内容
 *
 * @param {Array} slides
 * @param {number} pageIndex
 * @param {object} newContent
 *   - string：替换整页（生成对应组件的默认 props）
 *   - object：{ title?, bulletPoints?, text?, imageUrl?, ... }：合并到现有 props
 * @returns {Array} 新数组
 */
function updateSlideContent(slides, pageIndex, newContent) {
  if (!Array.isArray(slides)) return []
  if (pageIndex < 0 || pageIndex >= slides.length) {
    // 越界：返回浅拷贝
    return slides.slice()
  }

  const target = slides[pageIndex]
  if (!target) return slides.slice()

  // 字符串：当作标题，整页重渲染为 TextSlide
  if (typeof newContent === 'string') {
    const updated = {
      ...target,
      props: {
        ...(target.props || {}),
        title: newContent,
      },
    }
    return cloneAndReplace(slides, pageIndex, updated)
  }

  if (newContent && typeof newContent === 'object') {
    const updated = {
      ...target,
      props: {
        ...(target.props || {}),
        ...newContent,
      },
    }
    return cloneAndReplace(slides, pageIndex, updated)
  }

  return slides.slice()
}

/**
 * 在指定位置插入新幻灯片
 * - pageIndex 默认在末尾追加
 * - pageIndex < 0：在开头插入
 * - pageIndex > slides.length：追加到末尾
 *
 * @param {Array} slides
 * @param {number} pageIndex
 * @param {object} slideData 形如 { component, props }
 * @returns {Array} 新数组
 */
function addSlide(slides, pageIndex, slideData) {
  if (!Array.isArray(slides)) return []
  const insertAt = clampIndex(pageIndex, 0, slides.length)
  const newSlide = normalizeSlideData(slideData)
  const result = slides.slice()
  result.splice(insertAt, 0, newSlide)
  return result
}

/**
 * 删除指定幻灯片
 * - 若删除后数组为空，返回 []
 * - 若只有 1 项，返回 []（避免出现空数组的奇怪状态）
 * - 越界：返回浅拷贝
 *
 * @param {Array} slides
 * @param {number} pageIndex
 * @returns {Array} 新数组
 */
function removeSlide(slides, pageIndex) {
  if (!Array.isArray(slides)) return []
  if (pageIndex < 0 || pageIndex >= slides.length) return slides.slice()
  if (slides.length <= 1) return []
  const result = slides.slice()
  result.splice(pageIndex, 1)
  return result
}

/**
 * 移动幻灯片位置（拖拽排序）
 * @param {Array} slides
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {Array} 新数组
 */
function moveSlide(slides, fromIndex, toIndex) {
  if (!Array.isArray(slides)) return []
  if (fromIndex === toIndex) return slides.slice()
  if (fromIndex < 0 || fromIndex >= slides.length) return slides.slice()
  if (toIndex < 0 || toIndex >= slides.length) return slides.slice()
  const result = slides.slice()
  const [moved] = result.splice(fromIndex, 1)
  result.splice(toIndex, 0, moved)
  return result
}

/**
 * 批量重排序（如用户点击"上移"/"下移"多次后一次性应用）
 * @param {Array} slides
 * @param {number[]} newOrder
 *   例如 [0, 2, 1, 3] 表示将原数组的 0/2/1/3 顺序排列
 * @returns {Array} 新数组
 */
function reorderSlides(slides, newOrder) {
  if (!Array.isArray(slides) || !Array.isArray(newOrder)) return slides.slice()
  if (newOrder.length !== slides.length) return slides.slice()
  const seen = new Set()
  for (const i of newOrder) {
    if (typeof i !== 'number' || i < 0 || i >= slides.length || seen.has(i)) {
      return slides.slice()
    }
    seen.add(i)
  }
  return newOrder.map((i) => slides[i])
}

/**
 * 安全读取指定页
 */
function getSlide(slides, pageIndex) {
  if (!Array.isArray(slides)) return null
  if (pageIndex < 0 || pageIndex >= slides.length) return null
  return slides[pageIndex] || null
}

/**
 * 校验 slides 数组结构
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSlides(slides) {
  const errors = []
  if (!Array.isArray(slides)) {
    return { valid: false, errors: ['slides 必须是数组'] }
  }
  if (slides.length === 0) {
    return { valid: true, errors: [], empty: true }
  }
  slides.forEach((s, i) => {
    if (!s || typeof s !== 'object') {
      errors.push(`第 ${i + 1} 页：不是有效对象`)
      return
    }
    if (typeof s.component !== 'string' || !s.component) {
      errors.push(`第 ${i + 1} 页：缺少 component`)
    }
    if (s.props != null && typeof s.props !== 'object') {
      errors.push(`第 ${i + 1} 页：props 必须是对象或 undefined`)
    }
  })
  return { valid: errors.length === 0, errors }
}

/* ───────── 内部工具 ───────── */

function cloneAndReplace(arr, idx, newItem) {
  const result = arr.slice()
  result[idx] = newItem
  return result
}

function clampIndex(idx, min, max) {
  if (typeof idx !== 'number' || Number.isNaN(idx)) return max
  if (idx < min) return min
  if (idx > max) return max
  return idx
}

function normalizeSlideData(slideData) {
  if (!slideData || typeof slideData !== 'object') {
    return { component: 'TextSlide', props: { title: '新页面', bulletPoints: [] } }
  }
  const component = typeof slideData.component === 'string' ? slideData.component : 'TextSlide'
  const props =
    slideData.props && typeof slideData.props === 'object' ? { ...slideData.props } : {}
  return { component, props }
}

/* ───────── Composable 包装 ───────── */

/**
 * useSlideGenerator - 组件内调用
 *
 * 暴露同名方法（指向纯函数）+ 一些便利的状态（仅在需要时使用）。
 *
 * 用法：
 *   const { outlineToSlides, addSlide, removeSlide } = useSlideGenerator()
 *   const slides = outlineToSlides('# A\n## a\n## b\n# B')
 */
export function useSlideGenerator() {
  return {
    outlineToSlides,
    updateSlideContent,
    addSlide,
    removeSlide,
    moveSlide,
    reorderSlides,
    getSlide,
    validateSlides,
  }
}

/* ───────── 命名导出（纯函数） ───────── */

export {
  outlineToSlides,
  updateSlideContent,
  addSlide,
  removeSlide,
  moveSlide,
  reorderSlides,
  getSlide,
  validateSlides,
  // 内部工具（如需高级用法）
  parseOutline as _parseOutline,
  parseBulletPoints as _parseBulletPoints,
  extractImageUrls as _extractImageUrls,
  hasChartKeyword as _hasChartKeyword,
}

export default useSlideGenerator
