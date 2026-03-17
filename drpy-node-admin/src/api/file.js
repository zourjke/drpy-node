import apiClient from './client'

export const fileApi = {
  // List directory via MCP
  async listDirectory(path = '.') {
    const response = await apiClient.post('/admin/mcp', {
      name: 'list_directory',
      arguments: { path }
    })
    // MCP returns array format, convert to {files: [...]}
    if (Array.isArray(response)) {
      return {
        files: response.map(f => ({
          name: f.name,
          path: path === '.' ? f.name : `${path}/${f.name}`.replace(/^\.\//, ''),
          isDirectory: f.isDirectory,
          size: f.size
        }))
      }
    }
    return response
  },

  // Read file via MCP
  async readFile(path) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'read_file',
      arguments: { path }
    })
    return response
  },

  // Write file via MCP
  async writeFile(path, content) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'write_file',
      arguments: { path, content }
    })
    return response
  },

  // Delete file via MCP
  async deleteFile(path) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'delete_file',
      arguments: { path }
    })
    return response
  }
}
