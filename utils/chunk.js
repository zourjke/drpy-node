/**
 * 分块流处理工具
 * 提供HTTP Range请求支持和分块下载缓存功能
 */

import {log, logError, logWarn} from './log.js';
import req from './req.js';
import CryptoJS from 'crypto-js';
import {join} from 'path';
import fs from 'fs';
import {PassThrough} from 'stream';

/**
 * 测试URL是否支持Range请求
 * @param {string} url 目标URL
 * @param {Object} headers 请求头
 * @returns {Array} [是否支持, 响应头]
 */
export async function testSupport(url, headers) {
    const resp = await req
        .get(url, {
            responseType: 'stream',
            headers: Object.assign(
                {
                    Range: 'bytes=0-0', // 测试Range请求
                },
                headers,
            ),
        })
        .catch((err) => {
            logError(err);
            return err.response || {status: 500, data: {}};
        });
    if (resp && resp.status === 206) {
        const isAccept = resp.headers['accept-ranges'] === 'bytes';
        const contentRange = resp.headers['content-range'];
        const contentLength = parseInt(resp.headers['content-length']);
        const isSupport = isAccept || !!contentRange || contentLength === 1;
        const length = contentRange ? parseInt(contentRange.split('/')[1]) : contentLength;
        // 清理响应头
        delete resp.headers['content-range'];
        delete resp.headers['content-length'];
        if (length) resp.headers['content-length'] = length.toString();
        return [isSupport, resp.headers];
    } else {
        return [false, null];
    }
}

// URL头信息缓存（LRU 淘汰，防止内存无限增长）
// 用 Map 保留插入顺序，命中时移到末尾表示最近使用，超限时淘汰头部最久未使用的
const URL_HEAD_CACHE_MAX = 100; // 最大缓存条目数
const urlHeadCache = new Map();
function getUrlHead(urlKey) {
    if (!urlHeadCache.has(urlKey)) return null;
    const header = urlHeadCache.get(urlKey);
    // 命中时移到末尾（标记为最近使用）
    urlHeadCache.delete(urlKey);
    urlHeadCache.set(urlKey, header);
    return header;
}
function setUrlHead(urlKey, header) {
    if (urlHeadCache.has(urlKey)) urlHeadCache.delete(urlKey);
    urlHeadCache.set(urlKey, header);
    // 超出上限时淘汰最久未使用的（Map 第一个元素）
    if (urlHeadCache.size > URL_HEAD_CACHE_MAX) {
        const oldestKey = urlHeadCache.keys().next().value;
        urlHeadCache.delete(oldestKey);
    }
}
// 当前URL密钥
let currentUrlKey = '';
// 活跃 urlKey 集合：跟踪正在被请求使用的 urlKey，防止 delAllCache 误删其他并发请求的 .dl 文件
const activeUrlKeys = new Set();
// 缓存根目录
const cacheRoot = (process.env['NODE_PATH'] || '.') + '/vod_cache';
// 最大缓存大小 100MB
const maxCache = 1024 * 1024 * 100;

/**
 * 删除所有缓存文件，保留指定的密钥及活跃请求正在使用的目录
 * @param {string} keepKey 要保留的密钥
 */
function delAllCache(keepKey) {
    try {
        fs.readdir(cacheRoot, (_, files) => {
            if (files)
                for (const file of files) {
                    if (file === keepKey) continue;
                    // 跳过其他活跃请求正在使用的 urlKey 目录，避免删除正在下载的文件
                    if (activeUrlKeys.has(file)) continue;
                    const dir = join(cacheRoot, file);
                    // 直接删除整个非活跃目录（含所有缓存分块）
                    fs.rm(dir, {recursive: true, force: true}, () => {
                    });
                }
        });
    } catch (error) {
        logError(error);
    }
}

/**
 * 分块流处理主函数
 * @param {Object} inReq 输入请求对象
 * @param {Object} outResp 输出响应对象
 * @param {string} url 目标URL
 * @param {string} urlKey URL密钥
 * @param {Object} headers 请求头
 * @param {Object} option 配置选项
 * @returns {Stream} 流对象
 */
async function chunkStream(inReq, outResp, url, urlKey, headers, option) {
    // 生成URL密钥
    urlKey = urlKey || CryptoJS.enc.Hex.stringify(CryptoJS.MD5(url)).toString();
    // 标记当前 urlKey 为活跃状态，delAllCache 不会删除本目录下正在下载的 .dl 文件
    activeUrlKeys.add(urlKey);
    if (currentUrlKey !== urlKey) {
        delAllCache(urlKey);
        currentUrlKey = urlKey;
    }
    
    // 检查URL头信息缓存
    let urlHeader = getUrlHead(urlKey);
    if (!urlHeader) {
        const [isSupport, header] = await testSupport(url, headers);
        if (!isSupport || !header['content-length']) {
            log(`[chunkStream] 获取content-length失败，执行重定向到: ${url}`);
            outResp.redirect(url);
            activeUrlKeys.delete(urlKey);
            return;
        }
        setUrlHead(urlKey, header);
        urlHeader = header;
    }

    // 创建缓存目录
    let exist = true;
    await fs.promises.access(join(cacheRoot, urlKey)).catch((_) => (exist = false));
    if (!exist) {
        await fs.promises.mkdir(join(cacheRoot, urlKey), {recursive: true});
    }

    const contentLength = parseInt(urlHeader['content-length']);
    let byteStart = 0;
    let byteEnd = contentLength - 1;
    const streamHeader = {};

    // 处理Range请求
    if (inReq.headers.range) {
        // log(inReq.id, inReq.headers.range);
        const ranges = inReq.headers.range.trim().split(/=|-/);
        if (ranges.length > 2 && ranges[2]) {
            byteEnd = parseInt(ranges[2]);
        }
        byteStart = parseInt(ranges[1]);
        Object.assign(streamHeader, urlHeader);
        streamHeader['content-length'] = (byteEnd - byteStart + 1).toString();
        streamHeader['content-range'] = `bytes ${byteStart}-${byteEnd}/${contentLength}`;
        outResp.code(206);
    } else {
        Object.assign(streamHeader, urlHeader);
        outResp.code(200);
    }
    
    // 设置默认选项
    option = option || {chunkSize: 1024 * 256, poolSize: 5, timeout: 1000 * 10};
    log(`[chunkStream] option: `, option);
    const chunkSize = option.chunkSize;
    const poolSize = option.poolSize;
    const timeout = option.timeout;
    
    // 计算分块信息
    let chunkCount = Math.ceil(contentLength / chunkSize);
    let chunkDownIdx = Math.floor(byteStart / chunkSize);
    let chunkReadIdx = chunkDownIdx;
    let stop = false;
    const dlFiles = {};

    // 客户端断开保护：监听请求 aborted/close，提前设置 stop，避免递归永久运行
    // 原仅依赖 stream.on('close') 设置 stop，若 close 未触发则 setTimeout 递归链永久运行
    const onClientAbort = () => { stop = true; };
    if (inReq.raw) {
        inReq.raw.on('aborted', onClientAbort);
        inReq.raw.on('close', onClientAbort);
    }
    // 总超时兜底：5 分钟后强制停止所有递归，防止异常情况下无限循环
    const TOTAL_TIMEOUT_MS = 5 * 60 * 1000;
    const totalTimer = setTimeout(() => {
        if (!stop) {
            stop = true;
            logWarn(`[chunkStream] 总超时 ${TOTAL_TIMEOUT_MS}ms，强制停止: ${inReq.id}`);
        }
    }, TOTAL_TIMEOUT_MS);

    // 启动下载任务池
    for (let i = 0; i < poolSize && i < chunkCount; i++) {
        new Promise((resolve) => {
            (async function doDLTask(spChunkIdx) {
                if (stop || chunkDownIdx >= chunkCount) {
                    resolve();
                    return;
                }
                // 缓存大小控制
                if (spChunkIdx === undefined && (chunkDownIdx - chunkReadIdx) * chunkSize >= maxCache) {
                    setTimeout(doDLTask, 5);
                    return;
                }
                const chunkIdx = spChunkIdx || chunkDownIdx++;
                const taskId = `${inReq.id}-${chunkIdx}`;
                try {
                    const dlFile = join(cacheRoot, urlKey, `${inReq.id}-${chunkIdx}.p`);
                    let exist = true;
                    await fs.promises.access(dlFile).catch((_) => (exist = false));
                    if (!exist) {
                        const start = chunkIdx * chunkSize;
                        const end = Math.min(contentLength - 1, (chunkIdx + 1) * chunkSize - 1);
                        // 下载分块数据：使用 arraybuffer 一次性加载到内存，再写入 .p 文件
                        // 替代原先的 stream + createWriteStream + .dl 临时文件 + rename 方案
                        // 彻底消除远程慢网络下 writeStream 的 finish/error 事件竞态和 rename ENOENT 问题
                        // 256KB 分块在内存中缓冲完全可控，不影响内存占用
                        const dlResp = await req.get(url, {
                            responseType: 'arraybuffer',
                            timeout: timeout,
                            headers: Object.assign(
                                {
                                    Range: `bytes=${start}-${end}`,
                                },
                                headers,
                            ),
                        });
                        if (stop) {
                            // 客户端已断开，丢弃下载的数据
                            setTimeout(doDLTask, 5);
                            return;
                        }
                        // 直接写入最终 .p 文件，无需 .dl 临时文件和 rename
                        await fs.promises.writeFile(dlFile, Buffer.from(dlResp.data));
                        dlFiles[taskId] = dlFile;
                    }
                    setTimeout(doDLTask, 5);
                } catch (error) {
                    logError(error);
                    setTimeout(() => {
                        doDLTask(chunkIdx);
                    }, 15);
                }
            })();
        });
    }

    outResp.headers(streamHeader);
    const stream = new PassThrough();
    
    // 读取文件并写入流
    new Promise((resolve) => {
        let writeMore = true;
        (async function waitReadFile() {
            try {
                if (chunkReadIdx >= chunkCount || stop) {
                    stream.end();
                    resolve();
                    return;
                }
                if (!writeMore) {
                    setTimeout(waitReadFile, 5);
                    return;
                }
                const taskId = `${inReq.id}-${chunkReadIdx}`;
                if (!dlFiles[taskId]) {
                    setTimeout(waitReadFile, 5);
                    return;
                }
                const chunkByteStart = chunkReadIdx * chunkSize;
                const chunkByteEnd = Math.min(contentLength - 1, (chunkReadIdx + 1) * chunkSize - 1);
                const readFileStart = Math.max(byteStart, chunkByteStart) - chunkByteStart;
                const dlFile = dlFiles[taskId];
                delete dlFiles[taskId];
                // 读取文件数据
                const fd = await fs.promises.open(dlFile, 'r');
                const buffer = Buffer.alloc(chunkByteEnd - chunkByteStart - readFileStart + 1);
                await fd.read(buffer, 0, chunkByteEnd - chunkByteStart - readFileStart + 1, readFileStart);
                await fd.close().catch((e) => logError(e));
                await fs.promises.rm(dlFile, {force: true}).catch((e) => logError(e));
                writeMore = stream.write(buffer);
                if (!writeMore) {
                    stream.once('drain', () => {
                        writeMore = true;
                    });
                }
                chunkReadIdx++;
                setTimeout(waitReadFile, 5);
            } catch (error) {
                setTimeout(waitReadFile, 5);
            }
        })();
    });
    
    // 清理资源
    stream.on('close', async () => {
        // 清理总超时定时器，避免监听器累积
        clearTimeout(totalTimer);
        // 移除客户端断开监听器，避免 inReq.raw 上的监听器累积
        if (inReq.raw) {
            inReq.raw.removeListener('aborted', onClientAbort);
            inReq.raw.removeListener('close', onClientAbort);
        }
        Object.keys(dlFiles).forEach((reqKey) => {
            if (reqKey.startsWith(inReq.id)) {
                fs.rm(dlFiles[reqKey], {recursive: true, force: true}, () => {
                });
                delete dlFiles[reqKey];
            }
        });
        stop = true;
        // 释放活跃标记，允许后续 delAllCache 清理本目录
        activeUrlKeys.delete(urlKey);
    });
    return stream;
}

// 导出默认函数
export default chunkStream;
