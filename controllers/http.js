/**import {log, logError} from '../utils/log.js';

 * HTTP请求代理控制器模块
 * 提供HTTP请求代理、AI接口和请求转发功能
 * @module http-controller
 */

import {ENV} from '../utils/env.js';
import {keysToLowerCase} from '../utils/utils.js';
import createAxiosInstance from "../utils/createAxiosAgent.js";

// 最大连接数配置
const maxSockets = 64;
// 创建axios实例
const _axios = createAxiosInstance({maxSockets: maxSockets});

/**
 * HTTP控制器插件
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 插件选项
 * @param {Function} done - 完成回调
 */
export default (fastify, options, done) => {
    /**
     * HTTP代理请求接口
     * POST /http - 代理HTTP请求
     */
    fastify.post('/http', async (req, reply) => {
        // 解构请求参数
        const {
            url,
            headers: userHeaders = {},
            params = {},
            method = 'GET',
            data = {},
            responseType,
            maxRedirects
        } = req.body;
        
        // 验证必需参数
        if (!url) {
            return reply.status(400).send({error: 'Missing required field: url'});
        }
        
        // 处理请求头，转换为小写
        const headers = keysToLowerCase({
            ...userHeaders,
        });
        
        // 添加accept属性防止获取网页源码编码不正确问题
        if (!Object.keys(headers).includes('accept')) {
            headers['accept'] = '*/*';
        }
        
        // 记录请求日志
        log(`[httpController] url: ${url} | method: ${method} | params: ${JSON.stringify(params)} | data: ${JSON.stringify(data)} | headers: ${JSON.stringify(headers)}`);
        
        try {
            // 发送HTTP请求
            const response = await _axios({
                url,
                method,
                headers,
                responseType,
                maxRedirects,
                params,
                data,
            });

            // 处理成功响应
            if (response.status >= 200 && response.status < 400) {
                reply.status(response.status).send({
                    status: response.status,
                    headers: response.headers,
                    data: response.data,
                });
            } else {
                // 处理非成功状态码
                reply.status(response.status).send({
                    status: 200,
                    headers: response.headers,
                    data: '',
                });
            }
        } catch (error) {
            // 处理请求错误
            // logError(error);
            if (error.response) {
                // 服务器返回了非 2xx 状态码
                reply.status(error.response.status).send({
                    error: error.response.data,
                    headers: error.response.headers,
                    status: error.response.status,
                });
            } else {
                // 请求失败或其他错误（网络错误、超时等）
                reply.status(500).send({error: error.message});
            }
        }
    });

    /**
     * AI聊天接口
     * GET /ai - 提供AI对话功能
     */
    fastify.get('/ai', async (request, reply) => {
        // 获取用户输入文本
        const userInput = request.query.text;

        // 验证输入参数
        if (!userInput || userInput.trim() === '') {
            return reply.status(400).send({error: '请提供文本内容'});
        }

        // 构建AI请求参数
        const postFields = {
            messages: [
                {role: 'user', content: userInput}
            ],
            model: 'gpt-4o-mini-2024-07-18'
        };
        // log(JSON.stringify(postFields));
        try {
            // 发送AI请求
            const response = await _axios.post(
                'https://api.s01s.cn/API/ai_zdy/?type=2',
                postFields,
                {
                    headers: {'Content-Type': 'application/json'},
                    timeout: 30000, // 30秒超时
                }
            );

            // 返回AI响应结果
            return reply.send(response.data);
        } catch (error) {
            // 处理AI请求错误
            fastify.log.error('Error:', error.message);
            return reply.status(500).send({error: '请求失败，请稍后重试'});
        }
    });

    /**
     * 请求转发接口
     * ALL /req/* - 转发HTTP请求到指定URL
     */
    fastify.all('/req/*', async (request, reply) => {
        // 非VERCEL环境可在设置中心控制此功能是否开启
        if (!process.env.VERCEL) {
            if (ENV.get('allow_forward') !== '1') {
                return reply.code(403).send({error: 'Forward api is not allowed by owner'});
            }
        }
        try {
            // 获取目标URL
            const targetUrl = request.params['*'];
            
            // 验证URL格式
            if (!/^https?:\/\//.test(targetUrl)) {
                return reply.code(400).send({error: 'Invalid URL. Must start with http:// or https://'});
            }
            
            // 记录转发日志
            log(`Forwarding request to: ${targetUrl}`);
            
            // 处理请求头
            const headers = keysToLowerCase({
                ...request.headers,
            });
            delete headers['host']; // 删除host头避免冲突
            
            // 添加accept属性防止获取网页源码编码不正确问题
            if (!Object.keys(headers).includes('accept')) {
                headers['accept'] = '*/*';
            }
            // 发送转发请求
            const response = await _axios({
                method: request.method,
                url: targetUrl,
                headers: headers,
                data: request.body,
                params: request.query,
                timeout: 10000, // 10秒超时
            });

            // 返回转发响应
            reply
                .code(response.status)
                .headers(response.headers)
                .send(response.data);
        } catch (error) {
            // 处理转发错误
            logError('Error forwarding request:', error.message);
            if (error.response) {
                // 转发服务器响应错误
                reply
                    .code(error.response.status)
                    .headers(error.response.headers)
                    .send(error.response.data);
            } else {
                // 转发请求失败
                reply.code(500).send({error: `Internal Server Error:${error.message}`});
            }
        }
    });

    done();
};
