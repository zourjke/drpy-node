<script setup>
import { ref, computed, onMounted } from 'vue'
import { useConfigStore } from '../stores/config'

const configStore = useConfigStore()
const editingKey = ref(null)
const editValue = ref('')

// Config categories and descriptions
const configDescriptions = {
  // Cloud Storage
  quark_cookie: '夸克网盘 Cookie，用于夸克网盘资源解析',
  uc_cookie: 'UC 网盘 Cookie',
  ali_token: '阿里云盘 Token',
  ali_refresh_token: '阿里云盘刷新令牌',
  pikpak_token: 'PikPak Token',

  // Video Platform
  bili_cookie: 'Bilibili Cookie，用于 B站资源解析',

  // AI Services
  spark_ai_authKey: '讯飞星火 AI 认证密钥',
  deepseek_apiKey: 'DeepSeek API 密钥',
  kimi_apiKey: 'Kimi API 密钥',
  now_ai: '当前使用的 AI 服务 (1=讯飞, 2=DeepSeek, 3=Kimi)',
  sparkBotObject: '讯飞机器人配置对象',

  // Proxy Settings
  enable_system_proxy: '启用系统代理 (0=禁用, 1=启用)',
  PROXY_AUTH: '代理认证密码',
  play_proxy_mode: '播放代理模式',
  play_local_proxy_type: '本地代理类型',

  // Cloud Account
  cloud_account: '云盘账号',
  cloud_password: '云盘密码',
  cloud_cookie: '云盘 Cookie',
  pan_passport: '网盘账号',
  pan_password: '网盘密码',
  pan_auth: '网盘认证令牌',

  // Other Settings
  thread: '并发线程数',
  api_pwd: 'API 访问密码',
  allow_forward: '允许转发 (0=禁用, 1=启用)',
  link_url: '链接推送 URL',
  enable_link_data: '启用链接数据',
  enable_link_push: '启用链接推送',
  enable_link_jar: '启用 JAR 链接',
  mg_hz: 'MG 赫兹设置',
  baidu_cookie: '百度 Cookie，用于百度网盘',

  // Engine Settings
  enable_dr2: '启用 DR2 引擎 (0=禁用, 1=启用)',
  enable_py: '启用 Python 引擎 (0=禁用, 1=启用, 2=自动)',
  enable_php: '启用 PHP 引擎 (0=禁用, 1=启用)',
  enable_cat: '启用 CatVod 引擎 (0=禁用, 1=启用, 2=自动)',
  enable_old_config: '启用旧配置格式',

  // Debug
  show_curl: '显示 cURL 命令',
  show_req: '显示请求详情',
  hide_adult: '隐藏成人内容 (0=显示, 1=隐藏)',
  enable_self_jx: '启用自建解析',
  cat_sub_code: 'CatVod 订阅代码'
}

// Group configs by category
const groupedConfigs = computed(() => {
  if (!configStore.config) return {}

  const groups = {
    '云盘配置': ['quark_cookie', 'uc_cookie', 'ali_token', 'ali_refresh_token', 'pikpak_token', 'cloud_account', 'cloud_password', 'cloud_cookie', 'pan_passport', 'pan_password', 'pan_auth'],
    '视频平台': ['bili_cookie', 'baidu_cookie'],
    'AI 服务': ['spark_ai_authKey', 'deepseek_apiKey', 'kimi_apiKey', 'now_ai', 'sparkBotObject'],
    '代理设置': ['enable_system_proxy', 'PROXY_AUTH', 'play_proxy_mode', 'play_local_proxy_type'],
    '引擎设置': ['enable_dr2', 'enable_py', 'enable_php', 'enable_cat', 'enable_old_config'],
    '其他设置': ['thread', 'api_pwd', 'allow_forward', 'link_url', 'enable_link_data', 'enable_link_push', 'enable_link_jar', 'mg_hz', 'show_curl', 'show_req', 'hide_adult', 'enable_self_jx', 'cat_sub_code']
  }

  const result = {}
  for (const [groupName, keys] of Object.entries(groups)) {
    result[groupName] = {}
    for (const key of keys) {
      if (configStore.config && key in configStore.config) {
        result[groupName][key] = configStore.config[key]
      }
    }
  }

  return result
})

onMounted(() => {
  configStore.fetchConfig()
})

const startEdit = (key, value) => {
  editingKey.value = key
  editValue.value = value
}

const cancelEdit = () => {
  editingKey.value = null
  editValue.value = ''
}

const saveEdit = async (key) => {
  try {
    await configStore.updateConfig(key, editValue.value)
    editingKey.value = null
    editValue.value = ''
  } catch (e) {
    alert('保存失败: ' + e.message)
  }
}

const maskSensitive = (key, value) => {
  const sensitiveKeys = ['cookie', 'token', 'password', 'authKey', 'apiKey', 'auth']
  const isSensitive = sensitiveKeys.some(s => key.toLowerCase().includes(s))

  if (isSensitive && value && value.length > 8) {
    return value.substring(0, 4) + '****' + value.substring(value.length - 4)
  }
  return value
}

const getTypeIcon = (value) => {
  if (value === '0' || value === '1') return '🔢'
  if (typeof value === 'object') return '📦'
  return '📝'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">环境变量配置</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          管理 drpy-node 的环境变量和配置项
        </p>
      </div>
      <button
        @click="configStore.fetchConfig()"
        :disabled="configStore.loading"
        class="btn btn-secondary"
      >
        <svg v-if="configStore.loading" class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        刷新
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="configStore.loading && !configStore.config" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="configStore.error" class="card p-6 border-red-200 dark:border-red-800">
      <p class="text-red-600 dark:text-red-400">加载配置失败: {{ configStore.error }}</p>
    </div>

    <!-- Config groups -->
    <div v-else class="space-y-6">
      <div v-for="(configs, groupName) in groupedConfigs" :key="groupName" class="card overflow-hidden">
        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">{{ groupName }}</h3>
        </div>

        <div v-if="Object.keys(configs).length === 0" class="p-6 text-center text-gray-500 dark:text-gray-400">
          暂无配置项
        </div>

        <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
          <div
            v-for="(value, key) in configs"
            :key="key"
            class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
          >
            <div class="flex items-start gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-lg">{{ getTypeIcon(value) }}</span>
                  <h4 class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{{ key }}</h4>
                </div>
                <p v-if="configDescriptions[key]" class="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
                  {{ configDescriptions[key] }}
                </p>

                <!-- Display value -->
                <div v-if="editingKey !== key" class="mt-2 ml-7">
                  <code class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono break-all">
                    {{ maskSensitive(key, value) }}
                  </code>
                </div>

                <!-- Edit form -->
                <div v-else class="mt-2 ml-7">
                  <textarea
                    v-model="editValue"
                    class="input min-h-[100px] font-mono text-sm"
                    :placeholder="'输入 ' + key + ' 的值'"
                  />
                  <div class="flex gap-2 mt-2">
                    <button @click="saveEdit(key)" class="btn btn-primary text-sm">
                      保存
                    </button>
                    <button @click="cancelEdit" class="btn btn-secondary text-sm">
                      取消
                    </button>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div v-if="editingKey !== key" class="flex gap-2">
                <button
                  @click="startEdit(key, value)"
                  class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="编辑"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
