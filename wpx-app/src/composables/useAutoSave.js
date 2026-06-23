import { onBeforeUnmount } from 'vue'
import { useAppStore } from '@/stores/app'
import { useGeneralSettingsStore } from '@/stores/generalSettings'
import { scopedStorageKey } from '@/utils/windowContext'

export const EDITOR_DRAFT_STORAGE_KEY = 'wpx-editor-draft'

/**
 * @returns {{ content: string, title?: string, updatedAt?: number } | null}
 */
export function loadEditorDraft() {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(scopedStorageKey(EDITOR_DRAFT_STORAGE_KEY))
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.content) return null

    return parsed
  } catch {
    return null
  }
}

/**
 * 编辑器内容自动保存到 localStorage，并驱动标题栏保存状态指示灯
 * @param {() => { content: string, title?: string }} getPayload
 * @param {{ debounceMs?: number }} [options]
 */
export function useAutoSave(getPayload, options = {}) {
  const appStore = useAppStore()
  const generalSettings = useGeneralSettingsStore()
  let timer = null

  function getDebounceMs() {
    return options.debounceMs ?? generalSettings.autoSaveIntervalMs
  }

  async function flushDraft() {
    const payload = getPayload()
    const content = payload?.content ?? ''

    appStore.setDocumentSaveStatus('saving')

    await new Promise((resolve) => {
      window.setTimeout(resolve, 0)
    })

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          scopedStorageKey(EDITOR_DRAFT_STORAGE_KEY),
          JSON.stringify({
            content,
            title: payload?.title ?? appStore.documentTitle,
            updatedAt: Date.now(),
          }),
        )
      }
      appStore.setDocumentSaveStatus('saved')
    } catch {
      appStore.setDocumentSaveStatus('unsaved')
    }
  }

  function scheduleAutoSave() {
    appStore.markDocumentDirty()

    if (!generalSettings.autoSaveEnabled) {
      if (timer) {
        window.clearTimeout(timer)
        timer = null
      }
      return
    }

    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = null
      flushDraft()
    }, getDebounceMs())
  }

  function cancelAutoSave() {
    if (timer) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  onBeforeUnmount(cancelAutoSave)

  return {
    scheduleAutoSave,
    cancelAutoSave,
    flushDraft,
  }
}
