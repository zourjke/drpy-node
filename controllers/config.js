import {log, logError} from '../utils/log.js';

/**
 * 配置管理控制器
 *
 * 主要功能：
 * - 生成和管理drpy-node项目的配置文件
 * - 支持多种源类型：DS源、DR2源、Python源、CatVod源
 * - 提供配置订阅和健康检查功能
 * - 生成解析器、直播源、播放器等配置
 * - 处理配置文件的动态生成和缓存
 */

import {readdirSync, readFileSync, writeFileSync, existsSync} from 'fs';
import {getDisabledFilenameSet, setIndexRegenerator} from '../utils/sourceState.js';
import {readFile} from 'fs/promises';
import path from 'path';
import * as drpyS from '../libs/drpyS.js';
import '../libs_drpy/jinja.js'
import {naturalSort, urljoin, updateQueryString} from '../utils/utils.js'
import {md5} from "../libs_drpy/crypto-util.js";
import {ENV} from "../utils/env.js";
import FileHeaderManager from "../utils/fileHeaderManager.js";
import {extractNameFromCode} from "../utils/python.js";
import {validateBasicAuth, validatePwd} from "../utils/api_validate.js";
import {getSitesMap} from "../utils/sites-map.js";
import {getParsesDict} from "../utils/file.js";
import batchExecute from '../libs_drpy/batchExecute.js';
import {isPhpAvailable} from '../utils/phpEnv.js';

const {jsEncoder} = drpyS;

/**
 * 解析扩展参数字符串
 * 尝试将字符串解析为JSON对象或数组，如果解析失败则返回原字符串
 * @param {string} str - 待解析的字符串
 * @returns {any} 解析后的对象/数组或原字符串
 */
function parseExt(str) {
    try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed) || (typeof parsed === 'object' && parsed !== null)) {
            return parsed;
        }
    } catch (e) {
        // 忽略错误
    }
    return str;
}

/**
 * 格式化扩展参数用于日志输出
 * 将对象或数组转换为JSON字符串，其他类型直接返回
 * @param {any} _ext - 扩展参数
 * @returns {string} 格式化后的字符串
 */
function logExt(_ext) {
    return Array.isArray(_ext) || typeof _ext == "object" ? JSON.stringify(_ext) : _ext
}

function guessRuleType(baseName, ruleObject) {
    if (baseName.includes('[画]')) {
        ruleObject.类型 = '漫画'
    } else if (baseName.includes('[书]')) {
        ruleObject.类型 = '小说'
    } else if (baseName.includes('[短]')) {
        ruleObject.类型 = '短剧'
    }
}

/**
 * 生成站点配置JSON数据
 * 扫描各种类型的源文件并生成统一的配置格式
 *
 * @param {Object} options - 配置选项对象
 * @param {string} options.jsDir - DS源文件目录
 * @param {string} options.dr2Dir - DR2源文件目录
 * @param {string} options.pyDir - Python源文件目录
 * @param {string} options.catDir - CatVod源文件目录
 * @param {string} options.configDir - 配置文件目录
 * @param {string} options.jsonDir - JSON配置目录
 * @param {string} options.subFilePath - 订阅文件路径
 * @param {string} options.rootDir - 根目录路径
 * @param {string} requestHost - 请求主机地址
 * @param {Object|null} sub - 订阅配置对象
 * @param {string} pwd - 访问密码
 * @returns {Promise<Object>} 包含sites数组和spider配置的对象
 */
async function generateSiteJSON(options, requestHost, sub, pwd, {includeDisabled = false} = {}) {
    const jsDir = options.jsDir;
    const dr2Dir = options.dr2Dir;
    const pyDir = options.pyDir;
    const phpDir = options.phpDir;
    const catDir = options.catDir;
    const configDir = options.configDir;
    const jsonDir = options.jsonDir;
    const subFilePath = options.subFilePath;
    const rootDir = options.rootDir;

    const files = readdirSync(jsDir);
    let valid_files = files.filter((file) => file.endsWith('.js') && !file.startsWith('_')); // 筛选出不是 "_" 开头的 .js 文件
    // 停用源过滤（docs/source-toggle-design.md）：healthy=0 检测模式跳过，保证全源检测可见停用源
    const disabledJs = includeDisabled ? null : getDisabledFilenameSet('spider/js');
    if (disabledJs) valid_files = valid_files.filter((file) => !disabledJs.has(file));
    let sort_list = [];
    // 获取排序配置文件路径
    let sort_file = path.join(path.dirname(subFilePath), `./order_common.html`);
    if (!existsSync(sort_file)) {
        sort_file = path.join(path.dirname(subFilePath), `./order_common.example.html`);
    }
    // 处理订阅过滤规则
    if (sub) {
        if (sub.mode === 0) {
            // 包含模式：只保留匹配正则的文件
            valid_files = valid_files.filter(it => (new RegExp(sub.reg || '.*')).test(it));
        } else if (sub.mode === 1) {
            // 排除模式：排除匹配正则的文件
            valid_files = valid_files.filter(it => !(new RegExp(sub.reg || '.*')).test(it));
        }

        // 使用自定义排序文件
        if (sub.sort) {
            sort_file = path.join(path.dirname(subFilePath), `./${sub.sort}.html`);
            if (!existsSync(sort_file)) {
                sort_file = path.join(path.dirname(subFilePath), `./${sub.sort}.example.html`);
            }
        }
    }
    if (existsSync(sort_file)) {
        log('sort_file:', sort_file);
        let sort_file_content = readFileSync(sort_file, 'utf-8');
        // log(sort_file_content)
        sort_list = sort_file_content.split('\n').filter(it => it.trim()).map(it => it.trim());
        // log(sort_list);
    }
    let sites = [];

    //以下为自定义APP模板部分
    try {
        const templateConfigPath = path.join(jsonDir, './App模板配置.json');
        if (existsSync(templateConfigPath)) {
            const templateContent = readFileSync(templateConfigPath, 'utf-8');
            const templateConfig = JSON.parse(templateContent);
            sites = [];
            for (const [key, config] of Object.entries(templateConfig)) {
                if (!valid_files.includes(`${key}[模板].js`)) continue;
                let tplLogo = '';
                try {
                    const tplHeader = await FileHeaderManager.readHeader(path.join(jsDir, `${key}[模板].js`));
                    tplLogo = (tplHeader && tplHeader.logo) || '';
                } catch (e) {}
                for (const [name] of Object.entries(config)) {
                    if (name === "示例") continue;
                    sites.push({
                        key: `drpyS_${name}_${key}`,
                        name: `${name}[M](${key.replace('App', '').toUpperCase()})`,
                        type: 4,
                        api: `${requestHost}/api/${key}[模板]${pwd ? `?pwd=${pwd}` : ''}`,
                        logo: tplLogo,
                        searchable: 1,
                        filterable: 1,
                        quickSearch: 0,
                        ext: `../json/App模板配置.json$${name}`
                    });
                }
            }
        }
    } catch (e) {
        logError('读取App模板配置失败:', e.message);
    }
    //以上为自定义APP[模板]配置自动添加代码

    let link_jar = '';
    let enableRuleName = ENV.get('enable_rule_name', '0') === '1';
    let enableOldConfig = Number(ENV.get('enable_old_config', '0'));
    let isLoaded = await drpyS.isLoaded();
    let forceHeader = Number(process.env.FORCE_HEADER) || 0;
    let dr2ApiType = Number(process.env.DR2_API_TYPE) || 0; // 0 ds里的api 1壳子内置
    // log('hide_adult:', ENV.get('hide_adult'));
    if (ENV.get('hide_adult') === '1' || ENV.get('hide_adult') === '2') {
        valid_files = valid_files.filter(it => !(new RegExp('\\[[密]\\]|密+')).test(it));
    }
    let SitesMap = getSitesMap(configDir);
    let mubanKeys = Object.keys(SitesMap);
    // log(SitesMap);
    // log(mubanKeys);
    // 排除模板后缀的DS源
    valid_files = valid_files.filter(it => !/^APP.*\[模板]\.js$/i.test(it));
    log(`开始生成ds的t4配置，jsDir:${jsDir},源数量: ${valid_files.length}`);
    const tasks = valid_files.map((file) => {
        return {
            func: async ({file, jsDir, requestHost, pwd, drpyS, SitesMap, jsEncoder}) => {
                const baseName = path.basename(file, '.js'); // 去掉文件扩展名
                let api = `${requestHost}/api/${baseName}`;  // 使用请求的 host 地址，避免硬编码端口
                if (pwd) {
                    api += `?pwd=${pwd}`;
                }
                let ruleObject = {
                    searchable: 0, // 固定值
                    filterable: 0, // 固定值
                    quickSearch: 0, // 固定值
                };
                let ruleMeta = {...ruleObject};
                // if (baseName.includes('抖音直播弹幕')) {
                const filePath = path.join(jsDir, file);
                const header = await FileHeaderManager.readHeader(filePath);
                // log('ds header:', header);
                if (!header || forceHeader) {
                    try {
                        ruleObject = await drpyS.getRuleObject(filePath);
                    } catch (e) {
                        throw new Error(`Error parsing rule object for file: ${file}, ${e.message}`);
                    }
                    guessRuleType(baseName, ruleObject);
                    Object.assign(ruleMeta, {
                        title: ruleObject.title,
                        author: ruleObject.author,
                        类型: ruleObject.类型 || '影视',
                        mergeList: ruleObject.二级 === '*' || ruleObject.mergeList,
                        searchable: ruleObject.searchable,
                        filterable: ruleObject.filterable,
                        quickSearch: ruleObject.quickSearch,
                        more: ruleObject.more,
                        logo: ruleObject.logo,
                        lang: 'ds',
                    });
                    if (ruleMeta.mergeList) {
                        if (ruleMeta.more && typeof ruleMeta.more === 'object') {
                            ruleMeta.more.mergeList = 1;
                        } else {
                            ruleMeta.more = {mergeList: 1};
                        }
                    }
                    // log('ds ruleMeta:', ruleMeta);
                    await FileHeaderManager.writeHeader(filePath, ruleMeta);
                } else {
                    Object.assign(ruleMeta, header);
                }
                if (!isLoaded) {
                    const sizeInBytes = await FileHeaderManager.getFileSize(filePath, {humanReadable: true});
                    log(`Loading RuleObject: ${filePath} fileSize:${sizeInBytes}`);
                }
                ruleMeta.title = enableRuleName ? ruleMeta.title || baseName : baseName;

                let fileSites = [];
                const isMuban = mubanKeys.includes(baseName);
                if (baseName === 'push_agent') {
                    let key = 'push_agent';
                    let name = `${ruleMeta.title}(DS)`;
                    fileSites.push({key, name});
                } else if (isMuban && SitesMap.hasOwnProperty(baseName) && Array.isArray(SitesMap[baseName])) {
                    SitesMap[baseName].forEach((it) => {
                        let key = `drpyS_${it.alias}`;
                        let name = `${it.alias}(DS)`;
                        let ext = it.queryObject.type === 'url' ? it.queryObject.params : it.queryStr;
                        if (ext) {
                            ext = jsEncoder.gzip(ext);
                        }
                        fileSites.push({key, name, ext});
                    });
                } else if (isMuban) {
                    return
                } else {
                    let key = `drpyS_${ruleMeta.title}`;
                    let name = `${ruleMeta.title}(DS)`;
                    fileSites.push({key, name});
                }

                fileSites.forEach((fileSite) => {
                    const site = {
                        key: fileSite.key,
                        name: fileSite.name,
                        type: 4, // 固定值
                        api,
                        ...ruleMeta,
                        ext: fileSite.ext || "", // 固定为空字符串
                    };
                    sites.push(site);
                });
            },
            param: {file, jsDir, requestHost, pwd, drpyS, SitesMap, jsEncoder},
            id: file,
        };
    });

    const listener = {
        func: (param, id, error, result) => {
            if (error) {
                logError(`Error processing file ${id}:`, error.message);
            } else {
                // log(`Successfully processed file ${id}:`, result);
            }
        },
        param: {}, // 外部参数可以在这里传入
    };

    await batchExecute(tasks, listener);

    // 根据用户是否启用dr2源去生成对应配置
    const enable_dr2 = ENV.get('enable_dr2', '1');
    if ((enable_dr2 === '1' || enable_dr2 === '2')) {
        const dr2_files = readdirSync(dr2Dir);
        let dr2_valid_files = dr2_files.filter((file) => file.endsWith('.js') && !file.startsWith('_')); // 筛选出不是 "_" 开头的 .js 文件
        const disabledDr2 = includeDisabled ? null : getDisabledFilenameSet('spider/js_dr2');
        if (disabledDr2) dr2_valid_files = dr2_valid_files.filter((file) => !disabledDr2.has(file));
        // log(dr2_valid_files);
        log(`开始生成dr2配置，dr2Dir:${dr2Dir},源数量: ${dr2_valid_files.length}, 启用模式: ${enable_dr2 === '1' ? 'T3配置' : 'T4风格API配置'}`);

        const dr2_tasks = dr2_valid_files.map((file) => {
            return {
                func: async ({file, dr2Dir, requestHost, pwd, drpyS, SitesMap}) => {
                    const baseName = path.basename(file, '.js'); // 去掉文件扩展名
                    let ruleObject = {
                        searchable: 0, // 固定值
                        filterable: 0, // 固定值
                        quickSearch: 0, // 固定值
                    };
                    let ruleMeta = {...ruleObject};
                    const filePath = path.join(dr2Dir, file);
                    const header = await FileHeaderManager.readHeader(filePath);
                    // log('dr2 header:', header);
                    if (!header || forceHeader) {
                        try {
                            ruleObject = await drpyS.getRuleObject(path.join(filePath));
                        } catch (e) {
                            throw new Error(`Error parsing rule object for file: ${file}, ${e.message}`);
                        }
                        guessRuleType(baseName, ruleObject);
                        Object.assign(ruleMeta, {
                            title: ruleObject.title,
                            author: ruleObject.author,
                            类型: ruleObject.类型 || '影视',
                            mergeList: ruleObject.二级 === '*' || ruleObject.mergeList,
                            searchable: ruleObject.searchable,
                            filterable: ruleObject.filterable,
                            quickSearch: ruleObject.quickSearch,
                            more: ruleObject.more,
                            logo: ruleObject.logo,
                            lang: 'dr2',
                        });
                        if (ruleMeta.mergeList) {
                            if (ruleMeta.more && typeof ruleMeta.more === 'object') {
                                ruleMeta.more.mergeList = 1;
                            } else {
                                ruleMeta.more = {mergeList: 1};
                            }
                        }
                        // log('dr2 ruleMeta:', ruleMeta);
                        await FileHeaderManager.writeHeader(filePath, ruleMeta);
                    } else {
                        Object.assign(ruleMeta, header);
                    }
                    if (!isLoaded) {
                        const sizeInBytes = await FileHeaderManager.getFileSize(filePath, {humanReadable: true});
                        log(`Loading RuleObject: ${filePath} fileSize:${sizeInBytes}`);
                    }
                    ruleMeta.title = enableRuleName ? ruleMeta.title || baseName : baseName;

                    let fileSites = [];
                    if (baseName === 'push_agent') {
                        let key = 'push_agent';
                        let name = `${ruleMeta.title}(DR2)`;
                        fileSites.push({key, name});
                    } else if (SitesMap.hasOwnProperty(baseName) && Array.isArray(SitesMap[baseName])) {
                        SitesMap[baseName].forEach((it) => {
                            let key = `drpy2_${it.alias}`;
                            let name = `${it.alias}(DR2)`;
                            fileSites.push({key, name, queryStr: it.queryStr});
                        });
                    } else {
                        let key = `drpy2_${ruleMeta.title}`;
                        let name = `${ruleMeta.title}(DR2)`;
                        fileSites.push({key, name});
                    }

                    fileSites.forEach((fileSite) => {
                        if (enable_dr2 === '1' || enable_dr2 === '2') {
                            // dr2ApiType=0 使用接口drpy2 dr2ApiType=1 使用壳子内置的drpy2
                            let api = dr2ApiType ? `assets://js/lib/drpy2.js` : `${requestHost}/public/drpy/drpy2.min.js`;
                            if (enable_dr2 === '2') {
                                api = `${requestHost}/public/drpy/drpy2-fast.min.js`;
                            }
                            let ext = `${requestHost}/js/${file}`;
                            if (pwd) {
                                ext += `?pwd=${pwd}`;
                            }
                            // 处理传参源的ext
                            if (fileSite.queryStr) {
                                ext = updateQueryString(ext, fileSite.queryStr);
                            }
                            // 模式1：只启用dr2的T3配置
                            const site = {
                                key: fileSite.key,
                                name: fileSite.name,
                                type: 3, // 固定值
                                api,
                                ...ruleMeta,
                                ext: ext || "", // 固定为空字符串
                            };
                            sites.push(site);
                        }
                        // else if (enable_dr2 === '2') {
                        //
                        //     // 模式2：只启用T3脚本的T4风格API配置
                        //     const t4site = {
                        //         key: fileSite.key,
                        //         name: fileSite.name,
                        //         type: 4, // 固定值
                        //         api: `${requestHost}/api/${baseName}`,
                        //         ...ruleMeta,
                        //         ext: "", // 固定为空字符串
                        //     };
                        //     // 添加isdr2参数到API URL
                        //     if (pwd) {
                        //         t4site.api += `?pwd=${pwd}&do=dr`;
                        //     } else {
                        //         t4site.api += `?do=dr`;
                        //     }
                        //
                        //     // 处理传参源的API参数
                        //     if (fileSite.queryStr) {
                        //         const separator = t4site.api.includes('?') ? '&' : '?';
                        //         site.api += `${separator}extend=${encodeURIComponent(fileSite.queryStr)}`;
                        //     }
                        //
                        //     sites.push(t4site);
                        // }
                    });
                },
                param: {file, dr2Dir, requestHost, pwd, drpyS, SitesMap},
                id: file,
            };
        });

        await batchExecute(dr2_tasks, listener);

    }

    // 根据用户是否启用py源去生成对应配置
    const enable_py = ENV.get('enable_py', '1');
    if (enable_py === '1' || enable_py === '2') {
        const py_files = readdirSync(pyDir);
        const api_type = enable_py === '1' ? 3 : 4;
        let py_valid_files = py_files.filter((file) => file.endsWith('.py') && !file.startsWith('_') && !file.startsWith('base_')); // 筛选出不是 "_" 开头的 .py 文件
        const disabledPy = includeDisabled ? null : getDisabledFilenameSet('spider/py');
        if (disabledPy) py_valid_files = py_valid_files.filter((file) => !disabledPy.has(file));
        // log(py_valid_files);
        log(`开始生成python的T${api_type}配置，pyDir:${pyDir},源数量: ${py_valid_files.length}`);

        const py_tasks = py_valid_files.map((file) => {
            return {
                func: async ({file, pyDir, requestHost, pwd, SitesMap}) => {
                    const baseName = path.basename(file, '.py'); // 去掉文件扩展名
                    const extJson = path.join(pyDir, baseName + '.json');
                    let api = enable_py === '1' ? `${requestHost}/py/${file}` : `${requestHost}/api/${baseName}?do=py`;  // 使用请求的 host 地址，避免硬编码端口
                    let ext = existsSync(extJson) ? `${requestHost}/py/${file}` : '';
                    if (pwd) {
                        api += api_type === 3 ? '?' : '&';
                        api += `pwd=${pwd}`;
                        if (ext) {
                            ext += `?pwd=${pwd}`;
                        }
                    }
                    let ruleObject = {
                        searchable: 1, // 固定值
                        filterable: 1, // 固定值
                        quickSearch: 1, // 固定值
                    };
                    guessRuleType(baseName, ruleObject);
                    let ruleMeta = {...ruleObject};
                    const filePath = path.join(pyDir, file);
                    const header = await FileHeaderManager.readHeader(filePath);
                    // log('py header:', header);
                    if (!header || forceHeader) {
                        const fileContent = await readFile(filePath, 'utf-8');
                        const title = extractNameFromCode(fileContent) || baseName;
                        Object.assign(ruleMeta, {
                            title: title,
                            lang: 'hipy',
                        });
                        // log('py ruleMeta:', ruleMeta);
                        await FileHeaderManager.writeHeader(filePath, ruleMeta);
                    } else {
                        Object.assign(ruleMeta, header);
                    }
                    if (!isLoaded) {
                        const sizeInBytes = await FileHeaderManager.getFileSize(filePath, {humanReadable: true});
                        log(`Loading RuleObject: ${filePath} fileSize:${sizeInBytes}`);
                    }
                    ruleMeta.title = enableRuleName ? ruleMeta.title || baseName : baseName;

                    let fileSites = [];
                    ext = ext || ruleMeta.ext || '';
                    const isMuban = mubanKeys.includes(baseName) || /^(APP|getapp3)/.test(baseName);
                    if (baseName === 'push_agent') {
                        let key = 'push_agent';
                        let name = `${ruleMeta.title}(hipy)`;
                        fileSites.push({key, name, ext});
                    } else if (isMuban && SitesMap.hasOwnProperty(baseName) && Array.isArray(SitesMap[baseName])) {
                        // log(SitesMap[baseName]);
                        SitesMap[baseName].forEach((it) => {
                            let key = `hipy_py_${it.alias}`;
                            let name = `${it.alias}(hipy)`;
                            let _ext = it.queryObject.type === 'url' ? it.queryObject.params : it.queryStr;
                            if (_ext && _ext !== it.queryStr) {
                                _ext = jsEncoder.gzip(_ext);
                            } else {
                                if (!enableOldConfig) {
                                    _ext = parseExt(_ext);
                                }
                            }
                            log(`[HIPY-${baseName}] alias name: ${name},typeof _ext:${typeof _ext},_ext: ${logExt(_ext)}`);
                            fileSites.push({key, name, ext: _ext});
                        });
                    } else if (isMuban) {
                        return
                    } else {
                        let key = `hipy_py_${ruleMeta.title}`;
                        let name = `${ruleMeta.title}(hipy)`;
                        fileSites.push({key, name, ext});
                    }

                    fileSites.forEach((fileSite) => {
                        const site = {
                            key: fileSite.key,
                            name: fileSite.name,
                            type: api_type, // 固定值
                            api,
                            ...ruleMeta,
                            ext: fileSite.ext || "", // 固定为空字符串
                        };
                        sites.push(site);
                    });
                },
                param: {file, pyDir, requestHost, pwd, SitesMap},
                id: file,
            };
        });

        await batchExecute(py_tasks, listener);

    }

    // 根据用户是否启用php源去生成对应配置
    const enable_php = ENV.get('enable_php', '1');
    log('isPhpAvailable:', isPhpAvailable);
    if ((enable_php === '1' && isPhpAvailable) || enable_php === '2') {
        const php_files = readdirSync(phpDir);
        const api_type = enable_php === '2' ? 3 : 4;
        let php_valid_files = php_files.filter((file) => file.endsWith('.php') && !file.startsWith('_') && !['config.php', 'index.php', 'test_runner.php'].includes(file));
        const disabledPhp = includeDisabled ? null : getDisabledFilenameSet('spider/php');
        if (disabledPhp) php_valid_files = php_valid_files.filter((file) => !disabledPhp.has(file));
        log(`开始生成php的T${api_type}配置，phpDir:${phpDir},源数量: ${php_valid_files.length}`);

        const php_tasks = php_valid_files.map((file) => {
            return {
                func: async ({file, phpDir, requestHost, pwd, SitesMap}) => {
                    const baseName = path.basename(file, '.php');
                    let api = enable_php === '2' ? `${requestHost}/php/${file}` : `${requestHost}/api/${baseName}?do=php`;
                    let ext = '';
                    if (pwd) {
                        api += enable_php === '2' ? `?pwd=${pwd}` : `&pwd=${pwd}`;
                    }
                    let ruleObject = {
                        searchable: 1,
                        filterable: 1,
                        quickSearch: 1,
                    };
                    guessRuleType(baseName, ruleObject);
                    let ruleMeta = {...ruleObject};
                    const filePath = path.join(phpDir, file);

                    Object.assign(ruleMeta, {
                        title: baseName,
                        lang: 'php',
                    });
                    ruleMeta.title = enableRuleName ? ruleMeta.title || baseName : baseName;

                    let fileSites = [];
                    let key = `php_${ruleMeta.title}`;
                    let name = `${ruleMeta.title}(PHP)`;
                    fileSites.push({key, name, ext});

                    fileSites.forEach((fileSite) => {
                        const site = {
                            key: fileSite.key,
                            name: fileSite.name,
                            type: api_type,
                            api,
                            ...ruleMeta,
                            ext: fileSite.ext || "",
                        };
                        sites.push(site);
                    });
                },
                param: {file, phpDir, requestHost, pwd, SitesMap},
                id: file,
            };
        });
        await batchExecute(php_tasks, listener);
    }

    const enable_cat = ENV.get('enable_cat', '1');
    // 根据用户是否启用cat源去生成对应配置
    if (enable_cat === '1' || enable_cat === '2') {
        const cat_files = readdirSync(catDir);
        const api_type = enable_cat === '1' ? 3 : 4;
        let cat_valid_files = cat_files.filter((file) => file.endsWith('.js') && !file.startsWith('_')); // 筛选出不是 "_" 开头的 .py 文件
        const disabledCat = includeDisabled ? null : getDisabledFilenameSet('spider/catvod');
        if (disabledCat) cat_valid_files = cat_valid_files.filter((file) => !disabledCat.has(file));
        // log(py_valid_files);
        log(`开始生成catvod的T${api_type}配置，catDir:${catDir},源数量: ${cat_valid_files.length}`);

        const cat_tasks = cat_valid_files.map((file) => {
            return {
                func: async ({file, catDir, requestHost, pwd, SitesMap}) => {
                    const baseName = path.basename(file, '.js'); // 去掉文件扩展名
                    const extJson = path.join(catDir, baseName + '.json');
                    const isT3 = enable_cat === '1' || baseName.includes('[B]');
                    let api = isT3 ? `${requestHost}/cat/${file}` : `${requestHost}/api/${baseName}?do=cat`;  // 使用请求的 host 地址，避免硬编码端口
                    let ext = existsSync(extJson) ? `${requestHost}/cat/${file}` : '';

                    if (pwd) {
                        api += isT3 ? '?' : '&';
                        api += `pwd=${pwd}`;
                        if (ext) {
                            ext += `?pwd=${pwd}`;
                        }
                    }
                    let ruleObject = {
                        searchable: 1, // 固定值
                        filterable: 1, // 固定值
                        quickSearch: 1, // 固定值
                    };
                    guessRuleType(baseName, ruleObject);
                    let ruleMeta = {...ruleObject};
                    const filePath = path.join(catDir, file);
                    const header = await FileHeaderManager.readHeader(filePath);
                    // log('py header:', header);
                    if (!header || forceHeader) {
                        const fileContent = await readFile(filePath, 'utf-8');
                        const title = extractNameFromCode(fileContent) || baseName;
                        Object.assign(ruleMeta, {
                            title: title,
                            lang: 'cat',
                        });
                        // log('py ruleMeta:', ruleMeta);
                        await FileHeaderManager.writeHeader(filePath, ruleMeta);
                    } else {
                        Object.assign(ruleMeta, header);
                    }
                    if (!isLoaded) {
                        const sizeInBytes = await FileHeaderManager.getFileSize(filePath, {humanReadable: true});
                        log(`Loading RuleObject: ${filePath} fileSize:${sizeInBytes}`);
                    }
                    ruleMeta.title = enableRuleName ? ruleMeta.title || baseName : baseName;

                    let fileSites = [];
                    ext = ext || ruleMeta.ext || '';
                    if (baseName === 'push_agent') {
                        let key = 'push_agent';
                        let name = `${ruleMeta.title}(cat)`;
                        fileSites.push({key, name, ext});
                    } else if (SitesMap.hasOwnProperty(baseName) && Array.isArray(SitesMap[baseName])) {
                        SitesMap[baseName].forEach((it) => {
                            let key = `catvod_${it.alias}`;
                            let name = `${it.alias}(cat)`;
                            let _ext = it.queryObject.type === 'url' ? it.queryObject.params : it.queryStr;
                            if (_ext && _ext !== it.queryStr) {
                                _ext = jsEncoder.gzip(_ext);
                            } else {
                                if (!enableOldConfig) {
                                    _ext = parseExt(_ext);
                                }
                            }
                            log(`[CAT-${baseName}] alias name: ${name},typeof _ext:${typeof _ext},_ext: ${logExt(_ext)}`);
                            fileSites.push({key, name, ext: _ext});
                        });
                    } else {
                        let key = `catvod_${ruleMeta.title}`;
                        let name = `${ruleMeta.title}(cat)`;
                        fileSites.push({key, name, ext});
                    }

                    fileSites.forEach((fileSite) => {
                        const site = {
                            key: fileSite.key,
                            name: fileSite.name,
                            type: isT3 ? 3 : api_type, // 固定值
                            api,
                            ...ruleMeta,
                            ext: fileSite.ext || "", // 固定为空字符串
                        };
                        sites.push(site);
                    });
                },
                param: {file, catDir, requestHost, pwd, SitesMap},
                id: file,
            };
        });

        await batchExecute(cat_tasks, listener);

    }

    // 根据用户是否启用挂载数据源去生成对应配置
    if (ENV.get('enable_link_data', '0') === '1') {
        log(`开始挂载外部T4数据`);
        let link_sites = [];
        let link_url = ENV.get('link_url');
        let enable_link_push = ENV.get('enable_link_push', '0');
        let enable_link_jar = ENV.get('enable_link_jar', '0');
        try {
            let link_data = readFileSync(path.join(rootDir, './data/settings/link_data.json'), 'utf-8');
            let link_config = JSON.parse(link_data);
            link_sites = link_config.sites.filter(site => site.type = 4);
            if (link_config.spider && enable_link_jar === '1') {
                let link_spider_arr = link_config.spider.split(';');
                link_jar = urljoin(link_url, link_spider_arr[0]);
                if (link_spider_arr.length > 1) {
                    link_jar = [link_jar].concat(link_spider_arr.slice(1)).join(';')
                }
                log(`开始挂载外部T4 Jar: ${link_jar}`);
            }
            link_sites.forEach((site) => {
                if (site.key === 'push_agent' && enable_link_push !== '1') {
                    return
                }
                if (site.api && !site.api.startsWith('http')) {
                    site.api = urljoin(link_url, site.api)
                }
                if (site.ext && site.ext.startsWith('.')) {
                    site.ext = urljoin(link_url, site.ext)
                }
                if (site.key === 'push_agent' && enable_link_push === '1') { // 推送覆盖
                    let pushIndex = sites.findIndex(s => s.key === 'push_agent');
                    if (pushIndex > -1) {
                        sites[pushIndex] = site;
                    } else {
                        sites.push(site);
                    }
                } else {
                    sites.push(site);
                }
            });
        } catch (e) {
        }
    }

    // 订阅再次处理别名的情况
    if (sub) {
        if (sub.mode === 0) {
            sites = sites.filter(it => (new RegExp(sub.reg || '.*')).test(it.name));
        } else if (sub.mode === 1) {
            sites = sites.filter(it => !(new RegExp(sub.reg || '.*')).test(it.name));
        }
    }
    // 青少年模式再次处理自定义别名的情况
    if (ENV.get('hide_adult') === '1' || ENV.get('hide_adult') === '2') {
        sites = sites.filter(it => !(new RegExp('\\[[密]\\]|密+')).test(it.name));
    }
    // log('sort_list:', sort_list);
    sites = naturalSort(sites, 'name', sort_list);
    return {sites, spider: link_jar};
}

/**
 * 生成解析器配置JSON数据
 * 扫描解析器文件并生成解析器配置列表
 *
 * @param {string} jxDir - 解析器文件目录
 * @param {string} requestHost - 请求主机地址
 * @returns {Promise<Object>} 包含parses数组的对象
 */
async function generateParseJSON(jxDir, requestHost) {
    let _enable_self_jx = ENV.get('enable_self_jx', '0');
    // 兼容字符串 "1"/"true"、数字 1、布尔 true 等多种存储格式（admin.js updateConfig 的 JSON.parse 会把 "1" 转成数字 1）
    let enable_self_jx = ['1', 1, true, 'true'].includes(_enable_self_jx);
    // log(`[generateParseJSON] enable_self_jx=${enable_self_jx} (raw=${JSON.stringify(_enable_self_jx)}), jxDir=${jxDir}`);
    let parses = [];
    let sorted_parses = [];
    const jx_dict = getParsesDict(requestHost);
    if (enable_self_jx) {
        const files = readdirSync(jxDir);
        const jx_files = files.filter((file) => file.endsWith('.js') && !file.startsWith('_')) // 筛选出不是 "_" 开头的 .js 文件
        const tasks = jx_files.map((file) => {
            return {
                func: async ({file, jxDir, requestHost, drpyS}) => {
                    const baseName = path.basename(file, '.js'); // 去掉文件扩展名
                    const api = `${requestHost}/parse/${baseName}?url=`;  // 使用请求的 host 地址，避免硬编码端口

                    let jxObject = {
                        type: 1, // 固定值
                        ext: {
                            flag: [
                                "qiyi",
                                "imgo",
                                "爱奇艺",
                                "奇艺",
                                "qq",
                                "qq 预告及花絮",
                                "腾讯",
                                "youku",
                                "优酷",
                                "pptv",
                                "PPTV",
                                "letv",
                                "乐视",
                                "leshi",
                                "mgtv",
                                "芒果",
                                "sohu",
                                "xigua",
                                "fun",
                                "风行"
                            ]
                        },
                        header: {
                            "User-Agent": "Mozilla/5.0"
                        }
                    };
                    try {
                        let _jxObject = await drpyS.getJx(path.join(jxDir, file));
                        jxObject = {...jxObject, ..._jxObject};
                    } catch (e) {
                        throw new Error(`Error parsing jx object for file: ${file}, ${e.message}`);
                    }

                    parses.push({
                        name: baseName,
                        url: jxObject.url || api,
                        type: jxObject.type,
                        ext: jxObject.ext,
                        header: jxObject.header
                    });
                },
                param: {file, jxDir, requestHost, drpyS},
                id: file,
            };
        });

        const listener = {
            func: (param, id, error, result) => {
                if (error) {
                    logError(`Error processing file ${id}:`, error.message);
                } else {
                    // log(`Successfully processed file ${id}:`, result);
                }
            },
            param: {}, // 外部参数可以在这里传入
        };
        await batchExecute(tasks, listener);
        sorted_parses = naturalSort(parses, 'name', ['JSON并发', 'JSON合集', '虾米', '奇奇']);
    }
    let sorted_jx_dict = naturalSort(jx_dict, 'name', ['J', 'W']);
    parses = sorted_parses.concat(sorted_jx_dict);
    return {parses};
}

/**
 * 生成直播源配置JSON数据
 * 根据环境变量配置生成直播源列表
 *
 * @param {string} requestHost - 请求主机地址
 * @returns {Object} 包含lives数组的对象
 */
function generateLivesJSON(requestHost) {
    let lives = [];
    let live_url = process.env.LIVE_URL || '';
    let epg_url = process.env.EPG_URL || ''; // 从.env文件读取
    let logo_url = process.env.LOGO_URL || ''; // 从.env文件读取
    if (live_url && !live_url.startsWith('http')) {
        let public_url = urljoin(requestHost, 'public/');
        live_url = urljoin(public_url, live_url);
    }
    // log('live_url:', live_url);
    if (live_url) {
        lives.push(
            {
                "name": "直播",
                "type": 0,
                "url": live_url,
                "playerType": 1,
                "ua": "okhttp/3.12.13",
                "epg": epg_url,
                "logo": logo_url
            }
        )
    }
    return {lives}
}

/**
 * 生成播放器配置JSON数据
 * 读取播放器配置文件并返回配置对象
 *
 * @param {string} configDir - 配置文件目录
 * @param {string} requestHost - 请求主机地址
 * @returns {Object} 播放器配置对象
 */
function generatePlayerJSON(configDir, requestHost) {
    let playerConfig = {};
    let playerConfigPath = path.join(configDir, './player.json');
    if (existsSync(playerConfigPath)) {
        try {
            playerConfig = JSON.parse(readFileSync(playerConfigPath, 'utf-8'))
        } catch (e) {

        }
    }
    return playerConfig
}

/**
 * 获取订阅配置列表
 * 读取订阅配置文件并解析为JSON对象
 *
 * @param {string} subFilePath - 订阅文件路径
 * @returns {Array} 订阅配置数组
 */
function getSubs(subFilePath) {
    let subs = [];
    try {
        const subContent = readFileSync(subFilePath, 'utf-8');
        subs = JSON.parse(subContent)
    } catch (e) {
        log(`读取订阅失败:${e.message}`);
    }
    return subs
}

/**
 * 组装完整配置对象并写入缓存（index.json；writeCustom 时同步写 custom.json）
 * 供 /config 路由与「停用/启用/删除源后的异步重建钩子」共用。
 * @param {Object} options 路由 options（各引擎目录与缓存文件路径）
 * @param {string} requestHost 请求根地址
 * @param {Object} siteJSON generateSiteJSON 的返回
 * @param {Object} opts {healthy, writeCustom}
 * @returns {Promise<Object>} 组装后的配置对象
 */
async function buildAndCacheConfig(options, requestHost, siteJSON, {healthy = '', writeCustom = false} = {}) {
    // 处理healthy参数，过滤失效源
    if (healthy === '1') {
        const reportPath = path.join(options.rootDir, 'data', 'source-checker', 'report.json');
        if (existsSync(reportPath)) {
            try {
                const reportContent = readFileSync(reportPath, 'utf-8');
                const reportData = JSON.parse(reportContent);

                // 获取失效源的key列表
                const failedKeys = new Set();
                if (reportData.sources && Array.isArray(reportData.sources)) {
                    reportData.sources.forEach(source => {
                        if (source.status === 'error') {
                            failedKeys.add(source.key);
                        }
                    });
                }

                // 过滤掉失效的源
                if (failedKeys.size > 0) {
                    siteJSON.sites = siteJSON.sites.filter(site => !failedKeys.has(site.key));
                    log(`Filtered out ${failedKeys.size} failed sources, remaining: ${siteJSON.sites.length}`);
                }
            } catch (error) {
                logError('Failed to process health report:', error.message);
            }
        }
    }

    // 生成各类配置数据
    const parseJSON = await generateParseJSON(options.jxDir, requestHost);
    const livesJSON = generateLivesJSON(requestHost);
    const playerJSON = generatePlayerJSON(options.configDir, requestHost);
    // 合并所有配置数据
    const configObj = {sites_count: siteJSON.sites.length, ...playerJSON, ...siteJSON, ...parseJSON, ...livesJSON};
    if (!configObj.spider) {
        configObj.spider = playerJSON.spider
    }
    // 写入配置文件（Vercel环境除外）
    if (!process.env.VERCEL) { // Vercel 环境不支持写文件，关闭此功能
        const configStr = JSON.stringify(configObj, null, 2);
        writeFileSync(options.indexFilePath, configStr, 'utf8'); // 写入 index.json
        if (writeCustom) {
            writeFileSync(options.customFilePath, configStr, 'utf8'); // 写入 custom.json
        }
    }
    return configObj;
}

/**
 * 配置管理路由注册函数
 * 注册配置相关的API路由，包括配置获取和索引文件访问
 *
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 配置选项
 * @param {Function} done - 完成回调函数
 */
export default (fastify, options, done) => {

    // 注册停用/启用源后的缓存配置异步重建实现（utils/sourceState.js 触发，见 docs/source-toggle-design.md §3.3）
    setIndexRegenerator(async () => {
        const requestHost = `http://127.0.0.1:${options.PORT}`;
        const siteJSON = await generateSiteJSON(options, requestHost, null, '', {includeDisabled: false});
        await buildAndCacheConfig(options, requestHost, siteJSON, {healthy: '', writeCustom: false});
        return true;
    });

    /**
     * 获取索引配置接口
     * 返回预生成的index.json配置文件内容
     */
    fastify.get('/index', {preHandler: validatePwd}, async (request, reply) => {
        if (!existsSync(options.indexFilePath)) {
            reply.code(404).send({error: 'index.json not found'});
            return;
        }

        const content = readFileSync(options.indexFilePath, 'utf-8');
        reply.send(JSON.parse(content));
    });

    /**
     * 动态配置生成接口
     * 根据请求参数动态生成配置JSON，支持订阅过滤、健康检查等功能
     * 同时将生成的配置写入index.json文件进行缓存
     */
    fastify.get('/config*', {preHandler: [validatePwd, validateBasicAuth]}, async (request, reply) => {
        let t1 = (new Date()).getTime();
        const query = request.query; // 获取 query 参数
        const pwd = query.pwd || '';
        const sub_code = query.sub || '';
        const healthy = query.healthy || ''; // 新增healthy参数
        const cat_sub_code = ENV.get('cat_sub_code', 'all');
        const must_sub_code = Number(ENV.get('must_sub_code', '0')) || 0;
        const cfg_path = request.params['*']; // 捕获整个路径
        try {
            // 获取主机名，协议及端口
            const protocol = request.headers['x-forwarded-proto'] || (request.socket.encrypted ? 'https' : 'http');  // http 或 https
            const hostname = request.hostname;  // 主机名，不包含端口
            const port = request.socket.localPort;  // 获取当前服务的端口
            log(`cfg_path:${cfg_path},port:${port}`);
            // 判断是否为外部访问（非本地访问）
            let not_local = cfg_path.startsWith('/1') || cfg_path.startsWith('/index');
            // 根据访问类型生成对应的主机地址
            let requestHost = not_local ? `${protocol}://${hostname}` : `http://127.0.0.1:${options.PORT}`; // 动态生成根地址
            let requestUrl = not_local ? `${protocol}://${hostname}${request.url}` : `http://127.0.0.1:${options.PORT}${request.url}`; // 动态生成请求链接
            // log('requestUrl:', requestUrl);
            // if (cfg_path.endsWith('.js')) {
            //     if (cfg_path.includes('index.js')) {
            //         // return reply.sendFile('index.js', path.join(options.rootDir, 'data/cat'));
            //         let content = readFileSync(path.join(options.rootDir, 'data/cat/index.js'), 'utf-8');
            //         // content = jinja.render(content, {config_url: requestUrl.replace(cfg_path, `/1?sub=all&healthy=1&pwd=${process.env.API_PWD || ''}`)});
            //         content = content.replace('$config_url', requestUrl.replace(cfg_path, `/1?sub=all&healthy=1&pwd=${process.env.API_PWD || ''}`));
            //         return reply.type('application/javascript;charset=utf-8').send(content);
            //     } else if (cfg_path.includes('index.config.js')) {
            //         let content = readFileSync(path.join(options.rootDir, 'data/cat/index.config.js'), 'utf-8');
            //         // content = jinja.render(content, {config_url: requestUrl.replace(cfg_path, `/1?sub=all&healthy=1&pwd=${process.env.API_PWD || ''}`)});
            //         content = content.replace('$config_url', requestUrl.replace(cfg_path, `/1?sub=all&healthy=1&pwd=${process.env.API_PWD || ''}`));
            //         return reply.type('application/javascript;charset=utf-8').send(content);
            //     }
            // }
            // if (cfg_path.endsWith('.js.md5')) {
            //     if (cfg_path.includes('index.js')) {
            //         let content = readFileSync(path.join(options.rootDir, 'data/cat/index.js'), 'utf-8');
            //         // content = jinja.render(content, {config_url: requestUrl.replace(cfg_path, `/1?sub=all&healthy=1&pwd=${process.env.API_PWD || ''}`)});
            //         content = content.replace('$config_url', requestUrl.replace(cfg_path, `/1?sub=all&healthy=1&pwd=${process.env.API_PWD || ''}`));
            //         let contentHash = md5(content);
            //         log('index.js contentHash:', contentHash);
            //         return reply.type('text/plain;charset=utf-8').send(contentHash);
            //     } else if (cfg_path.includes('index.config.js')) {
            //         let content = readFileSync(path.join(options.rootDir, 'data/cat/index.config.js'), 'utf-8');
            //         // content = jinja.render(content, {config_url: requestUrl.replace(cfg_path, `/1?sub=all&healthy=1&pwd=${process.env.API_PWD || ''}`)});
            //         content = content.replace('$config_url', requestUrl.replace(cfg_path, `/1?sub=all&healthy=1&pwd=${process.env.API_PWD || ''}`));
            //         let contentHash = md5(content);
            //         log('index.config.js contentHash:', contentHash);
            //         return reply.type('text/plain;charset=utf-8').send(contentHash);
            //     }
            // }
            const getFilePath = (cfgPath, rootDir, fileName) => path.join(rootDir, `data/cat/${fileName}`);
            const processContent = (content, cfgPath, requestUrl, requestHost) => {
                const $config_url = requestUrl.replace(cfgPath, `/1?sub=${cat_sub_code}&healthy=1&pwd=${process.env.API_PWD || ''}`);
                return content.replaceAll('$config_url', $config_url).replaceAll('$host', requestHost);
            }


            const handleJavaScript = (cfgPath, requestUrl, requestHost, options, reply) => {
                const fileMap = {
                    'index.js': 'index.js',
                    'index.config.js': 'index.config.js'
                };

                for (const [key, fileName] of Object.entries(fileMap)) {
                    if (cfgPath.includes(key)) {
                        const filePath = getFilePath(cfgPath, options.rootDir, fileName);
                        let content = readFileSync(filePath, 'utf-8');
                        content = processContent(content, cfgPath, requestUrl, requestHost);
                        return reply.type('application/javascript;charset=utf-8').send(content);
                    }
                }
            };

            const handleJsMd5 = (cfgPath, requestUrl, options, reply) => {
                const fileMap = {
                    'index.js': 'index.js',
                    'index.config.js': 'index.config.js'
                };

                for (const [key, fileName] of Object.entries(fileMap)) {
                    if (cfgPath.includes(key)) {
                        const filePath = getFilePath(cfgPath, options.rootDir, fileName);
                        let content = readFileSync(filePath, 'utf-8');
                        content = processContent(content, cfgPath, requestUrl);
                        const contentHash = md5(content);
                        log(`${fileName} contentHash:`, contentHash);
                        return reply.type('text/plain;charset=utf-8').send(contentHash);
                    }
                }
            };
            if (cfg_path.endsWith('.js')) {
                return handleJavaScript(cfg_path, requestUrl, requestHost, options, reply);
            }

            if (cfg_path.endsWith('.js.md5')) {
                return handleJsMd5(cfg_path, requestUrl, options, reply);
            }
            // 处理订阅码验证
            let sub = null;
            if (sub_code) {
                let subs = getSubs(options.subFilePath);
                sub = subs.find(it => it.code === sub_code);
                log('sub:', sub);
                // 检查订阅码状态
                if (sub && sub.status === 0) {
                    return reply.status(500).send({error: `此订阅码:【${sub_code}】已禁用`});
                } else if (!sub && must_sub_code) {
                    return reply.status(500).send({error: `此订阅码:【${sub_code}】不存在`});
                }
            } else if (!sub_code && must_sub_code) {
                return reply.status(500).send({error: `缺少订阅码参数`});
            }

            // 生成站点配置数据
            let siteJSON = await generateSiteJSON(options, requestHost, sub, pwd, {includeDisabled: healthy === '0'});

            // 组装并落盘缓存配置（handler 与停用/启用后的异步重建钩子共用）
            const configObj = await buildAndCacheConfig(options, requestHost, siteJSON, {healthy, writeCustom: cfg_path === '/1'});
            // 计算处理耗时并返回结果
            let t2 = (new Date()).getTime();
            let cost = t2 - t1;
            // configObj.cost = cost;
            // reply.send(configObj);
            reply.send(Object.assign({cost}, configObj));
        } catch (error) {
            reply.status(500).send({error: 'Failed to generate site JSON', details: error.message});
        }
    });

    done();
};
