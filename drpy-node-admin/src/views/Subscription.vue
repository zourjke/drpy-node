<script setup>
import { ref, onMounted, computed } from 'vue'
import { adminApi } from '../api/admin'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { useThemeStore } from '../stores/theme'

const themeStore = useThemeStore()
const files = ref([])
const loading = ref(false)
const currentFile = ref(null)
const fileContent = ref('')
const originalContent = ref('')
const hasChanges = ref(false)
const saving = ref(false)

const loadFiles = async () => {
  loading.value = true
  try {
    const res = await adminApi.getSubFiles()
    // res is the payload directly
    if (res.success) {
        files.value = res.data
    } else {
        alert('加载文件列表失败: ' + (res.message || '未知错误'))
    }
  } catch (e) {
    alert('加载文件列表失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

const selectFile = async (file) => {
    if (hasChanges.value && !confirm('当前文件有未保存的修改，确定要切换吗？')) {
        return
    }
    
    currentFile.value = file
    loading.value = true
    try {
        const res = await adminApi.getSubFile(file.name)
        if (res.success) {
            fileContent.value = res.data
            originalContent.value = res.data
            hasChanges.value = false
        } else {
            alert('加载文件内容失败: ' + (res.message || '未知错误'))
        }
    } catch (e) {
        alert('加载文件内容失败: ' + e.message)
    } finally {
        loading.value = false
    }
}

const saveFile = async () => {
    if (!currentFile.value) return
    saving.value = true
    try {
        const res = await adminApi.saveSubFile(currentFile.value.name, fileContent.value)
        if (res.success) {
            originalContent.value = fileContent.value
            hasChanges.value = false
            alert('保存成功')
        } else {
            alert('保存失败: ' + (res.message || '未知错误'))
        }
    } catch (e) {
        alert('保存出错: ' + e.message)
    } finally {
        saving.value = false
    }
}

const handleContentChange = (value) => {
    fileContent.value = value
    hasChanges.value = value !== originalContent.value
}

// Check if dark mode is active
const isDarkMode = computed(() => themeStore.isDark)

onMounted(() => {
    loadFiles()
})
</script>

<template>
  <div class="subscription-page">
    <!-- Sticky Header Section -->
    <div class="subscription-header">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold">订阅管理</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            编辑 public/sub 目录下的订阅文件 (sub.json) 和排序文件
          </p>
        </div>
        <div class="flex gap-2">
            <button 
                v-if="currentFile"
                @click="saveFile" 
                :disabled="!hasChanges || saving"
                class="btn btn-primary"
            >
                <svg v-if="saving" class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>保存</span>
            </button>
            <button @click="loadFiles" class="btn btn-secondary">刷新</button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="subscription-content flex flex-col lg:flex-row gap-6 overflow-hidden">
      <!-- File List -->
      <div class="card w-full lg:w-64 flex-shrink-0 flex flex-col overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-medium">
            文件列表
        </div>
        <div class="flex-1 overflow-y-auto">
            <div v-if="loading && !currentFile" class="p-4 text-center text-gray-500">加载中...</div>
            <div v-else class="flex flex-col">
                <button 
                    v-for="file in files" 
                    :key="file.name"
                    @click="selectFile(file)"
                    class="px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700/50 transition-colors"
                    :class="{'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400': currentFile?.name === file.name}"
                >
                    <div class="font-medium truncate">{{ file.name }}</div>
                    <div class="text-xs text-gray-400 mt-1">{{ new Date(file.mtime).toLocaleString() }}</div>
                </button>
            </div>
        </div>
      </div>

      <!-- Editor -->
      <div class="card flex-1 flex flex-col overflow-hidden relative">
        <div v-if="!currentFile" class="absolute inset-0 flex items-center justify-center text-gray-400 flex-col">
            <svg class="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>请选择左侧文件进行编辑</span>
        </div>
        <VueMonacoEditor
            v-else
            v-model:value="fileContent"
            :language="currentFile.name.endsWith('.json') ? 'json' : 'html'"
            :theme="isDarkMode ? 'vs-dark' : 'vs'"
            :options="{
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on'
            }"
            @change="handleContentChange"
            class="h-full w-full"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.subscription-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.subscription-header {
  flex-shrink: 0;
  padding-bottom: 1rem;
}

.subscription-content {
  flex: 1;
  min-height: 0; /* Important for nested flex scrolling */
}
</style>
