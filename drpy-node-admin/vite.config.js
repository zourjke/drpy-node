import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [vue()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },

    // 构建配置
    build: {
      outDir: path.resolve(__dirname, '../apps/admin'),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['vue', 'vue-router', 'pinia'],
            'ui': ['axios']
          }
        }
      },
      chunkSizeWarningLimit: 1000
    },

    // 开发服务器配置
    server: {
      port: 5174,
      proxy: {
        // 所有 API 请求代理到 drpy-node
        '/api': {
          target: 'http://localhost:5757',
          changeOrigin: true,
          ws: true
        },
        // WebSocket 代理
        '/ws': {
          target: 'ws://localhost:5757',
          ws: true
        }
      }
    },

    // 基础路径
    base: mode.includes('production') ? (env.VITE_BASE_PATH || './') : '/'
  };
});
