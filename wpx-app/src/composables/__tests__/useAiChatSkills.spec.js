import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSkillsStore } from '@/stores/skills'
import { useSkillExecutor } from '@/composables/useSkillExecutor'

// ── Module-level mocks (same pattern as useAiChat.spec.js) ────────────
const mockSendMessage = vi.fn()
const mockChatInstance = {
  messages: [],
  status: 'ready',
  sendMessage: mockSendMessage,
}

vi.mock('@ai-sdk/vue', () => ({
  Chat: vi.fn(function Chat() {
    return mockChatInstance
  }),
}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => (model) => model),
}))

vi.mock('ai', () => ({
  DirectChatTransport: vi.fn(function DirectChatTransport() {}),
  ToolLoopAgent: vi.fn(function ToolLoopAgent(config) {
    return { config }
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn() }),
}))

const mockCheckFreeQuota = vi.fn()
const mockConsumeFreeQuotaTokens = vi.fn()

vi.mock('@/utils/freeQuota', () => ({
  checkFreeQuota: (...args) => mockCheckFreeQuota(...args),
  consumeFreeQuotaTokens: (...args) => mockConsumeFreeQuotaTokens(...args),
  resolveUsageTokens: (usage) => Number(usage?.totalTokens) || 1,
  FREE_QUOTA_EXHAUSTED: 'FREE_QUOTA_EXHAUSTED',
  FreeQuotaExhaustedError: class FreeQuotaExhaustedError extends Error {
    constructor(details = {}) {
      super('免费 Token 额度已用完')
      this.name = 'FreeQuotaExhaustedError'
      this.code = 'FREE_QUOTA_EXHAUSTED'
      this.details = details
    }
  },
}))

// ═══════════════════════════════════════════════════════════════════════
// useSkillExecutor — 纯函数测试（不依赖 Pinia 或 AI SDK）
// ═══════════════════════════════════════════════════════════════════════
describe('useSkillExecutor — 匹配与 Prompt 组装', () => {
  let executor

  beforeEach(() => {
    vi.clearAllMocks()
    executor = useSkillExecutor()
  })

  // ── TEST 1: matchSkillByIntent 匹配 ──────────
  it('"帮我写一份教案生成器" 隐式匹配教案生成器 (lesson-plan-generator)', () => {
    const matchedId = executor.matchSkillByIntent('帮我写一份教案生成器')
    expect(matchedId).toBe('lesson-plan-generator')
  })

  it('"论文大纲" 匹配 college 分类的论文大纲 (paper-outline)', () => {
    const matchedId = executor.matchSkillByIntent('论文大纲')
    expect(matchedId).toBe('paper-outline')
  })

  // ── TEST 5: 未匹配 → 返回 null ──────────────
  it('"你今天怎么样" 未匹配任何 Skill 返回 null', () => {
    const matchedId = executor.matchSkillByIntent('你今天怎么样')
    expect(matchedId).toBeNull()
  })

  it('空字符串 / null 返回 null', () => {
    expect(executor.matchSkillByIntent('')).toBeNull()
    expect(executor.matchSkillByIntent(null)).toBeNull()
  })

  // ── TEST: 避免数学/复习等无关主题误中作文批改等 Skill ──
  it('"帮我写一个人教版高一期末数学复习大纲" 不匹配任何 Skill（不误中作文批改）', () => {
    // 这是回归测试：原 bug 是用户输入数学复习大纲，但出现了作文批改表单
    // 原因：「大纲」是多个 Skill 名称的一部分，阈值过低时会造成偶然命中
    const matchedId = executor.matchSkillByIntent('帮我写一个人教版高一期末数学复习大纲')
    expect(matchedId).toBeNull()
  })

  it('"帮我写一份期末复习计划" 不匹配任何 Skill', () => {
    const matchedId = executor.matchSkillByIntent('帮我写一份期末复习计划')
    expect(matchedId).toBeNull()
  })

  it('"帮我出一份高一数学试卷" 不匹配任何 Skill（避免误中智能组卷）', () => {
    // 「试卷」在智能组卷描述中出现，但用户表达不清，不足以触发表单
    const matchedId = executor.matchSkillByIntent('帮我出一份高一数学试卷')
    expect(matchedId).toBeNull()
  })

  it('"教高中语文" 不匹配任何 Skill', () => {
    // 「高中语文」与多个教师 Skill 相关，但表达太模糊，不足以触发表单
    const matchedId = executor.matchSkillByIntent('教高中语文')
    expect(matchedId).toBeNull()
  })

  // ── TEST 3: parseSkillCommand 手动指定 ──────
  it('"用教案生成器，数学，人教版" parseSkillCommand 匹配教案生成器', () => {
    const result = executor.parseSkillCommand('用教案生成器，数学，人教版')
    expect(result.matched).toBe(true)
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].skillId).toBe('lesson-plan-generator')
    expect(result.skillKeyword).toBe('教案生成器')
    // paramText 保留 keyword 后的原始内容（含前导分隔符）
    expect(result.paramText).toBe('，数学，人教版')
  })

  it('"用智能组卷，高等数学，10道题" parseSkillCommand 匹配智能组卷', () => {
    const result = executor.parseSkillCommand('用智能组卷，高等数学，10道题')
    expect(result.matched).toBe(true)
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].skillId).toBe('smart-quiz-generator')
    expect(result.paramText).toBe('，高等数学，10道题')
  })

  it('"帮我用论文大纲" parseSkillCommand 匹配论文大纲', () => {
    const result = executor.parseSkillCommand('帮我用论文大纲')
    expect(result.matched).toBe(true)
    expect(result.candidates[0].skillId).toBe('paper-outline')
  })

  it('无触发前缀的文本返回未匹配', () => {
    const result = executor.parseSkillCommand('写一份教案')
    expect(result.matched).toBe(false)
    expect(result.candidates).toHaveLength(0)
  })

  // ── extractParamsFromText ────────────────────
  it('extractParamsFromText 按顺序填充参数', () => {
    const schema = {
      subject: { label: '学科' },
      grade: { label: '年级' },
    }
    const params = executor.extractParamsFromText('数学，七年级', schema)
    expect(params).toEqual({ subject: '数学', grade: '七年级' })
  })

  it('extractParamsFromText 支持"label是value"键值对', () => {
    const schema = {
      subject: { label: '学科' },
      topic: { label: '课题' },
    }
    const params = executor.extractParamsFromText('学科是数学，课题是一元一次方程', schema)
    expect(params).toEqual({ subject: '数学', topic: '一元一次方程' })
  })

  // ── TEST 6: Prompt 组装（断网可用，纯本地替换）──
  it('executeSkillLenient 填充完整参数生成结构化 Prompt（断网可用）', () => {
    const result = executor.executeSkillLenient('lesson-plan-generator', {
      subject: '数学',
      textbook_version: '人教版',
      topic: '一元一次方程',
      duration: 45,
      grade: '七年级',
    })
    expect(result.prompt).toContain('数学')
    expect(result.prompt).toContain('人教版')
    expect(result.prompt).toContain('一元一次方程')
    expect(result.prompt).toContain('45')
    expect(result.prompt).toContain('七年级')
    // 教案结构关键字
    expect(result.prompt).toContain('教学目标')
    expect(result.prompt).toContain('教学重点与难点')
    expect(result.prompt).toContain('教学过程')
  })

  it('executeSkill 缺少参数时返回 missingFields', () => {
    const result = executor.executeSkill('lesson-plan-generator', {
      subject: '数学',
    })
    expect(result.missingFields).toBeDefined()
    expect(result.missingFields.length).toBeGreaterThan(0)
    expect(result.prompt).toBeUndefined()
  })

  it('executeSkillLenient 缺失参数时保留占位符仍返回 prompt', () => {
    const result = executor.executeSkillLenient('lesson-plan-generator', {
      subject: '数学',
      topic: '一元一次方程',
    })
    expect(result.prompt).toBeDefined()
    // 未提供的 {textbook_version} 保留原占位符
    expect(result.prompt).toContain('{textbook_version}')
    expect(result.prompt).toContain('{grade}')
    // 已提供的替换正确
    expect(result.prompt).not.toContain('{subject}')
    expect(result.prompt).not.toContain('{topic}')
  })

  // ── TEST 4: 论文大纲（college skill）的 Prompt 含学术规范 ──
  it('论文大纲 Skill 生成 Prompt 包含学术规范字段', () => {
    const result = executor.executeSkillLenient('paper-outline', {
      topic: '短视频对大学生注意力影响的实证研究',
      field: '新闻传播',
      paper_type: '毕业论文',
      keywords: '短视频,注意力,实证研究',
    })
    expect(result.prompt).toContain('短视频对大学生注意力影响的实证研究')
    expect(result.prompt).toContain('新闻传播')
    expect(result.prompt).toContain('毕业论文')
    expect(result.prompt).toContain('学术规范')
    expect(result.prompt).toContain('摘要')
  })

  it('getSkillInputForm 返回 inputSchema，无 schema 时返回 null', () => {
    // core skills (skills.js) 没有 inputSchema, 但 skillExecutor 只看 education/college
    // 所有 education/college skills 都有 inputSchema
    const schema = executor.getSkillInputForm('lesson-plan-generator')
    expect(schema).not.toBeNull()
    expect(schema.subject).toBeDefined()
    expect(schema.topic).toBeDefined()

    // 不存在的 Skill 返回 null
    expect(executor.getSkillInputForm('non-existent-skill')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════
// useAiChat — Skill 集成流程（需 Pinia + mock AI SDK）
// ═══════════════════════════════════════════════════════════════════════
describe('useAiChat — Skill 集成', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    localStorage.clear()
    mockCheckFreeQuota.mockResolvedValue({ ok: true, remaining: 99_999_980, unit: 'token' })
    mockConsumeFreeQuotaTokens.mockResolvedValue({ ok: true, consumed: 20 })

    // 配置平台模型（非 guest）
    const { useModelSettingsStore } = await import('@/stores/modelSettings')
    const ms = useModelSettingsStore()
    ms.data.text.source = 'platform'

    const { useAuthStore } = await import('@/stores/auth')
    const auth = useAuthStore()
    auth.isGuest = false
    auth.currentUser = { id: 'user-1' }
  })

  // ── TEST 1: 隐式匹配 → 弹出表单 ────────────
  it('"帮我写一份教案生成器" 匹配 Skill → pendingSkill 设为 form 模式', async () => {
    const { useAiChat } = await import('@/composables/useAiChat')
    const skillsStore = useSkillsStore()
    const skillExecutor = useSkillExecutor()

    const { sendMessage, pendingSkill } = useAiChat(ref('system prompt'), {
      skillExecutor,
      skillsStore,
    })

    const result = await sendMessage({ text: '帮我写一份教案生成器' })

    // 返回 pending=true，不直接发送到 chat
    expect(result).toEqual({ ok: true, pending: true })
    expect(mockSendMessage).not.toHaveBeenCalled()

    // pendingSkill 为 form 模式，包含 schema
    expect(pendingSkill.value).not.toBeNull()
    expect(pendingSkill.value.mode).toBe('form')
    expect(pendingSkill.value.skillId).toBe('lesson-plan-generator')
    expect(pendingSkill.value.inputSchema).toBeDefined()
    expect(Object.keys(pendingSkill.value.inputSchema)).toContain('subject')
  })

  // ── TEST 2: submitSkillForm → 组装 Prompt 并发送到 AI ──
  it('submitSkillForm 组装完整 Prompt 并调用 chat.sendMessage', async () => {
    const { useAiChat } = await import('@/composables/useAiChat')
    const skillsStore = useSkillsStore()
    const skillExecutor = useSkillExecutor()

    const { sendMessage, submitSkillForm, pendingSkill } = useAiChat(ref('system prompt'), {
      skillExecutor,
      skillsStore,
    })

    // Step 1: 触发表单
    await sendMessage({ text: '帮我写一份教案生成器' })
    expect(pendingSkill.value).not.toBeNull()

    // Step 2: 提交表单
    submitSkillForm({
      subject: '数学',
      textbook_version: '人教版',
      topic: '一元一次方程',
      duration: 45,
      grade: '七年级',
    })

    // chat.sendMessage 被调用
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const sentPayload = mockSendMessage.mock.calls[0][0].text
    expect(sentPayload).toContain('数学')
    expect(sentPayload).toContain('人教版')
    expect(sentPayload).toContain('一元一次方程')
    expect(sentPayload).toContain('45')
    expect(sentPayload).toContain('七年级')
    expect(sentPayload).toContain('教学目标')
    expect(sentPayload).toContain('教学重点与难点')

    // pendingSkill 已清除
    expect(pendingSkill.value).toBeNull()
  })

  // ── TEST 3: parseSkillCommand 手动指定 → 直接执行 ──
  it('"用教案生成器，数学，人教版" parseSkillCommand → 直接执行', async () => {
    const { useAiChat } = await import('@/composables/useAiChat')
    const skillsStore = useSkillsStore()
    const skillExecutor = useSkillExecutor()

    const { sendMessage, pendingSkill } = useAiChat(ref('system prompt'), {
      skillExecutor,
      skillsStore,
    })

    const result = await sendMessage({ text: '用教案生成器，数学，人教版' })

    // 直接发送，没有 pending
    expect(result).toEqual({ ok: true })
    expect(pendingSkill.value).toBeNull()

    // chat.sendMessage 被调用
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const sentPayload = mockSendMessage.mock.calls[0][0].text
    // 参数 "数学"、"人教版" 从消息文本提取并填入 prompt
    expect(sentPayload).toContain('数学')
    expect(sentPayload).toContain('人教版')
  })

  it('"用智能组卷，高等数学" parseSkillCommand 匹配并执行', async () => {
    const { useAiChat } = await import('@/composables/useAiChat')
    const skillsStore = useSkillsStore()
    const skillExecutor = useSkillExecutor()

    const { sendMessage } = useAiChat(ref('system prompt'), {
      skillExecutor,
      skillsStore,
    })

    await sendMessage({ text: '用智能组卷，高等数学' })

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const sentPayload = mockSendMessage.mock.calls[0][0].text
    expect(sentPayload).toContain('高等数学')
    // 包含智能组卷 prompt 模板内容
    expect(sentPayload).toContain('命题')
    expect(sentPayload).toContain('试卷')
  })

  // ── TEST 4: 论文大纲（college Skill）调用 ──
  it('"论文大纲" 匹配 college Skill，表单含学术写作字段', async () => {
    const { useAiChat } = await import('@/composables/useAiChat')
    const skillsStore = useSkillsStore()
    const skillExecutor = useSkillExecutor()

    const { sendMessage, pendingSkill } = useAiChat(ref('system prompt'), {
      skillExecutor,
      skillsStore,
    })

    // 论文大纲有 inputSchema → 弹出表单
    await sendMessage({ text: '论文大纲' })

    expect(pendingSkill.value).not.toBeNull()
    expect(pendingSkill.value.mode).toBe('form')
    expect(pendingSkill.value.skillId).toBe('paper-outline')
    // 学术写作相关字段
    const schema = pendingSkill.value.inputSchema
    expect(schema.topic).toBeDefined()
    expect(schema.field).toBeDefined()
    expect(schema.paper_type).toBeDefined()
  })

  it('提交论文大纲表单后生成的 Prompt 符合学术规范', async () => {
    const { useAiChat } = await import('@/composables/useAiChat')
    const skillsStore = useSkillsStore()
    const skillExecutor = useSkillExecutor()

    const { sendMessage, submitSkillForm } = useAiChat(ref('system prompt'), {
      skillExecutor,
      skillsStore,
    })

    await sendMessage({ text: '论文大纲' })
    submitSkillForm({
      topic: '短视频对大学生注意力影响的实证研究',
      field: '新闻传播',
      paper_type: '毕业论文',
      keywords: '短视频,注意力,实证研究',
      references: '参考了相关文献资料',
    })

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const sentPayload = mockSendMessage.mock.calls[0][0].text
    // 学术规范校验
    expect(sentPayload).toContain('短视频对大学生注意力影响的实证研究')
    expect(sentPayload).toContain('新闻传播')
    expect(sentPayload).toContain('毕业论文')
    expect(sentPayload).toContain('摘要')
    expect(sentPayload).toContain('大纲')
  })

  // ── TEST 5: 未匹配 → 普通对话 ──────────────
  it('"你今天怎么样" 未匹配任何 Skill → 直接调用 chat.sendMessage', async () => {
    const { useAiChat } = await import('@/composables/useAiChat')
    const skillsStore = useSkillsStore()
    const skillExecutor = useSkillExecutor()

    const { sendMessage, pendingSkill } = useAiChat(ref('system prompt'), {
      skillExecutor,
      skillsStore,
    })

    const result = await sendMessage({ text: '你今天怎么样' })

    expect(result).toEqual({ ok: true })
    expect(pendingSkill.value).toBeNull()
    // 原始文本直接发送
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(mockSendMessage.mock.calls[0][0].text).toContain('你今天怎么样')
  })

  // ── TEST 6 验证：Prompt 组装在断网时依然正常 ──
  it('executeSkillLenient 断网时 Prompt 组装功能正常（纯本地替换）', () => {
    // 这个测试不依赖 AI SDK、Pinia 或网络
    const executor = useSkillExecutor()

    // 完整参数
    const r1 = executor.executeSkillLenient('lesson-plan-generator', {
      subject: '物理',
      textbook_version: '人教版',
      topic: '牛顿第一定律',
      duration: 45,
      grade: '八年级',
    })
    expect(r1.prompt).toContain('物理')
    expect(r1.prompt).toContain('牛顿第一定律')
    expect(r1.prompt).toContain('教学过程')

    // 部分参数
    const r2 = executor.executeSkillLenient('paper-outline', {
      topic: '人工智能伦理研究',
      field: '哲学',
    })
    expect(r2.prompt).toContain('人工智能伦理研究')
    expect(r2.prompt).toContain('哲学')
    // 未提供的变量保留占位符
    expect(r2.prompt).toContain('{paper_type}')
  })

  // ── cancelSkillForm: 取消后发送原始消息 ────
  it('cancelSkillForm 发送原始消息', async () => {
    const { useAiChat } = await import('@/composables/useAiChat')
    const skillsStore = useSkillsStore()
    const skillExecutor = useSkillExecutor()

    const { sendMessage, cancelSkillForm } = useAiChat(ref('system prompt'), {
      skillExecutor,
      skillsStore,
    })

    await sendMessage({ text: '帮我写一份教案生成器' })
    cancelSkillForm()

    // 原始消息被发送（不含 Skill Prompt）
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(mockSendMessage.mock.calls[0][0].text).toContain('帮我写一份教案生成器')
  })

  // ── 没有提供 skillOptions 时向后兼容 ────────
  it('不传 skillOptions 时 Skill 匹配逻辑跳过，正常发送', async () => {
    const { useAiChat } = await import('@/composables/useAiChat')

    const { sendMessage } = useAiChat(ref('system prompt'))

    const result = await sendMessage({ text: '帮我写一份教案生成器' })

    // 没有 skillExecutor，正常发送
    expect(result).toEqual({ ok: true })
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
  })
})
