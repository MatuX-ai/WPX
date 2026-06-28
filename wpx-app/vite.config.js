import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { dirname } from 'node:path'

// 显式把 Vite root 锁在 vite.config.js 所在的 wpx-app 目录。
// 防御 start-dev.cjs 在某些 shell/sandbox 下 cwd 被改写为 WPX 项目根
// 进而误加载 'i:\\WPX\\index.html' (营销网站预构建产物)的问题。
const __dirname = dirname(fileURLToPath(import.meta.url))

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
    const copilotkitPort = env.COPILOTKIT_PORT || process.env.COPILOTKIT_PORT || '3006'
    // jcode 集成：local-server 端口在 dev 模式下被固定为 3007
    // （详见 electron/run-dev.js · WPX_LOCAL_SERVER_PORT）
    const localServerPort =
      env.WPX_LOCAL_SERVER_PORT || process.env.WPX_LOCAL_SERVER_PORT || '3007'

  // 是否启用预渲染
  // - 显式 WPX_PRERENDER=0 关闭
  // - 显式 WPX_PRERENDER=1 启用
  // - 默认：仅在 web build（VITE_TARGET=web）下启用
  const target = env.VITE_TARGET || ''
  const explicit = process.env.WPX_PRERENDER
  const prerenderEnabled =
    explicit === '1' || (explicit !== '0' && target === 'web')

  return {
    root: __dirname,
    // Electron 生产环境通过 loadFile 加载，资源路径须为相对路径
    // Web 部署（VITE_TARGET=web）改为绝对路径，便于 CDN 缓存与 SEO
    base: target === 'web' ? '/' : './',
    plugins: [
      vue(),
      tailwindcss(),
      electronBuildHtmlPlugin(),
      prerenderHookPlugin({ enabled: prerenderEnabled }),
    ],
    optimizeDeps: {
      // `extend` is a CJS deep-merge utility pulled in transitively by
      // CopilotKit (gaxios) and tui-image-editor (request).  We *do* want
      // Vite/esbuild to pre-bundle it so the CJS module.exports becomes
      // a proper ESM default export.  Listing it in `include` makes the
      // alias's shim see the pre-bundled module (which already has a
      // `default` export) instead of the raw `node_modules/extend/index.js`
      // source that browsers would otherwise fail to parse.
      //
      // Likewise, `micromark` and its transitive CJS deps (`debug`,
      // `ms`, `decode-named-character-reference`, etc.) reach into
      // sub-paths such as `debug/src/browser.js`.  When Vite is asked
      // to load a sub-path on a CJS package directly, the browser sees
      // the raw CJS source and throws
      //   "does not provide an export named 'default'".
      // Pre-bundling the top-level packages routes those sub-paths
      // through esbuild's CJS→ESM interop.
      include: [
        '@copilotkit/vue',
        '@copilotkit/vue/v2',
        // CodeMirror 6 源码编辑器：HTML 源码编辑模式依赖
        // 显式声明确保 Vite/esbuild 在 dev 启动时把它们预打包为 ESM，
        // 避免浏览器原生 ESM 解析子路径时失败。
        'codemirror',
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lang-html',
        '@codemirror/search',
        '@lezer/highlight',
        '@lezer/lr',
        // 显式声明 echarts，让 Vite/esbuild 在 dev 启动时把它预打包为 ESM。
        // ChartSlide.vue 通过 `import('echarts')` 动态加载，Vite 8 的 import-analysis
        // 在编译期无法解析到该包时会把 'echarts' 编译为裸 specifier，浏览器原生 ESM
        // 会抛 `Failed to resolve module specifier 'echarts'`。预打包后浏览器拿到的是
        // `/@id/echarts` 这种已被 Vite 解析过的 URL，可以正常加载。
        'echarts',
        'extend',
        'micromark',
        'micromark-util-character',
        'micromark-util-symbol',
        'micromark-util-chunked',
        'micromark-util-classify-character',
        'micromark-util-resolve-all',
        'micromark-util-decode-numeric-character-reference',
        'micromark-util-decode-string',
        'micromark-util-normalize-identifier',
        'micromark-util-subtokenize',
        'micromark-util-combine-extensions',
        'micromark-factory-destination',
        'micromark-factory-label',
        'micromark-factory-space',
        'micromark-factory-title',
        'micromark-factory-whitespace',
        'micromark-core-commonmark',
        'decode-named-character-reference',
        'debug',
        'ms',
        'gaxios',
        'https-proxy-agent',
        'agent-base',
        'readable-stream',
        'string_decoder',
      ],
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 800,
      cssCodeSplit: true,
      target: 'es2020',
      // Rolldown/Vite 8.0.14+ 会破坏 Vue init_* 辅助函数；wpx-app 锁定 vite@8.0.10
      //
      // [FIX-WHITE-SCREEN] 不要把 @copilotkit/* 标记为 external。
      // `external` 指示 Rollup 在产物中保留 bare specifier（如 'import "@copilotkit/vue/v2"'），
      // 由运行时环境负责解析。但浏览器原生 ESM 与 Electron 渲染进程均不支持 bare
      // specifier——加载时会抛 "Failed to resolve module specifier" 并阻断 Vue mount，
      // 表现为白屏。CopilotKit 1.61.1 是纯 ESM 包（package.json "type": "module"），
      // `./v2` 子路径已通过 exports 字段导出 ./dist/v2/index.mjs，Vite/Rollup 可直接打包。
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

            // 编辑器核心（Tiptap / ProseMirror / CodeMirror）
            if (
              id.includes('node_modules/@tiptap') ||
              id.includes('node_modules/prosemirror') ||
              id.includes('node_modules/markdown-it') ||
              id.includes('node_modules/codemirror') ||
              id.includes('node_modules/@codemirror') ||
              id.includes('node_modules/@lezer')
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

            // CopilotKit（前后端 SDK + zod）
            if (
              id.includes('node_modules/@copilotkit') ||
              id.includes('node_modules/zod/')
            ) {
              return 'vendor-copilotkit'
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
        {
          // The `extend` CJS package is pulled in transitively by CopilotKit
          // (gaxios) and tui-image-editor (request).  Vite/esbuild surfaces
          // the whole module.exports object as `default`, breaking
          // `import extend from 'extend'` consumers with
          // "extend is not a function".  Route the bare import through a
          // shim that unwraps the real function.
          find: /^extend$/,
          replacement: fileURLToPath(
            new URL('./src/shims/extend.js', import.meta.url),
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
      // 同时听 IPv4 (127.0.0.1) + IPv6 ([::1])，避免 Electron / Chrome 默认 IPv4 first
      // 在 Windows 上解析 localhost 时偶发只走 IPv4 失败
      host: '127.0.0.1',
      strictPort: true,
      proxy: {
        // 导出服务与本地 API 在 Electron dev 模式下统一跑在 local-server
        // （端口由 WPX_LOCAL_SERVER_PORT 控制，默认 3007）。
        // 历史上 '/api/export' 硬编码 3001（wpx-app/src/server/export-service.js
        // 独立运行时端口），但 Electron dev 模式该进程不再启动，导致 fetch 拿到
        // ECONNREFUSED / Failed to fetch。改为 dynamic port 与 localServer 保持一致。
        '/api/export': {
          target: `http://localhost:${localServerPort}`,
          changeOrigin: true,
        },
        '/api/health': {
          target: `http://localhost:${localServerPort}`,
          changeOrigin: true,
        },
        '/api/remove-bg': 'http://localhost:3002',
        '/api/knowledge': `http://localhost:${knowledgePort}`,
        '/api/library': 'http://localhost:3004',
        '/api/ai': 'http://localhost:3005',
        '/api/ck': `http://localhost:${copilotkitPort}`,
        // jcode 适配层（jcode-routes）位于 local-server 进程内
        '/api/jcode': {
          target: `http://localhost:${localServerPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
