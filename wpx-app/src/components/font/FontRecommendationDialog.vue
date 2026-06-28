<script setup>
import { computed, ref, watch } from 'vue'
import AiAvatar from '@/components/ai/AiAvatar.vue'
import { useFontDownloader } from '@/composables/useFontDownloader'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  missing: {
    type: Array,
    default: () => [],
  },
  available: {
    type: Array,
    default: () => [],
  },
  systemFontCount: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'close',
  'download-all',
  'skip',
  'never-ask',
  'install-manually',
])

const settingsStore = useSettingsStore()
const toast = useToast()
const downloader = useFontDownloader()

/** @type {import('vue').Ref<Set<string>>} */
const downloadingIds = ref(new Set())
/** @type {import('vue').Ref<Set<string>>} */
const downloadedIds = ref(new Set())
/** @type {import('vue').Ref<Set<string>>} */
const failedIds = ref(new Set())

const allComplete = computed(() => {
  if (!props.missing?.length) return false
  return props.missing.every((font) => downloadedIds.value.has(font.id))
})

const hasFailures = computed(() => failedIds.value.size > 0)
const isAnyDownloading = computed(() => downloadingIds.value.size > 0)

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      downloadingIds.value = new Set()
      downloadedIds.value = new Set()
      failedIds.value = new Set()
    }
  },
)

/**
 * @param {string} id
 */
function markDownloading(id) {
  const next = new Set(downloadingIds.value)
  next.add(id)
  downloadingIds.value = next
}

/**
 * @param {string} id
 */
function markDownloaded(id) {
  downloadedIds.value = new Set([...downloadedIds.value, id])
  const next = new Set(downloadingIds.value)
  next.delete(id)
  downloadingIds.value = next
}

/**
 * @param {string} id
 */
function markFailed(id) {
  failedIds.value = new Set([...failedIds.value, id])
  const next = new Set(downloadingIds.value)
  next.delete(id)
  downloadingIds.value = next
}

/**
 * @param {{ id: string, downloadUrl?: string, fileName?: string, name: string }} font
 */
async function downloadOne(font) {
  if (!font?.downloadUrl) {
    toast.error(`${font?.name || '字体'} 下载链接缺失`)
    markFailed(font.id)
    return
  }

  if (downloadingIds.value.has(font.id)) return
  if (downloadedIds.value.has(font.id)) return

  markDownloading(font.id)

  try {
    await downloader.download(font.id, font.downloadUrl, {
      type: 'free',
      fileName: font.fileName,
      fontName: font.name,
      onProgress: () => {},
    })
    markDownloaded(font.id)
  } catch (error) {
    markFailed(font.id)
    console.warn('[FontRecommendationDialog] download failed', font.id, error)
  }
}

async function downloadAll() {
  if (!props.missing?.length) return
  emit('download-all')
  for (const font of props.missing) {
    if (downloadedIds.value.has(font.id)) continue
    await downloadOne(font)
  }
  if (allComplete.value) {
    emit('close')
  }
}

function handleSkip() {
  emit('skip')
}

function handleNeverAsk() {
  emit('never-ask')
}

function handleInstallManually() {
  emit('install-manually')
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Transition name="font-recommend-fade">
    <div
      v-if="visible"
      class="font-recommend-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="font-recommend-title"
      @mousedown.self="handleClose"
    >
      <div class="font-recommend-dialog">
        <header class="font-recommend-header">
          <div class="font-recommend-avatar">
            <AiAvatar
              :preset="settingsStore.avatarId"
              :avatar-url="settingsStore.avatarUrl"
            />
          </div>
          <div class="font-recommend-header-text">
            <h2 id="font-recommend-title" class="font-recommend-title">
              发现一些更适合中文写作的免费字体
            </h2>
            <p class="font-recommend-subtitle">
              检测到当前系统字体库中暂未包含以下 {{ missing.length }} 款优质免费字体，加载后可在
              <strong>字体下拉</strong> 中直接使用。
            </p>
          </div>
          <button
            type="button"
            class="font-recommend-close"
            aria-label="关闭"
            @click="handleClose"
          >
            ✕
          </button>
        </header>

        <div class="font-recommend-body">
          <p v-if="available.length" class="font-recommend-tip">
            系统已识别到 {{ available.length }} 款推荐字体，无需重复加载。
          </p>

          <ul v-if="missing.length" class="font-recommend-list">
            <li
              v-for="font in missing"
              :key="font.id"
              class="font-recommend-item"
              :class="{
                'is-downloading': downloadingIds.has(font.id),
                'is-downloaded': downloadedIds.has(font.id),
                'is-failed': failedIds.has(font.id),
              }"
            >
              <div class="font-recommend-item__head">
                <span class="font-recommend-item__name">{{ font.name }}</span>
                <span class="font-recommend-item__category">{{ font.category || '其他' }}</span>
              </div>
              <p class="font-recommend-item__sample">{{ font.sampleText || font.name }}</p>
              <p v-if="font.description" class="font-recommend-item__desc">
                {{ font.description }}
              </p>
              <div class="font-recommend-item__status">
                <template v-if="downloadedIds.has(font.id)">已下载</template>
                <template v-else-if="downloadingIds.has(font.id)">下载中…</template>
                <template v-else-if="failedIds.has(font.id)">下载失败，可重试</template>
                <template v-else>未安装</template>
              </div>
            </li>
          </ul>

          <p v-else class="font-recommend-empty">系统字体库已包含所有推荐字体，无需加载。</p>
        </div>

        <footer class="font-recommend-footer">
          <div class="font-recommend-footer__group">
            <button
              type="button"
              class="font-recommend-footer__btn font-recommend-footer__btn--secondary"
              :disabled="isAnyDownloading"
              @click="handleInstallManually"
            >
              我已经自己安装过了
            </button>
            <button
              type="button"
              class="font-recommend-footer__btn font-recommend-footer__btn--secondary"
              :disabled="isAnyDownloading"
              @click="handleSkip"
            >
              下次再说
            </button>
            <button
              type="button"
              class="font-recommend-footer__btn font-recommend-footer__btn--tertiary"
              :disabled="isAnyDownloading"
              @click="handleNeverAsk"
            >
              不再提醒
            </button>
          </div>
          <button
            type="button"
            class="font-recommend-footer__btn font-recommend-footer__btn--primary"
            :disabled="!missing.length || isAnyDownloading"
            @click="downloadAll"
          >
            {{ isAnyDownloading ? '加载中…' : '全部加载' }}
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.font-recommend-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 80px 16px 16px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
}

.font-recommend-dialog {
  width: min(100%, 520px);
  max-height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-bg);
  color: var(--theme-fg);
  box-shadow: var(--theme-shadow-lg);
  overflow: hidden;
}

.font-recommend-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--theme-border);
}

.font-recommend-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-bg-soft, rgba(128, 128, 128, 0.1));
}

.font-recommend-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.font-recommend-subtitle {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--theme-fg-muted);
}

.font-recommend-close {
  border: none;
  background: transparent;
  color: var(--theme-fg-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
}

.font-recommend-body {
  padding: 12px 18px 4px;
  overflow-y: auto;
  flex: 1 1 auto;
}

.font-recommend-tip {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--theme-bg-soft, rgba(128, 128, 128, 0.08));
  font-size: 12.5px;
  color: var(--theme-fg-muted);
  line-height: 1.5;
}

.font-recommend-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.font-recommend-item {
  padding: 12px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: var(--theme-bg-soft, rgba(128, 128, 128, 0.04));
  transition: border-color 0.18s, background 0.18s;
}

.font-recommend-item.is-downloaded {
  border-color: var(--theme-success, #16a34a);
}

.font-recommend-item.is-failed {
  border-color: var(--theme-danger, #dc2626);
}

.font-recommend-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.font-recommend-item__name {
  font-size: 14px;
  font-weight: 600;
}

.font-recommend-item__category {
  font-size: 11px;
  color: var(--theme-fg-muted);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--theme-bg-hover, rgba(128, 128, 128, 0.08));
}

.font-recommend-item__sample {
  margin: 6px 0 0;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--theme-fg);
}

.font-recommend-item__desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--theme-fg-muted);
}

.font-recommend-item__status {
  margin-top: 6px;
  font-size: 11.5px;
  color: var(--theme-fg-muted);
}

.font-recommend-item.is-downloaded .font-recommend-item__status {
  color: var(--theme-success, #16a34a);
}

.font-recommend-item.is-failed .font-recommend-item__status {
  color: var(--theme-danger, #dc2626);
}

.font-recommend-empty {
  margin: 8px 0 16px;
  padding: 14px 12px;
  border-radius: 10px;
  background: var(--theme-bg-soft, rgba(128, 128, 128, 0.06));
  font-size: 12.5px;
  color: var(--theme-fg-muted);
  text-align: center;
}

.font-recommend-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  padding: 12px 18px 14px;
  border-top: 1px solid var(--theme-border);
  background: var(--theme-bg-soft, rgba(128, 128, 128, 0.04));
}

.font-recommend-footer__group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.font-recommend-footer__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease,
    box-shadow 0.15s ease;
}

.font-recommend-footer__btn:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 2px;
}

.font-recommend-footer__btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.font-recommend-footer__btn--primary {
  background: var(--theme-accent, #7c3aed);
  border-color: var(--theme-accent, #7c3aed);
  color: #fff;
}

.font-recommend-footer__btn--primary:hover:not(:disabled) {
  background: var(--theme-accent-hover, #6d28d9);
  border-color: var(--theme-accent-hover, #6d28d9);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent) 30%, transparent);
}

.font-recommend-footer__btn--secondary {
  background: var(--theme-bg, #fff);
  border-color: var(--theme-border, #e2e8f0);
  color: var(--theme-fg-muted, #475569);
}

.font-recommend-footer__btn--secondary:hover:not(:disabled) {
  background: var(--theme-bg-subtle, #f8fafc);
  border-color: color-mix(in srgb, var(--theme-fg-muted, #475569) 30%, var(--theme-border, #e2e8f0));
  color: var(--theme-fg, #0f172a);
}

.font-recommend-footer__btn--tertiary {
  background: transparent;
  border-color: transparent;
  color: var(--theme-fg-muted, #64748b);
  padding: 6px 8px;
}

.font-recommend-footer__btn--tertiary:hover:not(:disabled) {
  background: var(--theme-bg-hover, rgba(128, 128, 128, 0.08));
  color: var(--theme-fg, #0f172a);
}

.font-recommend-fade-enter-active,
.font-recommend-fade-leave-active {
  transition: opacity 0.18s ease;
}

.font-recommend-fade-enter-from,
.font-recommend-fade-leave-to {
  opacity: 0;
}
</style>
