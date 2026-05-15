import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  { path: '/login',          component: () => import('../views/Login.vue'),        meta: { public: true } },
  { path: '/',               component: () => import('../views/Hub.vue') },
  { path: '/dashboard',      component: () => import('../views/Dashboard.vue') },
  { path: '/schedule',       component: () => import('../views/Schedule.vue') },
  { path: '/scrim',          component: () => import('../views/Scrim.vue') },
  { path: '/scouting',       component: () => import('../views/Scouting.vue') },
  { path: '/organisation',   component: () => import('../views/Organisation.vue') },
  { path: '/draft',          component: () => import('../views/Draft.vue') },
  { path: '/satisfaction',   component: () => import('../views/Satisfaction.vue') },
  { path: '/team',           component: () => import('../views/Team.vue') },
  { path: '/bible',          component: () => import('../views/Bible.vue') },
  { path: '/coach',          component: () => import('../views/Coach.vue') },
  { path: '/perf/:role',     component: () => import('../views/Perf.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) {
    return '/login'
  }
  if (to.path === '/login' && auth.isAuthenticated) {
    return '/'
  }
})

export default router
