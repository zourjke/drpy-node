<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '../api/admin'
import { fileApi } from '../api/file'

const config = ref({ paths: [] })
const loading = ref(false)
const processing = ref(false)
const logs = ref([])

// File picker state
const showFilePicker = ref(false)
const currentPath = ref('.')
const fileList = ref([])
const pathHistory = ref(['.'])

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
            if (!config.value.paths) config.value.paths = []
        } else {
            addLog('加载配置失败: ' + (res.message || '未知错误'), 'error')
        }
    } catch (e) {
        addLog('加载配置失败: ' + e.message, 'error')
    } finally {
        loading.value = false
    }
}

const saveConfig = async () => {
    try {
        const res = await adminApi.updateBackupConfig(config.value.paths)
        if (res.success) {
            addLog('配置保存成功', 'success')
        } else {
            addLog('配置保存失败: ' + res.message, 'error')
        }
    } catch (e) {
        addLog('配置保存出错: ' + e.message, 'error')
    }
}

const removePath = (index) => {
    config.value.paths.splice(index, 1)
    saveConfig()
}

const handleReset = async () => {
    if (!confirm('确定要重置包含文件为默认列表吗？')) return
    processing.value = true
    addLog('正在重置包含文件...', 'info')
    try {
        const res = await adminApi.resetBackupConfig()
        if (res.success) {
            config.value.paths = res.paths
            addLog('重置包含文件成功', 'success')
        } else {
            addLog('重置失败: ' + res.message, 'error')
        }
    } catch (e) {
        addLog('重置出错: ' + e.message, 'error')
    } finally {
        processing.value = false
    }
}

const openFilePicker = async () => {
    currentPath.value = '.'
    pathHistory.value = ['.']
    await loadFileList(currentPath.value)
    showFilePicker.value = true
}

const closeFilePicker = () => {
    showFilePicker.value = false
}

const loadFileList = async (dirPath) => {
    try {
        const res = await fileApi.listDirectory(dirPath)
        if (res && res.files) {
            fileList.value = res.files.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
                return a.isDirectory ? -1 : 1
            })
        }
    } catch (e) {
        addLog('加载文件列表失败: ' + e.message, 'error')
    }
}

const navigateTo = async (folder) => {
    const newPath = currentPath.value === '.' ? folder.name : `${currentPath.value}/${folder.name}`
    pathHistory.value.push(newPath)
    currentPath.value = newPath
    await loadFileList(newPath)
}

const navigateUp = async () => {
    if (pathHistory.value.length > 1) {
        pathHistory.value.pop()
        currentPath.value = pathHistory.value[pathHistory.value.length - 1]
        await loadFileList(currentPath.value)
    }
}

const selectPath = (item) => {
    let newPath = item.path
    if (newPath.startsWith('./')) newPath = newPath.substring(2)
    if (!config.value.paths.includes(newPath)) {
        config.value.paths.push(newPath)
        saveConfig()
    }
    closeFilePicker()
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
        <div class="flex items-center gap-4">
            <div>
                <h2 class="text-xl font-semibold">系统备份与恢复</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  管理系统关键配置
                </p>
            </div>
            <!-- Simplified Status Display near header -->
            <div class="hidden sm:flex flex-col text-xs text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700 pl-4">
                <div class="flex gap-2"><span class="w-16 text-right flex-shrink-0">上回备份:</span> <span class="font-mono text-gray-900 dark:text-gray-300">{{ config.lastBackupAt ? new Date(config.lastBackupAt).toLocaleString() : '从未' }}</span></div>
                <div class="flex gap-2"><span class="w-16 text-right flex-shrink-0">上回恢复:</span> <span class="font-mono text-gray-900 dark:text-gray-300">{{ config.lastRestoreAt ? new Date(config.lastRestoreAt).toLocaleString() : '从未' }}</span></div>
            </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <!-- Mobile status display -->
            <div class="w-full sm:hidden flex justify-between text-xs text-gray-500 mb-2">
                <span>备份: <span class="font-mono text-gray-900 dark:text-gray-300">{{ config.lastBackupAt ? new Date(config.lastBackupAt).toLocaleDateString() : '从未' }}</span></span>
                <span>恢复: <span class="font-mono text-gray-900 dark:text-gray-300">{{ config.lastRestoreAt ? new Date(config.lastRestoreAt).toLocaleDateString() : '从未' }}</span></span>
            </div>
            <button 
                @click="handleBackup" 
                :disabled="processing"
                class="btn btn-success flex-1 sm:flex-none"
            >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>立即备份</span>
            </button>
            <button 
                @click="handleRestore"
                :disabled="processing" 
                class="btn btn-secondary bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50 flex-1 sm:flex-none"
            >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m-4-4v12" />
                </svg>
                <span>恢复备份</span>
            </button>
            <button 
                @click="handleReset"
                :disabled="processing" 
                class="btn btn-secondary bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 border-red-200 dark:border-red-800/50 flex-1 sm:flex-none"
            >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>重置包含</span>
            </button>
        </div>
      </div>
    </div>

    <!-- Scrollable Content - Split into 2 blocks side-by-side on large screens -->
    <div class="backup-content flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        <!-- Left Block: File List -->
        <div class="card flex-1 flex flex-col min-h-0 min-h-[300px] lg:min-h-0">
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">包含文件</h3>
                <button @click="openFilePicker" class="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    添加
                </button>
            </div>
            <div class="flex-1 overflow-y-auto p-2">
                <div class="bg-white dark:bg-gray-800 font-mono text-xs text-gray-600 dark:text-gray-400">
                    <div v-for="(path, index) in config.paths" :key="path" class="py-2 px-3 flex justify-between items-center border-b border-dashed border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors">
                        <span class="truncate break-all mr-2" :title="path">{{ path }}</span>
                        <button @click="removePath(index)" class="text-gray-400 hover:text-red-500 p-1 flex-shrink-0 transition-colors" title="删除">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                    <div v-if="!config.paths || config.paths.length === 0" class="py-8 text-center text-gray-400 flex flex-col items-center">
                        <svg class="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        暂无包含文件
                    </div>
                </div>
            </div>
        </div>

        <!-- Right Block: Logs -->
        <div class="card flex-1 flex flex-col min-h-0 min-h-[300px] lg:min-h-0">
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200 text-sm bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                <span>操作日志</span>
                <span class="text-xs font-normal text-gray-400">{{ logs.length }} 条记录</span>
            </div>
            <div class="flex-1 overflow-y-auto p-3 bg-gray-50/50 dark:bg-gray-900/50 font-mono text-xs">
                <div v-for="(log, idx) in logs" :key="idx" class="mb-2 flex gap-2 pb-1 border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                    <span class="text-gray-400 select-none min-w-[70px] flex-shrink-0">{{ log.time }}</span>
                    <span class="break-words" :class="{
                        'text-green-600 dark:text-green-400': log.type === 'success',
                        'text-red-600 dark:text-red-400': log.type === 'error',
                        'text-orange-500': log.type === 'warning',
                        'text-gray-700 dark:text-gray-300': log.type === 'info'
                    }">{{ log.msg }}</span>
                </div>
                <div v-if="logs.length === 0" class="py-8 text-center text-gray-400 flex flex-col items-center">
                    <svg class="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    暂无日志记录
                </div>
            </div>
        </div>
    </div>

    <!-- File Picker Modal -->
    <div v-if="showFilePicker" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-center justify-center min-h-screen p-4 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeFilePicker"></div>

            <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div class="inline-block align-middle bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 max-w-lg w-full">
                <div class="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div class="sm:flex sm:items-start">
                        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="modal-title">
                                选择文件或目录
                            </h3>
                            <div class="mt-2 text-sm text-gray-500 dark:text-gray-400 font-mono mb-2 bg-gray-100 dark:bg-gray-700 p-2 rounded flex items-center">
                                <button v-if="pathHistory.length > 1" @click="navigateUp" class="mr-2 text-primary-600 hover:text-primary-700">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                </button>
                                {{ currentPath }}
                            </div>
                            
                            <div class="mt-2 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden h-64 overflow-y-auto">
                                <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                                    <li v-for="item in fileList" :key="item.name" class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <div class="flex items-center px-4 py-2 cursor-pointer" @click="item.isDirectory ? navigateTo(item) : selectPath(item)">
                                            <svg v-if="item.isDirectory" class="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                            </svg>
                                            <svg v-else class="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1 truncate">{{ item.name }}</span>
                                            <button v-if="item.isDirectory" @click.stop="selectPath(item)" class="ml-2 px-2 py-1 text-xs bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 rounded hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors">
                                                选择此目录
                                            </button>
                                        </div>
                                    </li>
                                    <li v-if="fileList.length === 0" class="px-4 py-4 text-center text-sm text-gray-500">
                                        空目录
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button type="button" class="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" @click="closeFilePicker">
                        取消
                    </button>
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
  height: calc(100vh - 8rem);
  min-height: 400px;
}

.backup-header {
  flex-shrink: 0;
  padding-bottom: 1rem;
}

.backup-content {
  flex: 1;
  min-height: 0;
  /* Always allow flex row on large screens, stack on small */
}

/* Let individual cards scroll their content, prevent the page from scrolling */
.backup-content > .card {
  /* On small screens flex basis will be auto so it can grow if we change min-height */
  /* On large screens they split 50/50 */
}
</style>
