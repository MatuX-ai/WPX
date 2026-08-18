/**
 * skills-market.spec.js —— SKILL.md 技能市场集成测试（store + composable）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSkillsStore } from '@/stores/skills'
import { useSkillHub } from '@/composables/useSkillHub'
import { getAllSkills, registerExternalSkills } from '@/composables/useSkillExecutor'
import { exportAllSkillsToSkillMd } from '@/skills/skill-manifest'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  // 清空模块级外部技能注册表（重新注册为内置集）
  registerExternalSkills([])
})

const SAMPLE_MD = `---
name: market-skill
description: 市场导入技能
category: education
subcategory: market
---
为{topic}生成教案，共{pages}页。`

describe('skills store — mergeExternalSkills', () => {
  it('合并新技能并去重，返回新增数量', () => {
    const store = useSkillsStore()
    const added = store.mergeExternalSkills([
      { id: 'market-a', name: '市场A', description: 'A', promptTemplate: 'A', inputSchema: {} },
      { id: 'lesson-plan-generator', name: '与内置重名', description: '不应覆盖内置', promptTemplate: 'x', inputSchema: {} },
    ])
    expect(added).toBe(1)
    expect(store.marketSkills).toHaveLength(1)
    // 内置（核心 13 + 教师 16 + 大学生 16 = 45）+ 1 市场
    expect(store.allSkills).toHaveLength(store.builtInSkills.length + 1)
    // 内置优先，不被市场覆盖
    expect(store.allSkills.find((s) => s.id === 'lesson-plan-generator').name).not.toBe('与内置重名')
  })

  it('marketSkills 出现在 skillsWithState 且默认启用', () => {
    const store = useSkillsStore()
    store.mergeExternalSkills([
      { id: 'market-b', name: '市场B', description: 'B', promptTemplate: 'B', inputSchema: {} },
    ])
    const entry = store.skillsWithState.find((s) => s.id === 'market-b')
    expect(entry).toBeTruthy()
    expect(entry.enabled).toBe(true)
  })
})

describe('useSkillHub — 导入与导出', () => {
  it('importSkillMdText：注册进执行器 + store，返回 ok', () => {
    const hub = useSkillHub()
    const result = hub.importSkillMdText(SAMPLE_MD)
    expect(result.ok).toBe(true)
    expect(result.skill.id).toBe('market-skill')
    expect(result.skill.inputSchema.topic).toBeTruthy()

    const store = useSkillsStore()
    expect(store.marketSkills.some((s) => s.id === 'market-skill')).toBe(true)
    // 执行器全局可见
    expect(getAllSkills().some((s) => s.id === 'market-skill')).toBe(true)
    expect(hub.marketSkillCount.value).toBe(1)
  })

  it('importSkillMdText：重复导入幂等（不重复注册）', () => {
    const hub = useSkillHub()
    hub.importSkillMdText(SAMPLE_MD)
    hub.importSkillMdText(SAMPLE_MD)
    const store = useSkillsStore()
    expect(store.marketSkills.filter((s) => s.id === 'market-skill')).toHaveLength(1)
  })

  it('importSkillMdText：非法文本返回 errors 且不注册', () => {
    const hub = useSkillHub()
    const result = hub.importSkillMdText('没有 frontmatter')
    expect(result.ok).toBe(false)
    const store = useSkillsStore()
    expect(store.marketSkills).toHaveLength(0)
  })

  it('exportSkills：返回 32 份 SKILL.md 文件清单（不触发下载）', () => {
    const hub = useSkillHub()
    const files = hub.exportSkills({ download: false })
    expect(files).toHaveLength(32)
    expect(files[0].content.startsWith('---')).toBe(true)
  })
})

describe('useSkillHub — 同步（缓存回退路径）', () => {
  it('网络失败 + 有缓存 → ok:true 且技能可用', async () => {
    // 预置缓存
    const { writeSkillHubCache } = await import('@/skills/skillhub-loader')
    writeSkillHubCache('hermes-official', 'NousResearch/hermes-agent', [
      { path: 'skills/cached/one/SKILL.md', content: SAMPLE_MD },
    ], ['market-skill'])

    // fetch 抛错（模拟离线），同时阻止真实网络请求
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
      throw new Error('offline (test)')
    }
    try {
      const hub = useSkillHub()
      const result = await hub.sync('hermes-official')
      expect(result.ok).toBe(true)
      expect(result.fromCache).toBe(true)
      expect(hub.marketSkillCount.value).toBe(1)
      expect(hub.lastSyncAt.value).not.toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
