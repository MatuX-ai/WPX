<!--
  AppPicture.vue · 支持 WebP + 原格式降级的图片组件
  - 默认开启懒加载（loading="lazy" decoding="async"）
  - 自动生成 <picture>，webp 不支持时降级到原格式
  - 支持 width/height（避免 CLS）
  - 支持 srcset（响应式 1x/2x）
-->
<script setup>
import { computed, onMounted } from 'vue'
import { buildPictureSources, probeWebpSupport } from '../utils/image.js'

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, required: true },
  width: { type: [Number, String], default: null },
  height: { type: [Number, String], default: null },
  // sizes：响应式布局
  sizes: { type: String, default: '100vw' },
  // 原始宽度（用于 srcset）
  intrinsicWidth: { type: Number, default: 0 },
  // 强制使用原格式（关闭 webp）
  disableWebp: { type: Boolean, default: false },
  // 加载优先级
  loading: { type: String, default: 'lazy' },
  fetchpriority: { type: String, default: 'auto' },
  // object-fit
  fit: { type: String, default: 'cover' },
  // 是否响应式高度（用 aspect-ratio）
  aspectRatio: { type: String, default: '' }
})

const sources = computed(() =>
  buildPictureSources(props.src, {
    webp: !props.disableWebp,
    width: props.intrinsicWidth || Number(props.width) || 0,
    sizes: props.sizes
  })
)

const styleObj = computed(() => {
  const s = {}
  if (props.width) s.width = typeof props.width === 'number' ? props.width + 'px' : props.width
  if (props.height) s.height = typeof props.height === 'number' ? props.height + 'px' : props.height
  if (props.aspectRatio) s.aspectRatio = props.aspectRatio
  if (props.fit) s.objectFit = props.fit
  return s
})

onMounted(() => {
  // 异步探测 webp 支持，结果写入全局，供 bestImageFormat 同步使用
  if (typeof window !== 'undefined' && !props.disableWebp) {
    probeWebpSupport().then((s) => {
      window.__wpx_webp_support = s
    })
  }
})
</script>

<template>
  <picture>
    <!-- WebP 优先 -->
    <source
      v-if="sources.webp"
      :srcset="sources.srcset || sources.webp"
      :sizes="sources.sizes || undefined"
      type="image/webp"
    />
    <!-- Fallback：原格式 -->
    <img
      :src="sources.fallback"
      :srcset="sources.srcset || undefined"
      :sizes="sources.sizes || undefined"
      :alt="alt"
      :width="width || undefined"
      :height="height || undefined"
      :loading="loading"
      :fetchpriority="fetchpriority"
      decoding="async"
      :style="styleObj"
      class="block max-w-full h-auto"
    />
  </picture>
</template>
