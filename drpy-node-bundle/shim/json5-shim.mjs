// JSON5：drpyCustom.js 的 `export const JSON5` 与 utils/fileHeaderManager.js 依赖该全局。
// 挂载机制见 ./mount-umd-global.mjs；原件拷贝为 ./original-json5.js（避免 alias 自环）
import * as lib from './original-json5.js';
import {mountUmdGlobal} from './mount-umd-global.mjs';

export default mountUmdGlobal('JSON5', lib);
