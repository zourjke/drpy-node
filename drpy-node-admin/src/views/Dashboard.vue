<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useSystemStore } from '../stores/system'

const systemStore = useSystemStore()
const healthCheckInterval = ref(null)

onMounted(async () => {
  await systemStore.checkHealth()
  await systemStore.fetchRoutes()
  await systemStore.fetchSources()

  // Check health every 30 seconds
  healthCheckInterval.value = setInterval(() => {
    systemStore.checkHealth()
  }, 30000)
})

onUnmounted(() => {
  if (healthCheckInterval.value) {
    clearInterval(healthCheckInterval.value)
  }
})

const getStatusColor = (status) => {
  switch (status) {
    case 'ok':
    case 'healthy':
      return 'text-green-600 dark:text-green-400'
    case 'error':
    case 'unhealthy':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-yellow-600 dark:text-yellow-400'
  }
}

const getStatusBadge = (status) => {
  switch (status) {
    case 'ok':
    case 'healthy':
      return 'badge-success'
    case 'error':
    case 'unhealthy':
      return 'badge-error'
    default:
      return 'badge-warning'
  }
}

const restarting = ref(false)

const restartService = async () => {
  if (!confirm('确定要重启 drpy-node 服务吗？这将中断所有连接。')) {
    return
  }

  restarting.value = true
  try {
    const result = await systemStore.restartService()
    // Parse MCP response format: { content: [{ type: "text", text: '{"success":true,"message":"..."}' }] }
    let message = '操作已完成'
    try {
      // MCP 响应格式
      if (result?.content?.[0]?.text) {
        const parsed = JSON.parse(result.content[0].text)
        message = parsed.message || message
      } else if (typeof result === 'string') {
        const parsed = JSON.parse(result)
        message = parsed.message || result
      }
    } catch {
      message = '操作已完成，请检查服务状态'
    }
    alert(message)
  } catch (e) {
    alert('重启失败: ' + e.message)
  } finally {
    restarting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Health Status -->
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">服务状态</h3>
        <div class="flex items-center gap-3">
          <button
            @click="restartService"
            :disabled="restarting"
            class="btn btn-secondary text-sm"
            :class="{ 'opacity-50 cursor-not-allowed': restarting }"
          >
            <svg v-if="restarting" class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ restarting ? '重启中...' : '重启服务' }}
          </button>
          <span
            class="badge"
            :class="getStatusBadge(systemStore.health.status)"
          >
            {{ systemStore.health.status?.toUpperCase() || 'UNKNOWN' }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div
          class="w-3 h-3 rounded-full animate-pulse-slow"
          :class="systemStore.health.status === 'ok' || systemStore.health.status === 'healthy'
            ? 'bg-green-500'
            : 'bg-red-500'"
        />
        <span class="text-gray-600 dark:text-gray-400">
          {{ systemStore.health.status === 'ok' || systemStore.health.status === 'healthy'
            ? '服务运行正常'
            : '服务异常' }}
        </span>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- JS Sources -->
      <div class="card p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">JS 源</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {{ systemStore.sources.js?.length || 0 }}
            </p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- CatVod Sources -->
      <div class="card p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">CatVod 源</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {{ systemStore.sources.catvod?.length || 0 }}
            </p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Routes -->
      <div class="card p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">路由数</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {{ systemStore.routes.registered_controllers?.length || 0 }}
            </p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Total Sources -->
      <div class="card p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">总源数</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {{ (systemStore.sources.js?.length || 0) + (systemStore.sources.catvod?.length || 0) }}
            </p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <svg class="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="card p-6">
      <h3 class="text-lg font-semibold mb-4">快捷操作</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <RouterLink to="/config" class="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span class="font-medium">环境配置</span>
        </RouterLink>

        <RouterLink to="/sources" class="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span class="font-medium">源管理</span>
        </RouterLink>

        <RouterLink to="/logs" class="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="font-medium">日志查看</span>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
