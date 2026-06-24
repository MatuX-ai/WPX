/**
 * usePPTWorkflow - PPT 生成的四步流程状态机
 *
 * 设计为**模块级单例**（在文件顶层声明 reactive state），
 * 所有调用 usePPTWorkflow() 的组件共享同一份工作流。
 * 这样 Agent / AiChatWindow / EditorLayout 等任意位置读取到的状态都一致。
 *
 * 四步状态：
 *   STEP_OUTLINE   - 等待大纲生成与确认
 *   STEP_TEMPLATE  - 等待用户选择模板
 *   STEP_GENERATE  - 正在生成幻灯片
 *   STEP_EDITING   - 已生成，用户可继续修改 / 导出
 *
 * 与 AiChatWindow / Agent 的集成方式：
 *   1. 用户说"生成 PPT ..." → startWorkflow(topic) → 状态变 STEP_OUTLINE
 *   2. AiChatWindow 调用 sendChat 时调用 workflow.getSystemPromptAddition()
 *      把"你正在第 1/2/3/4 步，需要调用哪个 Action"追加到系统提示词。
 *   3. Agent 收到带 hint 的提示词后自动调用合适的 Action：
 *        STEP_OUTLINE   → generateOutline
 *        STEP_TEMPLATE  → selectTemplate
 *        STEP_GENERATE  → generateSlides
 *        STEP_EDITING   → modifySlide / addSlide / removeSlide / exportAsHTML / exportAsPPTX
 *   4. 每个 Action 的 handler 已经完成对应状态转移，前端 UI 通过
 *      workflow.state 响应式变化自动更新按钮 / 进度条。
 */
import { computed, reactive, watch } from 'vue'

/* ───────── 状态常量 ───────── */

export const PPT_STEP = Object.freeze({
  OUTLINE: 'STEP_OUTLINE',
  TEMPLATE: 'STEP_TEMPLATE',
  GENERATE: 'STEP_GENERATE',
  EDITING: 'STEP_EDITING',
})

const STEP_ORDER = [PPT_STEP.OUTLINE, PPT_STEP.TEMPLATE, PPT_STEP.GENERATE, PPT_STEP.EDITING]

/* ───────── 模块级单例状态 ───────── */

const initialState = () => ({
  step: PPT_STEP.OUTLINE,
  topic: '',
  outline: '',
  templateId: null,
  templateCustom: '',
  slides: [],
  /** 最近一次错误（供 UI 展示） */
  lastError: '',
  /** 最近一次成功消息 */
  lastMessage: '',
  /** 是否正在生成（细分到当前 step 的等待态） */
  busy: false,
  /** 工作流启动时间戳（用于统计耗时） */
  startedAt: null,
  /** 工作流结束时间戳（= 进入 EDITING 时） */
  completedAt: null,
})

const state = reactive(initialState())

/* ───────── 内部工具 ───────── */

function goToStep(next) {
  if (!STEP_ORDER.includes(next)) {
    throw new Error(`[usePPTWorkflow] 未知状态: ${next}`)
  }
  const prev = state.step
  if (prev === next) return
  state.step = next
  // 完成判定
  if (next === PPT_STEP.EDITING && !state.completedAt) {
    state.completedAt = Date.now()
  }
}

function reset(reason = 'manual') {
  Object.assign(state, initialState())
  state.lastMessage = reason === 'manual' ? '已重置工作流' : `已重置（${reason}）`
}

/* ───────── 暴露给 Agent 的系统提示词片段 ───────── */

/**
 * 把当前 step 编译成 Agent 看得到的中文 hint，
 * 便于 LLM 自动判断下一步该调哪个 Action。
 */
function buildSystemPromptAddition() {
  const lines = []
  lines.push('【PPT 生成工作流】')
  lines.push(`当前步骤：${describeStep(state.step)}（${STEP_ORDER.indexOf(state.step) + 1}/${STEP_ORDER.length}）`)

  switch (state.step) {
    case PPT_STEP.OUTLINE:
      lines.push(`主题：${state.topic || '（未指定）'}`)
      lines.push('下一步：调用 generateOutline Action，把主题传给它，等待用户确认。')
      break
    case PPT_STEP.TEMPLATE:
      lines.push('大纲已确认。')
      lines.push('下一步：调用 selectTemplate Action，传入 templateId（business/tech/fresh/custom）。')
      lines.push('若用户选了 custom，需要同时传 custom 描述。')
      break
    case PPT_STEP.GENERATE:
      lines.push(`已选模板：${state.templateId}${state.templateCustom ? `（${state.templateCustom}）` : ''}`)
      lines.push('下一步：调用 generateSlides Action 即可完成生成，框架会自动进入 STEP_EDITING。')
      break
    case PPT_STEP.EDITING:
      lines.push(`已生成 ${state.slides.length} 页。`)
      lines.push('可调用 modifySlide / addSlide / removeSlide / exportAsHTML / exportAsPPTX。')
      break
  }
  return lines.join('\n')
}

function describeStep(step) {
  switch (step) {
    case PPT_STEP.OUTLINE: return '生成大纲'
    case PPT_STEP.TEMPLATE: return '选择模板'
    case PPT_STEP.GENERATE: return '生成幻灯片'
    case PPT_STEP.EDITING: return '编辑中'
    default: return step
  }
}

/* ───────── Composable ───────── */

/**
 * 任何组件都可以调用，返回单例 + 操作方法
 * @returns {{
 *   state: typeof state,
 *   step: typeof PPT_STEP,
 *   currentStep: ReturnType<typeof computed<() => string>>,
 *   stepIndex: ReturnType<typeof computed<() => number>>,
 *   isBusy: ReturnType<typeof computed<() => boolean>>,
 *   progress: ReturnType<typeof computed<() => number>>,
 *   hasOutline: ReturnType<typeof computed<() => boolean>>,
 *   hasTemplate: ReturnType<typeof computed<() => boolean>>,
 *   hasSlides: ReturnType<typeof computed<() => boolean>>,
 *   startWorkflow: (topic: string) => void,
 *   confirmOutline: (outline?: string) => void,
 *   selectTemplate: (templateId: string, custom?: string) => void,
 *   onSlidesGenerated: (slides: Array<any>) => void,
 *   markBusy: (busy: boolean) => void,
 *   setError: (msg: string) => void,
 *   setMessage: (msg: string) => void,
 *   resetWorkflow: () => void,
 *   getSystemPromptAddition: () => string,
 * }}
 */
export function usePPTWorkflow() {
  return {
    // 暴露只读引用，避免外部直接 state.step = ...
    state,

    // 状态常量
    step: PPT_STEP,

    // 计算属性
    currentStep: computed(() => state.step),
    stepIndex: computed(() => STEP_ORDER.indexOf(state.step)),
    isBusy: computed(() => state.busy),
    progress: computed(() => (STEP_ORDER.indexOf(state.step) + 1) / STEP_ORDER.length),
    hasOutline: computed(() => Boolean(state.outline)),
    hasTemplate: computed(() => Boolean(state.templateId)),
    hasSlides: computed(() => Array.isArray(state.slides) && state.slides.length > 0),

    // ── 流程控制 ──

    /**
     * 用户表达"生成 PPT"意图时调用。
     * @param {string} topic - 用户给出的话题
     */
    startWorkflow(topic) {
      const cleaned = String(topic || '').trim()
      if (!cleaned) {
        state.lastError = '主题不能为空'
        return false
      }
      Object.assign(state, initialState())
      state.topic = cleaned
      state.startedAt = Date.now()
      state.lastMessage = `已开始生成 PPT：${cleaned}`
      state.lastError = ''
      goToStep(PPT_STEP.OUTLINE)
      return true
    },

    /**
     * 用户确认大纲后调用：进入"选择模板"步骤。
     * @param {string} [outline] - 可选地同步大纲原文
     */
    confirmOutline(outline) {
      if (state.step !== PPT_STEP.OUTLINE) {
        // 允许从任意状态强制进入（异常恢复）
        state.topic = state.topic || ''
      }
      if (typeof outline === 'string' && outline.trim()) {
        state.outline = outline
      }
      if (!state.outline) {
        state.lastError = '大纲为空，无法进入下一步'
        return false
      }
      state.lastError = ''
      state.lastMessage = '大纲已确认，请选择模板'
      goToStep(PPT_STEP.TEMPLATE)
      return true
    },

    /**
     * 用户选择模板后调用：进入"生成幻灯片"步骤。
     * @param {string} templateId - business / tech / fresh / custom
     * @param {string} [custom] - 当 templateId=custom 时描述
     */
    selectTemplate(templateId, custom) {
      const allowed = ['business', 'tech', 'fresh', 'custom']
      if (!allowed.includes(templateId)) {
        state.lastError = `不支持的模板: ${templateId}`
        return false
      }
      if (templateId === 'custom' && !custom) {
        state.lastError = 'custom 模板必须提供 custom 描述'
        return false
      }
      state.templateId = templateId
      state.templateCustom = custom || ''
      state.lastError = ''
      state.lastMessage = `已选择模板：${templateId}`
      goToStep(PPT_STEP.GENERATE)
      return true
    },

    /**
     * 幻灯片生成完成时由 generateSlides Action 调用：进入"编辑中"。
     * @param {Array<any>} slides
     */
    onSlidesGenerated(slides) {
      if (!Array.isArray(slides)) {
        state.lastError = 'slides 不是数组'
        return false
      }
      state.slides = slides.slice()
      state.lastError = ''
      state.lastMessage = `已生成 ${slides.length} 页，可继续修改或导出`
      goToStep(PPT_STEP.EDITING)
      return true
    },

    markBusy(busy) {
      state.busy = Boolean(busy)
    },

    setError(msg) {
      state.lastError = String(msg || '')
    },

    setMessage(msg) {
      state.lastMessage = String(msg || '')
    },

    /** 强制重置到初始状态（用户点"重新开始"时调用） */
    resetWorkflow() {
      reset('manual')
    },

    /**
     * 给 Agent 用的系统提示词附加片段。
     * 在 AiChatWindow 组装最终 system prompt 时调用即可。
     */
    getSystemPromptAddition: buildSystemPromptAddition,

    /**
     * 订阅状态变化（每次 step 转移都会触发）。
     * @param {(next: string, prev: string) => void} listener
     * @returns {() => void} 解绑函数
     */
    onStepChange(listener) {
      const stop = watch(
        () => state.step,
        (next, prev) => {
          try {
            listener(next, prev)
          } catch (e) {
            console.error('[usePPTWorkflow] listener error', e)
          }
        },
      )
      return stop
    },
  }
}

export default usePPTWorkflow
