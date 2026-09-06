import {logWarn} from './log.js';
/**
 * 代理控制器公共纯函数集 (P2 公共层抽取)
 */

/**
 * 重写 M3U8 文本：逐行将分片/嵌套播放列表链接转换为代理链接
 *
 * 收敛自三份近乎相同的实现：
 * - controllers/m3u8-proxy.js processM3u8Content          （/ts 端点）
 * - controllers/m3u8-proxy.js processM3u8ContentUnified   （/proxy 端点）
 * - controllers/unified-proxy.js processM3u8ContentUnified（/unified-proxy 端点）
 *
 * 行为契约（与三份原实现对拍）：
 * - 空行与 `#` 注释行原样保留
 * - 相对链接基于 baseUrl 解析为绝对链接后整体 encodeURIComponent
 * - 单行解析失败时保留该行原文，不中断整表处理
 * - headersParam 存在时追加 &headers=<encoded>
 *
 * @param {string} content - M3U8 原文
 * @param {Object} opts
 * @param {string} opts.baseUrl - 分片相对路径的基准 URL
 * @param {string} opts.endpoint - 代理端点前缀，形如 `${proxyBaseUrl}/m3u8-proxy/ts`
 * @param {string} opts.authCode - 身份验证码（auth 参数值）
 * @param {string|null} [opts.headersParam=null] - 自定义请求头参数（将编码后透传）
 * @returns {string} 重写后的 M3U8 内容
 */
export function rewriteM3u8(content, {baseUrl, endpoint, authCode, headersParam = null}) {
    const lines = content.split('\n');
    const processedLines = [];

    for (let line of lines) {
        line = line.trim();

        // 跳过空行和注释行（以 # 开头）
        if (!line || line.startsWith('#')) {
            processedLines.push(line);
            continue;
        }

        let processedLine;

        try {
            // 判断是否为相对链接，先转绝对链接
            if (!line.startsWith('http://') && !line.startsWith('https://')) {
                line = new URL(line, baseUrl).href;
            }

            processedLine = `${endpoint}?url=${encodeURIComponent(line)}&auth=${authCode}`;

            if (headersParam) {
                processedLine += `&headers=${encodeURIComponent(headersParam)}`;
            }
        } catch (error) {
            logWarn(`Failed to process M3U8 line: ${line}`, error);
            // 处理失败时保持原链接
            processedLine = line;
        }

        processedLines.push(processedLine);
    }

    return processedLines.join('\n');
}

/**
 * 解析 HTTP Range 头（bytes=<start>-[<end>]）
 *
 * 收敛自 webdav-proxy / ftp-proxy / m3u8-proxy(HEAD) 中逐字重复的解析片段；
 * 仅负责语法拆解，越界(416)判断仍由调用方结合资源总长自行处理——与原实现一致。
 *
 * @param {string|undefined} rangeHeader - 请求中的 Range 头
 * @param {number} totalSize - 资源总大小（用于缺省 end = size-1）
 * @returns {{start: number, end: number}|null} 无 Range 头时返回 null
 */
export function parseRangeHeader(rangeHeader, totalSize) {
    if (!rangeHeader) return null;

    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    return {start, end};
}
