import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/** file:// 下 crossorigin 会导致模块脚本 CORS 失败，Electron 打包后按钮/事件失效 */
function electronBuildHtmlPlugin() {
  return {
    name: 'wpx-electron-html',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin/g, '')
    },
  }
}

/**
 * 静态预渲染钩子：
 *  构建完成后调用 scripts/prerender.mjs，对可枚举路由生成 SEO 友好的 HTML 副本。
 *  通过 WPX_PRERENDER=0 显式关闭；Electron 桌面构建默认关闭。
 */
function prerenderHookPlugin({ enabled }) {
  return {
    name: 'wpx-prerender-hook',
    apply: 'build',
    async closeBundle() {
      if (!enabled) return
      const { spawn } = await import('node:child_process')
      const script = fileURLToPath(new URL('./scripts/prerender.mjs', import.meta.url))
      const child = spawn(process.execPath, [script], {
        stdio: 'inherit',
        env: process.env,
      })
      await new Promise((resolveRun, rejectRun) => {
        child.on('exit', (code) => {
          if (code === 0) resolveRun()
          else rejectRun(new Error(`prerender exited with code ${code}`))
        })
        child.on('error', rejectRun)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const knowledgePort = env.KNOWLEDGE_SERVICE_PORT || process.env.KNOWLEDGE_SERVICE_PORT || '3003'

  // 是否启用预渲染
  // - 显式 WPX_PRERENDER=0 关闭
  // - 显式 WPX_PRERENDER=1 启用
  // - 默认：仅在 web build（VITE_TARGET=web）下启用
  const target = env.VITE_TARGET || ''
  const explicit = process.env.WPX_PRERENDER
  const prerenderEnabled =
    explicit === '1' || (explicit !== '0' && target === 'web')

  return {
    // Electron 生产环境通过 loadFile 加载，资源路径须为相对路径
    // Web 部署（VITE_TARGET=web）改为绝对路径，便于 CDN 缓存与 SEO
    base: target === 'web' ? '/' : './',
    plugins: [
      vue(),
      tailwindcss(),
      electronBuildHtmlPlugin(),
      prerenderHookPlugin({ enabled: prerenderEnabled }),
    ],
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 800,
      cssCodeSplit: true,
      target: 'es2020',
      // Rolldown/Vite 8.0.14+ 会破坏 Vue init_* 辅助函数；wpx-app 锁定 vite@8.0.10
      rollupOptions: {
        output: {
          // 手动分包：把大型第三方依赖拆分为独立 chunk，缩短首屏加载时间
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined

            // Vue 生态
            if (
              id.includes('node_modules/vue') ||
              id.includes('node_modules/@vue') ||
              id.includes('node_modules/vue-router') ||
              id.includes('node_modules/pinia')
            ) {
              return 'vendor-vue'
            }

            // 编辑器核心（Tiptap / ProseMirror）
            if (
              id.includes('node_modules/@tiptap') ||
              id.includes('node_modules/prosemirror') ||
              id.includes('node_modules/markdown-it')
            ) {
              return 'vendor-editor'
            }

            // AI / 大模型 SDK
            if (
              id.includes('node_modules/ai/') ||
              id.includes('node_modules/@ai-sdk')
            ) {
              return 'vendor-ai'
            }

            // UI 工具（floating-ui / focus-trap / lucide / vueuse）
            if (
              id.includes('node_modules/@floating-ui') ||
              id.includes('node_modules/focus-trap') ||
              id.includes('node_modules/@lucide') ||
              id.includes('node_modules/@vueuse') ||
              id.includes('node_modules/vue3-draggable-resizable')
            ) {
              return 'vendor-ui'
            }

            // 图像处理 / 工具
            if (
              id.includes('node_modules/tui-image-editor') ||
              id.includes('node_modules/qrcode') ||
              id.includes('node_modules/cors') ||
              id.includes('node_modules/express') ||
              id.includes('node_modules/multer')
            ) {
              return 'vendor-utils'
            }
            return undefined
          },
        },
      },
    },
    esbuild: {
      legalComments: 'none',
    },
    resolve: {
      alias: [
        // Route the upstream CJS package through a local ESM shim so the
        // pre-bundled default export is unwrapped before reaching Vue.
        // Anchored regex so sub-path imports inside the shim (e.g.
        // `vue3-draggable-resizable/src/index.js`) are left intact and the
        // bare import does not redirect to itself.
        {
          find: /^vue3-draggable-resizable$/,
          replacement: fileURLToPath(
            new URL('./src/shims/vue3-draggable-resizable.js', import.meta.url),
          ),
        },
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      ],
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.{test,spec}.{js,ts}'],
      css: true,
    },
    server: {
      proxy: {
        '/api/export': 'http://localhost:3001',
        '/api/health': 'http://localhost:3001',
        '/api/remove-bg': 'http://localhost:3002',
        '/api/knowledge': `http://localhost:${knowledgePort}`,
        '/api/library': 'http://localhost:3004',
        '/api/ai': 'http://localhost:3005',
      },
    },
  }
})
