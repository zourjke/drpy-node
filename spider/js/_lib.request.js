const iconv = require('iconv-lite');

function sanitizeUserAgent(headers) {
    if (!headers) return headers;
    const keys = Object.keys(headers);
    for (const key of keys) {
        if (key.toLowerCase() === 'user-agent' && headers[key] === 'RemoveUserAgent') {
            delete headers[key];
            break;
        }
    }
    return headers;
}

async function requestHtml(url, options) {
    try {
        let html = (await req(url, options)).content;
        // log(html);
        return html
    } catch (e) {
        log(`requestHtml error:${e.message}`);
        return ''
    }

}

async function requestJson(url, options) {
    try {
        let html = (await req(url, options)).content;
        return JSON.parse(html)
    } catch (e) {
        log(`requestJson error:${e.message}`);
        return {}
    }
}

async function getPublicIp() {
    let ip_obj = await requestJson('http://httpbin.org/ip');
    // log('ip_obj:',ip_obj);
    return ip_obj.origin
}

async function getHtml(config) {
    try {
        if (typeof config === "string") {
            return await axios.request(config)
        }
        const cfg = {
            url: config.url,
            method: config.method || 'GET',
            headers: config.headers || {
                'User-Agent': PC_UA
            },
            data: config.data || '',
            responseType: config.responseType || ''
        };
        cfg.headers = sanitizeUserAgent(cfg.headers);
        return await axios.request(cfg)
    } catch (e) {
        return e.response
    }

}

async function req_(reqUrl, mt, headers, data) {
    let config = {
        method: mt || 'Get',
        url: reqUrl,
        headers: headers || {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 9; RMX1931 Build/PQ3A.190605.05081124; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36 QSTAPP/1.6.9 Html5Plus/1.0',
        },
        data: data || '',
    };
    config.headers = sanitizeUserAgent(config.headers);
    let res = await axios.request(config);
    return res.data;
}

async function req_encoding(reqUrl, mt, headers, encoding, data) {
    let config = {
        method: mt || 'Get',
        url: reqUrl,
        headers: headers || {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 9; RMX1931 Build/PQ3A.190605.05081124; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36 QSTAPP/1.6.9 Html5Plus/1.0',
        },
        data: data || '',
        responseType: 'arraybuffer'
    };
    config.headers = sanitizeUserAgent(config.headers);
    let res = await axios.request(config);
    if (encoding) {
        res.data = iconv.decode(res.data, encoding);
    }
    return res.data;
}

function getEnvProxyUrl() {
    try {
        if (typeof ENV !== 'undefined' && ENV.get) return ENV.get('PROXY_URL') || '';
    } catch (e) {}
    return '';
}

let localProxyDownUntil = 0;
let proxyAgentCache = {};
function getProxyAgent(proxyUrl) {
    if (!proxyUrl) return null;
    if (proxyAgentCache[proxyUrl]) return proxyAgentCache[proxyUrl];
    const protocol = String(proxyUrl).split(':')[0].toLowerCase();
    if (protocol.startsWith('socks')) {
        const mod = require('socks-proxy-agent');
        const SocksProxyAgent = mod.SocksProxyAgent || mod;
        proxyAgentCache[proxyUrl] = new SocksProxyAgent(proxyUrl);
    } else {
        const mod = require('https-proxy-agent');
        const HttpsProxyAgent = mod.HttpsProxyAgent || mod;
        proxyAgentCache[proxyUrl] = new HttpsProxyAgent(proxyUrl);
    }
    return proxyAgentCache[proxyUrl];
}

async function req_proxy(reqUrl, mt, headers, data) {
    const baseConfig = {
        method: mt || 'Get',
        url: reqUrl,
        headers: headers || {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 9; RMX1931 Build/PQ3A.190605.05081124; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36 QSTAPP/1.6.9 Html5Plus/1.0',
        },
        timeout: 18000,
        maxRedirects: 5,
        validateStatus: () => true
    };
    baseConfig.headers = sanitizeUserAgent(baseConfig.headers);
    if (data) baseConfig.data = data;

    async function doReq(proxyUrl, timeout) {
        const config = Object.assign({}, baseConfig, {timeout: timeout || baseConfig.timeout});
        const agent = getProxyAgent(proxyUrl);
        if (agent) {
            config.httpAgent = agent;
            config.httpsAgent = agent;
            config.proxy = false;
        }
        const res = await axios.request(config);
        return res.data;
    }

    const localProxy = 'http://127.0.0.1:7890';
    if (Date.now() > localProxyDownUntil) {
        try {
            return await doReq(localProxy, 3500);
        } catch (e) {
            localProxyDownUntil = Date.now() + 5 * 60 * 1000;
            if (typeof log !== 'undefined') log(`[req_proxy] local proxy ${localProxy} unavailable, fallback to PROXY_URL: ${e.message}`);
        }
    }

    const proxyUrl = getEnvProxyUrl();
    if (proxyUrl) return await doReq(proxyUrl, baseConfig.timeout);

    return await doReq('', baseConfig.timeout);
}

$.exports = {
    requestHtml,
    requestJson,
    getPublicIp,
    getHtml,
    req_,
    req_encoding,
    req_proxy,
    // axios // 没法import系统库
}
