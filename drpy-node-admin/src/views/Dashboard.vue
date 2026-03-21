<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useSystemStore } from '../stores/system'
import apiClient from '../api/client'

const systemStore = useSystemStore()
const healthCheckInterval = ref(null)
const isTerminalAvailable = ref(false)

// Page layout refs for sticky header
const pageContainer = ref(null)

onMounted(async () => {
  await systemStore.checkHealth()
  await systemStore.fetchRoutes()
  await systemStore.fetchSources()

  // Check terminal status
  try {
    const res = await apiClient.get('/api/admin/terminal/status')
    if (res && res.available) {
      isTerminalAvailable.value = true
    }
  } catch (error) {
    console.error('Failed to get terminal status:', error)
  }

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

const formatUptime = (seconds) => {
  if (!seconds) return '0秒';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  
  let result = '';
  if (d > 0) result += `${d}天`;
  if (h > 0 || d > 0) result += `${h}时`;
  result += `${m}分`;
  
  return result;
}

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
  <div class="dashboard-page">
    <!-- Sticky Header Section -->
    <div class="dashboard-header">
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
        <div class="flex items-center justify-between">
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
          <span v-if="systemStore.health.uptime" class="text-sm text-gray-500">
            运行时长: {{ formatUptime(systemStore.health.uptime) }}
          </span>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2 text-sm">
          <div class="flex justify-between items-center">
            <span class="text-gray-500">运行环境</span>
            <div class="flex items-center gap-1.5">
              <span class="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-mono text-xs">{{ systemStore.health.platform?.platform }}</span>
              <span class="badge bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-mono text-xs">{{ systemStore.health.platform?.arch }}</span>
              <span class="badge bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 font-mono text-xs">Node {{ systemStore.health.platform?.nodeVersion }}</span>
            </div>
          </div>
          <div class="flex justify-between items-center">
             <span class="text-gray-500">系统版本</span>
             <div class="flex items-center gap-1.5">
               <span class="badge font-mono text-xs" :class="systemStore.health.env?.php ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'" title="PHP环境状态">PHP {{ typeof systemStore.health.env?.php === 'string' ? systemStore.health.env.php : (systemStore.health.env?.php ? 'ON' : 'OFF') }}</span>
               <span class="badge font-mono text-xs" :class="systemStore.health.env?.python ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'" title="Python环境状态">Py {{ typeof systemStore.health.env?.python === 'string' ? systemStore.health.env.python : (systemStore.health.env?.python ? 'ON' : 'OFF') }}</span>
               <span class="badge badge-info font-mono text-xs">v{{ systemStore.health.version || 'Unknown' }}</span>
             </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="dashboard-content flex flex-col gap-4">
      <!-- Stats Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <!-- JS Sources -->
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">JS 源</p>
            <p class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
              {{ systemStore.sources.js?.length || 0 }}
            </p>
          </div>
          <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- CatVod Sources -->
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">CatVod 源</p>
            <p class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
              {{ systemStore.sources.catvod?.length || 0 }}
            </p>
          </div>
          <div class="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- PHP Sources -->
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">PHP 源</p>
            <p class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
              {{ systemStore.sources.php?.length || 0 }}
            </p>
          </div>
          <div class="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Py Sources -->
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">PY 源</p>
            <p class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
              {{ systemStore.sources.py?.length || 0 }}
            </p>
          </div>
          <div class="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Total Sources -->
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">总源数</p>
            <p class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
              {{ (systemStore.sources.js?.length || 0) + (systemStore.sources.catvod?.length || 0) + (systemStore.sources.php?.length || 0) + (systemStore.sources.py?.length || 0) }}
            </p>
          </div>
          <div class="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Routes -->
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">路由数</p>
            <p class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
              {{ systemStore.routes.registered_controllers?.length || 0 }}
            </p>
          </div>
          <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
      <div class="card p-5">
        <h3 class="text-base font-semibold mb-3">快捷操作</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <RouterLink to="/config" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span class="text-sm font-medium">环境配置</span>
        </RouterLink>

        <RouterLink to="/sources" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span class="text-sm font-medium">源管理</span>
        </RouterLink>

        <RouterLink to="/map-manager" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span class="text-sm font-medium">站源映射</span>
        </RouterLink>

        <RouterLink to="/parses" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span class="text-sm font-medium">解析管理</span>
        </RouterLink>
        
        <RouterLink to="/files" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span class="text-sm font-medium">文件管理</span>
        </RouterLink>
        
        <RouterLink to="/database" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          <span class="text-sm font-medium">数据库</span>
        </RouterLink>

        <RouterLink to="/api-docs" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="text-sm font-medium">接口文档</span>
        </RouterLink>

        <RouterLink to="/logs" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-medium">日志查看</span>
        </RouterLink>

        <RouterLink to="/subscription" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span class="text-sm font-medium">订阅管理</span>
        </RouterLink>

        <RouterLink to="/plugins" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
          </svg>
          <span class="text-sm font-medium">插件管理</span>
        </RouterLink>

        <RouterLink v-if="isTerminalAvailable" to="/terminal" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span class="text-sm font-medium">终端模拟</span>
        </RouterLink>

        <RouterLink to="/backup" class="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span class="text-sm font-medium">备份恢复</span>
        </RouterLink>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 8rem - 4rem);
  min-height: 500px;
}

.dashboard-header {
  flex-shrink: 0;
  padding-bottom: 1rem;
}

.dashboard-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>
