<script setup>
/**
 * <ImageTextSlide> - 演示文稿图文页
 *
 * 用法：
 *   <ImageTextSlide
 *     title="产品介绍"
 *     text="正文描述..."
 *     image-url="/path/to/image.png"
 *     image-position="right"
 *     theme="light"
 *   />
 *
 * 设计要点：
 * - 左文右图（imagePosition='right'）或 左图右文（imagePosition='left'）
 * - 图片可设置 fit（cover/contain）
 * - 16:9 固定宽高比 + 浅色 / 深色双主题
 */
import { computed } from 'vue'

const props = defineProps({
  /** 页面标题 */
  title: { type: String, required: true },
  /** 正文文本（支持多段使用 \n\n 分隔） */
  text: { type: String, required: true },
  /** 图片 URL */
  imageUrl: { type: String, required: true },
  /**
   * 图片位置：'left' | 'right'
   * - 'right'：左文右图（默认）
   * - 'left'：左图右文
   */
  imagePosition: {
    type: String,
    default: 'right',
    validator: (v) => ['left', 'right'].includes(v),
  },
  /** 图片填充模式：'cover' | 'contain' */
  imageFit: {
    type: String,
    default: 'cover',
    validator: (v) => ['cover', 'contain'].includes(v),
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

const isImageLeft = computed(() => props.imagePosition === 'left')

// 将 text 中的 \n\n 分割为多段
const paragraphs = computed(() =>
  String(props.text || '')
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean),
)
</script>

<template>
  <div
    class="wpx-slide wpx-slide--image-text"
    :class="[themeClass, isImageLeft ? 'wpx-slide--img-left' : 'wpx-slide--img-right']"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <!-- 文本区 -->
    <div class="wpx-it__text">
      <header class="wpx-it__header">
        <h2 class="wpx-it__title">{{ title }}</h2>
        <div class="wpx-it__accent-bar" aria-hidden="true" />
      </header>
      <div class="wpx-it__body">
        <p
          v-for="(p, idx) in paragraphs"
          :key="idx"
          class="wpx-it__paragraph"
        >
          {{ p }}
        </p>
      </div>
    </div>

    <!-- 图片区 -->
    <div class="wpx-it__image-wrap">
      <img
        :src="imageUrl"
        :alt="title"
        class="wpx-it__image"
        :class="`wpx-it__image--${imageFit}`"
        loading="lazy"
        decoding="async"
      />
    </div>
  </div>
</template>

<style scoped>
.wpx-slide {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4%;
  padding: 6% 7%;
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

/* 图片在左 / 在右：通过 grid-template-columns 控制 */
.wpx-slide--img-left {
  grid-template-columns: 1fr 1fr;
}

.wpx-slide--img-right {
  grid-template-columns: 1fr 1fr;
}

.wpx-it__text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}

.wpx-it__header {
  margin-bottom: 1.75rem;
}

.wpx-it__title {
  font-size: clamp(1.75rem, 3.5vw, 2.625rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.75rem 0;
  line-height: 1.15;
}

.wpx-it__accent-bar {
  width: 3rem;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    var(--theme-accent, #7c3aed) 0%,
    var(--theme-accent-hover, #6d28d9) 100%
  );
}

.wpx-slide--dark .wpx-it__accent-bar {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
}

.wpx-it__body {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  overflow: hidden;
}

.wpx-it__paragraph {
  font-size: clamp(0.95rem, 1.5vw, 1.125rem);
  line-height: 1.65;
  margin: 0;
  text-align: justify;
  opacity: 0.92;
}

/* 图片区 */
.wpx-it__image-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  border-radius: var(--theme-radius-md, 10px);
  overflow: hidden;
  background: var(--theme-bg-muted, #f1f5f9);
}

.wpx-slide--dark .wpx-it__image-wrap {
  background: #2d2d2d;
}

.wpx-it__image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wpx-it__image--cover {
  object-fit: cover;
}

.wpx-it__image--contain {
  object-fit: contain;
}

/* 响应式：窄屏改为上下排版 */
@media (max-width: 640px) {
  .wpx-slide {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    gap: 1.25rem;
  }
  .wpx-it__image-wrap {
    min-height: 40%;
  }
}
</style>
