import path from "path";
import {fileURLToPath} from "url";
import {existsSync, readFileSync, writeFileSync, unlinkSync} from "fs";
import {LRUCache} from "lru-cache";
import {fastify} from "../controllers/fastlogger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _envPath = path.join(__dirname, "../config/env.json");
const _lockPath = `${_envPath}.lock`;

// 创建 LRU 缓存实例
const cache = new LRUCache({
    max: 100, // 最大缓存条目数
    ttl: 1000 * 60 * 5, // 缓存时间（毫秒），例如 5 分钟
});

// 定义用于缓存整个对象的特殊键
const FULL_ENV_CACHE_KEY = "__FULL_ENV__";

export const ENV = {
    _envPath,
    _lockPath,
    _envObj: {},

    /**
     * 读取环境变量文件并解析为对象
     * @private
     * @returns {Object} 解析后的环境变量对象
     */
    _readEnvFile() {
        if (!existsSync(this._envPath)) {
            return {};
        }

        try {
            const content = readFileSync(this._envPath, "utf-8");
            return JSON.parse(content);
        } catch (e) {
            fastify.log.error(`[_readEnvFile] Failed to read or parse env file: ${e.message}`);
            return {};
        }
    },

    /**
     * 写入环境变量文件（带锁文件机制）
     * @private
     * @param {Object} envObj 环境变量对象
     */
    _writeEnvFile(envObj) {
        // 尝试创建锁文件
        if (existsSync(this._lockPath)) {
            fastify.log.error("[_writeEnvFile] Another process is currently writing to the env file.");
            throw new Error("File is locked. Please retry later.");
        }

        try {
            // 创建锁文件
            writeFileSync(this._lockPath, "LOCK", "utf-8");

            // 写入环境变量文件
            writeFileSync(this._envPath, JSON.stringify(envObj, null, 2), "utf-8");
        } catch (e) {
            fastify.log.error(`[_writeEnvFile] Failed to write to env file: ${e.message}`);
        } finally {
            // 移除锁文件
            if (existsSync(this._lockPath)) {
                unlinkSync(this._lockPath);
            }
        }
    },

    /**
     * 获取环境变量（支持缓存）
     * @param {string} [key] 可选，获取特定键的值或完整对象
     * @param _value 默认值
     * @param isObject 是否为对象格式，默认为0
     * @returns {string|Object} 环境变量值或完整对象
     */
    get(key, _value = '', isObject = 0) {
        if (!key) {
            // 不传参时获取整个对象
            if (cache.has(FULL_ENV_CACHE_KEY)) {
                return cache.get(FULL_ENV_CACHE_KEY);
            }

            const envObj = this._readEnvFile();
            cache.set(FULL_ENV_CACHE_KEY, envObj);
            return envObj;
        }

        // 传参时获取特定键
        if (cache.has(key)) {
            // console.log(`从内存缓存中读取: ${key}`);
            return cache.get(key);
        }
        // console.log(`[get] 从文件中读取: ${key}`);
        // fastify.log.info(`[get] 从文件中读取: ${key}`);
        const envObj = this._readEnvFile();
        let value = envObj[key] || _value;

        // 如果是对象格式，但value不是对象。则转换
        if (isObject && typeof value !== 'object') {
            try {
                value = JSON.parse(value);
            } catch (e) {
                value = {};
                fastify.log.error(`[get] Failed to parse value for key "${key}" as object: ${e.message}`);
            }
        }

        // 写入缓存
        cache.set(key, value);


        return value;
    },

    /**
     * 设置环境变量
     * @param {string} key 键名
     * @param {string|Object} [value=''] 键值
     * @param {number} [isObject=0] 是否为对象格式，默认为0
     */
    set(key, value = "", isObject = 0) {
        if (!key || typeof key !== "string") {
            throw new Error("Key must be a non-empty string.");
        }

        // 如果是对象格式，但value不是对象。则转换
        if (isObject && typeof value !== 'object') {
            try {
                value = JSON.parse(value);
            } catch (e) {
                value = {};
                fastify.log.error(`[set] Failed to parse value for key "${key}" as object: ${e.message}`);
            }
        }

        const envObj = this._readEnvFile();
        envObj[key] = value;
        this._writeEnvFile(envObj);

        // 清除对应键和整个对象的缓存
        cache.delete(key);
        cache.delete(FULL_ENV_CACHE_KEY);
    },

    /**
     * 删除环境变量
     * @param {string} key 键名
     */
    delete(key) {
        if (!key || typeof key !== "string") {
            throw new Error("Key must be a non-empty string.");
        }

        const envObj = this._readEnvFile();
        if (key in envObj) {
            delete envObj[key];
            this._writeEnvFile(envObj);

            // 清除对应键和整个对象的缓存
            cache.delete(key);
            cache.delete(FULL_ENV_CACHE_KEY);
        } else {
            fastify.log.warn(`[delete] Key "${key}" does not exist in env file.`);
        }
    },
};
