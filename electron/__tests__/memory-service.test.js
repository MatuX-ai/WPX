/**
 * memory-service 单元测试（Phase 2 / M2：四层记忆 + 学习循环）
 *
 * 运行：npm --prefix wpx-app run test:zip -- memory-service
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'node:module'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const memoryService = require('../memory-service.js')
const { MAX_EPISODES } = memoryService

/** @type {string} */
let tmpDir

beforeEach(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'memory-svc-test-'))
  await memoryService.initMemoryService({ userDataPath: tmpDir, registerIpc: false })
})

afterEach(async () => {
  memoryService.resetMemoryServiceForTests()
  await fsp.rm(tmpDir, { recursive: true, force: true })
})

function makeEpisode(overrides = {}) {
  return {
    task: '生成周报',
    summary: '完成了本周工作汇总',
    outcome: 'success',
    feedback: 'positive',
    documentType: '周报',
    format: { font: '思源黑体', fontSize: 14, lineHeight: 1.5, heading: 'h2' },
    ...overrides,
  }
}

// ═════════════════════════════════════════════════
// 1. v1 → v2 迁移
// ═════════════════════════════════════════════════
describe('memory-service — v1 → v2 迁移', () => {
  it('旧数据（saves/统计）无损保留，新字段补齐默认值，version 升为 2', async () => {
    memoryService.resetMemoryServiceForTests()
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'memory-migrate-'))
    try {
      const memoryDir = path.join(dir, 'memory')
      await fsp.mkdir(memoryDir, { recursive: true })
      const save = {
        documentType: '周报',
        savedAt: '2024-01-01T00:00:00.000Z',
        format: { font: '思源黑体', fontSize: 14, lineHeight: 1.5, heading: 'h2' },
      }
      const v1 = {
        version: 1,
        byDocumentType: {
          _default: { font: {}, fontSize: {}, lineHeight: {}, heading: { h2: 3 } },
        },
        // 3 条同类 saves → init 后模板可重建为 1 条（与 v1 语义一致）
        saves: [save, save, save],
        templates: [],
        templatesUpdatedAt: null,
      }
      await fsp.writeFile(path.join(memoryDir, 'db.json'), JSON.stringify(v1), 'utf8')

      await memoryService.initMemoryService({ userDataPath: dir, registerIpc: false })

      const raw = JSON.parse(await fsp.readFile(path.join(memoryDir, 'db.json'), 'utf8'))
      expect(raw.version).toBe(2)
      expect(raw.saves).toHaveLength(3)
      expect(raw.saves[0].documentType).toBe('周报')
      expect(raw.byDocumentType._default.heading).toEqual({ h2: 3 })
      // 模板由 saves 重建（v1 init 同样重建，属既有语义）
      expect(raw.templates).toHaveLength(1)
      expect(raw.templates[0].documentType).toBe('周报')
      expect(raw.templatesUpdatedAt).toBeTruthy()
      expect(Array.isArray(raw.episodes)).toBe(true)
      expect(typeof raw.facts).toBe('object')
      expect(raw.learning.enabled).toBe(true)
      expect(raw.learning.minEpisodesBeforeLearn).toBe(5)
    } finally {
      await fsp.rm(dir, { recursive: true, force: true })
    }
  })
})

// ═════════════════════════════════════════════════
// 2. L2 情景记忆（episodes）
// ═════════════════════════════════════════════════
describe('memory-service — L2 情景记忆', () => {
  it('记录 episode 并可列表（最新在前）', async () => {
    await memoryService.recordEpisode(makeEpisode({ task: '第一个任务' }))
    await memoryService.recordEpisode(makeEpisode({ task: '第二个任务' }))

    const episodes = await memoryService.listEpisodes({ limit: 10 })
    expect(episodes).toHaveLength(2)
    expect(episodes[0].task).toBe('第二个任务')
    expect(episodes[1].task).toBe('第一个任务')
    expect(episodes[0].docType).toBe('周报')
    expect(episodes[0].outcome).toBe('success')
    expect(episodes[0].createdAt).toBeTruthy()
  })

  it('episodes 上限 500，超限淘汰最旧', async () => {
    for (let i = 0; i < MAX_EPISODES + 10; i += 1) {
      await memoryService.recordEpisode(makeEpisode({ task: `任务-${i}` }))
    }
    const episodes = await memoryService.listEpisodes({ limit: MAX_EPISODES + 100 })
    expect(episodes).toHaveLength(MAX_EPISODES)
    // 最新在最前，最旧的 10 条被淘汰
    expect(episodes[0].task).toBe(`任务-${MAX_EPISODES + 9}`)
  })

  it('缺少 task 时抛错', async () => {
    await expect(memoryService.recordEpisode({ outcome: 'success' })).rejects.toThrow(/任务/)
  })

  it('outcome/feedback 非法值被归一化', async () => {
    await memoryService.recordEpisode(makeEpisode({ outcome: 'weird', feedback: 'meh' }))
    const episodes = await memoryService.listEpisodes({ limit: 1 })
    expect(episodes[0].outcome).toBe('success')
    expect(episodes[0].feedback).toBeNull()
  })
})

// ═════════════════════════════════════════════════
// 3. L3 语义记忆（facts）
// ═════════════════════════════════════════════════
describe('memory-service — L3 语义记忆', () => {
  it('setFact / getFact / listFacts 全链路', async () => {
    await memoryService.setFact({ key: 'user.role', value: '教师', scope: 'user' })
    await memoryService.setFact({ key: 'user.subject', value: '数学' })

    const fact = await memoryService.getFact('user.role')
    expect(fact.value).toBe('教师')
    expect(fact.scope).toBe('user')
    expect(fact.updatedAt).toBeTruthy()

    const all = await memoryService.listFacts()
    expect(all.map((f) => f.key).sort()).toEqual(['user.role', 'user.subject'])
  })

  it('getFact 不存在返回 null；setFact 缺 key 抛错', async () => {
    expect(await memoryService.getFact('nope')).toBeNull()
    await expect(memoryService.setFact({ value: 'x' })).rejects.toThrow(/key/)
  })
})

// ═════════════════════════════════════════════════
// 4. 学习循环
// ═════════════════════════════════════════════════
describe('memory-service — 学习循环', () => {
  it('成功 episode 不足时不触发（not_enough_episodes）', async () => {
    await memoryService.recordEpisode(makeEpisode())
    await memoryService.recordEpisode(makeEpisode())
    const result = await memoryService.runLearning()
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not_enough_episodes')
  })

  it('达到阈值后：提炼 facts + 生成模板 + 记录 lastLearnAt', async () => {
    for (let i = 0; i < 3; i += 1) {
      await memoryService.recordEpisode(makeEpisode({ task: `周报-${i}` }))
    }
    for (let i = 0; i < 2; i += 1) {
      await memoryService.recordEpisode(makeEpisode({
        task: `会议纪要-${i}`,
        documentType: '会议纪要',
        format: { font: '微软雅黑', fontSize: 12, lineHeight: 1.4, heading: 'h3' },
      }))
    }

    const result = await memoryService.runLearning()
    expect(result.ok).toBe(true)
    expect(result.generated).toBeGreaterThanOrEqual(2)

    // facts 提炼
    const fact = await memoryService.getFact('preferred-format:周报')
    expect(fact).not.toBeNull()
    expect(fact.scope).toBe('learned')
    expect(fact.value.font).toBe('思源黑体')

    // 模板生成 + 合并
    const templates = await memoryService.getTemplates()
    const docTypes = templates.map((t) => t.documentType)
    expect(docTypes).toContain('周报')
    expect(docTypes).toContain('会议纪要')

    // 学习状态
    const status = await memoryService.getLearningStatus()
    expect(status.lastLearnAt).toBeTruthy()
    expect(status.learnedTemplates).toContain('周报')
    expect(status.eligible).toBe(false)
    expect(status.reason).toBe('interval_not_elapsed')
  })

  it('间隔未到时再次触发被拒绝（interval_not_elapsed），force 可跳过', async () => {
    for (let i = 0; i < 5; i += 1) {
      await memoryService.recordEpisode(makeEpisode())
    }
    const first = await memoryService.runLearning()
    expect(first.ok).toBe(true)

    const second = await memoryService.runLearning()
    expect(second.ok).toBe(false)
    expect(second.reason).toBe('interval_not_elapsed')

    const forced = await memoryService.runLearning({ force: true })
    expect(forced.ok).toBe(true)
  })

  it('关闭学习后不触发（learning_disabled），force 仍可手动执行', async () => {
    for (let i = 0; i < 5; i += 1) {
      await memoryService.recordEpisode(makeEpisode())
    }
    await memoryService.setLearningSettings({ enabled: false })

    const blocked = await memoryService.runLearning()
    expect(blocked.ok).toBe(false)
    expect(blocked.reason).toBe('learning_disabled')

    const forced = await memoryService.runLearning({ force: true })
    expect(forced.ok).toBe(true)
  })

  it('学习设置可读写，仅允许白名单字段', async () => {
    const settings = await memoryService.setLearningSettings({
      enabled: false,
      recordEpisodes: false,
      minEpisodesBeforeLearn: 3,
      unknownField: 'should-be-ignored',
    })
    expect(settings.enabled).toBe(false)
    expect(settings.recordEpisodes).toBe(false)
    expect(settings.minEpisodesBeforeLearn).toBe(3)
    expect(settings.unknownField).toBeUndefined()

    const got = await memoryService.getLearningSettings()
    expect(got.enabled).toBe(false)
    expect(got.recordEpisodes).toBe(false)
  })

  it('recordEpisodes 默认开启且出现在状态中', async () => {
    const status = await memoryService.getLearningStatus()
    expect(status.recordEpisodes).toBe(true)
    const settings = await memoryService.getLearningSettings()
    expect(settings.recordEpisodes).toBe(true)
  })
})

// ═════════════════════════════════════════════════
// 5. 兼容性：原 recordMemoryEvent / 模板
// ═════════════════════════════════════════════════
describe('memory-service — 原有能力兼容', () => {
  it('format 记录仍可用', async () => {
    const result = await memoryService.recordMemoryEvent({
      action: 'format',
      documentType: '周报',
      format: { font: '思源黑体', fontSize: 14 },
    })
    expect(result.success).toBe(true)
  })

  it('save 记录仍会触发模板重建', async () => {
    const result = await memoryService.recordMemoryEvent({
      action: 'save',
      documentType: '周报',
      format: { font: '思源黑体', fontSize: 14, lineHeight: 1.5, heading: 'h2' },
    })
    expect(result.success).toBe(true)
    expect(Array.isArray(result.templates)).toBe(true)
  })

  it('clearMemoryData 清空四层记忆', async () => {
    await memoryService.recordEpisode(makeEpisode())
    await memoryService.setFact({ key: 'a', value: 1 })
    await memoryService.clearMemoryData()
    const status = await memoryService.getLearningStatus()
    expect(status.episodeCount).toBe(0)
    expect(status.factCount).toBe(0)
  })
})

// ═════════════════════════════════════════════════
// 6. IPC 注册
// ═════════════════════════════════════════════════
describe('memory-service — IPC 注册', () => {
  it('注册全部 12 个通道', () => {
    const handlers = {}
    const ipcMain = { handle: vi.fn((ch, fn) => { handlers[ch] = fn }) }
    memoryService.registerMemoryIpcHandlers({ ipcMain })

    const channels = Object.keys(handlers)
    expect(channels).toHaveLength(12)
    expect(channels).toEqual(expect.arrayContaining([
      'data:memory:record',
      'memory:templates:get',
      'memory:templates:regenerate',
      'memory:clear',
      'memory:episode:record',
      'memory:episode:list',
      'memory:fact:set',
      'memory:fact:get',
      'memory:fact:list',
      'memory:learn:run',
      'memory:learn:settings',
      'memory:learn:status',
    ]))
  })

  it('ipcMain 不可用时静默跳过', () => {
    expect(() => memoryService.registerMemoryIpcHandlers({})).not.toThrow()
  })
})
