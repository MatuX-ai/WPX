<!--
  SectionPricing · 价格区
-->
<script setup>
/**
 * SectionPricing.vue · 收费说明
 *
 * 重要：WPX V1.1 起为「完全免费」模式。
 *   - 工具本身永久免费（编辑器、PDF 互转、模板、多窗口……）
 *   - AI 能力完全免费：用户需在桌面端「设置 → 我的模型」自行配置第三方大模型 API
 *     （兼容 OpenAI Chat Completions 协议，覆盖 DeepSeek、智谱 GLM、通义千问、文心一言、
 *      豆包、Kimi、腾讯混元、SiliconFlow 等全部国产大模型）。
 *   - 字体完全免费：用户可在「设置 → 字体」中下载开源免费字体或导入本地已授权字体。
 *   - WPX 不再提供任何平台内置大模型、不再经营商业字体 / Token 售卖业务。
 *   - 不收月费、不收年费、不绑架、不弹窗、不弹付费提示。
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
    name: 'AI 大模型接入',
    badge: '完全免费',
    price: '¥0',
    period: '需自备 API',
    desc: '用户在桌面端「设置 → 我的模型」中自行配置第三方大模型 API，WPX 不收取任何平台服务费。',
    items: [
      '兼容 OpenAI Chat Completions 协议',
      '内置国产大模型预设：DeepSeek / 智谱 GLM / 通义千问 / 文心一言 / 豆包 / Kimi / 腾讯混元 / SiliconFlow',
      'API Key 本机 AES 加密存储，不上传 WPX',
      '支持本地推理：Ollama / LM Studio',
      '费用由用户与模型服务商结算，WPX 零抽成'
    ],
    cta: '查看大模型接入教程',
    highlight: false,
    free: true
  },
  {
    name: '字体支持',
    badge: '完全免费',
    price: '¥0',
    period: '需自导入',
    desc: '用户在「设置 → 字体」中下载开源免费字体或导入本地已授权字体，WPX 不经营商业字体。',
    items: [
      '内置 100+ 开源免费字体直接用',
      '可下载思源黑体 / 思源宋体等开源中文字体',
      '支持导入本地 .ttf / .otf / .woff / .woff2',
      '商业字体需用户自行采购授权后导入',
      '字体许可证可一键查看'
    ],
    cta: '查看字体管理说明',
    highlight: false,
    free: true
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

function scrollToAiGuide() {
  if (typeof document === 'undefined') return
  const el = document.getElementById('ai-guide')
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

function scrollToFontGuide() {
  if (typeof document === 'undefined') return
  const el = document.getElementById('font-guide')
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

function handleCta(s) {
  if (s.name === '工具本体') return scrollToDownload()
  if (s.name === 'AI 大模型接入') return scrollToAiGuide()
  if (s.name === '字体支持') return scrollToFontGuide()
  return scrollToFaq()
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
          <span class="wpx-gradient-text">完全免费 · 一行代码也不收</span>
        </h2>
        <p class="mt-4 text-dark/60">
          工具本体永久免费，AI 能力和字体由用户自行接入/导入，<strong class="text-emerald-700">WPX 不收取任何平台服务费</strong>。
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
          <!-- 顶部徽章：永久免费 / 完全免费 -->
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

          <!-- CTA -->
          <button
            type="button"
            :class="[
              'mt-8 w-full text-center cursor-pointer',
              s.highlight
                ? 'wpx-btn-primary !bg-gradient-to-r !from-emerald-500 !to-emerald-600'
                : 'wpx-btn-ghost'
            ]"
            @click="handleCta(s)"
          >
            {{ s.cta }}
            <span aria-hidden="true">→</span>
          </button>
        </article>
      </div>

      <!-- 底部补充说明：完全免费模式 -->
      <div class="mt-12 rounded-2xl bg-white/80 p-6 ring-1 ring-emerald-200/60 shadow-sm">
        <div class="flex items-start gap-3">
          <span class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">✓</span>
          <div>
            <p class="font-semibold text-emerald-700">为什么是「完全免费」？</p>
            <p class="mt-1 text-sm text-dark/70 leading-relaxed">
              WPX 始终相信好工具应该人人可用。V1.1 起我们撤掉所有平台内置大模型服务与商业字体售卖业务，
              把 AI 与字体的选择权完全交回给用户。你可以在本地接入任何兼容 OpenAI 协议的国产 / 国外大模型，
              也可以自由使用任何已获合法授权的字体，<strong class="text-dark">WPX 不收任何平台服务费、不抽成、不收 Token 费</strong>。
            </p>
          </div>
        </div>
      </div>

      <!-- 底部附加说明 -->
      <div class="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-dark/60">
        <div class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full bg-emerald-500" />
          <span>不订阅 · 不月费 · 不自动扣款</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full bg-emerald-500" />
          <span>大模型与字体由用户自备，平台零抽成</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full bg-emerald-500" />
          <span>API Key 仅本地加密，不上传 WPX</span>
        </div>
      </div>
    </div>
  </section>
</template>
