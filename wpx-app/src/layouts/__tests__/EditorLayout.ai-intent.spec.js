/**
 * EditorLayout.useLaunchDocument.onAiIntent 契约测试 —— FIX-2026-08-20
 *
 * 背景：
 *   【新建文档 → AI 帮我写】会让新窗口带 ?mode=ai&intent=... 启动；
 *   useLaunchDocument 检测到 mode==='ai' 时会回调 onAiIntent(intent)。
 *
 *   此前的实现漏掉了 onAiIntent 回调，导致：
 *     - 用户点 AI 帮我写后只看到空白文档
 *     - AI 助手完全没有反应
 *     - 未配置大模型时也没有任何提示
 *
 *   本测试用静态契约方式确保：
 *     1. useLaunchDocument 调用中存在 onAiIntent 字段
 *     2. onAiIntent 回调必须写入 editorStore.requestAiIntent
 *     3. onAiIntent 必须主动打开 AI 助手浮窗（overlay.openAiPanel）
 *     4. 新增 editorStore.pendingAiIntent 桥接字段
 *
 * 策略：与 create-new-document.spec 一样，避免 mount 整个 EditorLayout，
 * 直接读源文件做正则断言，避免 mount 巨大依赖树。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LAYOUT_PATH = resolve(__dirname, '../../layouts/EditorLayout.vue')
const EDITOR_STORE_PATH = resolve(__dirname, '../../stores/editor.js')

function readLayout() {
  return readFileSync(LAYOUT_PATH, 'utf8')
}

function readEditorStore() {
  return readFileSync(EDITOR_STORE_PATH, 'utf8')
}

describe('EditorLayout — useLaunchDocument.onAiIntent 契约 (FIX-2026-08-20)', () => {
  it('useLaunchDocument 调用必须包含 onAiIntent 字段', () => {
    const src = readLayout()
    // 取出 useLaunchDocument({ ... }) 的整段对象字面量
    const useLaunchBlock = src.match(/useLaunchDocument\s*\(\s*\{[\s\S]*?\n\s*\}\s*\)/)?.[0] || ''
    expect(useLaunchBlock).toMatch(/onAiIntent\s*:/)
  })

  it('onAiIntent 回调必须存在且调用 editorStore.requestAiIntent(intent)', () => {
    const src = readLayout()
    // 抓 onAiIntent: (intent) => { ... } 整段回调
    const callback = src.match(/onAiIntent\s*:\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\s*\},?\s*\n\s*onTemplate/)?.[0]
    expect(callback, 'onAiIntent 回调必须存在').toBeTruthy()
    expect(callback).toMatch(/editorStore\.requestAiIntent\s*\(/)
    // 必须把 trim 后的 intent 传进去，避免空白字符串污染
    expect(callback).toMatch(/intent\.trim\s*\(\s*\)/)
  })

  it('onAiIntent 必须主动打开 AI 助手浮窗，避免静默失败', () => {
    const src = readLayout()
    const callback = src.match(/onAiIntent\s*:\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\s*\},?\s*\n\s*onTemplate/)?.[0]
    expect(callback).toMatch(/overlay\.openAiPanel\s*\(/)
  })
})

describe('editorStore — pendingAiIntent 桥接字段 (FIX-2026-08-20)', () => {
  it('editorStore 必须暴露 pendingAiIntent ref', () => {
    const src = readEditorStore()
    expect(src).toMatch(/const\s+pendingAiIntent\s*=\s*ref\s*\(/)
  })

  it('editorStore 必须暴露 requestAiIntent / clearPendingAiIntent 方法', () => {
    const src = readEditorStore()
    expect(src).toMatch(/function\s+requestAiIntent\s*\(/)
    expect(src).toMatch(/function\s+clearPendingAiIntent\s*\(/)
  })

  it('requestAiIntent 必须返回 ref 字段中导出', () => {
    const src = readEditorStore()
    // 校验 store return 中包含这两个方法（与 pendingAiIntent ref）
    const returnBlock = src.match(/return\s*\{[\s\S]*?\n\s*\}\s*\)\s*$/)?.[0] || ''
    expect(returnBlock).toMatch(/pendingAiIntent/)
    expect(returnBlock).toMatch(/requestAiIntent/)
    expect(returnBlock).toMatch(/clearPendingAiIntent/)
  })
})