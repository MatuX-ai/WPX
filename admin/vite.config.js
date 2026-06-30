import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },

    server: {
      port: 5175,
      host: '127.0.0.1',
      open: false
    },

    preview: {
      port: 4175
    },

    // 管理后台统一挂在 prowpx.com/admin 路径下，构建时所有静态资源走 /admin/
    base: '/admin/',

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // 与 landing 项目对齐：manualChunks 必须是函数
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('echarts') || id.includes('vue-echarts')) {
                return 'echarts'
              }
              if (id.includes('@vueuse')) {
                return 'vueuse'
              }
              if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
                return 'vue'
              }
              return 'vendor'
            }
          }
        }
      },
      chunkSizeWarningLimit: 1500
    },

    define: {
      // 暴露应用信息给运行时
      __APP_INFO__: JSON.stringify({
        title: env.VITE_APP_TITLE || 'WPX 管理后台',
        shortName: env.VITE_APP_SHORT_NAME || 'WPX Admin',
        // WPX 自托管邮箱认证，默认同源（避免 apex→www 308 preflight 阻断）
        // 同源请求走 vercel.json rewrites /api/* -> /api/proxy 反代到后端
        // 需要跨域时通过环境变量覆盖（如独立子域部署场景）
        accountBaseUrl: env.VITE_ACCOUNT_BASE_URL || '/',
        apiBaseUrl: env.VITE_API_BASE_URL || '/api',
        themeColor: env.VITE_THEME_COLOR || '#4F46E5'
      })
    }
  }
})