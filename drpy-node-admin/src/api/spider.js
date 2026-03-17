import apiClient from './client'

export const spiderApi = {
  // List all sources via MCP
  async listSources() {
    const response = await apiClient.post('/admin/mcp', {
      name: 'list_sources',
      arguments: {}
    })
    // Transform response format from {spider/js, spider/catvod} to {js, catvod}
    return {
      js: response['spider/js'] || [],
      catvod: response['spider/catvod'] || []
    }
  },

  // Validate spider via MCP
  async validateSpider(path) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'validate_spider',
      arguments: { path }
    })
    return response
  },

  // Check syntax via MCP
  async checkSyntax(path) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'check_syntax',
      arguments: { path }
    })
    return response
  },

  // Get spider template via MCP
  async getTemplate() {
    const response = await apiClient.post('/admin/mcp', {
      name: 'get_spider_template',
      arguments: {}
    })
    return response
  },

  // Debug spider rule via MCP
  async debugRule(params) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'debug_spider_rule',
      arguments: params
    })
    return response
  }
}
