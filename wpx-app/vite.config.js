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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const knowledgePort = env.KNOWLEDGE_SERVICE_PORT || process.env.KNOWLEDGE_SERVICE_PORT || '3003'

  return {
    // Electron 生产环境通过 loadFile 加载，资源路径须为相对路径
    base: './',
    plugins: [vue(), tailwindcss(), electronBuildHtmlPlugin()],
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 800,
      cssCodeSplit: true,
      // Vite 8.0.14+ Rolldown 会破坏 Vue init_* 辅助函数；wpx-app 锁定 vite@8.0.10
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
