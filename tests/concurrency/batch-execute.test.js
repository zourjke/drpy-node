import {test} from 'node:test';
import assert from 'node:assert/strict';
import batchExecute from '../../libs_drpy/batchExecute.js';
import {assertNoTimerLeak} from '../helpers/timers.js';

function tasksOf(count) {
    return Array.from({length: count}, (_, i) => ({
        id: i,
        param: {i},
        func: async ({i}) => i,
    }));
}

test('收集全部成功结果', async () => {
    const results = await batchExecute(tasksOf(5), null, 0, 4);
    assert.equal(results.length, 5);
    assert.deepEqual([...results].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
});

test('达到 successCount 后提前停止', async () => {
    const results = await batchExecute(tasksOf(30), null, 3, 1);
    // maxConcurrency=1 串行：至少 3 个成功，最多再宽容少量在途任务
    assert.ok(results.length >= 3, `should reach 3 successes, got ${results.length}`);
    assert.ok(results.length <= 6, `should stop shortly after 3 successes, got ${results.length}`);
});

test('listener 返回 break 立即停止', async () => {
    let successes = 0;
    const listener = {
        param: {},
        func: () => {
            successes++;
            return 'break';
        },
    };
    const results = await batchExecute(tasksOf(50), listener, 0, 1);
    assert.equal(successes, 1);
    assert.equal(results.length, 1);
});

test('失败任务回调 error 且不影响其余任务', async () => {
    const errors = [];
    const tasks = [
        {id: 0, param: {}, func: async () => {
            throw new Error('boom');
        }},
        {id: 1, param: {}, func: async () => 11},
    ];
    const listener = {param: {}, func: (p, id, err) => {
        if (err) errors.push(id);
    }};
    const results = await batchExecute(tasks, listener, 0, 2);
    assert.deepEqual(errors, [0]);
    assert.equal(results.length, 1);
    assert.equal(results[0], 11);
});

test('完成后不残留任何定时器句柄（L1 泄露回归）', async () => {
    await assertNoTimerLeak(
        () => batchExecute(tasksOf(8), null, 0, 4),
        'batchExecute 正常完成路径'
    );
});

test('successCount 提前停止路径也不残留定时器（L1 泄露回归）', async () => {
    await assertNoTimerLeak(
        () => batchExecute(tasksOf(30), null, 2, 1),
        'batchExecute 提前停止路径'
    );
});
