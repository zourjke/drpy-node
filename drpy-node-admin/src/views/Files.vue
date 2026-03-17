<script setup>
import { ref, computed, onMounted } from 'vue'
import { fileApi } from '../api/file'

const currentPath = ref('.')
const files = ref([])
const loading = ref(false)
const selectedFile = ref(null)
const fileContent = ref('')
const fileType = ref('text') // 'text' or 'image'
const imageDataUrl = ref('')

const pathParts = computed(() => {
  const parts = currentPath.value.split('/').filter(Boolean)
  return [{ name: '根目录', path: '.' }, ...parts.map((part, i) => ({
    name: part,
    path: parts.slice(0, i + 1).join('/')
  }))]
})

const isSafePath = (path) => {
  // Prevent directory traversal
  return !path.includes('..') && !path.startsWith('~')
}

onMounted(() => {
  loadDirectory('.')
})

const loadDirectory = async (path) => {
  if (!isSafePath(path)) {
    alert('不安全的路径')
    return
  }

  loading.value = true
  currentPath.value = path
  selectedFile.value = null
  fileContent.value = ''

  try {
    const result = await fileApi.listDirectory(path)
    files.value = result.files || []
  } catch (e) {
    alert('加载目录失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

const openFile = async (file) => {
  if (!isSafePath(file.path)) {
    alert('不安全的路径')
    return
  }

  loading.value = true
  try {
    const result = await fileApi.readFile(file.path)
    selectedFile.value = file

    // Parse the response
    if (typeof result === 'string') {
      // Legacy response format (direct text)
      fileContent.value = result
      fileType.value = 'text'
    } else if (result.type === 'image') {
      // Image file
      fileType.value = 'image'
      imageDataUrl.value = result.dataUrl
      fileContent.value = ''
    } else {
      // Text file
      fileType.value = 'text'
      fileContent.value = result.content || ''
    }
  } catch (e) {
    alert('读取文件失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

const closeFile = () => {
  selectedFile.value = null
  fileContent.value = ''
  fileType.value = 'text'
  imageDataUrl.value = ''
}

const getFileIcon = (file) => {
  if (file.isDirectory) {
    return '📁'
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  const icons = {
    js: '📜',
    json: '📋',
    md: '📝',
    txt: '📄',
    html: '🌐',
    css: '🎨',
    png: '🖼️',
    jpg: '🖼️',
    svg: '🎭',
    gif: '🎞️'
  }
  return icons[ext] || '📄'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-xl font-semibold">文件管理</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        浏览和编辑项目文件
      </p>
    </div>

    <!-- Breadcrumb -->
    <div class="card p-4">
      <nav class="flex items-center gap-2 text-sm overflow-x-auto">
        <button
          v-for="(part, index) in pathParts"
          :key="part.path"
          @click="loadDirectory(part.path)"
          class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
          :class="{ 'font-medium': index === pathParts.length - 1 }"
        >
          {{ part.name }}
          <svg v-if="index < pathParts.length - 1" class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </nav>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- File list -->
      <div class="card overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="font-semibold">文件列表</h3>
        </div>
        <div class="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
          <div v-if="loading" class="p-12 text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>

          <div
            v-for="file in files"
            :key="file.name"
            @click="file.isDirectory ? loadDirectory(file.path) : openFile(file)"
            class="px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors flex items-center gap-3"
          >
            <span class="text-xl">{{ getFileIcon(file) }}</span>
            <span class="flex-1 truncate" :class="{ 'font-medium': file.isDirectory }">
              {{ file.name }}
            </span>
            <span v-if="file.isDirectory" class="badge badge-info text-xs">DIR</span>
            <span v-else class="text-xs text-gray-500">{{ file.size || '' }}</span>
          </div>

          <div v-if="!loading && files.length === 0" class="p-12 text-center text-gray-500">
            此目录为空
          </div>
        </div>
      </div>

      <!-- File preview -->
      <div class="card overflow-hidden">
        <div v-if="selectedFile" class="h-full flex flex-col">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-xl">{{ getFileIcon(selectedFile) }}</span>
              <div>
                <h3 class="font-semibold">{{ selectedFile.name }}</h3>
                <p class="text-xs text-gray-500">{{ selectedFile.path }}</p>
              </div>
            </div>
            <button @click="closeFile" class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            <!-- Image preview -->
            <img v-if="fileType === 'image'" :src="imageDataUrl" :alt="selectedFile?.name" class="max-w-full h-auto" />
            <!-- Text preview -->
            <pre v-else class="text-sm font-mono whitespace-pre-wrap break-words">{{ fileContent }}</pre>
          </div>
        </div>
        <div v-else class="h-full flex items-center justify-center p-12 text-gray-500">
          <div class="text-center">
            <svg class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>选择一个文件查看内容</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
