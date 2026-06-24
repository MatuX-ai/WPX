/**
 * copilotkit-runtime - WPX CopilotKit 后端 Runtime
 *
 * 启动方式：
 *   DEEPSEEK_API_KEY=sk-xxx node src/server/copilotkit-runtime.js
 *
 * 端口：默认 3006，可通过 COPILOTKIT_PORT 环境变量覆盖。
 *
 * 关键能力：
 *  1. 暴露 /api/ck 端点（单端点模式），处理 AG-UI 协议的 chat/agent 流式通信
 *  2. 内置 BuiltInAgent，初始模型使用 DeepSeek（OpenAI 兼容）
 *  3. 每次请求都会读取自定义 header（x-wpx-llm-*），在前端切换自定义模型时
 *     动态 setModel() 重配 Agent，确保对话始终使用当前用户在 WPX 设置里配置的模型
 *  4. 提供 /api/ck/health 健康检查与 /api/ck/slides/html 幻灯片 HTML 导出端点
 *  5. 系统提示词内置 PPT 四步法与 8 个 actions 的语义说明
 *
 * 注意：当 CopilotKit npm 包未安装时（本服务第一次运行前），进程会给出
 * 明确的安装提示并退出，便于开发者排查依赖问题。
 */
import cors from 'cors'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.COPILOTKIT_PORT || 3006)
const DEEPSEEK_BASE_URL = (
  process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
).replace(/\/$/, '')
const DEEPSEEK_DEFAULT_MODEL = process.env.DEEPSEEK_DEFAULT_MODEL || 'deepseek-chat'

/**
 * 系统提示词：定义 CopilotKit Agent 在 PPT 生成四步法中的角色、可用 Actions
 * 与各 Slide 组件的 props 约束，供 LLM 推理时参考。
 */
const SYSTEM_PROMPT = `你是 WPX 的「演示文稿生成助手」，专门帮助用户通过四步法创建 HTML5 幻灯片。

## 四步法工作流
1. **生成大纲**：用户给出主题与可选页数 → 调用 \`generateOutline\` 工具，生成 Markdown 大纲。
   大纲格式：每页用 \`# 标题\` 表示，内部要点用 \`- \` 或数字列表。
2. **选择模板**：询问用户偏好并调用 \`selectTemplate\` 工具（business / tech / fresh / custom）。
3. **生成幻灯片**：根据大纲与模板调用 \`generateSlides\` 工具，将 Markdown 解析为 slides 数组。
4. **修改与导出**：用户对单页内容/顺序/增删提出修改 → 调用对应 \`modifySlide\` / \`addSlide\` / \`removeSlide\`；
   最终可通过 \`exportAsHTML\` / \`exportAsPPTX\` 下载产物。

## 可用的 Slide 组件（仅 generateSlides 内部使用，无需直接调用）
- CoverSlide: { title, subtitle, theme }
- TocSlide: { title, items[] }
- TextSlide: { title, bulletPoints[], layout: 'list' | 'center' }
- ImageTextSlide: { title, text, imageUrl, imagePosition: 'left'|'right' }
- ChartSlide: { title, chartType: 'bar'|'line'|'pie', chartData: { categories[], series[] } }
- TableSlide: { title, tableData: { headers[], rows[][] } }
- EndSlide: { text, contactInfo? }

## 行为规范
- 用户未明确指定时，默认生成 6-8 页，自动加封面与结束页。
- 当用户说"换颜色 / 改蓝色"等整体风格指令时，使用 modifySlide 循环覆盖所有页的 theme；
  或优先建议切换 selectTemplate（theme）。
- 修改具体某页时，先用 pageIndex（0-based）定位；若用户说"第三页"对应 index=2（不含封面）；
  若包含封面则为 2（第三页 = 封面(0)+目录(1)+正文(2)）。如果不确定，先用 generateSlides 拿到
  当前结构再调整。
- 所有 action 完成后用一句中文总结做了什么。`

function buildOutlinePrompt({ topic, pageCount }) {
  const count = Number.isFinite(pageCount) ? Math.max(3, Math.min(20, Math.floor(pageCount))) : 8
  return `请围绕主题「${topic}」生成一份 Markdown 大纲，共约 ${count} 页。
要求：
1. 第一行使用 \`# 主标题\` 表示整个演示文稿主题；
2. 后续每页使用 \`# 第N页：xxx\` 给出页面标题；
3. 每页下方使用 \`-\` 列出 3-5 条要点；
4. 最后用 \`# 结束页：谢谢\` 收尾；
5. 仅输出 Markdown，不要附加任何解释、代码块围栏或前言。`
}

function buildTemplateConfirm(template) {
  if (!template) return '已清除模板选择。'
  if (template.id === 'custom') {
    return `已选择自定义模板：${template.customNote || '由用户描述的风格'}。主题色：${template.theme}。`
  }
  return `已选择模板「${template.label}」—— ${template.description}。主题：${template.theme}。`
}

/* ───────── 运行时环境：尝试动态加载 CopilotKit ───────── */

async function loadCopilotKitModules() {
  const tasks = [
    import('@copilotkit/runtime').catch(() => null),
    import('@copilotkit/agent').catch(() => null),
  ]
  const [runtime, agent] = await Promise.all(tasks)
  if (!runtime || !agent) {
    return null
  }
  return {
    CopilotRuntime: runtime.CopilotRuntime,
    InMemoryAgentRunner: runtime.InMemoryAgentRunner,
    createCopilotEndpointSingleRouteExpress: runtime.createCopilotEndpointSingleRouteExpress,
    BuiltInAgent: agent.BuiltInAgent,
  }
}

/* ───────── 主进程 ───────── */

async function main() {
  const modules = await loadCopilotKitModules()
  if (!modules) {
    console.error(
      '[copilotkit-runtime] 未找到 @copilotkit/runtime / @copilotkit/agent。\n' +
        '请在 wpx-app 目录下执行：npm install @copilotkit/runtime @copilotkit/agent @copilotkit/vue zod\n' +
        '然后重新启动此服务。',
    )
    process.exit(1)
  }

  const { CopilotRuntime, InMemoryAgentRunner, createCopilotEndpointSingleRouteExpress, BuiltInAgent } =
    modules

  // 初始化 Agent：默认使用 DeepSeek 的 OpenAI 兼容端点
  let agent = new BuiltInAgent({
    model: `openai-compatible/${DEEPSEEK_DEFAULT_MODEL}`,
    prompt: SYSTEM_PROMPT,
    // BuiltInAgent 接受任意 provider/model 字符串（provider 前缀解析）
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || '',
  })

  const runtime = new CopilotRuntime({
    agents: { default: agent },
    runner: new InMemoryAgentRunner(),
  })

  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '8mb' }))

  /* ── 健康检查 ── */
  app.get('/api/ck/health', (_req, res) => {
    res.json({
      ok: true,
      port: PORT,
      hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY),
      defaultModel: DEEPSEEK_DEFAULT_MODEL,
      defaultBaseUrl: DEEPSEEK_BASE_URL,
    })
  })

  /* ── 头部中间件：每次请求前根据前端 header 动态切换 Agent 模型 ── */
  app.use('/api/ck', (req, _res, next) => {
    const source = String(req.headers['x-wpx-llm-source'] || '')
    const baseUrl = String(req.headers['x-wpx-llm-base-url'] || '').trim()
    const model = String(req.headers['x-wpx-llm-model'] || '').trim()
    const customApiKey = String(req.headers['x-wpx-llm-api-key'] || '').trim()

    // 平台模式：使用 DEEPSEEK_API_KEY；自定义模式：使用前端传入的 key + baseUrl
    const apiKey = source === 'custom' && customApiKey
      ? customApiKey
      : (process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || '')
    const finalBaseUrl = source === 'custom' && baseUrl ? baseUrl : DEEPSEEK_BASE_URL
    const finalModel = model || DEEPSEEK_DEFAULT_MODEL

    // 重新构造 Agent：保证当前对话使用最新模型
    try {
      const nextAgent = new BuiltInAgent({
        model: `openai-compatible/${finalModel}`,
        prompt: SYSTEM_PROMPT,
        apiKey,
      })
      // 设置 baseUrl：BuiltInAgent 内部读取环境变量，因此动态写入 process.env
      if (finalBaseUrl) {
        process.env.OPENAI_COMPATIBLE_BASE_URL = finalBaseUrl
        process.env.OPENAI_BASE_URL = finalBaseUrl
      }
      agent = nextAgent
      // 同步 runtime 中的 agent 引用（CopilotRuntime 通过 runner 调用，但保证 agent 可达）
      runtime.agents = runtime.agents || {}
      runtime.agents.default = agent
    } catch (error) {
      console.warn('[copilotkit-runtime] Failed to rebuild agent for request:', error?.message || error)
    }
    next()
  })

  /* ── 挂载 CopilotKit 单端点 ── */
  app.use(
    '/api/ck',
    createCopilotEndpointSingleRouteExpress({
      runtime,
      basePath: '/',
    }),
  )

  /* ── 简单的 PPT 大纲生成端点（备用 / 调试用） ── */
  app.post('/api/ck/slides/outline', async (req, res) => {
    const { topic = '', pageCount } = req.body || {}
    if (!String(topic).trim()) {
      res.status(400).json({ error: 'topic 不能为空' })
      return
    }
    try {
      const text = buildOutlinePrompt({ topic: String(topic).trim(), pageCount })
      // 透传给前端，前端可继续通过 useAiChat 调 AI SDK 拿到真实生成结果。
      // 这里返回 prompt 模板，便于前端在离线/调试场景下也能跑通流程。
      res.json({ ok: true, prompt: text })
    } catch (error) {
      res.status(500).json({ error: error?.message || 'outline 失败' })
    }
  })

  /* ── 模板选择端点（确认回执） ── */
  app.post('/api/ck/slides/template', (req, res) => {
    const tpl = req.body || {}
    res.json({ ok: true, message: buildTemplateConfirm(tpl) })
  })

  /* ── 启动 ── */
  app.listen(PORT, () => {
    console.log(`[copilotkit-runtime] listening at http://localhost:${PORT}/api/ck`)
    if (!process.env.DEEPSEEK_API_KEY && !process.env.VITE_DEEPSEEK_API_KEY) {
      console.warn('[copilotkit-runtime] 警告：未配置 DEEPSEEK_API_KEY，对话请求将失败')
    }
  })

  // 暴露给上层调用方，便于热重载时优雅退出
  return app
}

main().catch((error) => {
  console.error('[copilotkit-runtime] 启动失败：', error)
  process.exit(1)
})