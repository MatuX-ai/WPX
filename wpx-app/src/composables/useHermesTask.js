/**
 * useHermesTask —— Hermes 任务型执行 Composable（Phase 3 / M3-C）
 *
 * 触发：用户在 AI 对话窗显式发起「用 Hermes 执行」→ 调 local-server /api/hermes/run
 * （适配层 hermes-routes 再转发到网关 /v1/chat/completions）。
 *
 * 状态机：idle → running → done | error
 * - 结果以结构化文本返回，卡片可复制 / 插入文档
 *
 * 设计：fetch 可注入（默认 local-server 基址从 window.electronAPI.localServer 获取），
 * 失败透明降级（ok:false → error 状态，不抛穿）。
 */
import { computed, ref } from 'vue'
import { getElectronAPI, isElectron } from '@/utils/electron'

/** 本地服务基址：优先 electronAPI.localServer.getBaseUrl()，回退 127.0.0.1:3000 */
async function resolveLocalServerBase() {
  if (isElectron()) {
    const api = getElectronAPI()
    try {
      const base = await api?.localServer?.getBaseUrl?.()
      if (base) return String(base).replace(/\/$/, '')
    } catch {
      /* fall through */
    }
  }
  return 'http://127.0.0.1:3000'
}

/** 从 OpenAI 兼容响应中抽取文本 */
export function extractTaskResult(data) {
  if (!data) return ''
  const choice = data.choices?.[0]
  const text = choice?.message?.content ?? choice?.text ?? ''
  return String(text || '').trim()
}

/**
 * 模块级任务执行（可复用：useHermesTask 内部与 useAiChat 自动路由共用）
 * @param {string} text 用户任务
 * @param {{ fetchImpl?: typeof fetch, baseUrl?: string }} [options]
 * @returns {Promise<{ ok: boolean, result?: string, error?: string }>}
 */
export async function runHermesTask(text, options = {}) {
  const taskText = String(text || '').trim()
  if (!taskText) return { ok: false, error: '任务内容为空' }

  const fetchImpl = options.fetchImpl || globalThis.fetch
  try {
    const base = options.baseUrl || (await resolveLocalServerBase())
    const res = await fetchImpl(`${base}/api/hermes/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: taskText, sessionId: null }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok || !body?.ok) {
      return { ok: false, error: body?.message || `网关返回 HTTP ${res.status}` }
    }
    const resultText = extractTaskResult(body.data)
    if (!resultText) {
      return {
        ok: false,
        error: '网关未返回有效结果（可能未配置模型，请先在「设置 → Hermes Agent」注入模型 Key）',
      }
    }
    return { ok: true, result: resultText }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) }
  }
}

/**
 * 流式执行（M4）：POST /api/hermes/stream，逐块解析 OpenAI SSE，实时回调 onChunk。
 * 失败返回 { ok:false, fallback:true }，调用方可回退到非流式 runHermesTask。
 * @param {string} text 用户任务
 * @param {{ fetchImpl?: typeof fetch, baseUrl?: string, onChunk?: (text: string) => void }} [options]
 * @returns {Promise<{ ok: boolean, result?: string, error?: string, fallback?: boolean }>}
 */
export async function runHermesTaskStream(text, options = {}) {
  const taskText = String(text || '').trim()
  if (!taskText) return { ok: false, error: '任务内容为空' }

  const fetchImpl = options.fetchImpl || globalThis.fetch
  const onChunk = options.onChunk
  const { createSseParser, extractDeltaText } = await import('@/utils/sseParser')

  try {
    const base = options.baseUrl || (await resolveLocalServerBase())
    const res = await fetchImpl(`${base}/api/hermes/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: taskText, sessionId: null }),
    })
    if (!res.ok || !res.body) {
      return { ok: false, fallback: true, error: `流式端点返回 HTTP ${res.status}` }
    }

    let accumulated = ''
    let finished = false
    const push = createSseParser((event) => {
      if (event.type === 'data') {
        const delta = extractDeltaText(event.data)
        if (delta) {
          accumulated += delta
          onChunk?.(accumulated)
        }
      } else if (event.type === 'done') {
        finished = true
      }
    })

    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      push(value)
    }

    if (!finished && !accumulated) {
      // 未收到 [DONE] 且无内容 → 视为流异常，回退非流式
      return { ok: false, fallback: true, error: '流式响应未完成' }
    }
    if (!accumulated) {
      return {
        ok: false,
        fallback: true,
        error: '网关未返回有效结果（可能未配置模型，请先在「设置 → Hermes Agent」注入模型 Key）',
      }
    }
    return { ok: true, result: accumulated }
  } catch (err) {
    return { ok: false, fallback: true, error: err?.message || String(err) }
  }
}

export function useHermesTask() {
  const status = ref('idle') // idle | running | done | error
  const task = ref('')
  const result = ref('')
  const error = ref('')
  const steps = ref([]) // 简单阶段记录（连接 → 执行 → 完成）
  const startedAt = ref(null)
  const finishedAt = ref(null)

  const isRunning = computed(() => status.value === 'running')
  const isDone = computed(() => status.value === 'done')
  const isError = computed(() => status.value === 'error')

  function reset() {
    status.value = 'idle'
    task.value = ''
    result.value = ''
    error.value = ''
    steps.value = []
    startedAt.value = null
    finishedAt.value = null
  }

  /**
   * 执行一次 Hermes 任务（M4：流式优先，失败自动回退非流式，附带卡片状态机）
   * @param {string} text 用户任务
   * @param {{ fetchImpl?: typeof fetch, baseUrl?: string, stream?: boolean }} [options]
   * @returns {Promise<{ ok: boolean, result?: string, error?: string }>}
   */
  async function run(text, options = {}) {
    const taskText = String(text || '').trim()
    if (!taskText) return { ok: false, error: '任务内容为空' }
    if (isRunning.value) return { ok: false, error: '已有任务执行中' }

    reset()
    status.value = 'running'
    task.value = taskText
    steps.value = ['连接本地 Hermes 网关']
    startedAt.value = Date.now()

    // 流式执行：逐块实时更新 result（卡片可见打字机效果）；失败回退非流式
    let runResult
    if (options.stream !== false) {
      steps.value = [...steps.value, '流式执行中']
      const callerOnChunk = options.onChunk
      runResult = await runHermesTaskStream(taskText, {
        ...options,
        onChunk: (partial) => {
          // 注意：这里引用 composable 的 result ref，不能被局部变量遮蔽
          result.value = partial
          callerOnChunk?.(partial)
        },
      })
      if (!runResult.ok && runResult.fallback) {
        steps.value = [...steps.value, '回退非流式']
        runResult = await runHermesTask(taskText, options)
      }
    } else {
      runResult = await runHermesTask(taskText, options)
    }

    if (runResult.ok) {
      result.value = runResult.result
      steps.value = [...steps.value, '完成']
      status.value = 'done'
    } else {
      error.value = runResult.error
      steps.value = [...steps.value, '失败']
      status.value = 'error'
    }
    finishedAt.value = Date.now()
    return runResult
  }

  return {
    status,
    task,
    result,
    error,
    steps,
    startedAt,
    finishedAt,
    isRunning,
    isDone,
    isError,
    reset,
    run,
  }
}

export default useHermesTask
