import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '首页' },
  },
  {
    path: '/scenarios',
    name: 'scenarios',
    component: () => import('@/views/ScenariosView.vue'),
    meta: { title: '场景库' },
  },
  {
    path: '/scenarios/:id/preview',
    name: 'scenario-preview',
    component: () => import('@/views/ScenarioPreviewView.vue'),
    meta: { title: '场景预览' },
  },
  {
    path: '/practice/:id',
    name: 'practice',
    component: () => import('@/views/PracticeView.vue'),
    meta: { title: '练习中' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: '历史记录' },
  },
  {
    path: '/history/:id',
    name: 'history-detail',
    component: () => import('@/views/HistoryDetailView.vue'),
    meta: { title: '会话详情' },
  },
  {
    path: '/wordbook',
    name: 'wordbook',
    component: () => import('@/views/WordbookView.vue'),
    meta: { title: '生词本' },
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('@/views/StatsView.vue'),
    meta: { title: '学习统计' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const base = 'SpeakFlow'
  const title = (to.meta?.title as string | undefined) ?? ''
  document.title = title ? `${title} · ${base}` : base
})
