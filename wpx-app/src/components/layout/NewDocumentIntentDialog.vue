<script setup>
/**
 * NewDocumentIntentDialog.vue
 * ------------------------------------------------------------
 * 工具栏【新建】按钮触发的意图对话框（FIX-0.1.24：默认 Tab 改为"按格式新建"）
 *
 * Tab 1「按格式新建」（默认）：
 *   - 展示 cold-start-templates 中的所有内置模板
 *   - 用户点击任一格式 → 新窗口打开并自动套用模板
 *   - 解决"空白文档无格式可选"的痛点（贴近 Word/WPS 新建向导体验）
 *
 * Tab 2「AI 帮我写」：
 *   - 用户输入意图 → 新窗口打开后自动流式生成
 *
 * Tab 3「完全空白」：
 *   - 兜底入口：用户明确要"什么都不带"的纯 Markdown 窗口
 *
 * 返回 Promise<{ mode, intent?, templateId? } | null>。
 * 设计：参考 TokenRechargeDialog 的 Teleport + 自定义 dialog 风格。
 * ------------------------------------------------------------
 */
import { computed, ref, watch } from 'vue'
import {
  COLD_START_TEMPLATES,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getColdStartTemplate,
} from '@/data/cold-start-templates'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'submit'])

const INTENT_CHIPS = [
  '写一份关于「Vue 3 组合式 API」的三级大纲',
  '生成一份本周工作周报',
  '写一篇关于远程办公利弊的短文',
  '起草一个产品发布会开场致辞',
  '把今天会议记录整理成要点',
  '写一份大学毕业生求职自荐信',
]

const mode = ref('template')   // 默认进入「按格式新建」，聚焦用户最关心的体验
const intent = ref('')
const submitting = ref(false)
const intentTextareaRef = ref(null)

/**
 * 格式化模板列表（按分类分组）。每个分组的 templates 全部来自 cold-start-templates，
 * 直接 emit('use-template') 走 EditorLayout.createNewDocument(template) 链路即可。
 */
const formatGroups = computed(() => {
  const byCategory = new Map()
  for (const tpl of COLD_START_TEMPLATES) {
    if (!byCategory.has(tpl.category)) byCategory.set(tpl.category, [])
    byCategory.get(tpl.category).push(tpl)
  }
  return CATEGORY_ORDER
    .filter((cat) => byCategory.has(cat))
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category] || category,
      templates: byCategory.get(category),
    }))
})

/**
 * 「完全空白」入口：直接命中 getColdStartTemplate('blank')，避免在 groups 里重复一份
 */
const blankTemplate = computed(() => getColdStartTemplate('blank'))

const canSubmit = computed(() => {
  if (mode.value === 'template') {
    // 格式 Tab 只是为了直接提交，任一模板被点击即视为提交，不依赖 footer 按钮
    return true
  }
  if (mode.value === 'ai') return intent.value.trim().length > 0
  if (mode.value === 'blank') return true
  return false
})

function reset() {
  mode.value = 'template'
  intent.value = ''
  submitting.value = false
}

function handleClose() {
  if (submitting.value) return
  reset()
  // 只需 emit('submit', null) — 父组件 handleIntentDialogSubmit 会调 resolver?.(null)。
  // emit('close') 仅在 visible prop 变化由父组件控制，不重复发射避免 double-resolve。
  emit('submit', null)
}

function handleBackdropClick() {
  handleClose()
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleClose()
  } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    if (mode.value === 'ai') {
      // Cmd/Ctrl + Enter 仅在 AI tab 下触发提交（其他 tab 直接点击模板）
      event.preventDefault()
      handleSubmit()
    }
  }
}

function fillChip(chipText) {
  intent.value = chipText
  // 自动聚焦到末尾
  nextFocusIntent()
}

function nextFocusIntent() {
  // 等 v-model 应用后再聚焦
  setTimeout(() => {
    const el = intentTextareaRef.value
    if (el && typeof el.focus === 'function') {
      el.focus()
      const len = el.value?.length ?? 0
      if (typeof el.setSelectionRange === 'function') {
        el.setSelectionRange(len, len)
      }
    }
  }, 0)
}

/**
 * 用户在「按格式新建」Tab 下点击任一模板：
 *   - 进入 new window（mode='template' + templateId）
 *   - 桌面端走 requestCreateAppWindow（父组件会处理）
 *   - Web 端直接调用 store.requestNewDocument + 把模板对象带过去（保留旧路径）
 */
function handlePickFormat(template) {
  if (submitting.value) return
  if (!template || !template.id) return
  submitting.value = true

  // payload 只携带 mode + templateId：完整模板对象由渲染层通过
  // getColdStartTemplate(templateId) 重新拉取，避免序列化大对象进入 URL/进程通信
  emit('submit', { mode: 'template', templateId: template.id })
  reset()
}

/**
 * 「完全空白」Tab 的提交按钮：开新窗口走 mode='blank'，等同旧行为。
 */
function handleBlankSubmit() {
  if (submitting.value) return
  submitting.value = true
  emit('submit', { mode: 'blank', intent: '' })
  reset()
}

function handleSubmit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  // mode='template' 时不会调用此函数（footer 不渲染对应按钮，靠点卡片提交）；
  // 防御性写齐所有分支，保证 future-proof。
  const payload = {
    mode: mode.value,
    intent: mode.value === 'ai' ? intent.value.trim() : '',
  }
  emit('submit', payload)
  reset()
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      reset()
      // AI 模式自动聚焦
      setTimeout(() => {
        if (mode.value === 'ai') nextFocusIntent()
      }, 80)
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="new-intent-backdrop"
      @mousedown.self="handleBackdropClick"
    >
      <div
        class="new-intent-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-intent-title"
        @keydown="handleKeydown"
      >
        <header class="new-intent-dialog__header">
          <h2 id="new-intent-title">新建文档</h2>
          <button
            type="button"
            class="new-intent-dialog__close"
            aria-label="关闭"
            @click="handleClose"
          >
            ×
          </button>
        </header>

        <div class="new-intent-dialog__body">
          <div class="new-intent-dialog__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              :aria-selected="mode === 'template'"
              :class="{ 'new-intent-dialog__tab--active': mode === 'template' }"
              class="new-intent-dialog__tab"
              data-testid="new-intent-tab-template"
              @click="mode = 'template'"
            >
              按格式新建
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="mode === 'ai'"
              :class="{ 'new-intent-dialog__tab--active': mode === 'ai' }"
              class="new-intent-dialog__tab"
              data-testid="new-intent-tab-ai"
              @click="mode = 'ai'"
            >
              <span class="new-intent-dialog__tab-icon">AI</span>
              AI 帮我写
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="mode === 'blank'"
              :class="{ 'new-intent-dialog__tab--active': mode === 'blank' }"
              class="new-intent-dialog__tab"
              data-testid="new-intent-tab-blank"
              @click="mode = 'blank'"
            >
              完全空白
            </button>
          </div>

          <!-- 按格式新建：列出所有 cold-start-templates 供选择 -->
          <div v-if="mode === 'template'" class="new-intent-dialog__panel">
            <p class="new-intent-dialog__hint">
              选择一个文档格式，新窗口会自动套用其骨架与排版。后续可自由修改。
            </p>

            <div
              class="new-intent-dialog__formats"
              role="list"
              aria-label="可创建的文档格式"
            >
              <button
                v-if="blankTemplate"
                type="button"
                class="new-intent-dialog__format-card new-intent-dialog__format-card--blank"
                :data-testid="`new-intent-format-${blankTemplate.id}`"
                @click="handlePickFormat(blankTemplate)"
              >
                <span class="new-intent-dialog__format-icon" aria-hidden="true">
                  {{ blankTemplate.name.charAt(0) }}
                </span>
                <span class="new-intent-dialog__format-name">
                  空白 Markdown
                </span>
                <span class="new-intent-dialog__format-desc">
                  从零开始，最轻量
                </span>
              </button>

              <template v-for="group in formatGroups" :key="group.category">
                <div
                  class="new-intent-dialog__format-group"
                  :data-testid="`new-intent-format-group-${group.category}`"
                >
                  <h3 class="new-intent-dialog__format-group-title">
                    {{ group.label }}
                    <span class="new-intent-dialog__format-group-count">
                      {{ group.templates.length }} 个
                    </span>
                  </h3>
                  <div class="new-intent-dialog__format-group-grid">
                    <button
                      v-for="tpl in group.templates"
                      :key="tpl.id"
                      type="button"
                      class="new-intent-dialog__format-card"
                      :data-testid="`new-intent-format-${tpl.id}`"
                      :title="tpl.description"
                      @click="handlePickFormat(tpl)"
                    >
                      <span class="new-intent-dialog__format-icon" aria-hidden="true">
                        {{ tpl.name.charAt(0) }}
                      </span>
                      <span class="new-intent-dialog__format-name">{{ tpl.name }}</span>
                      <span class="new-intent-dialog__format-desc">{{ tpl.description }}</span>
                    </button>
                  </div>
                </div>
              </template>
            </div>

            <p
              v-if="formatGroups.length === 0"
              class="new-intent-dialog__hint-inline"
              data-testid="new-intent-format-empty"
            >
              内置模板尚未加载，请尝试刷新页面或联系管理员。
            </p>
          </div>

          <!-- AI 帮我写：保留旧版 -->
          <div v-else-if="mode === 'ai'" class="new-intent-dialog__panel">
            <p class="new-intent-dialog__hint">
              告诉 AI 你想写什么，新窗口打开后 AI 会<strong>流式</strong>把内容直接写到编辑器里。
            </p>
            <textarea
              ref="intentTextareaRef"
              v-model="intent"
              rows="4"
              class="new-intent-dialog__textarea"
              placeholder="例如：写一份关于「Vue 3 组合式 API」的三级大纲"
            />
            <div class="new-intent-dialog__chips">
              <button
                v-for="chip in INTENT_CHIPS"
                :key="chip"
                type="button"
                class="new-intent-dialog__chip"
                @click="fillChip(chip)"
              >
                {{chip }}
              </button>
            </div>
            <p class="new-intent-dialog__shortcut">
              <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd> 提交 · <kbd>Esc</kbd> 取消
            </p>
          </div>

          <!-- 完全空白：兜底入口 -->
          <div v-else-if="mode === 'blank'" class="new-intent-dialog__panel">
            <p class="new-intent-dialog__hint">
              将在新窗口中打开一个完全空白的 Markdown 编辑器。
            </p>
            <ul class="new-intent-dialog__hint-list">
              <li>适合已经想好结构、只想要纯文本环境的用户</li>
              <li>默认字号、行高等使用通用 Markdown 排版</li>
              <li>后续可在「设置 → 排版偏好」中调整全局样式</li>
            </ul>
          </div>
        </div>

        <footer class="new-intent-dialog__footer">
          <button
            type="button"
            class="new-intent-dialog__btn new-intent-dialog__btn--ghost"
            :disabled="submitting"
            @click="handleClose"
          >
            取消
          </button>
          <button
            v-if="mode === 'blank'"
            type="button"
            class="new-intent-dialog__btn new-intent-dialog__btn--primary"
            data-testid="new-intent-confirm-blank"
            :disabled="submitting"
            @click="handleBlankSubmit"
          >
            立即新建空白窗口
          </button>
          <button
            v-else-if="mode === 'ai'"
            type="button"
            class="new-intent-dialog__btn new-intent-dialog__btn--primary"
            data-testid="new-intent-confirm-ai"
            :disabled="!canSubmit || submitting"
            @click="handleSubmit"
          >
            AI 帮我写
          </button>
          <span v-else class="new-intent-dialog__hint-inline">
            点击任意格式卡片即可套用并打开新窗口
          </span>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.new-intent-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: new-intent-fade 180ms ease-out;
}

@keyframes new-intent-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.new-intent-dialog {
  width: min(640px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #1f1f1f);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  animation: new-intent-pop 220ms cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

@keyframes new-intent-pop {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.new-intent-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--theme-border, #e6e6e6);
}

.new-intent-dialog__header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.new-intent-dialog__close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--theme-fg-muted, #888);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 120ms ease;
}

.new-intent-dialog__close:hover {
  background: var(--theme-bg-subtle, #f5f5f5);
  color: var(--theme-fg, #1f1f1f);
}

.new-intent-dialog__body {
  padding: 20px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.new-intent-dialog__tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--theme-bg-subtle, #f5f5f5);
  border-radius: 8px;
  margin-bottom: 16px;
}

.new-intent-dialog__tab {
  flex: 1;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  background: transparent;
  color: var(--theme-fg-muted, #666);
  cursor: pointer;
  border-radius: 6px;
  transition: all 120ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.new-intent-dialog__tab:hover {
  color: var(--theme-fg, #1f1f1f);
}

.new-intent-dialog__tab--active {
  background: var(--theme-bg, #fff);
  color: var(--theme-accent, #2c5cff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.new-intent-dialog__tab-icon {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  letter-spacing: 0.5px;
}

.new-intent-dialog__panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.new-intent-dialog__hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--theme-fg-muted, #666);
}

.new-intent-dialog__hint-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--theme-fg-muted, #666);
}

.new-intent-dialog__hint-inline {
  font-size: 12px;
  color: var(--theme-fg-muted, #888);
}

/**
 * 格式卡片网格：解决"空白文档无法选格式"的核心痛点。
 * - 整个容器是纵向滚动的一列，每个分组占据一列
 * - 分组内使用 grid 自适应列数（最小 140px），移动端自动单列
 * - hover 时上浮 + 主题色描边
 * - blank 卡片高亮（蓝色边框 + 主题色填充）
 */
.new-intent-dialog__formats {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 4px;
}

.new-intent-dialog__format-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.new-intent-dialog__format-group-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--theme-fg-muted);
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.new-intent-dialog__format-group-count {
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  color: var(--theme-fg-subtle);
}

.new-intent-dialog__format-group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.new-intent-dialog__format-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--theme-border, #e6e6e6);
  border-radius: 10px;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #1f1f1f);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease,
    transform 120ms ease;
  min-height: 84px;
}

.new-intent-dialog__format-card:hover {
  border-color: var(--theme-accent, #2c5cff);
  background: var(--theme-accent-muted, rgba(44, 92, 255, 0.08));
  box-shadow: var(--theme-shadow-md, 0 4px 12px rgba(0, 0, 0, 0.08));
  transform: translateY(-1px);
}

.new-intent-dialog__format-card:focus-visible {
  outline: 2px solid var(--theme-accent, #2c5cff);
  outline-offset: 2px;
}

.new-intent-dialog__format-card--blank {
  border-color: var(--theme-accent, #2c5cff);
  background: var(--theme-accent-muted, rgba(44, 92, 255, 0.08));
}

.new-intent-dialog__format-card--blank:hover {
  background: var(--theme-accent-muted, rgba(44, 92, 255, 0.16));
}

.new-intent-dialog__format-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--theme-bg-subtle, #f5f5f5);
  color: var(--theme-accent, #2c5cff);
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 2px;
}

.new-intent-dialog__format-card--blank .new-intent-dialog__format-icon {
  background: var(--theme-accent, #2c5cff);
  color: #fff;
}

.new-intent-dialog__format-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--theme-fg, #1f1f1f);
}

.new-intent-dialog__format-desc {
  font-size: 11px;
  line-height: 1.4;
  color: var(--theme-fg-muted, #888);
}

.new-intent-dialog__textarea {
  width: 100%;
  padding: 10px 12px;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.5;
  color: var(--theme-fg, #1f1f1f);
  background: var(--theme-bg, #fff);
  border: 1px solid var(--theme-border, #e6e6e6);
  border-radius: 6px;
  resize: vertical;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.new-intent-dialog__textarea:focus {
  border-color: var(--theme-accent, #2c5cff);
  box-shadow: 0 0 0 3px var(--theme-accent-muted, rgba(44, 92, 255, 0.15));
}

.new-intent-dialog__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.new-intent-dialog__chip {
  padding: 5px 10px;
  font-size: 12px;
  border: 1px solid var(--theme-border, #e6e6e6);
  border-radius: 999px;
  background: var(--theme-bg-subtle, #f5f5f5);
  color: var(--theme-fg, #333);
  cursor: pointer;
  transition: all 120ms ease;
}

.new-intent-dialog__chip:hover {
  border-color: var(--theme-accent, #2c5cff);
  color: var(--theme-accent, #2c5cff);
}

.new-intent-dialog__shortcut {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--theme-fg-subtle, #999);
}

.new-intent-dialog__shortcut kbd {
  display: inline-block;
  padding: 1px 5px;
  font-family: monospace;
  font-size: 10px;
  background: var(--theme-bg-subtle, #f5f5f5);
  border: 1px solid var(--theme-border, #ddd);
  border-radius: 3px;
}

.new-intent-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--theme-border, #e6e6e6);
  align-items: center;
}

.new-intent-dialog__btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 120ms ease;
}

.new-intent-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.new-intent-dialog__btn--ghost {
  background: transparent;
  color: var(--theme-fg, #333);
}

.new-intent-dialog__btn--ghost:hover:not(:disabled) {
  background: var(--theme-bg-subtle, #f5f5f5);
}

.new-intent-dialog__btn--primary {
  background: var(--theme-accent, #2c5cff);
  color: #fff;
}

.new-intent-dialog__btn--primary:hover:not(:disabled) {
  background: var(--theme-accent-hover, #1e4dd8);
}

@media (max-width: 480px) {
  .new-intent-dialog__format-group-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
