<script setup>
import { ref } from 'vue'
import { dbApi } from '../api/db'

const sqlQuery = ref('')

// Page layout refs for sticky header
const pageContainer = ref(null)
const queryResult = ref(null)
const loading = ref(false)
const error = ref(null)

// Example queries
const exampleQueries = [
  { name: '查看所有表', sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" },
  { name: '查看表结构', sql: "PRAGMA table_info(table_name);" },
  { name: '查询前10条记录', sql: "SELECT * FROM table_name LIMIT 10;" },
]

const executeQuery = async () => {
  if (!sqlQuery.value.trim()) {
    return
  }

  loading.value = true
  error.value = null
  queryResult.value = null

  try {
    const result = await dbApi.query(sqlQuery.value)
    queryResult.value = result
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const useExample = (sql) => {
  sqlQuery.value = sql
}
</script>

<template>
  <div class="database-page">
    <!-- Sticky Header Section -->
    <div class="database-header">
      <!-- Header -->
      <div>
        <h2 class="text-xl font-semibold">数据库查询</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          执行只读 SQL 查询
        </p>
      </div>

      <!-- Example queries -->
      <div class="card p-4">
        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">示例查询</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="example in exampleQueries"
            :key="example.name"
            @click="useExample(example.sql)"
            class="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {{ example.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="database-content">
      <!-- Query editor -->
      <div class="card overflow-hidden">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <textarea
            v-model="sqlQuery"
            placeholder="输入 SQL 查询语句..."
            class="w-full min-h-[120px] p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            spellcheck="false"
            @keydown.ctrl.enter="executeQuery"
            @keydown.meta.enter="executeQuery"
          />
          <div class="flex items-center justify-between mt-3">
            <span class="text-xs text-gray-500">
              按 Ctrl+Enter 执行查询
            </span>
            <button
              @click="executeQuery"
              :disabled="loading || !sqlQuery.trim()"
              class="btn btn-primary"
            >
              <svg v-if="loading" class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              执行查询
            </button>
          </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <p class="text-red-600 dark:text-red-400 font-mono text-sm">{{ error }}</p>
        </div>

        <!-- Results -->
        <div v-if="queryResult" class="overflow-x-auto">
        <div v-if="Array.isArray(queryResult) && queryResult.length > 0" class="min-w-full">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th
                  v-for="column in Object.keys(queryResult[0])"
                  :key="column"
                  class="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                >
                  {{ column }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="(row, index) in queryResult"
                :key="index"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/30"
              >
                <td
                  v-for="column in Object.keys(queryResult[0])"
                  :key="column"
                  class="px-4 py-3 font-mono text-gray-900 dark:text-gray-100"
                >
                  {{ row[column] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="p-8 text-center text-gray-500">
          查询成功，无结果返回
        </div>

        <!-- Result stats -->
        <div v-if="queryResult && Array.isArray(queryResult)" class="p-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          查询返回 {{ queryResult.length }} 行结果
        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.database-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 8rem - 4rem);
  min-height: 500px;
}

.database-header {
  flex-shrink: 0;
  padding-bottom: 1rem;
}

.database-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>
