<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fileApi } from '../api/file'

const router = useRouter()
const loading = ref(false)
const jxFiles = ref([])

onMounted(async () => {
  await loadJxFiles()
})

const loadJxFiles = async () => {
  loading.value = true
  try {
    const result = await fileApi.listDirectory('jx')
    jxFiles.value = (result.files || []).filter(f => !f.isDirectory && f.name.endsWith('.js'))
  } catch (e) {
    console.error('Load jx files error:', e)
    // Maybe the directory doesn't exist, we can ignore or show empty
    jxFiles.value = []
  } finally {
    loading.value = false
  }
}

const editConfig = () => {
  router.push({
    name: 'source-editor',
    query: { path: 'config/parses.conf' }
  })
}

const editFile = (file) => {
  router.push({
    name: 'source-editor',
    query: { path: `jx/${file.name}` }
  })
}
</script>

<template>
  <div class="parses-page">
    <div class="parses-header">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold">解析管理</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            管理系统解析配置文件及 jx 目录下的解析脚本
          </p>
        </div>
        <button
          @click="loadJxFiles"
          :disabled="loading"
          class="btn btn-secondary"
        >
          <svg v-if="loading" class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>
    </div>

    <div class="parses-content space-y-6 mt-6">
      <!-- 配置文件管理 -->
      <section>
        <h3 class="text-lg font-medium mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          全局解析配置
        </h3>
        <div class="card p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer" @click="editConfig">
          <div class="flex items-center gap-3">
            <svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <h4 class="font-medium text-gray-900 dark:text-gray-100">parses.conf</h4>
              <p class="text-sm text-gray-500 dark:text-gray-400">drpy-node/config/parses.conf</p>
            </div>
          </div>
          <button class="btn btn-secondary text-sm">
            编辑
          </button>
        </div>
      </section>

      <!-- JX 目录管理 -->
      <section>
        <h3 class="text-lg font-medium mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          JS 解析脚本 (jx 目录)
        </h3>
        
        <div v-if="loading" class="flex justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>

        <div v-else-if="jxFiles.length === 0" class="card p-8 text-center text-gray-500 dark:text-gray-400">
          jx 目录下没有找到 JS 解析脚本
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="file in jxFiles"
            :key="file.name"
            class="card p-4 hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-primary-200 dark:hover:border-primary-800"
            @click="editFile(file)"
          >
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                  <span class="text-yellow-600 dark:text-yellow-500 font-bold text-sm">JS</span>
                </div>
                <div class="min-w-0">
                  <h4 class="font-medium text-gray-900 dark:text-gray-100 truncate" :title="file.name">
                    {{ file.name }}
                  </h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ (file.size / 1024).toFixed(2) }} KB
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.parses-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 8rem - 4rem);
  min-height: 500px;
}

.parses-header {
  flex-shrink: 0;
  padding-bottom: 1rem;
}

.parses-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>