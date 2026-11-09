// CryptoJS：bundle 下 /api/设置中心 报 "CryptoJS is not defined" 的根因位；
// moduleLoader.rootRequire('crypto-js') 也读 globalThis.CryptoJS。
// 挂载机制见 ./mount-umd-global.mjs；原件拷贝为 ./original-crypto-js.js（避免 alias 自环）
import * as lib from './original-crypto-js.js';
import {mountUmdGlobal} from './mount-umd-global.mjs';

export default mountUmdGlobal('CryptoJS', lib);
