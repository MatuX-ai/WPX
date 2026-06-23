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

/** 图片编辑器浮窗 */
export const IMAGE_EDITOR_WINDOW = {
  defaultW: 800,
  defaultH: 600,
  zIndex: 1002,
}
