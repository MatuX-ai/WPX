/**
 * Skills Pinia Store
 *
 * 管理内置 Skills、在线 SkillHub Skills 以及用户的启用/禁用状态。
 * 应用启动时自动加载内置和在线 Skills，在线加载失败静默回退。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { BUILT_IN_SKILLS as CORE_SKILLS } from '@/data/skills'
import { BUILT_IN_SKILLS as EDUCATION_SKILLS } from '@/data/built-in-skills'
import { usePreferencesStore } from '@/stores/preferences'
import { getElectronAPI, isElectron } from '@/utils/electron'

// ── 常量 ──────────────────────────────────────

/** 合并所有内置 Skill（通用 13 + 教师 16 + 大学生 16） */
const LOCAL_BUILT_IN_SKILLS = [...CORE_SKILLS, ...EDUCATION_SKILLS]

// WPX 在线 Skills 中心：https://skillhub.prowpx.com
// 旧版 skillhub.proclaw.cc 已下线
const SKILLHUB_URL = 'https://skillhub.prowpx.com/api/skills'

const DISABLED_STORAGE_KEY = 'wpx-skills-disabled'
const LEGACY_ENABLED_KEY = 'wpx-skills-enabled'

export { DISABLED_STORAGE_KEY as SKILLS_STORAGE_KEY }

/**
 * 旧版兼容：为所有内置 Skill 生成默认启用 map
 * @returns {Record<string, boolean>}
 */
export function createDefaultSkillsEnabledMap () {
  return Object.fromEntries(LOCAL_BUILT_IN_SKILLS.map((skill) => [skill.id, true]))
}

// ── 本地存储工具 ───────────────────────────────

/** @returns {string[]} 从 localStorage 加载已禁用的 Skill ID 列表 */
function loadDisabledFromStorage () {
  if (typeof localStorage === 'undefined') return []

  try {
    // 1. 尝试新格式（string[]）
    const raw = localStorage.getItem(DISABLED_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }

    // 2. 尝试旧格式（Record<id, boolean>）并迁移
    const legacy = localStorage.getItem(LEGACY_ENABLED_KEY)
    if (legacy) {
      const map = JSON.parse(legacy)
      if (map && typeof map === 'object' && !Array.isArray(map)) {
        const disabled = Object.entries(map)
          .filter(([, enabled]) => enabled === false)
          .map(([id]) => id)
        // 写入新格式，删除旧格式
        localStorage.setItem(DISABLED_STORAGE_KEY, JSON.stringify(disabled))
        localStorage.removeItem(LEGACY_ENABLED_KEY)
        return disabled
      }
    }
  } catch { /* ignore */ }

  return []
}

/** @param {string[]} disabled */
function persistDisabledToStorage (disabled) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(DISABLED_STORAGE_KEY, JSON.stringify(disabled))
  } catch (error) {
    console.warn('[skills] Failed to persist disabled state:', error)
  }
}

// ── Store ─────────────────────────────────────

export const useSkillsStore = defineStore('skills', () => {
  // ── State ──
  const builtInSkills = ref([...LOCAL_BUILT_IN_SKILLS])
  const onlineSkills = ref([])
  const userDisabledSkills = ref([])
  const hydrated = ref(false)

  // ── Getters ──

  /** 合并内置 + 在线 Skills，按 ID 去重（内置优先） */
  const allSkills = computed(() => {
    const builtIn = builtInSkills.value
    const online = onlineSkills.value
    const seen = new Set(builtIn.map((s) => s.id))
    return [...builtIn, ...online.filter((s) => !seen.has(s.id))]
  })

  /** 已启用的 Skills（减去 userDisabledSkills） */
  const enabledSkills = computed(() =>
    allSkills.value.filter((s) => !userDisabledSkills.value.includes(s.id)),
  )

  /** 按分类返回启用的 Skills（Getter 函数） */
  function skillsByCategory (category) {
    return enabledSkills.value.filter((s) => s.category === category)
  }

  /** 所有 Skills 附带 enabled 状态（供 Settings 面板使用） */
  const skillsWithState = computed(() =>
    allSkills.value.map((skill) => ({
      ...skill,
      enabled: !userDisabledSkills.value.includes(skill.id),
    })),
  )

  /**
   * 旧格式的 enabledById map 兼容层
   * @type {import('vue').ComputedRef<Record<string, boolean>>}
   */
  const enabledById = computed(() =>
    Object.fromEntries(allSkills.value.map((s) => [s.id, !userDisabledSkills.value.includes(s.id)])),
  )

  // ── Actions ──

  /** 检查某个 Skill 是否启用 */
  function isSkillEnabled (skillId) {
    return !userDisabledSkills.value.includes(skillId)
  }

  /** 切换某个 Skill 的启用/禁用状态 */
  function toggleSkill (skillId) {
    const idx = userDisabledSkills.value.indexOf(skillId)
    if (idx === -1) {
      userDisabledSkills.value = [...userDisabledSkills.value, skillId]
    } else {
      userDisabledSkills.value = [
        ...userDisabledSkills.value.slice(0, idx),
        ...userDisabledSkills.value.slice(idx + 1),
      ]
    }
    persistDisabledState()
  }

  // ── 向后兼容方法 ──

  /**
   * @param {string} skillId
   * @param {boolean} enabled
   */
  function setSkillEnabled (skillId, enabled) {
    const currently = isSkillEnabled(skillId)
    if (Boolean(enabled) === currently) return
    toggleSkill(skillId)
  }

  /** 从 localStorage 初始化禁用状态 */
  function initFromLocalStorage () {
    userDisabledSkills.value = loadDisabledFromStorage()
    hydrated.value = true
  }

  /**
   * 从旧格式 map 应用启用状态
   * @param {Record<string, boolean>} map - { skillId: boolean }
   * @param {{ persist?: boolean }} options
   */
  function applyEnabledMap (map, options = {}) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return

    const disabled = Object.entries(map)
      .filter(([, enabled]) => enabled === false)
      .map(([id]) => id)

    userDisabledSkills.value = disabled
    hydrated.value = true

    const { persist = true } = options
    if (persist) {
      persistDisabledState()
    } else {
      persistDisabledToStorage(disabled)
    }
  }

  // ── 持久化 ──

  async function persistDisabledState () {
    const disabled = userDisabledSkills.value
    persistDisabledToStorage(disabled)

    // 同步到 Preferences Store（旧格式 map）
    const enabledMap = Object.fromEntries(
      allSkills.value.map((s) => [s.id, !disabled.includes(s.id)]),
    )
    const preferencesStore = usePreferencesStore()
    preferencesStore.applyPreferences({ skills: enabledMap }, { syncLegacy: false })

    if (isElectron()) {
      const api = getElectronAPI()
      if (api?.preferences?.set) {
        await api.preferences.set({ skills: enabledMap })
      }
    }
  }

  // ── 在线 Skills ──

  /** 从 skillhub.prowpx.com 拉取在线 Skills，失败时静默回退 */
  async function loadOnlineSkills () {
    try {
      const res = await fetch(SKILLHUB_URL)
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.skills ?? data.data ?? []
      onlineSkills.value = list
    } catch {
      // 静默失败，仅使用内置 Skills
    }
  }

  // ── 初始化 ──

  /** 应用启动时自动加载内置和在线 Skills */
  function init () {
    initFromLocalStorage()
    loadOnlineSkills()
  }

  return {
    // State
    builtInSkills,
    onlineSkills,
    userDisabledSkills,
    hydrated,

    // Getters
    allSkills,
    enabledSkills,
    skillsByCategory,
    skillsWithState,
    enabledById,

    // Actions
    isSkillEnabled,
    toggleSkill,
    setSkillEnabled,
    initFromLocalStorage,
    applyEnabledMap,
    persistDisabledState,
    loadOnlineSkills,
    init,
  }
})

export default useSkillsStore
