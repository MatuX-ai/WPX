/**
 * useSlideCopilotActions - 注册幻灯片相关的 CopilotKit Frontend Tools
 *
 * 8 个 actions 全部通过 useFrontendTool（@copilotkit/vue/v2）注册到当前
 * CopilotKitProvider 作用域，让 Agent 可以主动调用这些工具来构建 / 修改幻灯片。
 *
 * 行为约束：
 *  - 每个 action 的核心逻辑都委托给 slidesStore 与 useSlideGenerator 的纯函数，
 *    严格保持不可变更新。
 *  - LLM 大纲生成复用 useAiChat 中已经走通的 DeepSeek / 自定义模型链路（同步：
 *    直接调用模型 API 端点，避免依赖当前 AI SDK Chat 实例）。
 *  - 模板/导出动作同步执行，结果即时反馈给 Agent。
 *  - 在 hook 内部读取 modelSettingsStore 的响应式状态，每次请求都会带上当前模型配置。
 */
import { computed, h } from 'vue'
import { useFrontendTool } from '@copilotkit/vue/v2'
import { z } from 'zod'
import { useSlidesStore } from '@/stores/slides'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { outlineToSlides } from '@/composables/useSlideGenerator'
import { downloadSlidesAsHtml, downloadSlidesAsPptx } from '@/utils/slideExport'

const PLATFORM_DEEPSEEK_BASE = 'https://api.deepseek.com'
const PLATFORM_DEEPSEEK_MODEL = 'deepseek-chat'

/**
 * 直接通过 fetch 调用 OpenAI 兼容 Chat Completion 端点，避开 useAiChat 的
 * 流式/工具调用机制，方便 action handler 同步获得文本结果。
 *
 * @param {{ baseUrl: string, apiKey: string, model: string, systemPrompt?: string, userPrompt: string, temperature?: number }} opts
 * @returns {Promise<string>}
 */
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

function buildOutlineSystemPrompt() {
  return `你是一名 PPT 大纲撰写专家。用户给出主题与页数要求，你只输出 Markdown：
1. 第一行 \`# 主标题\` 表示整个演示文稿主题；
2. 后续每页使用 \`# 第N页：xxx\` 表示页面标题（封面不写"第1页"，直接用主标题）；
3. 每页用 \`-\` 列出 3-5 条要点；
4. 最后一页用 \`# 结束页：谢谢\`；
5. 不要输出解释、围栏或前言。`
}

/**
 * 简单的 chat 气泡渲染器（占位，可在后续替换为 CopilotKit 的 renderToolCalls 自定义 UI）
 */
const OutlinePreview = {
  props: ['args', 'result', 'status'],
  setup(props) {
    return () => {
      const status = props.status || 'inProgress'
      const outline = props.result?.outline || ''
      if (status !== 'complete') {
        return h('div', { class: 'wpx-copilot-tool-pending' }, `正在生成大纲… (主题: ${props.args?.topic || ''})`)
      }
      return h('pre', { class: 'wpx-copilot-tool-result' }, outline.slice(0, 2000))
    }
  },
}

const TemplatePicker = {
  props: ['args', 'result', 'status'],
  setup(props) {
    return () => {
      const msg = props.result?.message || ''
      const tpl = props.result?.template || null
      return h('div', { class: 'wpx-copilot-tool-result' }, [
        h('strong', null, tpl ? `模板：${tpl.label}` : '模板选择'),
        msg ? h('div', null, msg) : null,
      ].filter(Boolean))
    }
  },
}

const SlideSnapshot = {
  props: ['args', 'result', 'status'],
  setup(props) {
    return () => {
      const r = props.result || {}
      const total = r.total ?? 0
      const msg = r.message || ''
      const status = props.status || 'inProgress'
      if (status !== 'complete') {
        return h('div', { class: 'wpx-copilot-tool-pending' }, '正在处理…')
      }
      return h('div', { class: 'wpx-copilot-tool-result' }, `共 ${total} 页 — ${msg}`)
    }
  },
}

/**
 * 读取当前生效的 LLM 配置（响应式）
 */
function useResolvedLlm() {
  const modelSettingsStore = useModelSettingsStore()
  const authStore = useAuthStore()

  return computed(async () => {
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
      return { source: 'unavailable', baseUrl: cfg.baseUrl, apiKey: '', model: cfg.model, isGuest: true }
    }
    return {
      source: 'platform',
      baseUrl: cfg.baseUrl || PLATFORM_DEEPSEEK_BASE,
      apiKey: cfg.apiKey || '',
      model: cfg.model || PLATFORM_DEEPSEEK_MODEL,
      isGuest: false,
    }
  })
}

/**
 * 注册 8 个 CopilotKit Actions
 * 必须在 CopilotKitProvider 子组件的 setup 中调用
 */
export function useSlideCopilotActions() {
  const slidesStore = useSlidesStore()
  const toast = useToast()
  const resolvedLlm = useResolvedLlm()

  /* ───────── 1. generateOutline ───────── */
  useFrontendTool({
    name: 'generateOutline',
    description: '根据用户给出的主题生成 Markdown 大纲。返回大纲文本并写入幻灯片 store。',
    parameters: z.object({
      topic: z.string().min(1).describe('演示文稿主题，例如「新能源汽车发布会」'),
      pageCount: z.number().int().min(3).max(20).optional().describe('目标页数（不含封底），默认 8'),
    }),
    handler: async ({ topic, pageCount }) => {
      slidesStore.busy = true
      try {
        const llm = await resolvedLlm.value
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
          systemPrompt: buildOutlineSystemPrompt(),
          userPrompt: `主题：${topic}\n${pageCount ? `页数：${pageCount}` : ''}`,
        })
        slidesStore.setOutline(outline)
        slidesStore.lastMessage = `已生成大纲，共 ${outline.split(/\r?\n/).filter(Boolean).length} 行`
        return { ok: true, outline, message: slidesStore.lastMessage }
      } catch (error) {
        const msg = error?.message || '生成大纲失败'
        slidesStore.lastError = msg
        toast.error(msg)
        return { ok: false, error: msg }
      } finally {
        slidesStore.busy = false
      }
    },
    render: OutlinePreview,
  })

  /* ───────── 2. selectTemplate ───────── */
  useFrontendTool({
    name: 'selectTemplate',
    description: '选择 PPT 模板（business 商务简约 / tech 科技感 / fresh 清新自然 / custom 自定义），同时更新主题色。',
    parameters: z.object({
      templateId: z.enum(['business', 'tech', 'fresh', 'custom']).describe('模板 ID'),
      custom: z.string().optional().describe('当 templateId=custom 时，由用户描述的风格'),
    }),
    handler: async ({ templateId, custom }) => {
      const tpl = slidesStore.setTemplate({ templateId, custom })
      if (!tpl) {
        return { ok: false, error: slidesStore.lastError || '模板选择失败' }
      }
      const message = `已选择模板「${tpl.label}」（主题：${tpl.theme}）`
      slidesStore.lastMessage = message
      toast.success(message)
      return { ok: true, template: tpl, message }
    },
    render: TemplatePicker,
  })

  /* ───────── 3. generateSlides ───────── */
  useFrontendTool({
    name: 'generateSlides',
    description: '把 Markdown 大纲（store.outline 或参数传入）解析为 slides 数组。',
    parameters: z.object({
      outline: z.string().optional().describe('可选：覆盖 store 中的大纲'),
    }),
    handler: async ({ outline }) => {
      slidesStore.busy = true
      try {
        const source = (outline && outline.trim()) || slidesStore.outline
        if (!source || !source.trim()) {
          const msg = '大纲为空，请先调用 generateOutline'
          slidesStore.lastError = msg
          return { ok: false, error: msg }
        }
        const result = outlineToSlides(source, {
          theme: slidesStore.theme,
          autoWrapBoundary: true,
        })
        if (!Array.isArray(result) || result.length === 0) {
          const msg = '大纲解析失败，请检查格式'
          slidesStore.lastError = msg
          return { ok: false, error: msg }
        }
        slidesStore.setSlides(result)
        const message = `已生成 ${result.length} 页幻灯片`
        slidesStore.lastMessage = message
        toast.success(message)
        return { ok: true, total: result.length, message }
      } catch (error) {
        const msg = error?.message || '生成幻灯片失败'
        slidesStore.lastError = msg
        toast.error(msg)
        return { ok: false, error: msg }
      } finally {
        slidesStore.busy = false
      }
    },
    render: SlideSnapshot,
  })

  /* ───────── 4. modifySlide ───────── */
  useFrontendTool({
    name: 'modifySlide',
    description: '修改指定页（0-based index）的内容，changes 会合并到 props。支持 component 字段切换组件类型。',
    parameters: z.object({
      pageIndex: z.number().int().min(0).describe('页码（0 表示第一页 / 封面）'),
      changes: z.object({}).passthrough().describe('要合并到该页 props 的字段，例如 { title, bulletPoints, imageUrl }'),
    }),
    handler: async ({ pageIndex, changes }) => {
      const ok = slidesStore.modifySlide(pageIndex, changes)
      if (!ok) {
        return { ok: false, error: slidesStore.lastError || '修改失败' }
      }
      const message = `已更新第 ${pageIndex + 1} 页`
      slidesStore.lastMessage = message
      toast.success(message)
      return { ok: true, message, total: slidesStore.totalPages }
    },
    render: SlideSnapshot,
  })

  /* ───────── 5. addSlide ───────── */
  useFrontendTool({
    name: 'addSlide',
    description: '在指定位置新增一页。默认在末尾追加。',
    parameters: z.object({
      insertAt: z.number().int().min(-1).optional().describe('插入位置（0-based），-1 表示末尾'),
      component: z.string().optional().describe('组件类型，默认 TextSlide'),
      title: z.string().optional().describe('新页标题'),
      props: z.object({}).passthrough().optional().describe('额外 props'),
    }),
    handler: async ({ insertAt, component, title, props }) => {
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
    render: SlideSnapshot,
  })

  /* ───────── 6. removeSlide ───────── */
  useFrontendTool({
    name: 'removeSlide',
    description: '删除指定页（0-based index）。',
    parameters: z.object({
      pageIndex: z.number().int().min(0).describe('页码（0 表示第一页）'),
    }),
    handler: async ({ pageIndex }) => {
      const ok = slidesStore.removeSlide(pageIndex)
      if (!ok) {
        return { ok: false, error: slidesStore.lastError || '删除失败' }
      }
      const message = `已删除第 ${pageIndex + 1} 页`
      slidesStore.lastMessage = message
      toast.success(message)
      return { ok: true, message, total: slidesStore.totalPages }
    },
    render: SlideSnapshot,
  })

  /* ───────── 7. exportAsHTML ───────── */
  useFrontendTool({
    name: 'exportAsHTML',
    description: '把当前 slides 导出为独立可交互的 HTML 文件（含翻页、键盘导航）。',
    parameters: z.object({
      filename: z.string().optional().describe('下载文件名，默认 slides-<timestamp>.html'),
    }),
    handler: async ({ filename }) => {
      const snapshot = slidesStore.getSlidesSnapshot()
      if (snapshot.length === 0) {
        return { ok: false, error: '当前没有幻灯片可导出，请先生成。' }
      }
      try {
        const result = downloadSlidesAsHtml(snapshot, {
          theme: slidesStore.theme,
          filename,
          title: slidesStore.outline?.split(/\r?\n/)[0]?.replace(/^#\s*/, '') || 'WPX 演示文稿',
        })
        slidesStore.lastMessage = `已导出 HTML：${result.filename}`
        return { ok: true, ...result, message: slidesStore.lastMessage }
      } catch (error) {
        const msg = error?.message || 'HTML 导出失败'
        slidesStore.lastError = msg
        return { ok: false, error: msg }
      }
    },
    render: SlideSnapshot,
  })

  /* ───────── 8. exportAsPPTX ───────── */
  useFrontendTool({
    name: 'exportAsPPTX',
    description: '把当前 slides 导出为 PPTX 文件（基于 pptxgenjs，图表与图片降级为占位）。',
    parameters: z.object({
      filename: z.string().optional().describe('下载文件名，默认 slides-<timestamp>.pptx'),
    }),
    handler: async ({ filename }) => {
      const snapshot = slidesStore.getSlidesSnapshot()
      if (snapshot.length === 0) {
        return { ok: false, error: '当前没有幻灯片可导出，请先生成。' }
      }
      try {
        const result = await downloadSlidesAsPptx(snapshot, {
          theme: slidesStore.theme,
          filename,
          title: slidesStore.outline?.split(/\r?\n/)[0]?.replace(/^#\s*/, '') || 'WPX 演示文稿',
        })
        slidesStore.lastMessage = `已导出 PPTX：${result.filename}`
        return { ok: true, ...result, message: slidesStore.lastMessage }
      } catch (error) {
        const msg = error?.message || 'PPTX 导出失败'
        slidesStore.lastError = msg
        return { ok: false, error: msg }
      }
    },
    render: SlideSnapshot,
  })
}

export default useSlideCopilotActions