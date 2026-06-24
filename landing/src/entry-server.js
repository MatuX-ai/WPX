/**
 * entry-server.js · Node SSR 入口
 *
 * render(url) → { html, meta }
 *   - url: 请求路径（包含 query/hash）
 *   - html: 渲染出的 HTML 字符串（用于嵌入 index.html 模板）
 *   - meta: 当前路由的 meta（title/description/keywords/...），供模板替换
 *
 * 注意：
 *  - 每个路由独立创建一个 app + router 实例（避免状态污染）
 *  - await router.push(url) → 让匹配路由被解析（lazy 组件被触发）
 *  - await router.isReady()  → 等 lazy chunk 完成
 *  - renderToString 异步触发组件树渲染
 */

import { renderToString } from 'vue/server-renderer'
import { createApp } from './main.js'

export async function render(url) {
  // SSR 模式下：把请求 URL 作为初始路径
  const { app, router } = createApp({ ssr: true, initialUrl: url })

  try {
    // 把请求 URL push 到路由器，让匹配组件完成懒加载解析
    await router.push(url)
    await router.isReady()

    // 取当前路由的 meta（用于模板替换）
    const route = router.currentRoute.value
    const meta = route?.meta || {}

    const html = await renderToString(app)
    return { html, meta }
  } catch (err) {
    console.error('[entry-server] render error for', url, err)
    throw err
  }
}
