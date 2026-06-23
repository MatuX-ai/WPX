<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronDown, Type } from '@lucide/vue'
import { useEditorFonts } from '@/composables/useEditorFonts'

const props = defineProps({
  editor: {
    type: Object,
    default: null,
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const {
  loading,
  downloadingId,
  fontGroups,
  previewStatus,
  loadFonts,
  applyFontToEditor,
  downloadFontItem,
  getFontDownloadBadge,
  prefetchPreview,
  preloadDropdownPreviews,
  getPreviewFontFamily,
  isFontDownloading,
} = useEditorFonts()

const open = ref(false)
const rootRef = ref(null)
const toolbarVersion = ref(0)

const currentFontLabel = computed(() => {
  toolbarVersion.value
  const ed = props.editor
  if (!ed) return '字体'

  const cssFamily = ed.getAttributes('fontFamily')?.fontFamily
  if (!cssFamily) return '字体'

  const matched = fontGroups.value
    .flatMap((group) => group.items)
    .find((item) => item.cssFamily === cssFamily)

  return matched?.name || cssFamily.replace(/['"]/g, '').split(',')[0] || '字体'
})

const currentFontFamily = computed(() => {
  toolbarVersion.value
  previewStatus.value
  const ed = props.editor
  if (!ed) return undefined

  const cssFamily = ed.getAttributes('fontFamily')?.fontFamily
  if (!cssFamily) return undefined

  const matched = fontGroups.value
    .flatMap((group) => group.items)
    .find((item) => item.cssFamily === cssFamily)

  if (!matched) return cssFamily
  return getPreviewFontFamily(matched) === 'inherit' ? undefined : getPreviewFontFamily(matched)
})

function refreshLabel() {
  toolbarVersion.value += 1

  const ed = props.editor
  if (!ed) return

  const cssFamily = ed.getAttributes('fontFamily')?.fontFamily
  if (!cssFamily) return

  const matched = fontGroups.value
    .flatMap((group) => group.items)
    .find((item) => item.cssFamily === cssFamily)

  if (matched) {
    prefetchPreview(matched)
  }
}

function closePanel() {
  open.value = false
}

function togglePanel() {
  if (!props.editor) return
  open.value = !open.value
}

async function handleSelect(item) {
  if (!props.editor) return
  if (isFontDownloading(item.id) && downloadingId.value !== item.id) return

  const badge = getFontDownloadBadge(item)
  if (badge?.kind === 'download' || badge?.kind === 'failed') {
    try {
      await downloadFontItem(item)
    } catch {
      // 错误提示由 useFontDownloader 负责
    }
    return
  }

  if (downloadingId.value) return

  const applied = await applyFontToEditor(props.editor, item)
  if (applied) {
    refreshLabel()
    closePanel()
  }
}

function handleDocumentClick(event) {
  if (!open.value) return
  if (rootRef.value?.contains(event.target)) return
  closePanel()
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    closePanel()
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  void preloadDropdownPreviews()
})

onMounted(async () => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
  await loadFonts()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown)
})

defineExpose({
  reload: loadFonts,
  refreshLabel,
})
</script>

<template>
  <div ref="rootRef" class="font-family-select">
    <button
      type="button"
      class="font-family-select__trigger"
      :class="{ 'font-family-select__trigger--compact': compact }"
      :disabled="!editor || loading"
      :title="compact ? '字体' : undefined"
      aria-haspopup="listbox"
      :aria-expanded="open ? 'true' : 'false'"
      aria-label="字体"
      @click="togglePanel"
    >
      <Type v-if="compact" :size="16" aria-hidden="true" />
      <span
        v-if="!compact"
        class="font-family-select__label"
        :style="currentFontFamily ? { fontFamily: currentFontFamily } : undefined"
      >
        {{ currentFontLabel }}
      </span>
      <ChevronDown :size="14" aria-hidden="true" />
    </button>

    <div v-if="open" class="font-family-select__panel" role="listbox" aria-label="字体列表">
      <div v-if="loading" class="font-family-select__empty">加载字体中…</div>

      <template v-else>
        <template v-for="(group, groupIndex) in fontGroups" :key="group.key">
          <div
            v-if="groupIndex > 0"
            class="font-family-select__divider"
            aria-hidden="true"
          />

          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="font-family-select__option"
            :class="{
              'font-family-select__option--downloading': isFontDownloading(item.id),
              'font-family-select__option--preview-loading':
                previewStatus[item.id] === 'loading' && !item.needsDownload,
              'font-family-select__option--download-failed':
                getFontDownloadBadge(item)?.kind === 'failed',
            }"
            role="option"
            :aria-label="item.badge ? `${item.name} ${item.badge}` : item.name"
            :title="item.badgeTitle || undefined"
            @mouseenter="prefetchPreview(item)"
            @click="handleSelect(item)"
          >
            <span
              class="font-family-select__option-name"
              :style="{ fontFamily: getPreviewFontFamily(item) }"
            >
              {{ item.name }}
            </span>
            <span
              v-if="getFontDownloadBadge(item)"
              class="font-family-select__badge"
              :class="{
                'font-family-select__badge--download':
                  getFontDownloadBadge(item)?.kind === 'download',
                'font-family-select__badge--paid': getFontDownloadBadge(item)?.value === '⚡',
                'font-family-select__badge--system': getFontDownloadBadge(item)?.value === '⚠️' &&
                  getFontDownloadBadge(item)?.kind === 'badge',
                'font-family-select__badge--failed':
                  getFontDownloadBadge(item)?.kind === 'failed',
                'font-family-select__badge--spinning':
                  getFontDownloadBadge(item)?.kind === 'loading',
              }"
              :title="getFontDownloadBadge(item)?.title || undefined"
            >
              <svg
                v-if="getFontDownloadBadge(item)?.kind === 'loading'"
                class="font-family-select__spinner"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  class="font-family-select__spinner-track"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="3"
                />
                <path
                  class="font-family-select__spinner-head"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <template v-else>
                {{ getFontDownloadBadge(item)?.value }}
              </template>
            </span>
          </button>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.font-family-select {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.font-family-select__trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  max-width: 132px;
  padding: 0 8px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 6px;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #334155);
  font-size: 12px;
  cursor: pointer;
}

.font-family-select__trigger--compact {
  width: 28px;
  max-width: 28px;
  justify-content: center;
  padding: 0;
}

.font-family-select__trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.font-family-select__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-family-select__panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 40;
  min-width: 220px;
  max-height: 320px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg, #fff);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
}

.font-family-select__divider {
  height: 1px;
  margin: 6px 4px;
  background: var(--theme-border, #e2e8f0);
}

.font-family-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 32px;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--theme-fg, #0f172a);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.font-family-select__option:hover {
  background: var(--theme-bg-subtle, #f8fafc);
}

.font-family-select__option--downloading {
  opacity: 0.6;
  cursor: wait;
}

.font-family-select__option--preview-loading .font-family-select__option-name {
  color: var(--theme-fg-muted, #64748b);
}

.font-family-select__option-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-family-select__badge {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1;
}

.font-family-select__option--download-failed {
  background: rgba(239, 68, 68, 0.04);
}

.font-family-select__badge--failed {
  color: #dc2626;
  cursor: pointer;
}

.font-family-select__badge--spinning {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-accent, #2563eb);
}

.font-family-select__spinner {
  width: 14px;
  height: 14px;
  animation: font-family-select-spin 0.8s linear infinite;
}

.font-family-select__spinner-track {
  opacity: 0.25;
}

.font-family-select__spinner-head {
  opacity: 0.85;
}

@keyframes font-family-select-spin {
  to {
    transform: rotate(360deg);
  }
}

.font-family-select__badge--system {
  cursor: help;
}

.font-family-select__empty {
  padding: 10px;
  color: var(--theme-fg-muted, #64748b);
  font-size: 12px;
}
</style>
