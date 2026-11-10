/**
 * file-access.js —— 文件访问授权服务（P0-3 安全修复 2026-11-10）
 *
 * 渲染进程此前可仅凭任意路径通过 file:read/write-document、file:write-binary
 * 获得磁盘读写能力。本模块实现主进程「精确真实路径授权注册表」：
 * 授权仅由真实用户操作签发（系统对话框 / 窗口 docPath），按 WebContents
 * 隔离，读写分离，窗口关闭即撤销；校验时 realpath 解析符号链接后精确比对
 * （Windows 忽略大小写），拒绝相对路径 / UNC / 控制字符，不用前缀匹配。
 * 本模块不 require('electron')，依赖全部注入，便于单测。
 */
'use strict'

const pathMod = require('node:path')
const fspDefault = require('node:fs/promises')

const MAX_PATH_LENGTH = 4096
const ENOENT_LIKE = new Set(['ENOENT'])

function hasControlChars(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 32 || code === 127) return true
  }
  return false
}

const BACKSLASH = 92

/** 是否为 Windows UNC 路径开头（双反斜杠或双正斜杠） */
function startsWithDoubleSeparator(str, platform) {
  if (platform !== 'win32' || str.length < 2) return false
  const a = str.charCodeAt(0)
  const b = str.charCodeAt(1)
  if (a === 47 && b === 47) return true
  return a === BACKSLASH && b === BACKSLASH
}

/**
 * 校验渲染层请求的原始路径字符串。
 * @returns {{ ok: true, absPath: string } | { ok: false, reason: string }}
 */
function validateRequestedPath(rawPath, opts = {}) {
  const platform = opts.platform || process.platform
  if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.length > MAX_PATH_LENGTH) {
    return { ok: false, reason: 'INVALID_PATH' }
  }
  if (hasControlChars(rawPath)) return { ok: false, reason: 'INVALID_PATH' }
  if (!pathMod.isAbsolute(rawPath)) return { ok: false, reason: 'RELATIVE_PATH' }
  if (startsWithDoubleSeparator(rawPath, platform)) return { ok: false, reason: 'UNC_PATH' }
  let abs
  try {
    abs = pathMod.resolve(rawPath)
  } catch {
    return { ok: false, reason: 'INVALID_PATH' }
  }
  return { ok: true, absPath: abs }
}

/** 解析真实路径；文件不存在（写新文件）回退为父目录 realpath + basename */
async function resolveRealPath(fsp, absPath) {
  try {
    return { ok: true, real: await fsp.realpath(absPath) }
  } catch (err) {
    if (!err || !ENOENT_LIKE.has(err.code)) return { ok: false, reason: 'FS_ERROR' }
    const parent = pathMod.dirname(absPath)
    if (parent === absPath) return { ok: false, reason: 'FS_ERROR' }
    try {
      const parentReal = await fsp.realpath(parent)
      return { ok: true, real: pathMod.join(parentReal, pathMod.basename(absPath)) }
    } catch {
      return { ok: false, reason: 'FS_ERROR' }
    }
  }
}

/**
 * 创建文件访问授权服务实例。
 * @param {{ fsp?: typeof import('node:fs/promises'), platform?: string }} [deps]
 */
function createFileAccessService(deps = {}) {
  const fsp = deps.fsp || fspDefault
  const platform = deps.platform || process.platform
  /** @type {Map<number, Map<string, { path: string, read: boolean, write: boolean }>>} */
  const grants = new Map()
  const toComparable = (p) => (platform === 'win32' ? p.toLowerCase() : p)

  async function lookup(senderId, rawPath) {
    const validated = validateRequestedPath(rawPath, { platform })
    if (!validated.ok) return { ok: false, reason: validated.reason }
    const senderEntries = grants.get(senderId)
    if (!senderEntries || senderEntries.size === 0) return { ok: false, reason: 'NOT_AUTHORIZED' }
    const resolved = await resolveRealPath(fsp, validated.absPath)
    if (!resolved.ok) return { ok: false, reason: resolved.reason }
    const entry = senderEntries.get(toComparable(resolved.real))
    if (!entry) return { ok: false, reason: 'NOT_AUTHORIZED' }
    return { ok: true, entry, real: resolved.real }
  }

  return {
    /**
     * 签发授权（rawPath 必须来自主进程可信来源：对话框 / 窗口 docPath）。
     * @param {number} senderId WebContents.id
     * @param {string} rawPath
     * @param {{ read?: boolean, write?: boolean }} modes
     * @returns {Promise<boolean>}
     */
    async grant(senderId, rawPath, { read = false, write = false } = {}) {
      if (typeof senderId !== 'number' || (!read && !write)) return false
      const validated = validateRequestedPath(rawPath, { platform })
      if (!validated.ok) return false
      const resolved = await resolveRealPath(fsp, validated.absPath)
      if (!resolved.ok) return false
      let senderEntries = grants.get(senderId)
      if (!senderEntries) {
        senderEntries = new Map()
        grants.set(senderId, senderEntries)
      }
      const key = toComparable(resolved.real)
      const prev = senderEntries.get(key)
      senderEntries.set(key, {
        path: resolved.real,
        read: Boolean((prev && prev.read) || read),
        write: Boolean((prev && prev.write) || write),
      })
      return true
    },

    /**
     * 校验 senderId 是否持有 rawPath 的指定模式授权。
     * @param {number} senderId
     * @param {string} rawPath
     * @param {'read'|'write'} mode
     * @returns {Promise<boolean>}
     */
    async check(senderId, rawPath, mode) {
      if (mode !== 'read' && mode !== 'write') return false
      const found = await lookup(senderId, rawPath)
      if (!found.ok) return false
      return Boolean(found.entry[mode])
    },

    /** 撤销指定 WebContents 的全部授权（窗口关闭时调用） */
    revoke(senderId) {
      grants.delete(senderId)
    },

    /** 测试/诊断：指定 WebContents 当前授权条数 */
    grantCount(senderId) {
      const entries = grants.get(senderId)
      return entries ? entries.size : 0
    },
  }
}

module.exports = {
  createFileAccessService,
  validateRequestedPath,
  resolveRealPath,
}
