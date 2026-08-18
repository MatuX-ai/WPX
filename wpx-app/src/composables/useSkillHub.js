/**
 * useSkillHub —— SKILL.md 技能市场 Composable（Phase 1 / M1）
 *
 * 能力：
 * - 同步技能源（Hermes 官方库等）：拉取 → 转换 → 注册进 useSkillExecutor
 *   （模块级 externalSkills，全局生效）→ 合并进 skills store 的 allSkills
 * - 导出 WPX 内置技能为 SKILL.md（浏览器下载 / 返回文件清单）
 * - 导入单个 SKILL.md 文本
 *
 * 原则：失败透明降级（缓存回退）；同步不阻塞、可重复执行（幂等去重）。
 */
import { computed, ref } from 'vue'
import {
  listSkillSources,
  loadSkillHubFromManifest,
} from '@/skills/skillhub-loader'
import {
  exportAllSkillsToSkillMd,
  skillMdToSkill,
} from '@/skills/skill-manifest'
import { registerExternalSkills } from '@/composables/useSkillExecutor'
import { useSkillsStore } from '@/stores/skills'
import { isElectron, getElectronAPI } from '@/utils/electron'

/** 触发一次浏览器下载（Web 环境；Electron 后续走 IPC 保存对话框） */
function triggerDownload (filename, content, mimeType = 'text/markdown;charset=utf-8') {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useSkillHub () {
  const skillsStore = useSkillsStore()

  // ── State ──
  const sources = ref(listSkillSources())
  const syncingId = ref(null)
  /** @type {import('vue').Ref<Record<string, any> | null>} */
  const lastResult = ref(null)
  /** @type {import('vue').Ref<string | null>} */
  const lastSyncAt = ref(null)

  // ── Getters ──

  /** 已注册进 store 的技能市场技能（供 UI 展示计数） */
  const marketSkillCount = computed(() => skillsStore.marketSkills.length)

  const isSyncing = computed(() => syncingId.value !== null)

  // ── 注册技能（执行器 + store 双写） ──

  function installSkills (skills) {
    if (!Array.isArray(skills) || skills.length === 0) return 0
    registerExternalSkills(skills)
    return skillsStore.mergeExternalSkills(skills)
  }

  // ── Actions ──

  /**
   * 同步指定技能源
   * @param {string} sourceId
   * @returns {Promise<Record<string, any>>} loadSkillHubFromManifest 的结果
   */
  async function sync (sourceId) {
    if (syncingId.value) return lastResult.value || { ok: false, errors: [{ reason: '已有同步进行中' }] }
    syncingId.value = sourceId
    try {
      const result = await loadSkillHubFromManifest(sourceId)
      if (result.ok) {
        const added = installSkills(result.skills)
        lastResult.value = { ...result, installedNew: added }
        lastSyncAt.value = new Date().toISOString()
      } else {
        lastResult.value = result
      }
      return lastResult.value
    } finally {
      syncingId.value = null
    }
  }

  /**
   * 导出内置技能为 SKILL.md 文件
   * @param {{ download?: boolean, ids?: string[] }} [options]
   * @returns {Array<{ id: string, name: string, category: string, subcategory: string, content: string }>}
   */
  function exportSkills (options = {}) {
    const files = exportAllSkillsToSkillMd()
    const { download = true, ids } = options
    const target = ids && ids.length ? files.filter((f) => ids.includes(f.id)) : files
    if (download) {
      for (const file of target) {
        const path = `skills/${file.category}/${file.subcategory}/${file.id}/SKILL.md`
          .replace(/\/\//g, '/')
        triggerDownload(path, file.content)
      }
    }
    return target
  }

  /**
   * 桌面端：通过主进程保存对话框导出 SKILL.md 到磁盘（M1.5 IPC）
   * 单文件→保存对话框；多文件→选择目录。Web 环境不可用。
   * @param {{ ids?: string[] }} [options]
   * @returns {Promise<Record<string, any> | null>} IPC 结果；不可用时返回 null
   */
  async function exportToDisk (options = {}) {
    if (!isElectron()) return null
    const api = getElectronAPI()
    if (!api?.skillhub?.exportSkillFiles) return null
    const files = exportAllSkillsToSkillMd()
    const { ids } = options
    const target = ids && ids.length ? files.filter((f) => ids.includes(f.id)) : files
    const result = await api.skillhub.exportSkillFiles({ files: target })
    lastResult.value = result || null
    return result
  }

  /**
   * 桌面端：打开对话框导入本地 SKILL.md 文件（M1.5 IPC）
   * 读取 → 转换 → 注册进执行器与 store。
   * @returns {Promise<{ ok: boolean, canceled?: boolean, skill?: import('@/data/built-in-skills').TeacherSkillDefinition, errors?: string[] }>}
   */
  async function importSkillFile () {
    if (!isElectron()) {
      return { ok: false, errors: ['仅桌面端支持，请使用文件选择或粘贴文本'] }
    }
    const api = getElectronAPI()
    if (!api?.skillhub?.importSkillFile) {
      return { ok: false, errors: ['skillhub IPC 不可用'] }
    }
    const res = await api.skillhub.importSkillFile()
    if (!res?.ok) {
      lastResult.value = res || null
      return res || { ok: false, errors: ['导入失败'] }
    }
    const result = skillMdToSkill(res.content)
    if (!result.ok) {
      lastResult.value = { ok: false, path: res.path, errors: result.errors.map((reason) => ({ reason })) }
      return { ok: false, errors: result.errors }
    }
    const added = installSkills([result.skill])
    lastResult.value = {
      ok: true,
      path: res.path,
      skills: [result.skill],
      added,
      updated: added === 0 ? 1 : 0,
      failed: 0,
      errors: [],
    }
    return { ok: true, skill: result.skill }
  }

  /**
   * 导入单个 SKILL.md 文本并注册
   * @param {string} text
   * @param {{ path?: string }} [options]
   * @returns {{ ok: boolean, skill?: import('@/data/built-in-skills').TeacherSkillDefinition, errors?: string[] }}
   */
  function importSkillMdText (text, options = {}) {
    const result = skillMdToSkill(text)
    if (!result.ok) {
      lastResult.value = { ok: false, errors: result.errors.map((reason) => ({ reason })) }
      return result
    }
    const added = installSkills([result.skill])
    lastResult.value = {
      ok: true,
      skills: [result.skill],
      added,
      updated: added === 0 ? 1 : 0,
      failed: 0,
      errors: [],
      path: options.path || '',
    }
    return { ok: true, skill: result.skill }
  }

  return {
    // State
    sources,
    syncingId,
    lastResult,
    lastSyncAt,

    // Getters
    marketSkillCount,
    isSyncing,

    // Actions
    sync,
    exportSkills,
    exportToDisk,
    importSkillFile,
    importSkillMdText,
  }
}

export default useSkillHub
