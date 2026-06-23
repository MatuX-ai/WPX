<script setup>
import MarkdownIt from 'markdown-it'
import { computed, nextTick, onUpdated, ref, watch } from 'vue'

const props = defineProps({
  content: {
    type: String,
    default: '',
  },
})

const rootRef = ref(null)

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const info = token.info ? md.utils.unescapeAll(token.info).trim() : ''
  const lang = info.split(/\s+/g)[0] || ''
  const code = token.content
  const blockId = `ai-code-${idx}`
  const escaped = md.utils.escapeHtml(code)
  const langLabel = lang
    ? `<span class="ai-md-code__lang">${md.utils.escapeHtml(lang)}</span>`
    : '<span class="ai-md-code__lang"></span>'

  return `<div class="ai-md-code">
    <div class="ai-md-code__header">
      ${langLabel}
      <button type="button" class="ai-md-code__copy" data-copy-for="${blockId}" aria-label="复制代码">复制</button>
    </div>
    <pre class="ai-md-code__pre"><code id="${blockId}">${escaped}</code></pre>
  </div>`
}

const html = computed(() => (props.content ? md.render(props.content) : ''))

function bindCopyButtons() {
  const root = rootRef.value
  if (!root) return

  root.querySelectorAll('[data-copy-for]').forEach((button) => {
    if (button.dataset.copyBound === 'true') return
    button.dataset.copyBound = 'true'

    button.addEventListener('click', async () => {
      const codeId = button.getAttribute('data-copy-for')
      const codeEl = root.querySelector(`#${CSS.escape(codeId)}`)
      if (!codeEl) return

      const originalLabel = button.textContent
      try {
        await navigator.clipboard.writeText(codeEl.textContent || '')
        button.textContent = '已复制'
      } catch {
        button.textContent = '复制失败'
      }

      window.setTimeout(() => {
        button.textContent = originalLabel
      }, 1500)
    })
  })
}

watch(html, () => {
  nextTick(bindCopyButtons)
})

onUpdated(bindCopyButtons)
</script>

<template>
  <div ref="rootRef" class="ai-md-content" v-html="html" />
</template>

<style scoped>
.ai-md-content {
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.ai-md-content :deep(p) {
  margin: 0 0 0.6em;
}

.ai-md-content :deep(p:last-child) {
  margin-bottom: 0;
}

.ai-md-content :deep(ul),
.ai-md-content :deep(ol) {
  margin: 0.4em 0 0.6em;
  padding-left: 1.25em;
}

.ai-md-content :deep(li + li) {
  margin-top: 0.2em;
}

.ai-md-content :deep(code) {
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.08);
  font-family: var(--theme-font-mono, ui-monospace, monospace);
  font-size: 0.92em;
}

.ai-md-content :deep(.ai-md-code) {
  margin: 0.5em 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--theme-border, #e2e8f0);
  background: var(--theme-bg-subtle, #f8fafc);
}

.ai-md-content :deep(.ai-md-code__header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
  background: var(--theme-bg-muted, #f1f5f9);
}

.ai-md-content :deep(.ai-md-code__lang) {
  font-size: 11px;
  color: var(--theme-fg-muted, #64748b);
  text-transform: lowercase;
}

.ai-md-content :deep(.ai-md-code__copy) {
  border: none;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--theme-fg-muted, #64748b);
  background: transparent;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.ai-md-content :deep(.ai-md-code__copy:hover) {
  background: var(--theme-accent-muted, #dbeafe);
  color: var(--theme-accent, #2563eb);
}

.ai-md-content :deep(.ai-md-code__pre) {
  margin: 0;
  padding: 10px 12px;
  overflow-x: auto;
}

.ai-md-content :deep(.ai-md-code__pre code) {
  padding: 0;
  background: transparent;
  font-size: 12px;
  white-space: pre;
}

.ai-md-content :deep(a) {
  color: var(--theme-accent, #2563eb);
  text-decoration: underline;
}

.ai-md-content :deep(blockquote) {
  margin: 0.5em 0;
  padding-left: 0.75em;
  border-left: 3px solid var(--theme-border, #e2e8f0);
  color: var(--theme-fg-muted, #64748b);
}

.ai-md-content :deep(h1),
.ai-md-content :deep(h2),
.ai-md-content :deep(h3) {
  margin: 0.6em 0 0.4em;
  font-size: 1em;
  font-weight: 600;
  line-height: 1.4;
}

.ai-md-content :deep(h1) {
  font-size: 1.1em;
}

.ai-md-content :deep(table) {
  width: 100%;
  margin: 0.5em 0;
  border-collapse: collapse;
  font-size: 12px;
}

.ai-md-content :deep(th),
.ai-md-content :deep(td) {
  border: 1px solid var(--theme-border, #e2e8f0);
  padding: 4px 8px;
}
</style>
