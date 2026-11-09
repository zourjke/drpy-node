// marked：controllers/root.js（首页）与 controllers/docs.js（文档页）按
// side-effect 导入后裸用 globalThis.marked 渲染 Markdown——bundle 下 UMD 走
// CJS 分支不挂全局，首页直接 500 "marked is not defined"（沙箱两表之外的
// 主服务 UMD 消费，自检门已补该盲区，见 sandbox-check.mjs）。
// 挂载机制见 ./mount-umd-global.mjs；原件拷贝为 ./original-marked.min.js（避免 alias 自环）
import * as lib from './original-marked.min.js';
import {mountUmdGlobal} from './mount-umd-global.mjs';

export default mountUmdGlobal('marked', lib);
