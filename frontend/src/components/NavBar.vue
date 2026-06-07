<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

const route = useRoute()
const open = ref(false)
const scrolled = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 4
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

const links = [
  { to: '/', label: '首页' },
  { to: '/scenarios', label: '场景' },
  { to: '/history', label: '历史' },
  { to: '/stats', label: '统计' },
]

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <header
    :class="[
      'sticky top-0 z-30 backdrop-blur transition-colors',
      scrolled ? 'bg-white/80 border-b border-ink-100' : 'bg-transparent',
    ]"
  >
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
      <RouterLink to="/" class="flex items-center gap-2 group">
        <span
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg
                 bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-soft"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M4 6h16M4 12h12M4 18h14" />
          </svg>
        </span>
        <span class="text-base sm:text-lg font-semibold tracking-tight text-ink-800 group-hover:text-brand-700 transition-colors">
          SpeakFlow
        </span>
      </RouterLink>

      <nav class="hidden sm:flex items-center gap-1">
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          :class="[
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            isActive(l.to)
              ? 'bg-brand-50 text-brand-700'
              : 'text-ink-600 hover:text-ink-800 hover:bg-ink-100',
          ]"
        >
          {{ l.label }}
        </RouterLink>
      </nav>

      <button
        class="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg
               border border-ink-200 text-ink-600 hover:bg-ink-100"
        aria-label="菜单"
        @click="open = !open"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path v-if="!open" d="M4 7h16M4 12h16M4 17h16" />
          <path v-else d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <transition name="drawer">
      <div v-if="open" class="sm:hidden border-t border-ink-100 bg-white">
        <div class="px-4 py-2 flex flex-col">
          <RouterLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            :class="[
              'px-3 py-2.5 rounded-lg text-sm font-medium',
              isActive(l.to) ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100',
            ]"
            @click="open = false"
          >
            {{ l.label }}
          </RouterLink>
        </div>
      </div>
    </transition>
  </header>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
