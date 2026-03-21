import path from "path";
import {readFile} from "fs/promises";
import {fileURLToPath} from 'url';
import {execFile} from 'child_process';
import {promisify} from 'util';
import {getSitesMap} from "../utils/sites-map.js";
import {computeHash, deepCopy, getNowTime, urljoin} from "../utils/utils.js";
import {prepareBinary} from "../utils/binHelper.js";
import {md5} from "../libs_drpy/crypto-util.js";
import {fastify} from "../controllers/fastlogger.js";
import { PROJECT_ROOT } from '../utils/pathHelper.js';
// import dotenv from 'dotenv';
//
// dotenv.config({ path: path.join(PROJECT_ROOT, '.env.development') });

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _config_path = path.join(__dirname, '../config');
const _bridge_path = path.join(__dirname, '../spider/php/_bridge.php');

// Cache for module objects
const moduleCache = new Map();

// Mapping from JS method names to PHP Spider method names
const methodMapping = {
    'init': 'init',
    'home': 'homeContent',
    'homeVod': 'homeVideoContent',
    'category': 'categoryContent',
    'detail': 'detailContent',
    'search': 'searchContent',
    'play': 'playerContent',
    'proxy': 'proxy', // Not standard in BaseSpider, but might exist
    'action': 'action' // Not standard
};

// Helper to stringify args for CLI
function stringify(arg) {
    if (arg === undefined) return 'null';
    return JSON.stringify(arg);
}

// Helper to parse JSON output
function json2Object(json) {
    if (!json) return {};
    if (typeof json === 'object') return json;
    try {
        return JSON.parse(json);
    } catch (e) {
        return json;
    }
}

// Execute PHP bridge
const callPhpMethod = async (filePath, methodName, env, ...args) => {
    let phpPath = process.env.PHP_PATH || 'php';
    
    const validPath = prepareBinary(phpPath);
    if (!validPath) {
         throw new Error(`PHP executable not found or invalid: ${phpPath}`);
    }
    phpPath = validPath;

    const phpMethodName = methodMapping[methodName] || methodName;

    const cliArgs = [
        _bridge_path,
        filePath,
        phpMethodName,
        JSON.stringify(env),
        ...args.map(stringify)
    ];

    try {
        // fastify.log.info(`Calling PHP: ${phpPath} ${cliArgs.join(' ')}`);
        const {stdout, stderr} = await execFileAsync(phpPath, cliArgs, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8', // Just in case
                // Add any PHP specific env vars if needed
            }
        });

        if (stderr) {
            // Log stderr but don't fail immediately unless stdout is empty or error
            // fastify.log.warn(`PHP Stderr: ${stderr}`);
            console.error(`PHP Stderr: ${stderr}`);
        }

        const result = json2Object(stdout.trim());

        if (result && result.error) {
            throw new Error(`PHP Error: ${result.error}\nTrace: ${result.traceback}`);
        }

        return result;

    } catch (error) {
        console.error(`Error calling PHP method ${methodName}:`, error);
        throw error;
    }
};

const loadEsmWithHash = async function (filePath, fileHash, env) {
    const spiderProxy = {};
    const spiderMethods = Object.keys(methodMapping);

    spiderMethods.forEach(method => {
        spiderProxy[method] = async (...args) => {
            return callPhpMethod(filePath, method, env, ...args);
        };
    });

    return spiderProxy;
};

const init = async function (filePath, env = {}, refresh) {
    try {
        const fileContent = await readFile(filePath, 'utf-8');
        const fileHash = computeHash(fileContent);
        const moduleName = path.basename(filePath, '.php'); // .php extension
        let moduleExt = env.ext || '';

        // Logic for SitesMap and moduleExt (similar to hipy.js)
        let SitesMap = getSitesMap(_config_path);
        if (moduleExt && SitesMap[moduleName]) {
            // ... logic for compressed ext ...
            // Simplified for now, assuming plain string or handled by caller
        }

        let hashMd5 = md5(filePath + '#php#' + moduleExt);

        if (moduleCache.has(hashMd5) && !refresh) {
            const cached = moduleCache.get(hashMd5);
            if (cached.hash === fileHash) {
                return cached.moduleObject;
            }
        }

        fastify.log.info(`Loading PHP module: ${filePath}`);
        let t1 = getNowTime();

        const module = await loadEsmWithHash(filePath, fileHash, env);
        const rule = module;

        // Initialize the spider
        const initValue = await rule.init(moduleExt) || {};

        let t2 = getNowTime();
        const moduleObject = deepCopy(rule);
        moduleObject.cost = t2 - t1;

        moduleCache.set(hashMd5, {moduleObject, hash: fileHash});
        return {...moduleObject, ...initValue};

    } catch (error) {
        fastify.log.error(`Error in php.init :${filePath}`, error);
        throw new Error(`Failed to initialize PHP module:${error.message}`);
    }
};

const getRule = async function (filePath, env) {
    const moduleObject = await init(filePath, env);
    return JSON.stringify(moduleObject);
};

const home = async function (filePath, env, filter = 1) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.home(filter));
};

const homeVod = async function (filePath, env) {
    const moduleObject = await init(filePath, env);
    const homeVodResult = json2Object(await moduleObject.homeVod());
    return homeVodResult && homeVodResult.list ? homeVodResult.list : homeVodResult;
};

const category = async function (filePath, env, tid, pg = 1, filter = 1, extend = {}) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.category(tid, pg, filter, extend));
};

const detail = async function (filePath, env, ids) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.detail(ids));
};

const search = async function (filePath, env, wd, quick = 0, pg = 1) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.search(wd, quick, pg));
};

const play = async function (filePath, env, flag, id, flags) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.play(flag, id, flags));
};

const proxy = async function (filePath, env, params) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.proxy(params));
};

const action = async function (filePath, env, action, value) {
    const moduleObject = await init(filePath, env);
    return json2Object(await moduleObject.action(action, value));
};

export default {
    getRule,
    init,
    home,
    homeVod,
    category,
    detail,
    search,
    play,
    proxy,
    action
};
