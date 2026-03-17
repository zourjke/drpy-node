<script setup>
import { RouterView } from 'vue-router'
import { useThemeStore } from './stores/theme'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'

const themeStore = useThemeStore()
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Mobile overlay -->
    <div
      v-if="themeStore.sidebarOpen"
      @click="themeStore.closeSidebar"
      class="fixed inset-0 bg-black/50 z-40 lg:hidden"
    />

    <!-- Sidebar -->
    <Sidebar />

    <!-- Main content area -->
    <div class="lg:ml-64">
      <!-- Fixed Header -->
      <Header />

      <!-- Scrollable content -->
      <main class="p-4 lg:p-6 mt-16">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
