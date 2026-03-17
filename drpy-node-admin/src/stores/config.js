import { defineStore } from 'pinia'
import { ref } from 'vue'
import { configApi } from '../api/config'

export const useConfigStore = defineStore('config', () => {
  const config = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const fetchConfig = async () => {
    loading.value = true
    error.value = null
    try {
      config.value = await configApi.getConfig()
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch config:', e)
    } finally {
      loading.value = false
    }
  }

  const updateConfig = async (key, value) => {
    loading.value = true
    error.value = null
    try {
      await configApi.updateConfig(key, value)
      await fetchConfig()
    } catch (e) {
      error.value = e.message
      console.error('Failed to update config:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    config,
    loading,
    error,
    fetchConfig,
    updateConfig
  }
})
