/** WPX 关于页静态信息 */

export const APP_NAME = 'WPX'
export const APP_VERSION = '0.1.0'
export const APP_TAGLINE = 'AI 智能文档编辑器'

export const WEBSITE_URL = 'https://wpx.app'
export const FEEDBACK_URL = 'mailto:dev@wpx.app?subject=WPX%20用户反馈'

export const SEVEN_ZIP_DECLARATION =
  'WPX 使用 7-Zip 项目提供的 7za 命令行工具处理压缩与解压缩。7-Zip 为 GNU LGPL 许可证下的自由软件；完整许可证文本可通过下方按钮查看。'

/** 第三方依赖简要致谢 */
export const THIRD_PARTY_ACKNOWLEDGMENTS = [
  { name: 'Vue 3', role: '用户界面框架' },
  { name: 'Electron', role: '桌面运行时' },
  { name: 'TipTap', role: '富文本编辑器' },
  { name: 'Vercel AI SDK', role: 'AI 对话与流式输出' },
  { name: 'LowDB', role: '本地偏好与记忆存储' },
  { name: 'ChromaDB', role: '资料库向量检索（可选）' },
  { name: 'FastAPI', role: '本地微服务（导出、资料库等）' },
  { name: '7-Zip / 7za', role: '压缩与解压缩' },
  { name: 'Lucide Icons', role: '界面图标' },
]

export function getCopyrightText(year = new Date().getFullYear()) {
  return `© ${year} WPX Team. All rights reserved.`
}
