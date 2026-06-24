<script setup>
/**
 * <AppPicture> - 自动 WebP + fallback 的 <picture> 组件。
 *
 * 用法：
 *   <AppPicture src="/assets/hero.png" alt="产品截图" width="600" height="400" />
 *   <AppPicture :sources="[{src: '/a.png', media: '(min-width: 800px)'}]" alt="..." />
 *
 * 行为：
 * - 浏览器支持 WebP 时，加载 *.webp（同一目录同 basename）
 * - 否则回退到原始 png/jpg
 * - 默认开启原生 lazy loading / async decode
 */
import { computed } from 'vue'
import { buildPictureSources, buildSrcset } from '@/utils/image'

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, required: true },
  width: { type: [String, Number], default: undefined },
  height: { type: [String, Number], default: undefined },
  loading: { type: String, default: 'lazy' },
  decoding: { type: String, default: 'async' },
  fetchpriority: { type: String, default: undefined },
  sizes: { type: String, default: undefined },
  /**
   * 额外 picture 资源：[{ src, type, media, sizes, srcset }]
   * type 默认 'image/webp'。
   */
  sources: { type: Array, default: () => [] },
  /**
   * 是否输出 <picture> 标签。
   * 设为 false 时退化为 <img>，但仍支持 src 上的 .webp 协商。
   */
  usePicture: { type: Boolean, default: true },
  /**
   * 是否强制 lazy；首屏 LCP 图片通常应设为 false。
   */
  eager: { type: Boolean, default: false },
  /**
   * 关键提示：'high' | 'low' | 'auto'。
   */
  priority: { type: String, default: undefined },
})

const sources = computed(() => {
  const base = buildPictureSources(props.src)
  const extras = (props.sources || []).map((s) => ({
    type: s.type || 'image/webp',
    media: s.media,
    srcset: s.srcset || buildSrcset(toWebpLocal(s.src), s.width),
    sizes: s.sizes,
  }))
  return [
    { type: 'image/webp', srcset: base.webp },
    ...extras,
  ]
})

const fallback = computed(() => buildPictureSources(props.src).fallback)
const finalLoading = computed(() => (props.eager ? 'eager' : props.loading))
const finalFetchPriority = computed(() => props.priority || props.fetchpriority)
const finalAlt = computed(() => props.alt || '')

function toWebpLocal(url) {
  if (!url) return url
  const dot = url.lastIndexOf('.')
  if (dot < 0) return url
  return url.slice(0, dot) + '.webp'
}
</script>

<template>
  <picture v-if="usePicture" class="app-picture">
    <source
      v-for="(s, idx) in sources"
      :key="idx"
      :type="s.type"
      :media="s.media"
      :srcset="s.srcset"
      :sizes="s.sizes"
    />
    <img
      :src="fallback"
      :alt="finalAlt"
      :width="width"
      :height="height"
      :loading="finalLoading"
      :decoding="decoding"
      :fetchpriority="finalFetchPriority"
      :sizes="sizes"
    />
  </picture>
  <img
    v-else
    :src="fallback"
    :alt="finalAlt"
    :width="width"
    :height="height"
    :loading="finalLoading"
    :decoding="decoding"
    :fetchpriority="finalFetchPriority"
    :sizes="sizes"
  />
</template>

<style scoped>
.app-picture {
  display: block;
  line-height: 0;
}
.app-picture :deep(img) {
  max-width: 100%;
  height: auto;
}
</style>
