<script setup>
import { ref, computed, onMounted } from 'vue'
import { systemApi } from '../api/system'

const apiList = ref([])
const loading = ref(false)
const expandedCategory = ref(null)
const searchQuery = ref('')

onMounted(async () => {
  await loadApiList()
})

const loadApiList = async () => {
  loading.value = true
  try {
    const result = await systemApi.getApiList()
    apiList.value = result || []
  } catch (e) {
    console.error('Failed to load API list:', e)
  } finally {
    loading.value = false
  }
}

const filteredCategories = computed(() => {
  if (!searchQuery.value) return apiList.value

  return apiList.value.map(category => ({
    ...category,
    endpoints: category.endpoints.filter(endpoint => {
      const searchLower = searchQuery.value.toLowerCase()
      return endpoint.path?.toLowerCase().includes(searchLower) ||
             endpoint.description?.toLowerCase().includes(searchLower) ||
             endpoint.method?.toLowerCase().includes(searchLower)
    })
  })).filter(category => category.endpoints.length > 0)
})

const toggleCategory = (category) => {
  if (expandedCategory.value === category) {
    expandedCategory.value = null
  } else {
    expandedCategory.value = category
  }
}

const getMethodColor = (method) => {
  const m = method?.toUpperCase()
  switch (m) {
    case 'GET': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'POST': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'PUT': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'ALL': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-xl font-semibold">API 文档</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        drpy-node 可用的 API 接口文档
      </p>
    </div>

    <!-- Search -->
    <div class="card p-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索 API 端点..."
        class="input"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>

    <!-- API list -->
    <div v-else class="space-y-4">
      <div
        v-for="category in filteredCategories"
        :key="category.category"
        class="card overflow-hidden"
      >
        <button
          @click="toggleCategory(category.category)"
          class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">
            {{ category.category }}
          </h3>
          <svg
            class="w-5 h-5 text-gray-500 transition-transform"
            :class="{ 'rotate-180': expandedCategory === category.category }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div
          v-if="expandedCategory === category.category"
          class="divide-y divide-gray-200 dark:divide-gray-700"
        >
          <div
            v-for="endpoint in category.endpoints"
            :key="endpoint.path"
            class="p-6"
          >
            <div class="flex items-start gap-4">
              <!-- Method badge -->
              <span
                class="px-2.5 py-1 rounded text-xs font-bold flex-shrink-0"
                :class="getMethodColor(endpoint.method)"
              >
                {{ endpoint.method }}
              </span>

              <!-- Path & description -->
              <div class="flex-1 min-w-0">
                <code class="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                  {{ endpoint.path }}
                </code>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {{ endpoint.description }}
                </p>

                <!-- Parameters -->
                <div v-if="endpoint.params && Object.keys(endpoint.params).length > 0" class="mt-4">
                  <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">参数</h4>
                  <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2">
                    <div
                      v-for="(param, key) in endpoint.params"
                      :key="key"
                      class="flex items-start gap-3 text-sm"
                    >
                      <code class="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono flex-shrink-0">
                        {{ param.type || key }}
                      </code>
                      <div class="flex-1 min-w-0">
                        <span class="font-medium text-gray-900 dark:text-gray-100">{{ key }}</span>
                        <span
                          v-if="param.required"
                          class="ml-2 text-red-600 dark:text-red-400 text-xs"
                        >*</span>
                        <p class="text-gray-600 dark:text-gray-400 mt-0.5">
                          {{ param.description }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
