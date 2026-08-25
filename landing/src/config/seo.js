/**
 * WPX 营销站 · SEO / 社交分享元数据
 *
 * 由 vite-plugin-html 在构建时注入到 index.html
 * 路由切换时由 src/router/index.js 的 applyRouteMetaToDom 同步更新（仅客户端）
 *
 * 修改后请重新 `npm run build` 即可生效
 */

export const siteConfig = {
  // 基础站点信息
  name: 'WPX',
  shortName: 'WPX',
  // 战略定位（v1.0 · 2026-08）：WPX 的真正护城河是「本地 / 多窗口 / 永久免费 / 64 指令 / Skills 一体化」，AI 仅作为常驻助手出现，不作主标题
  title: 'WPX - 永久免费的桌面写作工具 | 多窗口 / 64 条本地指令 / 完全离线',
  description:
    '永久免费的桌面写作工具：多窗口独立编辑、64 条本地斜杠指令、Markdown / PDF / Word / Excel 互转、内置 32+ Skills、可选 Hermes Agent 本地智能体、SKILL.md 技能互通、四层本地 AI 记忆、100+ 开源字体、PDF 离线 OCR。本地优先，完全离线可用。',
  keywords: [
    'WPX',
    '免费文档编辑器',
    '桌面写作工具',
    '多窗口编辑器',
    '多窗口独立编辑器',
    '永久免费编辑器',
    '本地离线编辑器',
    'Markdown',
    'PDF',
    '开源',
    'Electron',
    // ===== v0.1.16+ 真实差异化能力 =====
    '本地指令',
    '斜杠指令',
    'Skills市场',
    '虚拟纸张',
    'HTML源码编辑',
    'PDF离线OCR',
    'Markdown转PDF',
    '演示文稿生成器',
    'PPT生成',
    '教师课件',
    'Excel导入',
    'WPS表格导入',
    'xls转表格',
    'xlsx转表格',
    // ===== v0.1.17/18 新增 =====
    '资料库管理',
    '自定义保存路径',
    '窗口独立管理',
    '新建窗口',
    '关闭窗口',
    // ===== v0.1.26 Hermes / 记忆 =====
    'Hermes Agent',
    'SKILL.md',
    '本地AI记忆',
    '可选智能体',
    // ===== V1.1 完全免费模式 =====
    '完全免费编辑器',
    '无Token文档编辑器',
    'WPS替代',
    'jcode高性能',
    '100+开源字体',
    // ===== AI 仅作辅助关键词（最后位、不作主卖点）=====
    'AI文档编辑器',
    'AI写作'
  ],
  author: 'WPX Team',
  // 默认站点 URL：构建时会被 env.VITE_SITE_URL 覆盖
  // 生产部署：prowpx.com；本地开发：localhost:5174
  url: 'https://prowpx.com',
  // OG 图片：使用 SVG（矢量，体积小，所有平台支持）
  ogImage: '/og-image.svg',
  ogImagePng: '/og-image.svg', // 兼容旧客户端
  ogImageWidth: '1200',
  ogImageHeight: '630',
  ogImageAlt: 'WPX - 永久免费的桌面写作工具，多窗口 / 64 条本地指令 · v0.1.44',
  twitterHandle: '@wpx_app',
  locale: 'zh_CN',
  themeColor: '#4F46E5',
  // 站点图标 / PWA
  favicon: '/favicon.svg',
  // 发布者 / 验证（部署前替换为真实值）
  fbAppId: '',
  googleSiteVerification: ''
}

// Twitter / OG 派生字段（自动生成，避免重复维护）
export function buildSocialTags(cfg = siteConfig) {
  return {
    // ===== OG (Open Graph · Facebook / LinkedIn / Discord / Telegram) =====
    'og:title': cfg.title,
    'og:description': cfg.description,
    'og:image': cfg.url + cfg.ogImage,
    'og:image:secure_url': cfg.url + cfg.ogImage,
    'og:image:alt': cfg.ogImageAlt,
    'og:image:type': 'image/svg+xml',
    'og:image:width': cfg.ogImageWidth,
    'og:image:height': cfg.ogImageHeight,
    'og:type': 'website',
    'og:url': cfg.url,
    'og:site_name': cfg.name,
    'og:locale': cfg.locale,
    'og:locale:alternate': 'en_US',
    // 'og:updated_time': cfg.updatedTime, // 由 prerender 注入
    ...(cfg.fbAppId ? { 'fb:app_id': cfg.fbAppId } : {}),

    // ===== Twitter Card =====
    'twitter:card': 'summary_large_image',
    'twitter:title': cfg.title,
    'twitter:description': cfg.description,
    'twitter:image': cfg.url + cfg.ogImage,
    'twitter:image:alt': cfg.ogImageAlt,
    'twitter:site': cfg.twitterHandle,
    'twitter:creator': cfg.twitterHandle,
    'twitter:domain': cfg.url.replace(/^https?:\/\//, ''),
    'twitter:url': cfg.url
  }
}

// 站点级 <meta> 标签（非社交），可在 vite.config.js 注入
export const siteMeta = {
  // 应用类别（iOS / Android Web Clip）
  'apple-mobile-web-app-capable': 'yes',
  // Google 站长工具验证（部署前替换）
  ...(siteConfig.googleSiteVerification
    ? { 'google-site-verification': siteConfig.googleSiteVerification }
    : {})
}

export default siteConfig
