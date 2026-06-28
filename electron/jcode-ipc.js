const { ipcMain, BrowserWindow } = require('electron')
const {
  initJcodeStore,
  getJcodeSettings,
  setJcodeSettings,
  recordDetection,
  markInstallHintShown,
  shouldShowInstallHint,
} = require('./services/jcode-store')
const detector = require('./services/jcode-detector')
const launcher = require('./services/jcode-launcher')
const { clearAllJcodeMemory, backupJcodeMemory, restoreJcodeMemory, listJcodeBackups } = require('./jcode-memory-bridge')

const STATUS_BROADCAST_CHANNEL = 'jcode:status-changed'
const STREAM_BROADCAST_CHANNEL = 'jcode:stream-event'
const SETTINGS_BROADCAST_CHANNEL = 'jcode:settings-changed'

/**
 * 向所有渲染窗口广播 jcode 状态。
 * 主进程各 IPC handler 触发后调用,保证多窗口状态一致。
 */
function broadcastStatus(status) {
  const payload = status || launcher.getStatus()
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    try { win.webContents.send(STATUS_BROADCAST_CHANNEL, payload) } catch { /* ignore */ }
  }
}

function broadcastSettings(settings) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    try { win.webContents.send(SETTINGS_BROADCAST_CHANNEL, settings) } catch { /* ignore */ }
  }
}

function broadcastStream(event) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    try { win.webContents.send(STREAM_BROADCAST_CHANNEL, event) } catch { /* ignore */ }
  }
}

async function handleDetect() {
  const result = await detector.detectJcode()
  // 写入 store 供后续决策使用
  try { recordDetection(result) } catch (err) {
    console.warn('[jcode-ipc] recordDetection 失败:', err?.message || err)
  }
  return result
}

function handleGetStatus() {
  return launcher.getStatus()
}

async function handleStart() {
  const status = await launcher.startJcode()
  return { ok: status.state === 'RUNNING' || status.state === 'STARTING', status }
}

async function handleStop() {
  const status = await launcher.stopJcode({ reason: 'manual' })
  return { ok: true, status }
}

function handleGetSettings() {
  return {
    settings: getJcodeSettings(),
    installHintAvailable: shouldShowInstallHint(),
  }
}

function handleSetSettings(_event, payload = {}) {
  const next = setJcodeSettings(payload)
  broadcastSettings(next)

  // 启用/禁用/预启动时联动 launcher
  if (next.enabled === false) {
    // 用户关闭 jcode:停止进程
    launcher.stopJcode({ reason: 'user disabled' }).catch(() => { /* swallow */ })
  } else if (next.enabled && next.preStart) {
    // 用户开启预启动:尝试启动
    launcher.startJcode().catch((err) => {
      console.warn('[jcode-ipc] preStart 启动失败:', err?.message || err)
    })
  }

  return next
}

async function handleCallSwarm(_event, payload = {}) {
  const settings = getJcodeSettings()
  if (!settings.enabled) {
    return {
      ok: false,
      fallbackReason: 'jcode_disabled',
      message: 'jcode 未启用,已回退到云端 API',
    }
  }
  // 确保 jcode 正在运行
  const status = await launcher.ensureJcodeRunning()
  if (status.state !== 'RUNNING') {
    return {
      ok: false,
      fallbackReason: 'jcode_unavailable',
      message: `jcode 引擎暂不可用(${status.state}),已切换至云端 AI`,
      status,
    }
  }
  launcher.markActivity()

  // 适配层由 jcode-routes 提供(本 IPC 仅作为转发标记,
  // 实际 HTTP 调用由前端经 /api/jcode/swarm 走 local-server)
  return {
    ok: true,
    accepted: true,
    sessionId: payload.sessionId || null,
    task: payload.task || null,
    // 真正执行由前端继续走 fetch('/api/jcode/swarm', ...)
    proceed: { method: 'POST', url: '/api/jcode/swarm' },
  }
}

async function handleStream(_event, payload = {}) {
  // 透传:把流式事件回写给发起方(简化为一次性 ack,
  // 真正的流在 jcode-routes 中处理)
  const evt = {
    type: 'accepted',
    sessionId: payload.sessionId || null,
    task: payload.task || null,
    at: Date.now(),
  }
  broadcastStream(evt)
  return { ok: true }
}

async function handleClearMemory() {
  const result = await clearAllJcodeMemory()
  return result
}

async function handleBackupMemory() {
  return backupJcodeMemory()
}

async function handleRestoreMemory() {
  return restoreJcodeMemory()
}

async function handleListBackups() {
  return listJcodeBackups()
}

function handleMarkInstallHintShown() {
  return markInstallHintShown()
}

function registerJcodeIpcHandlers() {
  ipcMain.handle('jcode:detect', handleDetect)
  ipcMain.handle('jcode:get-status', handleGetStatus)
  ipcMain.handle('jcode:start', handleStart)
  ipcMain.handle('jcode:stop', handleStop)
  ipcMain.handle('jcode:get-settings', handleGetSettings)
  ipcMain.handle('jcode:set-settings', handleSetSettings)
  ipcMain.handle('jcode:call-swarm', handleCallSwarm)
  ipcMain.handle('jcode:stream', handleStream)
  ipcMain.handle('jcode:clear-memory', handleClearMemory)
  ipcMain.handle('jcode:backup-memory', handleBackupMemory)
  ipcMain.handle('jcode:restore-memory', handleRestoreMemory)
  ipcMain.handle('jcode:list-backups', handleListBackups)
  ipcMain.handle('jcode:mark-install-hint-shown', handleMarkInstallHintShown)
}

function unregisterJcodeIpcHandlers() {
  const channels = [
    'jcode:detect',
    'jcode:get-status',
    'jcode:start',
    'jcode:stop',
    'jcode:get-settings',
    'jcode:set-settings',
    'jcode:call-swarm',
    'jcode:stream',
    'jcode:clear-memory',
    'jcode:backup-memory',
    'jcode:restore-memory',
    'jcode:list-backups',
    'jcode:mark-install-hint-shown',
  ]
  for (const ch of channels) {
    try { ipcMain.removeHandler(ch) } catch { /* ignore */ }
  }
}

async function initJcodeIpc() {
  await initJcodeStore()
  registerJcodeIpcHandlers()

  // 订阅 launcher 状态变化,广播给所有渲染窗口
  launcher.on('status', (status) => {
    broadcastStatus(status)

    // P2: 状态恢复 — 进入休眠时备份记忆，启动后恢复
    if (status.state === 'SLEEPING') {
      backupJcodeMemory().catch((err) => {
        console.warn('[jcode-ipc] 记忆备份失败:', err?.message || err)
      })
    } else if (status.state === 'RUNNING' && status.lastActivityAt) {
      // 如果是从 SLEEPING 唤醒的（有 lastActivityAt），尝试恢复记忆
      restoreJcodeMemory().catch((err) => {
        console.warn('[jcode-ipc] 记忆恢复失败:', err?.message || err)
      })
    }
  })

  // 暴露广播函数供其他模块(jcode-routes)复用
  globalThis.__wpxBroadcastJcodeStatus = broadcastStatus
  globalThis.__wpxBroadcastJcodeStream = broadcastStream

  // 如果用户在设置中启用了预启动,WPX 启动时静默启动 jcode
  try {
    const settings = getJcodeSettings()
    if (settings.enabled && settings.preStart) {
      // 异步触发,不阻塞 IPC 初始化
      launcher.startJcode().catch((err) => {
        console.warn('[jcode-ipc] 预启动失败:', err?.message || err)
      })
    }
  } catch (err) {
    console.warn('[jcode-ipc] 读取预启动设置失败:', err?.message || err)
  }
}

async function shutdownJcodeIpc() {
  // P2: 关闭前备份 jcode 记忆
  try {
    await backupJcodeMemory()
  } catch (err) {
    console.warn('[jcode-ipc] 关闭前记忆备份失败:', err?.message || err)
  }

  unregisterJcodeIpcHandlers()
  await launcher.stopJcode({ reason: 'app shutdown' })
  globalThis.__wpxBroadcastJcodeStatus = undefined
  globalThis.__wpxBroadcastJcodeStream = undefined
}

module.exports = {
  initJcodeIpc,
  shutdownJcodeIpc,
  broadcastStatus,
  broadcastStream,
  broadcastSettings,
  registerJcodeIpcHandlers,
  unregisterJcodeIpcHandlers,
  STATUS_BROADCAST_CHANNEL,
  STREAM_BROADCAST_CHANNEL,
  SETTINGS_BROADCAST_CHANNEL,
}
