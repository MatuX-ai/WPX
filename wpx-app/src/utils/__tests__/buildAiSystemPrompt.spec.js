import { describe, it, expect } from 'vitest'
import { BUILT_IN_SKILLS } from '@/data/skills'
import { createDefaultAgentSettings } from '@/constants/agentPreferences'
import { buildAgentSystemPromptSection } from '@/utils/buildAgentSystemPrompt'
import {
  DISABLED_SKILL_REPLY,
  buildDisabledSkillsSystemPromptSection,
  buildEditorAiSystemPrompt,
  buildSkillsSystemPromptSection,
} from '@/utils/buildAiSystemPrompt'

describe('buildAgentSystemPromptSection', () => {
  it('注入助手名称与语气风格到 System Prompt', () => {
    const prompt = buildAgentSystemPromptSection({
      ...createDefaultAgentSettings(),
      assistantName: '小文',
      toneStyle: 'casual',
      identityDescription: '活泼的编辑搭档',
    })

    expect(prompt).toContain('助手名称：小文')
    expect(prompt).toContain('语气风格：轻松口语化')
    expect(prompt).toContain('身份描述：活泼的编辑搭档')
  })

  it('自定义语气时使用 customTone 文案', () => {
    const prompt = buildAgentSystemPromptSection({
      ...createDefaultAgentSettings(),
      toneStyle: 'custom',
      customTone: '像资深编辑一样简洁有洞见',
    })

    expect(prompt).toContain('语气风格：像资深编辑一样简洁有洞见')
  })
})

describe('buildSkillsSystemPromptSection', () => {
  it('仅列出已启用的 Skills', () => {
    const translate = BUILT_IN_SKILLS.find((skill) => skill.id === 'translate')
    const rewrite = BUILT_IN_SKILLS.find((skill) => skill.id === 'rewrite')
    const prompt = buildSkillsSystemPromptSection([rewrite])

    expect(prompt).toContain('rewrite')
    expect(prompt).not.toContain('translate（translate）')
  })
})

describe('buildDisabledSkillsSystemPromptSection', () => {
  it('禁用翻译 Skill 时要求回复「该能力未启用」', () => {
    const translate = BUILT_IN_SKILLS.find((skill) => skill.id === 'translate')
    const prompt = buildDisabledSkillsSystemPromptSection([translate])

    expect(prompt).toContain('翻译（translate）')
    expect(prompt).toContain(DISABLED_SKILL_REPLY)
    expect(prompt).toMatch(/翻译这段|帮我翻译/)
  })
})

describe('buildEditorAiSystemPrompt', () => {
  it('组合 Agent、启用 Skills 与禁用 Skills 规则', () => {
    const translate = BUILT_IN_SKILLS.find((skill) => skill.id === 'translate')
    const rewrite = BUILT_IN_SKILLS.find((skill) => skill.id === 'rewrite')

    const prompt = buildEditorAiSystemPrompt({
      agentSettings: {
        ...createDefaultAgentSettings(),
        assistantName: '测试助手',
        toneStyle: 'formal',
      },
      enabledSkills: [rewrite],
      disabledSkills: [translate],
    })

    expect(prompt).toContain('测试助手')
    expect(prompt).toContain('rewrite')
    expect(prompt).toContain(DISABLED_SKILL_REPLY)
    expect(prompt).not.toMatch(/翻译（translate）：/)
  })
})
