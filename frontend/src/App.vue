<script setup lang="ts">
import NavBar from '@/components/NavBar.vue'
</script>

<template>
  <div class="min-h-full flex flex-col bg-ink-50">
    <NavBar />
    <main class="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pb-24 pt-4 sm:pt-8">
      <router-view v-slot="{ Component, route }">
        <transition name="page" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </transition>
      </router-view>
    </main>
    <footer class="hidden sm:block text-center text-xs text-ink-400 py-4">
      SpeakFlow · 用对话的方式练习英语
    </footer>
  </div>
</template>

<style scoped>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>
