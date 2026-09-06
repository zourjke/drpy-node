import {log} from './log.js';
/**
 * 杂项工具函数模块
 * 
 * 提供各种实用的工具函数，包括：
 * - 随机数生成和字符串生成
 * - 设备信息模拟
 * - URL处理和格式化
 * - 字符串处理和清理
 * - JSON解析和处理
 * 
 * @author drpy-node
 * @version 1.0.0
 */

// 字符集，用于生成随机字符串（包含字母和数字）
var charStr = 'abacdefghjklmnopqrstuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ0123456789';

/**
 * 生成指定范围内的随机整数
 * 
 * @param {number} min - 最小值（包含）
 * @param {number} max - 最大值（包含）
 * @returns {number} 随机整数
 * 
 * @example
 * rand(1, 10); // 返回1-10之间的随机整数
 */
export function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成指定长度的随机字符串
 * 
 * @param {number} len - 字符串长度
 * @param {boolean} withNum - 是否包含数字，默认为true
 * @param {boolean} onlyNum - 是否只包含数字，默认为false
 * @returns {string} 随机字符串
 * 
 * @example
 * randStr(8); // 生成8位包含字母和数字的随机字符串
 * randStr(6, false); // 生成6位只包含字母的随机字符串
 * randStr(4, true, true); // 生成4位只包含数字的随机字符串
 */
export function randStr(len, withNum, onlyNum) {
    var _str = '';
    let containsNum = withNum === undefined ? true : withNum;
    for (var i = 0; i < len; i++) {
        // 根据参数选择字符范围
        let idx = onlyNum ? rand(charStr.length - 10, charStr.length - 1) : rand(0, containsNum ? charStr.length - 1 : charStr.length - 11);
        _str += charStr[idx];
    }
    return _str;
}

/**
 * 生成随机UUID（格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）
 * 
 * @returns {string} 随机UUID字符串
 * 
 * @example
 * randUUID(); // 返回类似 "a1b2c3d4-e5f6-7890-abcd-ef1234567890" 的UUID
 */
export function randUUID() {
    return randStr(8).toLowerCase() + '-' + randStr(4).toLowerCase() + '-' + randStr(4).toLowerCase() + '-' + randStr(4).toLowerCase() + '-' + randStr(12).toLowerCase();
}

/**
 * 生成随机MAC地址（格式：XX:XX:XX:XX:XX:XX）
 * 
 * @returns {string} 随机MAC地址字符串
 * 
 * @example
 * randMAC(); // 返回类似 "A1:B2:C3:D4:E5:F6" 的MAC地址
 */
export function randMAC() {
    return randStr(2).toUpperCase() + ':' + randStr(2).toUpperCase() + ':' + randStr(2).toUpperCase() + ':' + randStr(2).toUpperCase() + ':' + randStr(2).toUpperCase() + ':' + randStr(2).toUpperCase();
}

// 设备品牌列表
const deviceBrands = ['Huawei', 'Xiaomi'];

// 设备型号列表，按品牌分组
const deviceModels = [
    // 华为设备型号列表（型号代码和显示名称成对出现）
    ['MHA-AL00', 'HUAWEI Mate 9', 'MHA-TL00', 'HUAWEI Mate 9', 'LON-AL00', 'HUAWEI Mate 9 Pro', 'ALP-AL00', 'HUAWEI Mate 10', 'ALP-TL00', 'HUAWEI Mate 10', 'BLA-AL00', 'HUAWEI Mate 10 Pro', 'BLA-TL00', 'HUAWEI Mate 10 Pro', 'HMA-AL00', 'HUAWEI Mate 20', 'HMA-TL00', 'HUAWEI Mate 20', 'LYA-AL00', 'HUAWEI Mate 20 Pro', 'LYA-AL10', 'HUAWEI Mate 20 Pro', 'LYA-TL00', 'HUAWEI Mate 20 Pro', 'EVR-AL00', 'HUAWEI Mate 20 X', 'EVR-TL00', 'HUAWEI Mate 20 X', 'EVR-AN00', 'HUAWEI Mate 20 X', 'TAS-AL00', 'HUAWEI Mate 30', 'TAS-TL00', 'HUAWEI Mate 30', 'TAS-AN00', 'HUAWEI Mate 30', 'TAS-TN00', 'HUAWEI Mate 30', 'LIO-AL00', 'HUAWEI Mate 30 Pro', 'LIO-TL00', 'HUAWEI Mate 30 Pro', 'LIO-AN00', 'HUAWEI Mate 30 Pro', 'LIO-TN00', 'HUAWEI Mate 30 Pro', 'LIO-AN00m', 'HUAWEI Mate 30E Pro', 'OCE-AN10', 'HUAWEI Mate 40', 'OCE-AN50', 'HUAWEI Mate 40E', 'OCE-AL50', 'HUAWEI Mate 40E', 'NOH-AN00', 'HUAWEI Mate 40 Pro', 'NOH-AN01', 'HUAWEI Mate 40 Pro', 'NOH-AL00', 'HUAWEI Mate 40 Pro', 'NOH-AL10', 'HUAWEI Mate 40 Pro', 'NOH-AN50', 'HUAWEI Mate 40E Pro', 'NOP-AN00', 'HUAWEI Mate 40 Pro', 'CET-AL00', 'HUAWEI Mate 50', 'CET-AL60', 'HUAWEI Mate 50E', 'DCO-AL00', 'HUAWEI Mate 50 Pro', 'TAH-AN00', 'HUAWEI Mate X', 'TAH-AN00m', 'HUAWEI Mate Xs', 'TET-AN00', 'HUAWEI Mate X2', 'TET-AN10', 'HUAWEI Mate X2', 'TET-AN50', 'HUAWEI Mate X2', 'TET-AL00', 'HUAWEI Mate X2', 'PAL-AL00', 'HUAWEI Mate Xs 2', 'PAL-AL10', 'HUAWEI Mate Xs 2', 'EVA-AL00', 'HUAWEI P9', 'EVA-AL10', 'HUAWEI P9', 'EVA-TL00', 'HUAWEI P9', 'EVA-DL00', 'HUAWEI P9', 'EVA-CL00', 'HUAWEI P9', 'VIE-AL10', 'HUAWEI P9 Plus', 'VTR-AL00', 'HUAWEI P10', 'VTR-TL00', 'HUAWEI P10', 'VKY-AL00', 'HUAWEI P10 Plus', 'VKY-TL00', 'HUAWEI P10 Plus', 'EML-AL00', 'HUAWEI P20', 'EML-TL00', 'HUAWEI P20', 'CLT-AL00', 'HUAWEI P20 Pro', 'CLT-AL01', 'HUAWEI P20 Pro', 'CLT-AL00l', 'HUAWEI P20 Pro', 'CLT-TL00', 'HUAWEI P20 Pro', 'CLT-TL01', 'HUAWEI P20 Pro', 'ELE-AL00', 'HUAWEI P30', 'ELE-TL00', 'HUAWEI P30', 'VOG-AL00', 'HUAWEI P30 Pro', 'VOG-AL10', 'HUAWEI P30 Pro', 'VOG-TL00', 'HUAWEI P30 Pro', 'ANA-AL00', 'HUAWEI P40', 'ANA-AN00', 'HUAWEI P40', 'ANA-TN00', 'HUAWEI P40', 'ELS-AN00', 'HUAWEI P40 Pro', 'ELS-TN00', 'HUAWEI P40 Pro', 'ELS-AN10', 'HUAWEI P40 Pro', 'ELS-TN10', 'HUAWEI P40 Pro', 'ABR-AL00', 'HUAWEI P50', 'ABR-AL80', 'HUAWEI P50', 'ABR-AL60', 'HUAWEI P50E', 'ABR-AL90', 'HUAWEI P50E', 'JAD-AL00', 'HUAWEI P50 Pro', 'JAD-AL80', 'HUAWEI P50 Pro', 'JAD-AL50', 'HUAWEI P50 Pro', 'JAD-AL60', 'HUAWEI P50 Pro', 'BAL-AL00', 'HUAWEI P50 Pocket', 'BAL-AL60', 'HUAWEI Pocket S', 'PIC-AL00', 'HUAWEI nova 2', 'PIC-TL00', 'HUAWEI nova 2', 'BAC-AL00', 'HUAWEI nova 2 Plus', 'BAC-TL00', 'HUAWEI nova 2 Plus', 'HWI-AL00', 'HUAWEI nova 2s', 'HWI-TL00', 'HUAWEI nova 2s', 'ANE-AL00', 'HUAWEI nova 3e', 'ANE-TL00', 'HUAWEI nova 3e', 'PAR-AL00', 'HUAWEI nova 3', 'PAR-TL00', 'HUAWEI nova 3', 'INE-AL00', 'HUAWEI nova 3i', 'INE-TL00', 'HUAWEI nova 3i', 'VCE-AL00', 'HUAWEI nova 4', 'VCE-TL00', 'HUAWEI nova 4', 'MAR-AL00', 'HUAWEI nova 4e', 'MAR-TL00', 'HUAWEI nova 4e', 'SEA-AL00', 'HUAWEI nova 5', 'SEA-TL00', 'HUAWEI nova 5', 'SEA-AL10', 'HUAWEI nova 5 Pro', 'SEA-TL10', 'HUAWEI nova 5 Pro', 'GLK-AL00', 'HUAWEI nova 5i', 'GLK-TL00', 'HUAWEI nova 5i', 'GLK-LX1U', 'HUAWEI nova 5i', 'SPN-TL00', 'HUAWEI nova 5i Pro', 'SPN-AL00', 'HUAWEI nova 5z', 'WLZ-AL10', 'HUAWEI nova 6', 'WLZ-AN00', 'HUAWEI nova 6', 'JNY-AL10', 'HUAWEI nova 6 SE', 'JNY-TL10', 'HUAWEI nova 6 SE', 'JEF-AN00', 'HUAWEI nova 7', 'JEF-AN20', 'HUAWEI nova 7', 'JEF-TN00', 'HUAWEI nova 7', 'JEF-TN20', 'HUAWEI nova 7', 'JER-AN10', 'HUAWEI nova 7 Pro', 'JER-AN20', 'HUAWEI nova 7 Pro', 'JER-TN10', 'HUAWEI nova 7 Pro', 'JER-TN20', 'HUAWEI nova 7 Pro', 'CDY-AN00', 'HUAWEI nova 7 SE', 'CDY-AN20', 'HUAWEI nova 7 SE', 'CDY-TN00', 'HUAWEI nova 7 SE', 'CDY-TN20', 'HUAWEI nova 7 SE', 'ANG-AN00', 'HUAWEI nova 8', 'BRQ-AN00', 'HUAWEI nova 8 Pro', 'BRQ-AL00', 'HUAWEI nova 8 Pro', 'JSC-AN00', 'HUAWEI nova 8 SE', 'JSC-TN00', 'HUAWEI nova 8 SE', 'JSC-AL50', 'HUAWEI nova 8 SE', 'NAM-AL00', 'HUAWEI nova 9', 'RTE-AL00', 'HUAWEI nova 9 Pro', 'JLN-AL00', 'HUAWEI nova 9 SE', 'NCO-AL00', 'HUAWEI nova 10', 'GLA-AL00', 'HUAWEI nova 10 Pro', 'CHA-AL80', 'HUAWEI nova 10z'],
    // 小米设备型号列表
    ['M2001J2C', 'Xiaomi 10', 'M2001J2G', 'Xiaomi 10', 'M2001J2I', 'Xiaomi 10', 'M2011K2C', 'Xiaomi 11', 'M2011K2G', 'Xiaomi 11', '2201123C', 'Xiaomi 12', '2201123G', 'Xiaomi 12', '2112123AC', 'Xiaomi 12X', '2112123AG', 'Xiaomi 12X', '2201122C', 'Xiaomi 12 Pro', '2201122G', 'Xiaomi 12 Pro'],
];

/**
 * 生成随机设备信息
 * 
 * @returns {Object} 包含品牌、型号、系统版本和构建ID的设备信息对象
 * @property {string} brand - 设备品牌
 * @property {string} model - 设备型号
 * @property {number} release - Android版本号
 * @property {string} buildId - 构建ID
 * 
 * @example
 * randDevice(); // 返回 {brand: "Huawei", model: "HUAWEI Mate 30", release: 10, buildId: "ABC12D"}
 */
export function randDevice() {
    let brandIdx = rand(0, deviceBrands.length - 1);
    let brand = deviceBrands[brandIdx];
    let modelIdx = rand(0, deviceModels[brandIdx].length / 2 - 1);
    let model = deviceModels[brandIdx][modelIdx * 2 + 1];
    let release = rand(8, 13); // Android版本8-13
    let buildId = randStr(3, false).toUpperCase() + rand(11, 99) + randStr(1, false).toUpperCase();
    return {
        brand: brand,
        model: model,
        release: release,
        buildId: buildId,
    };
}

/**
 * 生成带有随机ID的设备信息
 * 
 * @param {number} len - 设备ID的长度
 * @returns {Object} 包含设备信息和随机ID的对象
 * 
 * @example
 * randDeviceWithId(16); // 返回设备信息对象，额外包含16位随机ID
 */
export function randDeviceWithId(len) {
    let device = randDevice();
    device['id'] = randStr(len);
    return device;
}

// 常用User-Agent字符串常量
export const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 11; M2007J3SC Build/RKQ1.200826.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/77.0.3865.120 MQQBrowser/6.2 TBS/045714 Mobile Safari/537.36';
export const PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36';
export const UA = 'Mozilla/5.0';
export const UC_UA = 'Mozilla/5.0 (Linux; U; Android 9; zh-CN; MI 9 Build/PKQ1.181121.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.108 UCBrowser/12.5.5.1035 Mobile Safari/537.36';
export const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';
export const MAC_UA = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.81 Safari/537.36 SE 2.X MetaSr 1.0';

/**
 * 格式化播放URL名称
 * 
 * 清理播放URL名称，移除源URL和特殊字符
 * 
 * @param {string} src - 源URL
 * @param {string} name - 播放名称
 * @returns {string} 格式化后的播放名称
 * 
 * @example
 * formatPlayUrl('http://example.com', '《电影名称》http://example.com'); // 返回 "电影名称"
 */
export function formatPlayUrl(src, name) {
    if (src.trim() == name.trim()) {
        return name;
    }
    return name
        .trim()
        .replaceAll(src, '')                    // 移除源URL
        .replace(/<|>|《|》/g, '')              // 移除尖括号和书名号
        .replace(/\$|#/g, ' ')                  // 将$和#替换为空格
        .trim();
}

/**
 * 格式化播放URL名称（保留$后的内容）
 * 
 * 类似formatPlayUrl，但保留$符号及其后的内容
 * 
 * @param {string} src - 源URL
 * @param {string} name - 播放名称
 * @returns {string} 格式化后的播放名称
 * 
 * @example
 * formatPlayUrl2('http://example.com', '电影名称$高清'); // 返回 "电影名称$高清"
 */
export function formatPlayUrl2(src, name) {
    var idx = name.indexOf('$');
    if (idx <= 0) {
        return formatPlayUrl(src, name);
    }
    return formatPlayUrl(src, name.substring(0, idx)) + name.substring(idx);
}

/**
 * 清除HTML标签和实体
 * 
 * 移除字符串中的HTML标签、HTML实体和多余空格
 * 
 * @param {string} src - 包含HTML的源字符串
 * @returns {string} 清理后的纯文本字符串
 * 
 * @example
 * stripHtmlTag('<p>Hello &nbsp; World</p>'); // 返回 "Hello World"
 */
export function stripHtmlTag(src) {
    return src
        .replace(/<\/?[^>]+(>|$)/g, '')         // 移除HTML标签
        .replace(/&.{1,5};/g, '')               // 移除HTML实体
        .replace(/\s{2,}/g, ' ');               // 将多个空格替换为单个空格
}

/**
 * 修复相对URL为绝对URL
 * 
 * 将相对URL转换为基于base URL的绝对URL
 * 
 * @param {string} base - 基础URL
 * @param {string} src - 需要修复的URL
 * @returns {string} 修复后的绝对URL
 * 
 * @example
 * fixUrl('https://example.com', '/path/to/resource'); // 返回 "https://example.com/path/to/resource"
 * fixUrl('https://example.com', '//cdn.example.com/file'); // 返回 "https://cdn.example.com/file"
 */
export function fixUrl(base, src) {
    try {
        if (src.startsWith('//')) {
            // 处理协议相对URL
            let parse = new URL(base);
            let host = src.substring(2, src.indexOf('/', 2));
            if (!host.includes('.')) {
                // 如果不是域名，则是路径
                src = parse.protocol + '://' + parse.host + src.substring(1);
            } else {
                // 如果是域名，则添加协议
                src = parse.protocol + ':' + src;
            }
        } else if (!src.includes('://')) {
            // 处理相对路径
            let parse = new URL(base);
            src = parse.protocol + '://' + parse.host + src;
        }
    } catch (error) {
        // 忽略URL解析错误
    }
    return src;
}

/**
 * 解析JSON配置并构建请求对象
 * 
 * 从JSON配置中提取URL和请求头信息
 * 
 * @param {*} input - 输入参数（未使用）
 * @param {Object} json - JSON配置对象
 * @param {string} json.url - 请求URL
 * @param {Object} json.headers - 请求头对象
 * @param {string} json['user-agent'] - User-Agent字符串
 * @param {string} json.referer - Referer字符串
 * @returns {Object} 包含header和url的请求对象
 * 
 * @example
 * jsonParse(null, {
 *   url: '//example.com/api',
 *   'user-agent': 'Custom UA',
 *   referer: 'https://example.com'
 * }); // 返回 {header: {'User-Agent': 'Custom UA', 'Referer': 'https://example.com'}, url: 'https://example.com/api'}
 */
export function jsonParse(input, json) {
    try {
        let url = json.url || '';
        // 处理协议相对URL
        if (url.startsWith('//')) {
            url = 'https:' + url;
        }
        // 验证URL格式
        if (!url.startsWith('http')) {
            return {};
        }
        
        let headers = json['headers'] || {};
        
        // 处理User-Agent
        let ua = (json['user-agent'] || '').trim();
        if (ua.length > 0) {
            headers['User-Agent'] = ua;
        }
        
        // 处理Referer
        let referer = (json['referer'] || '').trim();
        if (referer.length > 0) {
            headers['Referer'] = referer;
        }
        
        return {
            header: headers,
            url: url,
        };
    } catch (error) {
        log(error);
    }
    return {};
}
