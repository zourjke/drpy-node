// pako：drpyCustom.js 的 `export const pako`（gzip/ungzip 用）依赖该全局；
// bare 'pako'（幽灵依赖，CryptoJSWasm 内部 require）与本文件同指此 shim。
// 挂载机制见 ./mount-umd-global.mjs；原件拷贝为 ./original-pako.min.js（避免 alias 自环）
import * as lib from './original-pako.min.js';
import {mountUmdGlobal} from './mount-umd-global.mjs';

export default mountUmdGlobal('pako', lib);
