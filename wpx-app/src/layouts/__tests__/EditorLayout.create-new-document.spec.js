/**
 * EditorLayout.createNewDocument 模板注入契约测试 —— FIX-0.1.24
 *
 * 背景：
 *   SmartTemplate.vue 接收 use-template 事件时会把模板对象传给 EditorLayout，
 *   EditorLayout.createNewDocument 必须把模板的 content 写入编辑器并设置
 *   documentType；否则冷启动模板只是个空架子，用户看到的就是一张卡片。
 *
 * 与 ai-intent.spec 同样的策略：静态契约测试，避免 mount 整个 EditorLayout
 * （依赖 15+ store / composable / 子组件）。
 *
 * 如果未来要 mount 测试，建议抽出 createNewDocument 到独立 composable。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LAYOUT_PATH = resolve(__dirname, '../../layouts/EditorLayout.vue')

function readLayout() {
  return readFileSync(LAYOUT_PATH, 'utf8')
}

describe('EditorLayout — createNewDocument 模板注入契约 (FIX-0.1.24)', () => {
  it('createNewDocument 接受 template 参数（默认 null，无模板时仍可调用）', () => {
    const src = readLayout()
    expect(src).toMatch(/function\s+createNewDocument\s*\(\s*template\s*=\s*null\s*\)/)
  })

  it('当 template 携带 documentType 时，必须在 nextTick 之外立刻调用 setSessionDocumentType', () => {
    const src = readLayout()
    // 关键 invariant：documentType 必须在 appStore.openDocument 之后立即设置，
    // 不能放到 nextTick 内，否则 onEditorChange 在第一次 loadMarkdown 触发时
    // 会用错误的 session documentType 记录保存历史。
    const createBlock = src.match(/function\s+createNewDocument\s*\([\s\S]*?\n\}/)?.[0] || ''
    expect(createBlock).toMatch(
      /habitsStore\.setSessionDocumentType\(\s*template\?\.documentType\s*\|\|\s*''\s*\)/,
    )
    // 必须在第一个 nextTick 之前出现
    const setSessionIdx = createBlock.indexOf('habitsStore.setSessionDocumentType')
    const firstNextTickIdx = createBlock.indexOf('nextTick(')
    expect(setSessionIdx).toBeGreaterThan(-1)
    expect(firstNextTickIdx).toBeGreaterThan(-1)
    expect(setSessionIdx, 'setSessionDocumentType 必须早于 nextTick').toBeLessThan(firstNextTickIdx)
  })

  it('当 template 携带 content 时，必须 loadMarkdown(content)', () => {
    const src = readLayout()
    expect(src).toMatch(/const\s+initialContent\s*=\s*template\?\.content\s*\?\?\s*['"]['"]/)
    expect(src).toMatch(/editorRef\.value\?\.loadMarkdown\(\s*initialContent\s*\)/)
  })

  it('editorOutput.markdown 必须同步为 initialContent（保证 getMarkdown() 在 onUpdate 之前可用）', () => {
    const src = readLayout()
    // editorOutput 必须在 nextTick 内被设置为 initialContent，避免 onEditorChange
    // 第一次触发时拿到的 markdown 为空字符串。
    const createBlock = src.match(/function\s+createNewDocument\s*\([\s\S]*?\n\}/)?.[0] || ''
    expect(createBlock).toMatch(
      /editorOutput\.value\s*=\s*\{\s*html:\s*['"]['"]\s*,\s*json:\s*null\s*,\s*markdown:\s*initialContent\s*\}/,
    )
  })

  it('当 template 携带 format 时，必须在第二个 nextTick 中应用（避免与 loadMarkdown 的 onUpdate 抢同一 tick）', () => {
    const src = readLayout()
    // 关键 invariant：applyFormat 不能与 loadMarkdown 在同一 tick 触发，
    // 否则 Tiptap 文档正在更新时强行 setMark 会让光标落在非法位置。
    const createBlock = src.match(/function\s+createNewDocument\s*\([\s\S]*?\n\}/)?.[0] || ''
    expect(createBlock).toMatch(/nextTick\(\(\)\s*=>\s*applyFormat\(template\.format\)\)/)
  })

  it('createNewDocument 不应破坏无模板分支（template=null 时仍正确打开空白文档）', () => {
    const src = readLayout()
    const createBlock = src.match(/function\s+createNewDocument\s*\([\s\S]*?\n\}/)?.[0] || ''
    // 防御性写法：documentType / format 分支都用了 optional chaining，
    // 模板为空时这些分支不应进入，loadMarkdown 应收到空字符串而非 undefined
    expect(createBlock).toMatch(/template\?\.documentType/)
    expect(createBlock).toMatch(/template\?\.format/)
    expect(createBlock).toMatch(/template\?\.content\s*\?\?\s*['"]['"]/)
  })
})

describe('EditorLayout — handleTemplateCreate 把 use-template 事件桥接到 createNewDocument', () => {
  it('handleTemplateCreate 必须存在并调用 createNewDocument(template)', () => {
    const src = readLayout()
    expect(src).toMatch(/function\s+handleTemplateCreate\s*\(\s*template\s*\)/)
    expect(src).toMatch(/handleTemplateCreate\([^)]*\)\s*\{[\s\S]*?createNewDocument\(template\)/)
  })

  it('EmptyState 的 use-template 事件必须绑定到 handleTemplateCreate', () => {
    const src = readLayout()
    // 模板 / script 中必须包含 @use-template="handleTemplateCreate"
    expect(src).toMatch(/@use-template="handleTemplateCreate"/)
  })
})