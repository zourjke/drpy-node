# DRPY Node Admin

drpy-node 后台管理界面 - 基于 Vue3 + Tailwind CSS 构建的现代化管理系统。

## 功能特性

- 🎨 现代化 UI 设计，支持亮色/暗色主题
- 📱 完全响应式，适配 PC 和移动端
- 🚀 基于 Vite 构建，快速开发体验
- 🔧 环境变量可视化配置
- 📦 源文件管理和验证
- 📋 实时日志查看
- 📚 API 文档查看
- 📁 文件浏览和编辑
- 🗄️ 数据库查询

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **Vite** - 下一代前端构建工具
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Vue Router** - 官方路由管理
- **Pinia** - Vue 3 状态管理
- **Axios** - HTTP 客户端

## 项目结构

```
drpy-node-admin/
├── src/
│   ├── api/           # API 接口
│   ├── components/    # 公共组件
│   ├── router/        # 路由配置
│   ├── stores/        # Pinia 状态管理
│   ├── utils/         # 工具函数
│   ├── views/         # 页面组件
│   ├── App.vue        # 根组件
│   ├── main.js        # 入口文件
│   └── style.css      # 全局样式
├── public/            # 静态资源
├── index.html         # HTML 模板
├── vite.config.js     # Vite 配置
├── tailwind.config.js # Tailwind 配置
└── package.json       # 项目配置
```

## SPA 集成与部署 (重要)

本项目被设计为 drpy-node 的一个子应用 (SPA 插件)，默认部署在 `/apps/admin/` 路径下。为了确保单页面应用(SPA)在子目录下正常运行并解决刷新 404 问题，采用了与 `drplayer` 一致的配置模式。

### 1. 关键配置

#### 环境变量 (.env.production.apps)
用于指定生产构建时的基础路径：
```env
# 子目录部署配置 - 部署到 /apps/admin/ 目录
VITE_BASE_PATH=/apps/admin/
```

#### Vite 配置 (vite.config.js)
构建配置会自动读取环境变量中的 `VITE_BASE_PATH`：
```javascript
// 基础路径：优先使用环境变量 VITE_BASE_PATH，否则使用默认值
base: mode.includes('production') ? (env.VITE_BASE_PATH || './') : '/'
```

#### 路由配置 (src/router/index.js)
Vue Router 必须使用与 `base` 一致的 History 模式，否则会导致路由跳转失效或刷新白屏：
```javascript
const router = createRouter({
  // 必须传入 base 路径
  history: createWebHistory(import.meta.env.VITE_BASE_PATH || import.meta.env.BASE_URL),
  routes
})
```

### 2. 后端集成 (drpy-node)

后端通过 `controllers/static.js` 和 `controllers/fastify-spa-routes.js` 提供支持：

1.  **静态资源服务**：`fastify-static` 将 `apps` 目录映射到 `/apps/` 路由。
2.  **SPA 路由回退**：`addSPARoutes` 插件拦截 `/apps/admin/*` 的请求，当请求的资源不存在时（如刷新页面），自动返回 `/apps/admin/index.html`，由前端路由接管。

```javascript
// controllers/static.js
fastify.register(addSPARoutes, {
    appsDir: options.appsDir,
    spaApps: ['drplayer', 'admin'] // 注册为 SPA 应用
});
```

### 3. 构建与发布

**请务必使用以下命令进行构建，以确保加载正确的环境变量：**

```bash
# 在 drpy-node-admin 目录下
npm run build:apps

# 或者在项目根目录下
npm run admin:build
```

构建产物将输出到 `../apps/admin` 目录，可以直接被 drpy-node 服务加载。

## 与 drpy-node 集成

Admin 面板通过 drpy-node-mcp 与主项目通信，需要后端提供相应的 API 接口。

### 日志功能说明

日志查看页面使用 WebSocket 实时接收后端日志。确保：

1. **开发环境**：
   - 后端服务器运行在 `http://localhost:5757`
   - Vite 开发服务器自动代理 `/ws` 请求到后端

2. **生产环境**：
   - 确保后端的 `/ws` 端点可访问
   - 如果前后端分离部署，配置 `VITE_BACKEND_URL` 环境变量
   - 示例：`VITE_BACKEND_URL=http://your-backend:5757`

### 部署说明

#### 开发环境
```bash
# 终端 1: 启动后端
npm run dev

# 终端 2: 启动前端
cd drpy-node-admin
npm run dev
```

#### 生产环境
```bash
# 构建前端
cd drpy-node-admin
npm run build

# 将 dist 目录部署到静态服务器
# 或配置反向代理将 /admin 请求指向 dist 目录
```

#### Nginx 配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 主服务
    location / {
        proxy_pass http://localhost:5757;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 支持
    location /ws {
        proxy_pass http://localhost:5757;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Admin 面板
    location /admin {
        alias /path/to/drpy-node-admin/dist;
        try_files $uri $uri/ /admin/index.html;
    }
}
```

## License

MIT
