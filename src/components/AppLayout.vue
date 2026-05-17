<template>
  <div class="app-layout" :class="{ collapsed, 'mobile-open': mobileOpen }">

    <!-- mobile overlay -->
    <div class="sb-overlay" @click="mobileOpen = false"></div>

    <!-- SIDEBAR -->
    <aside class="sidebar">
      <div class="sb-brand">
        <div class="sb-badge">PZ</div>
        <span class="sb-name">RoZter</span>
      </div>

      <nav class="sb-nav">
        <RouterLink
          v-for="item in mainNav"
          :key="item.to"
          :to="item.to"
          class="sb-link"
          :title="item.label"
          @click="mobileOpen = false"
        >
          <component :is="item.icon" :size="15" class="sb-icon" />
          <span class="sb-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sb-sep"><span class="sb-sep-label">Roster</span></div>

      <nav class="sb-nav">
        <RouterLink
          v-for="p in PLAYERS"
          :key="p.id"
          :to="`/perf/${p.role.toLowerCase()}`"
          class="sb-link sb-player"
          :title="`${p.name} · ${p.role}`"
          :style="{ '--pc': p.color, '--pcr': p.colorRgb }"
          @click="mobileOpen = false"
        >
          <span class="sb-dot" :style="{ background: p.color }"></span>
          <span class="sb-label">
            <span class="sb-pname">{{ p.name }}</span>
            <span class="sb-prole">{{ p.role }}</span>
          </span>
        </RouterLink>
      </nav>

      <div class="sb-sep"><span class="sb-sep-label">Staff</span></div>

      <nav class="sb-nav">
        <RouterLink to="/coach" class="sb-link" title="Coach" @click="mobileOpen = false">
          <Trophy :size="15" class="sb-icon" />
          <span class="sb-label">Coach</span>
        </RouterLink>
      </nav>

      <div class="sb-spacer"></div>

      <div class="sb-bottom">
        <button class="sb-link sb-toggle" @click="toggleCollapse" :title="collapsed ? 'Développer' : 'Réduire'">
          <ChevronLeft v-if="!collapsed" :size="15" class="sb-icon" />
          <ChevronRight v-else :size="15" class="sb-icon" />
          <span class="sb-label">Réduire</span>
        </button>
        <button class="sb-link sb-logout" @click="logout" title="Déconnexion">
          <LogOut :size="15" class="sb-icon" />
          <span class="sb-label">Déconnexion</span>
        </button>
      </div>
    </aside>

    <!-- CONTENT -->
    <div class="sb-content">
      <!-- mobile topbar -->
      <div class="mobile-bar">
        <button class="mobile-hamburger" @click="mobileOpen = !mobileOpen">
          <Menu :size="18" />
        </button>
        <span class="mobile-title">RoZter · PlaZma</span>
      </div>

      <Transition name="page" mode="out-in">
        <RouterView :key="$route.path" />
      </Transition>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { PLAYERS } from '../data/players.js'
import {
  Home, BarChart2, Calendar, ClipboardList, Search,
  Layers, GitBranch, ThumbsUp, Users, BookOpen,
  Trophy, ChevronLeft, ChevronRight, LogOut, Menu,
} from 'lucide-vue-next'

const auth = useAuthStore()
const router = useRouter()

const collapsed = ref(localStorage.getItem('sb-collapsed') === '1')
const mobileOpen = ref(false)

const mainNav = [
  { to: '/',             icon: Home,          label: 'Hub' },
  { to: '/dashboard',    icon: BarChart2,      label: 'Dashboard' },
  { to: '/schedule',     icon: Calendar,       label: 'Planning' },
  { to: '/scrim',        icon: ClipboardList,  label: 'CR Scrim' },
  { to: '/scouting',     icon: Search,         label: 'Scouting' },
  { to: '/organisation', icon: Layers,         label: 'Organisation' },
  { to: '/draft',        icon: GitBranch,      label: 'Draft' },
  { to: '/satisfaction', icon: ThumbsUp,       label: 'Satisfaction' },
  { to: '/team',         icon: Users,          label: 'Équipe' },
  { to: '/bible',        icon: BookOpen,       label: 'Bible' },
]

function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem('sb-collapsed', collapsed.value ? '1' : '0')
}

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg);
}

/* ── SIDEBAR ─────────────────────────────────── */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--bg2);
  border-right: 1px solid var(--bd);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  transition: width 0.2s cubic-bezier(.4,0,.2,1);
  z-index: 100;
}
.app-layout.collapsed .sidebar { width: 56px; }

.sb-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 14px 14px;
  border-bottom: 1px solid var(--bd);
  flex-shrink: 0;
  overflow: hidden;
  white-space: nowrap;
}
.sb-badge {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  background: rgba(6,182,212,.12);
  border: 1px solid rgba(6,182,212,.3);
  color: var(--c1);
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
}
.sb-name {
  font-family: 'Rajdhani', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--c1);
  transition: opacity 0.15s;
}
.app-layout.collapsed .sb-name { opacity: 0; pointer-events: none; }

.sb-nav {
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
  overflow: hidden;
}

.sb-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 5px;
  color: var(--tx2);
  text-decoration: none;
  cursor: pointer;
  border: none;
  background: none;
  font-family: 'Exo 2', sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s;
  width: 100%;
  text-align: left;
  clip-path: none;
  position: relative;
  overflow: hidden;
}
.sb-link:hover { background: rgba(6,182,212,.07); color: var(--tx); }
.sb-link.router-link-active,
.sb-link.router-link-exact-active {
  background: rgba(6,182,212,.12);
  color: var(--c1);
}
.sb-link.router-link-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  height: 60%;
  width: 2px;
  background: var(--c1);
  border-radius: 0 2px 2px 0;
}

.sb-icon { flex-shrink: 0; }
.sb-label { transition: opacity 0.15s; }
.app-layout.collapsed .sb-label { opacity: 0; pointer-events: none; }

/* player links */
.sb-player { gap: 8px; }
.sb-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sb-player.router-link-active { color: var(--pc, var(--c1)); background: rgba(var(--pcr, 6,182,212),.1); }
.sb-player.router-link-active::before { background: var(--pc, var(--c1)); }

.sb-pname { display: block; line-height: 1.2; }
.sb-prole { display: block; font-size: 9px; font-weight: 400; color: var(--tx3); letter-spacing: 1px; text-transform: uppercase; }

/* separator */
.sb-sep {
  padding: 10px 16px 2px;
  overflow: hidden;
  flex-shrink: 0;
}
.sb-sep-label {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  color: var(--tx3);
  white-space: nowrap;
  transition: opacity 0.15s;
}
.app-layout.collapsed .sb-sep-label { opacity: 0; }

.sb-spacer { flex: 1; }

.sb-bottom {
  border-top: 1px solid var(--bd);
  padding: 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  overflow: hidden;
}
.sb-logout:hover { color: var(--red) !important; background: rgba(239,68,68,.08) !important; }
.sb-toggle { color: var(--tx3); }
.sb-toggle:hover { color: var(--tx2); }

/* ── CONTENT ─────────────────────────────────── */
.sb-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ── TRANSITIONS ──────────────────────────────── */
.page-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.page-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.page-enter-from   { opacity: 0; transform: translateY(6px); }
.page-leave-to     { opacity: 0; transform: translateY(-3px); }

/* ── MOBILE ───────────────────────────────────── */
.mobile-bar {
  display: none;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--bg2);
  border-bottom: 1px solid var(--bd);
  position: sticky;
  top: 0;
  z-index: 50;
}
.mobile-hamburger {
  background: none;
  border: none;
  color: var(--tx2);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
}
.mobile-hamburger:hover { color: var(--c1); }
.mobile-title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--c1);
}
.sb-overlay { display: none; }

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 220px !important;
    transform: translateX(-100%);
    transition: transform 0.22s cubic-bezier(.4,0,.2,1);
    z-index: 200;
    overflow-y: auto;
  }
  .app-layout.mobile-open .sidebar { transform: translateX(0); }
  .sb-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.5);
    z-index: 150;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.22s;
  }
  .app-layout.mobile-open .sb-overlay { opacity: 1; pointer-events: auto; }
  .mobile-bar { display: flex; }
  .sb-label { opacity: 1 !important; pointer-events: auto !important; }
  .sb-name { opacity: 1 !important; pointer-events: auto !important; }
  .sb-sep-label { opacity: 1 !important; }
}
</style>
