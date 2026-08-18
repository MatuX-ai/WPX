/**
 * SkillHub 加载器（Phase 1 / M1）
 *
 * 职责：
 * - 定义预置技能源（Hermes Agent 官方技能库等）
 * - 从 GitHub 仓库递归拉取 skills/**\/SKILL.md 并转换为 WPX 技能
 * - localStorage 缓存（离线回退：上次成功快照）
 * - 统计 added / updated / failed，供 UI 展示
 *
 * 设计原则：
 * - 所有 fetch 可注入（fetchImpl），便于单元测试 mock
 * - 失败透明降级：网络不可用时使用缓存，无缓存才报错
 * - 轻量实现：仅用 fetch，不引入 GitHub SDK
 */
import { skillMdDirectoryToSkills } from './skill-manifest'

// ── 常量 ──────────────────────────────────────

const CACHE_KEY_PREFIX = 'wpx-skillhub-cache-'
const CACHE_VERSION = 1

/** 单次同步最多拉取的文件数（防超大仓库拖垮） */
export const DEFAULT_MAX_FILES = 150
/** 拉取原始文件的并发上限 */
export const DEFAULT_CONCURRENCY = 6
/** 请求超时（毫秒） */
const DEFAULT_TIMEOUT_MS = 15_000

// ── 预置技能源 ────────────────────────────────

/**
 * @typedef {Object} SkillSource
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {'github'} kind
 * @property {string} ref  GitHub owner/repo
 * @property {string} branch
 * @property {string} path  匹配模式（当前实现固定匹配 skills/**\/SKILL.md）
 * @property {string} license
 * @property {string} homepage
 * @property {boolean} enabled
 */

/** @type {SkillSource[]} */
export const HERMES_SKILL_SOURCES = [
  {
    id: 'hermes-official',
    name: 'Hermes Agent 官方技能库',
    description: 'Nous Research Hermes Agent 内置技能（SKILL.md 标准），Apache-2.0 可商用',
    kind: 'github',
    ref: 'NousResearch/hermes-agent',
    branch: 'main',
    path: 'skills/**/SKILL.md',
    license: 'Apache-2.0',
    homepage: 'https://github.com/NousResearch/hermes-agent',
    enabled: true,
  },
]

/**
 * 返回技能源列表（预置 + 用户自建，后续 M1.5 可扩展本地自定义源）
 * @returns {SkillSource[]}
 */
export function listSkillSources () {
  return HERMES_SKILL_SOURCES.map((s) => ({ ...s }))
}

// ── localStorage 缓存 ─────────────────────────

function cacheKey (sourceId) {
  return `${CACHE_KEY_PREFIX}${sourceId}`
}

/**
 * 读取缓存快照
 * @param {string} sourceId
 * @returns {{ fetchedAt: string, ids: string[], files: Array<{ path: string, content: string }> } | null}
 */
export function readSkillHubCache (sourceId) {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(cacheKey(sourceId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== CACHE_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 写入缓存快照
 * @param {string} sourceId
 * @param {string} sourceRef
 * @param {Array<{ path: string, content: string }>} files
 * @param {string[]} ids
 */
export function writeSkillHubCache (sourceId, sourceRef, files, ids) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      cacheKey(sourceId),
      JSON.stringify({
        version: CACHE_VERSION,
        sourceRef,
        fetchedAt: new Date().toISOString(),
        ids,
        files,
      }),
    )
  } catch (error) {
    // 配额超限等 —— 缓存失败不影响主流程
    console.warn('[skillhub-loader] 缓存写入失败:', error?.message || error)
  }
}

// ── GitHub 拉取 ───────────────────────────────

/**
 * 拉取 GitHub 仓库文件树并筛选 SKILL.md 路径
 * @param {SkillSource} source
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, maxFiles?: number }} [options]
 * @returns {Promise<Array<{ path: string }>>}
 */
export async function fetchGitHubSkillTree (source, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS
  const maxFiles = options.maxFiles || DEFAULT_MAX_FILES

  const url = `https://api.github.com/repos/${source.ref}/git/trees/${source.branch}?recursive=1`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'wpx-skillhub' },
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`GitHub API HTTP ${res.status}`)
    }
    const data = await res.json()
    const tree = Array.isArray(data.tree) ? data.tree : []
    return tree
      .filter((item) => item.type === 'blob' && /(^|\/)skills\/.*\/SKILL\.md$/.test(item.path))
      .slice(0, maxFiles)
      .map((item) => ({ path: item.path }))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 按路径拉取 raw 文件内容（带并发上限）
 * @param {SkillSource} source
 * @param {Array<{ path: string }>} tree
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, concurrency?: number }} [options]
 * @returns {Promise<{ files: Array<{ path: string, content: string }>, errors: Array<{ path: string, reason: string }> }>}
 */
export async function fetchSkillMdFiles (source, tree, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS
  const concurrency = options.concurrency || DEFAULT_CONCURRENCY

  const files = []
  const errors = []
  let cursor = 0

  async function worker () {
    while (cursor < tree.length) {
      const index = cursor
      cursor += 1
      const item = tree[index]
      const url = `https://raw.githubusercontent.com/${source.ref}/${source.branch}/${item.path}`
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
          const res = await fetchImpl(url, { signal: controller.signal })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const content = await res.text()
          files.push({ path: item.path, content })
        } finally {
          clearTimeout(timer)
        }
      } catch (err) {
        errors.push({
          path: item.path,
          reason: err?.name === 'AbortError' ? 'timeout' : err?.message || String(err),
        })
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, tree.length)) }, () => worker())
  await Promise.all(workers)
  return { files, errors }
}

// ── 主入口 ────────────────────────────────────

/**
 * 同步技能源：拉取 → 转换 → 缓存 → 返回统计
 *
 * 成功路径：{ ok: true, skills, added, updated, failed, errors, fromCache: false }
 * 缓存回退：{ ok: true, skills, added, updated, failed, errors, fromCache: true }
 * 彻底失败：{ ok: false, errors }
 *
 * @param {SkillSource | string} source 技能源对象或其 id
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, maxFiles?: number, concurrency?: number }} [options]
 * @returns {Promise<import('./skillhub-loader').SyncResult>}
 */
export async function loadSkillHubFromManifest (source, options = {}) {
  const src = typeof source === 'string'
    ? listSkillSources().find((s) => s.id === source)
    : source
  if (!src) {
    return { ok: false, errors: [{ reason: `技能源不存在: ${String(source)}` }] }
  }

  const previousCache = readSkillHubCache(src.id)

  try {
    const tree = await fetchGitHubSkillTree(src, options)
    const { files, errors: fetchErrors } = await fetchSkillMdFiles(src, tree, options)
    if (files.length === 0 && fetchErrors.length > 0) {
      throw new Error(`拉取失败（${fetchErrors.length} 个文件出错）`)
    }

    const { skills, errors: convertErrors } = skillMdDirectoryToSkills(files)
    const ids = skills.map((s) => s.id)
    writeSkillHubCache(src.id, src.ref, files, ids)

    const prevIds = new Set(previousCache?.ids || [])
    const added = skills.filter((s) => !prevIds.has(s.id)).length
    const updated = skills.filter((s) => prevIds.has(s.id)).length

    return {
      ok: true,
      sourceId: src.id,
      skills,
      added,
      updated,
      failed: files.length - skills.length,
      errors: [
        ...fetchErrors.map((e) => ({ path: e.path, reason: e.reason })),
        ...convertErrors.map((e) => ({ path: e.path, reason: e.errors.join('; ') })),
      ],
      fromCache: false,
    }
  } catch (error) {
    // 网络失败 → 尝试缓存回退
    if (previousCache && previousCache.files.length > 0) {
      const { skills, errors: convertErrors } = skillMdDirectoryToSkills(previousCache.files)
      return {
        ok: true,
        sourceId: src.id,
        skills,
        added: 0,
        updated: skills.length,
        failed: 0,
        errors: [
          { path: '(缓存)', reason: `网络不可用，已使用上次缓存快照（${previousCache.fetchedAt}）：${error?.message || error}` },
          ...convertErrors.map((e) => ({ path: e.path, reason: e.errors.join('; ') })),
        ],
        fromCache: true,
      }
    }
    return {
      ok: false,
      sourceId: src.id,
      skills: [],
      added: 0,
      updated: 0,
      failed: 0,
      errors: [{ reason: error?.message || String(error) }],
    }
  }
}

export default {
  HERMES_SKILL_SOURCES,
  listSkillSources,
  readSkillHubCache,
  writeSkillHubCache,
  fetchGitHubSkillTree,
  fetchSkillMdFiles,
  loadSkillHubFromManifest,
}
