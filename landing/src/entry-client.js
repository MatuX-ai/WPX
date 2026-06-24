/**
 * entry-client.js · 浏览器入口
 * - 使用 hydrate（注意：我们的 SSR 输出是整页 HTML，客户端需要接管）
 * - 我们采用"半 SSG"策略：SSR 只负责预渲染首屏 HTML，
 *   客户端 hydrate 时再装载 Vue，从而支持 SPA 路由跳转
 */

import { createApp } from './main.js'

const { app, router } = createApp({ ssr: false })

router.isReady().then(() => {
  app.mount('#app', true)
})

// Service Worker 禁用：营销站无需离线，PWA 是另一套体系
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // 预留：未来启用 PWA 时再注册
}
