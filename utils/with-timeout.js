/**
 * Promise 超时包装器 (L10)
 *
 * 与裸 `Promise.race([work, new Promise((_, r) => setTimeout(r, ms))])` 的区别：
 * 1. 无论输赢，输家定时器都会被 `finally` 清除——高频路径（搜索/探测/代理转发）
 *    下每个请求遗留一个 20~60s 的 pending timer 会显著推高内存与 GC 压力。
 * 2. 超时放弃后，业务 promise 的后续 rejection 不会成为 unhandledRejection
 *    （如 php 子进程被 timeout kill、python bridge 延迟超时等 race 输家场景）。
 *
 * @param {Promise} promise - 业务 Promise
 * @param {number} timeoutMs - 超时毫秒数；<=0 视为不限时、原样透传
 * @param {string} [label='operation'] - 错误信息里的操作名
 * @returns {Promise}
 */
export function withTimeout(promise, timeoutMs, label = 'operation') {
    if (!timeoutMs || timeoutMs <= 0 || typeof promise?.then !== 'function') {
        return Promise.resolve(promise);
    }
    // 挂 noop 分支静默"已被超时放弃"的输家 rejection（不影响 race 主链路）
    promise.catch(() => {});
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`${label}超时 (${timeoutMs}ms)`));
        }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timer);
    });
}

export default withTimeout;
