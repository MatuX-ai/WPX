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
      // ⚠️ 重要：accountBaseUrl / apiBaseUrl 必须使用相对路径（'/' 或 '/api'），
      //    绝不设置成 'https://prowpx.com' / 'https://api.prowpx.com/admin' 等绝对域名。
      //
      // 原理：当前 Vercel 项目对 apex 域名（prowpx.com）配置了 "Redirect to www"（308 重定向，
      //       在 Vercel Dashboard 的 Domain Settings 里手动启用），所有到 apex 域名的请求
      //       （包括 OPTIONS preflight）都会被 Vercel Edge Network 在到达 Function 之前
      //       重定向到 www 子域。而 CORS preflight 响应不允许 3xx，浏览器直接阻断 preflight
      //       → 跨子域请求彻底失败。
      //
      // 修复：用 '/' 作为 baseURL，让 axios 解析为同源相对路径，
      //       用户从 www.prowpx.com 进入就请求 www，从 prowpx.com 进入就请求 prowpx.com，
      //       走同源路径 /api/* → /api/proxy → 后端，全程不经过 apex 308 重定向。
      //
      // 如果将来真的需要跨域直连后端（如独立子域部署），请先在 Vercel 域名设置里
      // 把 apex 的 "Redirect to www" 关闭，并在后端 CORS 中间件里放行 www 子域。
      __APP_INFO__: JSON.stringify({
        title: env.VITE_APP_TITLE || 'WPX 管理后台',
        shortName: env.VITE_APP_SHORT_NAME || 'WPX Admin',
        // 自托管邮箱认证入口：默认同源（避免 apex→www 308 preflight 阻断）
        accountBaseUrl: env.VITE_ACCOUNT_BASE_URL || '/',
        // 后端 API：默认同源（走 /api/* → /api/proxy 反代）
        apiBaseUrl: env.VITE_API_BASE_URL || '/api',
        themeColor: env.VITE_THEME_COLOR || '#4F46E5'
      })
    }
  }
})