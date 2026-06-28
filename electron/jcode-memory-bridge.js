const { app } = require('electron')
const path = require('node:path')
const fsp = require('node:fs/promises')
const fs = require('node:fs')

/**
 * jcode 记忆桥接器：
 * - 复用 WPX memory-service 的 clearMemoryData
 * - 额外删除 userData/jcode/memory 下的所有文件(jcode 本地语义记忆)
 * - P2: 语义记忆持久化 — save/restore/backup
 *
 * 注意：jcode 引擎自身可能正在运行(且被设为 enabled),
 * 这里只清理"持久化记忆文件",不停 jcode 进程。
 * 调用方如需停止进程,应先调 jcode-launcher.stopJcode。
 */

function getJcodeMemoryDir() {
  return path.join(app.getPath('userData'), 'jcode', 'memory')
}

function getJcodeBackupDir() {
  return path.join(app.getPath('userData'), 'jcode', 'memory-backups')
}

async function removeDirContents(dir) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(dir, entry.name)
        try {
          if (entry.isDirectory()) {
            await fsp.rm(target, { recursive: true, force: true })
          } else {
            await fsp.unlink(target)
          }
        } catch (err) {
          // 单个文件失败不应阻塞整次清理
          console.warn(`[jcode-memory-bridge] 删除 ${target} 失败:`, err?.message || err)
        }
      }),
    )
    return { ok: true, removed: entries.length, dir }
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { ok: true, removed: 0, dir, note: '记忆目录不存在,无需清理' }
    }
    return { ok: false, dir, error: err?.message || String(err) }
  }
}

/**
 * 清理 jcode 引擎 + WPX memory-service 的全部记忆数据。
 * @param {{ skipWpxMemory?: boolean }} [options]
 */
async function clearAllJcodeMemory(options = {}) {
  const jcodeDirResult = await removeDirContents(getJcodeMemoryDir())

  let wpxMemoryResult = null
  if (!options.skipWpxMemory) {
    try {
      const { clearMemoryData } = require('./memory-service')
      if (typeof clearMemoryData === 'function') {
        wpxMemoryResult = await clearMemoryData()
      }
    } catch (err) {
      wpxMemoryResult = { success: false, error: err?.message || String(err) }
    }
  }

  return {
    ok: jcodeDirResult.ok,
    jcode: jcodeDirResult,
    wpxMemory: wpxMemoryResult,
    clearedAt: Date.now(),
  }
}

/**
 * 仅清理 jcode 引擎本身的本地记忆(不动 WPX memory-service)。
 * 用于"我想保留 WPX 的习惯记录,但丢弃 jcode 的语义记忆"的场景。
 */
async function clearJcodeEngineMemory() {
  const result = await removeDirContents(getJcodeMemoryDir())
  return {
    ok: result.ok,
    removed: result.removed,
    dir: result.dir,
    clearedAt: Date.now(),
  }
}

// =========================
// P2: 语义记忆持久化
// =========================

/**
 * 导出 jcode 记忆到备份文件
 * 在 jcode 进入休眠或应用关闭前调用
 */
async function backupJcodeMemory() {
  const srcDir = getJcodeMemoryDir()
  if (!fs.existsSync(srcDir)) {
    return { ok: true, backedUp: 0, note: '源目录不存在，无记忆需备份' }
  }

  const backupDir = getJcodeBackupDir()
  await fsp.mkdir(backupDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const destDir = path.join(backupDir, `backup-${timestamp}`)

  await copyDirRecursive(srcDir, destDir)

  // 保留最近 5 份备份
  const backups = await fsp.readdir(backupDir)
  const dirs = backups
    .filter((name) => name.startsWith('backup-'))
    .sort()
  while (dirs.length > 5) {
    const oldest = dirs.shift()
    await fsp.rm(path.join(backupDir, oldest), { recursive: true, force: true })
  }

  return { ok: true, backedUp: true, destDir, timestamp }
}

async function copyDirRecursive(src, dest) {
  await fsp.mkdir(dest, { recursive: true })
  const entries = await fsp.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath)
    } else {
      await fsp.copyFile(srcPath, destPath)
    }
  }
}

/**
 * 从最新备份恢复 jcode 记忆
 * 在 jcode 重新启动后调用
 */
async function restoreJcodeMemory() {
  const backupDir = getJcodeBackupDir()
  if (!fs.existsSync(backupDir)) {
    return { ok: false, reason: '没有可用的备份' }
  }

  const backups = (await fsp.readdir(backupDir))
    .filter((name) => name.startsWith('backup-'))
    .sort()
    .reverse() // 最新的在前

  if (backups.length === 0) {
    return { ok: false, reason: '没有可用的备份' }
  }

  const latest = path.join(backupDir, backups[0])
  const targetDir = getJcodeMemoryDir()

  // 清空当前记忆目录
  await fsp.rm(targetDir, { recursive: true, force: true })
  await fsp.mkdir(targetDir, { recursive: true })

  // 复制备份到目标
  await copyDirRecursive(latest, targetDir)

  return {
    ok: true,
    restored: true,
    fromBackup: backups[0],
    restoredAt: Date.now(),
  }
}

/**
 * 列出可用的记忆备份
 */
async function listJcodeBackups() {
  const backupDir = getJcodeBackupDir()
  if (!fs.existsSync(backupDir)) {
    return { backups: [] }
  }

  const entries = await fsp.readdir(backupDir, { withFileTypes: true })
  const backups = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('backup-')) continue
    const fullPath = path.join(backupDir, entry.name)
    const stat = await fsp.stat(fullPath)
    // 计算备份大小
    let size = 0
    try {
      const files = await fsp.readdir(fullPath)
      for (const f of files) {
        try {
          const s = await fsp.stat(path.join(fullPath, f))
          size += s.size
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    backups.push({
      name: entry.name,
      createdAt: stat.birthtimeMs || stat.ctimeMs,
      size,
    })
  }
  return { backups: backups.sort((a, b) => b.createdAt - a.createdAt) }
}

module.exports = {
  clearAllJcodeMemory,
  clearJcodeEngineMemory,
  getJcodeMemoryDir,
  backupJcodeMemory,
  restoreJcodeMemory,
  listJcodeBackups,
}
