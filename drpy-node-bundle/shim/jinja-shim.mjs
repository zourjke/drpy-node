// jinja：drpyCustom.js 的 `export const jinja` 与 utils/file.js / controllers/config.js
// 的注入都依赖 globalThis.jinja。
// 挂载机制见 ./mount-umd-global.mjs；原件拷贝为 ./original-jinja.js（避免 alias 自环）
import * as lib from './original-jinja.js';
import {mountUmdGlobal} from './mount-umd-global.mjs';

export default mountUmdGlobal('jinja', lib);
