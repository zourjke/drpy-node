/**
 * OpenAI 兼容对话基类 (P2 公共层抽取)
 *
 * 收编 utils/ai/Kimi.js、DeepSeek.js、SparkAI.js 三个 95% 逐字相同的实现：
 * 多用户上下文管理（上限 20 条）、chat/completions 调用与错误映射全部上移，
 * 子类仅需声明 {apiKey/authKey 归一后的参数} 与默认 baseURL/model。
 *
 * 行为契约与原三份实现一致：
 * - 缺失密钥抛 `Missing required configuration parameters.`
 * - 每用户上下文最多保留 system + 最近 19 条消息
 * - 响应无有效 choices 时抛 `Error from <name>: ...`
 * - axios HTTP 错误映射为 `<name> API Error (<status>): ...`
 */

import {log, logError} from '../log.js';
import axios from 'axios';

const DEFAULT_SYSTEM_PROMPT =
    '你是一名优秀的AI助手，知道最新的互联网内容，善用搜索引擎和github并总结最贴切的结论来回答我提出的每一个问题';

export class BaseOpenAICompatChat {
    /**
     * @param {Object} config
     * @param {string} config.apiKey - API 密钥（必需）
     * @param {string} config.baseURL - API 基础地址（不含尾斜杠）
     * @param {string} config.defaultModel - 默认模型名
     * @param {string} [config.name='AI'] - 展示名，用于日志与错误信息
     */
    constructor({apiKey, baseURL, defaultModel, name = 'AI'}) {
        if (!apiKey) {
            throw new Error('Missing required configuration parameters.');
        }
        this.apiKey = apiKey;
        this.baseURL = baseURL;
        this.defaultModel = defaultModel;
        this.name = name;
        /** @type {Object<string, Array>} 存储每个用户的对话上下文 */
        this.userContexts = {};
    }

    /**
     * 初始化用户上下文（已存在则跳过）
     * @param {string} userId
     */
    initUserContext(userId) {
        if (!this.userContexts[userId]) {
            this.userContexts[userId] = [
                {
                    role: 'system',
                    content: DEFAULT_SYSTEM_PROMPT
                }
            ];
        }
    }

    /**
     * 追加消息并维护上下文长度：保留系统消息 + 最近 19 条
     * @param {string} userId
     * @param {{role: string, content: string}} message
     */
    updateUserContext(userId, message) {
        this.userContexts[userId].push(message);

        if (this.userContexts[userId].length > 20) {
            const history = this.userContexts[userId];
            const systemMessage = history[0];
            const recentMessages = history.slice(-19);
            this.userContexts[userId] = [systemMessage, ...recentMessages];
        }
    }

    /**
     * 发送问题并获取回答
     * @param {string} userId - 用户唯一标识符
     * @param {string} prompt - 用户的问题或提示
     * @param {Object} [options={}] - model/temperature/max_tokens 等透传选项
     * @returns {Promise<string>} AI 的回答内容
     */
    async ask(userId, prompt, options = {}) {
        // 确保用户上下文已初始化
        this.initUserContext(userId);

        const payload = {
            model: options.model || this.defaultModel,
            messages: this.userContexts[userId].concat([
                {
                    role: 'user',
                    content: prompt
                }
            ]),
            ...options,
        };

        log(`${this.name} API Request Payload:`, payload);

        try {
            const response = await axios.post(`${this.baseURL}/chat/completions`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const assistantMessage = response.data.choices[0].message;

                this.updateUserContext(userId, assistantMessage);

                return assistantMessage.content;
            } else {
                throw new Error(
                    `Error from ${this.name}: ${response.data.error || 'No valid response received'}`
                );
            }
        } catch (error) {
            logError(`Error while communicating with ${this.name}:`, error.message);

            if (error.response) {
                const errorMsg = error.response.data?.error?.message || error.response.statusText;
                throw new Error(`${this.name} API Error (${error.response.status}): ${errorMsg}`);
            }

            throw error;
        }
    }
}

export default BaseOpenAICompatChat;
