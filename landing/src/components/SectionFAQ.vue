<!--
  SectionFAQ · 常见问题区
  - 已随 V1.1（v0.1.16）同步：彻底移除 Token 计费、每日免费额度、商业字体按字数扣费 等表述
-->
<script setup>
// FAQ · 完全免费模式（v1.1 起生效）
// 重要变更：旧版 FAQ 中 Token 计费 / 每日免费额度 / 商业字体按字数扣费 等表述全部废弃。
const faqs = [
  {
    q: 'WPX 是免费的吗？',
    a: '工具本体永久免费：编辑器、多窗口、虚拟纸张、PDF / DOCX / Markdown 互转、本地指令系统、内置 Skills、演示文稿生成 ……全都不要钱。AI 算力与商用字体由用户自备 / 自导入，平台零抽成，不收任何 Token 费。'
  },
  {
    q: '之前说「按需 Token 计费」怎么没了？',
    a: 'V1.1 起，我们撤掉了平台内置大模型服务与商业字体售卖业务，旧 FAQ 中的 Token 计费、每日 100M 免费额度、商业字体按字数扣 Token 等说法已全部废弃。请以最新文档（docs/）为准。'
  },
  {
    q: 'AI 怎么用？需要单独购买算力吗？',
    a: '在桌面端「设置 → 我的模型」中，自行配置兼容 OpenAI Chat Completions 协议的 API：DeepSeek、智谱 GLM、通义千问、文心一言、豆包、Kimi、腾讯混元、SiliconFlow 等国产大模型都已内置预设；也支持 Ollama / LM Studio 本地推理。费用由用户与模型服务商结算，WPX 不收一分钱、不抽成、不保存你的 Key（仅本地 AES 加密）。'
  },
  {
    q: '字体从哪来？商业字体要收费吗？',
    a: '系统字体和开源字体（思源黑体 / 思源宋体 / 霞鹜文楷 / 阿里巴巴普惠体 / HarmonyOS Sans 等）开箱即用；也可在「设置 → 字体」中下载 100+ 开源免费字体，或导入本地 .ttf / .otf / .woff / .woff2。商业字体（如方正、汉仪）需用户自行采购授权后导入，WPX 不经营商业字体、不收平台费。'
  },
  {
    q: '支持哪些平台？',
    a: '首发 Windows 桌面端（Electron），macOS 与 Linux 在路线图中。所有功能在 Windows 上 100% 可用。'
  },
  {
    q: '我的文档会被上传吗？',
    a: '默认完全本地化。只有在你主动调用云端 AI 助手时，相关文本片段才会按你配置的服务商策略传输，本地 OCR、图片去背景、压缩解压、PDF 互转等都不上传。'
  }
]

const faqNotes = [
  '本 FAQ 已随 v0.1.16 同步；旧版中涉及 Token 计费、按字扣费、每日免费额度的表述已全部废弃。',
  '更多详情请查阅 docs/ 目录下的最新文档，或在桌面端「设置 → 帮助」中查看。'
]
</script>

<template>
  <section
    id="faq"
    class="wpx-section"
    aria-labelledby="faq-title"
  >
    <div class="wpx-container max-w-3xl">
      <div class="text-center">
        <span class="wpx-chip">常见问题</span>
        <h2
          id="faq-title"
          class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          <span class="wpx-gradient-text">可能你也在问</span>
        </h2>
      </div>

      <div class="mt-12 divide-y divide-dark/5 rounded-2xl border border-dark/5 bg-white">
        <details
          v-for="(f, idx) in faqs"
          :key="idx"
          class="group px-4 py-5 sm:p-6"
        >
          <summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
            <span>{{ f.q }}</span>
            <span
              aria-hidden="true"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wpx-gradient-soft text-primary-600 transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p class="mt-3 text-sm leading-relaxed text-dark/70">
            {{ f.a }}
          </p>
        </details>
      </div>

      <!-- 版本说明：标识本文内容与版本对齐（SEO a11y 友好） -->
      <div class="mt-8 space-y-1 text-center text-xs text-dark/40">
        <p v-for="(n, i) in faqNotes" :key="i">{{ n }}</p>
      </div>
    </div>
  </section>
</template>
