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
  title: 'WPX - 免费AI文档编辑器，告别WPS付费烦恼',
  description:
    '纯净、免费、开源的AI文档编辑器。Markdown、PDF互转、AI写作、图片处理。',
  keywords: [
    'WPX',
    'AI文档编辑器',
    '免费文档编辑器',
    'Markdown',
    'PDF',
    'AI写作',
    '图片处理',
    'WPS替代',
    '开源',
    'Electron'
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
  ogImageAlt: 'WPX - 免费 AI 文档编辑器，让写作更自由',
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
