// randomUa：drpyS 沙箱全局表直接消费 globalThis.randomUa（bundle 里裸引用站点
// 会 ReferenceError）。范式同 jsonpath-shim。
// 挂载机制见 ./mount-umd-global.mjs；原件拷贝为 ./original-random-http-ua.js（避免 alias 自环）
import * as lib from './original-random-http-ua.js';
import {mountUmdGlobal} from './mount-umd-global.mjs';

export default mountUmdGlobal('randomUa', lib);
