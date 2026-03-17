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

## 与 drpy-node 集成

Admin 面板通过 drpy-node-mcp 与主项目通信，需要后端提供相应的 API 接口。

## License

MIT
