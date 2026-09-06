/**
 * 插件子进程运行时注册表（进程内单例）
 *
 * index.js 原本用局部变量 pluginProcs 持有插件进程句柄，管理 API 无法触达；
 * 抽到独立模块后，pluginManager（启动/停止）与 admin 控制器（运行时启停/状态查询）共享同一份数据。
 *
 * procs: key -> { proc, name, startedAt }，进程退出后条目自动移除
 * lastExit: name -> { code, signal, at }，最近一次退出信息（含启动失败），供状态展示
 */
export const registry = {
    procs: {},
    lastExit: {}
};

export function setProc(key, proc, name) {
    registry.procs[key] = {proc, name, startedAt: Date.now()};
    proc.once('exit', (code, signal) => {
        const entry = registry.procs[key];
        if (entry) {
            registry.lastExit[entry.name] = {code, signal, at: Date.now()};
            delete registry.procs[key];
        }
    });
}

export function findEntryByName(name) {
    for (const entry of Object.values(registry.procs)) {
        if (entry.name === name) return entry;
    }
    return null;
}

export function isRunning(name) {
    return !!findEntryByName(name);
}

/**
 * 返回当前存活插件的运行状态：name -> { key, pid, running, startedAt }
 */
export function getRuntimeStatus() {
    const status = {};
    for (const [key, entry] of Object.entries(registry.procs)) {
        if (entry.proc.exitCode == null && entry.proc.signalCode == null) {
            status[entry.name] = {key, pid: entry.proc.pid, running: true, startedAt: entry.startedAt};
        }
    }
    return status;
}
