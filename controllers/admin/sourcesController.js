/**
 * 源管理控制器
 * 提供源列表、验证、语法检查、模板获取等功能
 */

import fs from '../../utils/fsWrapper.js';
import path from 'path';
import vm from 'vm';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

// 列出所有源
export async function listSources(req, reply) {
    try {
        const jsPath = path.join(process.cwd(), 'spider/js');
        const catvodPath = path.join(process.cwd(), 'spider/catvod');
        const phpPath = path.join(process.cwd(), 'spider/php');
        const pyPath = path.join(process.cwd(), 'spider/py');

        let jsSources = [];
        let catvodSources = [];
        let phpSources = [];
        let pySources = [];

        if (await fs.pathExists(jsPath)) {
            jsSources = (await fs.readdir(jsPath))
                .filter(f => f.endsWith('.js') && !f.startsWith('_'))
                .sort();
        }

        if (await fs.pathExists(catvodPath)) {
            catvodSources = (await fs.readdir(catvodPath))
                .filter(f => f.endsWith('.js') && !f.startsWith('_'))
                .sort();
        }

        if (await fs.pathExists(phpPath)) {
            phpSources = (await fs.readdir(phpPath))
                .filter(f => f.endsWith('.php') && !f.startsWith('_'))
                .sort();
        }

        if (await fs.pathExists(pyPath)) {
            pySources = (await fs.readdir(pyPath))
                .filter(f => f.endsWith('.py') && !f.startsWith('_'))
                .sort();
        }

        return reply.send({
            js: jsSources,
            catvod: catvodSources,
            php: phpSources,
            py: pySources
        });
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 验证源文件
export async function validateSpider(req, reply) {
    try {
        const { path: filePath } = req.body;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(400).send({
                isValid: false,
                error: '无效的文件路径'
            });
        }

        const fullPath = path.join(process.cwd(), filePath);
        if (!await fs.pathExists(fullPath)) {
            return reply.code(404).send({
                isValid: false,
                error: '文件不存在'
            });
        }

        let code = await fs.readFile(fullPath, 'utf-8');

        // PHP 文件验证
        if (filePath.endsWith('.php')) {
            try {
                await execFileAsync('php', ['-l', fullPath]);
                return reply.send({
                    isValid: true,
                    message: 'PHP 语法检查通过 (结构验证暂不支持)'
                });
            } catch (e) {
                return reply.send({
                    isValid: false,
                    error: `PHP 语法错误: ${e.message}`
                });
            }
        }

        // Python 文件验证
        if (filePath.endsWith('.py')) {
            try {
                await execFileAsync('python', ['-m', 'py_compile', fullPath]);
                return reply.send({
                    isValid: true,
                    message: 'Python 语法检查通过 (结构验证暂不支持)'
                });
            } catch (e) {
                return reply.send({
                    isValid: false,
                    error: `Python 语法错误: ${e.message}`
                });
            }
        }

        // 如果是 JS 文件，尝试解码
        if (filePath.endsWith('.js')) {
            try {
                const { decodeDsSource } = await import('../../utils/dsHelper.js');
                code = await decodeDsSource(code);
            } catch (e) {
                // 解码失败，使用原始代码
            }
        }

        // 创建沙箱执行
        const sandbox = {
            console: { log: () => {} },
            require: () => {},
            rule: null
        };

        try {
            vm.createContext(sandbox);
            new vm.Script(code).runInContext(sandbox);

            if (!sandbox.rule) {
                return reply.send({
                    isValid: false,
                    error: '源文件中缺少 rule 对象'
                });
            }

            // 基本验证
            const required = ['title', 'host', 'url'];
            const missing = required.filter(k => !sandbox.rule[k]);

            if (missing.length > 0) {
                return reply.send({
                    isValid: false,
                    error: `rule 对象缺少必填字段: ${missing.join(', ')}`
                });
            }

            return reply.send({
                isValid: true,
                message: '验证通过'
            });
        } catch (e) {
            return reply.send({
                isValid: false,
                error: `执行错误: ${e.message}`
            });
        }
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 检查语法
export async function checkSyntax(req, reply) {
    try {
        const { path: filePath } = req.body;

        if (!filePath || !isSafePath(filePath)) {
            return reply.code(400).send({
                isValid: false,
                error: '无效的文件路径'
            });
        }

        const fullPath = path.join(process.cwd(), filePath);
        
        // PHP 语法检查
        if (filePath.endsWith('.php')) {
            try {
                await execFileAsync('php', ['-l', fullPath]);
                return reply.send({
                    isValid: true,
                    message: 'PHP 语法检查通过'
                });
            } catch (e) {
                return reply.code(400).send({
                    isValid: false,
                    error: `PHP 语法错误: ${e.message}`
                });
            }
        }

        // Python 语法检查
        if (filePath.endsWith('.py')) {
            try {
                await execAsync(`python -m py_compile "${fullPath}"`);
                return reply.send({
                    isValid: true,
                    message: 'Python 语法检查通过'
                });
            } catch (e) {
                return reply.code(400).send({
                    isValid: false,
                    error: `Python 语法错误: ${e.message}`
                });
            }
        }

        let code = await fs.readFile(fullPath, 'utf-8');

        // 如果是 JS 文件，尝试解码
        if (filePath.endsWith('.js')) {
            try {
                const { decodeDsSource } = await import('../../utils/dsHelper.js');
                code = await decodeDsSource(code);
            } catch (e) {
                // 解码失败，使用原始代码
            }
        }

        try {
            new vm.Script(code);
            return reply.send({
                isValid: true,
                message: '语法检查通过'
            });
        } catch (e) {
            return reply.code(400).send({
                isValid: false,
                error: `语法错误: ${e.message}`
            });
        }
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 获取模板
export async function getTemplate(req, reply) {
    const template = `/*
* @File     : drpy-node spider template
* @Author   : user
* @Date     : ${new Date().toISOString().split('T')[0]}
* @Comments :
*/

var rule = {
    // 影视|漫画|小说
    类型: '影视',
    // 源标题
    title: 'Site Name',
    // 源主域名
    host: 'https://example.com',
    // 源主页链接
    homeUrl: '/latest/',
    // 源一级列表链接
    url: '/category/fyclass/page/fypage',
    // 源搜索链接
    searchUrl: '/search?wd=**&pg=fypage',
    // 允许搜索、允许快搜、允许筛选
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    // 请求头
    headers: {
        'User-Agent': 'MOBILE_UA',
    },
    // 超时时间
    timeout: 5000,
    // 静态分类
    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',

    // 是否需要调用免嗅
    play_parse: true,
    // 免嗅lazy执行函数
    lazy: '',
    // 首页推荐数量
    limit: 6,
    // 是否双层列表
    double: true,

    // 推荐列表
    推荐: '.recommend .item;a&&title;img&&src;.remarks&&Text;a&&href',
    // 一级列表
    一级: '.list .item;a&&title;img&&src;.remarks&&Text;a&&href',
    // 二级详情
    二级: {
        "title": "h1&&Text",
        "img": ".poster img&&src",
        "desc": ".desc&&Text",
        "content": ".content&&Text",
        "tabs": ".tabs span",
        "lists": ".playlists ul"
    },
    // 搜索
    搜索: '.search-result .item;a&&title;img&&src;.remarks&&Text;a&&href',
}`;

    return reply.send({ template });
}

export async function getLibsInfo(req, reply) {
    const info = {
        globalObjects: [
            "request(url, options) - HTTP Request",
            "post(url, options) - HTTP POST Request",
            "pdfa(html, rule) - Parse List",
            "pdfh(html, rule) - Parse Single Node",
            "pd(html, rule) - Parse URL",
            "setItem(k, v) - Persistent storage",
            "getItem(k) - Retrieve storage",
            "clearItem(k) - Delete storage",
            "urljoin(base, path) - Resolve URL"
        ],
        parsingRules: [
            "Format: selector;attr1;attr2...",
            "pdfa (list): Returns array",
            "pdfh (single): Returns string",
            "pd (url): Returns resolved URL string",
            "Special Attrs: Text, Html, href, src, style, data-*",
            "Syntax: && (nested), || (backup), :eq(n) (index), * (all)"
        ]
    };
    return reply.send(info);
}

function isSafePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    
    // Prevent absolute paths from user input directly
    if (path.isAbsolute(filePath)) return false;

    // Resolve full path and check if it is within CWD
    const fullPath = path.resolve(process.cwd(), filePath);
    const cwd = process.cwd();
    
    // Ensure the resolved path is inside the current working directory
    if (!fullPath.startsWith(cwd)) return false;

    // Blacklist check
    const blacklist = ['node_modules', 'database.db', '.git', '.env'];
    const relativePath = path.relative(cwd, fullPath);
    if (blacklist.some(item => relativePath.includes(item))) return false;

    return true;
}
