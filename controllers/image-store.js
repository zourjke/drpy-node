/**
 * 图片存储管理控制器
 * 
 * 功能：提供图片的上传、获取、删除、更新等RESTful API接口
 * 支持base64格式图片的内存存储和管理，包括过期清理和内存监控
 * 
 * @author drpy
 * @version 1.0.0
 */

import {imageManager} from '../utils/imageManager.js'

/**
 * Fastify插件导出
 * 注册图片管理相关的路由和处理器
 * 
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 插件配置选项
 * @param {Function} done - 插件注册完成回调
 */
export default (fastify, options, done) => {
    /**
     * 图片上传接口
     * POST /image/upload
     * 
     * 功能：接收base64格式的图片数据并存储到内存中
     * 需要基础认证，支持图片大小限制
     */
    fastify.post('/image/upload', {
        schema: {
            body: {
                type: 'object',
                required: ['imageId', 'base64Data'],
                properties: {
                    imageId: {type: 'string', minLength: 1, maxLength: 100}, // 图片唯一标识
                    base64Data: {type: 'string', minLength: 1}                // base64编码的图片数据
                }
            }
        }
    }, async (request, reply) => {
        try {
            const {imageId, base64Data} = request.body;

            // 检查图片大小限制 (默认500KB)
            const maxSize = options.MAX_IMAGE_SIZE || 0.5 * 1024 * 1024;
            const imageSize = Buffer.byteLength(base64Data, 'utf8');

            if (imageSize > maxSize) {
                return reply.status(400).send({
                    success: false,
                    message: `图片大小超过限制 (${(maxSize / 1024 / 1024).toFixed(1)}MB)`
                });
            }

            // 可以不检查，避免很多图片导致的浪费
            // 检查是否已存在
            // if (imageManager.getImage(imageId)) {
            //     return reply.status(409).send({
            //         success: false,
            //         message: '图片ID已存在，请使用不同的ID或先删除现有图片'
            //     });
            // }

            // 存储图片到内存
            const result = imageManager.storeImage(imageId, base64Data);

            return reply.send({
                success: true,
                message: '图片上传成功',
                data: result
            });

        } catch (error) {
            return reply.status(400).send({
                success: false,
                message: error.message
            });
        }
    });

    /**
     * 获取图片接口
     * GET /image/:imageId
     * 
     * 功能：根据图片ID获取图片数据，返回二进制图片内容
     * 支持浏览器缓存和适当的HTTP头设置
     */
    fastify.get('/image/:imageId', {
        config: {auth: 'public'}, // 图片对外展示（封面等），写操作仍走默认 Basic
        schema: {
            params: {
                type: 'object',
                properties: {
                    imageId: {type: 'string'} // 图片唯一标识
                },
                required: ['imageId']
            }
        }
    }, async (request, reply) => {
        try {
            const {imageId} = request.params;
            const imageInfo = imageManager.getImage(imageId);

            // 检查图片是否存在
            if (!imageInfo) {
                return reply.status(404).send({
                    success: false,
                    message: '图片不存在'
                });
            }

            // 解析base64数据为二进制缓冲区
            const {mimeType, buffer} = imageManager.parseBase64ToBuffer(imageInfo.data);

            // 设置响应头
            reply.header('Content-Type', `image/${mimeType}`);           // 设置MIME类型
            reply.header('Content-Length', buffer.length);               // 设置内容长度
            reply.header('Cache-Control', 'public, max-age=3600');       // 缓存1小时
            reply.header('Last-Modified', new Date(imageInfo.timestamp).toUTCString()); // 最后修改时间

            // 返回图片数据
            return reply.send(buffer);

        } catch (error) {
            return reply.status(500).send({
                success: false,
                message: '服务器错误: ' + error.message
            });
        }
    });

    /**
     * 获取图片列表接口
     * GET /image/list
     * 
     * 功能：获取所有已存储图片的列表信息
     * 返回图片ID、大小、时间戳等元数据
     */
    fastify.get('/image/list', async (request, reply) => {
        try {
            const images = imageManager.getAllImages();

            return reply.send({
                success: true,
                data: {
                    images: images,      // 图片列表
                    total: images.length // 图片总数
                }
            });

        } catch (error) {
            return reply.status(500).send({
                success: false,
                message: '服务器错误: ' + error.message
            });
        }
    });

    /**
     * 删除图片接口
     * DELETE /image/:imageId
     * 
     * 功能：根据图片ID删除指定图片
     * 需要基础认证，支持释放内存空间
     */
    fastify.delete('/image/:imageId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    imageId: {type: 'string'} // 图片唯一标识
                },
                required: ['imageId']
            }
        }
    }, async (request, reply) => {
        try {
            const {imageId} = request.params;

            // 尝试删除图片
            if (imageManager.deleteImage(imageId)) {
                return reply.send({
                    success: true,
                    message: '图片删除成功'
                });
            } else {
                return reply.status(404).send({
                    success: false,
                    message: '图片不存在'
                });
            }

        } catch (error) {
            return reply.status(500).send({
                success: false,
                message: '服务器错误: ' + error.message
            });
        }
    });

    /**
     * 获取内存使用情况接口
     * GET /image/memory
     * 
     * 功能：获取图片存储的内存使用统计信息
     * 包括图片数量、总内存占用等信息
     */
    fastify.get('/image/memory', async (request, reply) => {
        try {
            const usage = imageManager.getMemoryUsage();

            return reply.send({
                success: true,
                data: usage
            });

        } catch (error) {
            return reply.status(500).send({
                success: false,
                message: '服务器错误: ' + error.message
            });
        }
    });

    /**
     * 清理过期图片接口
     * POST /image/cleanup
     * 
     * 功能：清理超过指定时间的过期图片，释放内存空间
     * 需要基础认证，支持自定义过期时间
     */
    fastify.post('/image/cleanup', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    maxAge: {type: 'number', minimum: 1000} // 最大存活时间（毫秒），最小1秒
                }
            }
        }
    }, async (request, reply) => {
        try {
            const {maxAge} = request.body || {};
            const cleanedCount = imageManager.cleanExpiredImages(maxAge);

            return reply.send({
                success: true,
                message: `清理完成，删除了 ${cleanedCount} 张过期图片`,
                data: {
                    cleanedCount: cleanedCount,                              // 清理的图片数量
                    remainingCount: imageManager.getMemoryUsage().imageCount // 剩余图片数量
                }
            });

        } catch (error) {
            return reply.status(500).send({
                success: false,
                message: '服务器错误: ' + error.message
            });
        }
    });

    /**
     * 更新图片接口
     * PUT /image/:imageId
     * 
     * 功能：更新指定ID的图片数据
     * 需要基础认证，支持图片大小限制
     */
    fastify.put('/image/:imageId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    imageId: {type: 'string'} // 图片唯一标识
                },
                required: ['imageId']
            },
            body: {
                type: 'object',
                required: ['base64Data'],
                properties: {
                    base64Data: {type: 'string', minLength: 1} // base64编码的新图片数据
                }
            }
        }
    }, async (request, reply) => {
        try {
            const {imageId} = request.params;
            const {base64Data} = request.body;

            // 检查图片是否存在
            if (!imageManager.getImage(imageId)) {
                return reply.status(404).send({
                    success: false,
                    message: '图片不存在'
                });
            }

            // 检查图片大小限制
            const maxSize = options.MAX_IMAGE_SIZE || 0.5 * 1024 * 1024;
            const imageSize = Buffer.byteLength(base64Data, 'utf8');

            if (imageSize > maxSize) {
                return reply.status(400).send({
                    success: false,
                    message: `图片大小超过限制 (${(maxSize / 1024 / 1024).toFixed(1)}MB)`
                });
            }

            // 更新图片数据
            const result = imageManager.storeImage(imageId, base64Data);

            return reply.send({
                success: true,
                message: '图片更新成功',
                data: result
            });

        } catch (error) {
            return reply.status(400).send({
                success: false,
                message: error.message
            });
        }
    });

    done(); // 插件注册完成
};
