/**
 * 浮动窗口规范常量（WPX 桌面端 UI/UX 设计规范 V1.0）
 * @see docs/WPX桌面端 UIUX 设计规范 V1.0.md
 */

export const FLOATING_WINDOW_ANIMATION = {
  enterDurationMs: 200,
  leaveDurationMs: 150,
  enterEasing: 'ease-out',
  leaveEasing: 'ease-in',
  enterScale: 0.3,
}

/** 图片编辑器弹出动效 */
export const IMAGE_EDITOR_ANIMATION = {
  durationMs: 250,
  easing: 'ease-out',
  enterScale: 0.8,
}

/** AI 助手头像（固定入口） */
export const AI_AVATAR = {
  size: 56,
  marginRight: 20,
  marginBottom: 20,
  zIndex: 1000,
  hoverScale: 1.1,
  shadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
  brandColor: '#7c3aed',
}

/** AI 对话窗 */
export const AI_CHAT_WINDOW = {
  defaultW: 400,
  defaultH: 500,
  minW: 300,
  minH: 300,
  zIndex: 1001,
  marginRight: 20,
  marginBottom: 20,
  avatarGap: 12,
  borderRadius: 16,
  shadow: '0 12px 40px rgba(15, 23, 42, 0.18)',
  headerHeight: 44,
  resizeHandles: ['mr', 'br', 'bm'],
}

/**
 * AI 对话窗贴边（docked）模式参数。
 * docked 状态下浮窗不再作为 fixed 浮窗渲染，而是被嵌入到 EditorLayout
 * 右侧栏作为 inline panel 渲染（IDE 风格）。
 */
export const AI_CHAT_DOCKED = {
  /** 默认右栏宽度（与浮窗 defaultW 保持一致） */
  defaultW: 400,
  /** 窄屏（isCompactWidth）下右栏宽度 */
  compactW: 320,
  /** 右栏最小宽度（用户可拖动调整时使用） */
  minW: 280,
  /** 右栏最大宽度（用户可拖动调整时使用） */
  maxW: 720,
  /** 极窄屏阈值：低于此宽度不允许 docked 模式 */
  minViewportWidth: 720,
  /**
   * 键盘箭头调整宽度的步长（px）。按住 Shift 时按此值 ×4 调整。
   */
  keyboardStep: 16,
  /**
   * 拖拽 / 调整后允许的吸附宽度。拖拽结束后若距离该值 ≤ snapThreshold，
   * 则自动吸附到该值（便于用户对齐默认宽度）。
   */
  snapPoints: [320, 400, 480, 560],
  snapThreshold: 12,
}

/** 图片编辑器浮窗 */
export const IMAGE_EDITOR_WINDOW = {
  defaultW: 800,
  defaultH: 600,
  zIndex: 1002,
}
