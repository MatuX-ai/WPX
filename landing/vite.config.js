import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createHtmlPlugin } from 'vite-plugin-html'
import compression from 'vite-plugin-compression'
import { siteConfig, buildSocialTags } from './src/config/seo.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProd = mode === 'production'

  // 动态站点 URL：本地用 dev 服务器，prod 用配置
  const siteUrl =
    env.VITE_SITE_URL || (isProd ? siteConfig.url : 'http://localhost:5174')
  const social = buildSocialTags({ ...siteConfig, url: siteUrl })

  return {
    plugins: [
      vue(),
      createHtmlPlugin({
        // 入口模板（支持 EJS）
        template: 'index.html',

        // 在 head 中注入的 meta / link
        inject: {
          data: {
            // 基础 meta
            title: siteConfig.title,
            description: siteConfig.description,
            keywords: siteConfig.keywords.join(', '),
            author: siteConfig.author,
            themeColor: siteConfig.themeColor,
            favicon: siteConfig.favicon,
            siteUrl,
            ogImage: siteUrl + siteConfig.ogImage,
            // 社交分享标签（数组形式）
            // - og:* 用 property
            // - twitter:* 用 name
            metaSocial: Object.entries(social).map(([key, value]) => ({
              key,
              value,
              type: key.startsWith('og:') ? 'property' : 'name'
            })),
            // 额外：apple-touch / 主题色 / canonical
            extra: [
              { name: 'application-name', value: siteConfig.shortName },
              { name: 'apple-mobile-web-app-title', value: siteConfig.shortName },
              { name: 'apple-mobile-web-app-capable', value: 'yes' },
              { name: 'apple-mobile-web-app-status-bar-style', value: 'default' },
              { name: 'mobile-web-app-capable', value: 'yes' },
              { name: 'format-detection', value: 'telephone=no' },
              { name: 'msapplication-TileColor', value: siteConfig.themeColor },
              {
                name: 'theme-color',
                value: siteConfig.themeColor,
                media: '(prefers-color-scheme: light)'
              },
              { name: 'color-scheme', value: 'light' },
              { rel: 'canonical', href: siteUrl },
              {
                rel: 'image_src',
                href: siteUrl + siteConfig.ogImage
              }
            ]
          }
        },

        // 压缩 HTML
        minify: isProd
      }),

      // ========== 静态资源压缩：gzip + brotli ==========
      isProd &&
        compression({
          algorithm: 'gzip',
          ext: '.gz',
          threshold: 1024,
          deleteOriginFile: false
        }),
      isProd &&
        compression({
          algorithm: 'brotliCompress',
          ext: '.br',
          threshold: 1024,
          deleteOriginFile: false
        })
    ],

    // ========== SSR 配置 ==========
    ssr: {
      // 让 vue/vue-router 在 SSR 时被 Vite 处理（而不是 require 原生模块）
      noExternal: ['vue', 'vue-router']
    },

    build: {
      // 客户端入口改为 entry-client
      rollupOptions: {
        input: {
          // 默认客户端入口（用于模板）
          index: 'index.html'
        }
      },
      // 启用 CSS 代码分割：每个 lazy chunk 携带自己的 CSS
      cssCodeSplit: true,
      // 启用资源内联阈值（小于 4KB 自动 inline 为 base64）
      assetsInlineLimit: 4096,
      // 块大小警告阈值
      chunkSizeWarningLimit: 600
    },

    server: {
      port: 5174,
      host: '127.0.0.1',
      open: false
    },
    preview: {
      port: 4174
    }
  }
})
