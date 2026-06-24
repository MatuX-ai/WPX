<script setup>
/**
 * <LazySection> - 通过 IntersectionObserver 延迟渲染内容的轻量级包装。
 *
 * 用法：
 *   <LazySection :root-margin="300px">
 *     <HeavyChart />
 *   </LazySection>
 *
 * 行为：
 * - 默认首次进入视口时渲染其 slot；之后保留渲染结果。
 * - `once=false` 时离开视口后再次进入仍会重新渲染（一般不需要）。
 * - SSR 友好：若 IntersectionObserver 不存在（例如 Node 环境），立即显示内容。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  rootMargin: { type: String, default: '200px' },
  threshold: { type: [Number, Array], default: 0.01 },
  once: { type: Boolean, default: true },
  /**
   * 关闭延迟（立即渲染）。当首屏布局或测试需要立即呈现时使用。
   */
  immediate: { type: Boolean, default: false },
  /**
   * 占位元素最小高度，避免进入视口前布局抖动。
   */
  minHeight: { type: [String, Number], default: undefined },
  /**
   * 占位元素的标签名。
   */
  tag: { type: String, default: 'div' },
})

const visible = ref(props.immediate)
const elRef = ref(null)
let observer = null

onMounted(() => {
  if (props.immediate || typeof IntersectionObserver === 'undefined') {
    visible.value = true
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visible.value = true
          if (props.once && observer) {
            observer.disconnect()
            observer = null
          }
        } else if (!props.once) {
          visible.value = false
        }
      }
    },
    { rootMargin: props.rootMargin, threshold: props.threshold },
  )
  if (elRef.value) observer.observe(elRef.value)
})

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
})
</script>

<template>
  <component
    :is="tag"
    ref="elRef"
    class="lazy-section"
    :style="!visible && minHeight ? { minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight } : null"
  >
    <slot v-if="visible" />
    <slot v-else name="placeholder">
      <span v-if="!visible" class="lazy-section__placeholder" aria-hidden="true" />
    </slot>
  </component>
</template>

<style scoped>
.lazy-section {
  display: block;
}
.lazy-section__placeholder {
  display: block;
  width: 100%;
  min-height: 1px;
}
</style>
