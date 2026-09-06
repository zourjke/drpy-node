/**
 * SparkAI 客户端 - 讯飞星火大模型接口封装
 *
 * P2 重构：逻辑收编至 utils/ai/base-chat.js 的 BaseOpenAICompatChat，
 * 本文件仅保留渠道差异参数（默认 baseURL/model 与展示名）。
 *
 * 相关链接：
 * - 控制台: https://xinghuo.xf-yun.com/sparkapi-center
 */

import {BaseOpenAICompatChat} from './base-chat.js';

class SparkAI extends BaseOpenAICompatChat {
    /**
     * @param {Object} config - 配置对象
     * @param {string} config.authKey - 讯飞星火的认证密钥（必需）
     * @param {string} [config.baseURL='https://spark-api-open.xf-yun.com'] - API 基础地址
     */
    constructor({authKey, baseURL}) {
        super({
            apiKey: authKey,
            baseURL: baseURL || 'https://spark-api-open.xf-yun.com',
            defaultModel: '4.0Ultra',
            name: 'Spark AI'
        });
        // 兼容旧属性名：历史实现以 authKey 暴露密钥字段
        this.authKey = authKey;
    }
}

export default SparkAI;
