import {logError, logWarn} from '../utils/log.js';
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'fs';
import path from 'path';
import {validateBasicAuth} from "../utils/api_validate.js";

/**
 * Source Checker 相关路由
 * 提供源检测器的配置获取和报告保存功能
 */
export default (fastify, options, done) => {

    // 获取系统默认配置地址
    fastify.get('/source-checker/config/default', {
        preHandler: validateBasicAuth
    }, async (request, reply) => {
        try {
            const protocol = request.protocol;
            const host = request.headers.host;
            const pwd = process.env.API_PWD || '';
            const configUrl = `${protocol}://${host}/config/1?sub=all&healthy=0&pwd=${pwd}`;

            return {
                success: true,
                configUrl: configUrl,
                message: '获取默认配置地址成功'
            };
        } catch (error) {
            return reply.code(500).send({
                success: false,
                message: '获取默认配置地址失败',
                error: error.message
            });
        }
    });

    // 保存检测报告接口
    fastify.post('/source-checker/reports/save', {preHandler: validateBasicAuth}, async (request, reply) => {
        try {
            const reportData = request.body;

            // 验证报告数据结构
            if (!reportData || !reportData.configUrl || !reportData.sources) {
                return reply.code(400).send({
                    success: false,
                    message: '报告数据格式不正确，缺少必要字段'
                });
            }

            // 生成本服务器的默认配置地址
            const protocol = request.protocol;
            const host = request.headers.host;
            const pwd = process.env.API_PWD || '';
            const serverConfigUrl = `${protocol}://${host}/config/1?sub=all&healthy=0&pwd=${pwd}`;

            // 同源验证：检查报告的配置地址是否与本服务器一致
            const reportConfigUrl = reportData.configUrl.trim();
            if (reportConfigUrl !== serverConfigUrl) {
                // 记录非同源保存尝试
                logWarn(`[Source-Checker] 检测到非同源报告保存尝试:`);
                logWarn(`  报告配置地址: ${reportConfigUrl}`);
                logWarn(`  服务器配置地址: ${serverConfigUrl}`);
                logWarn(`  客户端IP: ${request.ip}`);

                // 允许保存但添加警告标记
                reportData._warning = {
                    message: '此报告来源于非本服务器配置',
                    reportConfigUrl: reportConfigUrl,
                    serverConfigUrl: serverConfigUrl,
                    saveTime: new Date().toISOString()
                };
            }

            // 确保目录存在
            const reportDir = path.join(options.rootDir, 'data', 'source-checker');
            if (!existsSync(reportDir)) {
                mkdirSync(reportDir, {recursive: true});
            }

            // 保存报告文件
            const reportPath = path.join(reportDir, 'report.json');
            writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');

            // 返回成功响应
            const response = {
                success: true,
                message: '检测报告保存成功',
                path: reportPath,
                timestamp: new Date().toISOString()
            };

            // 如果是非同源报告，添加警告信息
            if (reportData._warning) {
                response.warning = '报告来源于非本服务器配置，已标记保存';
            }

            reply.send(response);

        } catch (error) {
            logError('[Source-Checker] 保存报告失败:', error);
            reply.status(500).send({
                success: false,
                message: '保存报告失败',
                error: error.message
            });
        }
    });

    // 获取检测报告接口（可选，用于查看已保存的报告）
    fastify.get('/source-checker/reports/latest', {preHandler: validateBasicAuth}, async (request, reply) => {
        try {
            const reportPath = path.join(options.rootDir, 'data', 'source-checker', 'report.json');

            if (!existsSync(reportPath)) {
                reply.status(404).send({
                    success: false,
                    error: 'Report not found'
                });
                return;
            }

            const reportContent = readFileSync(reportPath, 'utf-8');
            const reportData = JSON.parse(reportContent);

            reply.send({
                success: true,
                data: reportData
            });
        } catch (error) {
            reply.status(500).send({
                success: false,
                error: 'Failed to read report',
                details: error.message
            });
        }
    });

    done();
};