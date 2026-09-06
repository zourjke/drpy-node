/**
 * DeepSeek AI 客户端 - DeepSeek 接口封装
 *
 * P2 重构：逻辑收编至 utils/ai/base-chat.js 的 BaseOpenAICompatChat，
 * 本文件仅保留渠道差异参数（默认 baseURL/model 与展示名）。
 *
 * 相关链接：
 * - API Keys: https://platform.deepseek.com/api_keys
 */

import {BaseOpenAICompatChat} from './base-chat.js';

class DeepSeek extends BaseOpenAICompatChat {
    /**
     * @param {Object} config - 配置对象
     * @param {string} config.apiKey - DeepSeek AI 的 API 密钥（必需）
     * @param {string} [config.baseURL='https://api.deepseek.com'] - API 基础地址
     */
    constructor({apiKey, baseURL}) {
        super({
            apiKey: apiKey,
            baseURL: baseURL || 'https://api.deepseek.com',
            defaultModel: 'deepseek-chat',
            name: 'DeepSeek AI'
        });
    }
}

export default DeepSeek;
