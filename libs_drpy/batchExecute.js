import {log, logError} from '../utils/log.js';
import fastq from 'fastq';

/**
 * Batch execution function with concurrency control and early termination.
 * @param {Array} tasks - Array of task objects, each containing func, param, and id.
 * @param {Object} listener - Progress listener object containing func and param.
 * @param {number} [successCount] - Number of successful tasks to wait for before stopping.
 * @param {number} max_task - Maximum number of concurrent tasks.
 * @returns {Promise<Array>} - Resolves with the successful results when the required tasks are complete.
 */
async function batchExecute(tasks, listener, successCount, max_task = 0) {
    const maxConcurrency = Number(max_task) || Number(process.env.MAX_TASK) || 2; // Default concurrency
    // log(`batchExecute with max_task: ${maxConcurrency}`);

    let completedSuccess = 0;
    let stopExecution = false;
    const successfulResults = []; // To store successful results

    const queue = fastq.promise(async (task) => {
        if (stopExecution) return; // Skip processing if execution has stopped

        const {func, param, id} = task;
        try {
            // Check for stop condition at the start of each task
            if (stopExecution) return;

            const result = await func({...param, stopExecution: () => stopExecution});
            if (stopExecution) return; // Check again after task execution

            // if (result && result.url) { // Success condition
            successfulResults.push(result);
            completedSuccess++;
            // }

            if (listener && typeof listener.func === 'function') {
                const listenerResult = listener.func(listener.param, id, null, result);
                if (listenerResult === 'break') {
                    stopExecution = true;
                }
            }

            if (successCount && completedSuccess >= successCount) {
                stopExecution = true;
            }
        } catch (error) {
            if (listener && typeof listener.func === 'function') {
                listener.func(listener.param, id, error, null);
            }
        }
    }, maxConcurrency);

    // Enqueue tasks with a stop check
    tasks.forEach((task) => {
        queue.push(task).catch((err) => {
            logError(`Task queue error for task ${task.id}:`, err);
        });
    });

    // Monitor the queue and clear it on stopExecution
    let interval;
    const stopMonitor = new Promise((resolve) => {
        interval = setInterval(() => {
            if (stopExecution) {
                queue.kill(); // Clear all pending tasks
                clearInterval(interval);
                resolve();
            }
        }, 50); // Check every 50ms
    });

    // Wait for either stopExecution or all tasks to finish
    try {
        await Promise.race([queue.drained(), stopMonitor]);
    } finally {
        // 无论正常跑完(drained 先结束)还是中途异常，都必须停掉监控定时器，
        // 否则每调用一次就泄漏一个 50ms 常驻 interval 并钉住 queue 闭包 (L1)
        clearInterval(interval);
    }

    log(`batchExecute completed with max_task: ${maxConcurrency} and ${completedSuccess} successful tasks.`);
    return successfulResults;
}

export default batchExecute;
