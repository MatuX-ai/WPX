<script setup>
/**
 * <EndSlide> - 演示文稿结束页
 *
 * 用法：
 *   <EndSlide
 *     text="感谢观看"
 *     :contact-info="{
 *       email: 'hi@example.com',
 *       website: 'https://example.com',
 *       phone: '+86 138 0000 0000'
 *     }"
 *     theme="light"
 *   />
 *
 * contactInfo 字段（全部可选）：
 *   {
 *     email?: string,
 *     phone?: string,
 *     website?: string,
 *     wechat?: string,
 *     github?: string,
 *     twitter?: string,
 *     [custom: string]: string | undefined
 *   }
 *
 * 设计要点：
 * - 居中显示致谢/结束语
 * - 可选 contactInfo 以图标 + 文案行展示
 * - 16:9 固定宽高比，浅色 / 深色双主题
 */
import { computed } from 'vue'

const props = defineProps({
  /** 结束页主文案（如「感谢观看」「Thank You」「Q & A」） */
  text: { type: String, required: true },
  /**
   * 联系信息。键名固定为 email/phone/website/wechat/github/twitter，
   * 其他键会按顺序追加展示（label 友好化）
   */
  contactInfo: {
    type: Object,
    default: null,
    validator: (v) =>
      v === null ||
      (typeof v === 'object' &&
        Object.values(v).every((x) => x === undefined || typeof x === 'string')),
  },
  /** 主题：light | dark */
  theme: {
    type: String,
    default: 'light',
    validator: (v) => ['light', 'dark'].includes(v),
  },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)

/** 字段展示顺序与图标映射 */
const FIELD_META = {
  email: { label: '邮箱', icon: '✉' },
  phone: { label: '电话', icon: '☎' },
  website: { label: '网站', icon: '🌐' },
  wechat: { label: '微信', icon: '💬' },
  github: { label: 'GitHub', icon: '⌥' },
  twitter: { label: 'Twitter', icon: '𝕏' },
}

const contactEntries = computed(() => {
  if (!props.contactInfo || typeof props.contactInfo !== 'object') return []
  // 先按 FIELD_META 顺序，再追加自定义字段
  const known = Object.keys(FIELD_META)
  const custom = Object.keys(props.contactInfo).filter((k) => !known.includes(k))
  const ordered = [...known, ...custom]
  return ordered
    .map((key) => {
      const value = props.contactInfo[key]
      if (!value) return null
      const meta = FIELD_META[key] || { label: key, icon: '•' }
      return { key, label: meta.label, icon: meta.icon, value }
    })
    .filter(Boolean)
})
</script>

<template>
  <div
    class="wpx-slide wpx-slide--end"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    aria-label="结束页"
  >
    <!-- 装饰背景 -->
    <div class="wpx-end__bg" aria-hidden="true" />
    <div class="wpx-end__halo wpx-end__halo--top" aria-hidden="true" />
    <div class="wpx-end__halo wpx-end__halo--bottom" aria-hidden="true" />

    <div class="wpx-end__content">
      <p class="wpx-end__eyebrow" aria-hidden="true">END</p>
      <h1 class="wpx-end__text">{{ text }}</h1>
      <div class="wpx-end__accent-bar" aria-hidden="true" />

      <ul
        v-if="contactEntries.length > 0"
        class="wpx-end__contacts"
        aria-label="联系方式"
      >
        <li
          v-for="entry in contactEntries"
          :key="entry.key"
          class="wpx-end__contact"
        >
          <span class="wpx-end__contact-icon" aria-hidden="true">{{ entry.icon }}</span>
          <span class="wpx-end__contact-label">{{ entry.label }}</span>
          <span class="wpx-end__contact-value">{{ entry.value }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.wpx-slide {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--theme-radius-lg, 16px);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(15, 23, 42, 0.14));
  font-family: var(--theme-font-sans, Inter, system-ui, sans-serif);
}

.wpx-slide--light {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  color: #1a1a1a;
}

.wpx-slide--dark {
  background: linear-gradient(135deg, #1e1e1e 0%, #252525 100%);
  color: #e0e0e0;
}

.wpx-end__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.wpx-end__halo {
  position: absolute;
  width: 50%;
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.25;
  z-index: 0;
}

.wpx-end__halo--top {
  top: -20%;
  right: -10%;
  background: var(--theme-accent, #7c3aed);
}

.wpx-end__halo--bottom {
  bottom: -20%;
  left: -10%;
  background: var(--theme-accent-hover, #6d28d9);
}

.wpx-slide--dark .wpx-end__halo--top {
  background: #3b82f6;
}

.wpx-slide--dark .wpx-end__halo--bottom {
  background: #60a5fa;
}

.wpx-end__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 6% 8%;
  max-width: 90%;
}

.wpx-end__eyebrow {
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  margin: 0 0 1rem 0;
  color: var(--theme-accent, #7c3aed);
  opacity: 0.7;
}

.wpx-slide--dark .wpx-end__eyebrow {
  color: #60a5fa;
}

.wpx-end__text {
  font-size: clamp(2.5rem, 7vw, 5.5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin: 0 0 1.25rem 0;
  word-break: break-word;
}

.wpx-end__accent-bar {
  width: 5rem;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    var(--theme-accent, #7c3aed) 0%,
    var(--theme-accent-hover, #6d28d9) 100%
  );
  margin-bottom: 2rem;
}

.wpx-slide--dark .wpx-end__accent-bar {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
}

.wpx-end__contacts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem 1.5rem;
  max-width: 100%;
}

.wpx-end__contact {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: clamp(0.85rem, 1.3vw, 1.0625rem);
  line-height: 1.4;
  padding: 0.5rem 0.875rem;
  border-radius: 999px;
  background: var(--theme-bg-subtle, #f8fafc);
  border: 1px solid var(--theme-border, #e2e8f0);
}

.wpx-slide--dark .wpx-end__contact {
  background: #2d2d2d;
  border-color: #404040;
}

.wpx-end__contact-icon {
  font-size: 1.1em;
  line-height: 1;
}

.wpx-end__contact-label {
  font-weight: 600;
  opacity: 0.8;
}

.wpx-end__contact-value {
  opacity: 0.95;
  word-break: break-all;
}
</style>
