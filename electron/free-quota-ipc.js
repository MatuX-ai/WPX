const { ipcMain } = require('electron')
const {
  initFreeQuotaStore,
  getQuotaStatus,
  consumeQuota,
  resetGuestDeviceId,
} = require('./services/free-quota-store')

function registerFreeQuotaIpcHandlers() {
  ipcMain.handle('free-quota:get-status', (_event, payload = {}) => getQuotaStatus(payload))

  ipcMain.handle('free-quota:consume', (_event, payload = {}) => consumeQuota(payload))

  ipcMain.handle('free-quota:reset-device-id', () => resetGuestDeviceId())
}

async function initFreeQuotaIpc() {
  await initFreeQuotaStore()
  registerFreeQuotaIpcHandlers()
}

module.exports = {
  initFreeQuotaIpc,
}
