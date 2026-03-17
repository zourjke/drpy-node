import apiClient from './client'

export const configApi = {
  // Get configuration via MCP
  async getConfig() {
    // This will be proxied through a backend endpoint
    const response = await apiClient.get('/admin/config')
    return response
  },

  // Update configuration via MCP
  async updateConfig(key, value) {
    const response = await apiClient.post('/admin/config', {
      action: 'set',
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value)
    })
    return response
  },

  // Get single config value
  async getConfigValue(key) {
    const response = await apiClient.get('/admin/config', {
      params: { key }
    })
    return response
  }
}
