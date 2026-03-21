<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { adminApi } from '../api/admin'

const plugins = ref([])
const originalPlugins = ref([])
const loading = ref(false)
const saving = ref(false)
const isDefault = ref(false)
const searchQuery = ref('')

const hasUnsavedChanges = computed(() => {
  return JSON.stringify(plugins.value) !== JSON.stringify(originalPlugins.value)
})

// Modal state
const showModal = ref(false)
const isEditing = ref(false)
const editingIndex = ref(-1)
const currentPlugin = ref({
  name: '',
  path: '',
  params: '',
  desc: '',
  active: false
})

const fetchPlugins = async () => {
  loading.value = true
  try {
    const res = await adminApi.getPlugins()
    if (res && res.success) {
      plugins.value = res.data || []
      originalPlugins.value = JSON.parse(JSON.stringify(res.data || []))
      isDefault.value = res.isDefault || false
    }
  } catch (error) {
    console.error('获取插件列表失败:', error)
    alert('获取插件列表失败')
  } finally {
    loading.value = false
  }
}

const savePlugins = async () => {
  saving.value = true
  try {
    const res = await adminApi.savePlugins(plugins.value)
    if (res && res.success) {
      alert('保存成功')
      originalPlugins.value = JSON.parse(JSON.stringify(plugins.value))
      isDefault.value = false
      await fetchPlugins()
    } else {
      alert('保存失败: ' + (res?.error || '未知错误'))
    }
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

const restoreDefaults = async () => {
  if (!confirm('确定要恢复默认插件配置吗？这将覆盖当前的所有修改。')) {
    return
  }
  
  loading.value = true
  try {
    const res = await adminApi.restorePlugins()
    if (res && res.success) {
      alert('已恢复默认配置')
      await fetchPlugins()
    } else {
      alert('恢复失败: ' + (res?.error || '未知错误'))
    }
  } catch (error) {
    console.error('恢复失败:', error)
    alert('恢复失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const filteredPlugins = computed(() => {
  if (!searchQuery.value) return plugins.value
  const query = searchQuery.value.toLowerCase()
  return plugins.value.filter(p => 
    (p.name && p.name.toLowerCase().includes(query)) ||
    (p.desc && p.desc.toLowerCase().includes(query))
  )
})

const openAddModal = () => {
  isEditing.value = false
  editingIndex.value = -1
  currentPlugin.value = {
    name: '',
    path: '',
    params: '',
    desc: '',
    active: false
  }
  showModal.value = true
}

const openEditModal = (plugin, index) => {
  isEditing.value = true
  editingIndex.value = index
  currentPlugin.value = { ...plugin }
  showModal.value = true
}

const saveModal = () => {
  if (!currentPlugin.value.name || !currentPlugin.value.path) {
    alert('插件名称和路径不能为空')
    return
  }

  if (isEditing.value) {
    plugins.value[editingIndex.value] = { ...currentPlugin.value }
  } else {
    // Check if name already exists
    if (plugins.value.some(p => p.name === currentPlugin.value.name)) {
      alert('插件名称已存在')
      return
    }
    plugins.value.push({ ...currentPlugin.value })
  }
  
  showModal.value = false
}

const deletePlugin = (index) => {
  if (confirm(`确定要删除插件 ${plugins.value[index].name} 吗？`)) {
    plugins.value.splice(index, 1)
  }
}

const toggleActive = (index) => {
  plugins.value[index].active = !plugins.value[index].active
}

onMounted(() => {
  fetchPlugins()
})
</script>

<template>
  <div class="plugins-page">
    <div class="plugins-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
      <div>
        <h2 class="text-xl font-semibold flex items-center gap-2">
          插件管理
          <span v-if="isDefault" class="badge badge-warning text-xs">使用默认配置</span>
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          管理系统插件配置 (.plugins.js)
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <!-- Unsaved changes indicator -->
        <div v-if="hasUnsavedChanges" class="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 rounded-lg text-sm border border-yellow-200 dark:border-yellow-700/50 mr-2 animate-pulse">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="font-medium">有未保存的更改</span>
        </div>

        <!-- Search -->
        <div class="relative flex-1 sm:flex-none sm:min-w-[200px]">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索插件名称或描述..."
            class="input pl-9 pr-8 w-full"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <button @click="openAddModal" class="btn btn-primary">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          添加插件
        </button>

        <button @click="savePlugins" :disabled="saving || !hasUnsavedChanges" class="btn text-white" :class="hasUnsavedChanges ? 'btn-success' : 'bg-gray-400 cursor-not-allowed'">
          <svg v-if="saving" class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          保存配置
        </button>

        <button @click="restoreDefaults" class="btn btn-secondary">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          恢复默认
        </button>
      </div>
    </div>

    <div class="plugins-content">
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
      
      <div v-else-if="filteredPlugins.length === 0" class="card p-12 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
        <svg class="w-12 h-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p>没有找到匹配的插件</p>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        <div v-for="(plugin, index) in filteredPlugins" :key="plugin.name" class="card p-2.5 flex flex-col transition-all hover:shadow-md border-l-[3px]" :class="plugin.active ? 'border-green-500' : 'border-gray-300 dark:border-gray-600'">
          <div class="flex justify-between items-center mb-1.5">
            <div class="flex items-center gap-2 overflow-hidden flex-1">
              <h3 class="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate" :title="plugin.name">{{ plugin.name }}</h3>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" :checked="plugin.active" @change="toggleActive(plugins.indexOf(plugin))" class="sr-only peer">
                <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
              </label>
              <div class="flex gap-0.5 border-l border-gray-200 dark:border-gray-700 pl-2">
                <button @click="openEditModal(plugin, plugins.indexOf(plugin))" class="p-1 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-700 rounded transition-colors" title="编辑">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button @click="deletePlugin(plugins.indexOf(plugin))" class="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded transition-colors" title="删除">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          <p class="text-[11px] text-gray-500 dark:text-gray-400 mb-1.5 flex-1 line-clamp-1" :title="plugin.desc">{{ plugin.desc || '暂无描述' }}</p>
          
          <div class="text-[11px] bg-gray-50 dark:bg-gray-800/50 px-2 py-1.5 rounded space-y-1">
            <div class="flex items-center gap-1.5">
              <span class="text-gray-400 shrink-0 w-8">路径</span>
              <span class="font-mono text-gray-700 dark:text-gray-300 truncate" :title="plugin.path">{{ plugin.path }}</span>
            </div>
            <div class="flex items-center gap-1.5" v-if="plugin.params">
              <span class="text-gray-400 shrink-0 w-8">参数</span>
              <span class="font-mono text-gray-700 dark:text-gray-300 truncate" :title="plugin.params">{{ plugin.params }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {{ isEditing ? '编辑插件' : '添加插件' }}
          </h3>
          <button @click="showModal = false" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="p-4 overflow-y-auto space-y-3">
          <div>
            <div class="flex justify-between items-baseline mb-1">
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">插件名称 <span class="text-red-500">*</span></label>
              <span v-if="isEditing" class="text-[10px] text-gray-400">不可修改</span>
            </div>
            <input v-model="currentPlugin.name" type="text" class="input w-full text-sm py-1.5 px-2.5 min-h-0 h-8" placeholder="例如: req-proxy" :disabled="isEditing" />
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">插件路径 <span class="text-red-500">*</span></label>
            <input v-model="currentPlugin.path" type="text" class="input w-full text-sm py-1.5 px-2.5 min-h-0 h-8" placeholder="例如: plugins/req-proxy" />
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">启动参数</label>
            <input v-model="currentPlugin.params" type="text" class="input w-full text-sm py-1.5 px-2.5 min-h-0 h-8" placeholder="例如: -p 57571" />
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
            <textarea v-model="currentPlugin.desc" rows="2" class="input w-full text-sm py-1.5 px-2.5 resize-none" placeholder="简短描述..."></textarea>
          </div>

          <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-100 dark:border-gray-700/50">
            <span class="text-xs font-medium text-gray-700 dark:text-gray-300">启动时自动运行</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="currentPlugin.active" class="sr-only peer">
              <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
            </label>
          </div>
        </div>

        <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 shrink-0 bg-gray-50/50 dark:bg-gray-800/50">
          <button @click="showModal = false" class="btn btn-secondary py-1.5 px-3 text-xs min-h-0 h-8">
            取消
          </button>
          <button @click="saveModal" class="btn btn-primary py-1.5 px-4 text-xs min-h-0 h-8">
            确定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plugins-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 8rem);
}

.plugins-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>
