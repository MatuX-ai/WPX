<script setup>
/**
 * SkillsShowcase.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 32 款 Skills 展示 + 技能实验室互动
 * ------------------------------------------------------------
 */
import { ref, computed } from 'vue'

// ---------------- 技能卡片（展示 6 款，循环渲染更多） ----------------
const skills = [
  {
    icon: '📚',
    name: '教案生成器',
    desc: '输入课题与学段，一键生成含目标、过程、作业的完整教案。',
    tag: '教师',
    color: 'from-primary-from/20 to-primary-to/20'
  },
  {
    icon: '📝',
    name: '论文大纲生成器',
    desc: '基于选题与字数要求，生成符合学术规范的层级大纲。',
    tag: '学生',
    color: 'from-accent-mint/20 to-primary-from/20'
  },
  {
    icon: '❌',
    name: '错题复盘',
    desc: '拍照 / 粘贴错题，AI 自动归因、归类、给出同类练习。',
    tag: '学生',
    color: 'from-rose-300/20 to-accent-yellow/20'
  },
  {
    icon: '✍️',
    name: '作文批改',
    desc: '逐句点评结构、用词、情感，给出可执行的修改建议。',
    tag: '教师',
    color: 'from-accent-yellow/25 to-accent-mint/20'
  },
  {
    icon: '🎤',
    name: '演讲稿生成',
    desc: '根据主题、时长、听众自动生成开场、论证、收尾与金句。',
    tag: '通用',
    color: 'from-primary-to/20 to-accent-yellow/20'
  },
  {
    icon: '🎯',
    name: '考前冲刺计划',
    desc: '距考试 N 天？自动排定每日复习节奏与重点突破清单。',
    tag: '学生',
    color: 'from-accent-mint/20 to-primary-to/20'
  }
]

// 复制一份，循环 2 遍用于"可滚动"效果
const marqueeItems = computed(() => [...skills, ...skills])

// ---------------- 技能实验室 ----------------
const labInput = ref('')
const labResult = ref(null)
const labLoading = ref(false)

const labSamples = {
  教案: {
    name: '教案生成器',
    icon: '📚',
    output: [
      '【课程名称】《荷塘月色》精读',
      '【学段】高一语文 · 45 分钟',
      '',
      '一、教学目标',
      '  · 知识：理解借景抒情的手法',
      '  · 能力：赏析关键句段的语言美',
      '  · 情感：体会朱自清笔下的静谧意境',
      '',
      '二、教学过程',
      '  1. 导入（5′）: 播放夏夜荷塘的环境音',
      '  2. 整体感知（10′）: 学生默读 + 段落划分',
      '  3. 重点赏析（20′）: 通感 + 比喻 修辞讲读',
      '  4. 课堂练习（8′）: 仿写一段景物描写',
      '  5. 小结作业（2′）: 写下你心中的"月色"',
      '',
      '三、作业布置',
      '  · 完成《同步练习》第 12-15 题',
      '  · 选做：寻找身边三处"通感"案例'
    ]
  },
  论文: {
    name: '论文大纲生成器',
    icon: '📝',
    output: [
      '【题目】基于深度学习的图像去背景研究',
      '【字数】8000 字 · 本科毕业论文',
      '',
      '第一章 绪论 .......................... 1500 字',
      '  1.1 研究背景与意义',
      '  1.2 国内外研究现状',
      '  1.3 本文研究内容与结构',
      '',
      '第二章 相关技术与理论 ................ 2000 字',
      '  2.1 卷积神经网络基础',
      '  2.2 语义分割模型综述',
      '  2.3 边缘检测与后处理',
      '',
      '第三章 系统设计与实现 ................ 2500 字',
      '  3.1 整体架构',
      '  3.2 模型训练与调优',
      '  3.3 本地推理性能优化',
      '',
      '第四章 实验与分析 .................... 1500 字',
      '  4.1 数据集与评价指标',
      '  4.2 对比实验',
      '  4.3 消融实验',
      '',
      '第五章 总结与展望 .................... 500 字'
    ]
  },
  错题: {
    name: '错题复盘',
    icon: '❌',
    output: [
      '📊 已识别 3 道错题，归类为「二次函数综合」',
      '',
      '【错题 1】求 y = x² - 4x + 5 在 [0,3] 的最值',
      '  · 错因：忽略顶点不在区间内的情况',
      '  · 同类练习：y = -x² + 2x + 3, x ∈ [-1,2]',
      '',
      '【错题 2】抛物线 y = ax² + bx + c 过 (1,0)(3,0) 求 c',
      '  · 错因：a, b 关系未用对称轴',
      '  · 同类练习：过 (-2,0)(4,0)，求 a:b:c',
      '',
      '【错题 3】图像平移方向判断错误',
      '  · 错因：把"左加右减"记反',
      '  · 建议：把这个口诀写在错题本首页',
      '',
      '✅ 复习建议：先做 5 道对称轴题，再做 3 道顶点题'
    ]
  },
  作文: {
    name: '作文批改',
    icon: '✍️',
    output: [
      '【总评】78 / 100',
      '',
      '一、结构（20/25）',
      '  · 优点：六段式布局清晰，过渡自然',
      '  · 改进：第 4 段论据略显单薄，可补充数据',
      '',
      '二、语言（28/35）',
      '  · 亮点：比喻句"时间是场无声的雪"很有画面感',
      '  · 建议：减少"我觉得""其实"等口语化词',
      '',
      '三、思想（20/25）',
      '  · 立意积极，但结尾略草率',
      '  · 建议：可呼应开头的"雪"意象，形成闭环',
      '',
      '四、卷面（10/15）',
      '  · 字迹工整，第 3 段有 2 处涂改',
      '',
      '✏️ 修改建议：精简第 2 段 60 字，给结尾加一句升华'
    ]
  },
  演讲: {
    name: '演讲稿生成',
    icon: '🎤',
    output: [
      '【主题】人工智能时代的写作自由',
      '【时长】5 分钟 · 校内演讲',
      '',
      '【开场 - 30s】',
      '  各位同学，我问大家一个问题：',
      '  上一次你为软件订阅付费，是什么时候？',
      '',
      '【论述 - 3min】',
      '  · 我们已经离不开文档工具',
      '  · 但订阅制正在悄悄"税"走我们的生活费',
      '  · 一个学生，一年要为软件花掉 ¥500+',
      '',
      '【案例 - 1min】',
      '  "PDF 转 Word 要会员"、"模板要钱"、"广告弹窗"',
      '  这不是工具，是绑架。',
      '',
      '【收尾 - 30s · 金句】',
      '  写作应当是自由的事，而不是一笔月供。',
      '  WPX 愿意陪你把这份自由拿回来。',
      '  谢谢大家。'
    ]
  },
  冲刺: {
    name: '考前冲刺计划',
    icon: '🎯',
    output: [
      '📅 距高考 28 天 · 已为你生成冲刺计划',
      '',
      '【第 1 周】基础稳固（剩 28-22 天）',
      '  · 每日：1 套真题 + 错题订正',
      '  · 重点：数学三角函数 / 语文古诗词默写',
      '  · 时间分配：60% 做题 + 40% 复盘',
      '',
      '【第 2 周】专项突破（剩 21-15 天）',
      '  · 数学：圆锥曲线、导数压轴',
      '  · 理综：物理电磁学大题',
      '  · 语文：作文素材库扩展',
      '',
      '【第 3 周】模拟实战（剩 14-8 天）',
      '  · 每日 8:00-17:00 完整模拟',
      '  · 模拟后立即复盘 + 错题归档',
      '',
      '【最后 7 天】心态 + 微调',
      '  · 停止做新题，只看错题本',
      '  · 23:00 前必须睡觉',
      '  · 准备好身份证、准考证、文具袋',
      '',
      '💪 你已经准备了一整年，相信自己。'
    ]
  }
}

function pickByKeyword(text) {
  const t = text || ''
  if (/教|课|学|单元|讲/.test(t)) return labSamples.教案
  if (/论|文|毕业|研究|开题/.test(t)) return labSamples.论文
  if (/错|不会|难题|题/.test(t)) return labSamples.错题
  if (/作文|散文|文章|周记|读后感/.test(t)) return labSamples.作文
  if (/演讲|发言|答辩|致辞/.test(t)) return labSamples.演讲
  if (/考试|高考|中考|冲刺|复习|备考/.test(t)) return labSamples.冲刺
  // 关键词未命中 → 全部 6 个里随机
  const list = Object.values(labSamples)
  return list[Math.floor(Math.random() * list.length)]
}

function runLab() {
  const text = labInput.value.trim()
  if (!text || labLoading.value) return
  labLoading.value = true
  labResult.value = null

  // 模拟 800-1400ms 生成延时
  const delay = 800 + Math.random() * 600
  setTimeout(() => {
    labResult.value = pickByKeyword(text)
    labLoading.value = false
  }, delay)
}

function onLabEnter() {
  runLab()
}

function resetLab() {
  labInput.value = ''
  labResult.value = null
}
</script>

<template>
  <section class="wpx-section">
    <div class="wpx-container">
      <!-- ========== 标题 ========== -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">Skills 技能</span>
        <h2 class="mt-4 text-[1.6rem] font-extrabold leading-tight sm:text-3xl md:text-5xl">
          <span class="wpx-gradient-text">你的 AI，你说了算。</span>
        </h2>
        <p class="mt-4 text-lg text-dark/65">
          内置 <strong class="text-primary-600">32</strong> 款免费 Skills，
          教师和大学生开箱即用。
        </p>
      </div>

      <!-- ========== 技能卡片网格（3 列） ========== -->
      <div class="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="(s, idx) in skills"
          :key="s.name"
          class="group relative overflow-hidden rounded-2xl border border-dark/5 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-wpx"
        >
          <!-- 渐变装饰球 -->
          <div
            :class="[
              'absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-50 blur-2xl transition-opacity group-hover:opacity-100',
              s.color
            ]"
          />

          <!-- 角标 -->
          <span
            class="absolute right-4 top-4 rounded-full bg-wpx-gradient-soft px-2.5 py-0.5 text-[10px] font-semibold text-primary-600"
          >
            {{ s.tag }}
          </span>

          <!-- 图标 -->
          <div
            class="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-wpx-gradient-soft text-3xl shadow-sm"
          >
            {{ s.icon }}
          </div>

          <!-- 名称 -->
          <h3 class="relative mt-4 text-lg font-bold text-dark">
            {{ s.name }}
          </h3>

          <!-- 描述 -->
          <p class="relative mt-2 text-sm leading-relaxed text-dark/60">
            {{ s.desc }}
          </p>

          <!-- 底部按钮 -->
          <div class="relative mt-4 flex items-center justify-between text-xs">
            <span class="text-dark/40">
              #{{ String(idx + 1).padStart(2, '0') }} / 32
            </span>
            <span
              class="font-semibold text-primary-600 transition-transform group-hover:translate-x-1"
            >
              试试 →
            </span>
          </div>
        </div>
      </div>

      <!-- ========== 横向滚动条（额外的 Skills 列表） ========== -->
      <div class="mt-12 overflow-hidden rounded-2xl border border-primary-500/15 bg-wpx-gradient-soft/50">
        <div class="flex animate-marquee gap-3 px-4 py-3 text-sm text-dark/65">
          <span
            v-for="(item, i) in marqueeItems"
            :key="i"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 shadow-sm"
          >
            <span>{{ item.icon }}</span>
            <span class="font-medium">{{ item.name }}</span>
          </span>
        </div>
      </div>

      <!-- ========== 技能实验室 ========== -->
      <div
        class="lab mt-20 overflow-hidden rounded-3xl border border-primary-500/20 bg-white shadow-wpx-glow"
      >
        <!-- 顶部标签 -->
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-dark/5 bg-wpx-gradient-soft/60 px-6 py-4 md:px-8"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-wpx-gradient text-white shadow-wpx"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
            </div>
            <div>
              <div class="text-lg font-bold text-dark">
                技能实验室
              </div>
              <div class="text-xs text-dark/50">
                纯娱乐 · 不会真的调用 AI · 但会假装很懂
              </div>
            </div>
          </div>
          <div class="text-xs text-dark/40">
            <span class="font-mono">v0.1 · demo</span>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="grid gap-6 p-6 md:grid-cols-2 md:gap-8 md:p-8">
          <!-- 左：输入 -->
          <div>
            <label class="text-sm font-semibold text-dark">
              描述你现在的需求
            </label>
            <p class="mt-1 text-xs text-dark/50">
              例：帮我生成一份高一语文教案 / 我要高考冲刺 / 改一下我的作文
            </p>
            <div class="mt-3 flex gap-2">
              <input
                v-model="labInput"
                type="text"
                placeholder="一句话告诉我你要干嘛…"
                class="flex-1 rounded-xl border border-dark/10 bg-light/50 px-4 py-3 text-sm text-dark outline-none transition-all focus:border-primary-500/50 focus:bg-white focus:ring-2 focus:ring-primary-500/20"
                :disabled="labLoading"
                @keydown.enter="onLabEnter"
              />
              <button
                class="inline-flex items-center gap-1.5 rounded-xl bg-wpx-gradient px-5 py-3 text-sm font-semibold text-white shadow-wpx transition-all duration-200 hover:-translate-y-0.5 hover:shadow-wpx-glow disabled:opacity-60"
                :disabled="!labInput.trim() || labLoading"
                @click="runLab"
              >
                <span v-if="labLoading" class="inline-block animate-spin">⏳</span>
                <span v-else>🎲</span>
                <span>{{ labLoading ? '匹配中…' : '随机匹配' }}</span>
              </button>
            </div>

            <!-- 示例按钮 -->
            <div class="mt-4 flex flex-wrap gap-2">
              <span class="text-xs text-dark/50">试试：</span>
              <button
                v-for="sample in ['高考数学冲刺', '论文大纲', '作文批改', '演讲稿']"
                :key="sample"
                class="rounded-full bg-wpx-gradient-soft px-3 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-500/15 disabled:opacity-50"
                :disabled="labLoading"
                @click="labInput = sample"
              >
                {{ sample }}
              </button>
            </div>
          </div>

          <!-- 右：结果 -->
          <div class="relative min-h-[260px]">
            <!-- 空状态 -->
            <div
              v-if="!labResult && !labLoading"
              class="flex h-full min-h-[260px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-dark/10 bg-light/30 px-6 py-10 text-center text-dark/50"
            >
              <div class="text-5xl">
                🧪
              </div>
              <div class="mt-3 text-sm">
                输入需求，点击"随机匹配"
                <br />
                AI 会为你挑选最合适的 Skill
              </div>
            </div>

            <!-- 加载中 -->
            <div
              v-if="labLoading"
              class="flex h-full min-h-[260px] flex-col items-center justify-center rounded-2xl border border-primary-500/30 bg-wpx-gradient-soft/60"
            >
              <div class="flex items-center gap-2 text-primary-600">
                <span class="inline-block h-3 w-3 animate-bounce rounded-full bg-primary-from [animation-delay:-0.3s]" />
                <span class="inline-block h-3 w-3 animate-bounce rounded-full bg-primary-via [animation-delay:-0.15s]" />
                <span class="inline-block h-3 w-3 animate-bounce rounded-full bg-primary-to" />
              </div>
              <div class="mt-3 text-sm text-dark/60">
                正在分析关键词、挑选 Skill、组装结果…
              </div>
            </div>

            <!-- 结果展示 -->
            <div
              v-if="labResult && !labLoading"
              class="result-card relative overflow-hidden rounded-2xl border border-primary-500/30 bg-white shadow-wpx"
            >
              <!-- 标题栏 -->
              <div class="flex items-center gap-3 border-b border-primary-500/20 bg-wpx-gradient-soft/60 px-5 py-3">
                <div class="text-2xl">
                  {{ labResult.icon }}
                </div>
                <div class="flex-1">
                  <div class="text-sm font-bold text-dark">
                    {{ labResult.name }}
                  </div>
                  <div class="text-[10px] text-primary-600">
                    ✓ 已为你匹配
                  </div>
                </div>
                <button
                  class="rounded-md px-2 py-1 text-xs text-dark/50 transition-colors hover:bg-dark/5 hover:text-dark"
                  @click="resetLab"
                >
                  再来一次
                </button>
              </div>
              <!-- 输出 -->
              <pre
                class="max-h-72 overflow-y-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-dark/80"
              >{{ labResult.output.join('\n') }}</pre>
              <!-- 底部 -->
              <div class="border-t border-primary-500/15 bg-light/30 px-5 py-2 text-[10px] text-dark/50">
                ※ 这是预生成的演示内容 · 真实 Skill 会在 WPX 中动态生成
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ============== 横向 marquee 滚动 ============== */
@keyframes wpxMarquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.animate-marquee {
  animation: wpxMarquee 28s linear infinite;
}
.animate-marquee:hover {
  animation-play-state: paused;
}

/* ============== 减少动效 ============== */
@media (prefers-reduced-motion: reduce) {
  .animate-marquee {
    animation: none;
  }
  .animate-bounce {
    animation: none;
  }
}
</style>
