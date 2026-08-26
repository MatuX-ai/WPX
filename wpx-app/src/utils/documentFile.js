/**

 * 本地文件保存工具

 *

 * 封装 Electron 主进程 `dialog:show-save-dialog` 与 `file:write-document` 两个

 * IPC 通道，让渲染层只关心业务意图（标题 + 内容），不直接接触 preload bridge 细节。

 *

 * 设计动机：

 * - 之前的 SaveDialog.vue / ExportMenu.vue 都只能把 Markdown 推给 library-server 或浏览器

 *   `downloadBlob`，缺少「调起原生文件保存对话框」的能力，导致桌面端用户希望保存到

 *   本地任意路径时没有正确的入口。

 * - 本工具统一封装 `showSaveDialog → writeDocument` 的两段调用，并做必要

 *   文件名清洗（Windows 非法字符 + 保留名）。

 *

 * 用法：

 *   import { isLocalSaveAvailable, saveMarkdownToLocalFile } from '@/utils/documentFile'

 *

 *   if (isLocalSaveAvailable()) {

 *     const result = await saveMarkdownToLocalFile({ title, content })

 *     if (result.canceled) return

 *     if (result.error) toast.error(result.error)

 *     else toast.success(result.filePath)

 *   }

 */



import { getElectronAPI, isElectron } from '@/utils/electron'



const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\x00-\x1F]/g

const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

const FILENAME_MAX_LENGTH = 120



/** @type {Record<string, Array<{ name: string, extensions: string[] }>>} */

const FORMAT_FILTERS = {

  md: [{ name: 'Markdown', extensions: ['md'] }],

  txt: [{ name: '纯文本', extensions: ['txt'] }],

  docx: [{ name: 'Word', extensions: ['docx'] }],

  pdf: [{ name: 'PDF', extensions: ['pdf'] }],

  html: [{ name: 'HTML', extensions: ['html'] }],

  xlsx: [{ name: 'Excel', extensions: ['xlsx'] }],

  xls: [{ name: 'Excel 97', extensions: ['xls'] }],

  csv: [{ name: 'CSV', extensions: ['csv'] }],

}



/**

 * 清洗标题字符串为可作为 Windows / macOS / Linux 文件名的字符串，并补上扩展名。

 * - 去掉 `\\/:*?"<>|` 与控制字符

 * - Windows 保留名（CON/PRN/AUX/NUL/COM1-9/LPT1-9）前缀补 `_`

 * - 截断到 120 字符

 * - 空值回退为「未命名文档」

 * @param {string} name

 * @param {string} [extension='md']

 */

export function sanitizeFilename(name, extension = 'md') {

  const fallback = '未命名文档'

  const raw = (name || '').toString().trim().replace(INVALID_FILENAME_CHARS, '_').slice(0, FILENAME_MAX_LENGTH)

  let candidate = raw || fallback

  if (RESERVED_NAMES.test(candidate)) candidate = `_${candidate}`

  const ext = String(extension || 'md').replace(/^\./, '') || 'md'

  return `${candidate}.${ext}`

}



/**

 * @param {string} format

 * @returns {Array<{ name: string, extensions: string[] }>}

 */

export function buildSaveFilters(format) {

  return FORMAT_FILTERS[format] || FORMAT_FILTERS.md

}



/**

 * 替换路径中的扩展名（保留目录与文件名主体）。

 * @param {string} filePath

 * @param {string} extension

 */

export function replacePathExtension(filePath, extension) {

  const ext = String(extension || 'md').replace(/^\./, '')

  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))

  const lastDot = filePath.lastIndexOf('.')

  if (lastDot > lastSep) {

    return `${filePath.slice(0, lastDot)}.${ext}`

  }

  return `${filePath}.${ext}`

}



/**

 * 当前运行环境是否暴露了「本地保存 Markdown」所需的两条 IPC。

 * - Web 端：`isElectron()` 为 false，一并返回 false，保持调用方无需写双分支

 * - 旧版 preload：可能缺少 showSaveDialog → false，调用方可降级到「复制内容」等兜底

 */

export function isLocalSaveAvailable() {

  if (!isElectron()) return false

  const api = getElectronAPI()

  return Boolean(

    api?.files?.showSaveDialog

    && api?.files?.writeDocument

    && api?.files?.writeBinary,

  )

}



/**

 * 仅调起原生保存对话框，返回用户选择的路径（不写入、不转换）。

 *

 * @param {{ title?: string, fileTitle?: string, format?: string, defaultPath?: string, filters?: Array<{ name: string, extensions: string[] }> }} params

 * @returns {Promise<{ canceled: boolean, filePath?: string, error?: string }>}

 */

export async function pickLocalSavePath({

  title = '另存为本地文件',

  fileTitle,

  format = 'md',

  defaultPath,

  filters,

} = {}) {

  if (!isLocalSaveAvailable()) {

    return { canceled: true, error: '当前环境不支持保存到本地文件' }

  }



  const api = getElectronAPI()

  const suggestedName = sanitizeFilename(fileTitle, format)

  const initialPath = defaultPath && defaultPath.trim().length > 0

    ? defaultPath

    : suggestedName

  const resolvedFilters = Array.isArray(filters) && filters.length > 0

    ? filters

    : buildSaveFilters(format)



  try {

    const pick = await api.files.showSaveDialog({

      title,

      defaultPath: initialPath,

      filters: resolvedFilters,

    })

    if (!pick || pick.canceled || !pick.filePath) {

      return { canceled: true }

    }

    return { canceled: false, filePath: pick.filePath }

  } catch (err) {

    return { canceled: false, error: err?.message || '打开保存对话框失败' }

  }

}



/**

 * 将文本写入已知路径（不再弹对话框）。

 * @param {{ filePath: string, content: string }} params

 */

export async function saveTextToLocalPath({ filePath, content } = {}) {

  if (!isLocalSaveAvailable()) {

    return { ok: false, error: '当前环境不支持保存到本地文件' }

  }

  const api = getElectronAPI()

  try {

    const write = await api.files.writeDocument(filePath, content ?? '')

    if (!write || write.ok !== true) {

      return { ok: false, error: write?.error || '写入失败' }

    }

    return { ok: true, filePath }

  } catch (err) {

    return { ok: false, error: err?.message || '写入失败' }

  }

}



/**

 * 将二进制内容写入已知路径。

 * @param {string} filePath

 * @param {ArrayBuffer | Uint8Array} data

 */

export async function writeBinaryToLocalFile(filePath, data) {

  if (!isLocalSaveAvailable()) {

    return { ok: false, error: '当前环境不支持保存到本地文件' }

  }

  const api = getElectronAPI()

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)

  let binary = ''

  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {

    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))

  }

  const base64 = btoa(binary)



  try {

    const write = await api.files.writeBinary(filePath, base64)

    if (!write || write.ok !== true) {

      return { ok: false, error: write?.error || '写入失败' }

    }

    return { ok: true, filePath }

  } catch (err) {

    return { ok: false, error: err?.message || '写入失败' }

  }

}



/**

 * 调起原生对话框并把 Markdown / 文本内容写入用户选择的路径。

 *

 * @param {{ title: string, content: string, defaultPath?: string, extension?: string, filters?: Array<{ name: string, extensions: string[] }> }} params

 * @returns {Promise<{ canceled: boolean, filePath?: string, error?: string }>}

 *   - 取消：`{ canceled: true }`

 *   - 成功：`{ canceled: false, filePath: '/.../xxx.md' }`

 *   - 失败：`{ canceled: false, error: '<错误文案>' }`

 */

export async function saveMarkdownToLocalFile({

  title,

  content,

  defaultPath,

  extension = 'md',

  filters,

} = {}) {

  const pick = await pickLocalSavePath({

    title: '保存到本地文件',

    fileTitle: title,

    format: extension,

    defaultPath,

    filters,

  })

  if (pick.canceled) {
    return pick.error ? { canceled: true, error: pick.error } : { canceled: true }
  }

  if (pick.error) return { canceled: false, error: pick.error }



  const write = await saveTextToLocalPath({ filePath: pick.filePath, content })

  if (!write.ok) return { canceled: false, error: write.error }

  return { canceled: false, filePath: pick.filePath }

}

