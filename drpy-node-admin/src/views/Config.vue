<script setup>
import { ref, computed, onMounted } from 'vue'
import { useConfigStore } from '../stores/config'

const configStore = useConfigStore()
const editingKey = ref(null)
const editValue = ref('')

const searchQuery = ref('')
const selectedGroup = ref('全部')

// Config categories and descriptions
const configDescriptions = {
  // Cloud Storage
  quark_cookie: '夸克网盘 Cookie，用于夸克网盘资源解析',
  quark_token_cookie: '夸克网盘 Token',
  uc_cookie: 'UC 网盘 Cookie',
  uc_token_cookie: 'UC 网盘 Token',
  ali_token: '阿里云盘 Token',
  ali_refresh_token: '阿里云盘刷新令牌',
  pikpak_token: 'PikPak Token',
  xun_username: '迅雷账号',
  xun_password: '迅雷密码',
  xun_auth: '迅雷认证令牌(登录成功自动获取)',
  yun_account: '移动云盘账号',
  yun_cookie: '移动云盘 Cookie',

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
  enable_doh: '启用 DoH (0=禁用, 1=启用)',
  allow_ftp_cache_clear: '允许 FTP 缓存清理 (0=禁用, 1=启用)',
  allow_webdav_cache_clear: '允许 WebDAV 缓存清理 (0=禁用, 1=启用)',

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
  enable_rule_name: '显示规则名称 (0=禁用, 1=启用)',
  must_sub_code: '强制订阅代码 (0=禁用, 1=启用)',

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

const groups = {
  '云盘配置': ['quark_cookie', 'quark_token_cookie', 'uc_cookie', 'uc_token_cookie', 'ali_token', 'ali_refresh_token', 'pikpak_token', 'cloud_account', 'cloud_password', 'cloud_cookie', 'yun_account', 'yun_cookie', 'pan_passport', 'pan_password', 'pan_auth', 'xun_username', 'xun_password','xun_auth'],
  '视频平台': ['bili_cookie', 'baidu_cookie'],
  'AI 服务': ['spark_ai_authKey', 'deepseek_apiKey', 'kimi_apiKey', 'now_ai', 'sparkBotObject'],
  '代理设置': ['enable_system_proxy', 'PROXY_AUTH', 'play_proxy_mode', 'play_local_proxy_type', 'enable_doh', 'allow_forward', 'allow_ftp_cache_clear', 'allow_webdav_cache_clear'],
  '引擎设置': ['enable_dr2', 'enable_py', 'enable_php', 'enable_cat', 'enable_old_config', 'enable_self_jx'],
  '其他设置': ['thread', 'api_pwd', 'link_url', 'enable_link_data', 'enable_link_push', 'enable_link_jar', 'mg_hz', 'show_curl', 'show_req', 'enable_rule_name', 'hide_adult', 'cat_sub_code', 'must_sub_code']
}

// All groups including "未分类配置" if any
const allGroups = computed(() => {
  const result = { ...groups }
  if (configStore.config) {
    const categorizedKeys = new Set(Object.values(groups).flat())
    const uncategorized = Object.keys(configStore.config).filter(k => !categorizedKeys.has(k))
    if (uncategorized.length > 0) {
      result['未分类配置'] = uncategorized
    }
  }
  return result
})

const groupNames = computed(() => ['全部', ...Object.keys(allGroups.value)])

const filteredConfigs = computed(() => {
  if (!configStore.config) return {}
  
  const result = {}
  const query = searchQuery.value.toLowerCase().trim()
  
  for (const [groupName, keys] of Object.entries(allGroups.value)) {
    if (selectedGroup.value !== '全部' && selectedGroup.value !== groupName) {
      continue
    }
    
    const groupResult = {}
    for (const key of keys) {
      if (configStore.config) {
        const value = key in configStore.config ? String(configStore.config[key]) : ''
        const desc = configDescriptions[key] || ''
        
        if (!query || key.toLowerCase().includes(query) || desc.toLowerCase().includes(query)) {
          groupResult[key] = key in configStore.config ? configStore.config[key] : ''
        }
      }
    }
    
    if (Object.keys(groupResult).length > 0) {
      result[groupName] = groupResult
    }
  }
  return result
})

const hasFilteredResults = computed(() => Object.keys(filteredConfigs.value).length > 0)

onMounted(() => {
  configStore.fetchConfig()
})

const startEdit = (key, value) => {
  editingKey.value = key
  editValue.value = typeof value === 'object' ? JSON.stringify(value, null, 2) : value
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
  if (!value) return value
  const sensitiveKeys = ['cookie', 'token', 'password', 'authKey', 'apiKey', 'auth']
  const isSensitive = sensitiveKeys.some(s => key.toLowerCase().includes(s))

  if (isSensitive && typeof value === 'string' && value.length > 8) {
    return value.substring(0, 4) + '****' + value.substring(value.length - 4)
  }
  return value
}

const getTypeIcon = (value) => {
  if (value === '0' || value === '1') return '🔢'
  if (typeof value === 'object') return '📦'
  return '📝'
}

const formatDisplayValue = (value) => {
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}
</script>

<template>
  <div class="config-page">
    <!-- Sticky Header Section -->
    <div class="config-header">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold">环境变量配置</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            管理 drpy-node 的环境变量和配置项
          </p>
        </div>
        <div class="flex flex-col sm:flex-row items-center gap-3">
          <!-- 搜索框 -->
          <div class="relative w-full sm:w-64">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="input pl-10 pr-8 w-full"
              placeholder="搜索变量名或描述..."
            >
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
          <button
            @click="configStore.fetchConfig()"
            :disabled="configStore.loading"
            class="btn btn-secondary whitespace-nowrap shrink-0 w-full sm:w-auto justify-center"
          >
            <svg v-if="configStore.loading" class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>
      </div>
      
      <!-- 分类 Tab 栏 -->
      <div class="mt-4 flex overflow-x-auto hide-scrollbar gap-2 pb-1">
        <button
          v-for="group in groupNames"
          :key="group"
          @click="selectedGroup = group"
          class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
          :class="selectedGroup === group ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'"
        >
          {{ group }}
        </button>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="config-content">
      <!-- Loading state -->
      <div v-if="configStore.loading && !configStore.config" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>

      <!-- Error state -->
      <div v-else-if="configStore.error" class="card p-6 border-red-200 dark:border-red-800">
        <p class="text-red-600 dark:text-red-400">加载配置失败: {{ configStore.error }}</p>
      </div>
      
      <!-- No Results State -->
      <div v-else-if="!hasFilteredResults" class="card p-12 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
        <svg class="w-12 h-12 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-lg font-medium text-gray-900 dark:text-gray-100">未找到匹配的配置项</p>
        <p class="mt-1">请尝试更换搜索词或选择其他分类</p>
        <button v-if="searchQuery || selectedGroup !== '全部'" @click="searchQuery = ''; selectedGroup = '全部'" class="mt-4 text-primary-600 hover:text-primary-700 font-medium">
          清除筛选
        </button>
      </div>

      <!-- Config groups -->
      <div v-else class="space-y-6 pb-6">
        <div v-for="(configs, groupName) in filteredConfigs" :key="groupName" class="card overflow-hidden shadow-sm">
          <div class="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 class="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span class="w-1.5 h-4 bg-primary-500 rounded-full"></span>
              {{ groupName }}
            </h3>
            <span class="text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {{ Object.keys(configs).length }} 项
            </span>
          </div>

          <div class="divide-y divide-gray-100 dark:divide-gray-800">
            <div
              v-for="(value, key) in configs"
              :key="key"
              class="p-4 sm:p-5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
            >
              <div class="flex flex-col sm:flex-row sm:items-start gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-base sm:text-lg opacity-80" title="数据类型">{{ getTypeIcon(value) }}</span>
                    <h4 class="font-mono text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 break-all">{{ key }}</h4>
                  </div>
                  
                  <p v-if="configDescriptions[key]" class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 pl-6 sm:pl-7">
                    {{ configDescriptions[key] }}
                  </p>

                  <!-- Display value -->
                  <div v-if="editingKey !== key" class="pl-6 sm:pl-7 mt-2">
                    <div class="relative bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden group-hover:border-primary-300 dark:group-hover:border-primary-700 transition-colors">
                      <code class="block p-3 text-xs sm:text-sm font-mono text-gray-800 dark:text-gray-200 break-all whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar">
                        {{ maskSensitive(key, formatDisplayValue(value)) || ' ' }}
                      </code>
                    </div>
                  </div>

                  <!-- Edit form -->
                  <div v-else class="pl-0 sm:pl-7 mt-3">
                    <div class="bg-primary-50 dark:bg-primary-900/10 p-3 sm:p-4 rounded-lg border border-primary-200 dark:border-primary-800">
                      <label class="block text-xs font-medium text-primary-700 dark:text-primary-400 mb-2">编辑 {{ key }}</label>
                      <textarea
                        v-model="editValue"
                        class="input min-h-[120px] font-mono text-sm w-full resize-y focus:ring-2 focus:ring-primary-500"
                        :placeholder="'输入 ' + key + ' 的值'"
                      />
                      <div class="flex flex-wrap gap-3 mt-4">
                        <button @click="saveEdit(key)" class="btn btn-primary text-sm flex-1 sm:flex-none justify-center">
                          <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                          保存更改
                        </button>
                        <button @click="cancelEdit" class="btn btn-secondary text-sm flex-1 sm:flex-none justify-center">
                          取消编辑
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Actions (Desktop right-aligned, Mobile bottom) -->
                <div v-if="editingKey !== key" class="flex sm:flex-col gap-2 pl-6 sm:pl-0 mt-2 sm:mt-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    @click="startEdit(key, value)"
                    class="flex items-center gap-1.5 px-3 py-1.5 sm:p-2 rounded-md bg-white sm:bg-transparent border border-gray-300 sm:border-transparent text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-gray-700 hover:text-primary-600 dark:hover:text-primary-400 transition-colors shadow-sm sm:shadow-none text-sm font-medium"
                    title="编辑此项"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span class="sm:hidden">编辑</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 8rem - 4rem);
  min-height: 500px;
}

.config-header {
  flex-shrink: 0;
  padding-bottom: 1rem;
}

.config-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* 隐藏滚动条但保留滚动功能 */
.hide-scrollbar {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
.hide-scrollbar::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}

/* 自定义代码块滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.8);
}
</style>