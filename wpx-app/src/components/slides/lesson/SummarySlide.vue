<script setup>
/**
 * <SummarySlide> - 课堂小结
 *
 * Props:
 *   - title
 *   - keyPoints: string[]
 *   - mindMap?: { nodes: [{id,label}], edges: [{from,to}] }
 *   - theme
 */
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '课堂小结' },
  keyPoints: { type: Array, default: () => [] },
  mindMap: { type: Object, default: null },
  theme: { type: String, default: 'light' },
})

const themeClass = computed(() =>
  props.theme === 'dark' ? 'wpx-slide--dark' : 'wpx-slide--light',
)

// 简易思维导图布局：以第一个节点为中心，其他按层排开
const positionedNodes = computed(() => {
  if (!props.mindMap?.nodes?.length) return []
  const nodes = props.mindMap.nodes
  if (nodes.length === 1) {
    return [{ ...nodes[0], x: 50, y: 50 }]
  }
  const center = nodes[0]
  const others = nodes.slice(1)
  const result = [{ ...center, x: 50, y: 50 }]
  others.forEach((n, i) => {
    const angle = (Math.PI * 2 * i) / others.length
    const radius = 30
    result.push({
      ...n,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
    })
  })
  return result
})

const positionedEdges = computed(() => {
  if (!props.mindMap?.edges?.length) return []
  const map = new Map(positionedNodes.value.map((n) => [n.id, n]))
  return props.mindMap.edges
    .map((e) => {
      const from = map.get(e.from)
      const to = map.get(e.to)
      if (!from || !to) return null
      return { from, to }
    })
    .filter(Boolean)
})
</script>

<template>
  <div
    class="wpx-slide wpx-slide--summary"
    :class="[themeClass]"
    :data-theme="theme"
    role="region"
    :aria-label="title"
  >
    <header class="wpx-summary__header">
      <span class="wpx-summary__chip">小结</span>
      <h2 class="wpx-summary__title">{{ title }}</h2>
    </header>

    <div class="wpx-summary__body">
      <ul class="wpx-summary__points">
        <li v-for="(p, i) in keyPoints" :key="i" class="wpx-summary__point">
          <span class="wpx-summary__num">{{ i + 1 }}</span>
          <span>{{ p }}</span>
        </li>
        <li v-if="!keyPoints.length" class="wpx-summary__placeholder">（未填写小结要点）</li>
      </ul>

      <div v-if="mindMap?.nodes?.length" class="wpx-summary__mindmap" aria-label="知识网络">
        <svg viewBox="0 0 100 100" class="wpx-summary__svg" preserveAspectRatio="xMidYMid meet">
          <line
            v-for="(e, i) in positionedEdges"
            :key="`e${i}`"
            :x1="e.from.x"
            :y1="e.from.y"
            :x2="e.to.x"
            :y2="e.to.y"
            stroke="#1976d2"
            stroke-width="0.5"
            opacity="0.6"
          />
          <g v-for="(n, i) in positionedNodes" :key="n.id || i">
            <circle :cx="n.x" :cy="n.y" :r="n.id === positionedNodes[0]?.id ? 6 : 4.5" fill="#1976d2" />
            <text
              :x="n.x"
              :y="n.y + (n.id === positionedNodes[0]?.id ? 10 : 8)"
              text-anchor="middle"
              font-size="3"
              fill="currentColor"
            >{{ n.label }}</text>
          </g>
        </svg>
        <div class="wpx-summary__mindmap-label">知识网络</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wpx-slide {
  position: relative; width: 100%; aspect-ratio: 16 / 9;
  overflow: hidden; display: flex; flex-direction: column;
  padding: 4% 5%; border-radius: var(--theme-radius-lg, 16px);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(15, 23, 42, 0.14));
  font-family: var(--theme-font-sans, 'Source Han Sans CN', Inter, system-ui, sans-serif);
}
.wpx-slide--light { background-color: #fafbff; color: #1a1a1a; }
.wpx-slide--dark { background-color: #1a2233; color: #e0e0e0; }

.wpx-summary__header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.wpx-summary__chip {
  display: inline-block; padding: 4px 10px; border-radius: 6px;
  background: linear-gradient(90deg, #1976d2, #43a047);
  color: #fff; font-size: 0.85rem; font-weight: 600;
}
.wpx-summary__title {
  font-size: clamp(1.625rem, 3.5vw, 2.5rem);
  font-weight: 800; margin: 0;
}

.wpx-summary__body {
  flex: 1; display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  overflow: hidden;
}

.wpx-summary__points {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.6rem;
  overflow: hidden;
}
.wpx-summary__point {
  display: flex; gap: 0.6rem; align-items: flex-start;
  font-size: clamp(0.95rem, 1.6vw, 1.15rem); line-height: 1.55;
  padding: 0.5rem 0.75rem;
  background: rgba(25, 118, 210, 0.05);
  border-radius: 6px;
  border-left: 3px solid #1976d2;
}
.wpx-slide--dark .wpx-summary__point { background: rgba(25, 118, 210, 0.15); }
.wpx-summary__num {
  flex-shrink: 0; width: 1.7em; height: 1.7em;
  border-radius: 50%; background: #1976d2; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.95em;
}
.wpx-summary__placeholder { font-style: italic; opacity: 0.55; font-size: 0.9rem; }

.wpx-summary__mindmap {
  position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(67, 160, 71, 0.05);
  border-radius: 10px;
  padding: 1rem;
}
.wpx-slide--dark .wpx-summary__mindmap { background: rgba(67, 160, 71, 0.1); }
.wpx-summary__svg {
  width: 100%; height: 100%;
  max-height: 80%;
}
.wpx-summary__mindmap-label {
  position: absolute; bottom: 0.5rem; right: 0.75rem;
  font-size: 0.75rem; color: #43a047; opacity: 0.7;
  font-weight: 600;
}
</style>