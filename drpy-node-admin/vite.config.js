import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    proxy: {
      '/api-proxy': {
        target: 'http://localhost:5757',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, '')
      },
      '/ws': {
        target: 'http://localhost:5757',
        ws: true
      },
      // Proxy admin API requests
      '/admin': {
        target: 'http://localhost:5757',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'utils': ['axios']
        }
      }
    }
  }
})
