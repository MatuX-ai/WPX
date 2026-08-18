/**
 * skill-manifest.spec.js —— SKILL.md 双向转换器单元测试（Phase 1 / M1）
 */
import { describe, it, expect } from 'vitest'
import {
  skillToSkillMd,
  skillMdToSkill,
  exportAllSkillsToSkillMd,
  skillMdDirectoryToSkills,
  parseFrontmatter,
  parseYamlSubset,
  normalizeSkillId,
  cleanPromptBody,
  extractPromptVars,
  autoSchemaFromVars,
} from '@/skills/skill-manifest'
import { TEACHER_SKILLS } from '@/data/teacher-skills'
import { COLLEGE_SKILLS } from '@/data/college-skills'

function roundTrip (skill) {
  const md = skillToSkillMd(skill)
  const result = skillMdToSkill(md)
  expect(result.ok).toBe(true)
  const converted = result.skill
  return { md, converted }
}

// ═════════════════════════════════════════════════
// 1. 双向转换（无损往返）
// ═════════════════════════════════════════════════
describe('skill-manifest — 双向转换', () => {
  it('教师 Skill lesson-plan-generator 往返后核心字段一致', () => {
    const source = TEACHER_SKILLS.find((s) => s.id === 'lesson-plan-generator')
    const { converted } = roundTrip(source)

    expect(converted.id).toBe(source.id)
    expect(converted.name).toBe(source.name)
    expect(converted.description).toBe(source.description)
    expect(converted.promptTemplate).toBe(source.promptTemplate)
    expect(converted.inputSchema).toEqual(source.inputSchema)
    expect(converted.category).toBe(source.category)
    expect(converted.subcategory).toBe(source.subcategory)
    expect(converted.builtIn).toBe(false)
    expect(converted.source).toBe('skillhub')
  })

  it('教师 Skill courseware-outline 往返后 inputSchema 一致（含默认值）', () => {
    const source = TEACHER_SKILLS.find((s) => s.id === 'courseware-outline')
    const { converted } = roundTrip(source)
    expect(converted.promptTemplate).toBe(source.promptTemplate)
    expect(converted.inputSchema).toEqual(source.inputSchema)
  })

  it('大学生 Skill 抽样往返后一致', () => {
    const source = COLLEGE_SKILLS[0]
    const { converted } = roundTrip(source)
    expect(converted.id).toBe(source.id)
    expect(converted.name).toBe(source.name)
    expect(converted.promptTemplate).toBe(source.promptTemplate)
    expect(converted.inputSchema).toEqual(source.inputSchema)
  })

  it('内置技能批量导出为 32 份 SKILL.md（16 教师 + 16 大学生）', () => {
    const files = exportAllSkillsToSkillMd()
    expect(files).toHaveLength(32)
    for (const file of files) {
      expect(file.content.startsWith('---\n')).toBe(true)
      expect(file.content).toContain(`name: ${file.id}`)
      expect(file.content).toContain(file.name)
    }
  })

  it('批量导出的每份 SKILL.md 可无损导回（全量 32 份）', () => {
    const files = exportAllSkillsToSkillMd()
    const { skills, errors } = skillMdDirectoryToSkills(
      files.map((f) => ({ path: `skills/${f.category}/${f.subcategory}/${f.id}/SKILL.md`, content: f.content })),
    )
    expect(errors).toHaveLength(0)
    expect(skills).toHaveLength(32)
  })
})

// ═════════════════════════════════════════════════
// 2. Hermes 风格 SKILL.md 解析
// ═════════════════════════════════════════════════
describe('skill-manifest — Hermes 风格 SKILL.md 解析', () => {
  it('标准 SKILL.md（name + description + allowed-tools + # 标题）', () => {
    const md = `---
name: web-research
description: Perform multi-step web research and synthesize findings
allowed-tools: [web_search, read_file]
---

# Web Research

Research the topic {topic} thoroughly and produce a {length} report.`
    const result = skillMdToSkill(md)
    expect(result.ok).toBe(true)
    const skill = result.skill
    expect(skill.id).toBe('web-research')
    expect(skill.name).toBe('Web Research')
    expect(skill.promptTemplate).toContain('Research the topic {topic}')
    expect(skill.category).toBe('general')
    // 无 input-schema → 由 {变量} 自动生成
    expect(skill.inputSchema.topic).toEqual({
      label: 'topic',
      type: 'text',
      placeholder: 'topic',
    })
    expect(skill.inputSchema.length).toEqual({
      label: 'length',
      type: 'text',
      placeholder: 'length',
    })
    // allowed-tools 数组可被解析（虽不强制使用）
    const parsed = parseFrontmatter(md)
    expect(parsed.data['allowed-tools']).toEqual(['web_search', 'read_file'])
  })

  it('无 # 标题的 SKILL.md：展示名回退为 frontmatter name', () => {
    const md = `---
name: summarize-doc
description: Summarize a document
---
Summarize the document in {language} within {max_words} words.`
    const result = skillMdToSkill(md)
    expect(result.ok).toBe(true)
    expect(result.skill.name).toBe('summarize-doc')
    expect(result.skill.promptTemplate).toContain('{max_words}')
  })

  it('中文 SKILL.md + input-schema JSON：ID 保留中文、表单完整还原', () => {
    const md = `---
name: 教案生成
description: 生成结构化教案
input-schema: '{"subject":{"label":"学科","type":"text"},"grade":{"label":"年级","type":"text"}}'
---
你是一位{subject}教师，请为{grade}学生生成教案。`
    const result = skillMdToSkill(md)
    expect(result.ok).toBe(true)
    expect(result.skill.id).toBe('教案生成')
    expect(result.skill.inputSchema).toEqual({
      subject: { label: '学科', type: 'text' },
      grade: { label: '年级', type: 'text' },
    })
    expect(result.skill.promptTemplate).toContain('{subject}')
  })

  it('{变量:默认值} 自动生成带 default 的表单字段', () => {
    const schema = autoSchemaFromVars(extractPromptVars('共 {pages:10} 页，主题 {topic}'))
    expect(schema.pages).toEqual({ label: 'pages', type: 'text', placeholder: 'pages', default: '10' })
    expect(schema.topic).toEqual({ label: 'topic', type: 'text', placeholder: 'topic' })
  })
})

// ═════════════════════════════════════════════════
// 3. 非法输入与边界
// ═════════════════════════════════════════════════
describe('skill-manifest — 非法输入与边界', () => {
  it('缺少 frontmatter → ok:false', () => {
    const result = skillMdToSkill('只有正文，没有 --- 包裹的元数据')
    expect(result.ok).toBe(false)
    expect(result.errors.join()).toContain('frontmatter')
  })

  it('缺少 description → ok:false 且错误可读', () => {
    const md = `---
name: no-desc
---
正文内容`
    const result = skillMdToSkill(md)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('description'))).toBe(true)
  })

  it('CRLF 行尾可正常解析', () => {
    const md = '---\r\nname: crlf-skill\r\ndescription: CRLF 测试\r\n---\r\n\r\n# CRLF Skill\r\n\r\n执行 {task}\r\n'
    const result = skillMdToSkill(md)
    expect(result.ok).toBe(true)
    expect(result.skill.id).toBe('crlf-skill')
  })

  it('frontmatter 引号字符串中的冒号与 # 不被误解析', () => {
    const md = `---
name: tricky
description: '含 # 与冒号: 的说明'
---
正文`
    const result = skillMdToSkill(md)
    expect(result.ok).toBe(true)
    expect(result.skill.description).toBe('含 # 与冒号: 的说明')
  })

  it('normalizeSkillId：空格→连字符、去标点、保留中文、全小写', () => {
    expect(normalizeSkillId('Web Research!')).toBe('web-research')
    expect(normalizeSkillId('  教案 生成  ')).toBe('教案-生成')
    expect(normalizeSkillId('A  B--C')).toBe('a-b-c')
  })

  it('cleanPromptBody：去掉首个 # 标题并修剪首尾空白', () => {
    const cleaned = cleanPromptBody('\n# 标题\n\n正文内容\n')
    expect(cleaned).toBe('正文内容')
  })
})

// ═════════════════════════════════════════════════
// 4. 目录解析
// ═════════════════════════════════════════════════
describe('skill-manifest — 技能目录解析', () => {
  it('按 Hermes skills/ 目录约定提取 category / subcategory', () => {
    const files = [
      {
        path: 'skills/education/teaching-prep/lesson-plan/SKILL.md',
        content: '---\nname: lesson-plan\ndescription: 教案\n---\n生成教案 {topic}',
      },
      {
        path: 'skills/study/organize/SKILL.md',
        content: '---\nname: organize\ndescription: 整理\n---\n整理 {things}',
      },
      {
        path: 'README.md',
        content: '不是技能',
      },
    ]
    const { skills, errors } = skillMdDirectoryToSkills(files)
    expect(errors).toHaveLength(0)
    expect(skills).toHaveLength(2)
    const lessonPlan = skills.find((s) => s.id === 'lesson-plan')
    expect(lessonPlan.category).toBe('education')
    expect(lessonPlan.subcategory).toBe('teaching-prep')
    const organize = skills.find((s) => s.id === 'organize')
    expect(organize.category).toBe('study')
    expect(organize.subcategory).toBe('organize')
  })

  it('同 ID 去重（取首个），损坏文件进入 errors', () => {
    const files = [
      {
        path: 'skills/a/one/SKILL.md',
        content: '---\nname: dup\ndescription: 第一份\n---\n正文 A',
      },
      {
        path: 'skills/b/two/SKILL.md',
        content: '---\nname: dup\ndescription: 第二份\n---\n正文 B',
      },
      {
        path: 'skills/c/broken/SKILL.md',
        content: '没有 frontmatter 的坏文件',
      },
    ]
    const { skills, errors } = skillMdDirectoryToSkills(files)
    expect(skills).toHaveLength(1)
    expect(skills[0].promptTemplate).toContain('正文 A')
    expect(errors).toHaveLength(1)
    expect(errors[0].path).toContain('broken')
  })
})
