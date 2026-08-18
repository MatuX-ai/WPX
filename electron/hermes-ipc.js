/**
 * hermes-ipc —— Hermes Gateway 生命周期 IPC（Phase 3 / M3）
 *
 * 通道：
 * - hermes:detect                探测 Python + hermes CLI（写入 store）
 * - hermes:get-status            当前网关进程状态
 * - hermes:start / hermes:stop   启动 / 停止网关
 * - hermes:get-settings / hermes:set-settings  偏好读写（enabled / preStart / gatewayPort）
 * - hermes:call-run              转发标记（实际执行走 /api/hermes/run）
 * - hermes:mark-install-hint-shown
 * 广播：hermes:status-changed / hermes:settings-changed
 *
 * 设计：依赖注入（ipcMain / detector / launcher / store / broadcast），便于单测。
 */
const { ipcMain, BrowserWindow, app } = require('electron')
const path = require('node:path')
const detector = require('./services/hermes-detector')
const launcher = require('./services/hermes-launcher')
const {
  getHermesSettings,
  setHermesSettings,
  recordDetection,
  markInstallHintShown,
  shouldShowInstallHint,
} = require('./services/hermes-store')

const STATUS_BROADCAST_CHANNEL = 'hermes:status-changed'
const SETTINGS_BROADCAST_CHANNEL = 'hermes:settings-changed'

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

async function handleDetect() {
  const result = await detector.detectHermes()
  try { recordDetection(result) } catch (err) {
    console.warn('[hermes-ipc] recordDetection 失败:', err?.message || err)
  }
  return result
}

function handleGetStatus() {
  return launcher.getStatus()
}

async function handleStart() {
  const settings = getHermesSettings()
  // HERMES_HOME 必须指到 WPX userData（实机验证：否则 hermes 写 %LOCALAPPDATA%\hermes）
  const hermesHome = path.join(app.getPath('userData'), 'hermes-home')
  const status = await launcher.startHermesGateway({
    port: settings.gatewayPort,
    hermesHome,
    // M4：真实健康轮询判定 RUNNING（替代存活猜测）
    healthCheck: async ({ port, apiKey }) => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        })
        return res.ok
      } catch {
        return false
      }
    },
  })
  broadcastStatus(status)
  return { ok: status.state === 'RUNNING' || status.state === 'STARTING', status }
}

async function handleStop() {
  const status = await launcher.stopHermesGateway()
  broadcastStatus(status)
  return { ok: true, status }
}

function handleGetSettings() {
  return {
    settings: getHermesSettings(),
    installHintAvailable: shouldShowInstallHint(),
  }
}

function handleSetSettings(_event, payload = {}) {
  const next = setHermesSettings(payload)
  broadcastSettings(next)

  if (next.enabled === false) {
    // 关闭 → 停止网关
    launcher.stopHermesGateway().then((status) => broadcastStatus(status)).catch(() => { /* swallow */ })
  } else if (next.enabled && next.preStart) {
    // 开启预启动 → 尝试启动（失败静默，health 检查兜底）
    const hermesHome = path.join(app.getPath('userData'), 'hermes-home')
    launcher.startHermesGateway({
      port: next.gatewayPort,
      hermesHome,
      healthCheck: async ({ port, apiKey }) => {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/health`, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          })
          return res.ok
        } catch {
          return false
        }
      },
    }).then((status) => {
      broadcastStatus(status)
    }).catch((err) => {
      console.warn('[hermes-ipc] preStart 启动失败:', err?.message || err)
    })
  }
  return next
}

async function handleCallRun(_event, payload = {}) {
  const settings = getHermesSettings()
  if (!settings.enabled) {
    return {
      ok: false,
      fallbackReason: 'hermes_disabled',
      message: 'Hermes Agent 未启用，已回退到云端 AI',
    }
  }
  const status = launcher.getStatus()
  if (status.state !== 'RUNNING') {
    return {
      ok: false,
      fallbackReason: 'hermes_unavailable',
      message: `Hermes 网关暂不可用（${status.state}），已切换至云端 AI`,
      status,
    }
  }
  // 实际执行由前端经 local-server 的 /api/hermes/run 完成
  return {
    ok: true,
    accepted: true,
    sessionId: payload.sessionId || null,
    task: payload.task || null,
    proceed: { method: 'POST', url: '/api/hermes/run' },
  }
}

/**
 * M3-C：把用户解密后的模型 Key 写入 HERMES_HOME/.env（OPENAI_API_KEY / OPENAI_BASE_URL）
 * 供网关启动后读取（实机验证：hermes 从 ~/.hermes/.env 读 provider Key）。
 * 注意：Key 来自渲染进程解密（models:api-key:get-decrypted），仅写入本地 userData，不回显。
 */
async function handlePrepareEnv(_event, payload = {}) {
  const { writeHermesEnvFile } = require('./services/hermes-env')
  const hermesHome = path.join(app.getPath('userData'), 'hermes-home')
  const result = await writeHermesEnvFile(hermesHome, {
    apiKey: payload?.apiKey,
    baseUrl: payload?.baseUrl,
  })
  return result
}

function handleMarkInstallHintShown() {
  return markInstallHintShown()
}

function registerHermesIpcHandlers(deps = {}) {
  const ipc = deps.ipcMain || ipcMain
  if (!ipc || typeof ipc.handle !== 'function') {
    console.warn('[hermes-ipc] ipcMain 不可用，跳过注册')
    return
  }

  ipc.handle('hermes:detect', handleDetect)
  ipc.handle('hermes:get-status', handleGetStatus)
  ipc.handle('hermes:start', handleStart)
  ipc.handle('hermes:stop', handleStop)
  ipc.handle('hermes:get-settings', handleGetSettings)
  ipc.handle('hermes:set-settings', handleSetSettings)
  ipc.handle('hermes:call-run', handleCallRun)
  ipc.handle('hermes:prepare-env', handlePrepareEnv)
  ipc.handle('hermes:mark-install-hint-shown', handleMarkInstallHintShown)
}

/** 供 main.js 初始化：注册 IPC + 预启动 */
async function initHermesIpc(options = {}) {
  const { initHermesStore } = require('./services/hermes-store')
  await initHermesStore()

  if (options.registerIpc !== false) {
    registerHermesIpcHandlers({ ipcMain })
  }

  // 预启动：用户开启 preStart 时静默拉起网关
  const settings = getHermesSettings()
  if (settings.enabled && settings.preStart) {
    const hermesHome = path.join(app.getPath('userData'), 'hermes-home')
    launcher.startHermesGateway({
      port: settings.gatewayPort,
      hermesHome,
      healthCheck: async ({ port, apiKey }) => {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/health`, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          })
          return res.ok
        } catch {
          return false
        }
      },
    }).then((status) => {
      broadcastStatus(status)
    }).catch((err) => {
      console.warn('[hermes-ipc] 预启动失败:', err?.message || err)
    })
  }
  return { ok: true }
}

module.exports = {
  initHermesIpc,
  registerHermesIpcHandlers,
  broadcastStatus,
  broadcastSettings,
  STATUS_BROADCAST_CHANNEL,
  SETTINGS_BROADCAST_CHANNEL,
}
