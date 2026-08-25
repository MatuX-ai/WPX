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

/**
 * 清洗标题字符串为可作为 Windows / macOS / Linux 文件名的字符串，并补上 `.md` 后缀。
 * - 去掉 `\\/:*?"<>|` 与控制字符
 * - Windows 保留名（CON/PRN/AUX/NUL/COM1-9/LPT1-9）前缀补 `_`
 * - 截断到 120 字符
 * - 空值回退为「未命名文档」
 */
function sanitizeFilename(name) {
  const fallback = '未命名文档'
  const raw = (name || '').toString().trim().replace(INVALID_FILENAME_CHARS, '_').slice(0, FILENAME_MAX_LENGTH)
  let candidate = raw || fallback
  if (RESERVED_NAMES.test(candidate)) candidate = `_${candidate}`
  return `${candidate}.md`
}

/**
 * 当前运行环境是否暴露了「本地保存 Markdown」所需的两条 IPC。
 * - Web 端：`isElectron()` 为 false，一并返回 false，保持调用方无需写双分支
 * - 旧版 preload：可能缺少 showSaveDialog → false，调用方可降级到「复制内容」等兜底
 */
export function isLocalSaveAvailable() {
  if (!isElectron()) return false
  const api = getElectronAPI()
  return Boolean(api?.files?.showSaveDialog && api?.files?.writeDocument)
}

/**
 * 调起原生对话框并把 Markdown 内容写入用户选择的路径。
 *
 * @param {{ title: string, content: string, defaultPath?: string, filters?: Array<{ name: string, extensions: string[] }> }} params
 * @returns {Promise<{ canceled: boolean, filePath?: string, error?: string }>}
 *   - 取消：`{ canceled: true }`
 *   - 成功：`{ canceled: false, filePath: '/.../xxx.md' }`
 *   - 失败：`{ canceled: false, error: '<错误文案>' }`
 */
export async function saveMarkdownToLocalFile({
  title,
  content,
  defaultPath,
  filters,
} = {}) {
  if (!isLocalSaveAvailable()) {
    return { canceled: true, error: '当前环境不支持保存到本地文件' }
  }

  const api = getElectronAPI()
  const suggestedName = sanitizeFilename(title)
  const initialPath = defaultPath && defaultPath.trim().length > 0
    ? defaultPath
    : suggestedName
  const resolvedFilters = Array.isArray(filters) && filters.length > 0
    ? filters
    : [
        { name: 'Markdown', extensions: ['md'] },
        { name: '纯文本', extensions: ['txt'] },
      ]

  let pick
  try {
    pick = await api.files.showSaveDialog({
      title: '保存到本地文件',
      defaultPath: initialPath,
      filters: resolvedFilters,
    })
  } catch (err) {
    return { canceled: false, error: err?.message || '打开保存对话框失败' }
  }

  if (!pick || pick.canceled || !pick.filePath) {
    return { canceled: true }
  }

  try {
    const write = await api.files.writeDocument(pick.filePath, content ?? '')
    if (!write || write.ok !== true) {
      return { canceled: false, error: write?.error || '写入失败' }
    }
    return { canceled: false, filePath: pick.filePath }
  } catch (err) {
    return { canceled: false, error: err?.message || '写入失败' }
  }
}
