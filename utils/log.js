/**
 * 统一日志出口 (M1 console.log 收口)
 *
 * 用 console.log 同源的 util.format 做格式化（多参数/对象等文本输出语义等价），
 * 输出经 fastlogger(pino) 统一治理（stdout + rotating file，可配级别）。
 * 依赖方向：utils/log.js -> controllers/fastlogger.js 无环（fastlogger 仅依赖第三方包），
 * utils/env.js 已有同类反向引用先例。
 */
import util from 'util';
import {fastify} from '../controllers/fastlogger.js';
import {scrubString} from './sanitize-utf16.js';

// 日志消息出口 scrub：客户端服务页会逐行渲染日志，lone surrogate 同样触雷
// （pino 落盘走 utf8 Buffer 虽天然兜底，显式清洗保护任何非 Buffer 消费方）
const fmt = (...args) => scrubString(util.format(...args));

export const log = (...args) => fastify.log.info(fmt(...args));
export const logWarn = (...args) => fastify.log.warn(fmt(...args));
export const logError = (...args) => fastify.log.error(fmt(...args));

export default {log, logWarn, logError};
