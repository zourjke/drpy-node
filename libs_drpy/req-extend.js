// 注意:!!!此文件通过获取文本代码然后注入代码形式使用，不包含globalThis导出和export导出
// var key = '源的唯一ID' // 允许在源里自定义设置key，不设置就自动取title或者host
const RKEY = typeof (key) !== 'undefined' && key ? key : 'drpyS_' + (rule.title || rule.host); // 源的唯一标识

/**
 * 海阔网页请求函数完整封装
 * @param {string} url 请求链接
 * @param {Object} obj 请求对象 {headers:{},method:'',timeout:5000,body:'',withHeaders:false}
 * @param {boolean} ocr_flag 标识此flag是用于请求ocr识别的,自动过滤content-type指定编码
 * @returns {string|DocumentFragment|*}
 */
async function request(url, obj = {}, ocr_flag = false) {
    // 自请求回环优化：如果请求指向自己服务（公网域名），自动替换为 localhost 回环访问
    // 目的：解决 NAT/路由器不支持发夹转换时，服务器自己请求自己的公网域名失败的问题
    // 注：不改变原始 url 字符串的语义（只在本函数内替换），确保脚本 urljoin 等拼接仍然返回公网URL
    if (typeof _SELF_REQ_HOST !== 'undefined' && typeof _SELF_LOOPBACK !== 'undefined'
        && _SELF_REQ_HOST && _SELF_LOOPBACK && url && typeof url === 'string'
        && (url.startsWith(_SELF_REQ_HOST + '/') || url === _SELF_REQ_HOST)) {
        const _origUrl = url;
        url = _SELF_LOOPBACK + url.slice(_SELF_REQ_HOST.length);
        log(`[request] 自请求回环优化: ${_origUrl} -> ${url}`);
    }
    if (typeof (obj) === 'undefined' || !obj || (typeof obj === 'object' && obj !== null && Object.keys(obj).length === 0)) {
        let fetch_params = {};
        let headers = {
            'User-Agent': MOBILE_UA,
        };
        if (rule.headers) {
            Object.assign(headers, rule.headers);
        }
        let keys = Object.keys(headers).map(it => it.toLowerCase());
        if (!keys.includes('referer')) {
            headers['Referer'] = getHome(url);
        }
        fetch_params.headers = headers;
        obj = fetch_params;
    } else {
        let headers = obj.headers || {};
        let keys = Object.keys(headers).map(it => it.toLowerCase());
        if (!keys.includes('user-agent')) {
            headers['User-Agent'] = MOBILE_UA;
        }
        if (!keys.includes('referer')) {
            headers['Referer'] = getHome(url);
        }
        obj.headers = headers;
    }
    if (rule.encoding && rule.encoding !== 'utf-8' && !ocr_flag) {
        if (!obj.headers.hasOwnProperty('Content-Type') && !obj.headers.hasOwnProperty('content-type')) { // 手动指定了就不管
            obj.headers["Content-Type"] = 'text/html; charset=' + rule.encoding;
        }
    }
    if (rule.timeout && typeof obj.timeout === 'undefined') {
        obj.timeout = rule.timeout;
    }
    if (typeof (obj.body) != 'undefined' && obj.body && typeof (obj.body) === 'string') {
        // 传body加 "Content-Type":"application/x-www-form-urlencoded;" 即可post form
        if (!obj.headers.hasOwnProperty('Content-Type') && !obj.headers.hasOwnProperty('content-type')) { // 手动指定了就不管
            obj.headers["Content-Type"] = 'application/x-www-form-urlencoded; charset=' + rule.encoding;
        }
    } else if (typeof (obj.body) != 'undefined' && obj.body && typeof (obj.body) === 'object') {
        obj.data = obj.body;
        delete obj.body
    }
    if (!url) {
        return obj.withHeaders ? '{}' : ''
    }
    if (obj.toBase64) { // 返回base64,用于请求图片
        obj.buffer = 2;
        delete obj.toBase64
    }
    if (obj.redirect === false) {
        obj.redirect = 0;
    }
    if (obj.headers.hasOwnProperty('Content-Type') || obj.headers.hasOwnProperty('content-type')) {
        let _contentType = obj.headers["Content-Type"] || obj.headers["content-type"] || "";
        if (_contentType.includes("application/x-www-form-urlencoded")) {
            log("[request] custom body is application/x-www-form-urlencoded");
            if (typeof obj.body == "string") {
                let temp_obj = parseQueryString(obj.body);
                log(`[request] body:${JSON.stringify(temp_obj)}`);
            }
        }
    }
    // 注意：POST请求通常需要保留body数据，这里注释掉可能有问题的删除逻辑
    // if (obj.method === 'POST') {
    //     delete obj.body
    // }

    log(`[request] headers: ${JSON.stringify(obj.headers)}`);
    log('[request] url:' + url + `  |method:${obj.method || 'GET'}|timeout:${obj.timeout}  |body:${obj.body || ''}`);
    let res = await req(url, obj);
    let html = res.content || '';
    if (obj.withHeaders) {
        let htmlWithHeaders = res.headers;
        htmlWithHeaders.body = html;
        return JSON.stringify(htmlWithHeaders);
    } else {
        return html
    }
}


/**
 *  快捷post请求
 * @param {string} url 地址
 * @param {Object} obj 对象
 * @returns {string|DocumentFragment|*}
 */
async function post(url, obj = {}) {
    obj.method = 'POST';
    return await request(url, obj);
}

/**
 * 快捷获取特殊地址cookie|一般用作搜索过验证
 * 用法 let {cookie,html} = reqCookie(url);
 * @param {string} url 能返回cookie的地址
 * @param {Object} obj 常规请求参数
 * @param {boolean} all_cookie 返回全部cookie.默认false只返回第一个,一般是PhpSessionId
 * @returns {{cookie: string, html: (*|string|DocumentFragment)}}
 */
async function reqCookie(url, obj = {}, all_cookie = false) {
    obj.withHeaders = true;
    log('[reqCookie] obj:', obj);
    let html = await request(url, obj);
    let json = JSON.parse(html);
    let setCk = Object.keys(json).find(it => it.toLowerCase() === 'set-cookie');
    let cookie = setCk ? json[setCk] : '';
    if (Array.isArray(cookie)) {
        cookie = cookie.join(';')
    }
    if (!all_cookie) {
        cookie = cookie.split(';')[0];
    }
    html = json.body;
    log('[reqCookie] cookie:', obj);
    return {
        cookie,
        html
    }
}

/**
 * 检查宝塔验证并自动跳过获取正确源码
 * @param {string} html 之前获取的html
 * @param {string} url 之前的来源url
 * @param {Object} obj 来源obj
 * @returns {string|DocumentFragment|*}
 */
async function checkHtml(html, url, obj = {}) {
    if (/\?btwaf=/.test(html)) {
        let btwaf = html.match(/btwaf(.*?)"/)[1];
        url = url.split('#')[0] + '?btwaf' + btwaf;
        log('[checkHtml] 宝塔验证访问链接:' + url);
        html = await request(url, obj);
    }
    return html
}

/**
 *  带一次宝塔验证的源码获取
 * @param {string} url 请求链接
 * @param {Object} obj 请求参数
 * @returns {string|DocumentFragment}
 */
async function getCode(url, obj = {}) {
    let html = await request(url, obj);
    html = await checkHtml(html, url, obj);
    return html
}

/**
 * 源rule专用的请求方法,自动注入cookie
 * @param {string} url 请求链接
 * @returns {string|DocumentFragment}
 */
async function getHtml(url) {
    let obj = {};
    if (rule.headers) {
        obj.headers = rule.headers;
    }
    let cookie = getItem(RULE_CK, '');
    if (cookie) {
        log(`[getHtml] ${RULE_CK}: ${cookie}`);
        if (obj.headers && !Object.keys(obj.headers).map(it => it.toLowerCase()).includes('cookie')) {
            log('[getHtml] 历史无cookie,新增过验证后的cookie');
            obj.headers['Cookie'] = cookie;
        } else if (obj.headers && obj.headers.cookie && obj.headers.cookie !== cookie) {
            obj.headers['Cookie'] = cookie;
            log('[getHtml] 历史有小写过期的cookie,更新过验证后的cookie');
        } else if (obj.headers && obj.headers.Cookie && obj.headers.Cookie !== cookie) {
            obj.headers['Cookie'] = cookie;
            log('[getHtml] 历史有大写过期的cookie,更新过验证后的cookie');
        } else if (!obj.headers) {
            obj.headers = {Cookie: cookie};
            log('[getHtml] 历史无headers,更新过验证后的含cookie的headers');
        }
    }
    return getCode(url, obj);
}

/**
 * 验证码识别,暂未实现
 * @param {string} url 验证码图片链接
 * @returns {string} 验证成功后的cookie
 */
async function verifyCode(url) {
    let cnt = 0;
    let host = getHome(url);
    let cookie = '';
    while (cnt < OCR_RETRY) {
        try {
            // let obj = {headers:headers,timeout:timeout};
            let yzm_url = `${host}/index.php/verify/index.html`;
            log(`[verifyCode] 验证码链接:${yzm_url}`);
            let hhtml = await request(yzm_url, {withHeaders: true, toBase64: true}, true);
            let json = JSON.parse(hhtml);
            if (!cookie) {
                // print(json);
                let setCk = Object.keys(json).find(it => it.toLowerCase() === 'set-cookie');
                // cookie = json['set-cookie']?json['set-cookie'].split(';')[0]:'';
                cookie = setCk ? json[setCk].split(';')[0] : '';
            }
            // log(hhtml);
            log(`[verifyCode] cookie:${cookie}`);
            let img = json.body;
            // log(img);
            let code = await OcrApi.classification(img);
            log(`[verifyCode] 第${cnt + 1}次验证码识别结果:${code}`);
            let submit_url = `${host}/index.php/ajax/verify_check?type=search&verify=${code}`;
            log(`[verifyCode] 提交验证码链接: ${submit_url}`);
            let html = await request(submit_url, {headers: {Cookie: cookie}, 'method': 'POST'});
            // log(`[verifyCode] 提交验证码结果: ${html}`);
            html = JSON.parse(html);
            if (html.msg === 'ok') {
                log(`[verifyCode] 第${cnt + 1}次验证码提交成功`);
                return cookie // 需要返回cookie
            } else if (html.msg !== 'ok' && cnt + 1 >= OCR_RETRY) {
                cookie = ''; // 需要清空返回cookie
            }
        } catch (e) {
            log(`[verifyCode] 第${cnt + 1}次验证码提交失败:${e.message}`);
            if (cnt + 1 >= OCR_RETRY) {
                cookie = '';
            }
        }
        cnt += 1
    }
    return cookie
}

/**
 * 存在数据库配置表里, key字段对应值value,没有就新增,有就更新,调用此方法会清除key对应的内存缓存
 * @param {string} k 键
 * @param {*} v 值
 */
function setItem(k, v) {
    local.set(RKEY, k, v);
    log(`[setItem] 规则${RKEY}设置${k} => ${v}`);
    return true
}

/**
 *  获取数据库配置表对应的key字段的value，没有这个key就返回value默认传参.需要有缓存,第一次获取后会存在内存里
 * @param {string} k 键
 * @param {*} v 值
 * @returns {*}
 */
function getItem(k, v) {
    return local.get(RKEY, k) || v;
}

/**
 *  删除数据库key对应的一条数据,并清除此key对应的内存缓存
 * @param {string} k
 */
function clearItem(k) {
    local.delete(RKEY, k);
    return true
}

// 定义沙箱里的全局变量alias别名
var fetch = request;