import apiClient from './client'

export const systemApi = {
  // Get health status
  async getHealth() {
    const response = await apiClient.get('/health')
    return response
  },

  // Get logs via MCP
  async getLogs(lines = 100) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'read_logs',
      arguments: { lines }
    })
    return response
  },

  // Get routes info via MCP
  async getRoutes() {
    const response = await apiClient.post('/admin/mcp', {
      name: 'get_routes_info',
      arguments: {}
    })
    return response
  },

  // Restart service via MCP
  async restartService() {
    const response = await apiClient.post('/admin/mcp', {
      name: 'restart_service',
      arguments: {}
    })
    return response
  },

  // Get API list via MCP
  async getApiList() {
    const response = await apiClient.post('/admin/mcp', {
      name: 'get_drpy_api_list',
      arguments: {}
    })
    return response
  }
}
