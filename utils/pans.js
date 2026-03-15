/**
 * 网盘服务模块集合
 * 统一导入和导出各种网盘服务提供商的实现
 * 
 * 支持的网盘服务：
 * - Ali: 阿里云盘服务
 * - Baidu: 百度网盘服务
 * - Baidu2: 百度网盘服务（第二版本）
 * - Cloud: 天翼云盘服务
 * - Pan: 123网盘服务
 * - Quark: 夸克网盘服务
 * - UC: UC网盘服务
 * - Yun: 115网盘服务
 * 
 * @example
 * import pans from './pans.js';
 * const aliPan = new pans.Ali(config);
 * const files = await aliPan.getFileList();
 */

// 导入各种网盘服务实现
import {Ali} from './pan/ali.js';        // 阿里云盘服务
import {Baidu} from "./pan/baidu.js";    // 百度网盘服务
import {Baidu2} from "./pan/baidu2.js";  // 百度网盘服务（第二版本）
import {Cloud} from "./pan/cloud.js";    // 天翼云盘服务
import {Pan} from "./pan/pan123.js";     // 123网盘服务
import {Quark} from "./pan/quark.js";    // 夸克网盘服务
import {UC} from "./pan/uc.js";          // UC网盘服务
import {Yun} from "./pan/yun.js";        // 115网盘服务
import {Xun} from "./pan/xun.js";        // 迅雷网盘服务

// 统一导出所有网盘服务
export default {Ali, Baidu, Baidu2, Cloud, Pan, Quark, UC, Yun, Xun}