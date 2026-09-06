import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withTimeout} from '../../utils/with-timeout.js';
import {assertNoTimerLeak, timerCount} from '../helpers/timers.js';

test('业务先完成：透传结果且定时器被清除', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 5000, 'fast');
    assert.equal(result, 'ok');
});

test('业务先拒绝：错误原样透传', async () => {
    await assert.rejects(
        withTimeout(Promise.reject(new Error('boom')), 5000, 'biz'),
        /boom/
    );
});

test('超时后抛出带标签的错误', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 500));
    await assert.rejects(withTimeout(slow, 10, 'HEAD探测'), /HEAD探测超时 \(10ms\)/);
});

test('timeoutMs<=0 时不设定时器直接透传', async () => {
    const before = timerCount();
    assert.equal(await withTimeout(Promise.resolve(1), 0), 1);
    assert.equal(await withTimeout(Promise.resolve(2), -1), 2);
    await new Promise((r) => setImmediate(r));
    assert.ok(timerCount() <= before);
});

test('赢的路径不遗留 pending timer（L10 回归）', async () => {
    const work = new Promise((resolve) => setTimeout(() => resolve('done'), 5));
    await assertNoTimerLeak(
        () => withTimeout(work, 60_000, 'never-timeout'),
        'withTimeout 快路径'
    );
});

test('超时放弃后输家的延迟 rejection 不触发 unhandledRejection', async () => {
    let unhandled = false;
    const handler = () => {
        unhandled = true;
    };
    process.on('unhandledRejection', handler);
    try {
        // 模拟 php 子进程被 timeout kill：Node 侧超时后才 reject
        const lateReject = new Promise((_, reject) => setTimeout(() => reject(new Error('killed')), 30));
        await assert.rejects(withTimeout(lateReject, 5, 'php'), /php超时/);
        // 等过输家 rejection 的触发窗口
        await new Promise((r) => setTimeout(r, 60));
        assert.equal(unhandled, false, '输家 rejection 应被 noop 分支静默');
    } finally {
        process.off('unhandledRejection', handler);
    }
});
