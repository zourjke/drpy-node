import vm from "vm";
import {
    dealJson,
    encodeStr,
    forceOrder,
    jinja,
    nodata,
    processImage,
    SPECIAL_URL,
    tellIsJx,
    ungzip,
    vodDeal,
} from "../libs_drpy/drpyCustom.js";
import {base64Decode, md5} from "../libs_drpy/crypto-util.js";
import {deepCopy, urljoin} from "../utils/utils.js";

// 注释：原hostHtmlCache已移除，统一使用pageRequestCache管理缓存

/**
 * 页面请求缓存管理类
 * 实现大小限制、FIFO策略和自动清理机制
 */
class PageRequestCache {
    constructor(maxSize = 20, maxAge = 20000) {
        this.cache = new Map();
        this.accessOrder = []; // 记录访问顺序，用于FIFO
        this.timers = new Map(); // 记录每个缓存项的定时器
        this.maxSize = maxSize; // 最大缓存数量
        this.maxAge = maxAge; // 最大存活时间（毫秒）
    }

    get(key) {
        const item = this.cache.get(key);
        if (item) {
            // 更新访问顺序
            this._updateAccessOrder(key);
            return item.value;
        }
        return undefined;
    }

    set(key, value) {
        // 如果已存在，先清理旧的定时器
        if (this.cache.has(key)) {
            this._clearTimer(key);
        } else {
            // 检查是否需要淘汰旧缓存
            this._evictIfNeeded();
        }

        // 设置缓存项
        const item = {
            value,
            timestamp: Date.now()
        };
        this.cache.set(key, item);
        this._updateAccessOrder(key);

        // 设置自动清理定时器
        const timer = setTimeout(() => {
            this.delete(key);
            console.log(`[PageRequestCache] 自动清理过期缓存: ${key}`);
        }, this.maxAge);
        // 让定时器不阻止进程退出
        if (timer.unref) timer.unref();
        this.timers.set(key, timer);

        console.log(`[PageRequestCache] 缓存已设置: ${key}, 当前缓存数量: ${this.cache.size}`);
    }

    delete(key) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
            this._clearTimer(key);
            this._removeFromAccessOrder(key);
            return true;
        }
        return false;
    }

    clear() {
        // 清理所有定时器
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.cache.clear();
        this.accessOrder = [];
        this.timers.clear();
        console.log('[PageRequestCache] 已清理所有缓存');
    }

    has(key) {
        return this.cache.has(key);
    }

    get size() {
        return this.cache.size;
    }

    // 获取缓存统计信息
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            maxAge: this.maxAge,
            keys: Array.from(this.cache.keys())
        };
    }

    // 私有方法：更新访问顺序
    _updateAccessOrder(key) {
        this._removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }

    // 私有方法：从访问顺序中移除
    _removeFromAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    // 私有方法：清理定时器
    _clearTimer(key) {
        const timer = this.timers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(key);
        }
    }

    // 私有方法：检查是否需要淘汰缓存
    _evictIfNeeded() {
        while (this.cache.size >= this.maxSize) {
            // FIFO策略：移除最早访问的缓存项
            const oldestKey = this.accessOrder[0];
            if (oldestKey) {
                console.log(`[PageRequestCache] FIFO淘汰缓存: ${oldestKey}`);
                this.delete(oldestKey);
            } else {
                break;
            }
        }
    }

    // 迭代器支持
    [Symbol.iterator]() {
        return this.cache[Symbol.iterator]();
    }
}

// 创建页面请求缓存实例
export const pageRequestCache = new PageRequestCache(20, 20000);

/**
 * 创建解析器上下文对象
 * @param {string} url - 解析的URL
 * @param {Object} rule - 规则对象
 * @param {Object} extraVars - 额外的变量
 * @returns {Object} 解析器上下文
 */
function createParserContext(url, rule, extraVars = {}) {
    const jsp = new jsoup(url);
    return {
        jsp,
        pdfh: jsp.pdfh.bind(jsp),
        pdfa: jsp.pdfa.bind(jsp),
        pd: jsp.pd.bind(jsp),
        pdfl: jsp.pdfl.bind(jsp),
        pjfh: jsp.pjfh.bind(jsp),
        pjfa: jsp.pjfa.bind(jsp),
        pj: jsp.pj.bind(jsp),
        MY_URL: url,
        HOST: rule.host,
        fetch_params: deepCopy(rule.rule_fetch_params),
        ...extraVars
    };
}

/**
 * 选择解析模式对应的解析函数
 * @param {boolean} isJson - 是否为JSON模式
 * @param {Object} context - 解析器上下文
 * @returns {Object} 解析函数对象
 */
function selectParseMode(isJson, context) {
    if (isJson) {
        return {
            $pdfa: context.pjfa,
            $pdfh: context.pjfh,
            $pd: context.pj
        };
    }
    return {
        $pdfa: context.pdfa,
        $pdfh: context.pdfh,
        $pd: context.pd
    };
}

/**
 * 缓存请求函数，专用于handleTemplateInheritance、commonClassParse、commonHomeListParse三个函数
 * 这三个函数在同一次接口调用中共享缓存，host相同时复用HTML内容
 * @param {Function} requestFunc - 请求函数
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @param {string} cachePrefix - 缓存前缀，建议使用'host'
 * @returns {Promise<string>} - 请求结果
 */
export async function cachedRequest(requestFunc, url, options = {}, cachePrefix = 'host') {
    // 只为特定的三个函数提供缓存，使用host作为缓存键的主要部分
    const cacheKey = `${cachePrefix}:${md5(url + JSON.stringify(options))}`;

    // 检查缓存
    let cached = pageRequestCache.get(cacheKey);
    if (cached) {
        log(`[cachedRequest] 使用缓存的页面内容: ${url}`);
        return cached;
    }

    // 发起请求
    log(`[cachedRequest] 首次请求页面: ${url}`);
    try {
        const result = await requestFunc(url, options);
        if (result) {
            // 缓存结果，使用新的PageRequestCache类（内置20秒自动清理）
            pageRequestCache.set(cacheKey, result);
        }
        return result;
    } catch (e) {
        log(`[cachedRequest] 请求失败: ${url}, 错误: ${e.message}`);
        return '';
    }
}

/**
 * 通用错误处理和日志记录函数
 * @param {Function} operation - 要执行的操作函数
 * @param {string} context - 上下文信息（用于日志）
 * @param {*} defaultValue - 发生错误时的默认返回值
 * @returns {Promise<*>} 操作结果或默认值
 */
async function safeExecute(operation, context, defaultValue = null) {
    try {
        return await operation();
    } catch (e) {
        log(`[${context}] 执行失败: ${e.message}`);
        return defaultValue;
    }
}

/**
 * 安全解析HTML元素
 * @param {Function} parseFunc - 解析函数
 * @param {*} element - 要解析的元素
 * @param {string} selector - 选择器
 * @param {string} context - 上下文信息
 * @param {string} defaultValue - 默认值
 * @returns {string} 解析结果或默认值
 */
function safeParse(parseFunc, element, selector, context, defaultValue = '') {
    try {
        return parseFunc(element, selector).replace(/\n|\t/g, '').trim() || defaultValue;
    } catch (e) {
        log(`[${context}] 解析${selector}失败: ${e.message}`);
        return defaultValue;
    }
}

/**
 * 安全解析URL（用于$pd函数）
 * @param {Function} parseFunc - 解析函数（$pd）
 * @param {*} element - 要解析的元素
 * @param {string} selector - 选择器
 * @param {string} baseUrl - 基础URL
 * @param {string} context - 上下文信息
 * @param {string} defaultValue - 默认值
 * @returns {string} 解析结果或默认值
 */
function safeParseUrl(parseFunc, element, selector, baseUrl, context, defaultValue = '') {
    try {
        return parseFunc(element, selector, baseUrl) || defaultValue;
    } catch (e) {
        log(`[${context}] 解析${selector}失败: ${e.message}`);
        return defaultValue;
    }
}

/**
 * 通用视频对象后处理函数
 * 统一处理图片和vodDeal调用
 * @param {Object} vod - 视频对象
 * @param {Object} moduleObject - 模块对象
 * @param {Object} context - 上下文对象
 * @returns {Promise<Object>} 处理后的视频对象
 */
async function processVodCommon(vod, moduleObject, context) {
    // 处理图片
    if (vod.vod_pic) {
        try {
            vod.vod_pic = await processImage(vod.vod_pic, moduleObject, context);
        } catch (e) {
            log(`[processVodCommon] 图片处理失败: ${e.message}`);
        }
    }

    // 处理vodDeal
    try {
        vod = vodDeal(vod, moduleObject);
    } catch (e) {
        log(`[processVodCommon] vodDeal发生错误: ${e.message}`);
    }

    return vod;
}

/**
 * 创建基础视频对象
 * @param {string} orId - 原始ID
 * @param {string} vod_name - 视频名称
 * @param {string} vod_pic - 视频图片
 * @returns {Object} 基础视频对象
 */
function createBaseVod(orId, vod_name = '片名', vod_pic = '') {
    return {
        vod_id: orId,
        vod_name,
        vod_pic,
        type_name: '类型',
        vod_year: '年份',
        vod_area: '地区',
        vod_remarks: '更新信息',
        vod_actor: '主演',
        vod_director: '导演',
        vod_content: '简介',
    };
}

// 构建视频对象的公共函数
async function buildVodObject(element, params, moduleObject, injectVars, context) {
    const {p1, p2, p3, p4, p5} = params;
    // 从context中获取解析函数
    const {$pdfh, $pd, MY_URL} = context;

    let vod_name = $pdfh(element, p1);
    let vod_pic = '';
    try {
        vod_pic = $pd(element, p2);
    } catch (e) {
    }

    let vod_remarks = '';
    try {
        vod_remarks = $pdfh(element, p3);
    } catch (e) {
    }

    let links = [];
    for (let _p5 of p4.split('+')) {
        let link = !moduleObject.detailUrl ? $pd(element, _p5, MY_URL) : $pdfh(element, _p5);
        links.push(link);
    }
    let vod_id = links.join('$');

    let vod_content = '';
    if (p5) {
        try {
            vod_content = $pdfh(element, p5);
        } catch (e) {
        }
    }

    if (moduleObject['二级'] === '*') {
        vod_id = vod_id + '@@' + vod_name + '@@' + vod_pic;
    }

    if (vod_pic) {
        vod_pic = await processImage(vod_pic, moduleObject, injectVars);
    }

    return {
        'vod_id': vod_id,
        'vod_name': vod_name,
        'vod_pic': vod_pic,
        'vod_remarks': vod_remarks,
        'vod_content': vod_content,
    };
}

export async function homeParse(rule) {
    let url = rule.homeUrl;
    if (typeof (rule.filter) === 'string' && rule.filter.trim().length > 0) {
        try {
            let filter_json = ungzip(rule.filter.trim());
            // log(filter_json);
            rule.filter = JSON.parse(filter_json);
        } catch (e) {
            log(`[homeParse] [${rule.title}] filter ungzip或格式化解密出错: ${e.message}`);
            rule.filter = {};
        }
    }
    let classes = [];
    if (rule.class_name && rule.class_url) {
        let names = rule.class_name.split('&');
        let urls = rule.class_url.split('&');
        let cnt = Math.min(names.length, urls.length);
        for (let i = 0; i < cnt; i++) {
            classes.push({
                'type_id': urls[i],
                'type_name': names[i],
                'type_flag': rule['class_flag'],
            });
        }
    }
    const rule_filter = rule.hasOwnProperty('filter') ? rule.filter || {} : null;
    const context = createParserContext(url, rule, {
        TYPE: 'home',
        input: url,
        classes: classes,
        filters: rule_filter,
        cate_exclude: rule.cate_exclude,
        home_flag: rule.home_flag,
    });

    return context;
}

export async function homeParseAfter(d, _type, hikerListCol, hikerClassListCol, mergeList, injectVars) {
    if (!d) {
        d = {};
    }
    d.type = _type || '影视';
    if (hikerListCol) {
        d.hikerListCol = hikerListCol;
    }
    if (hikerClassListCol) {
        d.hikerClassListCol = hikerClassListCol;
    }
    // 跳过形式二级
    if (mergeList) {
        d.hikerSkipEr = mergeList;
        d.mergeList = mergeList;
    }
    const {
        classes,
        filters,
        cate_exclude,
        home_flag,
    } = injectVars;
    if (!Array.isArray(d.class)) {
        d.class = classes;
    }
    if (!d.filters) {
        d.filters = filters;
    }
    if (!d.list) {
        d.list = [];
    }
    if (!d.type_flag && home_flag) {
        d.type_flag = home_flag;
    }
    d.class = d.class.filter(it => !cate_exclude || !(new RegExp(cate_exclude).test(it.type_name)));
    if (d.filters && Object.keys(d.filters).length === 1 && Object.keys(d.filters)[0] === '*') {
        const common_filters = d.filters['*'];
        const show_filters = {};
        d.class.forEach(it => {
            show_filters[it.type_id] = common_filters;
        });
        d.filters = show_filters;
    }
    return d
}

export async function homeVodParse(rule) {
    let url = rule.homeUrl;
    return createParserContext(url, rule, {
        TYPE: 'home',
        input: url,
        double: rule.double,
    });
}

export async function cateParse(rule, tid, pg, filter, extend) {
    log('[cateParse]', tid, pg, filter, extend);
    let url = rule.url.replaceAll('fyclass', tid);
    if (pg === 1 && url.includes('[') && url.includes(']')) {
        url = url.split('[')[1].split(']')[0];
    } else if (pg > 1 && url.includes('[') && url.includes(']')) {
        url = url.split('[')[0];
    }
    if (rule.filter_def && typeof (rule.filter_def) === 'object') {
        try {
            if (Object.keys(rule.filter_def).length > 0 && rule.filter_def.hasOwnProperty(tid)) {
                let self_fl_def = rule.filter_def[tid];
                if (self_fl_def && typeof (self_fl_def) === 'object') {
                    let k = [Object.keys(self_fl_def)][0]
                    k.forEach(k => {
                        if (!extend.hasOwnProperty(k)) {
                            extend[k] = self_fl_def[k];
                        }
                    })
                }
            }
        } catch (e) {
            log(`[cateParse] 合并不同分类对应的默认筛选出错:${e.message}`);
        }
    }
    if (rule.filter_url) {
        if (!/fyfilter/.test(url)) {
            if (!url.endsWith('&') && !rule.filter_url.startsWith('&')) {
                url += '&'
            }
            url += rule.filter_url;
        } else {
            url = url.replace('fyfilter', rule.filter_url);
        }
        url = url.replaceAll('fyclass', tid);
        let fl = filter ? extend : {};
        if (rule.filter_def && typeof (rule.filter_def) === 'object') {
            try {
                if (Object.keys(rule.filter_def).length > 0 && rule.filter_def.hasOwnProperty(tid)) {
                    let self_fl_def = rule.filter_def[tid];
                    if (self_fl_def && typeof (self_fl_def) === 'object') {
                        let fl_def = deepCopy(self_fl_def);
                        fl = Object.assign(fl_def, fl);
                    }
                }
            } catch (e) {
                log(`[cateParse] 合并不同分类对应的默认筛选出错:${e.message}`);
            }
        }
        let new_url;
        new_url = jinja.render(url, {fl: fl, fyclass: tid});
        url = new_url;
    }
    if (/fypage/.test(url)) {
        if (url.includes('(') && url.includes(')')) {
            let url_rep = url.match(/.*?\((.*)\)/)[1];
            let cnt_page = url_rep.replaceAll('fypage', pg);
            let cnt_pg = eval(cnt_page);
            url = url.replaceAll(url_rep, cnt_pg).replaceAll('(', '').replaceAll(')', '');
        } else {
            url = url.replaceAll('fypage', pg);
        }
    }
    return createParserContext(url, rule, {
        MY_CATE: tid,
        MY_FL: extend,
        TYPE: 'cate',
        input: url,
        MY_PAGE: pg,
    });
}

export async function cateParseAfter(rule, d, pg) {
    return d.length < 1 ? nodata : {
        'page': parseInt(pg),
        'pagecount': 9999,
        'limit': Number(rule.limit) || 20,
        'total': 999999,
        'list': d,
    }
}

export async function detailParse(rule, ids) {
    let vid = ids[0].toString();
    let orId = vid;
    let fyclass = '';
    log('[detailParse] orId:' + orId);
    if (vid.indexOf('$') > -1) {
        let tmp = vid.split('$');
        fyclass = tmp[0];
        vid = tmp[1];
    }
    let detailUrl = vid.split('@@')[0];
    let url;
    if (!detailUrl.startsWith('http') && !detailUrl.includes('/')) {
        url = rule.detailUrl.replaceAll('fyid', detailUrl).replaceAll('fyclass', fyclass);
    } else if (detailUrl.includes('/')) {
        url = urljoin(rule.homeUrl, detailUrl);
    } else {
        url = detailUrl
    }

    return createParserContext(url, rule, {
        TYPE: 'detail',
        input: url,
        vid: vid,
        orId: orId,
        fyclass: fyclass,
        detailUrl: detailUrl,
    });
}

export async function detailParseAfter(vod) {
    return {
        list: [vod]
    }
}

export async function searchParse(rule, wd, quick, pg) {
    if (rule.search_encoding) {
        if (rule.search_encoding.toLowerCase() !== 'utf-8') {
            // 按搜索编码进行编码
            wd = encodeStr(wd, rule.search_encoding);
        }
    } else if (rule.encoding && rule.encoding.toLowerCase() !== 'utf-8') {
        // 按全局编码进行编码
        wd = encodeStr(wd, rule.encoding);
    }
    if (!rule.searchUrl) {
        return
    }
    if (rule.searchNoPage && Number(pg) > 1) {
        // 关闭搜索分页
        return '{}'
    }
    let url = rule.searchUrl.replaceAll('**', wd);
    if (pg === 1 && url.includes('[') && url.includes(']') && !url.includes('#')) {
        url = url.split('[')[1].split(']')[0];
    } else if (pg > 1 && url.includes('[') && url.includes(']') && !url.includes('#')) {
        url = url.split('[')[0];
    }

    if (/fypage/.test(url)) {
        if (url.includes('(') && url.includes(')')) {
            let url_rep = url.match(/.*?\((.*)\)/)[1];
            let cnt_page = url_rep.replaceAll('fypage', pg);
            let cnt_pg = eval(cnt_page);
            url = url.replaceAll(url_rep, cnt_pg).replaceAll('(', '').replaceAll(')', '');
        } else {
            url = url.replaceAll('fypage', pg);
        }
    }
    return createParserContext(url, rule, {
        TYPE: 'search',
        MY_PAGE: pg,
        KEY: wd,
        input: url,
        detailUrl: rule.detailUrl || '',
    });

}

export async function searchParseAfter(rule, d, pg) {
    return {
        'page': parseInt(pg),
        'pagecount': 9999,
        'limit': Number(rule.limit) || 20,
        'total': 999999,
        'list': d,
    }
}

export async function playParse(rule, flag, id, flags) {
    let url = id;
    if (!/http/.test(url)) {
        try {
            url = base64Decode(url);
            log('[playParse] id is base64 data');
        } catch (e) {
        }
    }
    url = decodeURIComponent(url);
    if (!/^http/.test(url)) {
        url = id;
    }
    if (id !== url) {
        log(`[playParse] ${id} => ${url}`);
    } else {
        log(`[playParse] ${url}`);
    }
    return createParserContext(url, rule, {
        TYPE: 'play',
        MY_FLAG: flag,
        flag: flag,
        input: url,
    });
}

export async function playParseAfter(rule, obj, playUrl, flag) {
    let common_play = {
        parse: SPECIAL_URL.test(playUrl) || /^(push:)/.test(playUrl) ? 0 : 1,
        url: playUrl,
        flag: flag,
        jx: tellIsJx(playUrl)
    };
    let lazy_play;
    const is_lazy_function = rule.play_parse && rule.lazy && typeof (rule.lazy) === 'function';
    const is_lazy_function_str = rule.play_parse && rule.lazy && typeof (rule.lazy) === 'string' && rule.lazy.startsWith('js:');
    if (!rule.play_parse || !rule.lazy) {
        lazy_play = common_play;
    } else if (is_lazy_function || is_lazy_function_str) {
        try {
            lazy_play = typeof (obj) === 'object' ? obj : {
                parse: SPECIAL_URL.test(obj) || /^(push:)/.test(obj) ? 0 : 1,
                jx: tellIsJx(obj),
                url: obj
            };
        } catch (e) {
            log(`[playParseAfter] js免嗅错误:${e.message}`);
            lazy_play = common_play;
        }
    } else {
        lazy_play = common_play;
    }
    if (Array.isArray(rule.play_json) && rule.play_json.length > 0) { // 数组情况判断长度大于0
        let web_url = lazy_play.url;
        for (let pjson of rule.play_json) {
            if (pjson.re && (pjson.re === '*' || web_url.match(new RegExp(pjson.re)))) {
                if (pjson.json && typeof (pjson.json) === 'object') {
                    let base_json = pjson.json;
                    lazy_play = Object.assign(lazy_play, base_json);
                    break;
                }
            }
        }
    } else if (rule.play_json && !Array.isArray(rule.play_json)) { // 其他情况 非[] 判断true/false
        let base_json = {
            jx: 1,
            parse: 1,
        };
        lazy_play = Object.assign(lazy_play, base_json);
    } else if (!rule.play_json) { // 不解析传0
        let base_json = {
            jx: 0,
            parse: 1,
        };
        lazy_play = Object.assign(lazy_play, base_json);
    }
    return lazy_play
}

export async function proxyParse(rule, params) {
    // log('proxyParse:', params);
    return {
        TYPE: 'proxy',
        input: params.url || '',
        MY_URL: params.url || '',
    }
}

/**
 * 通用分类解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
export async function commonClassParse(moduleObject, method, injectVars, args) {
    // class_parse字符串p
    let p = moduleObject[method].trim();
    let cate_exclude = moduleObject['cate_exclude'].trim();
    const tmpFunction = async function () {
        const {input, MY_URL, pdfa, pdfh, pd, pjfa, pjfh, pj} = this;
        let classes = [];

        // 处理class_parse字符串解析
        p = p.split(';');
        let p0 = p[0];
        let is_json = p0.startsWith('json:');
        p0 = p0.replace(/^(jsp:|json:|jq:)/, '');

        // 通过沙箱执行cachedRequest函数，保证同一会话缓存共享
        let html = await executeSandboxFunction('cachedRequest', [sandboxVar('request'), sandboxString(input), {}, sandboxString('host')], moduleObject.context, '获取HTML异常', '');
        if (html) {
            if (is_json) {
                html = dealJson(html);
            }
            const {$pdfa, $pdfh, $pd} = selectParseMode(is_json, this);

            if (is_json) {
                try {
                    let list = $pdfa(html, p0);
                    if (list && list.length > 0) {
                        classes = list;
                    }
                } catch (e) {
                    log(`[commonClassParse] json分类解析失败:${e.message}`);
                }
            } else if (p.length >= 3) { // 可以不写正则
                try {
                    let list = $pdfa(html, p0);
                    if (list && list.length > 0) {
                        for (const it of list) {
                            try {
                                //log('[commonClassParse] it:', it);
                                let name = $pdfh(it, p[1]);
                                if (cate_exclude && (new RegExp(cate_exclude).test(name))) {
                                    continue;
                                }
                                let url = $pd(it, p[2]);
                                if (p.length > 3 && p[3]) {
                                    let exp = new RegExp(p[3]);
                                    let match = url.match(exp);
                                    if (match && match[1]) {
                                        url = match[1];
                                    }
                                }
                                if (name.trim()) {
                                    classes.push({
                                        'type_id': url.trim(),
                                        'type_name': name.trim()
                                    });
                                }
                            } catch (e) {
                                log(`[commonClassParse] 分类列表解析元素失败:${e.message}`);
                            }
                        }
                    }
                } catch (e) {
                    log(`[commonClassParse] 分类列表解析失败:${e.message}`);
                }
            }
        }
        return {class: classes};
    };
    return await invokeWithInjectVars(moduleObject, tmpFunction, injectVars, args);
}


/**
 * 通用推荐字符串解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
export async function commonHomeListParse(moduleObject, method, injectVars, args) {
    // 推荐字符串p
    let p = moduleObject[method] === '*' && moduleObject['一级'] ? moduleObject['一级'] : moduleObject[method];
    // 一级是函数直接调用函数
    if (typeof p === 'function') {
        // log('推荐继承一级函数');
        return await invokeWithInjectVars(moduleObject, p, injectVars, args);
    }
    // 推荐完全和一级相同的话，双重定位为false
    if (moduleObject[method] === '*') {
        moduleObject['double'] = false;
    }

    p = p.trim();
    let pp = typeof moduleObject['一级'] === 'string' ? moduleObject['一级'].split(';') : [];
    const is_double = moduleObject.double;
    const tmpFunction = async function () {
        const {input, MY_URL, pdfa, pdfh, pd, pjfa, pjfh, pj} = this;
        const d = [];

        // 使用公用函数初始化解析配置
        const config = initCommonParseConfig(p, pp, MY_URL, moduleObject);
        const {p: parsedP, p0, is_json, parseParams} = config;

        if ((!is_double && parsedP.length < 5) || (is_double && parsedP.length < 6)) {
            return d
        }

        // 使用公用函数获取HTML
        let html = await getCommonHtml(MY_URL, moduleObject, 'cachedRequest');
        if (html) {
            // 重新赋值p为解析后的数组
            p = parsedP;

            if (is_double) {
                // 双重解析逻辑
                if (is_json) {
                    html = dealJson(html);
                }
                const {$pdfa, $pdfh, $pd} = selectParseMode(is_json, this);
                let list = $pdfa(html, p0);
                const parseContext = {$pdfa, $pdfh, $pd, MY_URL};

                let p1 = getPP(p, 1, pp, 0);
                let p2 = getPP(p, 2, pp, 1);
                let p3 = getPP(p, 3, pp, 2);
                let p4 = getPP(p, 4, pp, 3);
                let p5 = getPP(p, 5, pp, 4);
                let p6 = getPP(p, 6, pp, 5);

                for (const it of list) {
                    let list2 = $pdfa(it, p1);
                    for (let it2 of list2) {
                        const params = {
                            p1: p2,
                            p2: p3,
                            p3: p4,
                            p4: p5,
                            p5: p.length > 6 && p[6] ? p6 : ''
                        };
                        const vod = await buildVodObject(it2, params, moduleObject, injectVars, parseContext);
                        d.push(vod);
                    }
                }
            } else {
                // 使用通用列表解析函数
                const result = await parseCommonList(html, config, this, moduleObject, injectVars);
                d.push(...result);
            }
        }
        return d
    };
    return await invokeWithInjectVars(moduleObject, tmpFunction, injectVars, args);
}

/**
 * 通用解析初始化逻辑
 * @param {string} p - 解析字符串
 * @param {Array} pp - 一级解析分割列表
 * @param {string} MY_URL - 当前URL
 * @param {Object} moduleObject - 模块对象
 * @returns {Object} 包含解析配置的对象
 */
function initCommonParseConfig(p, pp, MY_URL, moduleObject) {
    p = p.split(';');
    let p0 = getPP(p, 0, pp, 0);
    let is_json = p0.startsWith('json:');
    p0 = p0.replace(/^(jsp:|json:|jq:)/, '');

    return {
        p,
        p0,
        is_json,
        parseParams: {
            p1: getPP(p, 1, pp, 1),
            p2: getPP(p, 2, pp, 2),
            p3: getPP(p, 3, pp, 3),
            p4: getPP(p, 4, pp, 4),
            p5: getPP(p, 5, pp, 5)
        }
    };
}

/**
 * 通用HTML获取逻辑
 * @param {string} url - 请求URL
 * @param {Object} moduleObject - 模块对象
 * @param {string} method - 请求方法类型
 * @returns {Promise<string>} HTML内容
 */
async function getCommonHtml(url, moduleObject, method = 'get') {
    if (method === 'cachedRequest') {
        return await executeSandboxFunction('cachedRequest', [sandboxVar('request'), sandboxString(url), {}, sandboxString('host')], moduleObject.context, '获取HTML异常', '');
    } else if (method === 'request') {
        return await executeSandboxFunction('request', [sandboxString(url), {}], moduleObject.context, '获取HTML异常', '');
    } else {
        return await executeSandboxFunction('getHtml', [sandboxString(url)], moduleObject.context, '获取HTML异常', '');
    }
}

/**
 * 通用列表解析逻辑
 * @param {string} html - HTML内容
 * @param {Object} config - 解析配置
 * @param {Object} context - 解析上下文
 * @param {Object} moduleObject - 模块对象
 * @param {Object} injectVars - 注入变量
 * @returns {Array} 解析结果列表
 */
async function parseCommonList(html, config, context, moduleObject, injectVars) {
    const {p0, is_json, parseParams} = config;
    const d = [];

    if (is_json) {
        html = dealJson(html);
    }

    const {$pdfa, $pdfh, $pd} = selectParseMode(is_json, context);
    let list = $pdfa(html, p0);
    const parseContext = {$pdfa, $pdfh, $pd, MY_URL: context.MY_URL};

    for (const it of list) {
        const vod = await buildVodObject(it, parseParams, moduleObject, injectVars, parseContext);
        d.push(vod);
    }

    return d;
}

/**
 * 推荐和搜索单字段继承一级
 * @param p 推荐或搜索的解析分割;列表
 * @param pn 自身列表序号
 * @param pp  一级解析分割;列表
 * @param ppn 继承一级序号
 * @returns {*}
 */
function getPP(p, pn, pp, ppn) {
    try {
        return p[pn] === '*' && pp.length > ppn ? pp[ppn] : p[pn]
    } catch (e) {
        return ''
    }
}

/**
 * 通用一级字符串解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
export async function commonCategoryListParse(moduleObject, method, injectVars, args) {
    // 一级字符串p
    let p = moduleObject[method].trim();
    const tmpFunction = async function () {
        const {input, MY_URL, MY_CATE, pdfa, pdfh, pd, pjfa, pjfh, pj} = this;
        const d = [];

        // 使用公用函数初始化解析配置
        const config = initCommonParseConfig(p, [], MY_URL, moduleObject);
        const {p: parsedP, p0, is_json} = config;

        if (parsedP.length < 5) {
            return d
        }

        // 使用公用函数获取HTML
        let html = await executeSandboxFunction('request', [sandboxString(input), {}], moduleObject.context, '获取HTML异常', '');
        if (html) {
            if (is_json) {
                html = dealJson(html);
            }
            const {$pdfa, $pdfh, $pd} = selectParseMode(is_json, this);
            let list = $pdfa(html, p0);

            // 重新赋值p为解析后的数组
            p = parsedP;
            for (const it of list) {
                // 为分类列表构建特殊的参数格式
                let links = p[4].split('+').map(p4 => {
                    return !moduleObject.detailUrl ? $pd(it, p4, MY_URL) : $pdfh(it, p4);
                });
                let link = links.join('$');

                let vod_id = moduleObject.detailUrl ? MY_CATE + '$' + link : link;
                let vod_name = $pdfh(it, p[1]).replace(/\n|\t/g, '').trim();
                let vod_pic = $pd(it, p[2], MY_URL);
                let vod_remarks = $pdfh(it, p[3]).replace(/\n|\t/g, '').trim();

                if (moduleObject['二级'] === '*') {
                    vod_id = vod_id + '@@' + vod_name + '@@' + vod_pic;
                }
                if (vod_pic) {
                    vod_pic = await processImage(vod_pic, moduleObject, injectVars);
                }
                d.push({
                    'vod_id': vod_id,
                    'vod_name': vod_name,
                    'vod_pic': vod_pic,
                    'vod_remarks': vod_remarks,
                });
            }
        }
        return d
    };
    return await invokeWithInjectVars(moduleObject, tmpFunction, injectVars, args);
}

/**
 * 通用二级字符串/对象解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
export async function commonDetailListParse(moduleObject, method, injectVars, args) {
    // 二级字符串或对象p
    let p = moduleObject[method];
    // 不再直接引用 moduleObject.request，改为通过 executeSandboxFunction 调用
    const tmpFunction = async function () {
        const {input, vid, orId, fyclass, MY_URL, HOST, fetch_params, jsp, pdfh, pdfa, pd, pdfl, pjfh, pjfa, pj} = this;

        let vod_name = '片名';
        let vod_pic = '';
        let vod_id = orId;

        if (p === '*') {
            let extra = orId.split('@@');
            vod_name = extra.length > 1 ? extra[1] : vod_name;
            vod_pic = extra.length > 2 ? extra[2] : vod_pic;
        }

        let vod = createBaseVod(vod_id, vod_name, vod_pic);
        vod.type_name = '类型';
        vod.vod_year = '年份';
        vod.vod_area = '地区';
        vod.vod_remarks = '更新信息';
        vod.vod_actor = '主演';
        vod.vod_director = '导演';
        vod.vod_content = '简介';

        let html = '';

        // 执行二级访问前代码
        if (moduleObject.二级访问前 && typeof moduleObject.二级访问前 === 'function') {
            log('[commonDetailListParse] 开始执行二级访问前代码');
            try {
                const result = await moduleObject.二级访问前.call(this);
                // 如果二级访问前返回了新的URL，需要重新构建解析环境
                if (result && result !== this.MY_URL) {
                    log(`[commonDetailListParse] 二级访问前返回新URL: ${result}`);
                    this.MY_URL = result;
                    this.input = result;
                    // 重新创建jsp对象和绑定解析函数
                    const newJsp = new jsoup(result);
                    this.jsp = newJsp;
                    this.pdfh = newJsp.pdfh.bind(newJsp);
                    this.pdfa = newJsp.pdfa.bind(newJsp);
                    this.pd = newJsp.pd.bind(newJsp);
                    this.pdfl = newJsp.pdfl.bind(newJsp);
                    this.pjfh = newJsp.pjfh.bind(newJsp);
                    this.pjfa = newJsp.pjfa.bind(newJsp);
                    this.pj = newJsp.pj.bind(newJsp);
                    // 清空html，强制重新获取
                    html = '';
                }
            } catch (e) {
                log(`[commonDetailListParse] 二级访问前执行失败:${e.message}`);
            }
        }

        if (p === '*') {
            vod.vod_play_from = '道长在线';
            vod.vod_remarks = input;
            vod.vod_actor = '没有二级,只有一级链接直接嗅探播放';
            vod.vod_content = MY_URL;
            vod.vod_play_url = '嗅探播放$' + MY_URL.split('@@')[0];
        } else if (typeof p === 'object' && p !== null) {
            // 如果没有html，需要获取源码
            if (!html) {
                html = await executeSandboxFunction('request', [sandboxString(input)], moduleObject.context, '[commonDetailListParse] 获取详情页源码失败');
            }

            // 根据解析模式选择对应的解析函数
            if (p.is_json) {
                log('[commonDetailListParse] 二级是json');
                html = dealJson(html);
            } else {
                log('[commonDetailListParse] 二级默认jq');
            }
            const {$pdfa, $pdfh, $pd} = selectParseMode(p.is_json, this);

            // 解析title字段
            if (p.title) {
                let p1 = p.title.split(';');
                vod.vod_name = safeParse($pdfh, html, p1[0], 'commonDetailListParse-title', vod.vod_name);
                if (p1.length > 1) {
                    let type_name = safeParse($pdfh, html, p1[1], 'commonDetailListParse-type').replace(/ /g, '');
                    vod.type_name = type_name || vod.type_name;
                }
            }

            // 解析desc字段
            if (p.desc) {
                let p1 = p.desc.split(';');
                vod.vod_remarks = safeParse($pdfh, html, p1[0], 'commonDetailListParse-remarks', vod.vod_remarks);
                vod.vod_year = p1.length > 1 ? safeParse($pdfh, html, p1[1], 'commonDetailListParse-year', vod.vod_year) : vod.vod_year;
                vod.vod_area = p1.length > 2 ? safeParse($pdfh, html, p1[2], 'commonDetailListParse-area', vod.vod_area) : vod.vod_area;
                vod.vod_actor = p1.length > 3 ? safeParse($pdfh, html, p1[3], 'commonDetailListParse-actor', vod.vod_actor) : vod.vod_actor;
                vod.vod_director = p1.length > 4 ? safeParse($pdfh, html, p1[4], 'commonDetailListParse-director', vod.vod_director) : vod.vod_director;
            }

            // 解析content字段
            if (p.content) {
                let p1 = p.content.split(';');
                vod.vod_content = safeParse($pdfh, html, p1[0], 'commonDetailListParse-content', vod.vod_content);
            }

            // 解析img字段
            if (p.img) {
                let p1 = p.img.split(';');
                vod.vod_pic = safeParseUrl($pd, html, p1[0], this.MY_URL, 'commonDetailListParse-img', vod.vod_pic);
            }

            let vod_play_from = '$$$';
            let playFrom = [];

            // 处理重定向
            if (p.重定向 && typeof p.重定向 === 'function') {
                log('[commonDetailListParse] 开始执行重定向代码');
                html = await safeExecute(() => p.重定向.call(this), 'commonDetailListParse-重定向', html);
            }

            // 处理tabs
            if (p.tabs) {
                if (typeof p.tabs === 'function') {
                    log('[commonDetailListParse] 开始执行tabs代码');
                    try {
                        const TABS = await p.tabs.call(this);
                        playFrom = TABS;
                    } catch (e) {
                        log(`[commonDetailListParse] tabs执行失败:${e.message}`);
                    }
                } else {
                    let p_tab = p.tabs.split(';')[0];
                    let vHeader = $pdfa(html, p_tab);
                    let tab_text = p.tab_text || 'body&&Text';
                    let new_map = {};
                    for (let v of vHeader) {
                        let v_title = $pdfh(v, tab_text).trim();
                        if (!v_title) {
                            v_title = '线路空';
                        }
                        if (moduleObject.tab_exclude && (new RegExp(moduleObject.tab_exclude)).test(v_title)) {
                            continue;
                        }
                        if (!new_map.hasOwnProperty(v_title)) {
                            new_map[v_title] = 1;
                        } else {
                            new_map[v_title] += 1;
                        }
                        if (new_map[v_title] > 1) {
                            v_title += Number(new_map[v_title] - 1);
                        }
                        playFrom.push(v_title);
                    }
                }
            } else {
                playFrom = ['道长在线'];
            }
            vod.vod_play_from = playFrom.join(vod_play_from);

            // 处理lists
            let vod_play_url = '$$$';
            let vod_tab_list = [];
            if (p.lists) {
                if (typeof p.lists === 'function') {
                    log('[commonDetailListParse] 开始执行lists代码');
                    try {
                        const LISTS = await p.lists.call(this);
                        for (let i in LISTS) {
                            if (LISTS.hasOwnProperty(i)) {
                                try {
                                    LISTS[i] = LISTS[i].map(it => it.split('$').slice(0, 2).join('$'));
                                } catch (e) {
                                    log(`[commonDetailListParse] 格式化LISTS发生错误:${e.message}`);
                                }
                            }
                        }
                        vod_play_url = LISTS.map(it => it.join('#')).join(vod_play_url);
                    } catch (e) {
                        log(`[commonDetailListParse] lists执行失败:${e.message}`);
                    }
                } else {
                    let list_text = p.list_text || 'body&&Text';
                    let list_url = p.list_url || 'a&&href';
                    let list_url_prefix = p.list_url_prefix || '';
                    let is_tab_js = typeof p.tabs === 'function';

                    for (let i = 0; i < playFrom.length; i++) {
                        let tab_name = playFrom[i];
                        let tab_ext = '';
                        if (typeof p.tabs === 'string' && p.tabs.split(';').length > 1 && !is_tab_js) {
                            tab_ext = p.tabs.split(';')[1];
                        }
                        let p1 = p.lists.replaceAll('#idv', tab_name).replaceAll('#id', i);
                        if (tab_ext) {
                            tab_ext = tab_ext.replaceAll('#idv', tab_name).replaceAll('#id', i);
                        }
                        let tabName = tab_ext ? $pdfh(html, tab_ext) : tab_name;

                        let new_vod_list = [];
                        if (typeof this.pdfl === 'function') {
                            new_vod_list = this.pdfl(html, p1, list_text, list_url, this.MY_URL);
                            if (list_url_prefix) {
                                new_vod_list = new_vod_list.map(it => it.split('$')[0] + '$' + list_url_prefix + it.split('$').slice(1).join('$'));
                            }
                        } else {
                            let vodList = [];
                            try {
                                vodList = $pdfa(html, p1);
                            } catch (e) {
                                log(`[commonDetailListParse] 解析vodList失败:${e.message}`);
                            }
                            for (let j = 0; j < vodList.length; j++) {
                                let it = vodList[j];
                                new_vod_list.push($pdfh(it, list_text).trim() + '$' + list_url_prefix + $pd(it, list_url, this.MY_URL));
                            }
                        }

                        if (new_vod_list.length > 0) {
                            new_vod_list = forceOrder(new_vod_list, '', x => x.split('$')[0]);
                        }

                        let vlist = new_vod_list.join('#');
                        vod_tab_list.push(vlist);
                    }
                    vod_play_url = vod_tab_list.join(vod_play_url);
                }
            }
            vod.vod_play_url = vod_play_url;
        }

        // 统一处理图片和vodDeal
        vod = await processVodCommon(vod, moduleObject, this);

        return vod;
    };
    return await invokeWithInjectVars(moduleObject, tmpFunction, injectVars, args);
}

/**
 * 通用搜索字符串解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
export async function commonSearchListParse(moduleObject, method, injectVars, args) {
    // 搜索字符串p
    let p = moduleObject[method] === '*' && moduleObject['一级'] ? moduleObject['一级'] : moduleObject[method];
    // 一级是函数直接调用函数
    if (typeof p === 'function') {
        // log('搜索继承一级函数');
        return await invokeWithInjectVars(moduleObject, p, injectVars, args);
    }
    p = p.trim();
    let pp = typeof moduleObject['一级'] === 'string' ? moduleObject['一级'].split(';') : [];
    const rule_fetch_params = moduleObject.rule_fetch_params;
    const searchWd = injectVars.KEY;
    const tmpFunction = async function () {
        const {input, MY_URL, pdfa, pdfh, pd, pjfa, pjfh, pj} = this;
        const d = [];

        // 使用公用函数初始化解析配置
        const config = initCommonParseConfig(p, pp, MY_URL, moduleObject);
        const {p: parsedP, p0, is_json, parseParams} = config;

        if (parsedP.length < 5) {
            return d
        }
        let req_method = MY_URL.split(';').length > 1 ? MY_URL.split(';')[1].toLowerCase() : 'get';
        let html;
        if (req_method === 'post') {
            let rurls = MY_URL.split(';')[0].split('#')
            let rurl = rurls[0]
            let params = rurls.length > 1 ? rurls[1] : '';
            log(`[commonSearchListParse] post=》rurl:${rurl},params:${params}`);
            let _fetch_params = deepCopy(rule_fetch_params);
            let postData = {body: params};
            Object.assign(_fetch_params, postData);
            html = await post(rurl, _fetch_params);
        } else if (req_method === 'postjson') {
            let rurls = MY_URL.split(';')[0].split('#')
            let rurl = rurls[0]
            let params = rurls.length > 1 ? rurls[1] : '';
            log(`[commonSearchListParse] postjson-》rurl:${rurl},params:${params}`);
            try {
                params = JSON.parse(params);
            } catch (e) {
                params = '{}'
            }
            let _fetch_params = deepCopy(rule_fetch_params);
            let postData = {body: params};
            Object.assign(_fetch_params, postData);
            html = await post(rurl, _fetch_params);
        } else {
            // 在沙箱环境中执行getHtml获取源码，自动带入验证成功的cookie
            html = await executeSandboxFunction('getHtml', [sandboxString(MY_URL)], moduleObject.context, '获取HTML异常', '');
        }

        // 解决搜索源码奇葩触发自动过验证逻辑
        if (html) {
            let search_tag = moduleObject['搜索验证标识'] || '系统安全验证|输入验证码';
            if (new RegExp(search_tag).test(html)) {
                log('[verifyCode] 遇到搜索验证码,尝试过验证:', html);
                // 在沙箱中执行验证码处理逻辑
                const cookie = await executeSandboxFunction('verifyCode', [sandboxString(MY_URL)], moduleObject.context, '验证码处理异常', null);
                if (cookie) {
                    log('本次成功过验证,cookie:' + cookie);
                    // 需要在沙箱中执行setItem
                    await executeSandboxFunction('setItem', [sandboxVar('RULE_CK'), sandboxString(cookie)], moduleObject.context, 'setItem异常', null);
                } else {
                    log('本次自动过搜索验证失败,cookie:' + cookie);
                }
                // 在沙箱环境中重新获取正确的HTML
                html = await executeSandboxFunction('getHtml', [sandboxString(MY_URL)], moduleObject.context, '重新获取HTML异常', '');
            }
        }

        if (html) {
            if (!html.includes(searchWd)) {
                log(`[commonSearchListParse] 搜索结果源码未包含关键字【${searchWd}】,疑似搜索失败,正为您打印结果源码`);
                log('[commonSearchListParse]', html.slice(0, 200) + '...');
            }
            // 使用通用列表解析函数
            const result = await parseCommonList(html, config, this, moduleObject, injectVars);
            d.push(...result);
        }
        return d
    };
    return await invokeWithInjectVars(moduleObject, tmpFunction, injectVars, args);
}

/**
 * 通用免嗅探解析函数
 * @param moduleObject
 * @param method
 * @param injectVars
 * @param args
 * @returns {Promise<*>}
 */
export async function commonLazyParse(moduleObject, method, injectVars, args) {
    // const tmpLazyFunction = async function () {
    //     let {input} = this;
    //     log('[tmpLazyFunction] input:', input);
    //     return input
    // };
    // const tmpLazyFunction = template.common_lazy;
    const lazyMethod = moduleObject[method];
    // 不再直接引用 moduleObject.request，改为通过 executeSandboxFunction 调用
    const tmpLazyFunction = async function (flag, id, flags) {
        let {input} = this;
        log('[tmpLazyFunction] input:', input);
        let html = await executeSandboxFunction('request', [sandboxString(input), {}], moduleObject.context, '[commonLazyParse] 获取播放页源码失败');
        let hconf = html.match(/r player_.*?=(.*?)</)[1];
        let json = JSON5.parse(hconf);
        let url = json.url;
        if (json.encrypt == '1') {
            url = unescape(url);
        } else if (json.encrypt == '2') {
            url = unescape(base64Decode(url));
        }
        if (/\.(m3u8|mp4|m4a|mp3)/.test(url)) {
            input = {
                parse: 0,
                jx: 0,
                url: url,
            };
        } else {
            input = url && url.startsWith('http') && tellIsJx(url) ? {parse: 0, jx: 1, url: url} : input;
        }
        log('[tmpLazyFunction] result:', input);
        return input;
    }
    if (lazyMethod && typeof lazyMethod === 'function') {
        try {
            return await invokeWithInjectVars(moduleObject, lazyMethod, injectVars, args);
        } catch (e) {
            let playUrl = injectVars.input || '';
            log(`[commonLazyParse] 执行免嗅代码发送了错误: ${e.message},原始链接为:${playUrl}`);
            if (SPECIAL_URL.test(playUrl) || /^(push:)/.test(playUrl) || playUrl.startsWith('http')) {
                return await invokeWithInjectVars(moduleObject, tmpLazyFunction, injectVars, args);
            } else {
                throw e
            }
        }
    } else if (!lazyMethod) {// 新增特性，可以不写lazy属性
        return await invokeWithInjectVars(moduleObject, tmpLazyFunction, injectVars, args);
    }
}

/**
 * 使用临时的上下文调用异步方法，确保每次调用时的上下文 (this) 是独立的。
 * 这样可以避免多个请求之间共享状态，确保数据的隔离性。
 *
 * @param rule 规则本身
 * @param {Function} method - 要调用的异步方法，通常是对象上的方法（例如：moduleObject[method]）
 * @param {Object} injectVars - 用作临时上下文的变量，通常包含一些动态的参数（如：input, MY_URL等）
 * @param {Array} args - 传递给方法的参数列表，会在方法调用时使用
 *
 * @returns {Promise} - 返回异步方法执行的结果，通常是 `await method.apply(...)` 调用的结果
 */
export async function invokeWithInjectVars(rule, method, injectVars, args) {
    // return await moduleObject[method].apply(Object.assign(injectVars, moduleObject), args);
    // 这里不使用 bind 或者直接修改原方法，而是通过 apply 临时注入 injectVars 作为 `this` 上下文
    // 这样每次调用时，方法内部的 `this` 会指向 `injectVars`，避免了共享状态，确保数据的隔离性。
    let thisProxy = new Proxy(injectVars, {
        get(injectVars, key) {
            return injectVars[key] || rule[key]
        },
        set(injectVars, key, value) {
            rule[key] = value;
            injectVars[key] = value;
        }
    });
    let result = {};
    let ret_str = '';
    let error = null;
    try {
        result = await method.apply(thisProxy, args);
    } catch (e) {
        error = e;
    }
    if (!['推荐'].includes(injectVars['method']) && error) {
        throw error
    }
    // let result = await method.apply(injectVars, args);  // 使用 apply 临时注入 injectVars 作为上下文，并执行方法
    switch (injectVars['method']) {
        case '推荐':
            if (error) {
                log('[invokeWithInjectVars] error:', error);
                error = null;
                result = [];
            }
            break;
        case 'class_parse':
            result = await homeParseAfter(result, rule.类型, rule.hikerListCol, rule.hikerClassListCol, rule.mergeList, injectVars);
            break;
        case '一级':
            result = await cateParseAfter(rule, result, args[1]);
            log(`[invokeWithInjectVars] 一级 ${injectVars.input} 执行完毕,结果为:`, JSON.stringify(result.list.slice(0, 2)));
            break;
        case '二级':
            result = await detailParseAfter(result);
            break;
        case '搜索':
            result = await searchParseAfter(rule, result, args[2]);
            log(`[invokeWithInjectVars] 搜索 ${injectVars.input} 执行完毕,结果为:`, JSON.stringify(result.list.slice(0, 2)));
            break;
        case 'lazy':
            result = await playParseAfter(rule, result, args[1], args[0]);
            ret_str = JSON.stringify(result);
            log(`[invokeWithInjectVars] 免嗅 ${injectVars.input} 执行完毕,结果为:`, ret_str.length < 100 ? ret_str : ret_str.slice(0, 100) + '...');
            break;
        case 'proxy_rule':
            break;
        case 'action':
            break;
        default:
            log(`[invokeWithInjectVars] invokeWithInjectVars: ${injectVars['method']}`);
            break;
    }
    if (error) {
        throw error
    }
    return result
}


/**
 * 创建沙箱变量引用标识
 * @param {string} varName - 沙箱内的变量名
 * @returns {Object} 变量引用对象
 */
export function sandboxVar(varName) {
    return {__sandboxVar: true, name: varName};
}

/**
 * 创建强制字符串参数标识
 * @param {string} value - 字符串值
 * @returns {Object} 字符串参数对象
 */
export function sandboxString(value) {
    return {__sandboxString: true, value: value};
}

/**
 * 通用沙箱执行函数
 * @param {string} functionName - 要执行的函数名称（如 'getHtml', 'verifyCode', 'cachedRequest'）
 * @param {Array} args - 函数参数数组，支持以下类型：
 *   - 普通值：直接传递
 *   - sandboxVar('varName')：引用沙箱内变量
 *   - sandboxString('value')：强制作为字符串参数
 *   - 字符串：智能判断（变量名格式且不含特殊字符时作为变量，否则作为字符串）
 * @param {Object} context - 沙箱执行上下文
 * @param {string} errorMessage - 错误日志前缀
 * @param {*} defaultReturn - 出错时的默认返回值
 * @returns {Promise<*>} 执行结果
 */
async function executeSandboxFunction(functionName, args, context, errorMessage = '沙箱执行异常', defaultReturn = '') {
    try {
        // 确保HOST变量在沙箱环境中可用
        // 尝试从多个来源获取host信息
        let hostValue = null;
        if (context.rule && context.rule.host) {
            hostValue = context.rule.host;
        } else if (context.HOST) {
            hostValue = context.HOST;
        } else if (global.HOST) {
            hostValue = global.HOST;
        } else if (globalThis.HOST) {
            hostValue = globalThis.HOST;
        }

        if (hostValue && typeof context.HOST === 'undefined') {
            const hostScript = new vm.Script(`globalThis.HOST = '${hostValue}'; globalThis.host = '${hostValue}';`);
            hostScript.runInContext(context);
        }

        // 构建参数字符串
        const argsStr = args.map(arg => {
            // 处理特殊标识对象
            if (arg && typeof arg === 'object') {
                if (arg.__sandboxVar) {
                    // 明确指定的沙箱变量引用
                    return arg.name;
                } else if (arg.__sandboxString) {
                    // 明确指定的字符串参数
                    return `'${arg.value.replace(/'/g, "\'")}'`;
                } else {
                    // 普通对象，JSON序列化
                    return JSON.stringify(arg);
                }
            } else if (typeof arg === 'function') {
                // 函数类型：直接使用函数名（假设在沙箱上下文中可用）
                return arg.name || 'request'; // 默认为request函数
            } else if (typeof arg === 'string') {
                // 智能判断字符串：变量名格式且不含特殊字符时作为变量，否则作为字符串
                if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(arg) && !arg.includes('http')) {
                    return arg; // 变量名直接使用
                } else {
                    return `'${arg.replace(/'/g, "\\'")}'`; // 字符串加引号
                }

            } else {
                return String(arg);
            }
        }).join(', ');

        // 构建沙箱执行脚本
        const script = new vm.Script(`
            (async function() {
                try {
                    return await ${functionName}(${argsStr});
                } catch (e) {
                    log('${errorMessage}:', e.message);
                    return ${JSON.stringify(defaultReturn)};
                }
            })()
        `);

        return await script.runInContext(context);
    } catch (e) {
        log(`[executeSandboxFunction] ${errorMessage}:`, e.message);
        return defaultReturn;
    }
}

/**
 * 在沙箱环境中执行js:开头的字符串代码
 * @param {object} moduleObject - 模块对象
 * @param {string} method - 方法名
 * @param {object} injectVars - 注入变量，作为this上下文
 * @param {array} args - 参数数组
 * @returns {Promise<any>} - 执行结果
 */
export async function executeJsCodeInSandbox(moduleObject, method, injectVars = {}, args = []) {
    let contextWithVars = null;
    let functionCode = null;

    try {
        // 获取js:后面的代码
        const jsCode = moduleObject[method].substring(3); // 去掉'js:'前缀

        // 获取原始沙箱上下文
        const originalContext = moduleObject.context;
        if (!originalContext) {
            throw new Error('Sandbox context not found in moduleObject');
        }

        // 构建函数代码，将用户代码包装在函数中
        functionCode = `
            (async function() {
                ${jsCode}
            })()
        `;

        // 创建一个新的上下文，包含原始上下文和注入的变量
        contextWithVars = vm.createContext({
            ...originalContext,
            ...injectVars
        });

        // 在新上下文中执行函数代码
        const result = await vm.runInContext(functionCode, contextWithVars);

        // 深拷贝结果以避免引用原上下文中的对象
        return deepCopy(result);
    } catch (error) {
        log(`[executeJsCodeInSandbox] Error executing js: code for method ${method}:`, error);
        throw new Error(`Failed to execute js: code: ${error.message}`);
    } finally {
        // 内存清理：销毁临时变量和上下文
        if (contextWithVars) {
            // 清空上下文中的所有属性
            for (const key in contextWithVars) {
                try {
                    delete contextWithVars[key];
                } catch (e) {
                    // 忽略无法删除的属性
                }
            }
            contextWithVars = null;
        }

        // 清空函数代码字符串
        functionCode = null;

        // 建议垃圾回收（仅建议，实际执行由V8决定）
        if (global.gc) {
            global.gc();
        }
    }
}