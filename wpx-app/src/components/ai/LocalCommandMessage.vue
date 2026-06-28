<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  success: {
    type: Boolean,
    default: true,
  },
  message: {
    type: String,
    default: '',
  },
  commandId: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    default: '',
  },
  icon: {
    type: String,
    default: '',
  },
  // ── 交互式扩展 ──
  mode: {
    type: String,
    default: 'status', // 'status' | 'selector' | 'image-align' | 'preference' | 'html-format-selector' | 'format-recovery'
    validator: (val) =>
      ['status', 'selector', 'image-align', 'preference', 'html-format-selector', 'format-recovery'].includes(val),
  },
  templates: {
    type: Array,
    default: () => [],
  },
  showKeepOriginal: {
    type: Boolean,
    default: false,
  },
  previewText: {
    type: String,
    default: '',
  },
  // 标题（仅 selector / image-align 模式生效；不传则用 message）
  promptTitle: {
    type: String,
    default: '',
  },
  promptHint: {
    type: String,
    default: '',
  },
  // preference 模式（"以后都这样排版？" 询问）使用
  preferenceKey: {
    type: String,
    default: 'template',
  },
  // image-align 模式下是否禁用"保持原样"
  imageAlignAllowKeep: {
    type: Boolean,
    default: true,
  },
  // 透传载荷（如 preference 的 { key, data }），随 select 事件一起上抛
  payload: {
    type: Object,
    default: () => ({}),
  },
  // format-recovery 模式下展示的模板名（如「已按【正式报告】格式排版」）
  templateLabel: {
    type: String,
    default: '',
  },
  // html-format-selector 模式专属：来源 URL / 导入时间 / 导入方式
  webpageMeta: {
    type: Object,
    default: () => null,
  },
})

const emit = defineEmits([
  'select',
  'dismiss',
  'restore',
  'change-template',
  'preference-confirm',
  'preference-skip',
])

const variant = computed(() => {
  if (props.mode !== 'status') return 'interactive'
  return props.success ? 'success' : 'warning'
})

const displayIcon = computed(() => {
  if (props.icon === 'error') return '❌'
  if (props.icon === 'warning' || !props.success) return '⚠️'
  if (props.icon === 'info') return '✨'
  if (props.mode === 'selector' || props.mode === 'image-align') return '✨'
  if (props.mode === 'preference') return '❓'
  if (props.mode === 'html-format-selector') return '📄'
  if (props.mode === 'format-recovery') return '✅'
  return '✅'
})

const categoryLabel = computed(() => {
  const map = {
    text: '文本',
    format: '格式',
    font: '字体',
    align: '对齐',
    heading: '标题',
    list: '列表',
    insert: '插入',
    view: '视图',
    file: '文件',
    window: '窗口',
  }
  return map[props.category] || '本地指令'
})

/* ── selector 模式：默认模板优先展示 ── */
const orderedTemplates = computed(() => {
  if (!Array.isArray(props.templates)) return []
  // 通用文章 优先，正式报告其次
  const order = ['article', 'report', 'official', 'lesson-plan', 'paper']
  const sorted = [...props.templates].sort((a, b) => {
    const ia = order.indexOf(a.id)
    const ib = order.indexOf(b.id)
    if (ia < 0 && ib < 0) return 0
    if (ia < 0) return 1
    if (ib < 0) return -1
    return ia - ib
  })
  return sorted
})

/* ── html-format-selector 模式：网页存档优先展示 ── */
const orderedHtmlTemplates = computed(() => {
  if (!Array.isArray(props.templates)) return []
  // 网页存档 优先，正式报告其次
  const order = ['webpage-archive', 'article', 'report', 'official', 'lesson-plan', 'paper']
  const sorted = [...props.templates].sort((a, b) => {
    const ia = order.indexOf(a.id)
    const ib = order.indexOf(b.id)
    if (ia < 0 && ib < 0) return 0
    if (ia < 0) return 1
    if (ib < 0) return -1
    return ia - ib
  })
  return sorted
})

/* ── html-format-selector 模式：来源信息展示 ── */
const formattedWebpageMeta = computed(() => {
  if (!props.webpageMeta || typeof props.webpageMeta !== 'object') return null
  const meta = props.webpageMeta
  const sourceUrl = meta.sourceUrl || '未指定'
  const importedAt = meta.importedAt ? formatMetaTime(meta.importedAt) : '未指定'
  const importSourceLabel = {
    paste: '粘贴导入',
    file: '文件导入',
    url: '链接导入',
  }[meta.importSource || 'paste'] || '导入'
  return { sourceUrl, importedAt, importSourceLabel }
})

function formatMetaTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
  } catch {
    return iso
  }
}

/* ── 状态：已选择某项（防重复点击） ── */
const selectedKey = ref('')
const isConsumed = computed(() => Boolean(selectedKey.value))

function selectTemplate(templateId) {
  if (isConsumed.value) return
  selectedKey.value = templateId
  emit('select', { kind: 'template', templateId })
}

function selectImageMode(mode) {
  if (isConsumed.value) return
  selectedKey.value = mode
  emit('select', { kind: 'imageAlign', mode })
}

function selectKeepOriginal() {
  if (isConsumed.value) return
  selectedKey.value = 'keep'
  emit('select', { kind: 'keep-original' })
  emit('dismiss', { kind: 'keep-original' })
}

function dismiss() {
  if (isConsumed.value) return
  selectedKey.value = 'dismissed'
  emit('dismiss', { kind: 'dismiss' })
}

function emitRestore() {
  if (isConsumed.value) return
  selectedKey.value = 'restored'
  emit('restore', { kind: 'restore' })
}

function emitChangeTemplate() {
  if (isConsumed.value) return
  selectedKey.value = 'changing'
  emit('change-template', { kind: 'change-template' })
}

function confirmPreference() {
  if (isConsumed.value) return
  selectedKey.value = 'confirmed'
  // 注意：只 emit 'preference-confirm'，不再额外 emit 'select'。
  // AiChatWindow 上 '@select' 与 '@preference-confirm' 同时绑定到 onLocalCommandSelect，
  // 双 emit 会导致 handleLocalCommandSelect 被调用两次，从而在 displayMessages 里 push 两条相同的回复。
  emit('preference-confirm', { key: props.preferenceKey, ...props.payload })
}

function skipPreference() {
  if (isConsumed.value) return
  selectedKey.value = 'skipped'
  // 同 confirmPreference：仅 emit 'preference-skip'，避免双触发。
  emit('preference-skip', { key: props.preferenceKey, ...props.payload })
}
</script>

<template>
  <!-- 状态模式（默认，向后兼容） -->
  <div
    v-if="mode === 'status'"
    class="local-command-message"
    :class="`local-command-message--${variant}`"
    role="status"
    aria-live="polite"
  >
    <span class="local-command-message__icon" aria-hidden="true">{{ displayIcon }}</span>
    <div class="local-command-message__body">
      <p class="local-command-message__text">{{ message }}</p>
      <span v-if="commandId" class="local-command-message__meta" :title="`命令 ID：${commandId}`">
        {{ categoryLabel }} · 本地指令
      </span>
    </div>
  </div>

  <!-- 模板选择器模式 -->
  <div
    v-else-if="mode === 'selector'"
    class="local-command-message local-command-message--interactive"
    role="group"
    aria-label="Markdown 排版模板选择"
  >
    <div class="local-command-message__head">
      <span class="local-command-message__icon" aria-hidden="true">{{ displayIcon }}</span>
      <div class="local-command-message__head-body">
        <p class="local-command-message__text">
          {{ promptTitle || message || '检测到 Markdown 格式，需要我帮你排版吗？' }}
        </p>
        <p
          v-if="previewText || promptHint"
          class="local-command-message__hint"
        >
          <template v-if="previewText">预览：<span class="local-command-message__preview">{{ previewText }}</span></template>
          <template v-if="promptHint">{{ promptHint }}</template>
        </p>
        <span v-if="commandId" class="local-command-message__meta">
          {{ categoryLabel }} · 本地指令
        </span>
      </div>
      <button
        v-if="!isConsumed"
        type="button"
        class="local-command-message__close"
        aria-label="关闭"
        @click="dismiss"
      >×</button>
    </div>

    <div v-if="!isConsumed" class="local-command-message__chips">
      <button
        v-for="tpl in orderedTemplates"
        :key="tpl.id"
        type="button"
        class="local-command-message__chip"
        :title="tpl.description"
        :aria-label="`使用 ${tpl.label} 排版`"
        @click="selectTemplate(tpl.id)"
      >
        {{ tpl.label }}
      </button>
      <button
        v-if="showKeepOriginal"
        type="button"
        class="local-command-message__chip local-command-message__chip--ghost"
        aria-label="保持原样"
        @click="selectKeepOriginal"
      >保持原样</button>
    </div>
    <p v-else class="local-command-message__consumed">已选择 ✓</p>
  </div>

  <!-- 图片对齐选择器模式 -->
  <div
    v-else-if="mode === 'image-align'"
    class="local-command-message local-command-message--interactive"
    role="group"
    aria-label="图片对齐方式选择"
  >
    <div class="local-command-message__head">
      <span class="local-command-message__icon" aria-hidden="true">📷</span>
      <div class="local-command-message__head-body">
        <p class="local-command-message__text">
          {{ promptTitle || message || '文档中的图片需要自动对齐吗？' }}
        </p>
        <span v-if="commandId" class="local-command-message__meta">
          {{ categoryLabel }} · 本地指令
        </span>
      </div>
      <button
        v-if="!isConsumed && imageAlignAllowKeep"
        type="button"
        class="local-command-message__close"
        aria-label="跳过"
        @click="dismiss"
      >×</button>
    </div>

    <div v-if="!isConsumed" class="local-command-message__chips">
      <button
        type="button"
        class="local-command-message__chip"
        aria-label="等比例撑满宽度"
        @click="selectImageMode('fill')"
      >等比例撑满宽度</button>
      <button
        type="button"
        class="local-command-message__chip"
        aria-label="窄边距居中"
        @click="selectImageMode('narrow')"
      >窄边距居中</button>
      <button
        v-if="imageAlignAllowKeep"
        type="button"
        class="local-command-message__chip local-command-message__chip--ghost"
        aria-label="跳过图片对齐"
        @click="dismiss"
      >跳过</button>
    </div>
    <p v-else class="local-command-message__consumed">已选择 ✓</p>
  </div>

  <!-- "以后都这样排版？" 偏好询问模式 -->
  <div
    v-else-if="mode === 'preference'"
    class="local-command-message local-command-message--interactive"
    role="group"
    aria-label="是否记住此次选择"
  >
    <div class="local-command-message__head">
      <span class="local-command-message__icon" aria-hidden="true">{{ displayIcon }}</span>
      <div class="local-command-message__head-body">
        <p class="local-command-message__text">
          {{ message || '以后是不是都这样排版？' }}
        </p>
        <span v-if="commandId" class="local-command-message__meta">
          {{ categoryLabel }} · 本地指令
        </span>
      </div>
    </div>

    <div v-if="!isConsumed" class="local-command-message__chips">
      <button
        type="button"
        class="local-command-message__chip"
        aria-label="是的，记下来"
        @click="confirmPreference"
      >是的，记下来</button>
      <button
        type="button"
        class="local-command-message__chip local-command-message__chip--ghost"
        aria-label="不用了"
        @click="skipPreference"
      >不用了</button>
    </div>
    <p v-else class="local-command-message__consumed">已记录 ✓</p>
  </div>

  <!-- HTML 排版模板选择器模式 -->
  <div
    v-else-if="mode === 'html-format-selector'"
    class="local-command-message local-command-message--interactive"
    role="group"
    aria-label="HTML 排版模板选择"
  >
    <div class="local-command-message__head">
      <span class="local-command-message__icon" aria-hidden="true">{{ displayIcon }}</span>
      <div class="local-command-message__head-body">
        <p class="local-command-message__text">
          {{ promptTitle || message || '检测到网页内容，是否按模板排版？' }}
        </p>
        <p
          v-if="formattedWebpageMeta"
          class="local-command-message__hint"
        >
          来源：<span class="local-command-message__preview">{{ formattedWebpageMeta.sourceUrl }}</span>
          · 导入时间：{{ formattedWebpageMeta.importedAt }}
          （{{ formattedWebpageMeta.importSourceLabel }}）
        </p>
        <span v-if="commandId" class="local-command-message__meta">
          {{ categoryLabel }} · 本地指令
        </span>
      </div>
      <button
        v-if="!isConsumed"
        type="button"
        class="local-command-message__close"
        aria-label="关闭"
        @click="dismiss"
      >×</button>
    </div>

    <div v-if="!isConsumed" class="local-command-message__chips">
      <button
        v-for="tpl in orderedHtmlTemplates"
        :key="tpl.id"
        type="button"
        class="local-command-message__chip"
        :title="tpl.description"
        :aria-label="`使用 ${tpl.label} 排版`"
        @click="selectTemplate(tpl.id)"
      >
        {{ tpl.label }}
      </button>
      <button
        v-if="showKeepOriginal"
        type="button"
        class="local-command-message__chip local-command-message__chip--ghost"
        aria-label="保持原样"
        @click="selectKeepOriginal"
      >保持原样</button>
    </div>
    <p v-else class="local-command-message__consumed">已选择 ✓</p>
  </div>

  <!-- 排版后恢复提示条模式（编辑器顶部使用） -->
  <div
    v-else-if="mode === 'format-recovery'"
    class="local-command-message local-command-message--format-recovery"
    role="status"
    aria-live="polite"
  >
    <span class="local-command-message__icon" aria-hidden="true">{{ displayIcon }}</span>
    <p class="local-command-message__text">
      {{ message || `已按【${templateLabel || '模板'}】格式排版` }}
    </p>
    <div class="local-command-message__recovery-actions">
      <button
        type="button"
        class="local-command-message__chip"
        aria-label="恢复原样"
        @click="emitRestore"
      >恢复原样</button>
      <button
        type="button"
        class="local-command-message__chip local-command-message__chip--ghost"
        aria-label="换模板"
        @click="emitChangeTemplate"
      >换模板</button>
      <button
        type="button"
        class="local-command-message__close"
        aria-label="关闭"
        @click="dismiss"
      >×</button>
    </div>
  </div>
</template>

<style scoped>
.local-command-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  margin: 6px 0;
  border-radius: 10px;
  max-width: 90%;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  /* 默认靠左对齐：无 AI 头像 */
}

.local-command-message--success {
  background-color: rgba(34, 197, 94, 0.10);
  color: rgb(21, 128, 61);
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.local-command-message--warning {
  background-color: rgba(234, 179, 8, 0.10);
  color: rgb(161, 98, 7);
  border: 1px solid rgba(234, 179, 8, 0.30);
}

.local-command-message--interactive {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background-color: rgba(59, 130, 246, 0.08);
  color: rgb(30, 64, 175);
  border: 1px solid rgba(59, 130, 246, 0.22);
  padding: 10px 12px;
}

/* ── format-recovery 模式：横向布局（顶部提示条专用） ── */
.local-command-message--format-recovery {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  background-color: rgba(34, 197, 94, 0.10);
  color: rgb(21, 128, 61);
  border: 1px solid rgba(34, 197, 94, 0.30);
  padding: 6px 12px;
  border-radius: 999px;
  max-width: 100%;
  font-size: 13px;
}

.local-command-message--format-recovery .local-command-message__text {
  flex: 1;
  margin: 0;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.local-command-message__recovery-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.local-command-message__recovery-actions .local-command-message__chip {
  padding: 3px 10px;
  font-size: 12px;
}

.local-command-message__icon {
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1.4;
  margin-top: 1px;
}

.local-command-message__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.local-command-message__text {
  margin: 0;
  font-weight: 500;
  white-space: pre-wrap;
}

.local-command-message__meta {
  font-size: 11px;
  opacity: 0.7;
  font-weight: 400;
}

.local-command-message__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.local-command-message__head-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.local-command-message__hint {
  margin: 0;
  font-size: 12px;
  color: rgb(71, 85, 105);
  font-weight: 400;
  line-height: 1.5;
}

.local-command-message__preview {
  font-family: ui-monospace, Consolas, monospace;
  background: rgba(15, 23, 42, 0.06);
  border-radius: 4px;
  padding: 1px 6px;
  margin-left: 4px;
}

.local-command-message__close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: inherit;
  font-size: 18px;
  line-height: 1;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.6;
  transition: background 0.15s, opacity 0.15s;
}

.local-command-message__close:hover {
  background: rgba(15, 23, 42, 0.08);
  opacity: 1;
}

.local-command-message__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.local-command-message__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  border-radius: 999px;
  border: 1px solid rgba(59, 130, 246, 0.40);
  background: rgba(59, 130, 246, 0.10);
  color: rgb(30, 64, 175);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.local-command-message__chip:hover {
  background: rgba(59, 130, 246, 0.18);
  border-color: rgba(59, 130, 246, 0.60);
}

.local-command-message__chip:active {
  transform: translateY(1px);
}

.local-command-message__chip--ghost {
  background: transparent;
  border-color: rgba(71, 85, 105, 0.30);
  color: rgb(71, 85, 105);
}

.local-command-message__chip--ghost:hover {
  background: rgba(71, 85, 105, 0.08);
  border-color: rgba(71, 85, 105, 0.50);
}

.local-command-message__consumed {
  margin: 4px 0 0;
  font-size: 12px;
  opacity: 0.7;
  font-weight: 400;
}

/* 暗色主题适配 */
:root[data-theme='dark'] .local-command-message--success,
[data-theme='dark'] .local-command-message--success {
  background-color: rgba(34, 197, 94, 0.15);
  color: rgb(134, 239, 172);
  border-color: rgba(34, 197, 94, 0.35);
}

:root[data-theme='dark'] .local-command-message--warning,
[data-theme='dark'] .local-command-message--warning {
  background-color: rgba(234, 179, 8, 0.15);
  color: rgb(253, 224, 71);
  border-color: rgba(234, 179, 8, 0.40);
}

:root[data-theme='dark'] .local-command-message--interactive,
[data-theme='dark'] .local-command-message--interactive {
  background-color: rgba(59, 130, 246, 0.15);
  color: rgb(147, 197, 253);
  border-color: rgba(59, 130, 246, 0.40);
}

:root[data-theme='dark'] .local-command-message--format-recovery,
[data-theme='dark'] .local-command-message--format-recovery {
  background-color: rgba(34, 197, 94, 0.18);
  color: rgb(134, 239, 172);
  border-color: rgba(34, 197, 94, 0.45);
}

:root[data-theme='dark'] .local-command-message__hint,
[data-theme='dark'] .local-command-message__hint {
  color: rgb(148, 163, 184);
}

:root[data-theme='dark'] .local-command-message__preview,
[data-theme='dark'] .local-command-message__preview {
  background: rgba(255, 255, 255, 0.10);
  color: rgb(226, 232, 240);
}

:root[data-theme='dark'] .local-command-message__chip,
[data-theme='dark'] .local-command-message__chip {
  background: rgba(59, 130, 246, 0.18);
  border-color: rgba(59, 130, 246, 0.50);
  color: rgb(191, 219, 254);
}

:root[data-theme='dark'] .local-command-message__chip:hover,
[data-theme='dark'] .local-command-message__chip:hover {
  background: rgba(59, 130, 246, 0.28);
}

:root[data-theme='dark'] .local-command-message__chip--ghost,
[data-theme='dark'] .local-command-message__chip--ghost {
  background: transparent;
  border-color: rgba(148, 163, 184, 0.30);
  color: rgb(203, 213, 225);
}
</style>
