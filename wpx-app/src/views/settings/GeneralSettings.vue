<script setup>
import { computed, onMounted, reactive, watch } from 'vue'
import {
  AUTO_SAVE_INTERVAL_OPTIONS,
  EDITOR_FONT_SIZE_OPTIONS,
  LANGUAGE_OPTIONS,
  STARTUP_BEHAVIOR_OPTIONS,
  THEME_OPTIONS,
} from '@/constants/generalPreferences'
import {
  HEADER_FOOTER_OPTIONS,
  PAPER_MARGIN_OPTIONS,
  PAPER_SIZE_OPTIONS,
  createDefaultPaperSettings,
  mergePaperSettings,
} from '@/constants/paperPreferences'
import { useGeneralSettingsStore } from '@/stores/generalSettings'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { isElectron } from '@/utils/electron'
import { pickExtractDirectory } from '@/utils/zipApi'

const generalSettingsStore = useGeneralSettingsStore()
const userPreferencesStore = useUserPreferencesStore()

const paperForm = reactive(createDefaultPaperSettings())

function syncPaperFormFromStore() {
  Object.assign(paperForm, mergePaperSettings({}, userPreferencesStore.paper))
}

const theme = computed({
  get: () => generalSettingsStore.theme,
  set: (value) => {
    generalSettingsStore.updateSettings({ theme: value })
  },
})

const language = computed({
  get: () => generalSettingsStore.language,
  set: (value) => {
    generalSettingsStore.updateSettings({ language: value })
  },
})

const autoSaveEnabled = computed({
  get: () => generalSettingsStore.autoSaveEnabled,
  set: (value) => {
    generalSettingsStore.updateSettings({
      autoSave: {
        enabled: value,
        intervalMs: generalSettingsStore.autoSaveIntervalMs,
      },
    })
  },
})

const autoSaveIntervalMs = computed({
  get: () => generalSettingsStore.autoSaveIntervalMs,
  set: (value) => {
    generalSettingsStore.updateSettings({
      autoSave: {
        enabled: generalSettingsStore.autoSaveEnabled,
        intervalMs: Number(value),
      },
    })
  },
})

const editorFontSize = computed({
  get: () => generalSettingsStore.editorFontSize,
  set: (value) => {
    generalSettingsStore.updateSettings({ editorFontSize: value })
  },
})

const startupBehavior = computed({
  get: () => generalSettingsStore.startupBehavior,
  set: (value) => {
    generalSettingsStore.updateSettings({ startupBehavior: value })
  },
})

const defaultSavePathLabel = computed(() =>
  generalSettingsStore.defaultSavePath.trim() || '未设置（保存时使用系统默认位置）',
)

const paperSize = computed({
  get: () => paperForm.paperSize,
  set: (value) => {
    if (paperForm.paperSize === value) return
    paperForm.paperSize = value
    userPreferencesStore.setPaperSize(value).catch((error) => {
      console.warn('[GeneralSettings] Failed to persist paperSize:', error)
    })
  },
})

const paperMargin = computed({
  get: () => paperForm.paperMargin,
  set: (value) => {
    if (paperForm.paperMargin === value) return
    paperForm.paperMargin = value
    userPreferencesStore.setPaperMargin(value).catch((error) => {
      console.warn('[GeneralSettings] Failed to persist paperMargin:', error)
    })
  },
})

const headerFooter = computed({
  get: () => paperForm.headerFooter,
  set: (value) => {
    if (paperForm.headerFooter === value) return
    paperForm.headerFooter = value
    userPreferencesStore.setHeaderFooter(value).catch((error) => {
      console.warn('[GeneralSettings] Failed to persist headerFooter:', error)
    })
  },
})

const focusMode = computed({
  get: () => paperForm.focusMode,
  set: (value) => {
    const next = Boolean(value)
    if (paperForm.focusMode === next) return
    paperForm.focusMode = next
    userPreferencesStore.setFocusMode(next).catch((error) => {
      console.warn('[GeneralSettings] Failed to persist focusMode:', error)
    })
  },
})

const isCustomMargin = computed(() => paperForm.paperMargin === 'custom')

const customMarginFields = [
  { key: 'top', label: '上' },
  { key: 'bottom', label: '下' },
  { key: 'left', label: '左' },
  { key: 'right', label: '右' },
]

function handleCustomMarginInput(key, event) {
  const raw = event?.target?.value
  const parsed = Number.parseFloat(raw)
  const numeric = Number.isFinite(parsed) ? Math.round(parsed) : 0
  const safe = Math.min(100, Math.max(0, numeric))

  paperForm.customMargin[key] = safe
  userPreferencesStore.setCustomMargin({ [key]: safe }).catch((error) => {
    console.warn('[GeneralSettings] Failed to persist customMargin:', error)
  })
}

function getCustomMarginInputValue(key) {
  const value = paperForm.customMargin?.[key]
  return Number.isFinite(value) ? String(value) : '0'
}

async function handlePickSavePath() {
  if (!isElectron()) return

  const result = await pickExtractDirectory(generalSettingsStore.defaultSavePath || undefined)
  if (result?.ok && result.directoryPath) {
    await generalSettingsStore.updateSettings({ defaultSavePath: result.directoryPath })
  }
}

onMounted(() => {
  if (!generalSettingsStore.hydrated) {
    generalSettingsStore.initFromLocalStorage()
  }
  if (!userPreferencesStore.hydrated) {
    userPreferencesStore.initFromLocalStorage()
  }
  syncPaperFormFromStore()
  userPreferencesStore.subscribeRemoteChanges()
})

watch(
  () => userPreferencesStore.paper,
  (next) => {
    if (!next) return
    Object.assign(paperForm, mergePaperSettings({}, next))
  },
  { deep: true },
)
</script>

<template>
  <section class="settings-panel">
    <header class="settings-panel__header">
      <h2 class="settings-panel__title">通用设置</h2>
      <p class="settings-panel__desc">主题、语言、默认保存路径等全局偏好，修改后立即生效。</p>
    </header>

    <div class="general-form">
      <div class="settings-card">
        <fieldset class="settings-field settings-fieldset">
          <legend class="settings-label">主题</legend>
          <div class="radio-group">
            <label v-for="option in THEME_OPTIONS" :key="option.value" class="radio-option">
              <input v-model="theme" type="radio" name="general-theme" :value="option.value" />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </fieldset>

        <div class="settings-field">
          <label class="settings-label" for="general-language">界面语言</label>
          <select id="general-language" v-model="language" class="settings-input">
            <option v-for="option in LANGUAGE_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-field">
          <span class="settings-label">默认保存路径</span>
          <p class="settings-path">{{ defaultSavePathLabel }}</p>
          <div class="settings-input-row">
            <button
              type="button"
              class="settings-btn-secondary"
              :disabled="!isElectron()"
              @click="handlePickSavePath"
            >
              选择路径
            </button>
          </div>
          <p v-if="!isElectron()" class="settings-hint">桌面版可用文件夹选择器；浏览器环境请在保存时指定位置。</p>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-field">
          <label class="general-switch" for="general-autosave">
            <input id="general-autosave" v-model="autoSaveEnabled" type="checkbox" />
            <span class="general-switch__slider" aria-hidden="true" />
            <span class="general-switch__text">自动保存草稿</span>
          </label>
          <p class="settings-hint">编辑内容将自动保存到本地草稿，可在启动时恢复。</p>
        </div>

        <div v-if="autoSaveEnabled" class="settings-field">
          <label class="settings-label" for="general-autosave-interval">自动保存间隔</label>
          <select id="general-autosave-interval" v-model="autoSaveIntervalMs" class="settings-input">
            <option
              v-for="option in AUTO_SAVE_INTERVAL_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="settings-card">
        <fieldset class="settings-field settings-fieldset">
          <legend class="settings-label">编辑器字体大小</legend>
          <div class="radio-group">
            <label
              v-for="option in EDITOR_FONT_SIZE_OPTIONS"
              :key="option.value"
              class="radio-option"
            >
              <input
                v-model="editorFontSize"
                type="radio"
                name="editor-font-size"
                :value="option.value"
              />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </fieldset>

        <div
          class="font-preview"
          :style="{ fontSize: generalSettingsStore.editorFontSizePx }"
          aria-live="polite"
        >
          <p class="font-preview__title">预览</p>
          <p class="font-preview__body">
            这是一段示例文字，用于预览编辑器正文字号。The quick brown fox jumps over the lazy dog.
          </p>
        </div>
      </div>

      <div class="settings-card">
        <fieldset class="settings-field settings-fieldset">
          <legend class="settings-label">启动时行为</legend>
          <div class="radio-group">
            <label
              v-for="option in STARTUP_BEHAVIOR_OPTIONS"
              :key="option.value"
              class="radio-option"
            >
              <input
                v-model="startupBehavior"
                type="radio"
                name="startup-behavior"
                :value="option.value"
              />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </fieldset>
      </div>

      <div class="settings-card" data-testid="paper-settings-card">
        <h3 class="settings-card__title">导出与纸张</h3>
        <p class="settings-card__desc">
          设置虚拟纸张的尺寸、边距、页眉页脚，以及焦点写作模式；修改后即时写入本地并在多窗口间同步。
        </p>

        <div class="settings-field">
          <label class="settings-label" for="paper-size">默认纸张</label>
          <select id="paper-size" v-model="paperSize" class="settings-input">
            <option v-for="option in PAPER_SIZE_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <fieldset class="settings-field settings-fieldset">
          <legend class="settings-label">默认页边距</legend>
          <div class="radio-group">
            <label
              v-for="option in PAPER_MARGIN_OPTIONS"
              :key="option.value"
              class="radio-option"
            >
              <input
                v-model="paperMargin"
                type="radio"
                name="paper-margin"
                :value="option.value"
              />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </fieldset>

        <div v-if="isCustomMargin" class="settings-field paper-custom-margin">
          <label class="settings-label">自定义边距（mm）</label>
          <div class="paper-custom-margin__grid">
            <label
              v-for="field in customMarginFields"
              :key="field.key"
              class="paper-custom-margin__cell"
            >
              <span class="paper-custom-margin__caption">{{ field.label }}</span>
              <input
                :value="getCustomMarginInputValue(field.key)"
                type="number"
                min="0"
                max="100"
                step="1"
                class="settings-input"
                :data-margin="field.key"
                @input="handleCustomMarginInput(field.key, $event)"
              />
            </label>
          </div>
          <p class="settings-hint">取值范围 0–100 mm，超出范围会自动夹紧。</p>
        </div>

        <fieldset class="settings-field settings-fieldset">
          <legend class="settings-label">页眉页脚</legend>
          <div class="radio-group">
            <label
              v-for="option in HEADER_FOOTER_OPTIONS"
              :key="option.value"
              class="radio-option"
            >
              <input
                v-model="headerFooter"
                type="radio"
                name="paper-header-footer"
                :value="option.value"
              />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </fieldset>

        <div class="settings-field">
          <label class="general-switch" for="paper-focus-mode">
            <input id="paper-focus-mode" v-model="focusMode" type="checkbox" />
            <span class="general-switch__slider" aria-hidden="true" />
            <span class="general-switch__text">焦点写作模式</span>
          </label>
          <p class="settings-hint">启用后仅展示当前段落，隐藏工具栏与预览，沉浸式写作。</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@import './settings-shared.css';

.general-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-fieldset {
  margin: 0;
  padding: 0;
  border: none;
}

.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
}

.radio-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--theme-fg-muted);
  cursor: pointer;
}

.radio-option input {
  accent-color: var(--theme-accent);
}

.settings-path {
  margin: 0 0 10px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-sm, 6px);
  background: var(--theme-bg-subtle);
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--theme-fg-muted);
  word-break: break-all;
}

.general-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.general-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.general-switch__slider {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: var(--theme-border);
  transition: background 0.15s;
}

.general-switch__slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s;
}

.general-switch input:checked + .general-switch__slider {
  background: var(--theme-accent);
}

.general-switch input:checked + .general-switch__slider::after {
  transform: translateX(18px);
}

.general-switch__text {
  font-size: 13px;
  font-weight: 500;
  color: var(--theme-fg);
}

.font-preview {
  margin-top: 4px;
  border: 1px dashed var(--theme-border);
  border-radius: var(--theme-radius-sm, 6px);
  background: var(--theme-bg-subtle);
  padding: 14px 16px;
  line-height: 1.75;
  color: var(--theme-fg-muted);
}

.font-preview__title {
  margin: 0 0 6px;
  font-size: 0.85em;
  font-weight: 600;
  color: var(--theme-fg-subtle);
}

.font-preview__body {
  margin: 0;
}

.paper-custom-margin__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 640px) {
  .paper-custom-margin__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.paper-custom-margin__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.paper-custom-margin__cell .settings-input {
  width: 100%;
}

.paper-custom-margin__caption {
  font-size: 12px;
  color: var(--theme-fg-subtle);
}
</style>
