import { defineStore } from 'pinia'
import { ref } from 'vue'
import { systemApi } from '../api/system'
import { spiderApi } from '../api/spider'

export const useSystemStore = defineStore('system', () => {
  const health = ref({ status: 'unknown' })
  const logs = ref([])
  const routes = ref([])
  const sources = ref({ js: [], catvod: [] })
  const loading = ref(false)
  const error = ref(null)

  const checkHealth = async () => {
    try {
      health.value = await systemApi.getHealth()
    } catch (e) {
      health.value = { status: 'error', message: e.message }
    }
  }

  const fetchLogs = async (lines = 100) => {
    loading.value = true
    error.value = null
    try {
      logs.value = await systemApi.getLogs(lines)
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch logs:', e)
    } finally {
      loading.value = false
    }
  }

  const fetchRoutes = async () => {
    try {
      routes.value = await systemApi.getRoutes()
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch routes:', e)
    }
  }

  const fetchSources = async () => {
    loading.value = true
    error.value = null
    try {
      sources.value = await spiderApi.listSources()
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch sources:', e)
    } finally {
      loading.value = false
    }
  }

  const restartService = async () => {
    loading.value = true
    error.value = null
    try {
      await systemApi.restartService()
    } catch (e) {
      error.value = e.message
      console.error('Failed to restart service:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    health,
    logs,
    routes,
    sources,
    loading,
    error,
    checkHealth,
    fetchLogs,
    fetchRoutes,
    fetchSources,
    restartService
  }
})
