<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useUserHabitsStore } from '@/stores/userHabits'
import { clearKnowledgeIndex } from '@/utils/knowledgeApi'
import { clearMemoryData } from '@/utils/memoryApi'
import { resetGuestDeviceId } from '@/utils/freeQuota'
import { exportSettingsToFile, importSettingsFromFile } from '@/utils/settingsBackup'

const toast = useToast()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { isGuest } = storeToRefs(authStore)
const habitsStore = useUserHabitsStore()

const confirmDialog = ref(null)
const memoryClearing = ref(false)
const cacheClearing = ref(false)
const deviceIdResetting = ref(false)
const exporting = ref(false)
const importing = ref(false)
const importInputRef = ref(null)

function openConfirmDialog(config) {
  confirmDialog.value = config
}

function closeConfirmDialog() {
  if (memoryClearing.value || cacheClearing.value || deviceIdResetting.value) return
  confirmDialog.value = null
}

async function handleConfirmAction() {
  const action = confirmDialog.value?.action
  if (!action) return

  if (action === 'clear-memory') {
    await runClearMemory()
    return
  }

  if (action === 'clear-knowledge') {
    await runClearKnowledgeCache()
    return
  }

  if (action === 'clear-device-id') {
    await runClearDeviceId()
  }
}

function requestClearMemory() {
  openConfirmDialog({
    action: 'clear-memory',
    title: '清除记忆数据？',
    description:
      '将删除本地记录的用户习惯与智能模板推荐。此操作不可恢复，但不会影响已保存的文档与设置。',
    confirmLabel: '确认清除',
    danger: true,
  })
}

function requestClearKnowledgeCache() {
  openConfirmDialog({
    action: 'clear-knowledge',
    title: '清除资料库缓存？',
    description:
      '将清空已上传资料的索引与解析缓存，不会删除您电脑上的原始文件。资料库列表将变为空。',
    confirmLabel: '确认清除',
    danger: true,
  })
}

function requestClearDeviceId() {
  openConfirmDialog({
    action: 'clear-device-id',
    title: '清除设备 ID？',
    description:
      '将重置本机访客设备标识，并清零今日免费 AI 调用次数计数。此操作不会影响已登录账户的数据。',
    confirmLabel: '确认清除',
    danger: true,
  })
}

async function runClearMemory() {
  memoryClearing.value = true

  try {
    const result = await clearMemoryData()
    if (result?.success === false) {
      throw new Error('清除记忆数据失败')
    }

    habitsStore.resetHabits()
    closeConfirmDialog()
    toast.success('记忆数据已清除')
  } catch (error) {
    toast.error(error?.message || '清除记忆数据失败，请重试')
  } finally {
    memoryClearing.value = false
  }
}

async function runClearKnowledgeCache() {
  cacheClearing.value = true

  try {
    const result = await clearKnowledgeIndex()
    if (result?.success === false) {
      throw new Error('清除资料库缓存失败')
    }

    closeConfirmDialog()
    toast.success('资料库缓存已清除')
  } catch (error) {
    toast.error(error?.message || '清除资料库缓存失败，请重试')
  } finally {
    cacheClearing.value = false
  }
}

async function runClearDeviceId() {
  deviceIdResetting.value = true

  try {
    const result = await resetGuestDeviceId()
    if (!result?.ok) {
      throw new Error('清除设备 ID 失败')
    }

    closeConfirmDialog()
    toast.success('设备 ID 已重置，Token 用量计数已清零')
  } catch (error) {
    toast.error(error?.message || '清除设备 ID 失败，请重试')
  } finally {
    deviceIdResetting.value = false
  }
}

async function handleExportSettings() {
  exporting.value = true

  try {
    exportSettingsToFile()
    toast.success('设置已导出')
  } catch (error) {
    toast.error(error?.message || '导出设置失败，请重试')
  } finally {
    exporting.value = false
  }
}

function handleImportClick() {
  importInputRef.value?.click()
}

async function handleImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''

  if (!file) return

  importing.value = true

  try {
    await importSettingsFromFile(file)
    toast.success('设置已导入并生效')
  } catch (error) {
    toast.error(error?.message || '导入设置失败，请检查文件格式')
  } finally {
    importing.value = false
  }
}

function goToModelSettings() {
  router.push({ name: 'settings-models', query: { ...route.query } })
}
</script>

<template>
  <section class="settings-panel">
    <header class="settings-panel__header">
      <h2 class="settings-panel__title">数据与隐私</h2>
      <p class="settings-panel__desc">管理本地数据、导出备份与隐私相关操作。</p>
    </header>

    <ul class="privacy-list">
      <li>
        <strong>清除记忆数据</strong>
        <span>删除用户习惯记录与智能模板推荐，不影响文档与全局设置。</span>
        <div class="privacy-item__actions">
          <button
            type="button"
            class="settings-btn-danger"
            :disabled="memoryClearing"
            @click="requestClearMemory"
          >
            {{ memoryClearing ? '清除中…' : '清除记忆数据' }}
          </button>
        </div>
      </li>

      <li>
        <strong>清除资料库缓存</strong>
        <span>清空已上传资料的索引与解析缓存，不删除您磁盘上的原始文件。</span>
        <div class="privacy-item__actions">
          <button
            type="button"
            class="settings-btn-danger"
            :disabled="cacheClearing"
            @click="requestClearKnowledgeCache"
          >
            {{ cacheClearing ? '清除中…' : '清除资料库缓存' }}
          </button>
        </div>
      </li>

      <li v-if="isGuest">
        <strong>清除设备 ID</strong>
        <span>重置访客设备标识，并清零今日免费 AI 调用次数计数。</span>
        <div class="privacy-item__actions">
          <button
            type="button"
            class="settings-btn-danger"
            :disabled="deviceIdResetting"
            @click="requestClearDeviceId"
          >
            {{ deviceIdResetting ? '处理中…' : '清除设备 ID' }}
          </button>
        </div>
      </li>

      <li>
        <strong>导出所有设置</strong>
        <span>将 Agent、模型、通用设置等导出为 JSON 文件（不含 API Key）。</span>
        <div class="privacy-item__actions">
          <button
            type="button"
            class="settings-btn-secondary"
            :disabled="exporting"
            @click="handleExportSettings"
          >
            {{ exporting ? '导出中…' : '导出所有设置' }}
          </button>
        </div>
      </li>

      <li>
        <strong>导入设置</strong>
        <span>从先前导出的 JSON 文件恢复设置，将覆盖当前配置。</span>
        <div class="privacy-item__actions">
          <input
            ref="importInputRef"
            type="file"
            accept="application/json,.json"
            class="privacy-import-input"
            @change="handleImportFile"
          />
          <button
            type="button"
            class="settings-btn-secondary"
            :disabled="importing"
            @click="handleImportClick"
          >
            {{ importing ? '导入中…' : '选择文件导入' }}
          </button>
        </div>
      </li>

      <li>
        <strong>管理自定义 API Key</strong>
        <span>在「我的模型」页查看、更新或清除已保存的 API Key。</span>
        <div class="privacy-item__actions">
          <button type="button" class="settings-btn-secondary" @click="goToModelSettings">
            前往我的模型
          </button>
        </div>
      </li>
    </ul>

    <p class="privacy-note">
      API Key 等敏感信息不会包含在导出的设置文件中，请单独在模型配置页管理。
    </p>
  </section>

  <Teleport to="body">
    <Transition name="privacy-confirm">
      <div
        v-if="confirmDialog"
        class="privacy-confirm-backdrop"
        @click.self="closeConfirmDialog"
      >
        <div
          class="privacy-confirm"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="confirmDialog.title"
          @click.stop
        >
          <header class="privacy-confirm__header">
            <h3 :id="confirmDialog.title" class="privacy-confirm__title">
              {{ confirmDialog.title }}
            </h3>
            <p class="privacy-confirm__desc">{{ confirmDialog.description }}</p>
          </header>

          <footer class="privacy-confirm__footer">
            <button
              type="button"
              class="settings-btn-secondary"
              :disabled="memoryClearing || cacheClearing || deviceIdResetting"
              @click="closeConfirmDialog"
            >
              取消
            </button>
            <button
              type="button"
              class="settings-btn-danger"
              :disabled="memoryClearing || cacheClearing || deviceIdResetting"
              @click="handleConfirmAction"
            >
              {{
                memoryClearing || cacheClearing || deviceIdResetting
                  ? '处理中…'
                  : confirmDialog.confirmLabel
              }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import './settings-shared.css';

.privacy-item__actions {
  margin-top: 10px;
}

.privacy-import-input {
  display: none;
}

.privacy-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(15 23 42 / 45%);
  padding: 16px;
}

.privacy-confirm {
  width: min(420px, 100%);
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md, 10px);
  background: var(--theme-surface);
  box-shadow: var(--theme-shadow-lg);
  padding: 20px 24px;
}

.privacy-confirm__title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--theme-fg);
}

.privacy-confirm__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--theme-fg-muted);
}

.privacy-confirm__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.privacy-confirm-enter-active,
.privacy-confirm-leave-active {
  transition: opacity 0.15s ease;
}

.privacy-confirm-enter-from,
.privacy-confirm-leave-to {
  opacity: 0;
}
</style>
