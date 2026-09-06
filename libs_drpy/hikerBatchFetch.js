/**
 * Hiker批量请求工具
 *
 * 功能：提供高性能的批量HTTP请求功能，支持并发控制和错误处理
 * P1 重构：移除无人使用的 batchFetch4(DsQueue 版本) 及其依赖 dsQueue.js，
 * 仅保留生产在役的 batchFetch3(fastq)。
 *
 * @author drpy
 * @version 1.1.0
 */

import {log} from '../utils/log.js';
import fastq from "fastq";
import createAxiosInstance from "../utils/createAxiosAgent.js";

// 最大Socket连接数配置
const maxSockets = 16;
// 创建共享的Axios实例，配置最大连接数
const _axios = createAxiosInstance({maxSockets: maxSockets});

/**
 * 异步睡眠函数
 * 用于在批量请求间添加延迟，避免过于频繁的请求
 * 
 * @param {number} ms - 睡眠时间（毫秒）
 * @returns {Promise<void>} Promise对象
 */
async function sleep(ms) {
    // 模拟异步请求
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

/**
 * 基于fastq的批量请求函数（版本3）
 * 支持分批处理，适合大量请求的场景
 * 
 * @param {Array} items - 请求项数组，每项包含url和options
 * @param {number} maxWorkers - 最大并发工作线程数，默认16
 * @param {number} timeoutConfig - 请求超时时间（毫秒），默认5000
 * @param {number} batchSize - 批处理大小，默认16
 * @returns {Promise<Array>} 返回结果数组，成功返回响应数据，失败返回null
 */
export const batchFetch3 = async (items, maxWorkers = 16, timeoutConfig = 5000, batchSize = 16) => {
    let t1 = (new Date()).getTime(); // 记录开始时间

    // 获取全局 timeout 设置
    const timeout = timeoutConfig;

    /**
     * 任务处理工作函数
     * 处理单个HTTP请求任务
     * 
     * @param {Object} task - 任务对象
     * @param {Object} task.item - 请求项，包含url和options
     * @param {number} task.index - 请求在原数组中的索引
     * @param {Array} task.results - 结果数组引用
     * @param {Function} callback - 任务完成回调函数
     */
    const worker = async (task, callback) => {
        const {item, index, results} = task;
        try {
            // 发送HTTP请求
            const response = await _axios(
                Object.assign({}, item?.options, {
                    url: item.url,
                    method: item?.options?.method || 'GET',        // 默认GET方法
                    timeout: item?.options?.timeout || timeout,    // 使用配置的超时时间
                    responseType: 'text',                          // 响应类型为文本
                }),
            );
            results[index] = response.data; // 保存成功结果
            callback(null); // 通知任务成功完成
        } catch (error) {
            // 记录错误日志
            log(`[batchFetch][error] ${item.url}: ${error}`);
            results[index] = null; // 记录错误结果为null
            callback(null); // 即使出错，也调用回调，不中断任务队列
        }
    };

    // 创建 fastq 队列
    const results = new Array(items.length).fill(null); // 关键改动：提前初始化 results 数组

    // 分批次处理
    const queue = fastq(worker, maxWorkers); // 关键改动：在整个函数中只创建一个队列

    // 按批次处理请求
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize); // 获取当前批次

        // 为当前批次创建任务Promise数组
        const tasks = batch.map((item, index) => {
            return new Promise((resolve) => {
                queue.push({item, index: i + index, results}, resolve);
            });
        });

        // 等待当前批次任务完成
        await Promise.all(tasks);
        // await sleep(200); // 如果需要，可以在这里添加短暂的休眠
    }

    let t2 = (new Date()).getTime(); // 记录结束时间
    log(`fastq 批量请求 ${items[0].url} 等 ${items.length}个地址 耗时${t2 - t1}毫秒:`);

    return results;
};

