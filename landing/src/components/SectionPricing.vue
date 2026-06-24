<!--
  SectionPricing · 价格区
-->
<script setup>
/**
 * SectionPricing.vue · 收费说明
 *
 * 重要：WPX 不是订阅制，是按需收费。
 *   - 工具本身永久免费（编辑器、PDF 互转、模板、多窗口……）
 *   - 唯一收费项：
 *       1) AI 算力 Token：调云端大模型时按 Token 扣费，注册用户每日有免费额度
 *       2) 商业字体 Token：嵌入商业字体导出时按字扣费（1 汉字 = 1 Token）
 *   - 不收月费、不收年费、不绑架、不弹窗。
 */

const scenarios = [
  {
    name: '工具本体',
    badge: '永久免费',
    price: '¥0',
    period: '永久',
    desc: '编辑器、文件管理、多窗口、PDF 互转、Skills 市场……全都不要钱。',
    items: [
      '完整编辑器与多窗口独立编辑',
      'PDF / DOCX / Markdown 互转',
      '32 款内置免费 Skills',
      '免费 AI 模板生成',
      '社区与文档支持'
    ],
    cta: '立即免费下载',
    highlight: true,
    free: true
  },
  {
    name: 'AI 算力 Token',
    badge: '按需付费',
    price: '¥6',
    period: '起，按量计费',
    desc: '调用云端大模型（GPT-4 / Claude 等）时按 Token 扣费，不用不花钱。',
    items: [
      '注册即送每日免费额度（100M Token/天）',
      '多模型切换：GPT-4 / Claude / 自带 API',
      '用多少扣多少，不订阅、不月费',
      'Token 永久有效，不用完不浪费',
      '支持自带 API Key 走自己的额度'
    ],
    cta: '了解 AI 配额',
    highlight: false
  },
  {
    name: '商业字体 Token',
    badge: '按字付费',
    price: '1 字',
    period: ' = 1 Token',
    desc: '导出嵌入商业字体时按字扣费；系统字体 / 开源字体完全免费。',
    items: [
      '系统自带 100+ 免费字体直接用',
      '可自导入本地开源字体，零成本',
      '商业字体（思源黑体定制版、方正等）按字数扣 Token',
      'Token 永久有效，买了不浪费',
      '预览与排版过程不收费，仅导出扣费'
    ],
    cta: '查看字体商店',
    highlight: false
  }
]

function scrollToDownload() {
  if (typeof document === 'undefined') return
  const el = document.getElementById('download')
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

function scrollToFaq() {
  if (typeof document === 'undefined') return
  const el = document.getElementById('faq')
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <section
    id="pricing"
    class="wpx-section bg-wpx-gradient-soft"
    aria-labelledby="pricing-title"
  >
    <div class="wpx-container">
      <div class="mx-auto max-w-2xl text-center">
        <span class="wpx-chip">收费说明</span>
        <h2
          id="pricing-title"
          class="mt-4 text-3xl font-extrabold md:text-5xl"
        >
          <span class="wpx-gradient-text">工具永久免费，付费全靠走量</span>
        </h2>
        <p class="mt-4 text-dark/60">
          不订阅、不收月费、不绑架。下载永久免费，AI 算力和商业字体才花钱。
        </p>
      </div>

      <div class="mt-14 grid gap-6 md:grid-cols-3">
        <article
          v-for="s in scenarios"
          :key="s.name"
          :class="[
            'relative flex flex-col rounded-3xl border bg-white p-8 transition-all duration-300 hover:-translate-y-1',
            s.highlight
              ? 'border-transparent shadow-wpx-glow ring-2 ring-emerald-500/40'
              : 'border-dark/5 shadow-sm'
          ]"
        >
          <!-- 顶部徽章：永久免费 / 按需付费 / 按字付费 -->
          <span
            :class="[
              'absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold shadow-sm',
              s.free
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                : 'bg-wpx-gradient text-white'
            ]"
          >
            <span v-if="s.free" aria-hidden="true">🎁</span>
            {{ s.badge }}
          </span>

          <h3 class="mt-2 text-xl font-bold">
            {{ s.name }}
          </h3>
          <p class="mt-1 text-sm text-dark/60">
            {{ s.desc }}
          </p>

          <!-- 价格展示 -->
          <div class="mt-6 flex items-baseline gap-1">
            <span
              :class="[
                'font-extrabold',
                s.free
                  ? 'text-5xl text-emerald-600'
                  : 'text-4xl text-dark'
              ]"
            >{{ s.price }}</span>
            <span
              :class="[
                'text-sm',
                s.free ? 'text-emerald-700/70 font-semibold' : 'text-dark/50'
              ]"
            >{{ s.period }}</span>
          </div>

          <ul class="mt-6 space-y-3 text-sm text-dark/70">
            <li
              v-for="i in s.items"
              :key="i"
              class="flex items-start gap-2"
            >
              <span
                aria-hidden="true"
                :class="[
                  'mt-1 h-1.5 w-1.5 rounded-full shrink-0',
                  s.free ? 'bg-emerald-500' : 'bg-accent-mint'
                ]"
              />
              {{ i }}
            </li>
          </ul>

          <!-- CTA：根据场景跳不同位置 -->
          <a
            :href="s.free ? '#download' : '#faq'"
            :class="[
              'mt-8 w-full text-center',
              s.free
                ? 'wpx-btn-primary !bg-gradient-to-r !from-emerald-500 !to-emerald-600'
                : (s.highlight ? 'wpx-btn-primary' : 'wpx-btn-ghost')
            ]"
            @click.prevent="s.free ? scrollToDownload() : scrollToFaq()"
          >
            {{ s.cta }}
            <span aria-hidden="true">→</span>
          </a>
        </article>
      </div>

      <!-- 底部补充说明 -->
      <div class="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-dark/60">
        <div class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full bg-emerald-500" />
          <span>不订阅 · 不月费 · 不自动扣款</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full bg-primary-from" />
          <span>Token 永久有效，用多少扣多少</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full bg-accent-mint" />
          <span>支持自带 API Key 走自己的额度</span>
        </div>
      </div>
    </div>
  </section>
</template>
