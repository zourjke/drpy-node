<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fileApi } from '../api/file'
import Sortable from 'sortablejs'
import { useThemeStore } from '../stores/theme'

const router = useRouter()
const themeStore = useThemeStore()
const loading = ref(false)
const saving = ref(false)
const viewMode = ref('list') // 'list' or 'editor'
const mapContent = ref('')
const originalMapContent = ref('')
const mapRecords = ref([])
const sortableInstance = ref(null)
const listContainer = ref(null)
const wordWrap = ref(true)
const searchQuery = ref('')

const hasUnsavedChanges = computed(() => {
  if (viewMode.value === 'list') {
    return generateMapContent(mapRecords.value) !== originalMapContent.value
  } else {
    return mapContent.value !== originalMapContent.value
  }
})

const editorOptions = computed(() => ({
  automaticLayout: true,
  wordWrap: wordWrap.value ? 'on' : 'off',
  wordWrapColumn: 80,
  wrappingIndent: 'same',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 14,
  lineNumbers: 'on',
  renderWhitespace: 'none',
  padding: { top: 16, bottom: 16 }
}))

// For list view editing
const editingIndex = ref(-1)
const editRecord = ref({ source: '', params: '', alias: '' })
const isAdding = ref(false)

let nextId = 0
const parseMapContent = (content) => {
  if (!content) return []
  const lines = content.split('\n')
  const records = []
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    
    // Ignore comments if any, though map.txt doesn't officially support comments
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
      records.push({ id: nextId++, type: 'comment', raw: line })
      continue
    }

    const parts = trimmedLine.split('@@')
    if (parts.length >= 1) {
      records.push({
        id: nextId++,
        type: 'record',
        raw: line,
        source: parts[0]?.trim() || '',
        params: parts[1]?.trim() || '',
        alias: parts[2]?.trim() || ''
      })
    } else {
      records.push({ id: nextId++, type: 'raw', raw: line })
    }
  }
  
  return records
}

const generateMapContent = (records) => {
  return records.map(r => {
    if (r.type === 'record') {
      const parts = [r.source]
      if (r.params || r.alias) parts.push(r.params)
      if (r.alias) parts.push(r.alias)
      return parts.join('@@')
    }
    return r.raw
  }).join('\n')
}

const loadMapFile = async () => {
  loading.value = true
  try {
    const result = await fileApi.readFile('config/map.txt')
    
    let content = ''
    if (typeof result === 'string') {
      content = result
    } else if (result?.type === 'text' && result.content) {
      content = result.content
    } else if (result?.content) {
      content = result.content
    } else {
      content = String(result || '')
    }
    
    mapContent.value = content
    originalMapContent.value = content
    mapRecords.value = parseMapContent(content)
  } catch (e) {
    console.error('Load map.txt error:', e)
    // If file doesn't exist, we start with empty
    if (e.message && e.message.includes('not found')) {
      mapContent.value = ''
      originalMapContent.value = ''
      mapRecords.value = []
    } else {
      alert('加载 map.txt 失败: ' + e.message)
    }
  } finally {
    loading.value = false
  }
}

const saveMapFile = async () => {
  if (!confirm('确定要保存对映射配置的修改吗？\n此操作将直接写入 config/map.txt 文件。')) {
    return
  }
  
  saving.value = true
  try {
    // If in list mode, update content from records first
    if (viewMode.value === 'list') {
      mapContent.value = generateMapContent(mapRecords.value)
    }
    
    await fileApi.writeFile('config/map.txt', mapContent.value)
    // Update original content state after successful save
    originalMapContent.value = mapContent.value
    // Refresh records after save if we were in editor mode
    if (viewMode.value === 'editor') {
      mapRecords.value = parseMapContent(mapContent.value)
    }
    alert('保存成功')
  } catch (e) {
    alert('保存失败: ' + e.message)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadMapFile()
  await nextTick()
  if (viewMode.value === 'list') {
    initSortable()
  }
})

const toggleViewMode = () => {
  if (viewMode.value === 'list') {
    // Switching to editor, sync content
    mapContent.value = generateMapContent(mapRecords.value)
    viewMode.value = 'editor'
    if (sortableInstance.value) {
      sortableInstance.value.destroy()
      sortableInstance.value = null
    }
  } else {
    // Switching to list, sync records
    mapRecords.value = parseMapContent(mapContent.value)
    viewMode.value = 'list'
    // Re-initialize Sortable after switching to list mode
    nextTick(() => {
      if (!sortableInstance.value) {
        initSortable()
      }
    })
  }
}

const initSortable = () => {
  const el = document.getElementById('map-records-list') || listContainer.value
  if (el && !sortableInstance.value && viewMode.value === 'list') {
    sortableInstance.value = new Sortable(el, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'bg-gray-100',
      onEnd: (evt) => {
        // Prevent sorting when searching
        if (searchQuery.value) return

        // To make Sortable and Vue play nicely together with DOM updates,
        // we first revert Sortable's DOM manipulation.
        const itemEl = evt.item
        if (evt.newIndex !== evt.oldIndex) {
          // Move the element back to its original position in the DOM
          if (evt.oldIndex > evt.newIndex) {
            itemEl.parentNode.insertBefore(itemEl, itemEl.parentNode.children[evt.oldIndex + 1] || null)
          } else {
            itemEl.parentNode.insertBefore(itemEl, itemEl.parentNode.children[evt.oldIndex] || null)
          }
        }

        // Then let Vue handle the state and reactivity update
        const item = mapRecords.value.splice(evt.oldIndex, 1)[0]
        mapRecords.value.splice(evt.newIndex, 0, item)
        // Force reactivity update
        mapRecords.value = [...mapRecords.value]
      }
    })
  }
}

// Watch for DOM updates to initialize Sortable
watch(viewMode, async (newMode) => {
  if (newMode === 'list') {
    await nextTick()
    if (!sortableInstance.value) {
      initSortable()
    }
  }
})

watch(searchQuery, (newVal) => {
  if (sortableInstance.value) {
    sortableInstance.value.option('disabled', !!newVal)
  }
})

const filteredRecords = computed(() => {
  if (!searchQuery.value) return mapRecords.value
  const query = searchQuery.value.toLowerCase()
  return mapRecords.value.filter(record => {
    if (record.type !== 'record') return true // keep comments/raw when filtering? Maybe hide them.
    // Actually, when searching, better to hide non-records.
    if (record.type !== 'record') return false
    return (record.source && record.source.toLowerCase().includes(query)) ||
           (record.alias && record.alias.toLowerCase().includes(query))
  })
})

const getOriginalIndex = (record) => {
  return mapRecords.value.indexOf(record)
}

const startAdd = () => {
  isAdding.value = true
  editingIndex.value = -1
  editRecord.value = { id: null, source: '', params: '', alias: '' }
}

const startEdit = (index) => {
  isAdding.value = false
  editingIndex.value = index
  const record = mapRecords.value[index]
  editRecord.value = { ...record }
}

const cancelEdit = () => {
  isAdding.value = false
  editingIndex.value = -1
}

const saveEdit = () => {
  if (!editRecord.value.source.trim()) {
    alert('站名不能为空')
    return
  }

  const newRecord = {
    id: isAdding.value ? nextId++ : editRecord.value.id,
    type: 'record',
    source: editRecord.value.source.trim(),
    params: editRecord.value.params.trim(),
    alias: editRecord.value.alias.trim()
  }

  if (isAdding.value) {
    mapRecords.value.push(newRecord)
  } else if (editingIndex.value >= 0) {
    mapRecords.value[editingIndex.value] = newRecord
  }

  cancelEdit()
}

const deleteRecord = (index) => {
  if (confirm('确定要删除这条映射记录吗？')) {
    mapRecords.value.splice(index, 1)
  }
}
</script>

<template>
  <div class="map-page">
    <div class="map-header">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold flex items-center gap-2">
            站源映射管理
            <span v-if="hasUnsavedChanges" class="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full font-normal whitespace-nowrap">未保存</span>
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            管理 config/map.txt 别名映射配置
          </p>
        </div>
        <div class="flex items-center gap-2">
          <label v-if="viewMode === 'editor'" class="flex items-center gap-2 cursor-pointer mr-2 text-sm text-gray-600 dark:text-gray-300 select-none">
            <input type="checkbox" v-model="wordWrap" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            自动换行
          </label>
          <button
            @click="toggleViewMode"
            class="btn btn-secondary"
          >
            <svg v-if="viewMode === 'list'" class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            {{ viewMode === 'list' ? '文本编辑模式' : '列表模式' }}
          </button>
          <button
            @click="saveMapFile"
            :disabled="saving"
            class="btn btn-primary"
          >
            <svg v-if="saving" class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            保存配置
          </button>
        </div>
      </div>
    </div>

    <div class="map-content flex-1 flex flex-col min-h-0 mt-4">
      <div v-if="loading" class="flex-1 flex justify-center items-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>

      <!-- Editor Mode -->
      <div v-else-if="viewMode === 'editor'" class="flex-1 card p-0 overflow-hidden flex flex-col">
        <vue-monaco-editor
          v-model:value="mapContent"
          language="plaintext"
          :theme="themeStore.isDark ? 'vs-dark' : 'vs'"
          :options="editorOptions"
          class="flex-1 w-full"
        />
      </div>

      <!-- List Mode -->
      <div v-else class="flex-1 flex flex-col min-h-0">
        <div class="mb-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <button @click="startAdd" class="btn btn-primary whitespace-nowrap" :disabled="isAdding || editingIndex >= 0">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            添加映射
          </button>
          <div class="relative w-full sm:w-64 flex-shrink-0">
            <input v-model="searchQuery" type="text" class="input w-full pl-9 pr-8" placeholder="搜索站名或别名..." />
            <svg class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <button 
              v-if="searchQuery" 
              @click="searchQuery = ''"
              class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Edit Form -->
        <div v-if="isAdding || editingIndex >= 0" class="card p-4 mb-4 border-primary-200 dark:border-primary-800 border-2">
          <h3 class="text-lg font-medium mb-4">{{ isAdding ? '添加映射记录' : '编辑映射记录' }}</h3>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
            <div class="md:col-span-3">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">站名 (必填)</label>
              <input v-model="editRecord.source" type="text" class="input w-full" placeholder="例如: webdav[盘]" />
            </div>
            <div class="md:col-span-3">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">别名</label>
              <input v-model="editRecord.alias" type="text" class="input w-full" placeholder="例如: WebDav[盘]" />
            </div>
            <div class="md:col-span-6">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">参数</label>
              <textarea v-model="editRecord.params" class="input w-full resize-y min-h-[42px]" rows="2" placeholder="例如: ?render=1&type=url&params=..."></textarea>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button @click="cancelEdit" class="btn btn-secondary">取消</button>
            <button @click="saveEdit" class="btn btn-primary">确定</button>
          </div>
        </div>

        <div class="card overflow-hidden flex-1 flex flex-col relative">
          <div v-if="filteredRecords.length === 0" class="absolute inset-0 flex justify-center items-center text-gray-500 z-10 pointer-events-none">
            暂无映射记录
          </div>
          <div class="overflow-auto flex-1 relative flex flex-col" :class="{'overflow-hidden': filteredRecords.length === 0}">
            <div class="min-w-[700px] flex-1 flex flex-col">
              <div class="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700 grid grid-cols-12 gap-2 font-medium text-sm text-gray-500">
                <div class="col-span-1 text-center min-w-[40px]">排序</div>
                <div class="col-span-2">站名</div>
                <div class="col-span-2">别名</div>
                <div class="col-span-6">参数</div>
                <div class="col-span-1 text-right sticky right-0 bg-gray-50 dark:bg-gray-800/50 px-2 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">操作</div>
              </div>
              
              <div class="p-2 flex-1 relative" ref="listContainer" id="map-records-list">
                <template v-for="record in filteredRecords" :key="record.id">
                  <!-- Regular Record -->
                  <div v-if="record.type === 'record'" class="group flex items-center px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg mb-1 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 bg-white dark:bg-gray-800 transition-colors" :data-id="record.id">
                    <div class="grid grid-cols-12 gap-2 w-full items-center">
                      <div class="col-span-1 flex justify-center min-w-[40px]">
                        <button class="drag-handle p-1 text-gray-400 hover:text-gray-600 cursor-move" :class="{'cursor-not-allowed opacity-50': searchQuery}">
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                          </svg>
                        </button>
                      </div>
                      <div class="col-span-2 font-medium truncate text-gray-900 dark:text-gray-100" :title="record.source">
                        {{ record.source }}
                      </div>
                      <div class="col-span-2 text-primary-600 dark:text-primary-400 truncate" :title="record.alias">
                        {{ record.alias || '-' }}
                      </div>
                      <div class="col-span-6 font-mono text-xs text-gray-500 truncate" :title="record.params">
                        {{ record.params || '-' }}
                      </div>
                      <div class="col-span-1 flex justify-end gap-1 transition-opacity sticky right-0 px-2 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/50 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
                        <button @click="startEdit(getOriginalIndex(record))" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="编辑">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button @click="deleteRecord(getOriginalIndex(record))" class="p-1.5 text-red-600 hover:bg-red-50 rounded" title="删除">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <!-- Non-record line (comments, empty lines) -->
                  <div v-else class="px-4 py-2 text-gray-400 text-sm italic font-mono mb-1 bg-gray-50/50 dark:bg-gray-800/30 rounded">
                    {{ record.raw }}
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 8rem - 4rem);
  min-height: 500px;
}

.map-header {
  flex-shrink: 0;
}
</style>