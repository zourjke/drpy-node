<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fileApi } from '../api/file'
import { spiderApi } from '../api/spider'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { useThemeStore } from '../stores/theme'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()

// Page layout refs for sticky header
const pageContainer = ref(null)

const filePath = ref(route.query.path || '')
const fileContent = ref('')
const originalContent = ref('')
const loading = ref(false)
const saving = ref(false)
const validating = ref(false)
const validationError = ref(null)
const hasChanges = ref(false)

const editorLanguage = computed(() => {
  const path = filePath.value.toLowerCase()
  if (path.endsWith('.js')) return 'javascript'
  if (path.endsWith('.php')) return 'php'
  if (path.endsWith('.py')) return 'python'
  return 'javascript'
})

// Check if dark mode is active
const isDarkMode = computed(() => themeStore.isDark)


onMounted(async () => {
  if (filePath.value) {
    await loadFile()
  }
})

watch(() => route.query.path, async (newPath) => {
  if (newPath) {
    filePath.value = newPath
    await loadFile()
  }
})

watch(fileContent, () => {
  hasChanges.value = fileContent.value !== originalContent.value
})

const loadFile = async () => {
  loading.value = true
  try {
    const result = await fileApi.readFile(filePath.value)
    console.log('File loaded:', typeof result, result)

    // 处理 MCP 返回格式 { type: 'text', content: "..." } 或 { type: 'image', dataUrl: "..." }
    let content = ''
    if (typeof result === 'string') {
      content = result
    } else if (result?.type === 'text' && result.content) {
      content = result.content
    } else if (result?.type === 'image' && result.dataUrl) {
      // 图片文件，在源编辑器中不处理图片
      content = '[图片文件，无法在源编辑器中显示]'
    } else if (result?.content) {
      content = result.content
    } else {
      content = String(result || '')
    }
    console.log('File content extracted, type:', typeof content, 'length:', content?.length)
    fileContent.value = content
    originalContent.value = content
  } catch (e) {
    console.error('Load file error:', e)
    alert('加载文件失败: ' + e.message)
    fileContent.value = ''
    originalContent.value = ''
  } finally {
    loading.value = false
  }
}

const saveFile = async () => {
  saving.value = true
  try {
    await fileApi.writeFile(filePath.value, fileContent.value)
    originalContent.value = fileContent.value
    hasChanges.value = false
    alert('保存成功')
  } catch (e) {
    alert('保存失败: ' + e.message)
  } finally {
    saving.value = false
  }
}

const validateFile = async () => {
  validating.value = true
  validationError.value = null
  try {
    const result = await spiderApi.checkSyntax(filePath.value)
    if (result.isError) {
      validationError.value = result.content?.[0]?.text || '语法错误'
    } else {
      validationError.value = null
      alert('语法检查通过')
    }
  } catch (e) {
    validationError.value = e.message
  } finally {
    validating.value = false
  }
}

const getTemplate = async () => {
  try {
    const result = await spiderApi.getTemplate()
    console.log('Template loaded:', typeof result, result?.substring(0, 50))
    fileContent.value = result || ''
  } catch (e) {
    console.error('Get template error:', e)
    alert('获取模板失败: ' + e.message)
  }
}

const goBack = () => {
  router.push('/sources')
}
</script>

<template>
  <div class="editor-page">
    <!-- Sticky Header Section -->
    <div class="editor-header">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div class="flex items-center gap-4">
          <button @click="goBack" class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 class="text-xl font-semibold">源编辑器</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {{ filePath }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button
            @click="getTemplate"
            class="btn btn-secondary text-sm"
          >
            获取模板
          </button>
          <button
            @click="validateFile"
            :disabled="validating"
            class="btn btn-secondary text-sm"
          >
            <svg v-if="validating" class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            验证语法
          </button>
          <button
            @click="saveFile"
            :disabled="saving || !hasChanges"
            class="btn btn-primary text-sm"
          >
            <svg v-if="saving" class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            保存
          </button>
        </div>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="editor-content">
      <!-- Validation error -->
    <div v-if="validationError" class="card p-4 mb-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h4 class="font-medium text-red-900 dark:text-red-100">验证失败</h4>
          <pre class="mt-2 text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">{{ validationError }}</pre>
        </div>
      </div>
    </div>

    <!-- Editor -->
    <div class="card flex-1 overflow-hidden flex flex-col relative min-h-[400px]">
      <div v-if="loading" class="h-full flex items-center justify-center flex-1">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>

      <div v-else class="absolute inset-0">
        <vue-monaco-editor
          v-model:value="fileContent"
          :language="editorLanguage"
          :theme="isDarkMode ? 'vs-dark' : 'vs'"
          :options="{
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            tabSize: 4
          }"
          height="100%"
        />
      </div>
    </div>

      <!-- Status bar -->
      <div class="mt-2 flex-shrink-0 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{{ fileContent.split('\n').length }} 行</span>
        <span v-if="hasChanges" class="text-orange-600 dark:text-orange-400">有未保存的更改</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
}

.editor-header {
  flex-shrink: 0;
}

.editor-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
