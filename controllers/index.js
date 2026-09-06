import formBody from '@fastify/formbody';
import websocket from '@fastify/websocket';
import websocketController from './websocket.js';
import staticController from './static.js';
import docsController from './docs.js';
import configController from './config.js';
import apiController from './api.js';
import mediaProxyController from './mediaProxy.js';
import rootController from './root.js';
import encoderController from './encoder.js';
import decoderController from './decoder.js';
import authcoderController from './authcoder.js';
import webController from './web.js';
import httpController from './http.js';
import clipboardPusherController from './clipboard-pusher.js';
// import taskerController from './tasker.js';
import clashProxyController from './clash-proxy.js';
import cronTaskerController from './cron-tasker.js';
import sourceCheckerController from './source-checker.js';
import imageStoreController from './image-store.js';
import webdavProxyController from './webdav-proxy.js';
import ftpProxyController from './ftp-proxy.js';
import fileProxyController from './file-proxy.js';
import m3u8ProxyController from './m3u8-proxy.js';
import unifiedProxyController from './unified-proxy.js';
import githubController from './github.js';
import websocketServerController from "./websocketServer.js";
import adminController from './admin.js';
import lxProxyController from './lx-proxy.js';
import captchaProxyController from './captcha-proxy.js';
import swaggerController from './swagger.js';

export const registerRoutes = (fastify, options) => {
    fastify.register(formBody);
    fastify.register(websocket);

    // swagger 必须先于业务路由注册：其文档收集依赖 onRoute 钩子，晚注册会错过已有路由
    fastify.register(swaggerController, options);

    fastify.register(websocketController, options);
    fastify.register(staticController, options);
    fastify.register(docsController, options);
    fastify.register(configController, options);
    fastify.register(apiController, options);
    fastify.register(mediaProxyController, options);
    fastify.register(rootController, options);
    fastify.register(encoderController, options);
    fastify.register(decoderController, options);
    fastify.register(authcoderController, options);
    fastify.register(webController, options);
    fastify.register(httpController, options);
    fastify.register(clipboardPusherController, options);
    // fastify.register(taskerController, options);
    fastify.register(clashProxyController, options);
    fastify.register(cronTaskerController, options);
    fastify.register(sourceCheckerController, options);
    fastify.register(imageStoreController, options);
    fastify.register(webdavProxyController, options);
    fastify.register(ftpProxyController, options);
    fastify.register(fileProxyController, options);
    fastify.register(m3u8ProxyController, options);
    fastify.register(unifiedProxyController, options);
    fastify.register(githubController, options);
    fastify.register(adminController, options);
    fastify.register(lxProxyController, options);
    fastify.register(captchaProxyController, options);
};

export const registerWsRoutes = (wsApp, options) => {
    wsApp.register(websocketServerController, options);
};
