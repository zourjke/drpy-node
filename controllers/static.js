/**
 * 静态文件服务控制器
 *
 * 该模块负责配置和注册多个静态文件服务路径，为不同类型的资源提供HTTP访问接口。
 * 支持公共资源、应用程序、JSON配置、JavaScript脚本、Python脚本、CAT相关文件等多种资源类型。
 *
 * @module StaticController
 * @author drpy-node
 * @since 1.0.0
 */

import fastifyStatic from '@fastify/static';
import {addSPARoutes} from './fastify-spa-routes.js';

/**
 * 静态文件服务插件
 *
 * 注册多个静态文件服务路径，每个路径对应不同的资源类型和用途。
 * 通过 @fastify/static 插件实现高效的静态文件服务。
 *
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 配置选项对象
 * @param {string} options.publicDir - 公共资源目录路径
 * @param {string} options.appsDir - 应用程序目录路径
 * @param {string} options.jsonDir - JSON配置文件目录路径
 * @param {string} options.dr2Dir - JavaScript脚本目录路径
 * @param {string} options.pyDir - Python脚本目录路径
 * @param {string} options.catDir - CAT相关文件目录路径
 * @param {string} options.catLibDir - CAT库文件目录路径
 * @param {string} options.xbpqDir - XBPQ相关文件目录路径
 * @param {Function} done - 插件注册完成回调函数
 */
export default (fastify, options, done) => {
    // 注册公共静态资源服务 - 用于存放通用的静态文件（CSS、JS、图片等）
    fastify.register(fastifyStatic, {
        root: options.publicDir,           // 静态文件根目录
        prefix: '/public/',               // URL访问前缀
    });

    // 注册应用程序静态资源服务 - 用于存放各种应用程序文件
    fastify.register(fastifyStatic, {
        root: options.appsDir,            // 应用程序文件根目录
        prefix: '/apps/',                 // URL访问前缀
        decorateReply: false,             // 禁用 sendFile 装饰器，避免冲突
    });

    fastify.register(addSPARoutes, {
        appsDir: options.appsDir,
        spaApps: ['drplayer', 'admin'] // 支持SPA路由的应用
    });

    // 注册JSON配置文件服务 - 用于存放各种JSON格式的配置文件
    fastify.register(fastifyStatic, {
        root: options.jsonDir,            // JSON文件根目录
        prefix: '/json/',                 // URL访问前缀
        decorateReply: false,             // 禁用 sendFile 装饰器
    });

    // 注册JavaScript脚本文件服务 - 用于存放drpy相关的JS脚本
    fastify.register(fastifyStatic, {
        root: options.dr2Dir,             // JavaScript脚本根目录
        prefix: '/js/',                   // URL访问前缀
        decorateReply: false,             // 禁用 sendFile 装饰器
        // setHeaders: (res, path) => {
        //     res.setHeader('Cache-Control', 'no-store'); // 禁用缓存确保每次获取最新
        // }
    });

    // 注册Python脚本文件服务 - 用于存放Python相关的脚本文件
    fastify.register(fastifyStatic, {
        root: options.pyDir,              // Python脚本根目录
        prefix: '/py/',                   // URL访问前缀
        decorateReply: false,             // 禁用 sendFile 装饰器
        setHeaders: (res, path) => {
            // 为Python文件设置正确的Content-Type，确保浏览器以纯文本形式显示
            if (path.endsWith('.py')) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            }
        }
    });

    // 注册PHP脚本文件服务 - 用于存放PHP相关的脚本文件
    fastify.register(fastifyStatic, {
        root: options.phpDir,             // PHP脚本根目录
        prefix: '/php/',                  // URL访问前缀
        decorateReply: false,             // 禁用 sendFile 装饰器
        setHeaders: (res, path) => {
            // 为PHP文件设置正确的Content-Type，确保浏览器以纯文本形式显示
            if (path.endsWith('.php')) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            }
        }
    });

    // 注册CAT相关文件服务 - 用于存放CAT视频源相关文件
    fastify.register(fastifyStatic, {
        root: options.catDir,             // CAT文件根目录
        prefix: '/cat/',                  // URL访问前缀
        decorateReply: false,             // 禁用 sendFile 装饰器
    });

    // 注册CAT库文件服务 - 用于存放CAT相关的库文件和依赖
    fastify.register(fastifyStatic, {
        root: options.catLibDir,          // CAT库文件根目录
        prefix: '/catLib/',               // URL访问前缀
        decorateReply: false,             // 禁用 sendFile 装饰器
    });

    // 注册XBPQ相关文件服务 - 用于存放XBPQ格式的视频源文件
    fastify.register(fastifyStatic, {
        root: options.xbpqDir,            // XBPQ文件根目录
        prefix: '/xbpq/',                 // URL访问前缀
        decorateReply: false,             // 禁用 sendFile 装饰器
    });

    // 调用完成回调，表示插件注册完成
    done();
}