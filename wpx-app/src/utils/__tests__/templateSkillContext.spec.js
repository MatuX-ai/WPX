import { describe, it, expect } from 'vitest'
import { BUILT_IN_SKILLS as CORE_SKILLS } from '@/data/skills'
import { BUILT_IN_SKILLS as EDUCATION_SKILLS } from '@/data/built-in-skills'
import { COLD_START_TEMPLATES } from '@/data/cold-start-templates'
import { CORE_SKILL_PROMPTS, getCoreSkillPrompt } from '@/data/core-skill-prompts'
import {
  getRecommendedSkillIdsForTemplate,
  TEMPLATE_SKILL_RECOMMENDATIONS,
} from '@/data/template-skill-recommendations'
import {
  buildDocumentContextSystemPromptSection,
  buildEditorAiSystemPrompt,
} from '@/utils/buildAiSystemPrompt'
import {
  buildQuickSkillMessage,
  getDocumentSkillContext,
} from '@/utils/templateSkillContext'
import { useSkillExecutor } from '@/composables/useSkillExecutor'

const ALL_KNOWN_SKILL_IDS = new Set([
  ...CORE_SKILLS.map((s) => s.id),
  ...EDUCATION_SKILLS.map((s) => s.id),
])

describe('template-skill-recommendations', () => {
  it('公众号与小说模板有专属推荐 Skills', () => {
    expect(getRecommendedSkillIdsForTemplate('wechat-article')).toEqual([
      'title-generate',
      'expand',
      'rewrite',
    ])
    expect(getRecommendedSkillIdsForTemplate('novel-writing')).toEqual([
      'continue-writing',
      'outline',
      'expand',
    ])
  })

  it('未知模板返回空数组', () => {
    expect(getRecommendedSkillIdsForTemplate('not-exists')).toEqual([])
  })

  it('映射键覆盖全部冷启动模板 id', () => {
    const coldIds = new Set(COLD_START_TEMPLATES.map((t) => t.id))
    for (const id of coldIds) {
      expect(
        Object.prototype.hasOwnProperty.call(TEMPLATE_SKILL_RECOMMENDATIONS, id),
        `缺少推荐映射: ${id}`,
      ).toBe(true)
    }
  })

  it('所有推荐 Skill ID 均存在于 core ∪ education 目录', () => {
    for (const [templateId, ids] of Object.entries(TEMPLATE_SKILL_RECOMMENDATIONS)) {
      for (const id of ids) {
        expect(
          ALL_KNOWN_SKILL_IDS.has(id),
          `${templateId} 推荐了未知 Skill: ${id}`,
        ).toBe(true)
      }
    }
  })
})

describe('core-skill-prompts', () => {
  it('核心写作 Skills 均有可执行 Prompt', () => {
    for (const id of ['continue-writing', 'title-generate', 'expand', 'rewrite', 'outline']) {
      expect(CORE_SKILL_PROMPTS[id], id).toBeTruthy()
      expect(getCoreSkillPrompt(id).length).toBeGreaterThan(20)
    }
  })
})

describe('getDocumentSkillContext', () => {
  const mockSkillsStore = {
    allSkills: [...CORE_SKILLS, ...EDUCATION_SKILLS],
    isSkillEnabled: () => true,
  }

  it('空 documentType 返回空上下文', () => {
    expect(getDocumentSkillContext('', mockSkillsStore)).toEqual({
      documentType: '',
      templateId: '',
      recommendedSkillIds: [],
      recommendedSkills: [],
    })
  })

  it('公众号文章解析出推荐 Skills（最多 4 个）', () => {
    const ctx = getDocumentSkillContext('公众号文章', mockSkillsStore)
    expect(ctx.documentType).toBe('公众号文章')
    expect(ctx.templateId).toBe('wechat-article')
    expect(ctx.recommendedSkillIds).toEqual(['title-generate', 'expand', 'rewrite'])
  })

  it('教案模板解析出教育类推荐 Skills', () => {
    const ctx = getDocumentSkillContext('教案', mockSkillsStore)
    expect(ctx.templateId).toBe('lesson-plan')
    expect(ctx.recommendedSkillIds).toContain('lesson-plan-generator')
    expect(ctx.recommendedSkillIds).toContain('courseware-outline')
  })

  it('已禁用的 Skill 不会出现在推荐列表', () => {
    const ctx = getDocumentSkillContext('公众号文章', {
      allSkills: CORE_SKILLS,
      isSkillEnabled: (id) => id !== 'title-generate',
    })
    expect(ctx.recommendedSkillIds).not.toContain('title-generate')
    expect(ctx.recommendedSkillIds).toEqual(['expand', 'rewrite'])
  })
})

describe('buildQuickSkillMessage', () => {
  it('统一使用「用{name}」硬触发前缀（通用与教育）', () => {
    expect(buildQuickSkillMessage({ name: '续写' })).toBe('用续写')
    expect(buildQuickSkillMessage({ name: '教案生成器', promptTemplate: '...' })).toBe('用教案生成器')
  })
})

describe('buildDocumentContextSystemPromptSection', () => {
  it('注入文档类型与推荐 Skills', () => {
    const rewrite = CORE_SKILLS.find((s) => s.id === 'rewrite')
    const prompt = buildDocumentContextSystemPromptSection({
      documentType: '公众号文章',
      recommendedSkills: [rewrite],
    })

    expect(prompt).toContain('【当前文档上下文】')
    expect(prompt).toContain('文档类型：公众号文章')
    expect(prompt).toContain('改写（rewrite）')
  })

  it('无 documentType 时不输出段落', () => {
    expect(buildDocumentContextSystemPromptSection({})).toBe('')
  })
})

describe('buildEditorAiSystemPrompt — documentContext', () => {
  it('组合文档上下文与 Skills 段落', () => {
    const outline = CORE_SKILLS.find((s) => s.id === 'outline')
    const prompt = buildEditorAiSystemPrompt({
      enabledSkills: [outline],
      documentContext: {
        documentType: '小说创作',
        recommendedSkills: [outline],
      },
    })

    expect(prompt).toContain('小说创作')
    expect(prompt).toContain('大纲生成（outline）')
    expect(prompt).toContain('【可用 Skills】')
  })
})

describe('useSkillExecutor — core skills + 文档加权', () => {
  const executor = useSkillExecutor()

  it('可查找并执行通用 Skill（title-generate）', () => {
    expect(executor.findSkill('title-generate')?.name).toBe('标题生成')
    const result = executor.executeSkill('title-generate', {})
    expect(result.prompt).toMatch(/备选标题/)
  })

  it('芯片文案「用续写」可被 parseSkillCommand 硬匹配', () => {
    const parsed = executor.parseSkillCommand('用续写')
    expect(parsed.matched).toBe(true)
    expect(parsed.candidates.some((c) => c.skillId === 'continue-writing')).toBe(true)
  })

  it('明确 Skill 名称匹配不受 recommendedSkillIds 干扰', () => {
    const result = executor.matchSkillByIntent('帮我写一份教案生成器', {
      recommendedSkillIds: ['lesson-plan-generator'],
    })
    expect(result).toBe('lesson-plan-generator')
  })

  it('推荐加权可 tipping 弱意图命中 title-generate', () => {
    const msg = '帮我生成几个标题'
    const without = executor.matchSkillByIntent(msg)
    const withBoost = executor.matchSkillByIntent(msg, {
      recommendedSkillIds: ['title-generate'],
    })
    expect(withBoost).toBe('title-generate')
    // 无加权时可能 null 或其他；有加权必须稳定命中推荐项
    if (without && without !== 'title-generate') {
      expect(withBoost).not.toBe(without)
    }
  })
})
