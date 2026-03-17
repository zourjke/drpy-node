import apiClient from './client'

export const dbApi = {
  // Execute SQL query via MCP
  async query(sql) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'sql_query',
      arguments: { query: sql }
    })
    return response
  }
}
