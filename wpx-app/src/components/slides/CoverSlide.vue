<script setup>
/**
 * <CoverSlide> - 演示文稿封面页
 *
 * 用法：
 *   <CoverSlide :title="..." :subtitle="..." :background-image="..." theme="light" />
 *
 * 设计要点：
 * - 固定 16:9 宽高比，外部容器可使用 w-full h-full
 * - 支持背景图或纯色背景：传 backgroundImage 则叠加半透明遮罩以保证可读性
 * - 浅色 / 深色双主题：使用 Tailwind 主题 token（bg-bg / text-fg 等）
 */
import { computed } from 'vue'

const props = defineProps({
  /** 主标题 */
  title: { type: String, required: true },
  /** 副标题 */
  subtitle: { type: String, default: '' },
  /** 可选背景图（URL） */
  backgroundImage: { type: String, default: '' },
  /** 主题：light | dark */
  theme: {
    type: String,
    default: 'light',
    validator: (v) => ['light', 'dark'].includes(v),
  },
})

const hasBackground = computed(() => Boolean(props.backgroundImage))
const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)
</script>

<template>
  <div
    class="wpx-slide wpx-slide--cover"
    :class="[themeClass]"
    :data-theme="theme"
    role="img"
    :aria-label="`封面：${title}`"
  >
    <!-- 背景层：图片或纯色 -->
    <div
      v-if="hasBackground"
      class="wpx-slide__bg-image"
      :style="{ backgroundImage: `url(${backgroundImage})` }"
      aria-hidden="true"
    />
    <div
      v-else
      class="wpx-slide__bg-solid"
      :class="theme === 'dark' ? 'bg-bg-subtle' : 'bg-bg-subtle'"
      aria-hidden="true"
    />
    <div class="wpx-slide__overlay" aria-hidden="true" />

    <!-- 内容层：垂直居中 -->
    <div class="wpx-slide__content">
      <h1 class="wpx-slide__title">{{ title }}</h1>
      <p v-if="subtitle" class="wpx-slide__subtitle">{{ subtitle }}</p>
      <div class="wpx-slide__accent-bar" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
/* 16:9 固定宽高比 + 主题 token 基础样式 */
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
  background-color: #ffffff;
  color: #1a1a1a;
}

.wpx-slide--dark {
  background-color: #1e1e1e;
  color: #e0e0e0;
}

.wpx-slide__bg-image,
.wpx-slide__bg-solid {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}

/* 半透明遮罩，保证标题可读 */
.wpx-slide__overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.55) 0%,
    rgba(255, 255, 255, 0.25) 100%
  );
}

.wpx-slide--dark .wpx-slide__overlay {
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.65) 0%,
    rgba(0, 0, 0, 0.35) 100%
  );
}

.wpx-slide__content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8% 6%;
  max-width: 90%;
}

.wpx-slide__title {
  font-size: clamp(2.25rem, 6vw, 5rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin: 0 0 0.5em 0;
  word-break: break-word;
}

.wpx-slide__subtitle {
  font-size: clamp(1rem, 2.4vw, 1.75rem);
  font-weight: 400;
  opacity: 0.78;
  margin: 0;
  line-height: 1.4;
}

.wpx-slide__accent-bar {
  width: 5rem;
  height: 4px;
  margin-top: 1.5rem;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    var(--theme-accent, #7c3aed) 0%,
    var(--theme-accent-hover, #6d28d9) 100%
  );
}

.wpx-slide--dark .wpx-slide__accent-bar {
  background: linear-gradient(
    90deg,
    #3b82f6 0%,
    #60a5fa 100%
  );
}
</style>
