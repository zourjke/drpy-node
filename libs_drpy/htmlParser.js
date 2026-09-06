/**
 * HTML解析器工具
 * 基于cheerio提供HTML和JSON解析功能，支持类似海阔视界的解析语法
 */

import {log} from '../utils/log.js';
import * as cheerio from 'cheerio';
// import jsonpath from 'jsonpath';
import {urljoin} from "../utils/utils.js";
import '../libs_drpy/jsonpathplus.min.js'

/**
 * JSONPath查询工具
 */
export const jsonpath = {
    query(jsonObject, path) {
        return JSONPath.JSONPath({path: path, json: jsonObject})
    }
};

// 解析缓存开关
const PARSE_CACHE = true; // 解析缓存
// 不自动加eq下标索引的选择器
const NOADD_INDEX = ':eq|:lt|:gt|:first|:last|:not|:even|:odd|:has|:contains|:matches|:empty|^body$|^#'; // 不自动加eq下标索引
// 需要自动urljoin的属性
const URLJOIN_ATTR = '(url|src|href|-original|-src|-play|-url|style)$|^(data-|url-|src-)'; // 需要自动urljoin的属性
// 过滤特殊链接,不走urlJoin
const SPECIAL_URL = '^(ftp|magnet|thunder|ws):'; // 过滤特殊链接,不走urlJoin

/**
 * HTML解析器类
 * 提供类似海阔视界的HTML解析语法
 */
class Jsoup {
    /**
     * 构造函数
     * @param {string} MY_URL 基础URL
     */
    constructor(MY_URL = '') {
        this.MY_URL = MY_URL;
        // 独立缓存：pdfa 与 pdfh 各自缓存，避免互相覆盖导致缓存失效
        this.pdfa_html = '';
        this.pdfa_doc = null;
        this.pdfh_html = '';
        this.pdfh_doc = null;
    }

    /**
     * 正则测试
     * @param {string} text 正则表达式
     * @param {string} string 测试字符串
     * @returns {boolean} 是否匹配
     */
    test(text, string) {
        const searchObj = new RegExp(text, 'mi').exec(string);
        return searchObj ? true : false;
    }

    /**
     * 检查字符串是否包含指定内容
     * @param {string} text 源字符串
     * @param {string} match 匹配内容
     * @returns {boolean} 是否包含
     */
    contains(text, match) {
        return text.indexOf(match) !== -1;
    }

    /**
     * 将海阔视界解析语法转换为jQuery选择器
     * @param {string} parse 解析规则
     * @param {boolean} first 是否只取第一个
     * @returns {string} 转换后的选择器
     */
    parseHikerToJq(parse, first = false) {
        if (this.contains(parse, '&&')) {
            const parses = parse.split('&&');
            const new_parses = [];
            for (let i = 0; i < parses.length; i++) {
                const ps_list = parses[i].split(' ');
                const ps = ps_list[ps_list.length - 1];
                if (!this.test(NOADD_INDEX, ps)) {
                    if (!first && i >= parses.length - 1) {
                        new_parses.push(parses[i]);
                    } else {
                        new_parses.push(`${parses[i]}:eq(0)`);
                    }
                } else {
                    new_parses.push(parses[i]);
                }
            }
            parse = new_parses.join(' ');
        } else {
            const ps_list = parse.split(' ');
            const ps = ps_list[ps_list.length - 1];
            if (!this.test(NOADD_INDEX, ps) && first) {
                parse = `${parse}:eq(0)`;
            }
        }
        return parse;
    }

    /**
     * 获取解析信息
     * @param {string} nparse 解析规则
     * @returns {Object} 解析信息对象
     */
    getParseInfo(nparse) {
        let excludes = [];
        let nparse_index = 0;
        let nparse_rule = nparse;

        if (this.contains(nparse, ':eq')) {
            nparse_rule = nparse.split(':eq')[0];
            let nparse_pos = nparse.split(':eq')[1];
            if (this.contains(nparse_rule, '--')) {
                excludes = nparse_rule.split('--').slice(1);
                nparse_rule = nparse_rule.split('--')[0];
            } else if (this.contains(nparse_pos, '--')) {
                excludes = nparse_pos.split('--').slice(1);
                nparse_pos = nparse_pos.split('--')[0];
            }
            try {
                nparse_index = parseInt(nparse_pos.split('(')[1].split(')')[0]);
            } catch {
            }
        } else if (this.contains(nparse, '--')) {
            nparse_rule = nparse.split('--')[0];
            excludes = nparse.split('--').slice(1);
        }

        return {nparse_rule, nparse_index, excludes};
    }

    /**
     * 重新排序相邻的:gt和:lt选择器
     * @param {string} selector 选择器
     * @returns {string} 重排后的选择器
     */
    reorderAdjacentLtAndGt(selector) {
        const adjacentPattern = /:gt\((\d+)\):lt\((\d+)\)/;
        let match;
        while ((match = adjacentPattern.exec(selector)) !== null) {
            const replacement = `:lt(${match[2]}):gt(${match[1]})`;
            selector = selector.substring(0, match.index) + replacement + selector.substring(match.index + match[0].length);
            adjacentPattern.lastIndex = match.index;
        }
        return selector;
    }

    /**
     * 解析单个规则
     * @param {Object} doc cheerio文档对象
     * @param {string} nparse 解析规则
     * @param {Object} ret 上一步结果
     * @returns {Object} 解析结果
     */
    parseOneRule(doc, nparse, ret) {
        let {nparse_rule, nparse_index, excludes} = this.getParseInfo(nparse);
        nparse_rule = this.reorderAdjacentLtAndGt(nparse_rule);
        if (!ret) ret = doc(nparse_rule);
        else ret = ret.find(nparse_rule);

        if (this.contains(nparse, ':eq')) ret = ret.eq(nparse_index);

        if (excludes.length > 0 && ret) {
            ret = ret.clone();
            for (let exclude of excludes) {
                ret.find(exclude).remove();
            }
        }

        return ret;
    }

    /**
     * 解析文本内容
     * @param {string} text 原始文本
     * @returns {string} 处理后的文本
     */
    parseText(text) {
        text = text.replace(/[\s]+/gm, '\n');
        text = text.replace(/\n+/g, '\n').replace(/^\s+/, '');
        text = text.replace(/\n/g, ' ');
        return text;
    }

    /**
     * 解析HTML获取数组结果
     * @param {string} html HTML内容
     * @param {string} parse 解析规则
     * @returns {Array} 解析结果数组
     */
    pdfa(html, parse) {
        if (!html || !parse) return [];
        parse = this.parseHikerToJq(parse);

        if (PARSE_CACHE) {
            if (this.pdfa_html !== html) {
                this.pdfa_html = html;
                this.pdfa_doc = cheerio.load(html);
            }
        } else {
            this.pdfa_doc = cheerio.load(html);
        }
        const doc = this.pdfa_doc;

        const parses = parse.split(' ');
        let ret = null;
        for (const nparse of parses) {
            ret = this.parseOneRule(doc, nparse, ret);
            if (!ret) return [];
        }

        const res = (ret?.toArray() ?? []).map((item) => `${doc(item)}`);
        return res;
    }

    /**
     * 解析HTML获取列表数据
     * @param {string} html HTML内容
     * @param {string} parse 解析规则
     * @param {string} list_text 标题解析规则
     * @param {string} list_url 链接解析规则
     * @param {string} MY_URL 基础URL
     * @returns {Array} 列表数据
     */
    pdfl(html, parse, list_text, list_url, MY_URL) {
        if (!html || !parse) return [];
        parse = this.parseHikerToJq(parse, false);

        const doc = cheerio.load(html);
        const parses = parse.split(' ');
        let ret = null;
        for (const pars of parses) {
            ret = this.parseOneRule(doc, pars, ret);
            if (!ret) return [];
        }

        // 尝试批量模式：全程只 cheerio.load 一次，避免每个列表项重复解析
        const batchResult = this._pdflBatch(doc, ret, list_text, list_url, MY_URL);
        if (batchResult !== null) return batchResult;

        // 回退：原始逐元素模式（复杂选择器场景，行为与原版一致）
        const new_vod_list = [];
        ret.each((_, element) => {
            const _html = `${doc(element)}`;
            let _title = this.pdfh(_html, list_text);
            let _url = this.pd(_html, list_url, MY_URL);
            new_vod_list.push(`${_title}$${_url}`);
        });

        return new_vod_list;
    }

    /**
     * pdfl 批量模式核心逻辑
     * 策略：用 data-pdfl-batch 属性标记每个列表项索引 -> 全局 doc(sel) 查找
     * -> closest('[data-pdfl-batch]') 定位所属列表项 -> 读属性值得索引
     * 返回 null 表示选择器不可批量，需回退到逐元素模式
     * @param {Object} doc cheerio文档对象
     * @param {Object} ret 列表项集合
     * @param {string} list_text 标题解析规则
     * @param {string} list_url 链接解析规则
     * @param {string} MY_URL 基础URL
     * @returns {Array|null} 列表数据，null 表示不可批量
     */
    _pdflBatch(doc, ret, list_text, list_url, MY_URL) {
        if (!MY_URL) MY_URL = this.MY_URL; // 与 pd 回退行为一致，确保 url 正确拼接 baseUrl
        const ti = this._parseSubOpt(list_text);
        const ui = this._parseSubOpt(list_url);
        if ((!ti.canBatch && !ti.special) || (!ui.canBatch && !ui.special)) return null;

        const TAG = 'data-pdfl-batch';
        const TAG_SEL = '[' + TAG + ']';
        const self = this;

        // 1. 标记每个列表项的索引
        ret.each((i, el) => {
            doc(el).attr(TAG, '' + i);
        });

        // 2. 全局查找子元素 -> closest() 定位所属列表项 -> 按索引分组
        function buildMap(batchSel) {
            const map = {};
            doc(batchSel).each((_, el) => {
                const ancestor = doc(el).closest(TAG_SEL);
                const idx = ancestor.attr(TAG);
                if (idx !== undefined && idx !== null && idx !== '' && !(idx in map)) {
                    map[idx] = el;
                }
            });
            return map;
        }

        const textMap = ti.special ? null : buildMap(ti.batchSel);
        const urlMap = ui.special ? null : buildMap(ui.batchSel);

        // 3. 按列表项顺序构建结果
        const results = [];
        ret.each((i, el) => {
            let t, u;
            if (ti.special === 'Text') t = self.parseText(doc(el).text());
            else if (ti.special === 'Html') t = doc(el).html() || '';
            else { const tn = textMap[i]; t = tn ? self._applyOption(doc(tn), ti.opt, '') : ''; }
            if (ui.special === 'Text') u = self.parseText(doc(el).text());
            else if (ui.special === 'Html') u = doc(el).html() || '';
            else { const un = urlMap[i]; u = un ? self._applyOption(doc(un), ui.opt, MY_URL) : ''; }
            results.push(`${t}$${u}`);
        });

        // 4. 清理标记
        ret.removeAttr(TAG);
        return results;
    }

    /**
     * 解析子选择器+选项，strip :eq(0)/:first 用于全局查找
     * @param {string} s 子选择器规则
     * @returns {Object} { opt, batchSel, canBatch } 或 { special } 或 { canBatch: false }
     */
    _parseSubOpt(s) {
        if (s === 'Text' || s === 'body&&Text') return { special: 'Text' };
        if (s === 'Html' || s === 'body&&Html') return { special: 'Html' };
        let option;
        if (this.contains(s, '&&')) {
            const parts = s.split('&&');
            option = parts.pop();
            s = parts.join('&&');
        }
        s = this.parseHikerToJq(s, true);
        const batchSel = s.replace(/:eq\(0\)/g, '').replace(/:first/g, '').trim();
        if (!batchSel) return { canBatch: false };
        const canBatch = !batchSel.match(/:eq\(|:lt|:gt|:last|:not|:even|:odd|:has|:contains|:matches|:empty|--/);
        return { opt: option, batchSel, canBatch };
    }

    /**
     * 选项处理逻辑（Text/Html/属性提取+URL拼接）
     * 从 pdfh 中抽出，供 pdfh 和 _pdflBatch 共用
     * @param {Object} ret cheerio结果对象
     * @param {string} option 选项（Text/Html/属性名等）
     * @param {string} baseUrl 基础URL
     * @returns {string} 解析结果
     */
    _applyOption(ret, option, baseUrl) {
        if (!option) return `${ret}`;
        switch (option) {
            case 'Text':
                return ret ? this.parseText(ret.text()) : '';
            case 'Html':
                return ret ? ret.html() : '';
            default:
                const originalRet = ret.clone();
                const options = option.split('||');
                for (let opt of options) {
                    let val = originalRet?.attr(opt) || '';
                    // 处理style中的url
                    if (this.contains(opt.toLowerCase(), 'style') && this.contains(val, 'url(')) {
                        try {
                            val = val.match(/url\((.*?)\)/)[1];
                            val = val.replace(/^['"]|['"]$/g, '');
                        } catch {
                        }
                    }
                    // 自动拼接URL
                    if (val && baseUrl) {
                        const needAdd = this.test(URLJOIN_ATTR, opt) && !this.test(SPECIAL_URL, val);
                        if (needAdd) {
                            val = val.includes('http') ? val.slice(val.indexOf('http')) : urljoin(baseUrl, val);
                        }
                    }
                    if (val) return val;
                }
                return '';
        }
    }

    /**
     * 解析HTML获取单个值
     * @param {string} html HTML内容
     * @param {string} parse 解析规则
     * @param {string} baseUrl 基础URL
     * @returns {string} 解析结果
     */
    pdfh(html, parse, baseUrl = '') {
        if (!html || !parse) return '';

        if (PARSE_CACHE) {
            if (this.pdfh_html !== html) {
                this.pdfh_html = html;
                this.pdfh_doc = cheerio.load(html);
            }
        } else {
            this.pdfh_doc = cheerio.load(html);
        }
        const doc = this.pdfh_doc;

        // 处理特殊解析规则
        if (parse === 'body&&Text' || parse === 'Text') {
            return this.parseText(doc.text());
        } else if (parse === 'body&&Html' || parse === 'Html') {
            return doc.html();
        }

        let option;
        if (this.contains(parse, '&&')) {
            const parts = parse.split('&&');
            option = parts.pop();
            parse = parts.join('&&');
        }

        parse = this.parseHikerToJq(parse, true);
        const parses = parse.split(' ');

        let ret = null;
        for (const nparse of parses) {
            ret = this.parseOneRule(doc, nparse, ret);
            if (!ret) return '';
        }

        return this._applyOption(ret, option, baseUrl);
    }

    /**
     * 解析HTML并自动拼接URL
     * @param {string} html HTML内容
     * @param {string} parse 解析规则
     * @param {string} baseUrl 基础URL
     * @returns {string} 解析结果
     */
    pd(html, parse, baseUrl = '') {
        if (!baseUrl) baseUrl = this.MY_URL;
        return this.pdfh(html, parse, baseUrl);
    }

    /**
     * 获取cheerio对象
     * @param {string} html HTML内容
     * @returns {Object} cheerio对象
     */
    pq(html) {
        return cheerio.load(html);
    }

    /**
     * 解析JSON获取单个值
     * @param {string|Object} html JSON字符串或对象
     * @param {string} parse JSONPath解析规则
     * @param {boolean} addUrl 是否自动拼接URL
     * @returns {string} 解析结果
     */
    pjfh(html, parse, addUrl = false) {
        if (!html || !parse) return '';

        try {
            html = typeof html === 'string' ? JSON.parse(html) : html;
        } catch {
            log('字符串转 JSON 失败');
            return '';
        }

        if (!parse.startsWith('$.')) parse = '$.' + parse;

        let ret = '';
        const paths = parse.split('||');
        for (const path of paths) {
            const queryResult = jsonpath.query(html, path);
            ret = Array.isArray(queryResult) ? queryResult[0] || '' : queryResult || '';
            if (addUrl && ret) ret = urljoin(this.MY_URL, ret);
            if (ret) break;
        }

        return ret;
    }

    /**
     * 解析JSON并自动拼接URL
     * @param {string|Object} html JSON字符串或对象
     * @param {string} parse JSONPath解析规则
     * @returns {string} 解析结果
     */
    pj(html, parse) {
        return this.pjfh(html, parse, true);
    }

    /**
     * 解析JSON获取数组结果
     * @param {string|Object} html JSON字符串或对象
     * @param {string} parse JSONPath解析规则
     * @returns {Array} 解析结果数组
     */
    pjfa(html, parse) {
        if (!html || !parse) return [];

        try {
            html = typeof html === 'string' ? JSON.parse(html) : html;
        } catch {
            return [];
        }

        if (!parse.startsWith('$.')) parse = '$.' + parse;

        const result = jsonpath.query(html, parse);
        if (Array.isArray(result) && Array.isArray(result[0]) && result.length === 1) {
            return result[0];
        }

        return result || [];
    }
}

// 导出jsoup实例
export const jsoup = Jsoup;
// export default Jsoup;
