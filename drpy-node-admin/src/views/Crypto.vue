<script setup>
import { ref } from 'vue'
import apiClient from '../api/client'
import copy from 'clipboard-copy'

const inputCode = ref('')
const outputCode = ref('')
const cryptoType = ref('base64')
const authCode = ref('')
const loading = ref(false)
const error = ref('')

const cryptoOptions = [
  { value: 'base64', label: 'Base64' },
  { value: 'gzip', label: 'Gzip' },
  { value: 'aes', label: 'AES' },
  { value: 'rsa', label: 'RSA' },
  { value: 'drpy', label: 'Drpy源解密' }
]

const handleCopy = async () => {
  if (!outputCode.value) return
  try {
    await copy(outputCode.value)
    alert('复制成功')
  } catch (e) {
    console.error('复制失败:', e)
    alert('复制失败')
  }
}

const handleEncode = async () => {
  if (!inputCode.value) {
    error.value = '请输入需要加密的文本'
    return
  }

  loading.value = true
  error.value = ''
  outputCode.value = ''

  try {
    const data = await apiClient.post('/encoder', {
      type: cryptoType.value,
      code: inputCode.value
    })
    
    if (data.error) {
      throw new Error(data.error)
    }
    outputCode.value = data.result
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const handleDecode = async () => {
  if (!inputCode.value) {
    error.value = '请输入需要解密的文本'
    return
  }

  loading.value = true
  error.value = ''
  outputCode.value = ''

  try {
    if (cryptoType.value === 'drpy') {
      if (!authCode.value) {
        error.value = 'Drpy源解密需要提供 Auth Code'
        loading.value = false
        return
      }
      
      const data = await apiClient.post('/decoder', {
        auth_code: authCode.value,
        code: inputCode.value
      })
      
      if (data.error) {
         throw new Error(data.error)
      }
      outputCode.value = data.result
    } else {
      // 其他类型解密
      const data = await apiClient.post('/api/admin/crypto/decode', {
        type: cryptoType.value,
        code: inputCode.value
      })
      
      if (data.error) {
         throw new Error(data.error)
      }
      outputCode.value = data.result
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
const clearInput = () => {
  inputCode.value = ''
}

const clearOutput = () => {
  outputCode.value = ''
}
</script>

<template>
  <div class="crypto-page">
    <!-- Sticky Header Section -->
    <div class="crypto-header">
      <!-- Header -->
      <div>
        <h2 class="text-xl font-semibold">加解密工具</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          提供项目中常用的文本加解密和编码转换功能
        </p>
      </div>

      <!-- Options -->
      <div class="card p-4 mt-4">
        <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">加密方式</label>
            <div class="relative">
              <select 
                v-model="cryptoType"
                class="input w-40 appearance-none pr-8 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-primary-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-lg shadow-sm transition-colors text-sm"
              >
                <option v-for="opt in cryptoOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          <div v-if="cryptoType === 'drpy'" class="flex items-center gap-2 flex-1 w-full sm:w-auto">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">授权码</label>
            <input 
              v-model="authCode" 
              type="text" 
              class="input flex-1" 
              placeholder="输入 Auth Code"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="crypto-content">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
        <!-- Input -->
        <div class="card flex flex-col overflow-hidden h-[400px] lg:h-full">
          <div class="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">输入文本</span>
              <button @click="clearInput" v-if="inputCode" class="text-xs text-gray-400 hover:text-red-500 transition-colors" title="清空">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <div class="flex gap-2">
              <button 
                v-if="cryptoType !== 'drpy'"
                @click="handleEncode" 
                :disabled="loading"
                class="btn btn-primary px-3 py-1.5 text-xs sm:text-sm"
              >
                加密 / 编码
              </button>
              <button 
                @click="handleDecode" 
                :disabled="loading"
                class="btn btn-secondary px-3 py-1.5 text-xs sm:text-sm"
              >
                解密 / 解码
              </button>
            </div>
          </div>
          <div class="flex-1 p-0 relative">
            <textarea
              v-model="inputCode"
              class="absolute inset-0 w-full h-full p-3 bg-white dark:bg-gray-900 border-0 font-mono text-sm resize-none focus:ring-0"
              placeholder="在此输入待处理的文本..."
              spellcheck="false"
            ></textarea>
          </div>
        </div>

        <!-- Output -->
        <div class="card flex flex-col overflow-hidden h-[400px] lg:h-full">
          <div class="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">输出结果</span>
              <button @click="clearOutput" v-if="outputCode" class="text-xs text-gray-400 hover:text-red-500 transition-colors" title="清空">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <button 
              @click="handleCopy"
              :disabled="!outputCode"
              class="btn btn-secondary px-3 py-1.5 text-xs sm:text-sm"
            >
              复制结果
            </button>
          </div>
          <div class="flex-1 p-0 relative">
            <!-- Error Message overlay -->
            <div v-if="error" class="absolute inset-x-0 top-0 z-10 p-3 bg-red-50 dark:bg-red-900/90 text-red-600 dark:text-red-200 text-sm border-b border-red-100 dark:border-red-800">
              {{ error }}
            </div>
            <textarea
              v-model="outputCode"
              class="absolute inset-0 w-full h-full p-3 bg-gray-50/50 dark:bg-gray-900/50 border-0 font-mono text-sm resize-none focus:ring-0"
              readonly
              placeholder="处理结果将显示在这里..."
              spellcheck="false"
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.crypto-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 8rem - 4rem);
  min-height: 500px;
}

.crypto-header {
  flex-shrink: 0;
  padding-bottom: 1rem;
}

.crypto-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>
