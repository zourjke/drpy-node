<script>
export default {
  name: 'LogsView'
}
</script>

<script setup>
import { ref, onMounted, onActivated, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogsStore } from '../stores/logs'

const logContainer = ref(null)
const logsStore = useLogsStore()

// Extract reactive state from store
const { wsConnected, wsError, logs, autoScroll } = storeToRefs(logsStore)

const scrollToBottom = () => {
  if (logContainer.value) {
    const lastElement = logContainer.value.lastElementChild
    if (lastElement) {
      lastElement.scrollIntoView({ behavior: 'instant', block: 'end' })
    } else {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  }
}

const scrollToTop = () => {
  if (logContainer.value) {
    logContainer.value.scrollTop = 0
  }
}

const getLogStyle = (level) => {
  switch (level) {
    case 'error':
    case 'err':
      return 'text-red-400'
    case 'warn':
    case 'warning':
      return 'text-yellow-400'
    case 'info':
      return 'text-blue-400'
    case 'debug':
      return 'text-gray-500'
    default:
      return 'text-gray-300'
  }
}

onMounted(() => {
  if (!logsStore.isInitialized) {
    logsStore.connectWebSocket()
    logsStore.isInitialized = true
  }
})

onActivated(() => {
  if (autoScroll.value) {
    nextTick(() => {
      scrollToBottom()
    })
  }
})

// Watch for auto scroll changes
watch(autoScroll, () => {
  if (autoScroll.value) {
    nextTick(() => {
      scrollToBottom()
    })
  }
})

// Watch logs array to auto-scroll if enabled
watch(() => logs.value.length, () => {
  if (autoScroll.value) {
    nextTick(() => {
      scrollToBottom()
    })
  }
})
</script>

<template>
  <div class="logs-page">
    <!-- Header - 固定在顶部，不会被滚动 -->
    <div class="logs-header">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold">日志查看</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            实时查看应用运行日志
          </p>
        </div>
        <div class="flex items-center gap-2">
          <!-- 连接状态指示 -->
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
            :class="wsConnected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'">
            <span class="w-2 h-2 rounded-full animate-pulse"
              :class="wsConnected ? 'bg-green-500' : 'bg-red-500'"
            />
            {{ wsConnected ? '已连接' : '未连接' }}
          </div>

          <button
            @click="logsStore.toggleConnection"
            class="btn"
            :class="wsConnected ? 'btn-secondary' : 'btn-primary'"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {{ wsConnected ? '断开' : '连接' }}
          </button>

          <button @click="logsStore.clearLogs" class="btn btn-secondary">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            清空
          </button>
        </div>
      </div>
    </div>

    <!-- Log viewer 卡片 -->
    <div class="logs-viewer card">
      <!-- Toolbar -->
      <div class="logs-toolbar">
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              v-model="autoScroll"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            自动滚动到底部
          </label>
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {{ logs.length }} 条日志
          </span>
        </div>
        <div class="flex gap-2">
          <button @click="scrollToTop" class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="滚动到顶部">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
          <button @click="scrollToBottom" class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="滚动到底部">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Log content - 可滚动区域 -->
      <div ref="logContainer" class="logs-content">
        <template v-if="logs.length === 0">
          <div class="text-center py-12 text-gray-500">
            <template v-if="!wsConnected">
              <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p>点击"连接"按钮开始接收实时日志</p>
            </template>
            <template v-else>
              等待日志...
            </template>
          </div>
        </template>

        <template v-else>
          <div
            v-for="(log, index) in logs"
            :key="index"
            class="flex gap-3 hover:bg-gray-800/50 rounded px-2 py-0.5"
          >
            <span class="text-gray-500 flex-shrink-0 select-none">{{ log.timestamp }}</span>
            <span class="flex-1 break-words" :class="getLogStyle(log.level)">{{ log.message }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 页面容器 - 使用固定高度确保布局正确 */
.logs-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 8rem - 4rem);
  min-height: 500px;
}

/* 头部区域 - 固定不滚动 */
.logs-header {
  flex-shrink: 0;
  padding-bottom: 1rem;
}

/* 日志查看器卡片 - 占据剩余空间 */
.logs-viewer {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 工具栏 - 固定在卡片顶部 */
.logs-toolbar {
  flex-shrink: 0;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgb(229 231 235);
  border-bottom-color: rgb(229 231 235);
}

.dark .logs-toolbar {
  border-bottom-color: rgb(55 65 81);
}

.logs-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 日志内容区域 - 可滚动 */
.logs-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem;
  background-color: rgb(17 24 39);
  color: rgb(209 213 219);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.625;
}

.dark .logs-content {
  background-color: rgb(0 0 0);
}

input[type="checkbox"] {
  accent-color: rgb(2 132 199);
}
</style>
