import { defineStore } from 'pinia'
import { ref, nextTick } from 'vue'

export const useLogsStore = defineStore('logs', () => {
  const wsConnected = ref(false)
  const wsError = ref(null)
  const logs = ref([])
  const autoScroll = ref(true)
  const isInitialized = ref(false)
  const maxLogs = ref(1000)

  let ws = null
  let reconnectTimer = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5
  let heartbeatInterval = null

  const getWebSocketUrl = () => {
    const customBackendUrl = import.meta.env.VITE_BACKEND_URL || window.BACKEND_URL
    if (customBackendUrl) {
      const protocol = customBackendUrl.startsWith('https') ? 'wss:' : 'ws:'
      const host = customBackendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
      return `${protocol}//${host}/api/admin/logs/stream`
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}/ws`
  }

  const addLog = (message, level = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const safeMessage = typeof message === 'string' ? message : String(message)
    logs.value.push({ timestamp, message: safeMessage, level })
    if (logs.value.length > maxLogs.value) {
      logs.value.shift()
    }
  }

  const connectWebSocket = () => {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return
    }

    ws = new WebSocket(getWebSocketUrl())

    ws.onopen = () => {
      wsConnected.value = true
      wsError.value = null
      reconnectAttempts = 0
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }))
      }
      
      // Start heartbeat
      if (heartbeatInterval) clearInterval(heartbeatInterval)
      heartbeatInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }))
        }
      }, 30000)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        switch (data.type) {
          case 'welcome':
            addLog('✓ 已连接到日志服务器', 'info')
            break
          case 'console':
          case 'log':
            if (data.content) {
              addLog(data.content, data.level || 'info')
            } else if (data.message) {
              addLog(data.message, data.level || 'info')
            }
            break
          case 'broadcast':
            if (data.content) addLog(`[广播] ${data.content}`, 'info')
            break
          case 'echo':
          case 'pong':
            break
          default:
            if (data.message || data.content) {
              addLog(data.message || data.content, 'info')
            } else {
              addLog(JSON.stringify(data), 'debug')
            }
        }
      } catch (e) {
        addLog(event.data, 'log')
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      wsError.value = '连接错误'
    }

    ws.onclose = (event) => {
      wsConnected.value = false
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
        heartbeatInterval = null
      }
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        addLog(`连接断开，${reconnectAttempts}秒后重连... (${reconnectAttempts}/${maxReconnectAttempts})`, 'warn')
        reconnectTimer = setTimeout(() => {
          connectWebSocket()
        }, reconnectAttempts * 1000)
      } else {
        addLog('连接已断开，请刷新页面重试', 'error')
        wsError.value = '连接已断开'
      }
    }
  }

  const disconnectWebSocket = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'User disconnected')
      }
      ws = null
    }
    wsConnected.value = false
    wsError.value = null
  }

  const toggleConnection = () => {
    if (wsConnected.value) {
      disconnectWebSocket()
    } else {
      reconnectAttempts = 0
      connectWebSocket()
    }
  }

  const clearLogs = () => {
    logs.value = []
  }

  return {
    wsConnected,
    wsError,
    logs,
    autoScroll,
    isInitialized,
    connectWebSocket,
    disconnectWebSocket,
    toggleConnection,
    clearLogs
  }
})