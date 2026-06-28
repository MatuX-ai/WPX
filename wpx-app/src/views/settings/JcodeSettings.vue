<script setup>
/**
 * JcodeSettings - jcode 高性能 AI 引擎设置面板
 *
 * 设计要点（参照需求文档 §4.1）：
 * - 状态徽章 + 启用开关 + 复杂任务路由开关 + 预启动开关
 * - 安装/检查更新/卸载按钮（卸载：Windows winget, macOS brew, Linux 手动）
 * - 风险提示 banner
 * - 与 jcodeSettingsStore 联动，所有写操作走 store.updateSettings
 */
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useToast } from '@/composables/useToast'
import { useJcodeSettingsStore } from '@/stores/jcodeSettings'
import { isElectron } from '@/utils/electron'
import { getElectronAPI } from '@/utils/electron'

const toast = useToast()
const jcodeStore = useJcodeSettingsStore()
const { settings, runtime, available, installed, state, summary } = storeToRefs(jcodeStore)

const refreshing = ref(false)
const starting = ref(false)
const stopping = ref(false)
const clearing = ref(false)

const summaryLabel = computed(() => {
  switch (summary.value) {
    case 'not_installed': return '未安装'
    case 'running': return '运行中'
    case 'starting': return '启动中…'
    case 'sleeping': return '空闲休眠'
    case 'failed': return '启动失败'
    case 'stopped': return '未运行'
    default: return '不可用'
  }
})

const summaryTone = computed(() => {
  switch (summary.value) {
    case 'running': return 'ok'
    case 'starting': return 'info'
    case 'sleeping': return 'warn'
    case 'failed': return 'error'
    case 'stopped': return 'muted'
    case 'not_installed': return 'muted'
    default: return 'muted'
  }
})

const canOperate = computed(() => isElectron() && available.value && installed.value)
const canEnable = computed(() => isElectron() && available.value)

const installHint = computed(() => {
  if (!isElectron()) {
    return '当前是 Web 端，jcode 引擎仅在桌面端可用。'
  }
  if (runtime.value.installed) {
    return runtime.value.meetsRequirement
      ? `已安装 v${runtime.value.version || '?'}，路径：${runtime.value.path || '未知'}`
      : `已安装 v${runtime.value.version || '?'}，但版本过低（需要 ≥0.9.0）`
  }
  return '未检测到本地 jcode 安装。可点击下方"安装 jcode"按钮访问官网，按平台指引完成安装。'
})

async function handleRefresh() {
  refreshing.value = true
  try {
    await jcodeStore.hydrate()
    toast.info('状态已刷新')
  } catch (error) {
    toast.error(error?.message || '刷新失败')
  } finally {
    refreshing.value = false
  }
}

async function handleToggleEnabled(value) {
  if (!canEnable.value) {
    if (!installed.value) {
      toast.error('请先安装 jcode 引擎')
    }
    return
  }
  const result = await jcodeStore.updateSettings({ enabled: Boolean(value) })
  if (result?.ok) {
    toast.success(Boolean(value) ? 'jcode 已启用' : 'jcode 已停用')
  } else {
    toast.error(result?.error || '保存失败')
  }
}

async function handleToggleComplex(value) {
  const result = await jcodeStore.updateSettings({ useForComplexTasks: Boolean(value) })
  if (result?.ok) {
    toast.success(Boolean(value) ? '已开启复杂任务路由' : '已关闭复杂任务路由')
  } else {
    toast.error(result?.error || '保存失败')
  }
}

async function handleTogglePreStart(value) {
  const result = await jcodeStore.updateSettings({ preStart: Boolean(value) })
  if (result?.ok) {
    toast.success(Boolean(value) ? '下次启动时预启动 jcode' : '已取消预启动')
  } else {
    toast.error(result?.error || '保存失败')
  }
}

async function handleStart() {
  if (!canOperate.value) return
  starting.value = true
  try {
    const result = await jcodeStore.startEngine()
    if (result.ok) {
      toast.success('jcode 已启动')
      await jcodeStore.hydrate()
    } else {
      toast.error(result.error || '启动失败')
    }
  } finally {
    starting.value = false
  }
}

async function handleStop() {
  if (!canOperate.value) return
  stopping.value = true
  try {
    const result = await jcodeStore.stopEngine()
    if (result.ok) {
      toast.success('jcode 已停止')
      await jcodeStore.hydrate()
    } else {
      toast.error(result.error || '停止失败')
    }
  } finally {
    stopping.value = false
  }
}

async function handleClearMemory() {
  if (!canOperate.value) return
  clearing.value = true
  try {
    const result = await jcodeStore.clearMemory()
    if (result.ok) {
      toast.success('jcode 记忆已清理')
    } else {
      toast.error(result.error || '清理失败')
    }
  } finally {
    clearing.value = false
  }
}

async function handleInstall() {
  if (runtime.value.installed) {
    // 已经装好了：触发一次 detect 即可
    await handleRefresh()
    return
  }
  // 打开官网（通过 IPC 或 window.open）
  const api = getElectronAPI()
  const url = 'https://jcode.dev/install'
  if (api?.about?.checkForUpdates) {
    // Electron 环境：优先用 shell.openExternal 走 IPC，避免新窗口
    if (api.shell?.openExternal) {
      await api.shell.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  await jcodeStore.markInstallHintShown()
  toast.info('已打开 jcode 官网，请按指引完成安装。安装后点击"刷新"重新检测。')
}

async function handleUninstall() {
  if (!runtime.value.installed) {
    toast.info('未安装 jcode，无需卸载')
    return
  }
  const platform = (getElectronAPI()?.platform) || 'darwin'
  let cmd = ''
  let hint = ''
  if (platform === 'win32') {
    cmd = 'winget uninstall jcode.jcode'
    hint = '请在 PowerShell / CMD 中执行：'
  } else if (platform === 'darwin') {
    cmd = 'brew uninstall jcode'
    hint = '请在终端执行（需已安装 Homebrew）：'
  } else {
    cmd = '请参考 jcode 官方文档手动卸载'
    hint = 'Linux 平台：'
  }
  toast.info(`${hint} ${cmd}`, { duration: 6000 })
}

onMounted(async () => {
  if (!jcodeStore.hydrated) {
    await jcodeStore.hydrate()
  }
})
</script>

<template>
  <section class="settings-panel jcode-settings">
    <header class="settings-panel__header">
      <h2 class="settings-panel__title">AI 引擎（jcode）</h2>
      <p class="settings-panel__desc">
        可选：启用 jcode 本地高性能 AI 引擎以处理复杂任务（PPT、论文、教案、文献综述、资料库分析等）。
        简单任务（润色、改写、翻译）继续走云端 API，引擎不可用时自动降级，对用户透明。
      </p>
    </header>

    <!-- 状态徽章 -->
    <div class="jcode-settings__status-bar">
      <span :class="['jcode-badge', `jcode-badge--${summaryTone}`]">
        <span class="jcode-badge__dot" aria-hidden="true" />
        {{ summaryLabel }}
      </span>
      <span v-if="runtime?.version" class="jcode-settings__version">v{{ runtime.version }}</span>
      <span v-if="runtime?.lastError" class="jcode-settings__error" role="alert">
        错误：{{ runtime.lastError }}
      </span>
      <button
        type="button"
        class="settings-btn-secondary jcode-settings__refresh"
        :disabled="refreshing"
        @click="handleRefresh"
      >
        {{ refreshing ? '刷新中…' : '刷新状态' }}
      </button>
    </div>

    <div v-if="!isElectron()" class="jcode-settings__notice">
      Web 端仅能查看 jcode 设置面板；启停、调用均依赖桌面端 IPC。请打开 WPX 桌面版以使用 jcode 引擎。
    </div>

    <div v-else-if="!runtime?.installed" class="jcode-settings__install-hint">
      <p class="settings-hint">{{ installHint }}</p>
      <button type="button" class="settings-btn-primary" @click="handleInstall">
        安装 jcode
      </button>
    </div>

    <form v-else class="jcode-settings__form" @submit.prevent>
      <!-- 主开关 -->
      <section class="settings-card">
        <div class="settings-field">
          <label class="settings-switch" for="jcode-enabled">
            <input
              id="jcode-enabled"
              type="checkbox"
              :checked="settings?.enabled === true"
              :disabled="!canEnable"
              @change="handleToggleEnabled($event.target.checked)"
            />
            <span class="settings-switch__slider" aria-hidden="true" />
            <span class="settings-switch__text">启用 jcode 引擎</span>
          </label>
          <p class="settings-hint">
            关闭后，AI 调度中心将永远走云端 API；打开后，复杂任务自动路由到 jcode，失败时降级。
          </p>
        </div>
      </section>

      <!-- 复杂任务路由 -->
      <section class="settings-card">
        <div class="settings-field">
          <label class="settings-switch" for="jcode-complex">
            <input
              id="jcode-complex"
              type="checkbox"
              :checked="settings?.useForComplexTasks !== false"
              :disabled="!canEnable"
              @change="handleToggleComplex($event.target.checked)"
            />
            <span class="settings-switch__slider" aria-hidden="true" />
            <span class="settings-switch__text">复杂任务自动路由</span>
          </label>
          <p class="settings-hint">
            命中关键词（PPT / 论文 / 教案 / 文献综述 / 资料库分析 / 多章节等）或多步骤指令时走 jcode。
            简单任务（润色、改写、翻译、字体 / 颜色调整）继续走云端。
          </p>
        </div>
      </section>

      <!-- 预启动 -->
      <section class="settings-card">
        <div class="settings-field">
          <label class="settings-switch" for="jcode-prestart">
            <input
              id="jcode-prestart"
              type="checkbox"
              :checked="settings?.preStart === true"
              :disabled="!canEnable"
              @change="handleTogglePreStart($event.target.checked)"
            />
            <span class="settings-switch__slider" aria-hidden="true" />
            <span class="settings-switch__text">启动 WPX 时预启动 jcode</span>
          </label>
          <p class="settings-hint">
            关闭后，jcode 引擎仅在需要时启动，并空闲 5 分钟后自动休眠。预启动可获得更快响应。
          </p>
        </div>
      </section>

      <!-- 手动启停 -->
      <section class="settings-card">
        <h3 class="settings-card__title">手动控制</h3>
        <p class="settings-card__desc">
          当前状态：<code class="settings-code">{{ state }}</code>
          <span v-if="runtime?.pid"> · PID {{ runtime.pid }}</span>
          <span v-if="runtime?.port"> · 端口 {{ runtime.port }}</span>
        </p>
        <div class="jcode-settings__actions">
          <button
            type="button"
            class="settings-btn-primary"
            :disabled="!canOperate || starting || state === 'running' || state === 'starting'"
            @click="handleStart"
          >
            {{ starting ? '启动中…' : '立即启动' }}
          </button>
          <button
            type="button"
            class="settings-btn-secondary"
            :disabled="!canOperate || stopping || (state !== 'running' && state !== 'sleeping' && state !== 'starting')"
            @click="handleStop"
          >
            {{ stopping ? '停止中…' : '停止 jcode' }}
          </button>
          <button
            type="button"
            class="settings-btn-danger"
            :disabled="!canOperate || clearing"
            @click="handleClearMemory"
          >
            {{ clearing ? '清理中…' : '清理 jcode 记忆' }}
          </button>
        </div>
      </section>

      <!-- 卸载 -->
      <section class="settings-card jcode-settings__uninstall-card">
        <h3 class="settings-card__title">卸载 jcode</h3>
        <p class="settings-card__desc">
          卸载会删除 jcode 可执行文件及其配置。WPX 会自动检测缺失并降级到云端 AI，不会中断当前使用。
        </p>
        <div class="jcode-settings__actions">
          <button
            type="button"
            class="settings-btn-danger"
            :disabled="!canOperate"
            @click="handleUninstall"
          >
            卸载 jcode
          </button>
        </div>
      </section>
    </form>

    <aside class="jcode-settings__risk" role="note">
      <strong>风险提示：</strong>
      jcode 是社区维护的本地可执行文件，可能消耗较多 CPU/内存。WPX 不会上传 jcode 的内部数据，
      但其处理结果可能进入云端 API 回退路径，请仅在受信任的环境中使用。
    </aside>
  </section>
</template>

<style scoped>
@import './settings-shared.css';

.jcode-settings {
  max-width: 48rem;
}

.jcode-settings__status-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-sm, 6px);
  background: var(--theme-bg-subtle);
  padding: 10px 14px;
}

.jcode-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 9999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
}

.jcode-badge__dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.jcode-badge--ok { background: color-mix(in srgb, #16a34a 14%, transparent); color: #16a34a; }
.jcode-badge--info { background: color-mix(in srgb, #3b82f6 14%, transparent); color: #3b82f6; }
.jcode-badge--warn { background: color-mix(in srgb, #f59e0b 14%, transparent); color: #b45309; }
.jcode-badge--error { background: color-mix(in srgb, #ef4444 14%, transparent); color: #b91c1c; }
.jcode-badge--muted { background: var(--theme-bg-muted); color: var(--theme-fg-muted); }

.jcode-settings__version {
  font-size: 12px;
  color: var(--theme-fg-subtle);
}

.jcode-settings__error {
  font-size: 12px;
  color: #b91c1c;
}

.jcode-settings__refresh {
  margin-left: auto;
}

.jcode-settings__notice,
.jcode-settings__install-hint {
  margin-bottom: 16px;
  border-radius: var(--theme-radius-sm, 6px);
  background: color-mix(in srgb, var(--theme-accent) 8%, var(--theme-bg-subtle));
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--theme-fg);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.jcode-settings__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.jcode-settings__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.jcode-settings__risk {
  margin-top: 20px;
  border-radius: var(--theme-radius-sm, 6px);
  background: color-mix(in srgb, #f59e0b 12%, var(--theme-bg-subtle));
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--theme-fg-muted);
}

.jcode-settings__uninstall-card {
  border-color: color-mix(in srgb, #ef4444 35%, var(--theme-border));
}

.settings-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.settings-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.settings-switch__slider {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: var(--theme-border);
  transition: background 0.15s;
}

.settings-switch__slider::after {
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

.settings-switch input:checked + .settings-switch__slider {
  background: var(--theme-accent);
}

.settings-switch input:checked + .settings-switch__slider::after {
  transform: translateX(18px);
}

.settings-switch input:disabled + .settings-switch__slider {
  opacity: 0.5;
}

.settings-switch__text {
  font-size: 13px;
  font-weight: 500;
  color: var(--theme-fg);
}
</style>
