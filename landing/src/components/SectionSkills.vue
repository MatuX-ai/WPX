<!--
  SectionSkills · 内置技能区
  - 已同步 v0.1.16：双轨展示 = 精选 Skills（6 项）+ Skills 全景（折叠区 32 项明细）
-->
<script setup>
import { ref } from 'vue'

// 上段：精选 6 项（首屏可见）
const highlights = [
  { name: '论文排版', desc: '一键应用 GB/T 7714 引用与学术模板', emoji: '🎓' },
  { name: '教师教案 → 课件 PPT', desc: '教案 → 大纲 → PPT 一键生成（v0.1.15 全新）', emoji: '🧑‍🏫' },
  { name: 'AI 改写', desc: '支持 12 种语气与 6 种长度档位', emoji: '✍️' },
  { name: '图片去背景', desc: '本地 rembg 离线推理，隐私无忧', emoji: '🪄' },
  { name: '本地指令 64 条', desc: '输入 `/focus`、`/export` 等立即生效', emoji: '🛠️' },
  { name: '知识库', desc: '把资料喂给 AI，回答有据可循', emoji: '📚' }
]

// 下段：折叠 - Skills 全景（32 项明细 = 学生 16 + 教师 16）
const skillGroups = [
  {
    label: '学生 · 16 项',
    color: 'bg-primary-from/10 text-primary-600',
    items: [
      '论文大纲生成',
      '文献综述助手',
      '查重降重',
      '开题报告',
      'GB/T 7714 引用',
      '学术论文排版',
      '答辩 PPT 大纲',
      '错题复盘',
      '四级 / 六级作文',
      '读书笔记',
      '翻译润色',
      '调研报告',
      'SCI 摘要改写',
      '代码注释解释',
      '课堂笔记整理',
      '项目结题报告'
    ]
  },
  {
    label: '教师 · 16 项',
    color: 'bg-accent-yellow/25 text-amber-800',
    items: [
      '教案生成',
      '课件 PPT 一键生成（v0.1.15）',
      '智能出题',
      '作文批改',
      '家长会发言稿',
      '教学反思',
      '期中 / 期末复习提纲',
      '试卷分析',
      '教研活动方案',
      '教学设计模板',
      '听课记录',
      '学生评语',
      '公开课逐字稿',
      '知识点卡片',
      '作业布置助手',
      '课程思政素材'
    ]
  },
  {
    label: '通用 · 通用助手',
    color: 'bg-accent-mint/20 text-emerald-700',
    items: [
      'AI 改写（语气 / 长度可调）',
      '翻译助手（中英 / 中日 / 中韩）',
      'Markdown 一键美化',
      '代码片段解释',
      '图片去背景',
      'PDF OCR 离线识别',
      '7z 压缩 / 解压',
      '网页导入与排版'
    ]
  }
]

const expanded = ref(false)
</script>

<template>
  <section
    id="skills"
    class="wpx-section"
    aria-labelledby="skills-title"
  >
    <div class="wpx-container">
      <div class="mx-auto max-w-2xl text-center">
        <span class="wpx-chip">内置技能</span>
        <h2
          id="skills-title"
          class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          <span class="wpx-gradient-text">32+ Skills + 64 条本地指令</span>
        </h2>
        <p class="mt-4 text-dark/60">
          学生 / 教师 / 通用全覆盖 · 一键调用，越用越懂你。
        </p>
      </div>

      <!-- 上段：精选 6 项 -->
      <div class="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="s in highlights"
          :key="s.name"
          class="flex items-center gap-4 rounded-2xl border border-dark/5 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-wpx"
        >
          <div
            class="flex h-12 w-12 items-center justify-center rounded-xl bg-wpx-gradient-soft text-2xl"
            role="img"
            :aria-label="s.name + ' 图标'"
          >
            {{ s.emoji }}
          </div>
          <div>
            <div class="text-base font-bold">
              {{ s.name }}
            </div>
            <div class="text-sm text-dark/60">
              {{ s.desc }}
            </div>
          </div>
        </div>
      </div>

      <!-- 下段：Skills 全景折叠 -->
      <div class="mt-12 rounded-2xl border border-dark/5 bg-white p-6 transition-all sm:p-8">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-4 text-left"
          :aria-expanded="expanded"
          aria-controls="skills-panorama"
          @click="expanded = !expanded"
        >
          <div>
            <h3 class="text-lg font-bold sm:text-xl">
              <span class="wpx-gradient-text">展开 Skills 全景</span>
            </h3>
            <p class="mt-1 text-sm text-dark/60">
              共 32+ 项 Skills + 64 条本地指令，分类查看
            </p>
          </div>
          <span
            aria-hidden="true"
            :class="[
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wpx-gradient-soft text-primary-600 transition-transform',
              expanded ? 'rotate-45' : ''
            ]"
          >
            +
          </span>
        </button>

        <div
          v-show="expanded"
          id="skills-panorama"
          class="mt-6 space-y-6"
        >
          <div
            v-for="g in skillGroups"
            :key="g.label"
          >
            <div class="flex items-center gap-2">
              <span
                :class="['inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', g.color]"
              >
                {{ g.label }}
              </span>
              <span class="text-xs text-dark/40">{{ g.items.length }} 项</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="item in g.items"
                :key="item"
                class="inline-flex items-center rounded-full border border-dark/10 bg-light px-3 py-1 text-xs text-dark/75 transition-colors hover:border-primary-from/40 hover:bg-wpx-gradient-soft hover:text-primary-600"
              >
                {{ item }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 文末 CTA：查看全部 Skills -->
      <div class="mt-10 text-center">
        <router-link
          to="/skills"
          class="inline-flex items-center gap-2 rounded-full border border-primary-from/30 bg-wpx-gradient-soft px-6 py-2.5 text-sm font-semibold text-primary-600 transition-all hover:-translate-y-0.5 hover:shadow-wpx"
        >
          查看全部 Skills 与指令
          <span aria-hidden="true">→</span>
        </router-link>
      </div>
    </div>
  </section>
</template>