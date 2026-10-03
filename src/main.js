import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import { useThemeStore } from '@/store/modules/theme'

// 图标库（本地引入，离线可用）
import '@fortawesome/fontawesome-free/css/all.min.css'

// 全局样式（顺序：变量主题 -> 基础 -> 布局 -> 组件）
import '@/assets/styles/theme.css'
import '@/assets/styles/base.css'
import '@/assets/styles/layout.css'
import '@/assets/styles/ui.css'

const app = createApp(App)

app.use(store)
app.use(router)

// 初始化主题（读取本地缓存）
useThemeStore().initTheme()

// 统一错误兜底，便于排查
app.config.errorHandler = (err, instance, info) => {
  console.error('[app error]', info, err)
}

app.mount('#app')
