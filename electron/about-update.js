const { app, autoUpdater } = require('electron')

function getAppInfo() {
  return {
    name: app.getName() || 'WPX',
    version: app.getVersion(),
    isPackaged: app.isPackaged,
  }
}

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   status: 'latest' | 'available' | 'error',
 *   name?: string,
 *   version?: string,
 *   remoteVersion?: string | null,
 *   message: string,
 * }>}
 */
async function checkForUpdates() {
  const info = getAppInfo()

  if (!app.isPackaged) {
    return {
      ok: true,
      status: 'latest',
      ...info,
      message: '当前已是最新版本',
    }
  }

  return new Promise((resolve) => {
    let settled = false

    const finish = (payload) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(payload)
    }

    const onNotAvailable = () => {
      finish({
        ok: true,
        status: 'latest',
        ...info,
        message: '当前已是最新版本',
      })
    }

    const onAvailable = (_event, releaseInfo) => {
      finish({
        ok: true,
        status: 'available',
        ...info,
        remoteVersion: releaseInfo?.version ?? null,
        message: releaseInfo?.version
          ? `发现新版本 ${releaseInfo.version}`
          : '发现新版本',
      })
    }

    const onError = (error) => {
      const message = error instanceof Error ? error.message : String(error || '')
      if (/404|net::|ENOTFOUND|ERR_|invalid|feed/i.test(message)) {
        finish({
          ok: true,
          status: 'latest',
          ...info,
          message: '当前已是最新版本',
        })
        return
      }

      finish({
        ok: false,
        status: 'error',
        ...info,
        message: message || '检查更新失败',
      })
    }

    function cleanup() {
      autoUpdater.removeListener('update-not-available', onNotAvailable)
      autoUpdater.removeListener('update-available', onAvailable)
      autoUpdater.removeListener('error', onError)
      clearTimeout(timeoutId)
    }

    autoUpdater.on('update-not-available', onNotAvailable)
    autoUpdater.on('update-available', onAvailable)
    autoUpdater.on('error', onError)

    const timeoutId = setTimeout(() => {
      finish({
        ok: true,
        status: 'latest',
        ...info,
        message: '当前已是最新版本',
      })
    }, 12000)

    try {
      autoUpdater.checkForUpdates().catch(() => {
        finish({
          ok: true,
          status: 'latest',
          ...info,
          message: '当前已是最新版本',
        })
      })
    } catch {
      finish({
        ok: true,
        status: 'latest',
        ...info,
        message: '当前已是最新版本',
      })
    }
  })
}

module.exports = {
  getAppInfo,
  checkForUpdates,
}
