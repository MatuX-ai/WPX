import {
  APP_NAME,
  APP_VERSION,
} from '@/constants/aboutInfo'
import { getElectronAPI, isElectron } from '@/utils/electron'

function getAboutApi() {
  if (!isElectron()) return null
  return getElectronAPI()?.about ?? null
}

/**
 * @returns {Promise<{ name: string, version: string, isPackaged?: boolean }>}
 */
export async function fetchAppInfo() {
  const api = getAboutApi()
  if (api?.getAppInfo) {
    const info = await api.getAppInfo()
    if (info?.version) return info
  }

  return {
    name: APP_NAME,
    version: APP_VERSION,
    isPackaged: false,
  }
}

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   status: 'latest' | 'available' | 'error',
 *   message: string,
 *   version?: string,
 *   remoteVersion?: string | null,
 * }>}
 */
export async function checkForAppUpdates() {
  const api = getAboutApi()
  if (api?.checkForUpdates) {
    return api.checkForUpdates()
  }

  return {
    ok: true,
    status: 'latest',
    version: APP_VERSION,
    message: '当前已是最新版本',
  }
}

export async function readSevenZipLicense() {
  const api = getAboutApi()
  if (api?.read7ZipLicense) {
    return api.read7ZipLicense()
  }
  return { ok: false, error: '请在桌面版中查看 7-Zip 许可证' }
}

export async function openSevenZipLicense() {
  const api = getAboutApi()
  if (api?.open7ZipLicense) {
    return api.open7ZipLicense()
  }
  return { ok: false, error: '请在桌面版中打开许可证文件' }
}

/**
 * @param {string} fontId
 */
export async function openBuiltInFontLicense(fontId) {
  const api = getAboutApi()
  if (api?.openBuiltInFontLicense) {
    return api.openBuiltInFontLicense({ fontId })
  }
  return { ok: false, error: '请在桌面版中查看字体许可证' }
}
