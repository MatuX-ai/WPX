/**
 * EditorLayout 右栏 resizer 集成契约测试
 *
 * 为什么是静态测试而不是 mount 测试？
 * - EditorLayout 依赖 15+ store / composable / 子组件，完整 mount 的
 *   stub 工作量极大且脆弱（任何子组件重构都会破坏）。
 * - 真实的 resize 行为（拖拽 / 键盘 / clamp / snap）已在
 *   useDockPanelResize.spec.js 中充分覆盖。
 * - 本测试只验证 EditorLayout 模板 / 脚本中包含必需的 resizer 契约，
 *   防止后续重构无意中移除 resizer 或破坏 ARIA。
 *
 * 如果未来要加 mount 测试，建议抽出 `<DockPanelResizer>` 子组件单独测。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LAYOUT_PATH = resolve(__dirname, '../../layouts/EditorLayout.vue')
const RESIZE_COMPOSABLE_PATH = resolve(
  __dirname,
  '../../composables/useDockPanelResize.js',
)

function readLayout() {
  return readFileSync(LAYOUT_PATH, 'utf8')
}

describe('EditorLayout — 右栏 resizer 集成契约', () => {
  it('script 引入 useDockPanelResize composable', () => {
    const src = readLayout()
    expect(src).toMatch(
      /import\s*\{[^}]*useDockPanelResize[^}]*\}\s*from\s*'@\/composables\/useDockPanelResize'/,
    )
  })

  it('script 创建 aiDockResize 实例并接入 AI_CHAT_DOCKED 参数', () => {
    const src = readLayout()
    expect(src).toMatch(/const\s+aiDockResize\s*=\s*useDockPanelResize\(/)
    expect(src).toMatch(/defaultWidth:\s*AI_CHAT_DOCKED\.defaultW/)
    expect(src).toMatch(/minWidth:\s*AI_CHAT_DOCKED\.minW/)
    expect(src).toMatch(/maxWidth:\s*AI_CHAT_DOCKED\.maxW/)
    expect(src).toMatch(/keyboardStep:\s*AI_CHAT_DOCKED\.keyboardStep/)
  })

  it('aiDockPanelWidth 优先使用 effectiveWidth（customized 时）', () => {
    const src = readLayout()
    expect(src).toMatch(/aiDockResize\.isCustomized\.value/)
    expect(src).toMatch(/aiDockResize\.effectiveWidth\.value/)
  })

  it('template 渲染 resizer 元素（仅在 docked=true 时）', () => {
    const src = readLayout()
    expect(src).toMatch(/<div[^>]*class="editor-layout__ai-dock-resizer"/)
    expect(src).toMatch(/v-if="showAiDockPanel"/)
  })

  it('template 包含 role="separator" + aria-orientation="vertical"', () => {
    const src = readLayout()
    expect(src).toMatch(/role="separator"/)
    expect(src).toMatch(/aria-orientation="vertical"/)
  })

  it('template 暴露 ARIA value 元数据（min/max/now/text）', () => {
    const src = readLayout()
    expect(src).toMatch(/:aria-valuenow="aiDockPanelWidth"/)
    expect(src).toMatch(/:aria-valuemin="AI_CHAT_DOCKED\.minW"/)
    expect(src).toMatch(/:aria-valuemax="AI_CHAT_DOCKED\.maxW"/)
    expect(src).toMatch(/:aria-valuetext=/)
  })

  it('template 包含可聚焦 + 键盘绑定 + 鼠标拖拽绑定', () => {
    const src = readLayout()
    expect(src).toMatch(/tabindex="0"/)
    expect(src).toMatch(/@mousedown="aiDockResize\.startResize"/)
    expect(src).toMatch(/@keydown="aiDockResize\.handleKeydown"/)
  })

  it('template 把 isResizing 状态映射到 resizing 修饰类', () => {
    const src = readLayout()
    expect(src).toMatch(/editor-layout__ai-dock-resizer--resizing/)
    expect(src).toMatch(/aiDockResize\.isResizing\.value/)
  })

  it('CSS 包含 resizer 基础样式（hover/focus/resizing）', () => {
    const src = readLayout()
    expect(src).toMatch(/\.editor-layout__ai-dock-resizer\s*\{/)
    expect(src).toMatch(/\.editor-layout__ai-dock-resizer:hover/)
    expect(src).toMatch(/\.editor-layout__ai-dock-resizer:focus-visible/)
    expect(src).toMatch(/\.editor-layout__ai-dock-resizer--resizing/)
    expect(src).toMatch(/cursor:\s*col-resize/)
    expect(src).toMatch(/user-select:\s*none/)
  })

  it('CSS 包含拖拽视觉指示（::after 中心线）', () => {
    const src = readLayout()
    expect(src).toMatch(/\.editor-layout__ai-dock-resizer::after/)
    expect(src).toMatch(/top:\s*50%/)
    expect(src).toMatch(/left:\s*50%/)
  })

  it('aside 容器通过 CSS 变量接收 aiDockPanelWidth（确保 docked 时宽度生效）', () => {
    const src = readLayout()
    expect(src).toMatch(/--ai-dock-width/)
    expect(src).toMatch(/\$\{aiDockPanelWidth\}px/)
  })
})

describe('AI_CHAT_DOCKED 常量与 useDockPanelResize 字段对齐', () => {
  it('AI_CHAT_DOCKED 包含 useDockPanelResize 所需字段', () => {
    const constantsSrc = readFileSync(
      resolve(__dirname, '../../constants/floatingWindow.js'),
      'utf8',
    )
    const resizeSrc = readFileSync(RESIZE_COMPOSABLE_PATH, 'utf8')

    // 验证 EditorLayout 使用的字段全部存在
    const usedFields = [
      'defaultW',
      'minW',
      'maxW',
      'keyboardStep',
      'snapPoints',
      'snapThreshold',
    ]
    for (const field of usedFields) {
      // 两种存在形式：作为 AI_CHAT_DOCKED 字段 或 在 composable 默认值中
      const inConstants = new RegExp(`${field}\\s*:`).test(constantsSrc.match(/AI_CHAT_DOCKED\s*=\s*\{[\s\S]*?\n\}/)?.[0] || '')
      const inComposable = new RegExp(`${field}\\s*[:=]`).test(resizeSrc)
      const passedInLayout = new RegExp(`${field}\\s*:\\s*AI_CHAT_DOCKED\\.${field}`).test(readLayout())
      // 至少满足一种来源（保证字段被定义或传递）
      expect(inConstants || inComposable || passedInLayout).toBe(true)
    }
  })

  it('compactW 字段仍然存在（保证窄屏逻辑不退化）', () => {
    const constantsSrc = readFileSync(
      resolve(__dirname, '../../constants/floatingWindow.js'),
      'utf8',
    )
    expect(constantsSrc).toMatch(/compactW:\s*320/)
  })

  it('width 关系合理：minW ≤ defaultW ≤ maxW ≤ compactW 关系在常规情况下成立', () => {
    // 断言：minW (280) < compactW (320) < defaultW (400) < maxW (720)
    const constantsSrc = readFileSync(
      resolve(__dirname, '../../constants/floatingWindow.js'),
      'utf8',
    )
    const block = constantsSrc.match(/AI_CHAT_DOCKED\s*=\s*\{[\s\S]*?\n\}/)?.[0] || ''
    const minW = Number(block.match(/minW:\s*(\d+)/)?.[1])
    const maxW = Number(block.match(/maxW:\s*(\d+)/)?.[1])
    const defaultW = Number(block.match(/defaultW:\s*(\d+)/)?.[1])
    const compactW = Number(block.match(/compactW:\s*(\d+)/)?.[1])
    expect(minW).toBeLessThan(compactW)
    expect(compactW).toBeLessThanOrEqual(defaultW)
    expect(defaultW).toBeLessThanOrEqual(maxW)
  })
})