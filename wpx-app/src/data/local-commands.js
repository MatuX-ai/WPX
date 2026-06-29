/**
 * WPX AI 本地指令数据定义
 *
 * 定义 64 个本地指令的结构化元数据：
 * - id        唯一标识
 * - category  分类
 * - patterns  匹配正则数组（任一命中即触发）
 * - priority  优先级（数字越大越优先匹配；同组内部亦按此排序）
 * - condition 条件检查函数：返回 true 表示满足前置条件
 * - action    执行动作：返回 { ok, message, data? }，由 useLocalCommands 包装为 CommandResult
 * - successMessage 条件满足并成功执行时使用的提示（允许函数动态生成）
 * - failureMessage 命中但条件不满足时的提示（允许函数动态生成）
 *
 * 匹配顺序：useLocalCommands 内部按 priority 倒序遍历；同 priority 内按数组顺序。
 *
 * 所有 action/condition 接收统一的 context 对象：
 *   { editor, hasSelection, hasCursor, clipboardText, isDark, focusMode,
 *     documentContent, isDocumentDirty, router, themeStore, userPreferencesStore,
 *     appStore, openSettings, openFontMarket, openLibrary, openKnowledgePanel,
 *     exportPdf, exportDocx, exportMd, saveDocument, newDocument, requestNewDocument,
 *     insertImage, insertTable, insertHr, insertDate, insertTime,
 *     insertCodeBlock, insertBlockquote, setFocusMode, toggleDarkMode,
 *     commandId, matchedText }
 */

/**
 * 简单工厂：构造一个标准指令对象
 * @param {Partial<import('../types/local-commands').LocalCommandDef>} def
 */
function defineCommand(def) {
  return {
    id: def.id,
    category: def.category,
    patterns: def.patterns || [],
    priority: def.priority ?? 100,
    condition: def.condition || (() => true),
    action: def.action || (() => ({ ok: true })),
    successMessage: def.successMessage || '✅ 已执行',
    failureMessage: def.failureMessage || '⚠️ 当前条件不满足',
  }
}

// ── 工具谓词：检查编辑器是否可用且有焦点或选区 ──────────
function editorAvailable(ctx) {
  return Boolean(ctx.editor)
}

function hasSelection(ctx) {
  return Boolean(ctx.editor && ctx.hasSelection)
}

function hasCursorInDoc(ctx) {
  return Boolean(ctx.editor && ctx.hasCursor)
}

function hasContent(ctx) {
  if (typeof ctx.documentContent === 'string') return ctx.documentContent.trim().length > 0
  if (ctx.editor) return ctx.editor.state.doc.textContent.trim().length > 0
  return false
}

// ── 批量清洗工具：删除链接（保留链接文字）────────────

/**
 * 移除文档中所有 link mark（保留链接文字）。
 *
 * 支持两种调用模式：
 * - 默认模式：自创建 transaction → dispatch → 产生独立的 undo step
 * - 共享模式（options.sharedTransaction != null）：仅把操作追加到共享 tr，不 dispatch
 *   由调用方统一负责 dispatch 与 undo history 合并。
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {{ sharedTransaction?: object, skipDispatch?: boolean }} [options]
 * @returns {number} 移除的 link mark 数量
 */
function stripAllLinks(editor, options = {}) {
  let removed = 0
  if (!editor || !editor.state || !editor.state.doc) return 0
  const { state, view } = editor
  const tr = options.sharedTransaction || state.tr
  state.doc.descendants((node, pos) => {
    if (node && node.isText) {
      const linkMarks = (node.marks || []).filter((m) => m && m.type && m.type.name === 'link')
      linkMarks.forEach((m) => {
        tr.removeMark(pos, pos + node.nodeSize, m.type)
        removed += 1
      })
    }
    return true
  })
  if (removed > 0 && !options.sharedTransaction && !options.skipDispatch) {
    view.dispatch(tr)
  }
  return removed
}

/**
 * 删除文档中所有 URL 纯文本（如 https://example.com/foo）。支持共享 transaction。
 * @param {import('@tiptap/core').Editor} editor
 * @param {{ sharedTransaction?: object, skipDispatch?: boolean }} [options]
 * @returns {number} 删除的 URL 数量
 */
const URL_PATTERN = /https?:\/\/[^\s)）\]】」>]+/g
function stripAllUrls(editor, options = {}) {
  if (!editor || !editor.state || !editor.state.doc) return 0
  const { state, view } = editor
  const tr = options.sharedTransaction || state.tr
  const ranges = []
  state.doc.descendants((node, pos) => {
    if (!node || !node.isText || !node.text) return true
    URL_PATTERN.lastIndex = 0
    let m
    while ((m = URL_PATTERN.exec(node.text)) !== null) {
      ranges.push({ from: pos + m.index, to: pos + m.index + m[0].length })
    }
    return true
  })
  // 从后往前删，避免位置漂移
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    tr.delete(ranges[i].from, ranges[i].to)
  }
  if (ranges.length > 0 && !options.sharedTransaction && !options.skipDispatch) {
    view.dispatch(tr)
  }
  return ranges.length
}

// ── 批量清洗工具集（Level 2 扩展）───────────────────────

/**
 * 删除文档中所有邮箱地址。支持共享 transaction。
 * @param {import('@tiptap/core').Editor} editor
 * @param {{ sharedTransaction?: object, skipDispatch?: boolean }} [options]
 * @returns {number} 删除数量
 */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
function stripAllEmails(editor, options = {}) {
  if (!editor || !editor.state || !editor.state.doc) return 0
  const { state, view } = editor
  const tr = options.sharedTransaction || state.tr
  const ranges = []
  state.doc.descendants((node, pos) => {
    if (!node || !node.isText || !node.text) return true
    EMAIL_PATTERN.lastIndex = 0
    let m
    while ((m = EMAIL_PATTERN.exec(node.text)) !== null) {
      ranges.push({ from: pos + m.index, to: pos + m.index + m[0].length })
    }
    return true
  })
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    tr.delete(ranges[i].from, ranges[i].to)
  }
  if (ranges.length > 0 && !options.sharedTransaction && !options.skipDispatch) {
    view.dispatch(tr)
  }
  return ranges.length
}

/**
 * 删除文档中所有中国大陆手机号（11 位、1[3-9] 开头，前后无数字）。支持共享 transaction。
 * @param {import('@tiptap/core').Editor} editor
 * @param {{ sharedTransaction?: object, skipDispatch?: boolean }} [options]
 * @returns {number} 删除数量
 */
const PHONE_PATTERN = /(?<!\d)1[3-9]\d{9}(?!\d)/g
function stripAllPhoneNumbers(editor, options = {}) {
  if (!editor || !editor.state || !editor.state.doc) return 0
  const { state, view } = editor
  const tr = options.sharedTransaction || state.tr
  const ranges = []
  state.doc.descendants((node, pos) => {
    if (!node || !node.isText || !node.text) return true
    PHONE_PATTERN.lastIndex = 0
    let m
    while ((m = PHONE_PATTERN.exec(node.text)) !== null) {
      ranges.push({ from: pos + m.index, to: pos + m.index + m[0].length })
    }
    return true
  })
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    tr.delete(ranges[i].from, ranges[i].to)
  }
  if (ranges.length > 0 && !options.sharedTransaction && !options.skipDispatch) {
    view.dispatch(tr)
  }
  return ranges.length
}

/**
 * 清洗 Markdown 标记（去掉 ** / # / ` / ~~ / 引用等），保留文字。
 * 使用正则按行处理，避免破坏正文。支持共享 transaction。
 * @param {import('@tiptap/core').Editor} editor
 * @param {{ sharedTransaction?: object, skipDispatch?: boolean }} [options]
 * @returns {number} 修改的行数
 */
const MD_INLINE_PATTERNS = [
  /\*\*([^*]+)\*\*/g,   // **粗体**
  /(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, // *斜体*
  /~~([^~]+)~~/g,          // ~~删除线~~
  /`([^`]+)`/g,            // `行内代码`
]
function stripMarkdownSyntax(editor, options = {}) {
  if (!editor || !editor.state || !editor.state.doc) return 0
  const { state, view } = editor
  const tr = options.sharedTransaction || state.tr
  const ranges = []
  state.doc.descendants((node, pos) => {
    if (!node || !node.isText || !node.text) return true
    const text = node.text
    // 收集所有替换区间（含模式 + 标题标记 #）
    MD_INLINE_PATTERNS.forEach((p) => {
      p.lastIndex = 0
      let m
      while ((m = p.exec(text)) !== null) {
        // 替换为第 1 个捕获组（不带包裹符号）
        ranges.push({ from: pos + m.index, to: pos + m.index + m[0].length, replacement: m[1] || '' })
      }
    })
    return true
  })
  // 倒序替换
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const r = ranges[i]
    tr.insertText(r.replacement, r.from, r.to)
  }
  if (ranges.length > 0 && !options.sharedTransaction && !options.skipDispatch) {
    view.dispatch(tr)
  }
  return ranges.length
}

/**
 * 删除文档中所有图片节点。支持共享 transaction。
 * @param {import('@tiptap/core').Editor} editor
 * @param {{ sharedTransaction?: object, skipDispatch?: boolean }} [options]
 * @returns {number} 删除数量
 */
function stripAllImages(editor, options = {}) {
  if (!editor || !editor.state || !editor.state.doc) return 0
  const { state, view } = editor
  const tr = options.sharedTransaction || state.tr
  const ranges = []
  state.doc.descendants((node, pos) => {
    if (node && node.type && node.type.name === 'image') {
      // 必须删除整个 image 节点范围（pos 到 pos + nodeSize），否则只删 1 个字符会留下空节点
      ranges.push({ from: pos, to: pos + node.nodeSize })
    }
    return true
  })
  // 从后往前删，避免位置漂移
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    tr.delete(ranges[i].from, ranges[i].to)
  }
  if (ranges.length > 0 && !options.sharedTransaction && !options.skipDispatch) {
    view.dispatch(tr)
  }
  return ranges.length
}

// ── 批量清洗聚合工具（Level 3 提示气泡配套）─────────

/**
 * 统计文档中"可被批量清洗"的项目数量。
 * 返回结构便于 UI 聚合提示：「检测到 N 处链接 / M 处邮箱 ...」。
 *
 * 注意：这是只读统计，不修改文档；调用方需自行节流以避免大文档卡顿。
 *
 * @param {import('@tiptap/core').Editor | null} editor
 * @returns {{ links: number, urls: number, emails: number, phones: number, md: number, images: number, total: number }}
 */
function countCleanableItems(editor) {
  const result = { links: 0, urls: 0, emails: 0, phones: 0, md: 0, images: 0, total: 0 }
  if (!editor || !editor.state || !editor.state.doc) return result

  const { state } = editor
  state.doc.descendants((node) => {
    if (!node) return true
    // 文本节点：扫描 URL / 邮箱 / 手机号 / Markdown 标记
    if (node.isText && node.text) {
      const text = node.text
      // 邮箱
      EMAIL_PATTERN.lastIndex = 0
      let m
      while ((m = EMAIL_PATTERN.exec(text)) !== null) result.emails += 1
      // 手机号
      PHONE_PATTERN.lastIndex = 0
      while ((m = PHONE_PATTERN.exec(text)) !== null) result.phones += 1
      // URL 纯文本
      URL_PATTERN.lastIndex = 0
      while ((m = URL_PATTERN.exec(text)) !== null) result.urls += 1
      // Markdown 行内标记
      MD_INLINE_PATTERNS.forEach((p) => {
        p.lastIndex = 0
        while ((m = p.exec(text)) !== null) result.md += 1
      })
    }
    // Link mark 数量
    if (node.isText && Array.isArray(node.marks)) {
      node.marks.forEach((mk) => {
        if (mk && mk.type && mk.type.name === 'link') result.links += 1
      })
    }
    // 图片节点
    if (node.type && node.type.name === 'image') {
      result.images += 1
    }
    return true
  })

  result.total =
    result.links + result.urls + result.emails + result.phones + result.md + result.images
  return result
}

/**
 * 同步版 runBatchClean：一次性累积 6 个清洗步骤到同一个 transaction，
 * 最后一次性 dispatch。整个批处理作为「单个 undo step」，Ctrl+Z 可一键全部撤销。
 *
 * @param {import('@tiptap/core').Editor} editor
 * @returns {{ links: number, urls: number, emails: number, phones: number, md: number, images: number, total: number, errors: string[] }}
 */
function runBatchClean(editor) {
  const counts = { links: 0, urls: 0, emails: 0, phones: 0, md: 0, images: 0, total: 0 }
  const errors = []
  if (!editor || !editor.state || !editor.state.doc) {
    return { ...counts, errors }
  }
  const safeRun = (label, fn) => {
    try {
      const n = fn(editor)
      return Number(n) || 0
    } catch (err) {
      errors.push(`${label}: ${err?.message || String(err)}`)
      return 0
    }
  }

  // 创建一个共享 transaction，所有修改都附加到这个 tr 上
  const tr = editor.state.tr
  // 中间步骤（除最后一次）不创建新的 undo step，保证一键 Ctrl+Z 能全部撤销
  tr.setMeta('addToHistory', false)
  counts.links = safeRun('链接', (ed) => stripAllLinks(ed, { sharedTransaction: tr, skipDispatch: true }))
  counts.urls = safeRun('URL', (ed) => stripAllUrls(ed, { sharedTransaction: tr, skipDispatch: true }))
  counts.emails = safeRun('邮箱', (ed) => stripAllEmails(ed, { sharedTransaction: tr, skipDispatch: true }))
  counts.phones = safeRun('手机号', (ed) => stripAllPhoneNumbers(ed, { sharedTransaction: tr, skipDispatch: true }))
  counts.md = safeRun('Markdown', (ed) => stripMarkdownSyntax(ed, { sharedTransaction: tr, skipDispatch: true }))
  counts.images = safeRun('图片', (ed) => stripAllImages(ed, { sharedTransaction: tr, skipDispatch: true }))

  counts.total =
    counts.links +
    counts.urls +
    counts.emails +
    counts.phones +
    counts.md +
    counts.images

  // 只有在 tr 有实际修改时才 dispatch，井作为一个 undo step 入栈
  if (tr.docChanged && editor.view) {
    // 取消 addToHistory=false，让此次 dispatch 创建新的 undo step（与其他输入步骊同仓）
    tr.setMeta('addToHistory', true)
    editor.view.dispatch(tr)
  }
  return { ...counts, errors }
}

/**
 * 异步版 runBatchClean：逐步执行清洗步骤，每步之间让出主线程，
 * 支持进度回调与 AbortSignal 中断。
 *
 * 注意：异步模式下 6 步仍合并到同一 undo step；仅在 「中途被 abort」 时丢弃
 * 已应用的修改（不会 dispatch）。调用方应该在自己的 UI 中显示进度与「中断」按钮。
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {{
 *   signal?: AbortSignal,
 *   onProgress?: (info: { step: number, totalSteps: number, label: string, count: number, done: boolean }) => void,
 *   yieldEvery?: number,  // 每多少步让出一次主线程（默认 1）
 * }} [options]
 * @returns {Promise<{ links: number, urls: number, emails: number, phones: number, md: number, images: number, total: number, errors: string[], aborted: boolean }>}
 */
async function runBatchCleanAsync(editor, options = {}) {
  const { signal, onProgress, yieldEvery = 1 } = options
  const counts = { links: 0, urls: 0, emails: 0, phones: 0, md: 0, images: 0, total: 0 }
  const errors = []
  if (!editor || !editor.state || !editor.state.doc) {
    return { ...counts, errors, aborted: !!signal?.aborted }
  }
  const steps = [
    { key: 'links', label: '链接', fn: stripAllLinks },
    { key: 'urls', label: 'URL', fn: stripAllUrls },
    { key: 'emails', label: '邮箱', fn: stripAllEmails },
    { key: 'phones', label: '手机号', fn: stripAllPhoneNumbers },
    { key: 'md', label: 'Markdown', fn: stripMarkdownSyntax },
    { key: 'images', label: '图片', fn: stripAllImages },
  ]
  const totalSteps = steps.length

  // 共享 transaction：所有步骤的修改都追加到同一个 tr
  const tr = editor.state.tr
  tr.setMeta('addToHistory', false)

  let aborted = false
  let executedSteps = 0

  for (let i = 0; i < steps.length; i += 1) {
    if (signal?.aborted) {
      aborted = true
      break
    }
    const step = steps[i]
    let n = 0
    try {
      n = step.fn(editor, { sharedTransaction: tr, skipDispatch: true })
      n = Number(n) || 0
    } catch (err) {
      errors.push(`${step.label}: ${err?.message || String(err)}`)
    }
    counts[step.key] = n
    counts.total += n
    executedSteps += 1
    if (typeof onProgress === 'function') {
      try {
        onProgress({
          step: i + 1,
          totalSteps,
          label: step.label,
          count: n,
          done: false,
        })
      } catch {
        /* 进度回调不应中断主流程 */
      }
    }
    // 让出主线程以保证进度可被渲染
    if ((i + 1) % yieldEvery === 0) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve()
    }
  }

  counts.total = counts.links + counts.urls + counts.emails + counts.phones + counts.md + counts.images

  if (aborted || !tr.docChanged) {
    if (typeof onProgress === 'function') {
      try {
        onProgress({ step: executedSteps, totalSteps, label: '', count: 0, done: true })
      } catch { /* ignore */ }
    }
    return { ...counts, errors, aborted }
  }

  // 创建一个独立的 undo step（一键撤销）
  tr.setMeta('addToHistory', true)
  if (editor.view) {
    editor.view.dispatch(tr)
  }

  if (typeof onProgress === 'function') {
    try {
      onProgress({ step: totalSteps, totalSteps, label: '', count: 0, done: true })
    } catch { /* ignore */ }
  }
  return { ...counts, errors, aborted: false }
}

// ── 文本操作（CMD-001 ~ CMD-012）─────────────────────

const textCommands = [
  defineCommand({
    id: 'delete-emails',
    category: 'text',
    patterns: [
      /^(删除|去掉|去除|移除|清除)(文章|文档|全文|正文)?(中的|里的|中)?(所有|全部)?(邮箱|邮件|email)(地址)?$/,
      /^(删除|去掉|去除|移除|清除)(所有|全部)?(邮箱|邮件)$/,
      /^(strip|remove|delete)\s*(all\s*)?emails?$/i,
    ],
    priority: 104,
    condition: editorAvailable,
    action: (ctx) => {
      try {
        const n = stripAllEmails(ctx.editor)
        if (n === 0) return { ok: false, message: '⚠️ 当前文档中没有邮箱地址' }
        return { ok: true, message: `✅ 已删除文档中的 ${n} 处邮箱` }
      } catch (err) {
        return { ok: false, message: '⚠️ 删除邮箱失败：' + (err?.message || String(err)) }
      }
    },
    successMessage: '✅ 已删除文档中的所有邮箱',
    failureMessage: '⚠️ 编辑器不可用',
  }),
  defineCommand({
    id: 'delete-phone-numbers',
    category: 'text',
    patterns: [
      /^(删除|去掉|去除|移除|清除)(文章|文档|全文|正文)?(中的|里的|中)?(所有|全部)?(手机号|手机|电话号码|电话)$/,
      /^(删除|去掉|去除|移除|清除)(所有|全部)?(手机号|手机)$/,
      /^(strip|remove|delete)\s*(all\s*)?phones?$/i,
      /^去手机$/,
    ],
    priority: 104,
    condition: editorAvailable,
    action: (ctx) => {
      try {
        const n = stripAllPhoneNumbers(ctx.editor)
        if (n === 0) return { ok: false, message: '⚠️ 当前文档中没有手机号' }
        return { ok: true, message: `✅ 已删除文档中的 ${n} 处手机号` }
      } catch (err) {
        return { ok: false, message: '⚠️ 删除手机号失败：' + (err?.message || String(err)) }
      }
    },
    successMessage: '✅ 已删除文档中的所有手机号',
    failureMessage: '⚠️ 编辑器不可用',
  }),
  defineCommand({
    id: 'clean-markdown',
    category: 'text',
    patterns: [
      /^(清洗|去掉)(markdown|md|格式)(标记|符号|语法)?$/,
      /^clean\s*(markdown|md)$/i,
      /^去除(粗体|斜体|删除线|行内代码)$/,
    ],
    priority: 104,
    condition: editorAvailable,
    action: (ctx) => {
      try {
        const n = stripMarkdownSyntax(ctx.editor)
        if (n === 0) return { ok: false, message: '⚠️ 当前文档没有 Markdown 标记' }
        return { ok: true, message: `✅ 已清洗文档中的 ${n} 处 Markdown 标记` }
      } catch (err) {
        return { ok: false, message: '⚠️ 清洗失败：' + (err?.message || String(err)) }
      }
    },
    successMessage: '✅ 已清洗文档中的 Markdown 标记',
    failureMessage: '⚠️ 编辑器不可用',
  }),
  defineCommand({
    id: 'delete-images',
    category: 'text',
    patterns: [
      /^(删除|去掉|去除|移除|清除)(文章|文档|全文)?(中的|里的|中)?(所有|全部)?(图片|图像)$/,
      /^(删除|去掉|去除|移除|清除)(所有|全部)?(图片|图像)$/,
      /^(strip|remove|delete)\s*(all\s*)?images?$/i,
      /^去图片$/,
    ],
    priority: 104,
    condition: editorAvailable,
    action: (ctx) => {
      try {
        const n = stripAllImages(ctx.editor)
        if (n === 0) return { ok: false, message: '⚠️ 当前文档中没有图片' }
        return { ok: true, message: `✅ 已删除文档中的 ${n} 张图片` }
      } catch (err) {
        return { ok: false, message: '⚠️ 删除图片失败：' + (err?.message || String(err)) }
      }
    },
    successMessage: '✅ 已删除文档中的所有图片',
    failureMessage: '⚠️ 编辑器不可用',
  }),
  defineCommand({
    id: 'delete-links',
    category: 'text',
    patterns: [
      /^(删除|去掉|去除|移除|清除)(文章|文档|全文|正文)?(中的|里的|中)?(所有|全部)?(超)?链接(内容|文字|文本|部分)?$/,
      /^(删除|去掉|去除|移除|清除)(所有|全部)?(超)?链接$/,
      /^(strip|remove|delete)\s*(all\s*)?links?$/i,
      /^去链接$/,
    ],
    priority: 105,
    condition: editorAvailable,
    action: (ctx) => {
      const editor = ctx.editor
      try {
        // 路径 1：Tiptap 已挂载 Link 扩展
        if (editor.commands && typeof editor.commands.unsetLink === 'function') {
          editor.chain().focus().selectAll().unsetLink().run()
          return { ok: true, message: '✅ 已删除文档中的链接（保留链接文字）' }
        }
        // 路径 2：手动移除 link mark
        const removedMarks = stripAllLinks(editor)
        if (removedMarks > 0) {
          return { ok: true, message: '✅ 已删除文档中的链接（保留链接文字）' }
        }
        // 路径 3：纯文本 URL（Markdown 粘贴产生的 URL 文本）
        const removedUrls = stripAllUrls(editor)
        if (removedUrls > 0) {
          return { ok: true, message: `✅ 已删除文档中的 ${removedUrls} 处 URL` }
        }
        return { ok: false, message: '⚠️ 当前文档中没有链接' }
      } catch (err) {
        return { ok: false, message: '⚠️ 删除链接失败：' + (err?.message || String(err)) }
      }
    },
    successMessage: '✅ 已删除文档中的链接（保留链接文字）',
    failureMessage: '⚠️ 编辑器不可用',
  }),
  defineCommand({
    id: 'batch-clean',
    category: 'text',
    patterns: [
      /^(批量|一键|全部)?(清洗|清理|净化)(文档|全文|正文|内容|一下)?$/,
      /^batch\s*clean(er)?$/i,
      /^(clean|sanitize|strip)\s*(all|everything|doc(ument)?)$/i,
      /^一键清洗$/,
      /^清洗文档$/,
    ],
    priority: 106,
    condition: editorAvailable,
    action: (ctx) => {
      try {
        const result = runBatchClean(ctx.editor)
        if (result.total === 0) {
          return { ok: false, message: '✨ 文档已经很干净，没有可清洗的内容' }
        }
        const parts = []
        if (result.links) parts.push(`${result.links} 处链接`)
        if (result.urls) parts.push(`${result.urls} 处 URL`)
        if (result.emails) parts.push(`${result.emails} 处邮箱`)
        if (result.phones) parts.push(`${result.phones} 处手机号`)
        if (result.md) parts.push(`${result.md} 处 Markdown 标记`)
        if (result.images) parts.push(`${result.images} 张图片`)
        const summary = parts.length ? parts.join(' + ') : `${result.total} 项`
        const tail = result.errors.length ? `（部分步骤出错：${result.errors.join('；')}）` : ''
        return {
          ok: true,
          message: `✅ 已批量清洗：${summary}${tail}`,
          data: result,
        }
      } catch (err) {
        return { ok: false, message: '⚠️ 批量清洗失败：' + (err?.message || String(err)) }
      }
    },
    successMessage: '✅ 已批量清洗文档',
    failureMessage: '✨ 文档已经很干净，没有可清洗的内容',
  }),
  defineCommand({
    id: 'delete-selection',
    category: 'text',
    patterns: [
      /^(删除|删掉|去掉|去除|移除|清除)$/,
      /^(把.*删掉|帮.*删掉|请.*删除)$/,
      /^delete$/i,
    ],
    priority: 100,
    condition: hasSelection,
    action: (ctx) => {
      ctx.editor.chain().focus().deleteSelection().run()
      return { ok: true, message: '✅ 已删除选中文本' }
    },
    successMessage: '✅ 已删除选中文本',
    failureMessage: '⚠️ 请先选中要删除的文字',
  }),
  defineCommand({
    id: 'copy-selection',
    category: 'text',
    patterns: [/^(复制|拷贝)$/, /^copy$/i],
    priority: 100,
    condition: hasSelection,
    action: (ctx) => {
      const text = ctx.editor.state.doc.textBetween(
        ctx.editor.state.selection.from,
        ctx.editor.state.selection.to,
        '\n',
      )
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(text)
      }
      return { ok: true, message: '✅ 已复制到剪贴板' }
    },
    successMessage: '✅ 已复制到剪贴板',
    failureMessage: '⚠️ 请先选中要复制的文字',
  }),
  defineCommand({
    id: 'cut-selection',
    category: 'text',
    patterns: [/^(剪切|剪下)$/, /^cut$/i],
    priority: 100,
    condition: hasSelection,
    action: (ctx) => {
      const text = ctx.editor.state.doc.textBetween(
        ctx.editor.state.selection.from,
        ctx.editor.state.selection.to,
        '\n',
      )
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(text)
      }
      ctx.editor.chain().focus().deleteSelection().run()
      return { ok: true, message: '✅ 已剪切到剪贴板' }
    },
    successMessage: '✅ 已剪切到剪贴板',
    failureMessage: '⚠️ 请先选中要剪切的文字',
  }),
  defineCommand({
    id: 'paste',
    category: 'text',
    patterns: [/^(粘贴|贴上)$/, /^paste$/i],
    priority: 100,
    condition: (ctx) => Boolean(ctx.clipboardText && editorAvailable(ctx)),
    action: (ctx) => {
      ctx.editor.chain().focus().insertContent(ctx.clipboardText).run()
      return { ok: true, message: '✅ 已粘贴' }
    },
    successMessage: '✅ 已粘贴',
    failureMessage: '⚠️ 剪贴板为空或编辑器不可用',
  }),
  defineCommand({
    id: 'select-all',
    category: 'text',
    patterns: [/^(全选|选择全部|选中所有)$/, /^select\s*all$/i],
    priority: 100,
    condition: editorAvailable,
    action: (ctx) => {
      ctx.editor.chain().focus().selectAll().run()
      return { ok: true, message: '✅ 已全选' }
    },
    successMessage: '✅ 已全选',
    failureMessage: '⚠️ 编辑器不可用',
  }),
  defineCommand({
    id: 'undo',
    category: 'text',
    patterns: [/^(撤销|回退|返回上一步|撤回)$/, /^undo$/i],
    priority: 100,
    condition: (ctx) => Boolean(ctx.editor && ctx.editor.can().undo()),
    action: (ctx) => {
      ctx.editor.chain().focus().undo().run()
      return { ok: true, message: '✅ 已撤销' }
    },
    successMessage: '✅ 已撤销',
    failureMessage: '⚠️ 没有可撤销的操作',
  }),
  defineCommand({
    id: 'redo',
    category: 'text',
    patterns: [/^(重做|恢复|取消撤销|前进)$/, /^redo$/i],
    priority: 100,
    condition: (ctx) => Boolean(ctx.editor && ctx.editor.can().redo()),
    action: (ctx) => {
      ctx.editor.chain().focus().redo().run()
      return { ok: true, message: '✅ 已重做' }
    },
    successMessage: '✅ 已重做',
    failureMessage: '⚠️ 没有可重做的操作',
  }),
]

// ── 格式操作（CMD-008 ~ CMD-016）─────────────────────

const formatCommands = [
  defineCommand({
    id: 'bold',
    category: 'format',
    patterns: [
      /^(加粗|粗体|变粗|bold)$/i,
      /^(把.*加粗|帮.*加粗)$/,
    ],
    priority: 100,
    condition: hasSelection,
    action: (ctx) => {
      ctx.editor.chain().focus().toggleBold().run()
      return { ok: true, message: '✅ 已切换加粗' }
    },
    successMessage: '✅ 已切换加粗',
    failureMessage: '⚠️ 请先选中文字',
  }),
  defineCommand({
    id: 'italic',
    category: 'format',
    patterns: [
      /^(斜体|倾斜|变斜|italic)$/i,
      /^(把.*变斜|帮.*变斜)$/,
    ],
    priority: 100,
    condition: hasSelection,
    action: (ctx) => {
      ctx.editor.chain().focus().toggleItalic().run()
      return { ok: true, message: '✅ 已切换斜体' }
    },
    successMessage: '✅ 已切换斜体',
    failureMessage: '⚠️ 请先选中文字',
  }),
  defineCommand({
    id: 'underline',
    category: 'format',
    patterns: [/^(下划线|加下划线|underline)$/i],
    priority: 100,
    condition: hasSelection,
    action: (ctx) => {
      // Tiptap StarterKit 默认不包含 underline，使用 toggleMark 通用命令
      if (ctx.editor.commands.toggleMark) {
        ctx.editor.chain().focus().toggleMark('underline').run()
        return { ok: true, message: '✅ 已切换下划线' }
      }
      return { ok: false, message: '⚠️ 编辑器不支持下划线' }
    },
    successMessage: '✅ 已切换下划线',
    failureMessage: '⚠️ 请先选中文字',
  }),
  defineCommand({
    id: 'strikethrough',
    category: 'format',
    patterns: [/^(删除线|删划线|strikethrough)$/i],
    priority: 90,
    condition: hasSelection,
    action: (ctx) => {
      ctx.editor.chain().focus().toggleStrike().run()
      return { ok: true, message: '✅ 已切换删除线' }
    },
    successMessage: '✅ 已切换删除线',
    failureMessage: '⚠️ 请先选中文字',
  }),
  defineCommand({
    id: 'superscript',
    category: 'format',
    patterns: [/^(上标|superscript)$/i],
    priority: 90,
    condition: hasSelection,
    action: (ctx) => {
      ctx.editor.chain().focus().toggleSuperscript().run()
      return { ok: true, message: '✅ 已设置为上标' }
    },
    successMessage: '✅ 已设置为上标',
    failureMessage: '⚠️ 请先选中文字',
  }),
  defineCommand({
    id: 'subscript',
    category: 'format',
    patterns: [/^(下标|subscript)$/i],
    priority: 90,
    condition: hasSelection,
    action: (ctx) => {
      ctx.editor.chain().focus().toggleSubscript().run()
      return { ok: true, message: '✅ 已设置为下标' }
    },
    successMessage: '✅ 已设置为下标',
    failureMessage: '⚠️ 请先选中文字',
  }),
  defineCommand({
    id: 'font-size-up',
    category: 'format',
    patterns: [
      /^(字号.*大|放大|变大|增大字号|加大字号)$/,
      /^(bigger|larger)$/i,
    ],
    priority: 90,
    condition: hasSelection,
    action: (ctx) => {
      ctx.editor.chain().focus().increaseFontSize?.().run()
      return { ok: true, message: '✅ 字号已增大' }
    },
    successMessage: '✅ 字号已增大',
    failureMessage: '⚠️ 请先选中文字',
  }),
  defineCommand({
    id: 'font-size-down',
    category: 'format',
    patterns: [
      /^(字号.*小|缩小|变小|减小字号)$/,
      /^(smaller)$/i,
    ],
    priority: 90,
    condition: hasSelection,
    action: (ctx) => {
      ctx.editor.chain().focus().decreaseFontSize?.().run()
      return { ok: true, message: '✅ 字号已减小' }
    },
    successMessage: '✅ 字号已减小',
    failureMessage: '⚠️ 请先选中文字',
  }),
  defineCommand({
    id: 'clear-format',
    category: 'format',
    patterns: [
      /^(清除格式|去掉格式|移除格式|清除样式)$/,
      /^clear\s*format$/i,
    ],
    priority: 90,
    condition: hasSelection,
    action: (ctx) => {
      ctx.editor.chain().focus().unsetAllMarks().clearNodes().run()
      return { ok: true, message: '✅ 格式已清除' }
    },
    successMessage: '✅ 格式已清除',
    failureMessage: '⚠️ 请先选中文字',
  }),
  // ── MD 智能排版引擎 ──
  // 匹配 "排版" / "格式化" / "美化" / "清洗格式" / "一键排版"
  defineCommand({
    id: 'format-md',
    category: 'format',
    patterns: [
      /^(排版|格式化|美化|清洗格式|一键排版)$/,
      /^(md|markdown)\s*排版$/i,
      /^format\s*md$/i,
    ],
    priority: 95,
    condition: (ctx) => {
      if (!ctx.editor) return false
      return getDocumentHasMarkdown(ctx.editor)
    },
    action: () => ({
      ok: true,
      message: '__MARKDOWN_FORMAT_PROMPT__',
      data: { source: 'manual' },
    }),
    successMessage: '__MARKDOWN_FORMAT_PROMPT__',
    failureMessage: '⚠️ 当前文档未检测到 Markdown 格式',
  }),
  defineCommand({
    id: 'align-md-images',
    category: 'format',
    patterns: [
      /^(对齐图片|图片对齐|整理图片|图片排版)$/,
      /^align\s*images?$/i,
    ],
    priority: 90,
    condition: (ctx) => Boolean(ctx.editor && hasImagesInDoc(ctx.editor)),
    action: () => ({ ok: true, message: '__MARKDOWN_IMAGE_ALIGN_PROMPT__' }),
    successMessage: '__MARKDOWN_IMAGE_ALIGN_PROMPT__',
    failureMessage: '⚠️ 当前文档中没有图片',
  }),
]

/**
 * 遍历文档节点，判断是否含 MD 标记。
 * 与 useMarkdownFormatter.getDocumentHasMarkdown 实现一致，
 * 复制在此避免循环依赖。
 * @param {import('@tiptap/core').Editor} editor
 * @returns {boolean}
 */
function getDocumentHasMarkdown(editor) {
  if (!editor || !editor.state || !editor.state.doc) return false
  let hasMarkdown = false
  try {
    editor.state.doc.descendants((node) => {
      if (hasMarkdown) return false
      const type = node.type.name
      if (
        type === 'heading' ||
        type === 'bulletList' ||
        type === 'orderedList' ||
        type === 'blockquote' ||
        type === 'codeBlock' ||
        type === 'horizontalRule' ||
        type === 'table'
      ) {
        hasMarkdown = true
        return false
      }
      return true
    })
  } catch {
    return false
  }
  return hasMarkdown
}

/**
 * 文档是否含图片
 * @param {import('@tiptap/core').Editor} editor
 */
function hasImagesInDoc(editor) {
  if (!editor || !editor.state || !editor.state.doc) return false
  let hasImage = false
  try {
    editor.state.doc.descendants((node) => {
      if (hasImage) return false
      if (node.type.name === 'image') {
        hasImage = true
        return false
      }
      return true
    })
  } catch {
    return false
  }
  return hasImage
}

// ── 字体切换（CMD-017 ~ CMD-026）────────────────────

/**
 * 构造一个字体切换指令对象
 * @param {string} id 指令 id
 * @param {string} fontName 字体名称（显示在消息中）
 * @param {string|string[]} fontFamily CSS 字体族（数组会用逗号拼接）
 * @param {number} priority
 */
function buildFontCommand(id, fontName, fontFamily, priority = 95) {
  const familyValue = Array.isArray(fontFamily) ? fontFamily.join(', ') : fontFamily
  // 简化的正则：触发词（用/使用/换成/切换[为到]?）+ 可选空白 + 字体名
  // \s* 处理「使用 HarmonyOS Sans」中触发词与字体名之间的空格
  return defineCommand({
    id,
    category: 'font',
    patterns: [
      new RegExp(`^(用|使用|换成|切换[为到]?)\\s*${escapeRegex(fontName)}\\s*$`, 'i'),
      new RegExp(`^把.*改成\\s*${escapeRegex(fontName)}\\s*$`),
      new RegExp(`^字体.*?${escapeRegex(fontName)}\\s*$`),
    ],
    priority,
    condition: (ctx) => hasSelection(ctx) || hasCursorInDoc(ctx),
    action: (ctx) => {
      ctx.editor.chain().focus().setMark('fontFamily', { fontFamily: familyValue }).run()
      return { ok: true, message: `✅ 已切换为${fontName}` }
    },
    successMessage: `✅ 已切换为${fontName}`,
    failureMessage: '⚠️ 请先选中文字或点击到文字中',
  })
}

/**
 * 转义正则元字符，用于构造安全正则。
 * @param {string} str
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const fontCommands = [
  buildFontCommand('font-source-han-sans', '思源黑体', '"Source Han Sans CN", "Source Han Sans SC", "Noto Sans CJK SC", sans-serif'),
  buildFontCommand('font-source-han-serif', '思源宋体', '"Source Han Serif CN", "Source Han Serif SC", "Noto Serif CJK SC", serif'),
  buildFontCommand('font-lxgw-wenkai', '霞鹜文楷', '"LXGW WenKai", "霞鹜文楷", cursive'),
  buildFontCommand('font-alibaba-puhui', '阿里巴巴普惠体', '"Alibaba PuHuiTi", "阿里巴巴普惠体", sans-serif'),
  buildFontCommand('font-harmonyos-sans', 'HarmonyOS Sans', '"HarmonyOS Sans SC", "HarmonyOS Sans", sans-serif'),
  buildFontCommand('font-jetbrains-mono', 'JetBrains Mono', '"JetBrains Mono", monospace'),
  buildFontCommand('font-heiti', '黑体', '"黑体", "Heiti SC", sans-serif'),
  buildFontCommand('font-songti', '宋体', '"宋体", "SimSun", "Songti SC", serif'),
  buildFontCommand('font-kaiti', '楷体', '"楷体", "Kaiti SC", "KaiTi", cursive'),
  buildFontCommand('font-default', '默认字体', ''),
]

// ── 对齐操作（CMD-027 ~ CMD-030）────────────────────

const alignCommands = [
  defineCommand({
    id: 'align-left',
    category: 'align',
    patterns: [/^(左对齐|靠左|左排)$/, /^align\s*left$/i],
    priority: 90,
    condition: hasCursorInDoc,
    action: (ctx) => {
      ctx.editor.chain().focus().setTextAlign('left').run()
      return { ok: true, message: '✅ 已左对齐' }
    },
    successMessage: '✅ 已左对齐',
    failureMessage: '⚠️ 请先点击到段落中',
  }),
  defineCommand({
    id: 'align-center',
    category: 'align',
    patterns: [/^(居中|居中对齐|中对齐)$/, /^align\s*center$/i],
    priority: 90,
    condition: hasCursorInDoc,
    action: (ctx) => {
      ctx.editor.chain().focus().setTextAlign('center').run()
      return { ok: true, message: '✅ 已居中对齐' }
    },
    successMessage: '✅ 已居中对齐',
    failureMessage: '⚠️ 请先点击到段落中',
  }),
  defineCommand({
    id: 'align-right',
    category: 'align',
    patterns: [/^(右对齐|靠右|右排)$/, /^align\s*right$/i],
    priority: 90,
    condition: hasCursorInDoc,
    action: (ctx) => {
      ctx.editor.chain().focus().setTextAlign('right').run()
      return { ok: true, message: '✅ 已右对齐' }
    },
    successMessage: '✅ 已右对齐',
    failureMessage: '⚠️ 请先点击到段落中',
  }),
  defineCommand({
    id: 'align-justify',
    category: 'align',
    patterns: [/^(两端对齐|左右对齐|分散对齐|justify)$/i],
    priority: 90,
    condition: hasCursorInDoc,
    action: (ctx) => {
      ctx.editor.chain().focus().setTextAlign('justify').run()
      return { ok: true, message: '✅ 已两端对齐' }
    },
    successMessage: '✅ 已两端对齐',
    failureMessage: '⚠️ 请先点击到段落中',
  }),
]

// ── 标题与段落（CMD-031 ~ CMD-041）──────────────────

/**
 * 构造一个标题级别指令
 * @param {number} level 1-6
 * @param {string} cn 中文章节数（一二三四五六）
 */
function buildHeadingCommand(level, cn) {
  return defineCommand({
    id: `heading-${level}`,
    category: 'heading',
    patterns: [
      new RegExp(`^(设为|设置|变成|改为)?标题[${level}${cn}]\\s*$`),
    ],
    priority: 95,
    condition: hasCursorInDoc,
    action: (ctx) => {
      ctx.editor.chain().focus().setHeading({ level }).run()
      return { ok: true, message: `✅ 已设为标题${level}` }
    },
    successMessage: `✅ 已设为标题${level}`,
    failureMessage: '⚠️ 请先点击到段落中',
  })
}

const headingCommands = [
  buildHeadingCommand(1, '一'),
  buildHeadingCommand(2, '二'),
  buildHeadingCommand(3, '三'),
  buildHeadingCommand(4, '四'),
  buildHeadingCommand(5, '五'),
  buildHeadingCommand(6, '六'),
  defineCommand({
    id: 'paragraph',
    category: 'heading',
    patterns: [
      /^(设为|设置|变成|改为)?(正文|普通文本)\s*$/,
    ],
    priority: 90,
    condition: hasCursorInDoc,
    action: (ctx) => {
      ctx.editor.chain().focus().setParagraph().run()
      return { ok: true, message: '✅ 已设为正文' }
    },
    successMessage: '✅ 已设为正文',
    failureMessage: '⚠️ 请先点击到段落中',
  }),
  defineCommand({
    id: 'bullet-list',
    category: 'list',
    patterns: [/^(无序列表|项目符号|bullet\s*list)$/i],
    priority: 90,
    condition: (ctx) => hasSelection(ctx) || hasCursorInDoc(ctx),
    action: (ctx) => {
      ctx.editor.chain().focus().toggleBulletList().run()
      return { ok: true, message: '✅ 已切换为无序列表' }
    },
    successMessage: '✅ 已切换为无序列表',
    failureMessage: '⚠️ 请先点击到段落中',
  }),
  defineCommand({
    id: 'ordered-list',
    category: 'list',
    patterns: [/^(有序列表|编号列表|ordered\s*list)$/i],
    priority: 90,
    condition: (ctx) => hasSelection(ctx) || hasCursorInDoc(ctx),
    action: (ctx) => {
      ctx.editor.chain().focus().toggleOrderedList().run()
      return { ok: true, message: '✅ 已切换为有序列表' }
    },
    successMessage: '✅ 已切换为有序列表',
    failureMessage: '⚠️ 请先点击到段落中',
  }),
  defineCommand({
    id: 'blockquote',
    category: 'list',
    patterns: [/^(引用|块引用|blockquote)$/i],
    priority: 90,
    condition: hasCursorInDoc,
    action: (ctx) => {
      if (typeof ctx.editor.commands.toggleBlockquote === 'function') {
        ctx.editor.chain().focus().toggleBlockquote().run()
        return { ok: true, message: '✅ 已切换为引用块' }
      }
      return { ok: false, message: '⚠️ 编辑器不支持引用块' }
    },
    successMessage: '✅ 已切换为引用块',
    failureMessage: '⚠️ 请先点击到段落中',
  }),
  defineCommand({
    id: 'code-block',
    category: 'list',
    patterns: [/^(代码块|代码|code\s*block)$/i],
    priority: 90,
    condition: (ctx) => hasSelection(ctx) || hasCursorInDoc(ctx),
    action: (ctx) => {
      ctx.editor.chain().focus().toggleCodeBlock().run()
      return { ok: true, message: '✅ 已切换为代码块' }
    },
    successMessage: '✅ 已切换为代码块',
    failureMessage: '⚠️ 请先选中或点击到段落中',
  }),
]

// ── 插入操作（CMD-042 ~ CMD-046）────────────────────

const insertCommands = [
  defineCommand({
    id: 'insert-table',
    category: 'insert',
    patterns: [/^(插入表格|新建表格|添加表格|创建表格)$/, /^table$/i],
    priority: 80,
    condition: editorAvailable,
    action: (ctx) => {
      if (typeof ctx.editor.commands.insertTable === 'function') {
        ctx.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        return { ok: true, message: '✅ 已插入 3×3 表格' }
      }
      return { ok: false, message: '⚠️ 编辑器不支持表格' }
    },
    successMessage: '✅ 已插入 3×3 表格',
    failureMessage: '⚠️ 编辑器不支持表格',
  }),
  defineCommand({
    id: 'insert-image',
    category: 'insert',
    patterns: [/^(插入图片|添加图片|导入图片|上传图片)$/, /^image$/i],
    priority: 80,
    condition: editorAvailable,
    action: (ctx) => {
      if (typeof ctx.insertImage === 'function') {
        ctx.insertImage()
        return { ok: true, message: '✅ 请选择要插入的图片' }
      }
      return { ok: false, message: '⚠️ 当前环境不支持图片插入' }
    },
    successMessage: '✅ 图片已插入',
    failureMessage: '⚠️ 当前环境不支持图片插入',
  }),
  defineCommand({
    id: 'insert-hr',
    category: 'insert',
    patterns: [/^(插入分隔线|分割线|水平线|hr)$/i],
    priority: 80,
    condition: editorAvailable,
    action: (ctx) => {
      ctx.editor.chain().focus().setHorizontalRule().run()
      return { ok: true, message: '✅ 已插入分隔线' }
    },
    successMessage: '✅ 已插入分隔线',
    failureMessage: '⚠️ 编辑器不可用',
  }),
  defineCommand({
    id: 'insert-date',
    category: 'insert',
    patterns: [/^(插入日期|当前日期|今天日期)$/],
    priority: 80,
    condition: editorAvailable,
    action: (ctx) => {
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      const text = `${yyyy}-${mm}-${dd}`
      ctx.editor.chain().focus().insertContent(text).run()
      return { ok: true, message: `✅ 已插入 ${text}` }
    },
    successMessage: '✅ 已插入当前日期',
    failureMessage: '⚠️ 编辑器不可用',
  }),
  defineCommand({
    id: 'insert-time',
    category: 'insert',
    patterns: [/^(插入时间|当前时间|现在时间)$/],
    priority: 80,
    condition: editorAvailable,
    action: (ctx) => {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const text = `${hh}:${mm}`
      ctx.editor.chain().focus().insertContent(text).run()
      return { ok: true, message: `✅ 已插入 ${text}` }
    },
    successMessage: '✅ 已插入当前时间',
    failureMessage: '⚠️ 编辑器不可用',
  }),
]

// ── 视图操作（CMD-047 ~ CMD-048）────────────────────

const viewCommands = [
  defineCommand({
    id: 'toggle-focus-mode',
    category: 'view',
    patterns: [
      /^(焦点模式|纸张模式|写作模式|专注模式)\s*$/,
      /^开启(焦点模式|纸张模式|写作模式|专注模式)\s*$/,
      /^关闭(焦点模式|纸张模式|写作模式|专注模式)\s*$/,
    ],
    priority: 80,
    condition: () => true,
    action: (ctx) => {
      if (typeof ctx.toggleFocusMode === 'function') {
        const next = ctx.toggleFocusMode()
        return { ok: true, message: `✅ 焦点模式已${next ? '开启' : '关闭'}` }
      }
      return { ok: false, message: '⚠️ 无法切换焦点模式' }
    },
    successMessage: '✅ 焦点模式已切换',
    failureMessage: '⚠️ 无法切换焦点模式',
  }),
  defineCommand({
    id: 'toggle-dark-mode',
    category: 'view',
    patterns: [
      /^(暗色模式|深色模式|夜间模式|黑暗模式)\s*$/,
      /^(dark\s*mode|night\s*mode)$/i,
    ],
    priority: 80,
    condition: () => true,
    action: (ctx) => {
      if (typeof ctx.toggleDarkMode === 'function') {
        const nextDark = ctx.toggleDarkMode()
        return { ok: true, message: `✅ 已切换为${nextDark ? '暗色' : '浅色'}模式` }
      }
      return { ok: false, message: '⚠️ 无法切换暗色模式' }
    },
    successMessage: '✅ 暗色模式已切换',
    failureMessage: '⚠️ 无法切换暗色模式',
  }),
]

// ── 文件操作（CMD-049 ~ CMD-053）────────────────────

const fileCommands = [
  defineCommand({
    id: 'save',
    category: 'file',
    patterns: [
      /^(保存|存盘|save)$/i,
      /^(保存文档|保存文件)$/,
    ],
    priority: 100,
    condition: (ctx) => Boolean(ctx.isDocumentDirty || ctx.editor),
    action: (ctx) => {
      if (typeof ctx.saveDocument === 'function') {
        ctx.saveDocument()
        return { ok: true, message: '✅ 正在保存文档…' }
      }
      return { ok: false, message: '⚠️ 当前环境不支持保存' }
    },
    successMessage: '✅ 正在保存文档…',
    failureMessage: '⚠️ 当前环境不支持保存',
  }),
  defineCommand({
    id: 'new-document',
    category: 'file',
    patterns: [
      /^(新建|新建文档|新建文件|new)$/i,
      /^(创建新文档|开新文件)$/,
    ],
    priority: 80,
    condition: () => true,
    action: (ctx) => {
      if (typeof ctx.newDocument === 'function') {
        ctx.newDocument()
        return { ok: true, message: '✅ 已新建空白文档' }
      }
      return { ok: false, message: '⚠️ 当前环境不支持新建' }
    },
    successMessage: '✅ 已新建空白文档',
    failureMessage: '⚠️ 当前环境不支持新建',
  }),
  defineCommand({
    id: 'export-pdf',
    category: 'file',
    patterns: [
      /^(导出pdf|导出PDF|输出pdf|存为pdf|转pdf)$/i,
    ],
    priority: 80,
    condition: hasContent,
    action: (ctx) => {
      if (typeof ctx.exportPdf === 'function') {
        ctx.exportPdf()
        return { ok: true, message: '✅ 正在导出 PDF…' }
      }
      return { ok: false, message: '⚠️ 当前环境不支持 PDF 导出' }
    },
    successMessage: '✅ 正在导出 PDF…',
    failureMessage: '⚠️ 文档为空，无法导出',
  }),
  defineCommand({
    id: 'export-docx',
    category: 'file',
    patterns: [
      /^(导出word|导出Word|输出word|存为word|转word|导出docx)$/i,
    ],
    priority: 80,
    condition: hasContent,
    action: (ctx) => {
      if (typeof ctx.exportDocx === 'function') {
        ctx.exportDocx()
        return { ok: true, message: '✅ 正在导出 Word…' }
      }
      return { ok: false, message: '⚠️ 当前环境不支持 Word 导出' }
    },
    successMessage: '✅ 正在导出 Word…',
    failureMessage: '⚠️ 文档为空，无法导出',
  }),
  defineCommand({
    id: 'export-md',
    category: 'file',
    patterns: [
      /^(导出markdown|导出md|导出Markdown)$/i,
    ],
    priority: 80,
    condition: hasContent,
    action: (ctx) => {
      if (typeof ctx.exportMd === 'function') {
        ctx.exportMd()
        return { ok: true, message: '✅ 正在导出 Markdown…' }
      }
      return { ok: false, message: '⚠️ 当前环境不支持 Markdown 导出' }
    },
    successMessage: '✅ 正在导出 Markdown…',
    failureMessage: '⚠️ 文档为空，无法导出',
  }),
]

// ── 窗口操作（CMD-054 ~ CMD-056）────────────────────

const windowCommands = [
  defineCommand({
    id: 'open-settings',
    category: 'window',
    patterns: [
      /^(设置|打开设置|偏好设置|选项)$/,
      /^(settings|preferences)$/i,
    ],
    priority: 70,
    condition: () => true,
    action: (ctx) => {
      if (typeof ctx.openSettings === 'function') {
        ctx.openSettings()
        return { ok: true, message: '✅ 已打开设置' }
      }
      return { ok: false, message: '⚠️ 无法打开设置' }
    },
    successMessage: '✅ 已打开设置',
    failureMessage: '⚠️ 无法打开设置',
  }),
  defineCommand({
    id: 'open-font-market',
    category: 'window',
    patterns: [
      /^(字体商店|字体市场|font\s*market)$/i,
    ],
    priority: 70,
    condition: () => true,
    action: (ctx) => {
      if (typeof ctx.openFontMarket === 'function') {
        ctx.openFontMarket()
        return { ok: true, message: '✅ 已打开字体商店' }
      }
      return { ok: false, message: '⚠️ 无法打开字体商店' }
    },
    successMessage: '✅ 已打开字体商店',
    failureMessage: '⚠️ 无法打开字体商店',
  }),
  defineCommand({
    id: 'open-library',
    category: 'window',
    patterns: [
      /^(文库|知识库|打开文库|资料库)$/,
    ],
    priority: 70,
    condition: () => true,
    action: (ctx) => {
      if (typeof ctx.openLibrary === 'function') {
        ctx.openLibrary()
        return { ok: true, message: '✅ 已打开文库' }
      }
      return { ok: false, message: '⚠️ 无法打开文库' }
    },
    successMessage: '✅ 已打开文库',
    failureMessage: '⚠️ 无法打开文库',
  }),
  // ── 教案生成课件（CMD-057） ──────────────────────────
  // 触发后弹出 LessonPlanToPptDialog 配置弹窗。
  // 实际弹窗逻辑由 EditorLayout 通过 window 自定义事件 wpx:local-command:open-lesson-plan-dialog 处理。
  defineCommand({
    id: 'open-lesson-plan-dialog',
    category: 'window',
    patterns: [
      /^(教案生成课件|生成课件|把这篇[生成做成][课件PPT]|做课件|把(这篇|这份)?教案?(生成|转成|做成)(课件|PPT))$/,
      /^(教案|教学设计)[→\->\s]*[生成做成]课件$/,
      /^lesson\s*to\s*ppt$/i,
      /^\/lesson[\-\s]?to[\-\s]?ppt$/i,
      /^(教案|课文).*?(课件|教学课件)$/,
    ],
    priority: 75,
    condition: () => true,
    action: (ctx) => {
      if (typeof ctx.openLessonPlanDialog === 'function') {
        ctx.openLessonPlanDialog()
        return { ok: true, message: '✅ 已打开教案生成课件配置', data: { source: 'local-command' } }
      }
      // 降级：派发全局事件让 EditorLayout 接管
      if (typeof window !== 'undefined') {
        const ev = new CustomEvent('wpx:local-command:open-lesson-plan-dialog', {
          detail: { source: 'ai-chat' },
        })
        window.dispatchEvent(ev)
        return { ok: true, message: '✅ 已触发教案生成课件', data: { source: 'event-fallback' } }
      }
      return { ok: false, message: '⚠️ 当前环境不支持教案生成课件' }
    },
    successMessage: '✅ 已打开教案生成课件配置',
    failureMessage: '⚠️ 当前环境不支持教案生成课件',
  }),
]

// ── 汇总导出 ──────────────────────────────────────

/** @type {import('../types/local-commands').LocalCommandDef[]} */
export const LOCAL_COMMANDS = [
  ...textCommands,
  ...formatCommands,
  ...fontCommands,
  ...alignCommands,
  ...headingCommands,
  ...insertCommands,
  ...viewCommands,
  ...fileCommands,
  ...windowCommands,
]

export const LOCAL_COMMAND_CATEGORIES = [
  { key: 'text', label: '文本操作' },
  { key: 'format', label: '格式操作' },
  { key: 'font', label: '字体切换' },
  { key: 'align', label: '对齐操作' },
  { key: 'heading', label: '标题与段落' },
  { key: 'list', label: '列表与引用' },
  { key: 'insert', label: '插入操作' },
  { key: 'view', label: '视图操作' },
  { key: 'file', label: '文件操作' },
  { key: 'window', label: '窗口操作' },
]

/**
 * 用于占位符轮转的代表性短语（精选 14 条覆盖主要分类）
 * 注意：这些字符串是"示例"，不是匹配规则；它们代表用户最可能输入的本地指令。
 */
export const LOCAL_COMMAND_PLACEHOLDERS = [
  '输入「批量清洗」一键清理链接/邮箱/手机号/Markdown/图片',
  '输入「删除」删除选中文本',
  '输入「删除链接」/「删除邮箱」/「删除手机号」一键清洗',
  '输入「清洗格式」去掉 Markdown 标记',
  '输入「删除图片」清空所有图片',
  '输入「加粗」/「斜体」切换格式',
  '输入「用思源黑体」切换字体',
  '输入「居中」/「左对齐」调整对齐',
  '输入「标题1」/「标题2」调整段落',
  '输入「无序列表」/「引用」插入结构',
  '输入「插入表格」/「插入分隔线」',
  '输入「插入日期」/「插入时间」',
  '输入「焦点模式」/「暗色模式」',
  '输入「保存」/「新建」管理文档',
  '输入「导出PDF」/「导出Word」/「导出md」',
  '输入「设置」/「字体商店」/「文库」',
  '输入「排版」/「格式化」一键美化 Markdown 内容',
  '输入「对齐图片」统一调整图片版式',
]

export const LOCAL_COMMANDS_COUNT = LOCAL_COMMANDS.length

// ── 提示气泡辅助工具导出（Level 3 配套）───────────────────────
// 注意：countCleanableItems / runBatchClean 的具体实现见上方
// 「批量清洗聚合工具」区域；此处再 export 一次以兼容不同导入风格。
export { countCleanableItems, runBatchClean, runBatchCleanAsync }