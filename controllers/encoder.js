/**import {log} from '../utils/log.js';

 * 编码器控制器
 * 
 * 提供多种文本编码和加密功能的HTTP API接口。
 * 支持Base64编码、Gzip压缩、AES加密、RSA加密等多种编码方式。
 * 同时支持命令行模式，可以直接对文件进行Gzip压缩处理。
 * 
 * 支持的编码类型：
 * - base64: Base64编码
 * - gzip: Gzip压缩
 * - aes: AES对称加密
 * - rsa: RSA非对称加密
 * 
 * API接口：
 * POST /encoder - 对文本进行指定类型的编码处理
 * 
 * 命令行用法：
 * node encoder.js <文件路径> - 对指定文件进行Gzip压缩
 * 
 * @module EncoderController
 * @author drpy-node
 * @since 1.0.0
 */

import {jsEncoder} from '../libs_drpy/drpyCustom.js';
import {readFileSync, writeFileSync} from 'fs';

// 检测命令行参数，支持直接对文件进行编码处理
const args = process.argv.slice(2);

if (args.length > 0) {
    // 命令行模式：如果有参数，读取文件并进行Gzip压缩
    const filePath = args[0]; // 第一个参数作为文件路径
    let content = readFileSync(filePath, 'utf8');
    log(`文件 ${filePath} 的内容长度为:${content.length}`);
    // 将压缩后的内容写入到 .gz 扩展名的文件中
    writeFileSync(filePath + '.gz', jsEncoder.gzip(content), 'utf-8');
}

/**
 * 编码器Fastify插件
 * 
 * 注册编码器相关的HTTP路由，提供文本编码和加密服务。
 * 支持多种编码格式，包括Base64、Gzip、AES、RSA等。
 * 
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 配置选项
 * @param {number} options.MAX_TEXT_SIZE - 允许处理的最大文本大小（字节）
 * @param {Function} done - 插件注册完成回调函数
 */
export default (fastify, options, done) => {
    /**
     * POST /encoder - 文本编码接口
     * 
     * 接收JSON格式的请求体，对指定的文本内容进行编码处理。
     * 支持多种编码类型，并进行文本大小限制检查。
     * 
     * 请求体格式：{"type":"编码类型","code":"待编码文本"}
     * 
     * @route POST /encoder
     * @param {Object} request.body - 请求体
     * @param {string} request.body.code - 需要编码的文本内容
     * @param {string} request.body.type - 编码类型 (base64|gzip|aes|rsa)
     * @returns {Object} 编码结果
     * @returns {boolean} returns.success - 编码是否成功
     * @returns {string} returns.result - 编码后的结果
     * @returns {string} returns.error - 错误信息（失败时）
     */
    fastify.post('/encoder', async (request, reply) => {
        const {code, type} = request.body;

        // 参数验证：检查必需的参数是否存在
        if (!code || !type) {
            return reply.status(400).send({error: 'Missing required parameters: code and type'});
        }

        // 文本大小检查：防止处理过大的文本内容
        const textSize = Buffer.byteLength(code, 'utf8'); // 获取 UTF-8 编码的字节大小
        if (textSize > options.MAX_TEXT_SIZE) {
            return reply
                .status(400)
                .send({error: `Text content exceeds the maximum size of ${options.MAX_TEXT_SIZE / 1024} KB`});
        }

        try {
            let result;

            // 根据指定的编码类型进行相应的编码处理
            switch (type) {
                case 'base64':
                    // Base64编码：将文本转换为Base64格式
                    result = jsEncoder.base64Encode(code);
                    break;
                case 'gzip':
                    // Gzip压缩：对文本进行压缩处理
                    result = jsEncoder.gzip(code);
                    break;
                case 'aes':
                    // AES加密：使用AES算法进行对称加密
                    result = jsEncoder.aes_encrypt(code);
                    break;
                case 'rsa':
                    // RSA加密：使用RSA算法进行非对称加密
                    result = jsEncoder.rsa_encode(code);
                    break;
                default:
                    // 不支持的编码类型
                    throw new Error(`Unsupported type: ${type}`);
            }

            // 返回编码成功的结果
            reply.send({success: true, result});
        } catch (error) {
            // 捕获并返回编码过程中的错误
            reply.status(500).send({error: error.message});
        }
    });
    
    // 调用完成回调，表示插件注册完成
    done();
};
