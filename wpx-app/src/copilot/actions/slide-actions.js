/**
 * slide-actions.js - 演示文稿相关 CopilotKit Actions 声明式注册
 *
 * 该模块集中维护所有与幻灯片生成相关的 Action 定义。每条 Action 是一个结构化对象，
 * 包含 name / description / parameters / handler 四个字段，便于：
 *  - 在 IDE 中以 JSON 形式阅读每个 Action 的语义
 *  - 集中替换 / 复用 / 单元测试
 *  - 通过统一的注册桥接（registerSlideActions / useCopilotSlideActions）挂到
 *    @copilotkit/vue/v2 的 useFrontendTool
 *
 * 兼容说明：
 *  当前项目使用 @copilotkit/vue v2，该版本的 Vue 注册 API 是 useFrontendTool（不再提供
 *  React 旧版的 useCopilotAction）。本模块在保留 useCopilotAction 风格声明的基础上，
 *  通过 parametersToZod 把简化的 JSON-Schema 风格 parameters 编译成 Zod Schema，
 *  最终注册到 v2 的 useFrontendTool 上。
 *
 * parameters 字段支持以下简写（同时可被 parametersToZod 编译为 Zod）：
 *  - type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum'
 *  - description: 字段说明，会通过 .describe() 透传给 LLM
 *  - required: boolean（默认 true）
 *  - default: 默认值
 *  - enum: string[]（仅 type=enum 时使用）
 *  - items: 子 schema（仅 type=array 时使用）
 *  - properties: 子字段（仅 type=object 时使用；递归支持）
 */
import { z } from 'zod'
import { useSlidesStore } from '@/stores/slides'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { usePPTWorkflow } from '@/composables/usePPTWorkflow'
import { outlineToSlides } from '@/composables/useSlideGenerator'
import { downloadSlidesAsHtml, downloadSlidesAsPptx } from '@/utils/slideExport'

/**
 * 动态加载 @copilotkit/vue/v2，避免在未安装依赖时让静态分析报错。
 * 使用 new Function('return import(p)') 是为了绕过 Vite / Vitest 的
 * import-analysis，对运行时无影响。
 */
const dynamicImport = new Function('p', 'return import(p)')
let _useFrontendTool = null
let _loadPromise = null
async function loadUseFrontendTool() {
  if (_useFrontendTool) return _useFrontendTool
  if (!_loadPromise) {
    _loadPromise = dynamicImport('@copilotkit/vue/v2').then((mod) => {
      _useFrontendTool = mod?.useFrontendTool
      if (!_useFrontendTool) {
        throw new Error('@copilotkit/vue/v2 未提供 useFrontendTool')
      }
      return _useFrontendTool
    })
  }
  return _loadPromise
}

/**
 * 同步包装：在 setup() 中调用，会触发首次懒加载。
 * 一旦加载完成，后续调用直接复用缓存。
 */
function useFrontendToolSync(config) {
  if (_useFrontendTool) {
    _useFrontendTool(config)
    return
  }
  // 首次调用：触发异步加载，并同步把当前 config 注册一次。
  // 若依赖未安装会在这里抛错，便于开发者发现。
  const fn = _useFrontendTool
  if (!fn) {
    throw new Error('@copilotkit/vue/v2 尚未加载，请先在应用启动时调用 ensureCopilotRuntime()')
  }
  fn(config)
}

/**
 * 在应用启动早期调用一次，触发 @copilotkit/vue/v2 的懒加载。
 * 一般放在 CopilotKitProvider 的父组件 setup 里。
 */
export async function ensureCopilotRuntime() {
  await loadUseFrontendTool()
}

/* ───────── JSON-Schema 简写 → Zod 编译器 ───────── */

/**
 * 把单个字段的简化 schema 转成 Zod 字段
 * @param {{ type?: string, description?: string, required?: boolean, default?: any, enum?: string[], items?: any, properties?: Record<string, any> }} schema
 */
function fieldToZod(schema) {
  if (!schema || typeof schema !== 'object') {
    return z.any()
  }
  const { type = 'string', description, default: def, enum: enumValues, items, properties } = schema

  let base
  switch (type) {
    case 'string':
      base = z.string()
      break
    case 'number':
      base = z.number()
      break
    case 'boolean':
      base = z.boolean()
      break
    case 'array':
      base = z.array(items ? fieldToZod(items) : z.any())
      break
    case 'object':
      base = z.object(buildZodShape(properties || {}))
      break
    case 'enum':
      if (Array.isArray(enumValues) && enumValues.length > 0) {
        base = z.enum(enumValues)
      } else {
        base = z.string()
      }
      break
    default:
      base = z.any()
  }

  if (description) base = base.describe(description)
  return base
}

/**
 * 把 parameters 对象编译为 Zod object shape。
 * @param {Record<string, any>} parameters
 */
function buildZodShape(parameters) {
  const shape = {}
  for (const [key, schema] of Object.entries(parameters || {})) {
    let field = fieldToZod(schema)
    if (schema && schema.required === false) {
      field = field.optional()
    }
    if (schema && Object.prototype.hasOwnProperty.call(schema, 'default')) {
      field = field.default(schema.default)
    }
    shape[key] = field
  }
  return shape
}

/**
 * 把 parameters 对象编译为完整的 Zod 对象 Schema。
 */
export function parametersToZod(parameters) {
  return z.object(buildZodShape(parameters))
}

/* ───────── 运行时工具：LLM 直连与 store 解析 ───────── */

const PLATFORM_DEEPSEEK_BASE = 'https://api.deepseek.com'
const PLATFORM_DEEPSEEK_MODEL = 'deepseek-chat'

async function callChatCompletion({ baseUrl, apiKey, model, systemPrompt, userPrompt, temperature = 0.7 }) {
  if (!apiKey) {
    throw new Error('未配置 API Key')
  }
  const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`LLM 调用失败: ${response.status} ${errText.slice(0, 200)}`)
  }
  const json = await response.json()
  const text = json?.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('LLM 返回空内容')
  }
  return String(text).trim()
}

/**
 * 解析当前生效的 LLM 配置（响应式）：优先用户的自定义模型，回退到 WPX 平台模型。
 */
async function resolveLlmConfig() {
  const modelSettingsStore = useModelSettingsStore()
  const authStore = useAuthStore()
  const cfg = modelSettingsStore.effectiveTextConfig

  if (cfg.source === 'custom' && !modelSettingsStore.textPlatformFallback) {
    const apiKey = await modelSettingsStore.resolveTextApiKey()
    return {
      source: 'custom',
      baseUrl: cfg.baseUrl || PLATFORM_DEEPSEEK_BASE,
      apiKey: apiKey || '',
      model: cfg.model || PLATFORM_DEEPSEEK_MODEL,
      isGuest: false,
    }
  }
  if (authStore.isGuest) {
    return {
      source: 'unavailable',
      baseUrl: cfg.baseUrl || PLATFORM_DEEPSEEK_BASE,
      apiKey: '',
      model: cfg.model || PLATFORM_DEEPSEEK_MODEL,
      isGuest: true,
    }
  }
  return {
    source: 'platform',
    baseUrl: cfg.baseUrl || PLATFORM_DEEPSEEK_BASE,
    apiKey: cfg.apiKey || '',
    model: cfg.model || PLATFORM_DEEPSEEK_MODEL,
    isGuest: false,
  }
}

/* ───────── 8 个 Action 声明 ───────── */

/**
 * Action #1：生成 Markdown 大纲
 */
const generateOutlineAction = {
  name: 'generateOutline',
  description: '根据用户给出的主题生成 Markdown 大纲。返回大纲文本并写入幻灯片 store。',
  parameters: {
    topic: {
      type: 'string',
      description: '演示文稿主题，例如「新能源汽车发布会」',
      required: true,
    },
    pageCount: {
      type: 'number',
      description: '目标页数（不含封底），默认 8',
      required: false,
      default: 8,
    },
  },
  handler: async ({ topic, pageCount }) => {
    const slidesStore = useSlidesStore()
    const toast = useToast()
    slidesStore.busy = true
    try {
      const llm = await resolveLlmConfig()
      if (!llm.apiKey) {
        const msg = llm.isGuest
          ? '请先登录或在设置中配置自定义模型 API Key'
          : '未配置 API Key，请在 WPX 设置中填写'
        slidesStore.lastError = msg
        toast.error(msg)
        return { ok: false, error: msg }
      }
      const outline = await callChatCompletion({
        baseUrl: llm.baseUrl,
        apiKey: llm.apiKey,
        model: llm.model,
        systemPrompt:
          '你是一名 PPT 大纲撰写专家。用户给出主题与页数要求，你只输出 Markdown：' +
          '1) 第一行 `# 主标题` 表示整个演示文稿主题；' +
          '2) 后续每页使用 `# 第N页：xxx` 表示页面标题（封面不写"第1页"，直接用主标题）；' +
          '3) 每页用 `-` 列出 3-5 条要点；' +
          '4) 最后一页用 `# 结束页：谢谢`；' +
          '5) 不要输出解释、围栏或前言。',
        userPrompt: `主题：${topic}\n${pageCount ? `页数：${pageCount}` : ''}`,
      })
      slidesStore.setOutline(outline)
      // 同步推进工作流：OUTLINE 阶段完成 → 进入 TEMPLATE 阶段
      const workflow = usePPTWorkflow()
      workflow.markBusy(false)
      if (workflow.state.topic !== topic) {
        workflow.startWorkflow(topic)
      }
      workflow.confirmOutline(outline)
      const message = `已生成大纲，共 ${outline.split(/\r?\n/).filter(Boolean).length} 行`
      slidesStore.lastMessage = message
      toast.success(message)
      return { ok: true, outline, message }
    } catch (error) {
      const msg = error?.message || '生成大纲失败'
      slidesStore.lastError = msg
      toast.error(msg)
      return { ok: false, error: msg }
    } finally {
      slidesStore.busy = false
    }
  },
}

/**
 * Action #2：选择 PPT 模板（business / tech / fresh / custom）
 */
const selectTemplateAction = {
  name: 'selectTemplate',
  description: '选择 PPT 模板（business 商务简约 / tech 科技感 / fresh 清新自然 / custom 自定义），同时更新主题色。',
  parameters: {
    templateId: {
      type: 'enum',
      description: '模板 ID',
      required: true,
      enum: ['business', 'tech', 'fresh', 'custom'],
    },
    custom: {
      type: 'string',
      description: '当 templateId=custom 时，由用户描述的风格',
      required: false,
    },
  },
  handler: async ({ templateId, custom }) => {
    const slidesStore = useSlidesStore()
    const toast = useToast()
    const tpl = slidesStore.setTemplate({ templateId, custom })
    if (!tpl) {
      return { ok: false, error: slidesStore.lastError || '模板选择失败' }
    }
    // 同步推进工作流：TEMPLATE 阶段完成 → 进入 GENERATE 阶段
    const workflow = usePPTWorkflow()
    workflow.selectTemplate(templateId, custom)
    const message = `已选择模板「${tpl.label}」（主题：${tpl.theme}）`
    slidesStore.lastMessage = message
    toast.success(message)
    return { ok: true, template: tpl, message }
  },
}

/**
 * Action #3：根据大纲和模板生成完整幻灯片数组
 *
 * parameters 既支持传入完整的 outline 字符串，也兼容示例里给出的 outline 数组
 * （每项 { title, points }），后者会被自动拼成 Markdown 后再走 outlineToSlides。
 */
const generateSlidesAction = {
  name: 'generateSlides',
  description: '根据大纲和模板，生成完整的幻灯片组件数据。返回 slides 数组。',
  parameters: {
    outline: {
      type: 'array',
      description: '大纲数组，每项 { title, points }。若传字符串，则直接当作 Markdown。',
      required: false,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '页面标题', required: true },
          points: {
            type: 'array',
            description: '该页要点列表',
            required: false,
            items: { type: 'string', description: '要点文本' },
          },
        },
      },
    },
    template: {
      type: 'string',
      description: '模板名称：business / tech / nature / custom（与 selectTemplate 对齐）',
      required: false,
      default: 'business',
    },
  },
  handler: async ({ outline, template }) => {
    const slidesStore = useSlidesStore()
    const toast = useToast()
    slidesStore.busy = true
    try {
      // 1) 处理大纲：字符串直接用；数组则拼接成 Markdown
      let markdown = ''
      if (typeof outline === 'string' && outline.trim()) {
        markdown = outline
      } else if (Array.isArray(outline) && outline.length > 0) {
        markdown = outline
          .map((item, idx) => {
            const title = item?.title || (idx === 0 ? '未命名演示文稿' : `第${idx + 1}页`)
            const points = Array.isArray(item?.points) ? item.points : []
            const body = points.length ? points.map((p) => `- ${p}`).join('\n') : ''
            return body ? `# ${title}\n${body}` : `# ${title}`
          })
          .join('\n\n')
      } else {
        markdown = slidesStore.outline
      }
      if (!markdown || !markdown.trim()) {
        const msg = '大纲为空，请先调用 generateOutline'
        slidesStore.lastError = msg
        return { ok: false, error: msg }
      }

      // 2) 处理模板：若传入则同步到 store
      if (template) {
        const tplMap = { business: 'business', tech: 'tech', fresh: 'fresh', nature: 'fresh', custom: 'custom' }
        const tplId = tplMap[template] || 'business'
        slidesStore.setTemplate({ templateId: tplId })
      }

      // 3) 解析为 slides
      const result = outlineToSlides(markdown, {
        theme: slidesStore.theme,
        autoWrapBoundary: true,
      })
      if (!Array.isArray(result) || result.length === 0) {
        const msg = '大纲解析失败，请检查格式'
        slidesStore.lastError = msg
        return { ok: false, error: msg }
      }
      slidesStore.setSlides(result)
      // 同步推进工作流：GENERATE 阶段完成 → 进入 EDITING 阶段
      const workflow = usePPTWorkflow()
      workflow.onSlidesGenerated(result)
      const message = `已生成 ${result.length} 页幻灯片`
      slidesStore.lastMessage = message
      toast.success(message)
      return { ok: true, slides: result, total: result.length, message }
    } catch (error) {
      const msg = error?.message || '生成幻灯片失败'
      slidesStore.lastError = msg
      toast.error(msg)
      return { ok: false, error: msg }
    } finally {
      slidesStore.busy = false
    }
  },
}

/**
 * Action #4：修改指定页内容
 */
const modifySlideAction = {
  name: 'modifySlide',
  description: '修改指定页（0-based index）的内容，changes 会合并到 props。支持 component 字段切换组件类型。',
  parameters: {
    pageIndex: {
      type: 'number',
      description: '页码（0 表示第一页 / 封面）',
      required: true,
    },
    changes: {
      type: 'object',
      description: '要合并到该页 props 的字段，例如 { title, bulletPoints, imageUrl }',
      required: true,
    },
  },
  handler: async ({ pageIndex, changes }) => {
    const slidesStore = useSlidesStore()
    const toast = useToast()
    const ok = slidesStore.modifySlide(pageIndex, changes)
    if (!ok) {
      return { ok: false, error: slidesStore.lastError || '修改失败' }
    }
    const message = `已更新第 ${pageIndex + 1} 页`
    slidesStore.lastMessage = message
    toast.success(message)
    return { ok: true, message, total: slidesStore.totalPages }
  },
}

/**
 * Action #5：新增一页
 */
const addSlideAction = {
  name: 'addSlide',
  description: '在指定位置新增一页。默认在末尾追加。',
  parameters: {
    insertAt: {
      type: 'number',
      description: '插入位置（0-based），-1 表示末尾',
      required: false,
      default: -1,
    },
    component: {
      type: 'string',
      description: '组件类型，默认 TextSlide',
      required: false,
      default: 'TextSlide',
    },
    title: {
      type: 'string',
      description: '新页标题',
      required: false,
      default: '新页面',
    },
    props: {
      type: 'object',
      description: '额外 props',
      required: false,
    },
  },
  handler: async ({ insertAt, component, title, props }) => {
    const slidesStore = useSlidesStore()
    const toast = useToast()
    const target = insertAt === -1 ? slidesStore.totalPages : insertAt
    const data = {
      component: component || 'TextSlide',
      props: { title: title || '新页面', ...(props || {}) },
    }
    const actualIdx = slidesStore.addSlide(target, data)
    const message = `已在第 ${actualIdx + 1} 页新增「${data.props.title}」`
    slidesStore.lastMessage = message
    toast.success(message)
    return { ok: true, index: actualIdx, total: slidesStore.totalPages, message }
  },
}

/**
 * Action #6：删除一页
 */
const removeSlideAction = {
  name: 'removeSlide',
  description: '删除指定页（0-based index）。',
  parameters: {
    pageIndex: {
      type: 'number',
      description: '页码（0 表示第一页）',
      required: true,
    },
  },
  handler: async ({ pageIndex }) => {
    const slidesStore = useSlidesStore()
    const toast = useToast()
    const ok = slidesStore.removeSlide(pageIndex)
    if (!ok) {
      return { ok: false, error: slidesStore.lastError || '删除失败' }
    }
    const message = `已删除第 ${pageIndex + 1} 页`
    slidesStore.lastMessage = message
    toast.success(message)
    return { ok: true, message, total: slidesStore.totalPages }
  },
}

/**
 * Action #7：导出 HTML
 */
const exportAsHtmlAction = {
  name: 'exportAsHTML',
  description: '把当前 slides 导出为独立可交互的 HTML 文件（含翻页、键盘导航）。',
  parameters: {
    filename: {
      type: 'string',
      description: '下载文件名，默认 slides-<timestamp>.html',
      required: false,
    },
  },
  handler: async ({ filename }) => {
    const slidesStore = useSlidesStore()
    const snapshot = slidesStore.getSlidesSnapshot()
    if (snapshot.length === 0) {
      return { ok: false, error: '当前没有幻灯片可导出，请先生成。' }
    }
    try {
      const result = downloadSlidesAsHtml(snapshot, {
        theme: slidesStore.theme,
        filename,
        title:
          slidesStore.outline?.split(/\r?\n/)[0]?.replace(/^#\s*/, '') || 'WPX 演示文稿',
      })
      slidesStore.lastMessage = `已导出 HTML：${result.filename}`
      return { ok: true, ...result, message: slidesStore.lastMessage }
    } catch (error) {
      const msg = error?.message || 'HTML 导出失败'
      slidesStore.lastError = msg
      return { ok: false, error: msg }
    }
  },
}

/**
 * Action #8：导出 PPTX
 */
const exportAsPptxAction = {
  name: 'exportAsPPTX',
  description: '把当前 slides 导出为 PPTX 文件（基于 pptxgenjs，图表与图片降级为占位）。',
  parameters: {
    filename: {
      type: 'string',
      description: '下载文件名，默认 slides-<timestamp>.pptx',
      required: false,
    },
  },
  handler: async ({ filename }) => {
    const slidesStore = useSlidesStore()
    const snapshot = slidesStore.getSlidesSnapshot()
    if (snapshot.length === 0) {
      return { ok: false, error: '当前没有幻灯片可导出，请先生成。' }
    }
    try {
      const result = await downloadSlidesAsPptx(snapshot, {
        theme: slidesStore.theme,
        filename,
        title:
          slidesStore.outline?.split(/\r?\n/)[0]?.replace(/^#\s*/, '') || 'WPX 演示文稿',
      })
      slidesStore.lastMessage = `已导出 PPTX：${result.filename}`
      return { ok: true, ...result, message: slidesStore.lastMessage }
    } catch (error) {
      const msg = error?.message || 'PPTX 导出失败'
      slidesStore.lastError = msg
      return { ok: false, error: msg }
    }
  },
}

/* ───────── Actions 集合 ───────── */

/**
 * 所有幻灯片相关 Actions 的声明式集合。
 * 每个元素遵循统一的 { name, description, parameters, handler } 契约。
 * 该顺序也是 Agent 调用提示的推荐顺序（大纲 → 模板 → 生成 → 修改 → 导出）。
 */
export const SLIDE_ACTIONS = [
  generateOutlineAction,
  selectTemplateAction,
  generateSlidesAction,
  modifySlideAction,
  addSlideAction,
  removeSlideAction,
  exportAsHtmlAction,
  exportAsPptxAction,
]

/* ───────── 注册桥接：声明 → CopilotKit Frontend Tool ───────── */

/**
 * 把单个声明式 Action 编译为 useFrontendTool 的参数对象。
 *  - parameters 经 parametersToZod 转为 Zod Schema
 *  - handler 透传
 *  - 不设置 render，由各调用方按需提供（见 SlideCopilotActionsHost）
 */
export function toFrontendToolConfig(action) {
  return {
    name: action.name,
    description: action.description,
    parameters: parametersToZod(action.parameters),
    handler: action.handler,
  }
}

/**
 * 命令式注册：把指定 Actions 通过 v2 的 useFrontendTool 注入当前 CopilotKit Provider。
 * 该函数必须在组件 setup() 中同步调用。
 *
 * @param {Array} actions 默认导出全部 SLIDE_ACTIONS
 */
export function registerSlideActions(actions = SLIDE_ACTIONS) {
  actions.forEach((action) => {
    const config = toFrontendToolConfig(action)
    useFrontendToolSync(config)
  })
}

/**
 * Composable 形式的注册入口，名称与 CopilotKit 旧版 useCopilotAction 风格对齐。
 * 用法（在 CopilotKitProvider 子组件的 setup 中）：
 *   import { useCopilotSlideActions } from '@/copilot/actions/slide-actions'
 *   useCopilotSlideActions()
 */
export function useCopilotSlideActions() {
  registerSlideActions(SLIDE_ACTIONS)
}

export default useCopilotSlideActions