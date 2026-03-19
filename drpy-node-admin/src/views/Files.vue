<script setup>
import { ref, computed, onMounted } from 'vue'
import { fileApi } from '../api/file'

const currentPath = ref('.')
const files = ref([])
const loading = ref(false)
const selectedFile = ref(null)
const fileContent = ref('')
const fileType = ref('text') // 'text', 'image', or 'unsupported'
const imageDataUrl = ref('')

// Page layout refs for sticky header
const pageContainer = ref(null)

// 支持的文件类型
const SUPPORTED_TEXT_EXTENSIONS = new Set([
  'js', 'json', 'md', 'txt', 'html', 'htm', 'css', 'scss', 'less', 'xml', 'py', 'php',
  'ts', 'vue', 'jsx', 'tsx', 'yaml', 'yml', 'ini', 'conf', 'config', 'env',
  'gitignore', 'eslintrc', 'prettierrc', 'babelrc', 'editorconfig',
  'lock', 'csv', 'sql', 'sh', 'bat', 'cmd', 'ps1', 'log', 'out', 'err',
  'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'java', 'kt', 'dart', 'swift',
  'properties', 'toml', 'pom', 'gradle'
])

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff', 'tif'
])

const EXACT_TEXT_FILES = new Set([
  'license', 'makefile', 'dockerfile', 'caddyfile', 'readme', 'changelog', 'authors'
])

const getFileType = (fileName) => {
  const nameLower = fileName.toLowerCase()
  let ext = ''
  if (nameLower.includes('.')) {
    ext = nameLower.split('.').pop()
  }
  
  if (ext && SUPPORTED_IMAGE_EXTENSIONS.has(ext)) return 'image'
  if ((ext && SUPPORTED_TEXT_EXTENSIONS.has(ext)) || EXACT_TEXT_FILES.has(nameLower)) return 'text'
  return 'unsupported'
}

const isSupportedFile = (fileName) => {
  return getFileType(fileName) !== 'unsupported'
}

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
  fileType.value = 'text'
  imageDataUrl.value = ''

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

  // 检查文件类型
  const type = getFileType(file.name)
  if (type === 'unsupported') {
    selectedFile.value = file
    fileType.value = 'unsupported'
    fileContent.value = ''
    imageDataUrl.value = ''
    return
  }

  loading.value = true
  try {
    const result = await fileApi.readFile(file.path)
    console.log('File read result:', typeof result, result)
    selectedFile.value = file
    fileType.value = type

    // 处理新的返回格式：{ type: 'text', content: '...' } 或 { type: 'image', dataUrl: '...' }
    if (type === 'image') {
      // Image file
      if (typeof result === 'string') {
        imageDataUrl.value = result
      } else if (result?.type === 'image' && result.dataUrl) {
        imageDataUrl.value = result.dataUrl
      } else {
        imageDataUrl.value = result || ''
      }
      fileContent.value = ''
    } else {
      // Text file
      if (typeof result === 'string') {
        fileContent.value = result
      } else if (result?.type === 'text' && result.content) {
        fileContent.value = result.content
      } else {
        fileContent.value = String(result || '')
      }
      imageDataUrl.value = ''
    }
  } catch (e) {
    console.error('Read file error:', e)
    alert('读取文件失败: ' + e.message)
    selectedFile.value = null
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
  <div class="files-page">
    <!-- Sticky Header Section -->
    <div class="files-header">
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
    </div>

    <!-- Scrollable Content -->
    <div class="files-content">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        <!-- File list -->
        <div class="card flex flex-col h-full overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <h3 class="font-semibold">文件列表</h3>
          </div>
          <div class="divide-y divide-gray-200 dark:divide-gray-700 flex-1 overflow-y-auto">
            <div v-if="loading" class="p-12 text-center">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>

            <div
              v-for="file in files"
              :key="file.name"
              @click="file.isDirectory ? loadDirectory(file.path) : openFile(file)"
              class="px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors flex items-center gap-3"
              :class="{ 'opacity-50': !file.isDirectory && !isSupportedFile(file.name) }"
            >
              <span class="text-xl">{{ getFileIcon(file) }}</span>
              <span class="flex-1 truncate" :class="{ 'font-medium': file.isDirectory }">
                {{ file.name }}
              </span>
              <span v-if="file.isDirectory" class="badge badge-info text-xs shrink-0">DIR</span>
              <span v-else-if="!isSupportedFile(file.name)" class="badge badge-gray text-xs shrink-0">不支持预览</span>
              <span v-else class="text-xs text-gray-500 shrink-0">{{ file.size || '' }}</span>
            </div>

            <div v-if="!loading && files.length === 0" class="p-12 text-center text-gray-500">
              此目录为空
            </div>
          </div>
        </div>

        <!-- File preview (PC) -->
        <div class="card hidden lg:flex flex-col h-full overflow-hidden">
          <div v-if="selectedFile" class="h-full flex flex-col">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
              <div class="flex items-center gap-3 overflow-hidden">
                <span class="text-xl shrink-0">{{ getFileIcon(selectedFile) }}</span>
                <div class="min-w-0">
                  <h3 class="font-semibold truncate">{{ selectedFile.name }}</h3>
                  <p class="text-xs text-gray-500 truncate">{{ selectedFile.path }}</p>
                </div>
              </div>
              <button @click="closeFile" class="p-2 shrink-0 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
              <!-- Unsupported file type -->
              <div v-if="fileType === 'unsupported'" class="h-full flex items-center justify-center">
                <div class="text-center">
                  <svg class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 18.364m12.728-12.728L9 9m0 0l3 3m-3-3l3-3m-3 3h12" />
                  </svg>
                  <p class="text-lg font-medium text-gray-700 dark:text-gray-300">暂不支持预览此文件类型</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    支持的文件类型：文本文件 (.js, .json, .md, .txt 等) 和 图片文件 (.png, .jpg, .svg 等)
                  </p>
                </div>
              </div>
              <!-- Image preview -->
              <img v-else-if="fileType === 'image'" :src="imageDataUrl" :alt="selectedFile?.name" class="max-w-full h-auto mx-auto" />
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

    <!-- Mobile File Preview Modal -->
    <div v-if="selectedFile" class="fixed inset-0 z-50 flex lg:hidden items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full h-full max-h-[90vh] flex flex-col overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3 overflow-hidden">
            <span class="text-xl shrink-0">{{ getFileIcon(selectedFile) }}</span>
            <div class="min-w-0">
              <h3 class="font-semibold truncate">{{ selectedFile.name }}</h3>
              <p class="text-xs text-gray-500 truncate">{{ selectedFile.path }}</p>
            </div>
          </div>
          <button @click="closeFile" class="p-2 shrink-0 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
          <!-- Unsupported file type -->
          <div v-if="fileType === 'unsupported'" class="h-full flex items-center justify-center">
            <div class="text-center">
              <svg class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 18.364m12.728-12.728L9 9m0 0l3 3m-3-3l3-3m-3 3h12" />
              </svg>
              <p class="text-lg font-medium text-gray-700 dark:text-gray-300">暂不支持预览此文件类型</p>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                支持的文件类型：文本文件 和 图片文件
              </p>
            </div>
          </div>
          <!-- Image preview -->
          <img v-else-if="fileType === 'image'" :src="imageDataUrl" :alt="selectedFile?.name" class="max-w-full h-auto mx-auto" />
          <!-- Text preview -->
          <pre v-else class="text-sm font-mono whitespace-pre-wrap break-words">{{ fileContent }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.files-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 6rem);
  min-height: 500px;
}

.files-header {
  flex-shrink: 0;
  padding-bottom: 1rem;
}

.files-content {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
</style>
