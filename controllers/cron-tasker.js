/**
 * 定时任务管理器模块
 * 负责管理和执行定时任务脚本，支持cron表达式调度
 * @module cron-tasker
 */

// cron-tasker.js（已修复）
import path from 'path';
import {readdir, stat} from 'fs/promises';
import {pathToFileURL} from 'url';
import {CronJob} from 'cron';
import {validateBasicAuth} from "../utils/api_validate.js"; // 官方 cron
import {toBeijingTime} from "../utils/datetime-format.js"

// 排除的脚本文件列表
const scripts_exclude = ['moontv.mjs', 'kzz.mjs'];
// 是否启用定时任务功能
const enable_tasker = Number(process.env.ENABLE_TASKER) || 0;

/**
 * 定时任务管理器插件
 * @param {Object} fastify - Fastify实例
 * @param {Object} options - 插件选项
 * @param {Function} done - 完成回调
 */
export default (fastify, options, done) => {
    // 配置对象
    const config = {
        scriptsDir: path.join(options.rootDir, 'scripts/cron'),
    };

    // 任务注册表
    const taskRegistry = new Map();
    
    /**
     * 格式化任务对象，用于API返回
     * @param {Object} task - 任务对象
     * @returns {Object} 格式化后的任务信息
     */
    const format_task_object = (task) => {
        return {
            name: task.name,
            path: task.path,
            schedule: task.schedule,
            lastRun: toBeijingTime(task.lastRun),
            nextRun: toBeijingTime(task.nextRun),
            status: task.status,
            // cronTask: task.cronTask,
        }
    };

    /**
     * 从CronJob对象获取下次运行时间
     * @param {Object} job - CronJob实例
     * @returns {Date|null} 下次运行时间
     */
    function getNextRunFromJob(job) {
        try {
            if (!job) return null;
            // 处理nextDate方法
            if (typeof job.nextDate === 'function') {
                const nd = job.nextDate();
                if (!nd) return null;
                if (nd instanceof Date) return nd;
                if (typeof nd.toJSDate === 'function') return nd.toJSDate();
                if (typeof nd.toDate === 'function') return nd.toDate();
                if (typeof nd.toISOString === 'function') return new Date(nd.toISOString());
                return new Date(nd);
            }
            // 处理nextDates方法
            if (typeof job.nextDates === 'function') {
                const arr = job.nextDates(1);
                const nd = Array.isArray(arr) ? arr[0] : arr;
                if (!nd) return null;
                if (nd instanceof Date) return nd;
                if (typeof nd.toJSDate === 'function') return nd.toJSDate();
                if (typeof nd.toDate === 'function') return nd.toDate();
                if (typeof nd.toISOString === 'function') return new Date(nd.toISOString());
                return new Date(nd);
            }
            return null;
        } catch (err) {
            return null;
        }
    }

    /**
     * 注册单个脚本文件为定时任务
     * @param {string} scriptPath - 脚本文件路径
     */
    async function registerScript(scriptPath) {
        try {
            fastify.log.info(`📝 Registering script: ${scriptPath}`);
            const scriptUrl = pathToFileURL(scriptPath).href;
            const module = await import(scriptUrl);
            const script = module.default || module;

            if (typeof script.run !== 'function') {
                fastify.log.warn(`⚠️ Script ${scriptPath} does not export a 'run' function`);
                return;
            }

            const scriptName = path.basename(scriptPath, path.extname(scriptPath));

            const taskInfo = {
                name: scriptName,
                path: scriptPath,
                run: script.run,
                schedule: script.schedule || null,
                lastRun: null,
                nextRun: null,
                status: 'pending',
                cronTask: null
            };

            // L20（防御）：注册前先停掉同名旧任务的 CronJob，避免未来引入"热加载脚本"
            // 能力时旧 Job 及其 context(fastify) 闭包被双份持有
            const existing = taskRegistry.get(scriptName);
            if (existing?.cronTask) {
                try {
                    existing.cronTask.stop();
                } catch {
                    // 旧任务已停止/已损坏时忽略
                }
            }
            taskRegistry.set(scriptName, taskInfo);

            if (script.schedule) {
                // 如果 schedule 是字符串（简洁写法）
                if (typeof script.schedule === 'string') {
                    fastify.log.info(`⏰ Scheduling ${scriptName} with cron: ${script.schedule}`);

                    // 支持 runOnInit 与 timezone
                    const timezone = (script.schedule && script.timezone) || undefined;
                    const runOnInit = !!(script.runOnInit); // 不常用，通常传 object 形式时才会出现

                    const startImmediately = true; // 默认启动

                    const job = new CronJob(
                        script.schedule,
                        async () => {
                            await runTask(scriptName);
                        },
                        null,            // onComplete
                        startImmediately,// start
                        timezone,        // timeZone
                        fastify,         // context
                        runOnInit        // runOnInit
                    );

                    taskInfo.cronTask = job;
                    taskInfo.nextRun = getNextRunFromJob(job);

                    // 如果 schedule 是对象（支持更多选项）
                } else if (typeof script.schedule === 'object' && script.schedule.cron) {
                    const userOpts = script.schedule.options || {};

                    const cronParams = {
                        cronTime: script.schedule.cron,
                        onTick: async () => {
                            await runTask(scriptName);
                        },
                        start: (typeof userOpts.scheduled !== 'undefined') ? !!userOpts.scheduled : true,
                        timeZone: script.schedule.timezone || userOpts.timeZone || 'UTC',
                        context: fastify,
                        runOnInit: (typeof script.schedule.runOnInit !== 'undefined') ? !!script.schedule.runOnInit : !!userOpts.runOnInit,
                        name: scriptName,
                        ...userOpts
                    };

                    fastify.log.info(`⏰ Scheduling ${scriptName} with cron: ${script.schedule.cron} (timezone: ${cronParams.timeZone})`);

                    // 使用 from() 并让 cronParams.start/runOnInit 决定初次行为；不要再额外 start()/stop()
                    const job = CronJob.from(cronParams);

                    taskInfo.cronTask = job;
                    taskInfo.nextRun = getNextRunFromJob(job);

                } else if (typeof script.schedule === 'function') {
                    fastify.log.info(`⏰ Registering custom scheduler for ${scriptName}`);
                    const updateNextRun = (date) => {
                        taskInfo.nextRun = date;
                    };
                    script.schedule(async () => {
                        await runTask(scriptName);
                    }, fastify, updateNextRun);
                }

                // **重要**：不再在这里手动调用 runTask(scriptName) 来处理 runOnInit
                // 如果 script.schedule.runOnInit 为 true，我们把它传给 CronJob 让库负责首次触发，
                // 否则如果你希望手动触发，可把 runOnInit 设为 false 并在脚本或外部触发。
            } else {
                fastify.log.info(`ℹ️ No schedule defined for ${scriptName}, manual execution only`);
            }

            taskInfo.status = 'registered';
        } catch (err) {
            fastify.log.error(`❌ Error registering script ${scriptPath}: ${err.message}`);
        }
    }

    /**
     * 执行指定的定时任务
     * @param {string} taskName - 任务名称
     */
    async function runTask(taskName) {
        const task = taskRegistry.get(taskName);
        if (!task) {
            fastify.log.error(`❌ Task not found: ${taskName}`);
            return;
        }

        try {
            task.lastRun = new Date();
            task.status = 'running';

            fastify.log.info(`🚀 Starting task: ${taskName}`);
            await task.run(fastify);

            task.status = 'success';
            fastify.log.info(`✅ Task completed: ${taskName}`);
        } catch (err) {
            task.status = 'failed';
            fastify.log.error(`❌ Task failed: ${taskName} ${err.message}`);
        }

        if (task.cronTask) {
            task.nextRun = getNextRunFromJob(task.cronTask);
        }
    }

    /**
     * 注册所有脚本目录下的定时任务脚本
     */
    async function registerAllScripts() {
        try {
            fastify.log.info('📂 Loading scripts...');
            const files = await readdir(config.scriptsDir);
            for (const file of files) {
                const filePath = path.join(config.scriptsDir, file);
                const fileStat = await stat(filePath);
                if (fileStat.isFile() && ['.mjs', '.js'].includes(path.extname(file)) && !scripts_exclude.includes(file)) {
                    await registerScript(filePath);
                }
            }
            fastify.log.info(`✅ Registered ${taskRegistry.size} tasks`);
        } catch (err) {
            fastify.log.error(`❌ Error loading scripts:${err.message}`);
        }
    }

    // API端点定义
    
    /**
     * 立即执行任务的API端点
     * GET /execute-now/:taskName? - 执行指定任务或所有任务
     */
    fastify.get('/execute-now/:taskName?', {preHandler: validateBasicAuth}, async (request, reply) => {
        const {taskName} = request.params;

        if (taskName) {
            // 执行单个任务
            if (!taskRegistry.has(taskName)) {
                return reply.status(404).send({
                    error: 'Task not found',
                    availableTasks: [...taskRegistry.keys()]
                });
            }

            await runTask(taskName);
            return {
                message: `Task "${taskName}" executed manually`,
                status: 'success',
                task: format_task_object(taskRegistry.get(taskName))
            };
        }

        // 执行所有任务
        for (const taskName of taskRegistry.keys()) {
            await runTask(taskName);
        }

        return {
            message: 'All tasks executed manually',
            status: 'success',
            tasks: [...taskRegistry.values()].map(t => t.name)
        };
    });

    /**
     * 获取所有任务列表的API端点
     * GET /tasks - 返回所有注册的任务信息
     */
    fastify.get('/tasks', {preHandler: validateBasicAuth}, async (request, reply) => {
        const tasks = [...taskRegistry.values()].map(task => (format_task_object(task)));

        return tasks;
    });

    /**
     * 获取指定任务信息的API端点
     * GET /tasks/:taskName - 返回指定任务的详细信息
     */
    fastify.get('/tasks/:taskName', {preHandler: validateBasicAuth}, async (request, reply) => {
        const {taskName} = request.params;

        if (!taskRegistry.has(taskName)) {
            return reply.status(404).send({
                error: 'Task not found',
                availableTasks: [...taskRegistry.keys()]
            });
        }

        const task = taskRegistry.get(taskName);
        return format_task_object(task);
    });

    /**
     * 应用关闭时的清理钩子
     * 停止所有正在运行的定时任务
     */
    fastify.addHook('onClose', async () => {
        fastify.log.info('🛑 Stopping all scheduled tasks...');
        for (const task of taskRegistry.values()) {
            if (task.cronTask && typeof task.cronTask.stop === 'function') {
                try {
                    task.cronTask.stop();
                    fastify.log.info(`⏹️ Stopped task: ${task.name}`);
                } catch (e) {
                    fastify.log.error(`❌ Failed stopping task ${task.name}: ${e.message}`);
                }
            }
        }
        taskRegistry.clear();
    });

    // 插件初始化
    // 如果启用了定时任务功能，则注册所有脚本
    (async () => {
        try {
            if (enable_tasker) await registerAllScripts();
            done();
        } catch (err) {
            fastify.log.error(`❌ Failed to register scripts:${err.message}`);
            done(err);
        }
    })();
};
