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

export const log = (...args) => fastify.log.info(util.format(...args));
export const logWarn = (...args) => fastify.log.warn(util.format(...args));
export const logError = (...args) => fastify.log.error(util.format(...args));

export default {log, logWarn, logError};
