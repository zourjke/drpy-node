import axios, {toFormData} from 'axios';
import axiosX from './axios.min.js';
import {createHttpsInstance, httpsAgent} from './fetchAxios.js';
import crypto from 'crypto';
import fs from 'fs';
import qs from 'qs';
import _ from './underscore-esm.min.js'
// import _ from './underscore-esm.js'
// import _ from 'underscore'
import tunnel from "tunnel";
import iconv from 'iconv-lite';
globalThis.iconv = iconv;
import * as cheerio from 'cheerio';
globalThis.cheerio = cheerio;
import {jsonpath, jsoup} from './htmlParser.js';
import hlsParser from './hls-parser.js'
import {keysToLowerCase} from '../utils/utils.js'
import {ENV} from '../utils/env.js';

// import {batchFetch1, batchFetch2, batchFetch3} from './drpyBatchFetch.js';
import {batchFetch3} from './hikerBatchFetch.js';
import createAxiosInstance from "../utils/createAxiosAgent.js";

globalThis.batchFetch = batchFetch3;
globalThis.axios = axios;
globalThis.axiosX = axiosX;
globalThis.hlsParser = hlsParser;
globalThis.qs = qs;

const maxSockets = 64;
const _axios = createAxiosInstance({maxSockets: maxSockets});
let $axios;
const dsReqLib = Number(process.env.DS_REQ_LIB) || 0;
console.log('[drpyInject]DS/CAT源底层req实现 DS_REQ_LIB (0 fetch 1 axios):', dsReqLib);
// 配置 axios 使用代理

if (dsReqLib === 0) {
    $axios = createHttpsInstance();
    // 请求拦截器
    $axios.useRequestInterceptor(RequestInterceptor, (error) => {
        return Promise.reject(error);
    });
} else {
    $axios = _axios;
    // 请求拦截器
    $axios.interceptors.request.use(RequestInterceptor, (error) => {
        return Promise.reject(error);
    });
}

function RequestInterceptor(config) {
    // 生成 curl 命令
    const show_curl = Number(ENV.get('show_curl', '0')) === 1;
    // console.log(`拦截器 show_curl: ${show_curl}`);
    const curlCommand = generateCurlCommand(config);
    if (show_curl) {
        console.log(`Generated cURL command:\n${curlCommand}`);
    }
    return config;
}

/**
 * 生成 curl 命令
 * @param {Object} config Axios 请求配置
 * @returns {string} curl 命令
 */
function generateCurlCommand(config) {
    const {method, url, headers, data} = config;
    let curlCommand = `curl -X ${method.toUpperCase()} '${url}'`;

    // 添加 headers
    if (headers) {
        for (const [key, value] of Object.entries(headers)) {
            curlCommand += ` -H '${key}: ${value}'`;
        }
    }

    // 添加 body 数据
    if (data) {
        if (typeof data === 'object') {
            curlCommand += ` -d '${JSON.stringify(data)}'`;
        } else {
            curlCommand += ` -d '${data}'`;
        }
    }

    return curlCommand;
}


const confs = {};

function initLocalStorage(storage) {
    if (!_.has(confs, storage)) {
        if (!fs.existsSync('local')) {
            fs.mkdirSync('local');
        }

        const storagePath = 'local/js_' + storage;

        if (!fs.existsSync(storagePath)) {
            fs.writeFileSync(storagePath, '{}');
            confs[storage] = {};
        } else {
            confs[storage] = JSON.parse(fs.readFileSync(storagePath).toString());
        }
    }
}

function localGet(storage, key) {
    initLocalStorage(storage);
    return _.get(confs[storage], key, '');
}

function localSet(storage, key, value) {
    initLocalStorage(storage);
    confs[storage][key] = value;
    fs.writeFileSync('local/js_' + storage, JSON.stringify(confs[storage]));
}

function localDelete(storage, key) {
    initLocalStorage(storage);
    delete confs[storage][key];
    fs.writeFileSync('local/js_' + storage, JSON.stringify(confs[storage]));
}

async function request(url, opt = {}) {
    // console.log('进入了req...');
    // 解构参数并设置默认值
    const {
        data: _data = null,
        body = '',
        postType = null,
        buffer: returnBuffer = 0,
        timeout = 5000,
        redirect = 1,
        encoding: userEncoding = '',
        headers: userHeaders = {},
        method = 'get',
        proxy = false,
        stream = null,
    } = opt;

    let data = body || _data;
    let encoding = userEncoding;

    // 设置默认 Content-Type
    const headers = keysToLowerCase({
        ...userHeaders,
        ...(postType === 'form' && {'Content-Type': 'application/x-www-form-urlencoded'}),
        ...(postType === 'form-data' && {'Content-Type': 'multipart/form-data'}),
    });

    // 添加accept属性防止获取网页源码编码不正确问题
    if (!Object.keys(headers).includes('accept')) {
        headers['accept'] = '*/*';
    }

    // 尝试从 Content-Type 中提取编码
    if (headers['content-type'] && /charset=(.*)/i.test(headers['content-type'])) {
        encoding = headers['content-type'].match(/charset=(.*)/i)[1];
    }

    // 根据 postType 处理数据
    // 如果没有明确指定 postType，尝试从 Content-Type 推断
    let effectivePostType = postType;
    if (!effectivePostType) {
        // 查找不区分大小写的 Content-Type 头
        const contentTypeKey = Object.keys(headers).find(key =>
            key.toLowerCase() === 'content-type'
        );

        if (contentTypeKey && headers[contentTypeKey]) {
            const contentType = headers[contentTypeKey].toLowerCase();
            if (contentType.includes('application/x-www-form-urlencoded')) {
                effectivePostType = 'form';
            } else if (contentType.includes('multipart/form-data')) {
                effectivePostType = 'form-data';
            }
        }
    }

    // 根据有效的 postType 处理数据
    if (effectivePostType === 'form' && data != null && typeof data === 'object') {
        data = qs.stringify(data, {encode: false});
    } else if (effectivePostType === 'form-data' && data != null && typeof data === 'object') {
        data = toFormData(data);
    }
    if (data) {
        console.log(`[req] postType:${effectivePostType},data:`, data);
    }

    // 配置代理或 HTTPS Agent
    // httpsAgent = new https.Agent({rejectUnauthorized: false});
    const agent = proxy ? tunnel.httpsOverHttp({proxy: {host: '127.0.0.1', port: 7890}}) : httpsAgent;

    // 设置响应类型为 arraybuffer，确保能正确处理编码
    const respType = returnBuffer ? 'arraybuffer' : 'arraybuffer';

    if (ENV.get('show_req', '0') === '1') {
        console.log(`req[${method}]: ${url} headers: ${JSON.stringify(headers)} data: ${JSON.stringify(data)}`);
    }
    try {
        // 发送请求
        const resp = await $axios({
            url: typeof url === 'object' ? url.url : url,
            method,
            headers,
            data,
            timeout,
            responseType: respType,
            maxRedirects: redirect ? undefined : 0,
            httpsAgent: agent,
        });

        let responseData = resp.data;

        // 构建响应头
        const resHeader = Object.fromEntries(
            Object.entries(resp.headers).map(([key, value]) => [key, Array.isArray(value) ? (value.length === 1 ? value[0] : value) : value])
        );

        // 解码逻辑
        if (!returnBuffer) {
            const buffer = Buffer.from(responseData);

            if (encoding && encoding.toLowerCase() !== 'utf-8') {
                // console.log('Detected encoding:', encoding);
                responseData = iconv.decode(buffer, encoding);
            } else {
                responseData = buffer.toString('utf-8');
            }
        } else if (returnBuffer === 1) {
            return {code: resp.status, headers: resHeader, content: responseData};
        } else if (returnBuffer === 2) {
            return {code: resp.status, headers: resHeader, content: Buffer.from(responseData).toString('base64')};
        } else if (returnBuffer === 3 && stream) {
            if (stream.onResp) await stream.onResp({code: resp.status, headers: resHeader});
            if (stream.onData) {
                responseData.on('data', async (chunk) => {
                    await stream.onData(chunk);
                });
                responseData.on('end', async () => {
                    if (stream.onDone) await stream.onDone();
                });
            } else if (stream.onDone) {
                await stream.onDone();
            }
            return 'stream...';
        }
        return {code: resp.status, headers: resHeader, content: responseData};
    } catch (error) {
        const {response: resp} = error;
        console.error(`[request] Request error: ${error.message}`);
        let responseData = '';
        // console.log('responseData:',responseData);
        try {
            const buffer = Buffer.from(resp.data);
            if (encoding && encoding.toLowerCase() !== 'utf-8') {
                // console.log('Detected encoding:', encoding);
                responseData = iconv.decode(buffer, encoding);
            } else {
                responseData = buffer.toString('utf-8');
            }
        } catch (e) {
            console.error(`[request] get error response Text failed: ${e.message}`);
        }
        // console.log('responseData:',responseData);
        return {
            code: resp?.status || 500,
            headers: resp?.headers || {},
            content: responseData || '',
        };
    }
}

function base64EncodeBuf(buff, urlsafe = false) {
    return buff.toString(urlsafe ? 'base64url' : 'base64');
}

function base64Encode(text, urlsafe = false) {
    return base64EncodeBuf(Buffer.from(text, 'utf8'), urlsafe);
}

function base64DecodeBuf(text) {
    return Buffer.from(text, 'base64');
}

function base64Decode(text) {
    return base64DecodeBuf(text).toString('utf8');
}

function responseBase64(data) {
    const buffer = Buffer.from(data, 'binary');
    return buffer.toString('base64');
}


function md5(text) {
    return crypto.createHash('md5').update(Buffer.from(text, 'utf8')).digest('hex');
}

function aes(mode, encrypt, input, inBase64, key, iv, outBase64) {
    if (iv.length == 0) iv = null;
    try {
        if (mode.startsWith('AES/CBC')) {
            switch (key.length) {
                case 16:
                    mode = 'aes-128-cbc';
                    break;
                case 32:
                    mode = 'aes-256-cbc';
                    break;
            }
        } else if (mode.startsWith('AES/ECB')) {
            switch (key.length) {
                case 16:
                    mode = 'aes-128-ecb';
                    break;
                case 32:
                    mode = 'aes-256-ecb';
                    break;
            }
        }
        const inBuf = inBase64 ? base64DecodeBuf(input) : Buffer.from(input, 'utf8');
        let keyBuf = Buffer.from(key);
        if (keyBuf.length < 16) keyBuf = Buffer.concat([keyBuf], 16);
        let ivBuf = iv == null ? Buffer.alloc(0) : Buffer.from(iv);
        if (iv != null && ivBuf.length < 16) ivBuf = Buffer.concat([ivBuf], 16);
        const cipher = encrypt ? crypto.createCipheriv(mode, keyBuf, ivBuf) : crypto.createDecipheriv(mode, keyBuf, ivBuf);
        const outBuf = Buffer.concat([cipher.update(inBuf), cipher.final()]);
        return outBase64 ? base64EncodeBuf(outBuf) : outBuf.toString('utf8');
    } catch (error) {
        console.log('[aes]', error);
    }
    return '';
}

function des(mode, encrypt, input, inBase64, key, iv, outBase64) {
    try {
        if (mode.startsWith('DESede/CBC')) {
            // https://stackoverflow.com/questions/29831300/convert-desede-ecb-nopadding-algorithm-written-in-java-into-nodejs-using-crypto
            switch (key.length) {
                case 16:
                    mode = 'des-ede-cbc';
                    break;
                case 24:
                    mode = 'des-ede3-cbc';
                    break;
            }
        }
        const inBuf = inBase64 ? base64DecodeBuf(input) : Buffer.from(input, 'utf8');
        let keyBuf = Buffer.from(key);
        if (keyBuf.length < 16) keyBuf = Buffer.concat([keyBuf], 16);
        let ivBuf = iv == null ? Buffer.alloc(0) : Buffer.from(iv);
        if (iv != null && ivBuf.length < 8) ivBuf = Buffer.concat([ivBuf], 8);
        const cipher = encrypt ? crypto.createCipheriv(mode, keyBuf, ivBuf) : crypto.createDecipheriv(mode, keyBuf, ivBuf);
        const outBuf = Buffer.concat([cipher.update(inBuf), cipher.final()]);
        return outBase64 ? base64EncodeBuf(outBuf) : outBuf.toString('utf8');
    } catch (error) {
        console.log('[des]', error);
    }
    return '';
}

// pkcs8 only
function rsa(mode, pub, encrypt, input, inBase64, key, outBase64) {
    try {
        let pd = undefined;
        const keyObj = pub ? crypto.createPublicKey(key) : crypto.createPrivateKey(key);
        if (!keyObj.asymmetricKeyDetails || !keyObj.asymmetricKeyDetails.modulusLength) return '';
        const moduleLen = keyObj.asymmetricKeyDetails.modulusLength;
        let blockLen = moduleLen / 8;
        switch (mode) {
            case 'RSA/PKCS1':
                pd = crypto.constants.RSA_PKCS1_PADDING;
                blockLen = encrypt ? blockLen - 11 : blockLen;
                break;
            case 'RSA/None/NoPadding':
                pd = crypto.constants.RSA_NO_PADDING;
                break;
            case 'RSA/None/OAEPPadding':
                pd = crypto.constants.RSA_PKCS1_OAEP_PADDING;
                blockLen = encrypt ? blockLen - 41 : blockLen;
                break;
            default:
                throw Error('not support ' + mode);
        }
        let inBuf = inBase64 ? base64DecodeBuf(input) : Buffer.from(input, 'utf8');
        let bufIdx = 0;
        let outBuf = Buffer.alloc(0);
        while (bufIdx < inBuf.length) {
            const bufEndIdx = Math.min(bufIdx + blockLen, inBuf.length);
            let tmpInBuf = inBuf.subarray(bufIdx, bufEndIdx);
            if (pd == crypto.constants.RSA_NO_PADDING) {
                if (tmpInBuf.length < blockLen) {
                    tmpInBuf = Buffer.concat([Buffer.alloc(128 - tmpInBuf.length), tmpInBuf]);
                }
            }
            let tmpBuf;
            if (pub) {
                tmpBuf = encrypt ? crypto.publicEncrypt({
                    key: keyObj, padding: pd
                }, tmpInBuf) : crypto.publicDecrypt({key: keyObj, padding: pd}, tmpInBuf);
            } else {
                tmpBuf = encrypt ? crypto.privateEncrypt({
                    key: keyObj, padding: pd
                }, tmpInBuf) : crypto.privateDecrypt({key: keyObj, padding: pd}, tmpInBuf);
            }
            bufIdx = bufEndIdx;
            outBuf = Buffer.concat([outBuf, tmpBuf]);
        }
        return outBase64 ? base64EncodeBuf(outBuf) : outBuf.toString('utf8');
    } catch (error) {
        console.log('[rsa]', error);
    }
    return '';
}

var charStr = 'abacdefghjklmnopqrstuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ0123456789';

function randStr(len, withNum) {
    var _str = '';
    let containsNum = withNum === undefined ? true : withNum;
    for (var i = 0; i < len; i++) {
        let idx = _.random(0, containsNum ? charStr.length - 1 : charStr.length - 11);
        _str += charStr[idx];
    }
    return _str;
}

globalThis.local = {
    get: function (storage, key) {
        return localGet(storage, key);
    }, set: function (storage, key, val) {
        localSet(storage, key, val);
    }, delete: function (storage, key) {
        localDelete(storage, key);
    }
};

globalThis.md5X = md5;
globalThis.rsaX = rsa;
globalThis.aesX = aes;
globalThis.desX = des;

globalThis.req = request;
globalThis.responseBase64 = responseBase64;


/**
 * Constructor for the JSProxyStream class.
 *
 * @constructor
 */
globalThis.JSProxyStream = function () {
    /**
     * Set proxy stream http code & headers
     *
     * @param {Number} code - http status code
     * @param {Map} headers - http response headers
     */
    this.head = async function (code, headers) {
    };
    /**
     * Writes the given buffer.
     *
     * @param {ArrayBuffer} buf - the buffer to write
     * @return {Number} 1 if the write was successful, 0 stream read is paused, -1 strean was closed
     */
    this.write = async function (buf) {
        return 1;
    };
    /**
     * Stream will be closed.
     */
    this.done = async function () {
    };
    /**
     * Stream will be closed cause by error happened.
     */
    this.error = async function (err) {
    };
};


/**
 * Creates a new JSFile object with the specified path.
 *
 * @param {string} path - The path to the file.
 * @return {JSFile} - The JSFile object.
 */
globalThis.JSFile = function (path) {
    this._path = path;
    this.fd = null;
    /**
     * Returns the raw path of the object.
     *
     * @return {string}  The raw path of the file. Runtime path is not same with _path.
     */
    this.path = async function () {
        return this._path;
    };
    /**
     * Opens a file with the specified mode.
     *
     * @param {string} mode - The mode in which to open the file. Can be 'r' for read, 'w' for write, or 'a' for append.
     * @return {boolean} Returns true if the file was successfully opened, false otherwise.
     */
    this.open = async function (mode) {
        const file = this;
        return await new Promise((resolve, reject) => {
            if (mode == 'w' || mode == 'a') {
                const directoryPath = dirname(file._path);
                if (!fs.existsSync(directoryPath)) {
                    fs.mkdirSync(directoryPath, {recursive: true});
                }
            }
            fs.open(file._path, mode, null, (e, f) => {
                if (!e) file.fd = f;
                if (file.fd) resolve(true); else resolve(false);
            });
        });
    };

    /**
     * Reads data from a file asynchronously.
     *
     * @param {number} length - The number of bytes to read.
     * @param {number} position - The position in the file to start reading from.
     * @return {ArrayBuffer} The data read from the file.
     */
    this.read = async function (length, position) {
        const file = this;
        return await new Promise((resolve, reject) => {
            let arraybuffer = new ArrayBuffer(length);
            let arr = new Int8Array(arraybuffer);
            fs.read(file.fd, arr, 0, length, position, (err, bytesRead, buffer) => {
                if (length > bytesRead) {
                    arraybuffer = buffer.slice(0, bytesRead).buffer;
                }
                resolve(arraybuffer);
            });
        });
    };

    /**
     * Writes data from an ArrayBuffer to a file at a given position.
     *
     * @param {ArrayBuffer} arraybuffer - The ArrayBuffer containing the data to write.
     * @param {number} position - The position within the file to start writing.
     * @return {boolean} Returns true if the write operation was successful.
     */
    this.write = async function (arraybuffer, position) {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.write(file.fd, new Int8Array(arraybuffer), 0, arraybuffer.byteLength, position, (err, written, buffer) => {
                if (!err) resolve(true); else resolve(false);
            });
        });
    };

    /**
     * Flush buffers to disk.
     */
    this.flush = async function () {
        return;
    };

    /**
     * Closes the file descriptor.
     *
     * @return {Promise<void>} A promise that resolves once the file descriptor is closed.
     */
    this.close = async function () {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.close(file.fd, (err) => {
                resolve();
            });
        });
    };

    /**
     * Moves the file to a new path.
     *
     * @param {string} newPath - The new path where the file will be moved.
     * @return {Promise<boolean>} A promise that resolves with `true` if the file was successfully moved, otherwise returns false.
     */
    this.move = async function (newPath) {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.rename(file._path, newPath, (err) => {
                if (!err) resolve(true); else resolve(false);
            });
        });
    };

    /**
     * Copies the file to a new path.
     *
     * @param {string} newPath - The path of the new location where the file will be copied.
     * @return {Promise<boolean>} A promise that resolves with `true` if the file is successfully copied, and `false` otherwise.
     */
    this.copy = async function (newPath) {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.copyFile(file._path, newPath, (err) => {
                if (!err) resolve(true); else resolve(false);
            });
        });
    };

    /**
     * Deletes the file associated with this object.
     *
     */
    this.delete = async function () {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.rm(file._path, (err) => {
                resolve();
            });
        });
    };

    /**
     * Checks if the file exists.
     *
     * @return {Promise<boolean>} A promise that resolves to a boolean value indicating whether the file exists or not.
     */
    this.exist = async function () {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.exists(file._path, (stat) => {
                resolve(stat);
            });
        });
    };

    /**
     * @returns the file length
     */
    this.size = async function () {
        const file = this;
        return await new Promise((resolve, reject) => {
            fs.stat(file._path, (err, stat) => {
                if (err) {
                    resolve(0);
                } else {
                    resolve(stat.size);
                }
            });
        });
    };
};

globalThis.js2Proxy = function (dynamic, siteType, site, url, headers) {
    let hd = Object.keys(headers).length == 0 ? '_' : encodeURIComponent(JSON.stringify(headers));
    return (dynamic ? 'js2p://_WEB_/' : 'http://127.0.0.1:13333/jp/') + randStr(6) + '/' + siteType + '/' + site + '/' + hd + '/' + encodeURIComponent(url);
};

globalThis.jsp = new jsoup();

globalThis.pdfh = (html, parse, base_url = '') => {
    const jsp = new jsoup(base_url);
    return jsp.pdfh(html, parse, base_url);
};

globalThis.pd = (html, parse, base_url = '') => {
    const jsp = new jsoup(base_url);
    return jsp.pd(html, parse);
};

globalThis.pdfa = (html, parse) => {
    const jsp = new jsoup();
    return jsp.pdfa(html, parse);
};

globalThis.pdfl = (html, parse, list_text, list_url, url_key) => {
    const jsp = new jsoup();
    return jsp.pdfl(html, parse, list_text, list_url, url_key);
};

globalThis.pq = (html) => {
    const jsp = new jsoup();
    return jsp.pq(html);
};

globalThis.pjfh = (html, parse, addUrl = false) => {
    const jsp = new jsoup();
    return jsp.pjfh(html, parse, addUrl);
};

globalThis.pj = (html, parse) => {
    const jsp = new jsoup();
    return jsp.pj(html, parse);
};

globalThis.pjfa = (html, parse) => {
    const jsp = new jsoup();
    return jsp.pjfa(html, parse);
};

globalThis.log = console.log;
globalThis.print = console.log;
globalThis.jsonpath = jsonpath;
globalThis.jsoup = jsoup;

// 将 JSON 对象转换为 cookie 字符串
function jsonToCookie(json) {
    return qs.stringify(json, {
        delimiter: ';',
        encoder: value => String(value).trim()
    });
}

// 将 cookie 字符串转换回 JSON 对象
function cookieToJson(cookieString) {
    return qs.parse(cookieString, {
        delimiter: ';',
        decoder: value => value.trim()
    });
}

globalThis.jsonToCookie = jsonToCookie;
globalThis.cookieToJson = cookieToJson;
globalThis.keysToLowerCase = keysToLowerCase;

class BaseSpider {
    constructor() {
        this.home = this.homeContent;
        this.category = this.categoryContent;
        // this.detail = this.detailContent;
        this.search = this.searchContent;
        this.play = this.playerContent;
        this.homeVod = this.homeVideoContent;
        this.proxy = this.localProxy;
        // this.fetch = request;
    }

    async fetch(url, options) {
        const resp = await req(url, options);
        return {
            ...resp,
            get data() { // data尝试返回object
                try {
                    return this.content.parseX;
                } catch (e) {
                    return {};
                }
            }
        };
    }

    async homeContent() {
    }

    async categoryContent() {
    }

    async detailContent() {
    }

    async searchContent() {
    }

    async playerContent() {
    }

    async homeVideoContent() {
    }

    async localProxy() {

    }

    async action() {

    }
}

globalThis.BaseSpider = BaseSpider;
export default {};
