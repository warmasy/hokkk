import { createRouter, createWebHistory } from 'vue-router'

/**
 * 路由表
 * 计算工具为单工作台应用，后续新增页面（如数据中心、模型查看）在此追加即可。
 */
export const routes = [
  {
    path: '/',
    name: 'Workspace',
    component: () => import('@/views/workspace/index.vue'),
    meta: { title: '清玄侍' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_APP_ROUTER_BASE || '/'),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

export default router
