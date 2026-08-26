/**
 * 冷启动模板单元测试 —— FIX-0.1.24 + 扩充到 21 个
 *
 * 覆盖目标：
 *  - COLD_START_TEMPLATES 数量与字段完整性（至少 18 个）
 *  - 5 大分类场景覆盖（document / table / presentation / lesson / note）
 *  - getColdStartTemplate(id) 按 ID 检索 + 未知 ID 容错
 *  - getColdStartTemplatesByCategory() 按 CATEGORY_ORDER 返回分组
 *  - CATEGORY_LABELS / CATEGORY_ORDER 与分组渲染对齐
 *  - EmptyState 快速创建入口依赖的 4 个核心模板（blank/weekly-plan/ppt-outline/lesson-plan）必须存在
 *  - SmartTemplate.vue 中按 category 渲染时所需的字段（id/name/icon/category/documentType/content）齐备
 */
import { describe, it, expect } from 'vitest'
import {
  COLD_START_TEMPLATES,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getColdStartTemplate,
  getColdStartTemplatesByCategory,
} from '@/data/cold-start-templates'

describe('cold-start-templates — 模板库完整性', () => {
  it('COLD_START_TEMPLATES 至少包含 18 个内置模板（兜底用户首次进入的模板入口）', () => {
    expect(COLD_START_TEMPLATES.length).toBeGreaterThanOrEqual(18)
  })

  it('扩充分类：document 至少覆盖 7 个场景（空白 / 周报 / 日志 / 待办 / 读书 / 公众号 / 小说）', () => {
    const docs = COLD_START_TEMPLATES.filter((t) => t.category === 'document')
    const docIds = docs.map((t) => t.id)
    for (const id of [
      'blank',
      'weekly-report',
      'daily-journal',
      'todo-list',
      'reading-notes',
      'wechat-article',
      'novel-writing',
    ]) {
      expect(docIds, `document 分类缺少 ${id}`).toContain(id)
    }
  })

  it('扩充分类：table 至少覆盖 3 个场景（周计划 / 项目跟踪 / 看板）', () => {
    const tables = COLD_START_TEMPLATES.filter((t) => t.category === 'table')
    const ids = tables.map((t) => t.id)
    for (const id of ['weekly-plan', 'project-tracker', 'kanban']) {
      expect(ids, `table 分类缺少 ${id}`).toContain(id)
    }
  })

  it('扩充分类：presentation 至少覆盖 3 个场景（课件大纲 / 路演 / 产品介绍）', () => {
    const ppts = COLD_START_TEMPLATES.filter((t) => t.category === 'presentation')
    const ids = ppts.map((t) => t.id)
    for (const id of ['ppt-outline', 'pitch-deck', 'product-intro']) {
      expect(ids, `presentation 分类缺少 ${id}`).toContain(id)
    }
  })

  it('扩充分类：lesson 至少覆盖 4 个场景（教案 / 讲义 / 试卷 / 学生评语）', () => {
    const lessons = COLD_START_TEMPLATES.filter((t) => t.category === 'lesson')
    const ids = lessons.map((t) => t.id)
    for (const id of ['lesson-plan', 'lesson-lecture', 'exam-paper', 'student-evaluation']) {
      expect(ids, `lesson 分类缺少 ${id}`).toContain(id)
    }
  })

  it('扩充分类：note 至少覆盖 6 个场景（会议 / 面试 / 书评 / 思维导图 / 笔记 / 学习总结）', () => {
    const notes = COLD_START_TEMPLATES.filter((t) => t.category === 'note')
    const ids = notes.map((t) => t.id)
    for (const id of ['meeting-notes', 'interview-notes', 'book-review', 'mind-map', 'note-card', 'study-summary']) {
      expect(ids, `note 分类缺少 ${id}`).toContain(id)
    }
  })

  it('每个模板都包含必填字段（id/name/description/icon/category/documentType/content）', () => {
    for (const tpl of COLD_START_TEMPLATES) {
      expect(tpl.id, `${tpl.name} missing id`).toBeTruthy()
      expect(typeof tpl.id).toBe('string')
      expect(tpl.name, `${tpl.id} missing name`).toBeTruthy()
      expect(tpl.description, `${tpl.id} missing description`).toBeTruthy()
      expect(tpl.icon, `${tpl.id} missing icon`).toBeTruthy()
      // category 必须是 5 个枚举值之一
      expect(
        ['document', 'table', 'presentation', 'lesson', 'note'].includes(tpl.category),
        `${tpl.id} 未知 category: ${tpl.category}`,
      ).toBe(true)
      expect(tpl.documentType, `${tpl.id} missing documentType`).toBeTruthy()
      expect(typeof tpl.content).toBe('string')
      // content 不可为空字符串（否则等同于"空白文档"，失去模板意义）
      expect(tpl.content.trim().length, `${tpl.id} content 为空`).toBeGreaterThan(0)
    }
  })

  it('模板 id 全局唯一（SmartTemplate 用 id 作为 key）', () => {
    const ids = COLD_START_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('模板 documentType 全局唯一（userHabits 按 documentType 聚合）', () => {
    const types = COLD_START_TEMPLATES.map((t) => t.documentType)
    expect(new Set(types).size).toBe(types.length)
  })
})

describe('cold-start-templates — getColdStartTemplate(id)', () => {
  it('能按 id 取到 weekly-report 模板', () => {
    const tpl = getColdStartTemplate('weekly-report')
    expect(tpl).not.toBeNull()
    expect(tpl.id).toBe('weekly-report')
    expect(tpl.category).toBe('document')
    expect(tpl.content).toMatch(/本周工作周报/)
  })

  it('能按 id 取到 lesson-plan 模板（教案转 PPT 工作流对接）', () => {
    const tpl = getColdStartTemplate('lesson-plan')
    expect(tpl).not.toBeNull()
    expect(tpl.category).toBe('lesson')
    expect(tpl.content).toMatch(/教案/)
    expect(tpl.content).toMatch(/教学过程/)
  })

  it('未知 id 返回 null（不抛异常）', () => {
    expect(() => getColdStartTemplate('non-existent-id')).not.toThrow()
    expect(getColdStartTemplate('non-existent-id')).toBeNull()
  })

  it('EmptyState 快速创建入口依赖的 4 个模板全部存在', () => {
    // 这些 id 必须与 EmptyState.vue 的 quickFormats 配置完全一致
    const required = ['blank', 'weekly-plan', 'ppt-outline', 'lesson-plan']
    for (const id of required) {
      expect(getColdStartTemplate(id), `${id} 缺失`).not.toBeNull()
    }
  })
})

describe('cold-start-templates — getColdStartTemplatesByCategory()', () => {
  it('按 CATEGORY_ORDER 返回分组数组，顺序稳定', () => {
    const groups = getColdStartTemplatesByCategory()
    expect(Array.isArray(groups)).toBe(true)
    expect(groups.length).toBeGreaterThan(0)

    // 顺序应与 CATEGORY_ORDER 一致
    const actualOrder = groups.map((g) => g.category)
    const expectedOrder = CATEGORY_ORDER.filter((cat) =>
      COLD_START_TEMPLATES.some((t) => t.category === cat),
    )
    expect(actualOrder).toEqual(expectedOrder)
  })

  it('每个分组包含 {category, label, templates} 三字段', () => {
    const groups = getColdStartTemplatesByCategory()
    for (const group of groups) {
      expect(group.category).toBeTruthy()
      expect(typeof group.label).toBe('string')
      expect(group.label.length).toBeGreaterThan(0)
      expect(Array.isArray(group.templates)).toBe(true)
      expect(group.templates.length).toBeGreaterThan(0)
    }
  })

  it('分组标签与 CATEGORY_LABELS 完全对齐', () => {
    const groups = getColdStartTemplatesByCategory()
    for (const group of groups) {
      expect(group.label).toBe(CATEGORY_LABELS[group.category])
    }
  })

  it('分组内每个模板 category 与组 category 一致（防止错位）', () => {
    const groups = getColdStartTemplatesByCategory()
    for (const group of groups) {
      for (const tpl of group.templates) {
        expect(tpl.category, `${tpl.id} 在分组 ${group.category} 但自身 category=${tpl.category}`).toBe(
          group.category,
        )
      }
    }
  })

  it('5 大分类全部覆盖：document / table / presentation / lesson / note', () => {
    const groups = getColdStartTemplatesByCategory()
    const presentCategories = new Set(groups.map((g) => g.category))
    for (const cat of ['document', 'table', 'presentation', 'lesson', 'note']) {
      expect(presentCategories.has(cat), `${cat} 分类为空`).toBe(true)
    }
  })
})

describe('cold-start-templates — format 字段', () => {
  it('空白模板（blank）的 format 为空对象（不强行套用排版）', () => {
    const tpl = getColdStartTemplate('blank')
    expect(tpl.format).toEqual({})
  })

  it('非空白模板的 format 至少包含 lineHeight（保证排版一致）', () => {
    for (const tpl of COLD_START_TEMPLATES) {
      if (tpl.id === 'blank') continue
      expect(
        tpl.format && typeof tpl.format.lineHeight === 'string',
        `${tpl.id} format.lineHeight 缺失或非字符串`,
      ).toBe(true)
    }
  })
})

describe('cold-start-templates — 内容骨架（Markdown）', () => {
  it('周报模板必含"本周重点完成"小节（满足周报字段约定）', () => {
    const tpl = getColdStartTemplate('weekly-report')
    expect(tpl.content).toMatch(/本周重点完成/)
    expect(tpl.content).toMatch(/关键数据/)
  })

  it('会议纪要模板必含"行动项"表格', () => {
    const tpl = getColdStartTemplate('meeting-notes')
    expect(tpl.content).toMatch(/行动项/)
    expect(tpl.content).toMatch(/负责人/)
  })

  it('PPT 课件大纲模板必含"封面页 / 目录页 / 课堂练习 / 课堂小结"四个分节', () => {
    const tpl = getColdStartTemplate('ppt-outline')
    expect(tpl.content).toMatch(/封面页/)
    expect(tpl.content).toMatch(/目录页/)
    expect(tpl.content).toMatch(/课堂练习/)
    expect(tpl.content).toMatch(/课堂小结/)
  })

  it('教案模板必含"教学目标 / 重难点 / 教学过程 / 教学反思"', () => {
    const tpl = getColdStartTemplate('lesson-plan')
    expect(tpl.content).toMatch(/教学目标/)
    expect(tpl.content).toMatch(/教学重难点|重难点/)
    expect(tpl.content).toMatch(/教学过程/)
    expect(tpl.content).toMatch(/教学反思/)
  })

  it('周计划表格模板包含 Markdown 表格（| --- |）', () => {
    const tpl = getColdStartTemplate('weekly-plan')
    expect(tpl.content).toMatch(/\|.*\|.*\|/)
    expect(tpl.content).toMatch(/\|\s*-+\s*\|/)
  })

  it('工作日志模板必含"今日待办"与"明日计划"小节', () => {
    const tpl = getColdStartTemplate('daily-journal')
    expect(tpl.content).toMatch(/今日待办/)
    expect(tpl.content).toMatch(/明日计划/)
  })

  it('读书笔记模板必含"核心观点"与"评分"', () => {
    const tpl = getColdStartTemplate('reading-notes')
    expect(tpl.content).toMatch(/核心观点/)
    expect(tpl.content).toMatch(/评分/)
  })

  it('路演 PPT 模板必含"问题 / 方案 / 市场 / 团队 / 融资"', () => {
    const tpl = getColdStartTemplate('pitch-deck')
    expect(tpl.content).toMatch(/问题/)
    expect(tpl.content).toMatch(/方案/)
    expect(tpl.content).toMatch(/市场/)
    expect(tpl.content).toMatch(/团队/)
    expect(tpl.content).toMatch(/融资/)
  })

  it('产品介绍 PPT 模板必含"产品定位 / 核心功能 / 定价"', () => {
    const tpl = getColdStartTemplate('product-intro')
    expect(tpl.content).toMatch(/产品定位/)
    expect(tpl.content).toMatch(/核心功能/)
    expect(tpl.content).toMatch(/定价/)
  })

  it('试卷模板必含"填空题 / 选择题 / 应用题"', () => {
    const tpl = getColdStartTemplate('exam-paper')
    expect(tpl.content).toMatch(/填空题/)
    expect(tpl.content).toMatch(/选择题/)
    expect(tpl.content).toMatch(/应用题/)
  })

  it('学生评语模板必含"思想品德 / 学习态度 / 学期寄语"', () => {
    const tpl = getColdStartTemplate('student-evaluation')
    expect(tpl.content).toMatch(/思想品德/)
    expect(tpl.content).toMatch(/学习态度/)
    expect(tpl.content).toMatch(/学期寄语/)
  })

  it('面试记录模板必含"综合评估 / 后续动作"', () => {
    const tpl = getColdStartTemplate('interview-notes')
    expect(tpl.content).toMatch(/综合评估/)
    expect(tpl.content).toMatch(/后续动作/)
  })

  it('思维导图模板必含"中心主题"与"分支"', () => {
    const tpl = getColdStartTemplate('mind-map')
    expect(tpl.content).toMatch(/中心主题/)
    expect(tpl.content).toMatch(/分支一/)
  })

  it('看板模板必含"待办 / 进行中 / 已完成"', () => {
    const tpl = getColdStartTemplate('kanban')
    expect(tpl.content).toMatch(/待办/)
    expect(tpl.content).toMatch(/进行中/)
    expect(tpl.content).toMatch(/已完成/)
  })

  it('项目跟踪表模板必含"里程碑"与"风险"', () => {
    const tpl = getColdStartTemplate('project-tracker')
    expect(tpl.content).toMatch(/里程碑/)
    expect(tpl.content).toMatch(/风险/)
  })

  it('书评模板必含"亮点 / 不足 / 我的推荐"', () => {
    const tpl = getColdStartTemplate('book-review')
    expect(tpl.content).toMatch(/亮点/)
    expect(tpl.content).toMatch(/不足/)
    expect(tpl.content).toMatch(/我的推荐/)
  })

  it('学习总结模板必含"知识地图 / 核心概念 / 典型例题"', () => {
    const tpl = getColdStartTemplate('study-summary')
    expect(tpl.content).toMatch(/知识地图/)
    expect(tpl.content).toMatch(/核心概念/)
    expect(tpl.content).toMatch(/典型例题/)
  })

  it('待办清单模板必含四象限优先级 P0/P1/P2/P3', () => {
    const tpl = getColdStartTemplate('todo-list')
    expect(tpl.content).toMatch(/P0/)
    expect(tpl.content).toMatch(/P1/)
    expect(tpl.content).toMatch(/P2/)
    expect(tpl.content).toMatch(/P3/)
  })

  it('公众号文章模板必含"引子 / 结尾 / 互动引导"', () => {
    const tpl = getColdStartTemplate('wechat-article')
    expect(tpl.content).toMatch(/引子/)
    expect(tpl.content).toMatch(/结尾/)
    expect(tpl.content).toMatch(/互动引导/)
  })

  it('写小说模板必含"故事梗概 / 主要人物 / 情节大纲"', () => {
    const tpl = getColdStartTemplate('novel-writing')
    expect(tpl.content).toMatch(/故事梗概/)
    expect(tpl.content).toMatch(/主要人物/)
    expect(tpl.content).toMatch(/情节大纲/)
  })
})