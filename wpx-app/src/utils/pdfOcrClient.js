/**
 * PDF OCR 客户端
 *
 * 负责在渲染进程中把 PDF 转换为可编辑的 Markdown 文本：
 *  1. 用 pdfjs-dist 加载 PDF，逐页尝试提取嵌入文本
 *  2. 嵌入文本为空（扫描版 PDF）时，把页面渲染到 Canvas，再用
 *     tesseract.js 做离线 OCR 识别
 *  3. 合并所有页面的识别结果，做最基础的结构化（标题 / 段落），
 *     输出可直接喂给 WPX 编辑器的 Markdown
 *
 * 设计原则：
 *  - 不引入 Worker，避免 Vite 8 + CJS shim 的构建陷阱
 *  - 主线程分批 await，让 UI 有机会刷新（不真正并发）
 *  - 进度回调保留在调用方，便于做"取消"
 */

import * as pdfjsLib from 'pdfjs-dist'
// Vite 会处理 worker 路径。必须显式配置，否则 pdfjs 会尝试从远端加载 worker。
// 直接用模块 URL，Vite 在构建时会把 worker.mjs 一起打进产物。
// eslint-disable-next-line import/no-unresolved
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker

import { createWorker } from 'tesseract.js'

const OCR_LANG = 'chi_sim+eng'
const OCR_RENDER_SCALE = 2
const OCR_PAGE_TIMEOUT_MS = 60_000

/**
 * @typedef {Object} ProgressInfo
 * @property {'loading'|'page'|'ocr'|'done'|'error'} phase
 * @property {number} [current]
 * @property {number} [total]
 * @property {string} [message]
 */

/**
 * @typedef {Object} PdfOcrResult
 * @property {string} markdown    最终 Markdown 文本
 * @property {string} [title]     文件名（去掉扩展名）
 * @property {number} pageCount   总页数
 * @property {'text'|'ocr'} mode  识别方式
 */

/**
 * 把 ArrayBuffer / Uint8Array 转成 pdfjs 需要的对象。
 * @param {ArrayBuffer | Uint8Array} data
 */
function toUint8(data) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  throw new Error('PDF 数据格式不支持')
}

/**
 * 检测一行的"标题感"——
 * 只针对 OCR 输出中形态明显的标题，避免把普通短语误识别为标题。
 *
 * 判定条件：
 *  1. 长度在 2 ~ 30 之间
 *  2. 不含句末标点（。，.!?！？；;）
 *  3. 含章节序号 / 章节关键字 / 全大写英文标题之一
 *  4. 不含强分隔标点（，：；…）
 *  5. 不以的/了/是等常见动词后缀结尾（避免误判短句）
 *
 * @param {string} line
 */
export function looksLikeHeading(line) {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (trimmed.length < 2 || trimmed.length > 30) return false
  if (/[。.!?！？；;]$/.test(trimmed)) return false
  if (/[，：；…,]/.test(trimmed)) return false

  // 章节序号：1. / 一、 / 第N章 / (一) / I. 等
  // 要求序号后面必须跟非数字字符，避免误识别纯数字 / 版本号
  if (
    /^(第[一二三四五六七八九十百千0-9]+[章篇部节])/.test(trimmed) ||
    /^[(（]?[一二三四五六七八九十]+[)）]/.test(trimmed) ||
    /^[0-9]+\.[\u4e00-\u9fa5A-Za-z]/.test(trimmed) ||
    /^[一二三四五六七八九十]+[、]/.test(trimmed) ||
    /^[IVX]+[.、][\u4e00-\u9fa5A-Za-z]/.test(trimmed)
  ) {
    return true
  }

  // 全大写英文（至少 3 个字母）
  if (/^[A-Z][A-Z0-9 \-]{2,}$/.test(trimmed)) {
    return true
  }

  // 标题常见关键字
  if (/(简介|概述|背景|摘要|总结|结论|方法|结果|讨论|引言|前言|目录|参考|附录)$/.test(trimmed)) {
    return true
  }

  // 中文名词短语（≤ 8 字，全为汉字，不含动词后缀）
  if (
    /^[\u4e00-\u9fa5]{2,8}$/.test(trimmed) &&
    !/[的了是在和与及或及之]/.test(trimmed) &&
    !/[介绍说明讲述分析讨论是]$/.test(trimmed)
  ) {
    return true
  }

  return false
}

/**
 * 把 OCR 原始文本拆成 Markdown 段落。
 * - 多个空行 → 段落分隔
 * - 单独成行的短句（heuristic）→ 视为二级标题
 * - 其余视为普通段落
 * @param {string} rawText
 */
export function structurePageText(rawText) {
  if (!rawText) return ''
  const normalized = String(rawText)
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalized) return ''

  const lines = normalized.split('\n')
  /** @type {string[]} */
  const blocks = []
  /** @type {string[]} */
  let buffer = []

  const flushBuffer = () => {
    const text = buffer.join(' ').replace(/\s+/g, ' ').trim()
    buffer = []
    if (text) blocks.push(text)
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushBuffer()
      continue
    }

    // 单字符 / 短数字 / 纯标点 → 视为段落内的分隔，不单独成段
    if (line.length <= 2) {
      buffer.push(line)
      continue
    }

    if (looksLikeHeading(line)) {
      flushBuffer()
      blocks.push(`## ${line}`)
      continue
    }

    buffer.push(line)
  }
  flushBuffer()

  return blocks.join('\n\n')
}

/**
 * 把单个 PDF 页渲染为 Canvas（PNG dataURL）。
 * @param {pdfjsLib.PDFPageProxy} page
 */
async function renderPageToCanvas(page) {
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文')

  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
}

/**
 * 把 PDF 文件完整解析为 Markdown。
 *
 * @param {ArrayBuffer | Uint8Array} data
 * @param {string} filename
 * @param {(info: ProgressInfo) => void} onProgress
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<PdfOcrResult>}
 */
export async function importPdfToMarkdown(data, filename, onProgress, options = {}) {
  const uint8 = toUint8(data)
  const title = filename.replace(/\.pdf$/i, '').trim() || '未命名 PDF'
  const { signal } = options

  const emit = (info) => {
    if (typeof onProgress === 'function') onProgress(info)
  }

  emit({ phase: 'loading', message: '正在加载 PDF…' })

  const loadingTask = pdfjsLib.getDocument({ data: uint8, disableFontFace: true })
  const pdf = await loadingTask.promise
  const pageCount = pdf.numPages

  emit({
    phase: 'page',
    current: 0,
    total: pageCount,
    message: `共 ${pageCount} 页，先尝试提取嵌入文本`,
  })

  // 第一遍：尝试提取每页的嵌入文本
  /** @type {Array<{ index: number, text: string, isScanned: boolean }>} */
  const pages = []

  for (let i = 1; i <= pageCount; i += 1) {
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError')

    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const rawText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim()

    const isScanned = rawText.length < 10
    pages.push({ index: i, text: rawText, isScanned })
  }

  const scannedPageIndexes = pages.filter((p) => p.isScanned).map((p) => p.index)
  const needsOcr = scannedPageIndexes.length > 0

  /** @type {Array<string>} */
  const pageMarkdowns = new Array(pageCount)

  if (!needsOcr) {
    emit({
      phase: 'page',
      current: pageCount,
      total: pageCount,
      message: '检测到可复制的嵌入文本，直接提取',
    })
    for (const p of pages) {
      pageMarkdowns[p.index - 1] = structurePageText(p.text)
    }
  } else {
    emit({
      phase: 'ocr',
      current: 0,
      total: scannedPageIndexes.length,
      message: `检测到 ${scannedPageIndexes.length} 页扫描内容，正在启动 OCR`,
    })

    const worker = await createWorker(OCR_LANG, 1, {
      logger: () => {
        // 静默 tesseract.js 的进度日志，进度由我们自己的回调管理
      },
    })

    try {
      for (let i = 0; i < scannedPageIndexes.length; i += 1) {
        if (signal?.aborted) throw new DOMException('已取消', 'AbortError')

        const pageIndex = scannedPageIndexes[i]
        const page = await pdf.getPage(pageIndex)
        const canvas = await renderPageToCanvas(page)

        emit({
          phase: 'ocr',
          current: i,
          total: scannedPageIndexes.length,
          message: `OCR 第 ${i + 1}/${scannedPageIndexes.length} 页`,
        })

        const recognizePromise = worker.recognize(canvas)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('单页 OCR 超时')), OCR_PAGE_TIMEOUT_MS)
        })
        const result = await Promise.race([recognizePromise, timeoutPromise])
        const text = result?.data?.text || ''
        pageMarkdowns[pageIndex - 1] = structurePageText(text)
      }
    } finally {
      await worker.terminate().catch(() => {})
    }
  }

  // 合并所有页
  const markdownParts = [`# ${title}`, '']
  for (let i = 0; i < pageMarkdowns.length; i += 1) {
    const md = pageMarkdowns[i]
    if (md) {
      if (i > 0) markdownParts.push('')
      markdownParts.push(md)
    }
  }

  emit({ phase: 'done', current: pageCount, total: pageCount, message: '完成' })

  return {
    markdown: markdownParts.join('\n'),
    title,
    pageCount,
    mode: needsOcr ? 'ocr' : 'text',
  }
}