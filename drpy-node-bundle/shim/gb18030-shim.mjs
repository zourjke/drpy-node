// gbkTool：drpyCustom.js 的 `export const gbkTool`（encodeStr/decodeStr 用）依赖该全局。
// 挂载机制见 ./mount-umd-global.mjs；原件拷贝为 ./original-gb18030.js（避免 alias 自环）
import * as lib from './original-gb18030.js';
import {mountUmdGlobal} from './mount-umd-global.mjs';

export default mountUmdGlobal('gbkTool', lib);
