const { ipcMain } = require('electron')
const {
  initFreeQuotaStore,
  getQuotaStatus,
  checkQuotaAvailable,
  consumeQuotaTokens,
  resetGuestDeviceId,
} = require('./services/free-quota-store')

function registerFreeQuotaIpcHandlers() {
  ipcMain.handle('free-quota:get-status', (_event, payload = {}) => getQuotaStatus(payload))

  ipcMain.handle('free-quota:check', (_event, payload = {}) => checkQuotaAvailable(payload))

  ipcMain.handle('free-quota:consume-tokens', (_event, payload = {}) => consumeQuotaTokens(payload))

  ipcMain.handle('free-quota:reset-device-id', () => resetGuestDeviceId())
}

async function initFreeQuotaIpc() {
  await initFreeQuotaStore()
  registerFreeQuotaIpcHandlers()
}

module.exports = {
  initFreeQuotaIpc,
}
