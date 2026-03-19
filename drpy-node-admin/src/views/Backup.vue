<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '../api/admin'

const config = ref({ paths: [] })
const loading = ref(false)
const processing = ref(false)
const logs = ref([])

const addLog = (msg, type = 'info') => {
    logs.value.unshift({
        time: new Date().toLocaleTimeString(),
        msg,
        type
    })
}

const loadConfig = async () => {
    loading.value = true
    try {
        const res = await adminApi.getBackupConfig()
        if (res.success) {
            config.value = res
        } else {
            addLog('加载配置失败: ' + (res.message || '未知错误'), 'error')
        }
    } catch (e) {
        addLog('加载配置失败: ' + e.message, 'error')
    } finally {
        loading.value = false
    }
}

const handleBackup = async () => {
    if (!confirm('确定要开始备份吗？')) return
    processing.value = true
    addLog('开始备份...', 'info')
    try {
        const res = await adminApi.createBackup()
        if (res.success) {
            addLog('备份成功: ' + res.message, 'success')
            if (res.details) {
                res.details.forEach(d => addLog(d, 'info'))
            }
            await loadConfig() // Refresh timestamps
        } else {
            addLog('备份失败: ' + res.message, 'error')
        }
    } catch (e) {
        addLog('备份出错: ' + e.message, 'error')
    } finally {
        processing.value = false
    }
}

const handleRestore = async () => {
    if (!confirm('⚠️ 确定要恢复备份吗？这将覆盖当前系统文件！')) return
    processing.value = true
    addLog('开始恢复...', 'warning')
    try {
        const res = await adminApi.restoreBackup()
        if (res.success) {
            addLog('恢复成功: ' + res.message, 'success')
             if (res.details) {
                res.details.forEach(d => addLog(d, 'info'))
            }
            await loadConfig()
        } else {
            addLog('恢复失败: ' + res.message, 'error')
        }
    } catch (e) {
        addLog('恢复出错: ' + e.message, 'error')
    } finally {
        processing.value = false
    }
}

onMounted(() => {
    loadConfig()
    addLog('系统准备就绪')
})
</script>

<template>
  <div class="backup-page">
    <!-- Sticky Header Section -->
    <div class="backup-header">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
            <h2 class="text-xl font-semibold">系统备份与恢复</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              备份或恢复系统关键配置文件、插件和脚本
            </p>
        </div>
        <div class="flex gap-2">
            <button 
                @click="handleBackup" 
                :disabled="processing"
                class="btn btn-success"
            >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>立即备份</span>
            </button>
            <button 
                @click="handleRestore"
                :disabled="processing" 
                class="btn btn-secondary bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
            >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m-4-4v12" />
                </svg>
                <span>恢复备份</span>
            </button>
        </div>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="backup-content">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Status Card -->
            <div class="card p-6">
                <h3 class="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">备份状态</h3>
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <span class="text-gray-500 dark:text-gray-400">上次备份</span>
                        <span class="font-mono text-gray-900 dark:text-gray-300">{{ config.lastBackupAt ? new Date(config.lastBackupAt).toLocaleString() : '从未' }}</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <span class="text-gray-500 dark:text-gray-400">上次恢复</span>
                        <span class="font-mono text-gray-900 dark:text-gray-300">{{ config.lastRestoreAt ? new Date(config.lastRestoreAt).toLocaleString() : '从未' }}</span>
                    </div>
                </div>
            </div>

            <!-- File List -->
            <div class="card p-6 flex flex-col">
                <h3 class="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">包含文件</h3>
                <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 overflow-y-auto font-mono text-xs text-gray-600 dark:text-gray-400 flex-1 max-h-[200px]">
                    <div v-for="path in config.paths" :key="path" class="py-1 border-b border-dashed border-gray-200 dark:border-gray-800 last:border-0">
                        {{ path }}
                    </div>
                </div>
            </div>
        </div>

        <!-- Logs -->
        <div class="card overflow-hidden mt-6 flex-1 flex flex-col min-h-[300px]">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">
                操作日志
            </div>
            <div class="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 font-mono text-xs">
                <div v-for="(log, idx) in logs" :key="idx" class="mb-2 flex gap-3">
                    <span class="text-gray-400 select-none min-w-[80px]">{{ log.time }}</span>
                    <span :class="{
                        'text-green-600 dark:text-green-400': log.type === 'success',
                        'text-red-600 dark:text-red-400': log.type === 'error',
                        'text-orange-500': log.type === 'warning',
                        'text-gray-700 dark:text-gray-300': log.type === 'info'
                    }">{{ log.msg }}</span>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.backup-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.backup-header {
  flex-shrink: 0;
  padding-bottom: 1rem;
}

.backup-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
</style>
