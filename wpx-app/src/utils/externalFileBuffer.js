/**
 * externalFileBuffer.js —— 渲染层入口早期缓冲（A 场景 / .zip 冷启动修复）
 *
 * 背景：
 * 应用未运行时双击关联文件（.md/.wpx/.docx/.xlsx/.pptx/.zip 等），主进程在
 * `did-finish-load` 单次 `send('file:open')` / `send('file:open-archive')`，
 * 而渲染层的监听器要等 `bootstrap()`（2 个 IPC 握手 + 路由就绪）之后的
 * 组件 `onMounted` 才注册 → payload 落在「无人监听」窗口内永久丢失（编辑器空白）。
 *
 * 解法：
 * 在应用入口（`main.js`，`initWindowContext()` 之后、`bootstrap()` 之前）同步 arm，
 * 把早期到达的 payload 暂存在本模块；等 EditorCore / AppLayout 的实时订阅注册完成后
 * 调用 `drain*()` 一次性取空并交给原有消费逻辑。
 *
 * 语义约束（与实时订阅互斥，不得重复投递）：
 * - `arm()` 幂等：模块级只注册一次；
 * - `drain*()` 一次性：取空后标记 drained，此后到达的事件只交给实时订阅，不再进缓冲；
 * - 调用方必须在**注册实时订阅的同一个同步块内**紧接着 drain，
 *   事件循环不会在两者之间插入 IPC 投递，因此同一条 payload 不会既进缓冲又被实时消费；
 * - reload 后模块重新求值、重新 arm，历史已丢失事件不恢复（与修复前行为一致）。
 */

import { getElectronAPI } from '@/utils/electron'

/** @type {Array<object>} 早期到达的 `file:open` payload */
const openBuffer = []
/** @type {Array<object>} 早期到达的 `file:open-archive` payload */
const archiveBuffer = []

let armed = false
let opensDrained = false
let archivesDrained = false
/** @type {Array<() => void>} preload 返回的退订函数（arm 生命周期内不主动退订） */
const unsubscribers = []

/**
 * 同步 arm：在渲染层入口、Vue 挂载之前注册 `file:open` / `file:open-archive` 监听。
 * 非 Electron 环境为空操作（drain 恒返回空数组）。
 * @returns {boolean} 本次调用是否真正完成了 arm
 */
export function armExternalFileBuffer() {
  if (armed) return false
  armed = true

  const api = getElectronAPI()
  if (!api) return false

  // 与 EditorCore.vue / AppLayout.vue 相同的回退链：这些方法名都指向同一 IPC 通道
  // （preload 中 files.onOpenFile / files.onOpenMarkdown / onOpenMarkdownFile 均为
  //  'file:open'），因此只订阅第一个可用者，避免同通道重复缓冲导致重复投递。
  const subscribeOpen =
    api?.files?.onOpenFile ||
    api?.onOpenFile ||
    api?.files?.onOpenMarkdown ||
    api?.onOpenMarkdownFile

  const subscribeArchive = api?.files?.onOpenArchive || api?.onOpenArchive

  if (typeof subscribeOpen === 'function') {
    const unsubscribe = subscribeOpen((payload) => {
      // drain 之后到达的事件交给实时订阅，本模块只做「入口到挂载」这一段的兜底。
      if (opensDrained || payload == null) return
      openBuffer.push(payload)
    })
    if (typeof unsubscribe === 'function') unsubscribers.push(unsubscribe)
  }

  if (typeof subscribeArchive === 'function') {
    const unsubscribe = subscribeArchive((payload) => {
      if (archivesDrained || payload == null) return
      archiveBuffer.push(payload)
    })
    if (typeof unsubscribe === 'function') unsubscribers.push(unsubscribe)
  }

  return true
}

/**
 * 一次性取空 `file:open` 缓冲。
 * 调用后本模块不再收集（实时订阅已就位），再次调用返回空数组。
 * @returns {Array<object>} 按到达顺序排列的 payload
 */
export function drainExternalFileOpens() {
  opensDrained = true
  if (!openBuffer.length) return []
  return openBuffer.splice(0, openBuffer.length)
}

/**
 * 一次性取空 `file:open-archive` 缓冲（语义同上）。
 * @returns {Array<object>}
 */
export function drainExternalFileArchives() {
  archivesDrained = true
  if (!archiveBuffer.length) return []
  return archiveBuffer.splice(0, archiveBuffer.length)
}

/**
 * 当前是否已 arm（调试 / 单测用）。
 * @returns {boolean}
 */
export function isExternalFileBufferArmed() {
  return armed
}
