import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)

// Pinia 状态管理
app.use(createPinia())

// 路由
app.use(router)

// 全局未捕获错误处理
app.config.errorHandler = (err, instance, info) => {
  // 后台只记录到控制台，避免打断管理员操作
  // eslint-disable-next-line no-console
  console.error('[WPX Admin] Uncaught error:', err, info)
}

app.mount('#app')