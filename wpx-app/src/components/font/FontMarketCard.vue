<script setup>
import { computed, onMounted } from 'vue'
import { toFontSelectItem } from '@/composables/useFontMarket'
import { useEditorFonts } from '@/composables/useEditorFonts'
import {
  getFontDownloadProgress,
  isFontDownloadFailed,
  isFontDownloading,
} from '@/composables/useFontDownloader'

const props = defineProps({
  font: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['preview', 'download'])

const { ensureFontPreview, getPreviewFontFamily, previewStatus } = useEditorFonts()

const downloadBadge = computed(() => {
  if (!props.font.needsDownload && !isFontDownloadFailed(props.font.id)) {
    return null
  }

  if (isFontDownloading(props.font.id)) {
    return {
      kind: 'loading',
      title: `下载中 ${getFontDownloadProgress(props.font.id)}%`,
    }
  }

  if (isFontDownloadFailed(props.font.id)) {
    return {
      kind: 'failed',
      value: '⚠️',
      title: '下载失败，点击重试',
    }
  }

  return {
    kind: 'download',
    value: '↓',
    title: '点击下载字体',
  }
})

function getCardPreviewStyle() {
  previewStatus.value
  return { fontFamily: getPreviewFontFamily(toFontSelectItem(props.font)) }
}

function getPriceLabel() {
  // V1.1 完全免费模式：不再提供付费字体入口，统一显示"免费"
  return props.font.isFree ? '免费' : '免费 · 需自导入'
}

async function handleDownloadClick() {
  if (!downloadBadge.value) return
  if (isFontDownloading(props.font.id)) return

  if (props.font.needsDownload || isFontDownloadFailed(props.font.id)) {
    emit('download', props.font)
  }
}

onMounted(() => {
  if (props.font.needsDownload) return
  if (props.font.type === 'commercial' && !props.font.localPath) return
  void ensureFontPreview(toFontSelectItem(props.font))
})
</script>

<template>
  <article class="font-market-card">
    <button
      v-if="downloadBadge"
      type="button"
      class="font-market-card__download"
      :class="{
        'font-market-card__download--loading': downloadBadge.kind === 'loading',
        'font-market-card__download--failed': downloadBadge.kind === 'failed',
      }"
      :title="downloadBadge.title"
      :aria-label="downloadBadge.title"
      @click="handleDownloadClick"
    >
      <svg
        v-if="downloadBadge.kind === 'loading'"
        class="font-market-card__spinner"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          class="font-market-card__spinner-track"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="3"
        />
        <path
          class="font-market-card__spinner-head"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span v-else>{{ downloadBadge.value }}</span>
    </button>

    <div class="font-market-card__preview">
      <img
        v-if="font.thumbnailUrl"
        :src="font.thumbnailUrl"
        :alt="`${font.name} 预览图`"
        class="font-market-card__preview-image"
        loading="lazy"
      />
      <p v-else class="font-market-card__preview-text" :style="getCardPreviewStyle()">
        {{ font.sampleText }}
      </p>
    </div>

    <div class="font-market-card__body">
      <h2 class="font-market-card__title">{{ font.name }}</h2>
      <p
        class="font-market-card__price"
        :class="{ 'font-market-card__price--paid': !font.isFree }"
      >
        {{ getPriceLabel() }}
      </p>
      <p v-if="!font.isFree" class="font-market-card__hint">
        商业字体由用户自行采购授权后从「我的字体」导入
      </p>
      <button type="button" class="font-market-card__preview-btn" @click="emit('preview', font)">
        预览效果
      </button>
    </div>
  </article>
</template>

<style scoped>
.font-market-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  background: var(--theme-bg, #fff);
  box-shadow: var(--theme-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06));
}

.font-market-card__download {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--theme-accent, #2563eb);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.font-market-card__download--loading {
  cursor: wait;
}

.font-market-card__download--failed {
  color: #dc2626;
  border-color: rgba(239, 68, 68, 0.35);
}

.font-market-card__download:hover {
  border-color: var(--theme-accent, #2563eb);
}

.font-market-card__spinner {
  width: 14px;
  height: 14px;
  animation: font-market-card-spin 0.8s linear infinite;
}

.font-market-card__spinner-track {
  opacity: 0.25;
}

.font-market-card__spinner-head {
  opacity: 0.85;
}

@keyframes font-market-card-spin {
  to {
    transform: rotate(360deg);
  }
}

.font-market-card__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  padding: 16px;
  background: var(--theme-bg-subtle, #f8fafc);
}

.font-market-card__preview-image {
  max-width: 100%;
  max-height: 96px;
  object-fit: contain;
}

.font-market-card__preview-text {
  margin: 0;
  font-size: 24px;
  line-height: 1.4;
  text-align: center;
  color: var(--theme-fg, #0f172a);
  word-break: break-word;
}

.font-market-card__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px 16px;
}

.font-market-card__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.font-market-card__price {
  margin: 0;
  font-size: 13px;
  color: #16a34a;
}

.font-market-card__price--paid {
  color: #d97706;
}

.font-market-card__preview-btn {
  margin-top: 4px;
  height: 34px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #334155);
  font-size: 13px;
  cursor: pointer;
}

.font-market-card__preview-btn:hover {
  border-color: var(--theme-accent, #2563eb);
  color: var(--theme-accent, #2563eb);
}
</style>
