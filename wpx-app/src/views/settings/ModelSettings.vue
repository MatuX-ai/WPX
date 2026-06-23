<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useModelSettingsStore } from '@/stores/modelSettings'
import {
  DEFAULT_GUEST_DAILY_LIMIT,
  fetchGuestFreeQuota,
  formatGuestQuotaLabel,
  GUEST_FREE_MODEL_LABEL,
} from '@/utils/freeModelQuota'
import { testModelConnection } from '@/utils/modelApi'

const toast = useToast()
const authStore = useAuthStore()
const { isGuest } = storeToRefs(authStore)
const { login, isLoggingIn } = useAuth()
const modelSettingsStore = useModelSettingsStore()

const saving = ref(false)
const testingText = ref(false)
const testingVision = ref(false)
const quotaLoading = ref(false)
const guestQuota = ref({
  limit: DEFAULT_GUEST_DAILY_LIMIT,
  remaining: null,
  used: null,
})

const guestQuotaLabel = computed(() => formatGuestQuotaLabel(guestQuota.value))

const form = reactive({
  textSource: 'platform',
  textEndpoint: '',
  textApiKey: '',
  textModelName: '',
  visionSource: 'platform',
  visionEndpoint: '',
  visionApiKey: '',
  visionModelName: '',
  temperature: 0.7,
  topP: 0.9,
  maxOutputTokens: 4096,
})

const showPrivacyBanner = computed(() => form.textSource === 'custom' || form.visionSource === 'custom')

const textApiKeyPlaceholder = computed(() =>
  modelSettingsStore.hasStoredTextApiKey ? '输入新 Key 以更新' : 'sk-...',
)

const visionApiKeyPlaceholder = computed(() =>
  modelSettingsStore.hasStoredVisionApiKey ? '输入新 Key 以更新' : 'sk-...',
)

function syncFormFromStore() {
  const settings = modelSettingsStore.data
  form.textSource = settings.text.source
  form.textEndpoint = settings.text.custom.endpoint
  form.textModelName = settings.text.custom.modelName
  form.textApiKey = ''
  form.visionSource = settings.vision.source
  form.visionEndpoint = settings.vision.custom.endpoint
  form.visionModelName = settings.vision.custom.modelName
  form.visionApiKey = ''
  form.temperature = settings.parameters.temperature
  form.topP = settings.parameters.topP
  form.maxOutputTokens = settings.parameters.maxOutputTokens
}

function buildSavePayload() {
  return {
    text: {
      source: form.textSource,
      custom: {
        endpoint: form.textEndpoint.trim(),
        modelName: form.textModelName.trim(),
      },
    },
    vision: {
      source: form.visionSource,
      custom: {
        endpoint: form.visionEndpoint.trim(),
        modelName: form.visionModelName.trim(),
      },
    },
    parameters: {
      temperature: Number(form.temperature),
      topP: Number(form.topP),
      maxOutputTokens: Number(form.maxOutputTokens),
    },
    textApiKey: form.textApiKey,
    visionApiKey: form.visionApiKey,
  }
}

async function handleSave() {
  saving.value = true

  try {
    await modelSettingsStore.saveSettings(buildSavePayload())
    syncFormFromStore()
    toast.success('模型配置已保存')
  } catch (error) {
    toast.error(error?.message || '保存失败，请重试')
  } finally {
    saving.value = false
  }
}

async function handleTestTextConnection() {
  testingText.value = true

  try {
    const result = await testModelConnection({
      block: 'text',
      endpoint: form.textEndpoint,
      apiKey: form.textApiKey.trim() || undefined,
      modelName: form.textModelName,
    })
    toast.success(result.message)
  } catch (error) {
    toast.error(error?.message || '连接测试失败')
  } finally {
    testingText.value = false
  }
}

async function handleTestVisionConnection() {
  testingVision.value = true

  try {
    const result = await testModelConnection({
      block: 'vision',
      endpoint: form.visionEndpoint,
      apiKey: form.visionApiKey.trim() || undefined,
      modelName: form.visionModelName,
    })
    toast.success(result.message)
  } catch (error) {
    toast.error(error?.message || '连接测试失败')
  } finally {
    testingVision.value = false
  }
}

async function loadGuestQuota() {
  if (!isGuest.value) return

  quotaLoading.value = true
  try {
    guestQuota.value = await fetchGuestFreeQuota()
  } finally {
    quotaLoading.value = false
  }
}

function handleGuestLogin() {
  void login().catch((error) => {
    toast.error(error?.message || '登录失败，请重试')
  })
}

onMounted(async () => {
  if (!modelSettingsStore.hydrated) {
    await modelSettingsStore.initFromLocalStorage()
  }
  syncFormFromStore()
  await loadGuestQuota()
})

watch(isGuest, (guest) => {
  if (guest) {
    void loadGuestQuota()
  }
})

watch(() => modelSettingsStore.data, syncFormFromStore, { deep: true })
</script>

<template>
  <section class="settings-panel model-settings">
    <header class="settings-panel__header">
      <h2 class="settings-panel__title">模型配置</h2>
      <p class="settings-panel__desc">
        {{ isGuest ? '访客模式下可使用 WPX 免费公共大模型。' : '配置文本与图片识别模型来源、参数及连接信息。' }}
      </p>
    </header>

    <section v-if="isGuest" class="settings-card model-settings__guest-card">
      <h3 class="settings-card__title">当前模型</h3>
      <p class="settings-card__desc model-settings__guest-model">{{ GUEST_FREE_MODEL_LABEL }}</p>

      <div class="model-settings__guest-quota">
        <span class="model-settings__guest-quota-label">今日剩余调用次数</span>
        <span class="model-settings__guest-quota-value">
          {{ quotaLoading ? '加载中…' : guestQuotaLabel }}
        </span>
      </div>

      <p class="model-settings__guest-hint">
        登录后可使用自己的大模型 API Key 或购买更多调用次数
      </p>

      <button
        type="button"
        class="settings-btn-primary model-settings__guest-login"
        :disabled="isLoggingIn"
        @click="handleGuestLogin"
      >
        {{ isLoggingIn ? '登录中…' : '登录' }}
      </button>
    </section>

    <template v-else>
    <div v-if="showPrivacyBanner" class="model-settings__privacy" role="note">
      数据将发送到第三方服务器，WPX 不会存储您的 API Key（仅本地加密存储）
    </div>

    <form class="model-settings__form" @submit.prevent="handleSave">
      <section class="settings-card">
        <h3 class="settings-card__title">文本模型</h3>
        <p class="settings-card__desc">用于 AI 对话、续写、改写等文本生成能力。</p>

        <fieldset class="settings-field settings-fieldset">
          <legend class="settings-label">模型来源</legend>
          <div class="radio-group">
            <label class="radio-option">
              <input v-model="form.textSource" type="radio" name="text-source" value="platform" />
              <span>使用 WPX 平台模型（默认）</span>
            </label>
            <label class="radio-option">
              <input v-model="form.textSource" type="radio" name="text-source" value="custom" />
              <span>使用自定义模型</span>
            </label>
          </div>
        </fieldset>

        <div v-if="form.textSource === 'custom'" class="model-settings__custom-fields">
          <div class="settings-field">
            <label class="settings-label" for="text-endpoint">API 地址（Endpoint）</label>
            <input
              id="text-endpoint"
              v-model="form.textEndpoint"
              type="url"
              class="settings-input"
              placeholder="https://api.deepseek.com/v1"
            />
          </div>

          <div class="settings-field">
            <label class="settings-label" for="text-api-key">API Key</label>
            <p v-if="modelSettingsStore.hasStoredTextApiKey" class="settings-hint model-settings__masked-key">
              已保存：{{ modelSettingsStore.maskedTextApiKey }}
            </p>
            <input
              id="text-api-key"
              v-model="form.textApiKey"
              type="password"
              class="settings-input"
              :placeholder="textApiKeyPlaceholder"
              autocomplete="new-password"
            />
          </div>

          <div class="settings-field">
            <label class="settings-label" for="text-model-name">模型名称</label>
            <input
              id="text-model-name"
              v-model="form.textModelName"
              type="text"
              class="settings-input"
              placeholder="deepseek-chat"
            />
          </div>

          <button
            type="button"
            class="settings-btn-secondary"
            :disabled="testingText"
            @click="handleTestTextConnection"
          >
            {{ testingText ? '测试中…' : '测试连接' }}
          </button>
        </div>
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">图片识别模型</h3>
        <p class="settings-card__desc">用于识别图片内容、图表与截图中的文字信息。</p>

        <fieldset class="settings-field settings-fieldset">
          <legend class="settings-label">模型来源</legend>
          <div class="radio-group">
            <label class="radio-option">
              <input v-model="form.visionSource" type="radio" name="vision-source" value="platform" />
              <span>使用 WPX 平台模型（默认）</span>
            </label>
            <label class="radio-option">
              <input v-model="form.visionSource" type="radio" name="vision-source" value="custom" />
              <span>使用自定义模型</span>
            </label>
          </div>
        </fieldset>

        <div v-if="form.visionSource === 'custom'" class="model-settings__custom-fields">
          <div class="settings-field">
            <label class="settings-label" for="vision-endpoint">API 地址（Endpoint）</label>
            <input
              id="vision-endpoint"
              v-model="form.visionEndpoint"
              type="url"
              class="settings-input"
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div class="settings-field">
            <label class="settings-label" for="vision-api-key">API Key</label>
            <p v-if="modelSettingsStore.hasStoredVisionApiKey" class="settings-hint model-settings__masked-key">
              已保存：{{ modelSettingsStore.maskedVisionApiKey }}
            </p>
            <input
              id="vision-api-key"
              v-model="form.visionApiKey"
              type="password"
              class="settings-input"
              :placeholder="visionApiKeyPlaceholder"
              autocomplete="new-password"
            />
          </div>

          <div class="settings-field">
            <label class="settings-label" for="vision-model-name">模型名称</label>
            <input
              id="vision-model-name"
              v-model="form.visionModelName"
              type="text"
              class="settings-input"
              placeholder="gpt-4o"
            />
          </div>

          <button
            type="button"
            class="settings-btn-secondary"
            :disabled="testingVision"
            @click="handleTestVisionConnection"
          >
            {{ testingVision ? '测试中…' : '测试连接' }}
          </button>
        </div>
      </section>

      <section class="settings-card">
        <h3 class="settings-card__title">模型参数</h3>
        <p class="settings-card__desc">影响文本生成的随机性与输出长度。</p>

        <div class="settings-field">
          <label class="settings-label" for="model-temperature">
            Temperature：{{ form.temperature.toFixed(1) }}
          </label>
          <input
            id="model-temperature"
            v-model.number="form.temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            class="model-settings__slider"
          />
        </div>

        <div class="settings-field">
          <label class="settings-label" for="model-top-p">Top P：{{ form.topP.toFixed(2) }}</label>
          <input
            id="model-top-p"
            v-model.number="form.topP"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="model-settings__slider"
          />
        </div>

        <div class="settings-field">
          <label class="settings-label" for="model-max-output">最大输出长度</label>
          <input
            id="model-max-output"
            v-model.number="form.maxOutputTokens"
            type="number"
            min="1"
            max="128000"
            step="1"
            class="settings-input"
          />
        </div>
      </section>

      <div class="model-settings__actions">
        <button type="submit" class="settings-btn-primary" :disabled="saving">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
    </form>
    </template>
  </section>
</template>

<style scoped>
@import './settings-shared.css';

.model-settings {
  max-width: 48rem;
}

.model-settings__privacy {
  margin-bottom: 16px;
  border-radius: var(--theme-radius-sm, 6px);
  background: color-mix(in srgb, #f59e0b 14%, var(--theme-bg-subtle));
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--theme-fg);
}

.model-settings__masked-key {
  margin-bottom: 8px;
  font-family: var(--theme-font-mono);
  letter-spacing: 0.02em;
}

.model-settings__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.model-settings__custom-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 4px;
}

.settings-fieldset {
  margin: 0;
  padding: 0;
  border: none;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radio-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--theme-fg-muted);
  cursor: pointer;
}

.radio-option input {
  accent-color: var(--theme-accent);
}

.model-settings__slider {
  width: 100%;
  accent-color: var(--theme-accent);
}

.model-settings__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.model-settings__guest-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.model-settings__guest-model {
  margin-bottom: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--theme-fg);
}

.model-settings__guest-quota {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-sm, 6px);
  background: var(--theme-bg-subtle);
}

.model-settings__guest-quota-label {
  font-size: 13px;
  color: var(--theme-fg-muted);
}

.model-settings__guest-quota-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-accent);
  font-variant-numeric: tabular-nums;
}

.model-settings__guest-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--theme-fg-muted);
}

.model-settings__guest-login {
  align-self: flex-start;
}
</style>
