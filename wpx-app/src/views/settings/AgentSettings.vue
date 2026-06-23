<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import {
  AGENT_DOMAIN_OPTIONS,
  AGENT_LANGUAGE_OPTIONS,
  AGENT_REPLY_LENGTH_OPTIONS,
  AGENT_TONE_OPTIONS,
  createDefaultAgentSettings,
  mergeAgentSettings,
} from '@/constants/agentPreferences'
import { useToast } from '@/composables/useToast'
import { useUserPreferencesStore } from '@/stores/userPreferences'

const toast = useToast()
const userPreferencesStore = useUserPreferencesStore()

const saving = ref(false)
const form = reactive(createDefaultAgentSettings())

function syncFormFromStore() {
  Object.assign(form, mergeAgentSettings({}, userPreferencesStore.agent))
}

function isDomainSelected(value) {
  return form.domains.includes(value)
}

function toggleDomain(value) {
  if (value === 'all') {
    form.domains = ['all']
    return
  }

  const next = form.domains.filter((item) => item !== 'all')

  if (next.includes(value)) {
    const filtered = next.filter((item) => item !== value)
    form.domains = filtered.length > 0 ? filtered : ['all']
    return
  }

  form.domains = [...next, value]
}

async function handleSave() {
  saving.value = true

  try {
    await userPreferencesStore.saveAgent({
      assistantName: form.assistantName.trim() || createDefaultAgentSettings().assistantName,
      identityDescription:
        form.identityDescription.trim() || createDefaultAgentSettings().identityDescription,
      toneStyle: form.toneStyle,
      customTone: form.customTone.trim(),
      domains: [...form.domains],
      replyLength: form.replyLength,
      languagePreference: form.languagePreference,
    })
    syncFormFromStore()
    toast.info('AI 助手将在下次对话中生效')
  } catch (error) {
    toast.error(error?.message || '保存失败，请重试')
  } finally {
    saving.value = false
  }
}

async function handleReset() {
  saving.value = true

  try {
    await userPreferencesStore.resetAgentToDefaults()
    syncFormFromStore()
    toast.info('AI 助手将在下次对话中生效')
  } catch (error) {
    toast.error(error?.message || '恢复默认失败，请重试')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!userPreferencesStore.hydrated) {
    userPreferencesStore.initFromLocalStorage()
  }
  syncFormFromStore()
})

watch(() => userPreferencesStore.agent, syncFormFromStore, { deep: true })
</script>

<template>
  <section class="settings-panel">
    <header class="settings-panel__header">
      <h2 class="settings-panel__title">Agent 设置</h2>
      <p class="settings-panel__desc">定义 AI 助手的身份、语气与能力范围，配置将注入 System Prompt。</p>
    </header>

    <form class="agent-form" @submit.prevent="handleSave">
      <div class="settings-card">
        <div class="settings-field">
          <label class="settings-label" for="agent-assistant-name">助手名称</label>
          <input
            id="agent-assistant-name"
            v-model="form.assistantName"
            type="text"
            class="settings-input"
            maxlength="32"
            placeholder="WPX 助手"
          />
        </div>

        <div class="settings-field">
          <label class="settings-label" for="agent-identity-description">身份描述</label>
          <textarea
            id="agent-identity-description"
            v-model="form.identityDescription"
            class="settings-input settings-textarea"
            rows="3"
            maxlength="200"
            placeholder="全能的写作伙伴"
          />
        </div>

        <div class="settings-field">
          <label class="settings-label" for="agent-tone-style">语气风格</label>
          <select id="agent-tone-style" v-model="form.toneStyle" class="settings-input">
            <option v-for="option in AGENT_TONE_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div v-if="form.toneStyle === 'custom'" class="settings-field">
          <label class="settings-label" for="agent-custom-tone">自定义语气</label>
          <input
            id="agent-custom-tone"
            v-model="form.customTone"
            type="text"
            class="settings-input"
            maxlength="100"
            placeholder="例如：像资深编辑一样，简洁而有洞见"
          />
        </div>

        <div class="settings-field">
          <span class="settings-label">专业领域</span>
          <div class="domain-tags" role="group" aria-label="专业领域">
            <button
              v-for="option in AGENT_DOMAIN_OPTIONS"
              :key="option.value"
              type="button"
              class="domain-tag"
              :class="{ 'domain-tag--active': isDomainSelected(option.value) }"
              :aria-pressed="isDomainSelected(option.value) ? 'true' : 'false'"
              @click="toggleDomain(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <fieldset class="settings-field settings-fieldset">
          <legend class="settings-label">回复长度偏好</legend>
          <div class="radio-group">
            <label
              v-for="option in AGENT_REPLY_LENGTH_OPTIONS"
              :key="option.value"
              class="radio-option"
            >
              <input v-model="form.replyLength" type="radio" name="reply-length" :value="option.value" />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </fieldset>

        <fieldset class="settings-field settings-fieldset">
          <legend class="settings-label">语言偏好</legend>
          <div class="radio-group">
            <label
              v-for="option in AGENT_LANGUAGE_OPTIONS"
              :key="option.value"
              class="radio-option"
            >
              <input
                v-model="form.languagePreference"
                type="radio"
                name="language-preference"
                :value="option.value"
              />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </fieldset>
      </div>

      <div class="agent-form__actions">
        <button type="submit" class="settings-btn-primary" :disabled="saving">
          {{ saving ? '保存中…' : '保存' }}
        </button>
        <button type="button" class="settings-btn-secondary" :disabled="saving" @click="handleReset">
          恢复默认
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
@import './settings-shared.css';

.agent-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-textarea {
  min-height: 88px;
  resize: vertical;
  line-height: 1.5;
}

.settings-fieldset {
  margin: 0;
  padding: 0;
  border: none;
}

.domain-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.domain-tag {
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: var(--theme-bg);
  padding: 6px 12px;
  font-size: 13px;
  color: var(--theme-fg-muted);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.domain-tag:hover {
  border-color: var(--theme-accent);
  color: var(--theme-fg);
}

.domain-tag--active {
  border-color: var(--theme-accent);
  background: var(--theme-accent-muted);
  color: var(--theme-accent);
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

.agent-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
