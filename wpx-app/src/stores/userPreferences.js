import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createDefaultAgentSettings,
  mergeAgentSettings,
} from '@/constants/agentPreferences'
import {
  DEFAULT_CUSTOM_MARGIN,
  createDefaultPaperSettings,
  mergePaperSettings,
  normalizeCustomMargin,
} from '@/constants/paperPreferences'
import { usePreferencesStore } from '@/stores/preferences'
import { getElectronAPI, isElectron } from '@/utils/electron'

const STORAGE_KEY = 'wpx-user-preferences'

function loadAgentFromLocalStorage() {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed?.agent || typeof parsed.agent !== 'object') return null

    return mergeAgentSettings({}, parsed.agent)
  } catch {
    return null
  }
}

function loadPaperFromLocalStorage() {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed?.paper || typeof parsed.paper !== 'object') return null

    return mergePaperSettings({}, parsed.paper)
  } catch {
    return null
  }
}

function persistAgentToLocalStorage(agent) {
  if (typeof localStorage === 'undefined') return

  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    let parsed = {}
    if (existing) {
      try {
        parsed = JSON.parse(existing) || {}
      } catch {
        parsed = {}
      }
    }
    parsed.agent = agent
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch (error) {
    console.warn('[userPreferences] Failed to persist agent settings:', error)
  }
}

function persistPaperToLocalStorage(paper) {
  if (typeof localStorage === 'undefined') return

  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    let parsed = {}
    if (existing) {
      try {
        parsed = JSON.parse(existing) || {}
      } catch {
        parsed = {}
      }
    }
    parsed.paper = paper
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch (error) {
    console.warn('[userPreferences] Failed to persist paper settings:', error)
  }
}

function cloneCustomMargin(margin) {
  return normalizeCustomMargin(margin)
}

export const useUserPreferencesStore = defineStore('userPreferences', () => {
  const agent = ref(createDefaultAgentSettings())
  const paper = ref(createDefaultPaperSettings())
  const hydrated = ref(false)
  let unsubscribeRemote = null

  function hydrateAgent(partial) {
    if (!partial || typeof partial !== 'object') return

    agent.value = mergeAgentSettings(agent.value, partial)
    hydrated.value = true
  }

  /**
   * 兼容旧签名：传入 agent 数据或 paper 数据，根据字段推断。
   * 同时兼容直接传入 paper partial 的新签名。
   */
  function hydrateFromPreferences(partial) {
    if (!partial || typeof partial !== 'object') return

    if (isAgentPayload(partial)) {
      hydrateAgent(partial)
    }

    if (isPaperPayload(partial)) {
      paper.value = mergePaperSettings(paper.value, partial)
      hydrated.value = true
    }
  }

  function initFromLocalStorage() {
    const storedAgent = loadAgentFromLocalStorage()
    if (storedAgent) {
      agent.value = storedAgent
      hydrated.value = true
    }

    const storedPaper = loadPaperFromLocalStorage()
    if (storedPaper) {
      paper.value = storedPaper
      hydrated.value = true
    }
  }

  async function persistAgent() {
    const payload = mergeAgentSettings({}, agent.value)
    agent.value = payload

    const preferencesStore = usePreferencesStore()
    preferencesStore.applyPreferences({ agent: payload }, { syncLegacy: false })

    if (isElectron()) {
      const api = getElectronAPI()
      if (api?.preferences?.set) {
        await api.preferences.set({ agent: payload })
      }
    } else {
      persistAgentToLocalStorage(payload)
    }

    return payload
  }

  async function persistPaper() {
    const payload = mergePaperSettings({}, paper.value)
    paper.value = payload

    const preferencesStore = usePreferencesStore()
    preferencesStore.applyPreferences({ paper: payload }, { syncLegacy: false })

    if (isElectron()) {
      const api = getElectronAPI()
      if (api?.preferences?.set) {
        await api.preferences.set({ paper: payload })
      }
    } else {
      persistPaperToLocalStorage(payload)
    }

    return payload
  }

  async function saveAgent(partial) {
    agent.value = mergeAgentSettings(agent.value, partial)
    return persistAgent()
  }

  async function resetAgentToDefaults() {
    agent.value = createDefaultAgentSettings()
    return persistAgent()
  }

  async function setPaperSize(paperSize) {
    paper.value.paperSize = paperSize
    return persistPaper()
  }

  async function setPaperMargin(paperMargin) {
    paper.value.paperMargin = paperMargin
    return persistPaper()
  }

  async function setCustomMargin(partial) {
    const next = cloneCustomMargin({ ...paper.value.customMargin, ...(partial || {}) })
    paper.value.customMargin = next
    if (paper.value.paperMargin !== 'custom') {
      paper.value.paperMargin = 'custom'
    }
    return persistPaper()
  }

  async function resetCustomMargin() {
    paper.value.customMargin = { ...DEFAULT_CUSTOM_MARGIN }
    return persistPaper()
  }

  async function setHeaderFooter(headerFooter) {
    paper.value.headerFooter = headerFooter
    return persistPaper()
  }

  async function setFocusMode(focusMode) {
    paper.value.focusMode = Boolean(focusMode)
    return persistPaper()
  }

  async function toggleFocusMode() {
    paper.value.focusMode = !paper.value.focusMode
    return persistPaper()
  }

  async function savePaper(partial) {
    paper.value = mergePaperSettings(paper.value, partial)
    return persistPaper()
  }

  async function resetPaperToDefaults() {
    paper.value = createDefaultPaperSettings()
    return persistPaper()
  }

  /**
   * 订阅主进程广播的偏好变更事件，实现跨窗口同步。
   * 仅在 Electron 环境且尚未订阅时生效。
   * 返回取消订阅的函数，组件卸载时可调用。
   */
  function subscribeRemoteChanges() {
    if (unsubscribeRemote) return unsubscribeRemote
    if (!isElectron()) return null

    const api = getElectronAPI()
    if (typeof api?.preferences?.onChanged !== 'function') return null

    unsubscribeRemote = api.preferences.onChanged((preferences) => {
      if (!preferences || typeof preferences !== 'object') return
      if (preferences.paper && typeof preferences.paper === 'object') {
        paper.value = mergePaperSettings(paper.value, preferences.paper)
        hydrated.value = true
      }
    })

    return unsubscribeRemote
  }

  function disposeRemoteSubscription() {
    if (typeof unsubscribeRemote === 'function') {
      unsubscribeRemote()
    }
    unsubscribeRemote = null
  }

  return {
    agent,
    paper,
    hydrated,
    hydrateFromPreferences,
    hydrateAgent,
    initFromLocalStorage,
    saveAgent,
    resetAgentToDefaults,
    persistAgent,
    savePaper,
    resetPaperToDefaults,
    persistPaper,
    setPaperSize,
    setPaperMargin,
    setCustomMargin,
    resetCustomMargin,
    setHeaderFooter,
    setFocusMode,
    toggleFocusMode,
    subscribeRemoteChanges,
    disposeRemoteSubscription,
  }
})

function isAgentPayload(partial) {
  if (!partial || typeof partial !== 'object') return false
  const agentKeys = [
    'assistantName',
    'identityDescription',
    'toneStyle',
    'customTone',
    'domains',
    'replyLength',
    'languagePreference',
  ]
  return agentKeys.some((key) => key in partial)
}

function isPaperPayload(partial) {
  if (!partial || typeof partial !== 'object') return false
  const paperKeys = ['paperSize', 'paperMargin', 'customMargin', 'headerFooter', 'focusMode']
  return paperKeys.some((key) => key in partial)
}
