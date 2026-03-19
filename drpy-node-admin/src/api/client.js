import axios from 'axios'

const apiClient = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth if needed
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // 打印响应以便调试
    // console.log('API Response:', response.data)
    return response.data
  },
  (error) => {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || '请求失败'
    console.error('API Error:', message, error.response?.data)
    return Promise.reject(new Error(message))
  }
)

export default apiClient
