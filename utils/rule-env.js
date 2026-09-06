/**
 * 规则/代理/解析环境对象构建器 (P2 公共层抽取)
 *
 * 收敛 controllers/api.js 三处（/api、/proxy、/parse 路由）逐字重复的
 * "请求相关 URL 信息 + getEnv" 样板（每处约 50 行）。产出的 env 字段集合
 * 与原实现一致，额外字段通过 extra 注入、proxyUrl 可按路由覆写。
 */

/**
 * @param {Object} request - Fastify request
 * @param {Object} options - registerOptions（用到 PORT/WsPORT/wsApp）
 * @param {Object} query - 解析后的 query 参数（用到 do）
 * @param {string} moduleExt - 模块扩展参数（extend）
 * @returns {{getEnv: Function}} getEnv(moduleName, {proxyUrl?, extra?}) => env 对象
 */
export function createRuleEnvContext(request, options, query, moduleExt) {
    // 构建请求相关的URL信息
    // 协议判断优先级: 环境变量 > 转发头(x-forwarded-proto / x-scheme) > socket
    const xfProto = request.headers['x-forwarded-proto'] || request.headers['x-scheme'];
    const protocol = process.env.EXTERNAL_PROTOCOL || xfProto || (request.socket.encrypted ? 'https' : 'http');
    const hostname = request.hostname;
    // 弹幕 WS 合并到主服务: wsName 直接用主服务 host(不替换为 57575),
    // 走已有 5757 反代即可, 无需为 57575 单独配 nginx location
    const wsName = hostname;
    // 弹幕 WS 协议: 跟随当前请求协议(反代下由 x-forwarded-proto 决定), https => wss, http => ws
    const wsScheme = protocol === 'https' ? 'wss' : 'ws';
    const requestHost = `${protocol}://${hostname}`;
    const publicUrl = `${protocol}://${hostname}/public/`;
    const jsonUrl = `${protocol}://${hostname}/json/`;
    const httpUrl = `${protocol}://${hostname}/http`;
    const imageApi = `${protocol}://${hostname}/image`;
    const mediaProxyUrl = `${protocol}://${hostname}/mediaProxy`;
    const webdavProxyUrl = `${protocol}://${hostname}/webdav/`;
    const ftpProxyUrl = `${protocol}://${hostname}/ftp/`;
    const hostUrl = `${hostname.split(':')[0]}`;
    // 弹幕 WS 挂到主服务 server(与 @fastify/websocket 共存; 弹幕源 wrapper 会把非弹幕路径 upgrade 转发给原监听器)
    const fServer = options.fastify?.server || options.wsApp.server;

    /**
     * 构建环境对象
     *
     * @param {string} moduleName - 模块名称
     * @param {Object} [opts]
     * @param {string} [opts.proxyUrl] - 覆写默认的 /proxy/<module> 拼接模板
     * @param {Object} [opts.extra] - 额外字段（如代理路径 proxyPath）合入 env
     * @returns {Object} 环境对象
     */
    function getEnv(moduleName, {proxyUrl: proxyUrlOverride, extra} = {}) {
        const proxyUrl = proxyUrlOverride ??
            `${protocol}://${hostname}/proxy/${moduleName}/?do=${query.do || 'ds'}&extend=${encodeURIComponent(moduleExt)}`;

        return {
            requestHost,
            proxyUrl,
            publicUrl,
            jsonUrl,
            httpUrl,
            imageApi,
            mediaProxyUrl,
            webdavProxyUrl,
            ftpProxyUrl,
            hostUrl,
            hostname,
            wsName,
            wsScheme,
            fServer,
            getProxyUrl: function () {
                return proxyUrl;
            },
            ext: moduleExt,
            ...(extra || {}),
        };
    }

    return {
        /** 与协议/host 相关的原始上下文（供调用方拼自定义 proxyUrl 用） */
        protocol,
        hostname,
        getEnv,
    };
}

export default createRuleEnvContext;
