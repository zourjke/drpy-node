#!/usr/bin/env node
/**
 * CCTV Video URL Parser
 * 解析央视视频URL，获取视频下载链接
 *
 * 使用方法:
 * node parse_url.js "https://tv.cctv.com/2026/03/13/VIDE1I89jcwxtmOiZUd6zsLR260313.shtml"
 * node parse_url.js "330318aa5ca745d286b8d6c57e971a39"
 * echo "<html>...</html>" | node parse_url.js -
 */

const crypto = require('crypto');
const fs = require('fs');

// 固定参数
const CCTV_API_URL = 'https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do';
const SECRET_KEY = '47899B86370B879139C08EA3B5E88267';
const UID = '826D8646DEBBFD97A82D23CAE45A55BE';

// 提取视频ID的正则规则
const PID_RULES = [
    /var\s+guid\s*=\s*["']([\da-fA-F]+)["']/,
    /videoCenterId(?:["']\s*,|:)\s*["']([\da-fA-F]+)["']/,
    /changePlayer\s*\(\s*["']([\da-fA-F]+)["']\)/,
    /load[Vv]ideo\s*\(\s*["']([\da-fA-F]+)["']\)/,
    /var\s+initMyAray\s*=\s*["']([\da-fA-F]+)["']/,
    /var\s+ids\s*=\s*\[["']([\da-fA-F]+)["']\]/
];

// PID格式：32位十六进制字符串
const PID_PATTERN = /^[\da-fA-F]{32}$/;

/**
 * MD5哈希函数
 */
function md5(value) {
    return crypto.createHash('md5').update(value, 'utf-8').digest('hex');
}

/**
 * HTTP GET请求（使用fetch）
 */
async function httpGet(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        throw error;
    }
}

/**
 * 判断输入类型
 * @param {string} input - 用户输入
 * @returns {string} - 'url' | 'pid' | 'html' | 'stdin'
 */
function detectInputType(input) {
    if (input === '-') {
        return 'stdin';
    }
    // 优先检测URL
    if (input.match(/^https?:\/\//i)) {
        return 'url';
    }
    // 检测HTML/JavaScript内容（包含HTML标签或JavaScript变量声明）
    if (input.includes('<html') || input.includes('<HTML') || input.includes('<body') || input.includes('<BODY') ||
        input.includes('var guid') || input.includes('var videoCenterId') || input.includes('changePlayer') ||
        input.includes('loadVideo') || input.includes('initMyAray')) {
        return 'html';
    }
    // 纯32位十六进制字符串，当作PID
    if (PID_PATTERN.test(input)) {
        return 'pid';
    }
    // 默认当作HTML/JS内容处理
    return 'html';
}

/**
 * 从HTML页面中提取视频ID
 */
function extractPid(html) {
    for (const rule of PID_RULES) {
        const match = html.match(rule);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

/**
 * 解析m3u8内容，获取最高质量的流URL
 */
function parseM3U8ForBestQuality(m3u8Content, m3u8BaseUrl) {
    const lines = m3u8Content.split('\n');
    let bestBandwidth = 0;
    let bestUri = null;

    // 解析主m3u8，寻找最高带宽的流
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
            const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
            if (bandwidthMatch) {
                const bandwidth = parseInt(bandwidthMatch[1], 10);
                // 查找下一行的URI
                for (let j = i + 1; j < lines.length; j++) {
                    const uriLine = lines[j].trim();
                    if (uriLine && !uriLine.startsWith('#')) {
                        if (bandwidth > bestBandwidth) {
                            bestBandwidth = bandwidth;
                            bestUri = uriLine;
                        }
                        break;
                    }
                }
            }
        }
    }

    // 如果没有找到多码率流，直接返回第一个非空行（单码率情况）
    if (!bestUri) {
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                bestUri = trimmed;
                break;
            }
        }
    }

    // 处理路径
    if (bestUri && !bestUri.startsWith('http')) {
        const urlObj = new URL(m3u8BaseUrl);
        // 如果是绝对路径（以/开头）
        if (bestUri.startsWith('/')) {
            bestUri = `${urlObj.protocol}//${urlObj.host}${bestUri}`;
        } else {
            // 相对路径
            const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
            bestUri = `${urlObj.protocol}//${urlObj.host}${basePath}${bestUri}`;
        }
    }

    return bestUri;
}

/**
 * 根据PID获取视频信息
 * @param {string} pid - 视频ID
 * @returns {Promise<Object>} 视频信息对象
 */
async function getVideoInfoByPid(pid) {
    console.log(`使用视频ID: ${pid}`);

    // 构建API请求参数
    console.log('步骤1: 构建API请求...');
    const tsp = Math.floor(Date.now() / 1000);
    const vn = '2049';
    const vc = md5(tsp + vn + SECRET_KEY + UID);

    const apiParams = new URLSearchParams({
        pid: pid,
        client: 'flash',
        im: '0',
        tsp: tsp.toString(),
        vn: vn,
        vc: vc,
        uid: UID,
        wlan: ''
    });

    const apiUrl = `${CCTV_API_URL}?${apiParams.toString()}`;
    console.log(`API URL: ${apiUrl}`);

    // 调用API获取视频信息
    console.log('步骤2: 获取视频信息...');
    const apiResponse = await httpGet(apiUrl);
    const videoData = JSON.parse(apiResponse);

    console.log('视频信息:', {
        title: videoData.title,
        pgtv: videoData.pgtv
    });

    // 获取m3u8下载链接
    console.log('步骤3: 解析下载链接...');
    const manifest = videoData.manifest || {};
    let hlsUrl = manifest.hls_h5e_url || manifest.hls_url || videoData.hls_h5e_url || videoData.hls_url;

    if (!hlsUrl) {
        throw new Error('无法获取HLS下载链接');
    }
    console.log(`HLS URL: ${hlsUrl}`);

    // 解析m3u8获取最高质量的流
    console.log('步骤4: 解析M3U8获取最佳质量...');
    const m3u8Content = await httpGet(hlsUrl);
    const downloadUrl = parseM3U8ForBestQuality(m3u8Content, hlsUrl);

    if (!downloadUrl) {
        throw new Error('无法解析M3U8内容');
    }

    console.log(`最终下载链接: ${downloadUrl}`);

    return {
        success: true,
        title: videoData.title,
        pid: pid,
        pgtv: videoData.pgtv,
        hls_key: manifest.hls_h5e_url ? 'hls_h5e_url' : 'hls_url',
        download_url: downloadUrl,
        m3u8_url: hlsUrl,
        cover_url: videoData.image
    };
}

/**
 * 主函数：解析CCTV视频URL
 * @param {string} input - 输入（URL、PID或HTML内容）
 * @returns {Promise<Object>} 视频信息对象
 */
async function parseCCTVUrl(input) {
    try {
        const inputType = detectInputType(input);
        console.log(`检测到输入类型: ${inputType}`);

        // 如果是PID，直接调用API
        if (inputType === 'pid') {
            return await getVideoInfoByPid(input);
        }

        // 如果是URL，获取页面内容并提取PID
        if (inputType === 'url') {
            console.log(`正在解析URL: ${input}`);
            console.log('步骤1: 获取页面内容...');
            const html = await httpGet(input);
            const pid = extractPid(html);

            if (!pid) {
                throw new Error('无法从页面中提取视频ID');
            }
            console.log(`找到视频ID: ${pid}`);

            return await getVideoInfoByPid(pid);
        }

        // 如果是HTML内容，直接提取PID
        if (inputType === 'html') {
            console.log('检测到HTML内容，直接提取视频ID...');
            const pid = extractPid(input);

            if (!pid) {
                throw new Error('无法从HTML内容中提取视频ID');
            }
            console.log(`找到视频ID: ${pid}`);

            return await getVideoInfoByPid(pid);
        }

        throw new Error(`不支持的输入类型: ${inputType}`);

    } catch (error) {
        console.error('解析失败:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// 导出函数供其他模块使用
module.exports = {parseCCTVUrl, detectInputType, getVideoInfoByPid};