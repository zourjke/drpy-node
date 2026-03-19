import { createRouter, createWebHistory } from 'vue-router'
import { useThemeStore } from '../stores/theme'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { title: '仪表盘' }
  },
  {
    path: '/config',
    name: 'config',
    component: () => import('../views/Config.vue'),
    meta: { title: '环境配置' }
  },
  {
    path: '/sources',
    name: 'sources',
    component: () => import('../views/Sources.vue'),
    meta: { title: '源管理' }
  },
  {
    path: '/sources/editor',
    name: 'source-editor',
    component: () => import('../views/SourceEditor.vue'),
    meta: { title: '源编辑器' }
  },
  {
    path: '/logs',
    name: 'logs',
    component: () => import('../views/Logs.vue'),
    meta: { title: '日志查看' }
  },
  {
    path: '/api-docs',
    name: 'api',
    component: () => import('../views/ApiDocs.vue'),
    meta: { title: 'API 文档' }
  },
  {
    path: '/files',
    name: 'files',
    component: () => import('../views/Files.vue'),
    meta: { title: '文件管理' }
  },
  {
    path: '/database',
    name: 'database',
    component: () => import('../views/Database.vue'),
    meta: { title: '数据库' }
  },
  {
    path: '/subscription',
    name: 'subscription',
    component: () => import('../views/Subscription.vue'),
    meta: { title: '订阅管理' }
  },
  {
    path: '/backup',
    name: 'backup',
    component: () => import('../views/Backup.vue'),
    meta: { title: '系统备份' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_PATH || import.meta.env.BASE_URL),
  routes
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const themeStore = useThemeStore()
  // Close sidebar on mobile when navigating
  if (window.innerWidth < 1024) {
    themeStore.closeSidebar()
  }
  
  // Update document title
  document.title = to.meta.title ? `${to.meta.title} - DRPYS ADMIN` : 'DRPYS ADMIN'
  
  next()
})

export default router
