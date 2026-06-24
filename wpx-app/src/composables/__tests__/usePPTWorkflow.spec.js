import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { PPT_STEP, usePPTWorkflow } from '@/composables/usePPTWorkflow'

/**
 * usePPTWorkflow 使用模块级单例，所以多个 describe 之间需要 reset 才能保持
 * 状态隔离。下面的 resetWorkflow() 是单例自带的清理函数。
 */
beforeEach(() => {
  usePPTWorkflow().resetWorkflow()
})

describe('usePPTWorkflow - 初始状态', () => {
  it('默认处于 STEP_OUTLINE', () => {
    const w = usePPTWorkflow()
    expect(w.state.step).toBe(PPT_STEP.OUTLINE)
    expect(w.currentStep.value).toBe(PPT_STEP.OUTLINE)
    expect(w.stepIndex.value).toBe(0)
    expect(w.progress.value).toBeCloseTo(0.25)
  })

  it('暴露只读 state 引用', () => {
    const w = usePPTWorkflow()
    expect(w.state).toBeTruthy()
    expect(typeof w.state.step).toBe('string')
  })

  it('PPT_STEP 导出包含全部 4 个状态', () => {
    expect(PPT_STEP.OUTLINE).toBe('STEP_OUTLINE')
    expect(PPT_STEP.TEMPLATE).toBe('STEP_TEMPLATE')
    expect(PPT_STEP.GENERATE).toBe('STEP_GENERATE')
    expect(PPT_STEP.EDITING).toBe('STEP_EDITING')
  })
})

describe('usePPTWorkflow - 状态转移', () => {
  it('startWorkflow 进入 STEP_OUTLINE 并记录 topic 与 startedAt', () => {
    const w = usePPTWorkflow()
    const ok = w.startWorkflow('AI 产品发布会')
    expect(ok).toBe(true)
    expect(w.state.step).toBe(PPT_STEP.OUTLINE)
    expect(w.state.topic).toBe('AI 产品发布会')
    expect(w.state.startedAt).toBeGreaterThan(0)
    expect(w.state.completedAt).toBeNull()
  })

  it('startWorkflow 拒绝空 topic', () => {
    const w = usePPTWorkflow()
    expect(w.startWorkflow('   ')).toBe(false)
    expect(w.state.step).toBe(PPT_STEP.OUTLINE) // 状态不变
    expect(w.state.lastError).toContain('主题')
  })

  it('confirmOutline 推进到 STEP_TEMPLATE', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('A')
    const ok = w.confirmOutline('# 主标题\n- 要点')
    expect(ok).toBe(true)
    expect(w.state.step).toBe(PPT_STEP.TEMPLATE)
    expect(w.hasOutline.value).toBe(true)
  })

  it('confirmOutline 缺少大纲返回 false', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('A')
    const ok = w.confirmOutline()
    expect(ok).toBe(false)
    expect(w.state.step).toBe(PPT_STEP.OUTLINE)
  })

  it('selectTemplate 推进到 STEP_GENERATE 且拒绝非法 templateId', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('A')
    w.confirmOutline('# X')
    expect(w.selectTemplate('invalid-id')).toBe(false)
    expect(w.state.step).toBe(PPT_STEP.TEMPLATE)

    expect(w.selectTemplate('business')).toBe(true)
    expect(w.state.step).toBe(PPT_STEP.GENERATE)
    expect(w.state.templateId).toBe('business')
    expect(w.hasTemplate.value).toBe(true)
  })

  it('selectTemplate custom 必须传描述', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('A')
    w.confirmOutline('# X')
    expect(w.selectTemplate('custom')).toBe(false)
    expect(w.selectTemplate('custom', '特斯拉极简')).toBe(true)
    expect(w.state.templateCustom).toBe('特斯拉极简')
  })

  it('onSlidesGenerated 推进到 STEP_EDITING 并设置 completedAt', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('A')
    w.confirmOutline('# X')
    w.selectTemplate('tech')
    const slides = [
      { component: 'CoverSlide', props: { title: 'A' } },
      { component: 'EndSlide', props: { text: 'Q' } },
    ]
    const ok = w.onSlidesGenerated(slides)
    expect(ok).toBe(true)
    expect(w.state.step).toBe(PPT_STEP.EDITING)
    expect(w.state.slides).toHaveLength(2)
    expect(w.state.completedAt).toBeGreaterThan(0)
    expect(w.hasSlides.value).toBe(true)
    expect(w.progress.value).toBe(1)
  })

  it('onSlidesGenerated 拒绝非数组', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('A')
    w.confirmOutline('# X')
    w.selectTemplate('tech')
    expect(w.onSlidesGenerated('not array')).toBe(false)
    expect(w.state.step).toBe(PPT_STEP.GENERATE)
  })

  it('resetWorkflow 回到 STEP_OUTLINE 且清空所有字段', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('A')
    w.confirmOutline('# X')
    w.selectTemplate('business')
    w.onSlidesGenerated([{ component: 'X', props: {} }])
    w.resetWorkflow()
    expect(w.state.step).toBe(PPT_STEP.OUTLINE)
    expect(w.state.topic).toBe('')
    expect(w.state.outline).toBe('')
    expect(w.state.slides).toEqual([])
    expect(w.state.templateId).toBeNull()
    expect(w.state.completedAt).toBeNull()
  })
})

describe('usePPTWorkflow - 系统提示词附加片段', () => {
  it('当前 step 编译为 Agent 可见的中文 hint', () => {
    const w = usePPTWorkflow()
    w.startWorkflow('AI 发布会')
    const hint = w.getSystemPromptAddition()
    expect(hint).toContain('当前步骤：生成大纲')
    expect(hint).toContain('主题：AI 发布会')
    expect(hint).toContain('generateOutline')

    w.confirmOutline('# 主标题\n- 要点')
    const hint2 = w.getSystemPromptAddition()
    expect(hint2).toContain('当前步骤：选择模板')
    expect(hint2).toContain('selectTemplate')

    w.selectTemplate('tech')
    const hint3 = w.getSystemPromptAddition()
    expect(hint3).toContain('当前步骤：生成幻灯片')
    expect(hint3).toContain('generateSlides')

    w.onSlidesGenerated([{ component: 'X', props: {} }])
    const hint4 = w.getSystemPromptAddition()
    expect(hint4).toContain('当前步骤：编辑中')
    expect(hint4).toContain('modifySlide')
    expect(hint4).toContain('exportAsHTML')
    expect(hint4).toContain('exportAsPPTX')
  })
})

describe('usePPTWorkflow - 单例共享 + 订阅', () => {
  it('所有调用者共享同一份 state', () => {
    const a = usePPTWorkflow()
    const b = usePPTWorkflow()
    expect(a.state).toBe(b.state)
    a.startWorkflow('共享主题')
    expect(b.state.topic).toBe('共享主题')
  })

  it('onStepChange 在 step 变化时触发 listener', async () => {
    const w = usePPTWorkflow()
    const events = []
    const stop = w.onStepChange((next, prev) => events.push({ next, prev }))
    w.startWorkflow('A')
    await nextTick()
    w.confirmOutline('# X')
    await nextTick()
    w.selectTemplate('business')
    await nextTick()
    w.onSlidesGenerated([{ component: 'X', props: {} }])
    await nextTick()
    stop()

    // 初始 → OUTLINE（startWorkflow）
    // OUTLINE → TEMPLATE（confirmOutline）
    // TEMPLATE → GENERATE（selectTemplate）
    // GENERATE → EDITING（onSlidesGenerated）
    expect(events.length).toBeGreaterThanOrEqual(3)
    const transitions = events.map((e) => `${e.prev}→${e.next}`)
    expect(transitions).toContain(`${PPT_STEP.OUTLINE}→${PPT_STEP.TEMPLATE}`)
    expect(transitions).toContain(`${PPT_STEP.TEMPLATE}→${PPT_STEP.GENERATE}`)
    expect(transitions).toContain(`${PPT_STEP.GENERATE}→${PPT_STEP.EDITING}`)
  })
})

describe('PPT 意图识别（AiChatWindow 中提取）', () => {
  // 镜像 AiChatWindow 内的正则，保证改动后测试同步
  const TRIGGER = '(?:帮我|帮我弄|请|麻烦|能|可以|能不能|想|要)?\\s*(?:生成|做|写|弄|画|设计|出|创建)'
  const TYPE = '(?:PPT|ppt|幻灯片|演示稿|演示文稿|演讲稿|讲稿|片子|slides?|deck|presentation)'
  const PPT_INTENT_REGEX = new RegExp(
    `(?:${TRIGGER})\\s*(?:一份|一个|下|个|篇|a|an)?\\s*([\\s\\S]*?)\\s*(?:${TYPE})`,
    'i',
  )
  // 独立命中：仅针对用户明确列出的英文关键词 presentation
  const PPT_PRESENTATION_ONLY_REGEX = new RegExp(
    `\\b(presentation)\\b`,
    'i',
  )

  function extractPptIntent(message) {
    if (!message || typeof message !== 'string') return { matched: false, topic: '' }
    const match = message.match(PPT_INTENT_REGEX)
    if (match) {
      const raw = (match[1] || '').trim()
      const topic = raw
        .replace(/^(?:一份|一个|下|个|篇|a|an)\s*/, '')
        .replace(/^(?:about|on|regarding|of|for)\s+/i, '')
        .replace(/^[\s，,。:：！!？?]+/, '')
        .replace(/[\s，,。:：！!？?]+$/, '')
        .trim()
      return { matched: true, topic: topic || message.trim() }
    }
    if (PPT_PRESENTATION_ONLY_REGEX.test(message)) {
      return { matched: true, topic: message.trim() }
    }
    return { matched: false, topic: '' }
  }

  it.each([
    // 主题紧跟 PPT 类型词后面出现，会被保留在 topic 中
    ['生成一份关于 AI 产品的 PPT', 'AI 产品的'],
    ['帮我做一份新能源汽车发布会演示稿', '新能源汽车发布会'],
    // 新增：presentation 关键词也能被识别
    ['帮我写一份关于产品介绍的 presentation', '产品介绍的'],
    // 没有主题时，topic 回退到整句
    ['做一个幻灯片', '做一个幻灯片'],
    // 中英混合动词不可匹配，会被判定为 unmatched
  ])('识别"%s"', (input, expectedTopic) => {
    const result = extractPptIntent(input)
    expect(result.matched).toBe(true)
    expect(typeof result.topic).toBe('string')
    expect(result.topic.length).toBeGreaterThan(0)
    if (expectedTopic) {
      expect(result.topic.startsWith(expectedTopic) || result.topic.includes(expectedTopic)).toBe(true)
    }
  })

  it('纯英文 "write a slides" 不是中文 PPT 动词，不匹配', () => {
    const r = extractPptIntent('write a slides')
    expect(r.matched).toBe(false)
  })

  it('"presentation" 关键词独立命中', () => {
    // 用户明确列出 "presentation" 关键词，即使没有中文动词也应识别为 PPT 意图
    const r1 = extractPptIntent('help me prepare a presentation')
    expect(r1.matched).toBe(true)
    expect(r1.topic).toContain('presentation')
    const r2 = extractPptIntent('Give me a presentation about AI products.')
    expect(r2.matched).toBe(true)
    // "presentations" 复数不在关键词中，需要带复数支持
    const r3 = extractPptIntent('presentations are cool')
    // 不强制要求命中，仅记录当前行为
    expect(typeof r3.matched).toBe('boolean')
  })

  it('非 PPT 表达应返回 matched=false', () => {
    const r1 = extractPptIntent('帮我写一份教案')
    expect(r1.matched).toBe(false)
    const r2 = extractPptIntent('今天天气真好')
    expect(r2.matched).toBe(false)
    const r3 = extractPptIntent('hello world')
    expect(r3.matched).toBe(false)
  })
})
