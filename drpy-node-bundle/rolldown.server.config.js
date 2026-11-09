// server 单文件 bundle 配置（2026-11-09）：
// 目标 = 把 index.js 的静态启动依赖图打成单文件，消灭 Android FUSE 上的
// ESM 解析 stat 风暴；动态部分（spider/jx/插件）与下列 external 保留磁盘形态。
// 产出：../dist/server.bundle.mjs（部署时放项目根 + utils/esm-register.mjs 伴生——
// 它 register(import.meta.url) 自注册为 loader 钩子，inline 会导致服务在
// loader 线程二次执行，绝不可打包进来）
//
// 同配置再产一个 ../dist/sandbox-check.bundle.mjs：出包前的沙箱全局自检门
// （见 ./sandbox-check.mjs），与 server bundle 共用全部 alias/banner/external，
// 保证检查的就是真实打包语义。
import {defineConfig} from 'rolldown';
import path from 'path';
import {fileURLToPath} from 'url';

const __cfgdir = path.dirname(fileURLToPath(import.meta.url));

const builtins = [
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'fs/promises',
  'http', 'http2', 'https', 'inspector', 'module', 'net', 'os', 'path',
  'perf_hooks', 'process', 'punycode', 'querystring', 'readline', 'repl',
  'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events', 'tty',
  'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
];

// external 三类：①node 内置 ②wasm 资产包（.wasm 按 import.meta.url 定位，
// 打不进单文件——bundle 版 zip 保留微型 node_modules 只装这些）③可选
// 依赖 node-pty（未安装，运行时 try/catch 软降级）④esm-register 自注册钩子。
// puppeteer 不在此列：静态 import 已被 hoist，必须经 alias 打成 mock，external 掉会启动即崩
// 运行时 external 包（bundle 版 zip 的微型 node_modules 只装这些）：
// · node-sqlite3-wasm/simplecc-wasm：.wasm 资产按 import.meta.url 定位打不进单文件
// · ws：@fastify/websocket 内部 require('ws') 走 CJS 形状（.Server 构造器），
//   rolldown interop 下 namespace 形状错位 → external 走运行时 require 保持 CJS 形状
// · @fastify/swagger-ui：默认 external 保真。-min 变体（BUNDLE_INLINE_SWAGGER=1，
//   package-clean.mjs -bundle -min）改为内联：注册期同步 require('./static/csp.json')
//   + 读 logo.svg（按假 __dirname 落 dist/static/），serve root 又拼
//   __dirname/../static（根级 static/）——出包时随包带两份 static 资产即可
//   全通（node_modules 顶层 54→3；hack 依赖包内部两种拼法，升级上游需复查）
const inlineSwagger = process.env.BUNDLE_INLINE_SWAGGER === '1';
const wasmPkgs = [
  'node-sqlite3-wasm',
  'simplecc-wasm',
  'ws',
  ...(inlineSwagger ? [] : ['@fastify/swagger-ui']),
];
const optionalPkgs = ['node-pty'];

// UMD 全局挂载型模块 → shim（键 = 原件仓库相对路径；alias 键用解析后的
// 绝对路径，覆盖各处不同相对前缀的 import，jsonpath 同款手法）。
// drpyCustom.js 末尾的 `export const X = globalThis.X` 依赖这些全局，bundle 下
// UMD 走 CJS 分支不挂全局 → 逐个 shim（挂载逻辑见 shim/mount-umd-global.mjs）
const umdGlobalShims = {
    '../utils/random-http-ua.js': 'shim/random-http-ua-shim.mjs',
    '../utils/marked.min.js': 'shim/marked-shim.mjs',
    '../libs_drpy/pako.min.js': 'shim/pako-shim.mjs',
    '../libs_drpy/jsencrypt.js': 'shim/jsencrypt-shim.mjs',
    '../libs_drpy/jinja.js': 'shim/jinja-shim.mjs',
    '../libs_drpy/crypto-js.js': 'shim/crypto-js-shim.mjs',
    '../libs_drpy/_dist/node-rsa.js': 'shim/node-rsa-shim.mjs',
    '../libs_drpy/_dist/gb18030.js': 'shim/gb18030-shim.mjs',
    '../libs_drpy/_dist/json5.js': 'shim/json5-shim.mjs',
};
const umdAliases = {};
for (const [src, shim] of Object.entries(umdGlobalShims)) {
    umdAliases[path.resolve(__cfgdir, src)] = path.resolve(__cfgdir, shim);
}

// banner 只造 require（动态 require 站点在 bundle 里裸引用该标识符）；
// 不造 __filename/__dirname——服务图模块是 ESM 自声明风格（pathHelper
// 等自带 const __filename = fileURLToPath(import.meta.url)，banner 再
// 声明会在 bundle 顶层撞名 SyntaxError（core bundle 无此问题因图不同）
const banner = `
import { createRequire as _createRequire } from 'module';
import { fileURLToPath as _fileURLToPath } from 'url';
import { dirname as _dirname } from 'path';
const require = _createRequire(import.meta.url);
// CJS 依赖裸引用 __dirname 的兜底（@fastify/swagger-ui 注册期找资产等）：
// 挂 globalThis 而非词法声明——避免与 pathHelper/web.js 等自声明 const
// __filename/__dirname 在扁平作用域撞名（TDZ/重复声明）。值 = bundle 所在
// 目录（= PROJECT_ROOT）；swagger-ui 资产由此 404 属可接受降级（API 文档页）
if (!globalThis.__dirname) globalThis.__dirname = _dirname(_fileURLToPath(import.meta.url));
if (!globalThis.__filename) globalThis.__filename = _fileURLToPath(import.meta.url);
`;

function makeConfig({input, entryFileNames}) {
  return {
    input: path.resolve(__cfgdir, input),
    output: {
      dir: path.resolve(__cfgdir, '../dist'),
      entryFileNames,
      format: 'esm',
      sourcemap: false,
      // 性能档：minify 缩小体积、加快启动解析（默认不 mangle 属性名，
      // 第三方库按属性名反射的用法不受影响）。崩溃栈可读性取舍见任务约定。
      minify: true,
      // 单文件形态：动态 import 也内联（FUSE 场景文件数越少越好；动态
      // require(变量) 不受影响——它们本来就走运行时解析）
      codeSplitting: false,
      // 部署形态：bundle 放 <root>/dist/，使模块内 `import.meta.url` 推导的
      // `__dirname/..` 恰好落回项目根（源码约定：模块都在根下一级）。index.js
      // 的 external 引用按输出目录重写为 ../utils/，指向根级伴生文件。
      paths: (id) => {
        // Windows 下 id 是反斜杠绝对路径，归一后再判
        const norm = id.replace(/\\/g, '/');
        if (norm === './utils/esm-register.mjs' || norm.endsWith('/utils/esm-register.mjs')) {
          return '../utils/esm-register.mjs';
        }
        return id;
      },
      banner,
    },
    platform: 'node',
    treeshake: false,
    resolve: {
      conditionNames: ['node', 'import'],
      alias: {
        // pako 是幽灵依赖（不在 package.json，线上靠 node_modules 残留兜）：
        // bundle 版不再依赖 node_modules；原件是 UMD 全局挂载型（CryptoJSWasm
        // 内部 require('pako') 也走这里），统一走 shim
        'pako': path.resolve(__cfgdir, 'shim/pako-shim.mjs'),
        // headless-util 的静态 import 被 hoist 到 bundle 顶层，未装 puppeteer
        // 时从「运行时软降级」变「启动即崩」——别名到 core bundle 同款 mock，
        // 语义等价于线上「load failed → 功能禁用」
        'puppeteer': path.resolve(__cfgdir, 'puppeteer-mock.js'),
        ...umdAliases,
      },
    },
    onwarn: (warning, defaultHandler) => {
      if (warning.code === 'EVAL') return;
      defaultHandler(warning);
    },
    external: (id) => {
      if (builtins.includes(id) || id.startsWith('node:')) return true;
      // 自注册 loader 钩子必须留在磁盘
      if (id.endsWith('esm-register.mjs')) return true;
      if (wasmPkgs.some((p) => id === p || id.startsWith(p + '/'))) return true;
      if (optionalPkgs.some((p) => id === p || id.startsWith(p + '/'))) return true;
      // 动态 require/import（变量拼接的 spider/插件路径）原样走运行时
      return false;
    },
  };
}

export default defineConfig([
  makeConfig({input: '../index.js', entryFileNames: 'server.bundle.mjs'}),
  makeConfig({input: './sandbox-check.mjs', entryFileNames: 'sandbox-check.bundle.mjs'}),
]);
