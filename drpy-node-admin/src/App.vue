<script setup>
import { RouterView } from 'vue-router'
import { useThemeStore } from './stores/theme'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'

const themeStore = useThemeStore()
</script>

<template>
  <div class="app-container">
    <!-- Mobile overlay -->
    <div
      v-if="themeStore.sidebarOpen"
      @click="themeStore.closeSidebar"
      class="fixed inset-0 bg-black/50 z-40 lg:hidden"
    />

    <!-- Sidebar -->
    <Sidebar />

    <!-- Main content area -->
    <div class="main-content">
      <!-- Fixed Header -->
      <Header />

      <!-- Scrollable content -->
      <main class="content-area">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <KeepAlive :max="10">
              <component :is="Component" />
            </KeepAlive>
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style>
/* 应用容器 - 确保占满整个视口高度并禁止滚动 */
.app-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: rgb(249 250 251);
  display: flex;
}

.dark .app-container {
  background-color: rgb(17 24 39);
}

/* 主内容区域 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  margin-left: 0;
}

@media (min-width: 1024px) {
  .main-content {
    margin-left: 14rem;
  }
}

/* 内容区域 - 占据剩余高度并控制内部滚动 */
.content-area {
  flex: 1;
  padding: 1rem;
  margin-top: 4rem; /* 为 Header 留出空间 */
  overflow-y: auto; /* 允许内部滚动 */
  height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;
}

@media (min-width: 1024px) {
  .content-area {
    padding: 1.5rem;
  }
}

/* 路由切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 确保页面内容正确显示并撑满高度 */
.content-area > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* 允许 flex 子项收缩 */
}
</style>
