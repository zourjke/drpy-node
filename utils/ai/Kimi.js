/**
 * Kimi AI 客户端 - 月之暗面 Moonshot AI 接口封装
 *
 * P2 重构：逻辑收编至 utils/ai/base-chat.js 的 BaseOpenAICompatChat，
 * 本文件仅保留渠道差异参数（默认 baseURL/model 与展示名）。
 *
 * 相关链接：
 * - API Keys: https://platform.moonshot.cn/console/api-keys
 */

import {BaseOpenAICompatChat} from './base-chat.js';

class Kimi extends BaseOpenAICompatChat {
    /**
     * @param {Object} config - 配置对象
     * @param {string} config.apiKey - Moonshot AI 的 API 密钥（必需）
     * @param {string} [config.baseURL='https://api.moonshot.cn/v1'] - API 基础地址
     */
    constructor({apiKey, baseURL}) {
        super({
            apiKey,
            baseURL: baseURL || 'https://api.moonshot.cn/v1',
            defaultModel: 'moonshot-v1-8k',
            name: 'Kimi AI'
        });
    }
}

export default Kimi;
