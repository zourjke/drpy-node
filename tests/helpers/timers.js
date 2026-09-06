// 定时器/活动资源计数辅助：内存泄露回归断言的基础设施。
// 仅依赖 Node 内置 API（process.getActiveResourcesInfo，Node >= 17.3）。

const TIMER_TYPES = new Set(['Timeout', 'Interval', 'Immediate']);

/**
 * 当前事件循环中存活的定时器数量（含 setTimeout/setInterval/setImmediate 注册的句柄）。
 * test runner 自身可能持有少量常驻资源，因此泄露断言一律比较"前后差值"而非绝对值。
 */
export function timerCount() {
    return process.getActiveResourcesInfo().filter((t) => TIMER_TYPES.has(t)).length;
}

/**
 * 执行 async fn 前后对比定时器增量。返回 fn 的结果；
 * 若完成后定时器仍多于执行前则抛错——用于锁定"函数返回后不得遗留任何定时器"的契约。
 */
export async function assertNoTimerLeak(fn, label = 'fn') {
    const before = timerCount();
    const result = await fn();
    // 给事件循环一拍时间让已 clear 的句柄真正出队
    await new Promise((resolve) => setImmediate(resolve));
    const after = timerCount();
    if (after > before) {
        throw new Error(
            `[leak] ${label} 完成后残留 ${after - before} 个定时器句柄 (before=${before}, after=${after})`
        );
    }
    return result;
}
