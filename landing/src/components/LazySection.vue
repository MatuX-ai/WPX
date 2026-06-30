<!--
  LazySection · 滚动到视口才挂载的包装组件
  - 用 IntersectionObserver 监听
  - 默认 200px 根边距（rootMargin），提前 200px 触发
  - 支持 :min-height 保留占位，避免布局抖动（CLS）
  - 支持 :once 默认只触发一次
-->
<script setup>
import { ref, onMounted, onBeforeUnmount, useSlots } from 'vue'

const props = defineProps({
  // 触发阈值：0~1
  threshold: { type: Number, default: 0.05 },
  // 提前 N px 触发，避免到边界才出现
  rootMargin: { type: String, default: '200px 0px' },
  // 占位最小高度，避免布局抖动
  minHeight: { type: String, default: '600px' },
  // 是否只触发一次
  once: { type: Boolean, default: true },
  // 元素 tag
  tag: { type: String, default: 'div' },
  // 自定义根元素 class
  rootClass: { type: String, default: '' },
  // 初始是否可见（默认 false = 纯懒加载，true = 立即渲染 slot）
  // 用例：包含 hash 锚点（如 #features、#download）的 section 需要 true，
  //      保证页面加载后 document.getElementById 能立即命中，vue-router 的 scrollBehavior 才会滑过去
  initialVisible: { type: Boolean, default: false }
})

const visible = ref(props.initialVisible)
const el = ref(null)
let observer = null

onMounted(() => {
  // 如果初始可见，无需观察器（节省 IO 性能开销）
  if (visible.value) return
  // 老浏览器 fallback：直接可见
  if (typeof IntersectionObserver === 'undefined') {
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
    { threshold: props.threshold, rootMargin: props.rootMargin }
  )
  if (el.value) observer.observe(el.value)
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
})

const slots = useSlots()
</script>

<template>
  <component
    :is="tag"
    ref="el"
    :class="rootClass"
    :style="visible ? undefined : { minHeight }"
  >
    <slot v-if="visible" />
    <!-- 占位骨架：未触发时显示柔和的渐变，避免视觉跳变 -->
    <div
      v-else
      aria-hidden="true"
      class="flex w-full items-center justify-center"
      :style="{ minHeight }"
    >
      <div class="h-10 w-10 animate-pulse rounded-full bg-dark/5" />
    </div>
  </component>
</template>
