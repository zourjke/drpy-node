import {log, logError} from '../log.js';
import WebSocket from 'ws';
import crypto from 'crypto';

class SparkAIBot {
    constructor(appId, uid, assistantId, apiKey) {
        if (!appId || !assistantId) {
            throw new Error('Missing required configuration parameters.');
        }
        this.appId = appId;
        this.uid = uid || '道长';
        this.assistantId = assistantId; // assistantId
        this.apiKey = apiKey; // API密钥
        this.wsUrl = `wss://spark-openapi.cn-huabei-1.xf-yun.com/v1/assistants/${assistantId}`; // 在构造函数中直接拼接完整的URL
        this.userContexts = {}; // 存储每个用户的上下文
    }

    // 生成签名
    generateSignature() {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = `${this.appId}${timestamp}${this.apiKey}`;
        const hash = crypto.createHash('sha256');
        hash.update(signature);
        return hash.digest('hex');
    }

    // 初始化用户上下文
    initUserContext(userId) {
        if (!this.userContexts[userId]) {
            this.userContexts[userId] = [
                {role: "system", content: "你是一名优秀的AI助手，知道最新的互联网内容，善用搜索引擎和github并总结最贴切的结论来回答我提出的每一个问题"}
            ];
        }
    }

    // 更新用户上下文
    updateUserContext(userId, message) {
        this.userContexts[userId].push(message);
        // 控制上下文长度，保留最新的20条消息
        if (this.userContexts[userId].length > 20) {
            this.userContexts[userId] = this.userContexts[userId].slice(-20);
        }
    }

    // 发起WebSocket连接
    connectToAssistant() {
        const ws = new WebSocket(this.wsUrl, {
            headers: {
                'x-signature': this.generateSignature(),
                'x-app-id': this.appId,
                // 'x-uid': this.uid
            }
        });

        ws.on('open', () => {
            // log('WebSocket connection established');
        });

        return ws;
    }

    // 发送请求数据
    sendMessage(ws, userId, prompt) {
        const requestPayload = {
            header: {
                app_id: this.appId,
                uid: userId
            },
            parameter: {
                chat: {
                    domain: 'general',
                    temperature: 0.5,
                    top_k: 4,
                    max_tokens: 2028
                }
            },
            payload: {
                message: {
                    text: this.userContexts[userId].concat([{role: 'user', content: prompt}])
                }
            }
        };

        ws.send(JSON.stringify(requestPayload));
    }

    // ask函数，传入用户ID、用户问题prompt，返回AI的完整回答
    ask(userId, prompt) {
        return new Promise((resolve, reject) => {
            this.initUserContext(userId);
            const ws = this.connectToAssistant();
            let fullResponse = '';  // 用于存储完整的文本响应

            // 收集返回的文本数据
            ws.on('message', (data) => {
                const response = JSON.parse(data);
                if (response && response.payload && response.payload.choices) {
                    response.payload.choices.text.forEach(choice => {
                        fullResponse += choice.content;  // 累加每个片段的文本内容
                    });
                }
            });

            // 发送消息并等待回应
            ws.on('open', () => {
                this.sendMessage(ws, userId, prompt);
            });

            // 在WebSocket关闭时返回完整的响应
            ws.on('close', () => {
                // log('WebSocket connection closed');
                this.updateUserContext(userId, {role: 'assistant', content: fullResponse});
                resolve(fullResponse);  // 返回完整的响应文本
            });

            // 处理错误
            ws.on('error', (error) => {
                logError('WebSocket error:', error);
                // 远端异常挂起时强杀连接，避免每次 ask 泄漏一条 WS 连接 (L23)
                try { ws.terminate(); } catch {}
                reject(error);  // 出现错误时，Promise 被拒绝
            });
        });
    }
}

// 从这里获取应用的两个参数 <url id="cu0o2589ma9tp8tp31s0" type="url" status="parsed" title="讯飞星火大模型-AI大语言模型-星火大模型-科大讯飞" wc="1799">https://xinghuo.xfyun.cn/botcenter/createbot</url>

/*
// 使用示例
const assistant = new SparkAIBot('6fafca91', '道长', 'tke24zrzq3f1_v1', 'your_api_key');

async function getWeather() {
    try {
        const response = await assistant.ask('user1', '你知道zyplayer吗？');
        log('AI Response:', response);  // 获取到的完整文本
    } catch (error) {
        logError('Error getting response:', error);
    }
}

getWeather();
*/

export default SparkAIBot;
