<script setup>
import MarkdownIt from 'markdown-it'
import { computed } from 'vue'

const props = defineProps({
  content: {
    type: String,
    default: '',
  },
})

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const html = computed(() => (props.content ? md.render(props.content) : ''))
</script>

<template>
  <div class="knowledge-md" data-testid="knowledge-md-preview" v-html="html" />
</template>

<style scoped>
.knowledge-md {
  font-size: 13px;
  line-height: 1.7;
  color: #1e293b;
  word-break: break-word;
}

.knowledge-md :deep(h1),
.knowledge-md :deep(h2),
.knowledge-md :deep(h3),
.knowledge-md :deep(h4) {
  margin: 1em 0 0.45em;
  font-weight: 650;
  line-height: 1.35;
  color: #0f172a;
}

.knowledge-md :deep(h1) {
  font-size: 1.35em;
}

.knowledge-md :deep(h2) {
  font-size: 1.2em;
}

.knowledge-md :deep(h3) {
  font-size: 1.08em;
}

.knowledge-md :deep(p) {
  margin: 0.55em 0;
}

.knowledge-md :deep(ul),
.knowledge-md :deep(ol) {
  margin: 0.45em 0;
  padding-left: 1.35em;
}

.knowledge-md :deep(li) {
  margin: 0.2em 0;
}

.knowledge-md :deep(blockquote) {
  margin: 0.6em 0;
  padding: 0.15em 0 0.15em 0.85em;
  border-left: 3px solid #c4b5fd;
  color: #475569;
}

.knowledge-md :deep(code) {
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: #f1f5f9;
  font-size: 0.92em;
}

.knowledge-md :deep(pre) {
  margin: 0.7em 0;
  padding: 10px 12px;
  overflow-x: auto;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.55;
}

.knowledge-md :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

.knowledge-md :deep(a) {
  color: #6d28d9;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.knowledge-md :deep(hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px solid #e2e8f0;
}

.knowledge-md :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}
</style>
