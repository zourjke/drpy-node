// NODERSA（webpack UMD）：drpyCustom.js 的 `export const NODERSA` 依赖该全局。
// 挂载机制见 ./mount-umd-global.mjs；原件拷贝为 ./original-node-rsa.js（避免 alias 自环）
import * as lib from './original-node-rsa.js';
import {mountUmdGlobal} from './mount-umd-global.mjs';

export default mountUmdGlobal('NODERSA', lib);
