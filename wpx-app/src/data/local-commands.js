/**
 * WPX AI 本地指令数据定义
 *
 * 定义 56 个本地指令的结构化元数据：
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

// ── 文本操作（CMD-001 ~ CMD-007）─────────────────────

const textCommands = [
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
 * 用于占位符轮转的代表性短语（精选 12 条覆盖主要分类）
 * 注意：这些字符串是"示例"，不是匹配规则；它们代表用户最可能输入的本地指令。
 */
export const LOCAL_COMMAND_PLACEHOLDERS = [
  '输入「删除」删除选中文本',
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
