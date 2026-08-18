<script setup>
/**
 * HermesSettings —— Hermes Agent 本地网关设置面板（Phase 3 / M3-C）
 *
 * - 探测状态徽章（Python + hermes CLI）+ 网关进程状态
 * - 启用 / 预启动开关 + 端口
 * - 模型 Key 注入（写入 HERMES_HOME/.env）
 * - 安装引导提示
 */
import { computed, onMounted, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { useHermesSettingsStore } from '@/stores/hermesSettings'
import { useModelSettingsStore } from '@/stores/modelSettings'
import { isElectron } from '@/utils/electron'

const toast = useToast()
const hermesStore = useHermesSettingsStore()
const modelSettingsStore = useModelSettingsStore()

const refreshing = ref(false)
const starting = ref(false)
const stopping = ref(false)
const injecting = ref(false)
const injectResult = ref('')

const summaryLabel = computed(() => {
  switch (hermesStore.summary) {
    case 'running': return '运行中'
    case 'starting': return '启动中…'
    case 'failed': return '启动失败'
    case 'stopped': return '已停止'
    case 'missing_python': return '未检测到 Python'
    case 'python_too_old': return 'Python 版本过低'
    case 'missing_hermes': return '未安装 hermes'
    default: return '未知'
  }
})

const summaryTone = computed(() => {
  switch (hermesStore.summary) {
    case 'running': return 'ok'
    case 'starting': return 'info'
    case 'failed': return 'error'
    default: return 'muted'
  }
})

const installHint = computed(() => {
  if (!isElectron()) {
    return 'Hermes Agent 本地引擎仅在桌面端可用（Web 版不支持）。'
  }
  if (hermesStore.runtime.state === 'missing_python') {
    return '未检测到 Python（需要 ≥3.11）。请先安装 Python 3.11+，再安装 Hermes。'
  }
  if (hermesStore.runtime.state === 'python_too_old') {
    return `Python ${hermesStore.runtime.pythonVersion || '?'} 版本过低，需要 ≥3.11。`
  }
  if (hermesStore.runtime.state === 'missing_hermes') {
    return '已检测到 Python，但未安装 hermes-agent。可执行：pip install hermes-agent'
  }
  return `已就绪：Python ${hermesStore.runtime.pythonVersion || '?'} + Hermes ${hermesStore.runtime.hermesVersion || '?'}。`
})

async function handleRefresh() {
  refreshing.value = true
  try {
    await hermesStore.hydrate()
    toast.info('状态已刷新')
  } catch (error) {
    toast.error(error?.message || '刷新失败')
  } finally {
    refreshing.value = false
  }
}

async function handleToggleEnabled(value) {
  const result = await hermesStore.updateSettings({ enabled: Boolean(value) })
  if (result.ok) {
    toast.success(Boolean(value) ? 'Hermes 已启用' : 'Hermes 已停用')
  } else {
    toast.error(result.error || '保存失败')
  }
}

async function handleTogglePreStart(value) {
  const result = await hermesStore.updateSettings({ preStart: Boolean(value) })
  if (result.ok) {
    toast.success(Boolean(value) ? '下次启动时预启动 Hermes 网关' : '已取消预启动')
  } else {
    toast.error(result.error || '保存失败')
  }
}

async function handleToggleAutoRoute(value) {
  const result = await hermesStore.updateSettings({ autoRoute: Boolean(value) })
  if (result.ok) {
    toast.success(Boolean(value) ? '复杂任务将自动路由到 Hermes' : '已关闭自动路由')
  } else {
    toast.error(result.error || '保存失败')
  }
}

async function handlePortChange(event) {
  const port = Number(event.target.value)
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    toast.error('端口无效（1-65535）')
    return
  }
  const result = await hermesStore.updateSettings({ gatewayPort: port })
  if (result.ok) {
    toast.success(`网关端口已设为 ${port}`)
  } else {
    toast.error(result.error || '保存失败')
  }
}

async function handleStart() {
  starting.value = true
  try {
    // M4：启动前自动注入「我的模型」当前 Key（若有），避免网关无 provider 拒绝 chat
    if (modelSettingsStore.effectiveTextConfig?.source === 'custom' || modelSettingsStore.hasStoredTextApiKey) {
      const apiKey = await modelSettingsStore.resolveTextApiKey()
      if (apiKey) {
        await hermesStore.prepareEnv({
          apiKey,
          baseUrl: modelSettingsStore.effectiveTextConfig?.baseUrl || undefined,
        })
      }
    }
    const result = await hermesStore.start()
    if (result.ok) {
      toast.success('Hermes 网关已启动')
      await hermesStore.hydrate()
    } else {
      toast.error(result.error || '启动失败')
    }
  } finally {
    starting.value = false
  }
}

async function handleStop() {
  stopping.value = true
  try {
    const result = await hermesStore.stop()
    if (result.ok) {
      toast.success('Hermes 网关已停止')
      await hermesStore.hydrate()
    } else {
      toast.error(result.error || '停止失败')
    }
  } finally {
    stopping.value = false
  }
}

/** 把「我的模型」当前生效的 Key 注入 HERMES_HOME/.env */
async function handleInjectKey() {
  injecting.value = true
  injectResult.value = ''
  try {
    const config = modelSettingsStore.effectiveTextConfig
    const apiKey = await modelSettingsStore.resolveTextApiKey()
    if (!apiKey) {
      injectResult.value = '当前模型未配置 API Key，请先到「我的模型」添加。'
      return
    }
    const result = await hermesStore.prepareEnv({
      apiKey,
      baseUrl: config.baseUrl || undefined,
    })
    if (result?.ok) {
      injectResult.value = `已写入 ${result.path}（${(result.keys || []).join(', ') || '无 Key'}）`
      toast.success('模型 Key 已注入 Hermes 网关')
    } else {
      injectResult.value = `写入失败：${result?.error || '未知错误'}`
    }
  } catch (error) {
    injectResult.value = `注入失败：${error?.message || String(error)}`
  } finally {
    injecting.value = false
  }
}

onMounted(() => {
  hermesStore.hydrate()
  hermesStore.subscribeStatus()
})
</script>

<template>
  <section class="settings-panel hermes-settings">
    <header class="settings-panel__header">
      <h2 class="settings-panel__title">Hermes Agent</h2>
      <p class="settings-panel__desc">
        本地可选 AI 引擎（开放式自主任务）。默认不启用；启用后复杂任务可路由到本地网关，失败自动回退云端。
      </p>
    </header>

    <!-- 状态栏 -->
    <div class="hermes-settings__status-bar">
      <span class="hermes-settings__badge" :class="`hermes-settings__badge--${summaryTone}`">
        {{ summaryLabel }}
      </span>
      <span v-if="hermesStore.runtime.pythonVersion" class="hermes-settings__version">
        Python {{ hermesStore.runtime.pythonVersion }}<template v-if="hermesStore.runtime.hermesVersion"> · Hermes {{ hermesStore.runtime.hermesVersion }}</template>
      </span>
      <span v-if="hermesStore.runtime.port" class="hermes-settings__version">:{{ hermesStore.runtime.port }}</span>
      <span v-if="hermesStore.runtime.lastError" class="hermes-settings__error" role="alert">
        {{ hermesStore.runtime.lastError }}
      </span>
      <button
        type="button"
        class="settings-btn-secondary hermes-settings__refresh"
        :disabled="refreshing"
        @click="handleRefresh"
      >{{ refreshing ? '刷新中…' : '刷新' }}</button>
    </div>

    <div v-if="!isElectron()" class="hermes-settings__notice">
      {{ installHint }}
    </div>
    <div v-else-if="hermesStore.summary === 'missing_python' || hermesStore.summary === 'python_too_old' || hermesStore.summary === 'missing_hermes'" class="hermes-settings__install-hint">
      {{ installHint }}
    </div>

    <form v-else class="hermes-settings__form" @submit.prevent>
      <label class="hermes-settings__switch">
        <input
          type="checkbox"
          :checked="hermesStore.enabled"
          @change="handleToggleEnabled($event.target.checked)"
        />
        <span>启用 Hermes Agent</span>
      </label>

      <label class="hermes-settings__switch">
        <input
          type="checkbox"
          :checked="hermesStore.settings.preStart === true"
          :disabled="!hermesStore.enabled"
          @change="handleTogglePreStart($event.target.checked)"
        />
        <span>应用启动时预启动网关</span>
      </label>

      <label class="hermes-settings__switch">
        <input
          type="checkbox"
          :checked="hermesStore.settings.autoRoute === true"
          :disabled="!hermesStore.enabled"
          @change="handleToggleAutoRoute($event.target.checked)"
        />
        <span>自动路由复杂任务到 Hermes（对话中输入"用 Hermes…"始终生效）</span>
      </label>

      <div class="hermes-settings__row">
        <label class="hermes-settings__field" for="hermes-port">
          <span>网关端口</span>
          <input
            id="hermes-port"
            type="number"
            min="1"
            max="65535"
            :value="hermesStore.settings.gatewayPort"
            :disabled="!hermesStore.enabled"
            @change="handlePortChange"
          />
        </label>
      </div>

      <div class="hermes-settings__actions">
        <button
          v-if="hermesStore.running"
          type="button"
          class="settings-btn-secondary"
          :disabled="stopping"
          @click="handleStop"
        >{{ stopping ? '停止中…' : '停止网关' }}</button>
        <button
          v-else
          type="button"
          class="settings-btn-secondary"
          :disabled="starting"
          @click="handleStart"
        >{{ starting ? '启动中…' : '启动网关' }}</button>

        <button
          type="button"
          class="settings-btn-secondary"
          :disabled="injecting || !hermesStore.enabled"
          @click="handleInjectKey"
        >{{ injecting ? '写入中…' : '注入模型 Key' }}</button>
      </div>

      <p v-if="injectResult" class="hermes-settings__inject-result">{{ injectResult }}</p>

      <aside class="hermes-settings__note" role="note">
        模型 Key 注入：将「我的模型」当前生效的 API Key 写入本地 <code>HERMES_HOME/.env</code>（仅本机 userData，不上传）。
        网关未配置模型时，对话会提示 "No inference provider configured"。
      </aside>
    </form>
  </section>
</template>

<style scoped>
@import './settings-shared.css';

.hermes-settings {
  max-width: 42rem;
}

.hermes-settings__status-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.hermes-settings__badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}

.hermes-settings__badge--ok { background: #dcfce7; color: #15803d; }
.hermes-settings__badge--info { background: #e0f2fe; color: #0369a1; }
.hermes-settings__badge--error { background: #fee2e2; color: #b91c1c; }
.hermes-settings__badge--muted { background: var(--theme-border); color: var(--theme-fg-muted); }

.hermes-settings__version {
  font-size: 12px;
  color: var(--theme-fg-muted);
}

.hermes-settings__error {
  font-size: 12px;
  color: #b91c1c;
}

.hermes-settings__refresh {
  margin-left: auto;
}

.hermes-settings__notice,
.hermes-settings__install-hint {
  border: 1px dashed var(--theme-border);
  border-radius: var(--theme-radius-md, 10px);
  padding: 14px 16px;
  font-size: 13px;
  color: var(--theme-fg-muted);
  line-height: 1.6;
  margin-bottom: 16px;
}

.hermes-settings__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hermes-settings__switch {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--theme-fg);
  cursor: pointer;
}

.hermes-settings__switch input {
  accent-color: var(--theme-accent);
  width: 16px;
  height: 16px;
}

.hermes-settings__row {
  display: flex;
  gap: 16px;
}

.hermes-settings__field {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--theme-fg-muted);
}

.hermes-settings__field input {
  width: 110px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-sm, 6px);
  background: var(--theme-bg);
  color: var(--theme-fg);
  padding: 6px 10px;
  font-size: 13px;
}

.hermes-settings__actions {
  display: flex;
  gap: 10px;
}

.hermes-settings__inject-result {
  margin: 0;
  font-size: 12px;
  color: var(--theme-fg-muted);
  word-break: break-all;
}

.hermes-settings__note {
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md, 10px);
  background: var(--theme-surface);
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--theme-fg-muted);
}

.hermes-settings__note code {
  font-family: var(--theme-font-mono, ui-monospace, monospace);
  background: var(--theme-bg);
  padding: 1px 4px;
  border-radius: 4px;
}
</style>
