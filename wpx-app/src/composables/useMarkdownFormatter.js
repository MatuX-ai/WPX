/**
 * WPX MD 智能排版引擎
 *
 * 纯前端规则引擎：当用户输入「排版 / 格式化 / 美化」等指令、或粘贴
 * 检测到 Markdown 标记时，按选定模板批量修改 Tiptap 节点属性。
 *
 * 不调用任何 AI API，零 Token 消耗、零延迟、离线可用。
 *
 * 六个模板按需求文档第 3 节实现：
 *  - article          通用文章    H1 居中 / 正文首行缩进 / 图片 80% 居中
 *  - report           正式报告    H1 居中加粗 / H2 左对齐加粗 / 图片居中自适应
 *  - official         公文通知    仿机关红头文件 / 字号 22pt / 行距 28pt / 落款右对齐
 *  - lesson-plan      教案模板    主标题黑体二号居中 / 模块标题加粗左对齐
 *  - paper            科研论文    摘要两端对齐缩进 2 字符 / 章节标题加粗 / 参考文献悬挂缩进
 *  - webpage-archive  网页存档    保留来源 URL 和导入时间,正文按标准排版（HTML 导入专用）
 *
 * 公开 API：
 *  - formatDocument(editor, templateId)    应用模板
 *  - alignImages(editor, mode)             调整所有图片对齐
 *  - getTemplateList()                     获取模板元数据列表
 *  - getTemplateById(id)                   按 id 查模板
 *  - getDocumentHasMarkdown(editor)        文档是否含 MD 标记
 *  - hasImagesInDoc(editor)                文档是否含图片
 *  - getDefaultImageAlignMode(editor)      推断图片默认对齐模式
 */

import { detectMarkdown } from '@/utils/markdownDetector'

/* ────────── 模板规则定义 ────────── */

/**
 * @typedef {Object} TemplateRule
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {Record<number, HeadingRule>} heading
 * @property {ParagraphRule} paragraph
 * @property {ImageRule} image
 * @property {ListRule} [list]
 * @property {BlockquoteRule} [blockquote]
 * @property {ReferenceRule} [reference]
 */

/**
 * @typedef {Object} HeadingRule
 * @property {'left'|'center'|'right'|'justify'|null} align
 * @property {string|null} fontSize
 * @property {boolean} bold
 * @property {string|null} fontFamily
 * @property {string|null} lineHeight
 */

/**
 * @typedef {Object} ParagraphRule
 * @property {'left'|'center'|'right'|'justify'|null} align
 * @property {string|null} textIndent
 * @property {string|null} lineHeight
 * @property {string|null} fontSize
 * @property {string|null} fontFamily
 */

/**
 * @typedef {Object} ImageRule
 * @property {'left'|'center'|'right'} align
 * @property {'left'|'right'|'none'} float
 * @property {string} width       百分比字符串，例如 "80%"
 * @property {string|null} [height]
 */

/**
 * @typedef {Object} ListRule
 * @property {'left'|'center'|'right'|'justify'|null} align
 * @property {string|null} indent
 */

/**
 * @typedef {Object} BlockquoteRule
 * @property {'left'|'center'|'right'|'justify'|null} align
 * @property {string|null} indent
 */

/**
 * @typedef {Object} ReferenceRule
 * @property {'left'|'center'|'right'|'justify'|null} align
 * @property {string|null} indent
 * @property {'number'|'bullet'|null} marker
 */

/** @type {Record<string, TemplateRule>} */
export const MARKDOWN_TEMPLATES = {
  article: {
    id: 'article',
    label: '通用文章',
    description: '日常写作和自媒体,标准段落 + 图片居中 80%',
    heading: {
      1: { align: 'center', fontSize: '24px', bold: true, fontFamily: null, lineHeight: '1.5' },
      2: { align: 'left', fontSize: '20px', bold: true, fontFamily: null, lineHeight: '1.5' },
      3: { align: 'left', fontSize: '18px', bold: true, fontFamily: null, lineHeight: '1.5' },
      4: { align: 'left', fontSize: '16px', bold: true, fontFamily: null, lineHeight: '1.5' },
      5: { align: 'left', fontSize: '15px', bold: true, fontFamily: null, lineHeight: '1.5' },
      6: { align: 'left', fontSize: '14px', bold: true, fontFamily: null, lineHeight: '1.5' },
    },
    paragraph: {
      align: 'left',
      textIndent: '2em',
      lineHeight: '1.7',
      fontSize: '16px',
      fontFamily: null,
    },
    image: { align: 'center', float: 'none', width: '80%' },
    list: { align: 'left', indent: '1.5em' },
    blockquote: { align: 'left', indent: '2em' },
  },
  report: {
    id: 'report',
    label: '正式报告',
    description: '商务汇报,层级分明,首行缩进 2 字符',
    heading: {
      1: { align: 'center', fontSize: '22px', bold: true, fontFamily: null, lineHeight: '1.5' },
      2: { align: 'left', fontSize: '18px', bold: true, fontFamily: null, lineHeight: '1.5' },
      3: { align: 'left', fontSize: '16px', bold: false, fontFamily: null, lineHeight: '1.5' },
      4: { align: 'left', fontSize: '15px', bold: false, fontFamily: null, lineHeight: '1.5' },
      5: { align: 'left', fontSize: '14px', bold: false, fontFamily: null, lineHeight: '1.5' },
      6: { align: 'left', fontSize: '14px', bold: false, fontFamily: null, lineHeight: '1.5' },
    },
    paragraph: {
      align: 'left',
      textIndent: '2em',
      lineHeight: '1.6',
      fontSize: '15px',
      fontFamily: null,
    },
    image: { align: 'center', float: 'none', width: '100%' },
    list: { align: 'left', indent: '1.5em' },
    blockquote: { align: 'left', indent: '2em' },
  },
  official: {
    id: 'official',
    label: '公文通知',
    description: '仿机关红头文件,字号 22pt,行距 28pt,落款右对齐',
    heading: {
      1: { align: 'center', fontSize: '22pt', bold: true, fontFamily: '"Source Han Serif CN", "宋体", "SimSun", serif', lineHeight: '28pt' },
      2: { align: 'center', fontSize: '18pt', bold: true, fontFamily: '"Source Han Serif CN", "宋体", "SimSun", serif', lineHeight: '28pt' },
      3: { align: 'left', fontSize: '16pt', bold: true, fontFamily: '"Source Han Serif CN", "宋体", "SimSun", serif', lineHeight: '28pt' },
      4: { align: 'left', fontSize: '14pt', bold: false, fontFamily: '"Source Han Serif CN", "宋体", "SimSun", serif', lineHeight: '28pt' },
      5: { align: 'left', fontSize: '14pt', bold: false, fontFamily: '"Source Han Serif CN", "宋体", "SimSun", serif', lineHeight: '28pt' },
      6: { align: 'left', fontSize: '14pt', bold: false, fontFamily: '"Source Han Serif CN", "宋体", "SimSun", serif', lineHeight: '28pt' },
    },
    paragraph: {
      align: 'justify',
      textIndent: '2em',
      lineHeight: '28pt',
      fontSize: '14pt',
      fontFamily: '"Source Han Serif CN", "宋体", "SimSun", serif',
    },
    image: { align: 'center', float: 'none', width: '80%' },
    list: { align: 'justify', indent: '2em' },
    blockquote: { align: 'left', indent: '2em' },
  },
  'lesson-plan': {
    id: 'lesson-plan',
    label: '教案模板',
    description: '主标题黑体二号居中,模块标题加粗左对齐',
    heading: {
      1: { align: 'center', fontSize: '22pt', bold: true, fontFamily: '"黑体", "Heiti SC", "Source Han Sans CN", sans-serif', lineHeight: '1.6' },
      2: { align: 'left', fontSize: '16pt', bold: true, fontFamily: '"黑体", "Heiti SC", "Source Han Sans CN", sans-serif', lineHeight: '1.6' },
      3: { align: 'left', fontSize: '14pt', bold: true, fontFamily: '"黑体", "Heiti SC", "Source Han Sans CN", sans-serif', lineHeight: '1.6' },
      4: { align: 'left', fontSize: '13pt', bold: true, fontFamily: null, lineHeight: '1.6' },
      5: { align: 'left', fontSize: '13pt', bold: false, fontFamily: null, lineHeight: '1.6' },
      6: { align: 'left', fontSize: '13pt', bold: false, fontFamily: null, lineHeight: '1.6' },
    },
    paragraph: {
      align: 'left',
      textIndent: '2em',
      lineHeight: '1.7',
      fontSize: '14pt',
      fontFamily: null,
    },
    image: { align: 'center', float: 'none', width: '80%' },
    list: { align: 'left', indent: '1.5em' },
    blockquote: { align: 'left', indent: '2em' },
  },
  paper: {
    id: 'paper',
    label: '科研论文',
    description: '符合学术规范,章节标题加粗,参考文献悬挂缩进',
    heading: {
      1: { align: 'center', fontSize: '18pt', bold: true, fontFamily: '"Source Han Serif CN", "宋体", "SimSun", serif', lineHeight: '1.6' },
      2: { align: 'left', fontSize: '15pt', bold: true, fontFamily: '"Source Han Serif CN", "宋体", "SimSun", serif', lineHeight: '1.6' },
      3: { align: 'left', fontSize: '13pt', bold: true, fontFamily: '"Source Han Serif CN", "宋体", "SimSun", serif', lineHeight: '1.6' },
      4: { align: 'left', fontSize: '12pt', bold: true, fontFamily: null, lineHeight: '1.6' },
      5: { align: 'left', fontSize: '12pt', bold: false, fontFamily: null, lineHeight: '1.6' },
      6: { align: 'left', fontSize: '12pt', bold: false, fontFamily: null, lineHeight: '1.6' },
    },
    paragraph: {
      align: 'justify',
      textIndent: '2em',
      lineHeight: '1.6',
      fontSize: '12pt',
      fontFamily: '"Source Han Serif CN", "宋体", "SimSun", serif',
    },
    image: { align: 'center', float: 'none', width: '90%' },
    list: { align: 'left', indent: '2em' },
    blockquote: { align: 'justify', indent: '2em' },
    reference: { align: 'left', indent: '0', marker: 'number' },
  },
  /**
   * 网页存档（HTML 导入专用模板）：
   * - 规则与「通用文章」一致，但图片宽度 100% 且标记 webpageHeader
   * - webpageHeader 由 useHtmlFormatter 在文档开头插入「来源信息块」时使用
   * - 不写入模板 id 的网页特有行为，仅复用通用规则以保证视觉一致
   */
  'webpage-archive': {
    id: 'webpage-archive',
    label: '网页存档',
    description: '保留来源 URL 和抓取时间,正文按标准排版（HTML 导入专用）',
    heading: {
      1: { align: 'center', fontSize: '24px', bold: true, fontFamily: null, lineHeight: '1.5' },
      2: { align: 'left', fontSize: '20px', bold: true, fontFamily: null, lineHeight: '1.5' },
      3: { align: 'left', fontSize: '18px', bold: true, fontFamily: null, lineHeight: '1.5' },
      4: { align: 'left', fontSize: '16px', bold: true, fontFamily: null, lineHeight: '1.5' },
      5: { align: 'left', fontSize: '15px', bold: true, fontFamily: null, lineHeight: '1.5' },
      6: { align: 'left', fontSize: '14px', bold: true, fontFamily: null, lineHeight: '1.5' },
    },
    paragraph: {
      align: 'left',
      textIndent: '2em',
      lineHeight: '1.7',
      fontSize: '16px',
      fontFamily: null,
    },
    image: { align: 'center', float: 'none', width: '100%' },
    list: { align: 'left', indent: '1.5em' },
    blockquote: { align: 'left', indent: '2em' },
    /** 标记：排版时由 useHtmlFormatter 在文档开头插入「来源信息块」 */
    webpageHeader: true,
  },
}

/* ────────── 工具谓词 ────────── */

/**
 * 编辑器是否可用
 * @param {*} editor
 */
function editorAvailable(editor) {
  return Boolean(editor && editor.state && editor.state.doc)
}

/**
 * 获取节点的现有 attrs（避免覆盖未涉及的字段）
 * @param {import('@tiptap/core').Editor} editor
 * @param {number} pos
 */
function readNodeAttrs(editor, pos) {
  try {
    return editor.state.doc.nodeAt(pos)?.attrs || {}
  } catch {
    return {}
  }
}

/**
 * 获取段落内文本的起止位置（用于 lineHeight / fontSize mark）
 * @param {import('@tiptap/pm/model').Node} node
 */
function textRangeForBlock(node) {
  // 段落/标题这类 block 节点：覆盖 [0, node.content.size)
  return { from: 0, to: node.content.size }
}

/* ────────── 文档检测 ────────── */

/**
 * 判断 Tiptap 文档是否含有 Markdown 格式痕迹（用于触发自动提示）。
 *
 * 简化策略：
 *  - 文档中存在 heading/list/blockquote 节点 → 视为含 MD
 *  - 存在水平分隔线/代码块 → 也视为 MD
 *  - 段落数量多且无标题 → 可能是纯文本
 *
 * @param {import('@tiptap/core').Editor | null} editor
 * @returns {boolean}
 */
export function getDocumentHasMarkdown(editor) {
  if (!editorAvailable(editor)) return false
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
 * 文档是否含有图片
 * @param {import('@tiptap/core').Editor | null} editor
 * @returns {boolean}
 */
export function hasImagesInDoc(editor) {
  if (!editorAvailable(editor)) return false
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

/**
 * 推断图片默认对齐模式（按宽高比例或缺省推断）
 * - 缺少 width/height 时 → 'fill'（按文本宽度填充，最常见）
 * - 用户已设置过 width 时尊重
 * @param {import('@tiptap/core').Editor} editor
 * @returns {'fill' | 'narrow' | 'keep'}
 */
export function getDefaultImageAlignMode(editor) {
  if (!editorAvailable(editor)) return 'fill'
  let needsNarrow = false
  let count = 0
  try {
    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'image') return true
      count += 1
      const w = node.attrs?.width
      if (w && typeof w === 'number' && w < 400) {
        needsNarrow = true
      } else if (typeof w === 'string' && w.endsWith('%') && Number(w.replace('%', '')) <= 65) {
        needsNarrow = true
      }
      return true
    })
  } catch {
    /* noop */
  }
  if (count === 0) return 'fill'
  return needsNarrow ? 'narrow' : 'fill'
}

/* ────────── 模板元数据 ────────── */

/**
 * 获取模板列表（用于 UI 渲染）
 * @returns {Array<{id: string, label: string, description: string}>}
 */
export function getTemplateList() {
  return Object.values(MARKDOWN_TEMPLATES).map((tpl) => ({
    id: tpl.id,
    label: tpl.label,
    description: tpl.description,
  }))
}

/**
 * 按 id 查模板
 * @param {string} id
 * @returns {TemplateRule | null}
 */
export function getTemplateById(id) {
  if (!id) return null
  return MARKDOWN_TEMPLATES[id] || null
}

/* ────────── 节点属性转换 ────────── */

/**
 * 将 HeadingRule 转为 Tiptap heading 节点的 attrs
 * @param {HeadingRule} rule
 * @param {Object} existing
 */
function buildHeadingAttrs(rule, existing) {
  return {
    ...existing,
    textAlign: rule.align || null,
  }
}

/**
 * 将 ParagraphRule 转为 paragraph 节点的 attrs（textAlign + data-indent）
 *
 * 注意：ProseMirror 不接受带连字符的属性名。
 * EditorCore 中已通过 ParagraphIndent 扩展把 `data-indent` 映射为 `dataIndent`，
 * 所以这里必须用驼峰命名 dataIndent，Tiptap renderHTML 阶段会输出 `data-indent`。
 *
 * @param {ParagraphRule} rule
 * @param {Object} existing
 */
function buildParagraphAttrs(rule, existing) {
  const attrs = {
    ...existing,
    textAlign: rule.align || null,
  }
  // textIndent 在 HTML 中是 text-indent CSS 属性，paragraph 节点没有原生 attr；
  // 我们把缩进存在 data-indent（schema 属性名 dataIndent），由 EditorCore CSS 映射。
  if (rule.textIndent) {
    attrs.dataIndent = rule.textIndent
  } else if ('dataIndent' in attrs) {
    delete attrs.dataIndent
  }
  return attrs
}

/**
 * 将 ImageRule 转为 image 节点的 attrs
 * @param {ImageRule} rule
 * @param {Object} existing
 */
function buildImageAttrs(rule, existing) {
  const attrs = { ...existing }
  if (rule.align) attrs.align = rule.align
  if (rule.float) attrs.float = rule.float
  if (rule.width) attrs.width = rule.width
  if (rule.height) attrs.height = rule.height
  return attrs
}

/* ────────── 排版主函数 ────────── */

/**
 * 应用排版模板到编辑器
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} templateId
 * @returns {{
 *   ok: boolean,
 *   modified: number,
 *   templateLabel: string,
 *   hasImages: boolean,
 *   message: string,
 *   error?: string
 * }}
 */
export function formatDocument(editor, templateId) {
  if (!editorAvailable(editor)) {
    return {
      ok: false,
      modified: 0,
      templateLabel: '',
      hasImages: false,
      message: '⚠️ 编辑器不可用',
      error: 'editor-unavailable',
    }
  }

  const tpl = getTemplateById(templateId)
  if (!tpl) {
    return {
      ok: false,
      modified: 0,
      templateLabel: '',
      hasImages: false,
      message: `⚠️ 未找到模板「${templateId}」`,
      error: 'template-not-found',
    }
  }

  let modified = 0
  const hasImages = hasImagesInDoc(editor)

  try {
    editor.commands.command(({ tr, dispatch }) => {
      if (!dispatch) return false

      const tasks = []
      // 第一遍：收集所有需要变更的位置
      editor.state.doc.descendants((node, pos) => {
        if (!node.isBlock) return true
        const type = node.type.name
        const existing = node.attrs || {}

        if (type === 'heading') {
          const level = Number(existing.level || 1)
          const rule = tpl.heading?.[level]
          if (rule) {
            const nextAttrs = buildHeadingAttrs(rule, existing)
            if (!attrsEqual(nextAttrs, existing)) {
              tasks.push({ pos, type, nextAttrs, rule })
            }
          }
          return true
        }

        if (type === 'paragraph') {
          const rule = tpl.paragraph
          if (rule) {
            const nextAttrs = buildParagraphAttrs(rule, existing)
            if (!attrsEqual(nextAttrs, existing)) {
              tasks.push({ pos, type, nextAttrs, rule })
            }
          }
          return true
        }

        if (type === 'image') {
          const rule = tpl.image
          if (rule) {
            const nextAttrs = buildImageAttrs(rule, existing)
            if (!attrsEqual(nextAttrs, existing)) {
              tasks.push({ pos, type, nextAttrs, rule })
            }
          }
          return true
        }

        if (type === 'bulletList' || type === 'orderedList' || type === 'listItem') {
          // 列表项的 align 由 TextAlign 扩展处理，缩进由原生 indent 决定
          return true
        }

        if (type === 'blockquote') {
          return true
        }

        return true
      })

      // 第二遍：应用节点级属性 + 行内 mark（lineHeight/fontSize/fontFamily）
      for (const task of tasks) {
        tr.setNodeMarkup(task.pos, null, task.nextAttrs)
        modified += 1

        // 对 heading / paragraph 应用 lineHeight/fontSize/fontFamily mark
        if (task.type === 'heading' || task.type === 'paragraph') {
          applyBlockTextMarks(tr, task.pos, task.rule, editor)
        }
      }

      dispatch(tr)
      return true
    })
  } catch (error) {
    console.error('[useMarkdownFormatter] formatDocument failed:', error)
    return {
      ok: false,
      modified,
      templateLabel: tpl.label,
      hasImages,
      message: `⚠️ 排版失败：${error?.message || '未知错误'}`,
      error: 'transaction-failed',
    }
  }

  return {
    ok: true,
    modified,
    templateLabel: tpl.label,
    hasImages,
    message: `✅ 已按【${tpl.label}】格式排版`,
  }
}

/**
 * 比较两个 attrs 对象是否相等（只比对 own enumerable keys）
 * @param {Object} a
 * @param {Object} b
 */
function attrsEqual(a, b) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false
  }
  return true
}

/**
 * 为 block 节点内部的文本应用 mark（lineHeight/fontSize/fontFamily）
 * @param {import('@tiptap/pm/state').Transaction} tr
 * @param {number} blockPos
 * @param {HeadingRule|ParagraphRule} rule
 * @param {import('@tiptap/core').Editor} editor
 */
function applyBlockTextMarks(tr, blockPos, rule, editor) {
  try {
    const node = editor.state.doc.nodeAt(blockPos)
    if (!node) return
    const from = blockPos + 1
    const to = blockPos + node.nodeSize - 1
    if (to <= from) return

    const markTypeFontSize = editor.schema.marks.fontSize
    const markTypeLineHeight = editor.schema.marks.lineHeight
    const markTypeFontFamily = editor.schema.marks.fontFamily

    if (rule.fontSize && markTypeFontSize) {
      tr.removeMark(from, to, markTypeFontSize)
      tr.addMark(
        from,
        to,
        markTypeFontSize.create({ fontSize: rule.fontSize }),
      )
    }
    if (rule.lineHeight && markTypeLineHeight) {
      tr.removeMark(from, to, markTypeLineHeight)
      tr.addMark(
        from,
        to,
        markTypeLineHeight.create({ lineHeight: rule.lineHeight }),
      )
    }
    if (rule.fontFamily && markTypeFontFamily) {
      tr.removeMark(from, to, markTypeFontFamily)
      tr.addMark(
        from,
        to,
        markTypeFontFamily.create({ fontFamily: rule.fontFamily }),
      )
    }
  } catch (error) {
    // mark 应用失败不应阻塞整体排版
    console.warn('[useMarkdownFormatter] applyBlockTextMarks failed:', error)
  }
}

/* ────────── 图片对齐 ────────── */

/**
 * 对齐所有图片
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {'fill' | 'narrow' | 'keep'} mode
 *  - fill   等比缩放至文本区域最大宽度,居中（默认 100%）
 *  - narrow 等比缩放至 65% 宽度,居中
 *  - keep   保持原尺寸,居中
 * @returns {{ ok: boolean, count: number, mode: string, message: string }}
 */
export function alignImages(editor, mode) {
  if (!editorAvailable(editor)) {
    return { ok: false, count: 0, mode, message: '⚠️ 编辑器不可用' }
  }
  const validModes = ['fill', 'narrow', 'keep']
  if (!validModes.includes(mode)) {
    return { ok: false, count: 0, mode, message: `⚠️ 未知的图片对齐模式：${mode}` }
  }

  let count = 0
  try {
    editor.commands.command(({ tr, dispatch }) => {
      if (!dispatch) return false
      const tasks = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name !== 'image') return true
        const existing = node.attrs || {}
        const nextAttrs = computeImageAlignAttrs(existing, mode)
        if (!attrsEqual(nextAttrs, existing)) {
          tasks.push({ pos, nextAttrs })
        }
        return true
      })
      for (const task of tasks) {
        tr.setNodeMarkup(task.pos, null, task.nextAttrs)
        count += 1
      }
      dispatch(tr)
      return true
    })
  } catch (error) {
    console.error('[useMarkdownFormatter] alignImages failed:', error)
    return { ok: false, count, mode, message: `⚠️ 图片对齐失败：${error?.message || '未知错误'}` }
  }

  const labels = {
    fill: '等比例撑满宽度',
    narrow: '窄边距居中（65%）',
    keep: '保持原尺寸居中',
  }
  return {
    ok: true,
    count,
    mode,
    message: `✅ ${count > 0 ? `已对齐 ${count} 张图片（${labels[mode]}）` : '文档中暂无图片'}`,
  }
}

/**
 * 根据 mode 计算图片 attrs
 *
 * 幂等性设计：
 *  - 保留所有现有 key（包括 height: null），避免 attrsEqual 因为 key 数不同
 *    而误判 nextAttrs !== existing 从而每次都触发 setNodeMarkup。
 *  - Tiptap renderHTML 通过 mergeAttributes 过滤 null/undefined，
 *    所以 height=null 不会出现在最终 <img> 属性中。
 *  - 仅在 mode='keep' 且原 width 为「百分比字符串」时才删除 width，
 *    使其返回「原始尺寸」。
 *
 * @param {Object} existing
 * @param {'fill'|'narrow'|'keep'} mode
 */
function computeImageAlignAttrs(existing, mode) {
  const attrs = { ...existing }
  attrs.align = 'center'
  attrs.float = 'none'
  // 记录填充模式，让 EditorImage 扩展输出的 data-fill 属性驱动 CSS
  // （HTML5 <img width="100%"> 会被浏览器当作 100px，所以需要 CSS 额外覆盖）
  attrs.fill = mode
  if (mode === 'fill') {
    attrs.width = '100%'
    // height 置 null：避免 fill 模式被外部 height 拉伸变形；
    // 由 Tiptap renderHTML 的 mergeAttributes 过滤 null，输出中不含 height。
    // 用 null（而非 delete）保证 key 数不变，让下次同模式调用保持幂等。
    attrs.height = null
  } else if (mode === 'narrow') {
    attrs.width = '65%'
    attrs.height = null
  } else if (mode === 'keep') {
    // 保持原尺寸：只删除「百分比字符串」宽，避免 narrow/fill 过后仍占 65%；
    // height 保留原值（可能被外部网页刻意设定）。
    if (typeof attrs.width === 'string' && attrs.width.endsWith('%')) {
      delete attrs.width
    }
  }
  return attrs
}

/* ────────── 对外默认导出 ────────── */

export function useMarkdownFormatter() {
  return {
    formatDocument,
    alignImages,
    getTemplateList,
    getTemplateById,
    getDocumentHasMarkdown,
    hasImagesInDoc,
    getDefaultImageAlignMode,
    detectMarkdown,
  }
}

export default {
  MARKDOWN_TEMPLATES,
  formatDocument,
  alignImages,
  getTemplateList,
  getTemplateById,
  getDocumentHasMarkdown,
  hasImagesInDoc,
  getDefaultImageAlignMode,
  useMarkdownFormatter,
}
