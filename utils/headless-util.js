/**
 * Puppeteer无头浏览器工具类
 * 
 * 功能描述：
 * 这是一个基于Puppeteer的无头浏览器操作工具类，提供了网页自动化操作的封装。
 * 支持页面访问、内容获取、元素操作、Cookie管理、PDF生成等功能。
 * 
 * 主要功能：
 * 1. 页面访问 - 支持普通页面访问和API请求
 * 2. 内容获取 - 获取页面HTML内容、标题、URL等
 * 3. 元素操作 - 点击、输入、获取文本和属性
 * 4. Cookie管理 - 获取页面Cookie信息
 * 5. 等待机制 - 等待元素出现
 * 6. PDF生成 - 将页面保存为PDF
 * 7. 自定义脚本 - 在页面上下文中执行JavaScript
 * 8. 代理支持 - 支持HTTP代理配置
 * 
 * 使用场景：
 * - 网页数据抓取
 * - 自动化测试
 * - 页面截图和PDF生成
 * - 模拟用户操作
 * - 绕过反爬虫机制
 * 
 * 环境变量：
 * - CHROME_PATH: Chrome浏览器可执行文件路径
 * 
 * @author drpy-node
 * @version 1.0.0
 */

import {log} from './log.js';
import * as puppeteer from 'puppeteer'

/**
 * Puppeteer助手类
 * 封装了Puppeteer的常用操作，提供简化的API接口
 */
class PuppeteerHelper {
    /**
     * 构造函数
     * 初始化浏览器和页面实例为null
     */
    constructor() {
        this.browser = null;  // 浏览器实例
        this.page = null;     // 页面实例
    }

    /**
     * 关闭并释放当前浏览器实例（L4 泄露治理）
     * 历史上 gotoHtml/gotoCookie 每次 launch 都直接覆盖 this.browser，
     * 旧 Chromium 进程既不 close 也无引用，形成孤儿进程累积；
     * 现统一在新 launch 前调用本方法释放旧实例。
     * @returns {Promise<void>}
     */
    async closeBrowser() {
        const stale = this.browser;
        this.browser = null;
        this.page = null;
        if (stale) {
            try {
                await stale.close();
            } catch {
                // 浏览器已退出/崩溃时忽略，保证清理路径不抛错
            }
        }
    }

    /**
     * 访问网页或发送HTTP请求
     * 支持普通页面访问和API请求两种模式
     *
     * @param {Object} config - 配置对象
     * @param {string} config.url - 目标URL
     * @param {boolean} [config.headless=true] - 是否无头模式
     * @param {boolean} [config.proxy=false] - 是否使用代理
     * @param {Object} [config.headers] - 请求头
     * @param {boolean} [config.isJSON=false] - 是否为JSON请求
     * @param {boolean} [config.isReq=false] - 是否为API请求
     * @param {string} [config.method='GET'] - HTTP方法
     * @param {Object} [config.data] - 请求数据
     * @param {Object} [config.options] - 页面访问选项
     * @returns {Promise<string>} 页面内容或响应文本
     *
     * @example
     * // 访问普通页面
     * const html = await helper.gotoHtml({url: 'https://example.com'});
     *
     * // 发送API请求
     * const data = await helper.gotoHtml({
     *   url: 'https://api.example.com/data',
     *   isJSON: true,
     *   method: 'POST',
     *   data: {key: 'value'}
     * });
     */
    async gotoHtml(config) {
        let proxy = ''
        // 如果配置了代理，使用本地代理服务器
        if(config.proxy){
            proxy = 'http://127.0.0.1:7897';
        }
        
        // 释放上一次调用遗留的浏览器实例，再启动新实例（L4：杜绝孤儿 Chromium 累积）
        await this.closeBrowser();

        // 启动浏览器实例
        this.browser = await puppeteer.launch({
            headless: config.headless || true,                    // 无头模式，默认true
            // executablePath: process.env.CHROME_PATH,           // Chrome路径（可选）
            args: [`--proxy-server=${proxy}`]                     // 代理服务器配置
        });
        
        // 创建新页面
        this.page = await this.browser.newPage();
        
        // 设置请求头
        await this.page.setExtraHTTPHeaders(config.headers || {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36',
        })
        
        let content = ''
        
        // 判断是否为API请求模式
        if (config.isJSON || config.isReq) {
            // 在页面上下文中执行fetch请求
            return await this.page.evaluate(async (url, mth, headers, data) => {
                // 构建请求选项
                const requestOptions = {
                    method: mth || 'GET',
                    headers: headers || {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36',
                        'Content-Type': 'application/json'
                    },
                };
                
                // 如果不是GET请求且有数据，添加请求体
                if (mth !== 'GET' && (data !== '' && data !== undefined)) {
                    requestOptions.body = JSON.stringify(data);
                }
                
                // 发送请求
                const response = await fetch(url, requestOptions);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.text();
            }, config.url, config.method, config.headers, config.data);
        } else {
            // 普通页面访问模式
            await this.page.goto(config.url, config.options);
            content = await this.page.content()
            return content
        }
    }

    /**
     * 获取页面Cookie信息
     * 访问指定URL并获取该页面的所有Cookie
     * 
     * @param {Object} config - 配置对象
     * @param {string} config.url - 目标URL
     * @param {boolean} [config.headless=true] - 是否无头模式
     * @param {Object} [config.options] - 页面访问选项
     * @returns {Promise<Array>} Cookie数组
     * 
     * @example
     * const cookies = await helper.gotoCookie({url: 'https://example.com'});
     */
    async gotoCookie(config) {
        // 释放上一次调用遗留的浏览器实例（L4），再启动新实例
        await this.closeBrowser();

        // 启动浏览器（使用环境变量中的Chrome路径）
        this.browser = await puppeteer.launch({
            headless: config.headless || true,
            executablePath: process.env.CHROME_PATH
        });
        
        this.page = await this.browser.newPage();
        await this.page.goto(config.url, config.options || {});
        
        // 获取当前页面的cookies
        const cookies = await this.page.cookies();
        // 打印cookies（调试用，已注释）
        // log('Cookies:', cookies);
        return cookies || []
    }

    /**
     * 在指定元素中输入文本
     * 
     * @param {string} selector - CSS选择器
     * @param {string} text - 要输入的文本
     * @param {Object} [options={}] - 输入选项（如延迟等）
     * @returns {Promise<void>}
     * 
     * @example
     * await helper.type('#username', 'myuser', {delay: 100});
     */
    async type(selector, text, options = {}) {
        return await this.page.type(selector, text, ...options);//{ delay: 100 }
    }

    /**
     * 点击指定元素
     * 
     * @param {string} selector - CSS选择器
     * @returns {Promise<void>}
     * 
     * @example
     * await helper.gotoclick('#submit-button');
     */
    async gotoclick(selector) {
        return await this.page.click(selector);
    }

    /**
     * 生成PDF文件
     * 将当前页面保存为PDF格式
     * 
     * @param {string} path - PDF文件保存路径
     * @param {Object} [options={}] - PDF生成选项
     * @returns {Promise<void>}
     * 
     * @example
     * await helper.pdf('./output.pdf', {format: 'A4'});
     */
    async pdf(path, options = {}) {
        return await this.page.pdf({path, ...options});
    }

    /**
     * 获取页面标题
     * 
     * @returns {Promise<string>} 页面标题
     * 
     * @example
     * const title = await helper.getTitle();
     */
    async getTitle() {
        return await this.page.title();
    }

    /**
     * 获取当前页面URL
     * 
     * @returns {Promise<string>} 当前页面URL
     * 
     * @example
     * const url = await helper.getUrl();
     */
    async getUrl() {
        return await this.page.url();
    }

    /**
     * 在页面上下文中执行自定义JavaScript函数
     * 将函数序列化后在浏览器环境中执行
     * 
     * @param {Function} fn - 要执行的函数
     * @param {...any} args - 函数参数
     * @returns {Promise<any>} 函数执行结果
     * 
     * @example
     * const result = await helper.evaluate(() => {
     *   return document.title;
     * });
     */
    async evaluate(fn, ...args) {
        const funcString = fn.toString();// 将函数转换为字符串
        // 构造一个在页面上下文中调用的函数，该函数调用传入的自定义函数
        const pageFunction = new Function(`return (${funcString})`).apply(null, args.map(arg => JSON.stringify(arg)));
        return await this.page.evaluate(pageFunction);
    }

    /**
     * 获取页面元素的文本内容
     * 
     * @param {string} selector - CSS选择器
     * @returns {Promise<string|null>} 元素文本内容，如果元素不存在返回null
     * 
     * @example
     * const text = await helper.gotoText('.title');
     */
    async gotoText(selector) {
        return await this.page.evaluate((selector) => {
            const element = document.querySelector(selector);
            return element ? element.textContent : null;
        }, selector);
    }

    /**
     * 获取页面元素的属性值
     * 
     * @param {string} selector - CSS选择器
     * @param {string} attribute - 属性名
     * @returns {Promise<string|null>} 属性值，如果元素不存在或属性不存在返回null
     * 
     * @example
     * const href = await helper.gotoAttribute('a.link', 'href');
     */
    async gotoAttribute(selector, attribute) {
        return await this.page.evaluate((selector, attribute) => {
            const element = document.querySelector(selector);
            return element ? element.getAttribute(attribute) : null;
        }, selector, attribute);
    }

    /**
     * 等待指定选择器的元素出现
     * 提供超时机制和回调处理
     * 
     * @param {string} selector - CSS选择器
     * @param {Object} [options={}] - 等待选项
     * @param {number} [options.timeout=30000] - 超时时间（毫秒），默认30秒
     * @param {Function} [options.onFound] - 元素找到后的回调函数
     * @returns {Promise<ElementHandle>} 元素句柄
     * @throws {Error} 如果超时或元素未找到
     * 
     * @example
     * const element = await helper.waitForSelector('.dynamic-content', {
     *   timeout: 10000,
     *   onFound: (el) => log('Element found!')
     * });
     */
    async waitForSelector(selector, options = {}) {
        const {timeout = 30000, onFound} = options; // 默认超时为30秒
        try {
            // 使用 Page 的 waitForSelector 方法，并设置超时
            const elementHandle = await this.page.waitForSelector(selector, {timeout});
            
            // 如果提供了 onFound 回调，则调用它并传入元素句柄
            if (onFound) {
                await onFound(elementHandle);
            }
            
            // 返回元素句柄（如果需要的话，调用者可以进一步处理它）
            return elementHandle;
        } catch (error) {
            // 如果超时或选择器未找到，则抛出错误
            throw new Error(`Element with selector "${selector}" not found within ${timeout / 1000} seconds.`);
        }
    }

    /**
     * 关闭浏览器和页面
     * 清理资源，释放内存
     * 
     * @returns {Promise<void>}
     * 
     * @example
     * await helper.close();
     */
    async close() {
        // 关闭页面
        if (this.page) {
            await this.page.close();
        }
        
        // 关闭浏览器
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// 导出PuppeteerHelper类
export const puppeteerHelper = PuppeteerHelper
