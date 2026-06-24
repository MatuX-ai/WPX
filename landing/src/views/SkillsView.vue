<script setup>
/**
 * SkillsView.vue
 * ------------------------------------------------------------
 * WPX 营销站 · Skills 市场
 *
 *  - Tab 切换：全部 / 学生 / 教师 / 通用
 *  - 每张 Skill 卡片：ID + 名称 + 一句话能力
 *  - 底部 CTA：查看全部 + 提交你的 Skill
 * ------------------------------------------------------------
 */
import { ref, computed } from 'vue'

const tabs = [
  { id: 'all', label: '全部' },
  { id: 'student', label: '学生' },
  { id: 'teacher', label: '教师' },
  { id: 'general', label: '通用' }
]
const activeTab = ref('all')

const skills = [
  // 学生 · 学术写作
  { id: 'paper-outline', name: '论文大纲生成器', cat: 'student', group: '学术写作',
    desc: '自动生成包含摘要、引言、文献综述、分析框架、结论的标准学术大纲。' },
  { id: 'literature-review', name: '文献综述助手', cat: 'student', group: '学术写作',
    desc: '分析多篇文献摘要，梳理研究脉络、归纳流派、指出研究空白。' },
  { id: 'paraphrase-academic', name: '查重降重润色', cat: 'student', group: '学术写作',
    desc: '保持学术严谨性的前提下，变换句式、替换词汇、重组段落结构。' },
  { id: 'paper-formatter', name: '论文排版助手', cat: 'student', group: '学术写作',
    desc: '按 GB/T 7714 / APA / MLA 自动生成封面、目录、页眉页脚、参考文献。' },
  { id: 'proposal-generator', name: '开题报告生成器', cat: 'student', group: '学术写作',
    desc: '生成选题背景、研究意义、国内外现状、研究方法、进度安排完整框架。' },
  // 学生 · 学习辅助
  { id: 'note-organizer', name: '笔记整理', cat: 'student', group: '学习辅助',
    desc: '将零散笔记整理为分层级的知识点笔记，标记重点概念。' },
  { id: 'concept-explainer', name: '概念解释器', cat: 'student', group: '学习辅助',
    desc: '用生活化语言解释复杂概念，提供类比、案例、图解描述。' },
  { id: 'mistake-review', name: '错题复盘', cat: 'student', group: '学习辅助',
    desc: '诊断知识盲点，总结通用解题模板，推荐同类练习方向。' },
  { id: 'exam-cram-plan', name: '考前冲刺计划', cat: 'student', group: '学习辅助',
    desc: '根据考试科目、剩余天数、当前水平生成每日复习计划与重点优先级。' },
  // 学生 · 其余大类占位
  { id: 'knowledge-graph', name: '知识图谱', cat: 'student', group: '知识管理',
    desc: '从笔记自动抽取实体与关系，生成可视化知识网络。' },
  { id: 'ppt-from-notes', name: '笔记转 PPT', cat: 'student', group: '展示汇报',
    desc: '将课堂笔记一键转换为结构化演示文稿，支持大纲驱动模式。' },
  { id: 'study-planner', name: '学业规划', cat: 'student', group: '学业规划',
    desc: '根据培养方案与个人目标，生成多学期学习与竞赛规划。' },

  // 教师 · 教学准备
  { id: 'lesson-plan-generator', name: '教案生成器', cat: 'teacher', group: '教学准备',
    desc: '根据课题和教材版本生成结构化教案，含教学目标与时长分配。' },
  { id: 'courseware-outline', name: '课件大纲提取', cat: 'teacher', group: '教学准备',
    desc: '将教案提炼为 PPT 要点大纲，保留教学逻辑与重点。' },
  { id: 'knowledge-breakdown', name: '知识点拆解', cat: 'teacher', group: '教学准备',
    desc: '将知识点拆解为递进式问题链，便于课堂讲授。' },
  { id: 'cross-subject-connection', name: '跨学科关联', cat: 'teacher', group: '教学准备',
    desc: '分析当前知识点在其他学科的应用场景与教学切入点。' },
  // 教师 · 出题测评
  { id: 'smart-quiz-generator', name: '智能出题', cat: 'teacher', group: '出题测评',
    desc: '自动生成分层练习题（基础/进阶/拓展），附解析和评分标准。' },
  { id: 'variant-question-generator', name: '变式题生成', cat: 'teacher', group: '出题测评',
    desc: '基于原题生成变式训练题，避免刷题疲劳。' },
  { id: 'exam-analyzer', name: '试卷分析', cat: 'teacher', group: '出题测评',
    desc: '分析考点分布、难度与区分度，辅助命题复盘。' },
  { id: 'error-analysis', name: '错题归因', cat: 'teacher', group: '出题测评',
    desc: '分析错题背后的知识盲点，形成教学改进建议。' },
  // 教师 · 批改反馈
  { id: 'essay-grader', name: '作文批改', cat: 'teacher', group: '批改反馈',
    desc: '多维度批改作文（立意、结构、语言），给出修改示范。' },
  { id: 'comment-generator', name: '评语生成器', cat: 'teacher', group: '批改反馈',
    desc: '根据学生表现生成个性化期末评语，温暖且具体。' },
  // 教师 · 沟通管理
  { id: 'parent-meeting-speech', name: '家长会发言稿', cat: 'teacher', group: '沟通管理',
    desc: '生成结构完整的家长会发言稿，含数据支撑与建议。' },
  { id: 'notice-generator', name: '通知/告家长书', cat: 'teacher', group: '沟通管理',
    desc: '快速生成规范的学校通知文本，支持多种场景。' },
  // 教师 · 个人成长
  { id: 'teaching-reflection', name: '教学反思', cat: 'teacher', group: '个人成长',
    desc: '将课堂口述整理为结构化反思，形成可持续的改进闭环。' },
  { id: 'research-proposal-helper', name: '课题申报书辅助', cat: 'teacher', group: '个人成长',
    desc: '生成课题申报书的章节框架与要点提示。' },

  // 通用
  { id: 'general-continue', name: '智能续写', cat: 'general', group: '写作',
    desc: '基于当前上下文续写，保持风格与语气一致。' },
  { id: 'general-rewrite', name: '智能改写', cat: 'general', group: '写作',
    desc: '在保留原意的前提下，换种说法表达。' },
  { id: 'general-translate', name: '多语翻译', cat: 'general', group: '写作',
    desc: '中英日韩等主流语种互译，学术与口语风格可选。' },
  { id: 'general-summarize', name: '一键总结', cat: 'general', group: '阅读',
    desc: '将长文提炼为要点列表 / 摘要 / TL;DR。' },
  { id: 'general-qa', name: '文档问答', cat: 'general', group: '阅读',
    desc: '基于当前文档内容回答问题，自动引用原文位置。' }
]

const filteredSkills = computed(() => {
  if (activeTab.value === 'all') return skills
  return skills.filter((s) => s.cat === activeTab.value)
})

const groupedSkills = computed(() => {
  const groups = {}
  for (const s of filteredSkills.value) {
    if (!groups[s.group]) groups[s.group] = []
    groups[s.group].push(s)
  }
  return Object.entries(groups).map(([title, items]) => ({ title, items }))
})
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <!-- Hero -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">Skills 市场</span>
        <h1 class="mt-4 text-4xl font-extrabold md:text-5xl">
          <span class="wpx-gradient-text">把 WPX 变成最懂你的工作台</span>
        </h1>
        <p class="mt-4 text-dark/60">
          内置 32 款专业 Skills + 5 款通用 Skills，按需启用，可自定义提示词。
        </p>
      </div>

      <!-- Tabs -->
      <div class="mt-12 flex flex-wrap items-center justify-center gap-2">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="rounded-full border px-4 py-2 text-sm font-semibold transition-all"
          :class="activeTab === t.id
            ? 'border-transparent bg-wpx-gradient text-white shadow-wpx'
            : 'border-dark/10 bg-white text-dark/70 hover:border-primary-500/40 hover:text-primary-600'"
          @click="activeTab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- Grouped Skill Cards -->
      <div
        v-for="g in groupedSkills"
        :key="g.title"
        class="mt-12"
      >
        <h2 class="flex items-center gap-2 text-xl font-extrabold">
          <span class="inline-block h-5 w-1 rounded-full bg-wpx-gradient" />
          {{ g.title }}
        </h2>
        <div class="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="s in g.items"
            :key="s.id"
            class="group rounded-2xl border border-dark/5 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-wpx"
          >
            <div class="flex items-start justify-between gap-3">
              <h3 class="text-base font-bold group-hover:text-primary-600">
                {{ s.name }}
              </h3>
              <span class="rounded-full bg-wpx-gradient-soft px-2 py-0.5 text-[10px] font-semibold text-primary-600">
                内置
              </span>
            </div>
            <p class="mt-2 text-sm leading-relaxed text-dark/60">
              {{ s.desc }}
            </p>
            <code class="mt-3 inline-block rounded bg-dark/5 px-2 py-0.5 text-[11px] font-mono text-dark/60">
              {{ s.id }}
            </code>
          </article>
        </div>
      </div>

      <!-- Bottom CTA -->
      <div
        class="mt-20 rounded-3xl bg-wpx-gradient-soft p-10 text-center"
      >
        <h2 class="text-2xl font-extrabold md:text-3xl">
          <span class="wpx-gradient-text">想贡献自己的 Skill？</span>
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-dark/70">
          Skill 本质是一段带参数的 Prompt 模板。只要你能清晰描述输入输出，我们就能帮你把它包装成可复用的 Skill。
        </p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/wpx-team/wpx/discussions/categories/skills"
            target="_blank"
            rel="noopener noreferrer"
            class="wpx-btn-primary"
          >
            提交你的 Skill 想法
          </a>
          <router-link
            to="/docs#custom-skill"
            class="wpx-btn-ghost"
          >
            查看自定义 Skill 文档
          </router-link>
        </div>
      </div>
    </div>
  </section>
</template>
