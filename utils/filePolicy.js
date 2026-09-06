import path from 'path';

/**
 * 文件管理策略（设计见 docs/file-manage-design.md）
 *
 * 三类判定收敛于此，前后端共用：
 * - 后端 filesController 读写删校验、listDirectory 返回 protected/editable/deletable 标记
 * - 前端 Files.vue 依据标记渲染 新建/编辑/删除 UI（零策略硬编码）
 *
 * 保护清单来源：git 跟踪的框架自带文件（发布包固化此数组；新增框架文件时同步更新）。
 */
export const PROTECTED_FILES = new Set([
    'package.json',
    'vercel.json',
    'config/env.json',
    'config/source-states.json',
    'config/filter_keywords.json',
    'config/market.json',
    'config/market-plugins.json',
    'config/player.json',
    'config/map.txt',
    'config/parses.conf',
    'json/App模板配置.json',
    'json/TG短剧频道.json',
    'json/TG频道配置.json',
    'json/alist.json',
    'json/ftp.json',
    'json/live2cms-mv.json',
    'json/live2cms-sc.json',
    'json/live2cms.json',
    'json/lives.jpg',
    'json/mv/1万部电影.txt',
    'json/mv/电影天堂.txt',
    'json/mv/索尼电影.txt',
    'json/tv/ipv6.m3u',
    'json/tv/live_1905.txt',
    'json/tv/live_cntv.txt',
    'json/tv/live_sc_unicom.m3u',
    'json/tv/live_sc_unicom.txt',
    'json/webdav.json',
    'json/webdav影视.json',
    'json/十六万歌曲.txt',
    'json/哔哩大全.json',
    'json/哔哩大杂烩.json',
    'json/哔哩少儿.json',
    'json/哔哩戏曲.json',
    'json/哔哩收藏.json',
    'json/哔哩教育.json',
    'json/域名配置.json',
    'json/采集2024静态.json',
    'json/采集2025静态.json',
    'json/采集2026静态.json',
    'json/采集[zy]静态.json',
    'json/采集[密]静态.json',
    'json/采集静态.json',
]);

const normalize = (relPath) => {
    let rel = String(relPath || '').replace(/\\/g, '/');
    try {
        rel = decodeURIComponent(rel);
    } catch {
        // 非法编码序列保留原值
    }
    return rel;
};

const isRootJson = (rel) => /^[^/]+\.json$/i.test(rel);
const isConfigJsJson = (rel) => /^config\/.+\.(js|json)$/i.test(rel);
const isJsonDirJson = (rel) => /^json\/.+/i.test(rel) && rel.toLowerCase().endsWith('.json');

// 可创建/编辑的目录与类型（docs/file-manage-design.md §2.1/§2.3）
const MANAGED_DIR_RE = [/^config\/.+\.(js|json|txt|m3u|conf)$/i, /^json\/.+\.(js|json|txt|m3u|conf)$/i]; // 仅 config 与 json 目录托管，根目录不开放
const MANAGED_EXTS = ['.json', '.js', '.txt', '.m3u', '.conf'];

const inManagedDir = (rel) => MANAGED_DIR_RE.some((re) => re.test(rel));
const hasManagedExt = (rel) => MANAGED_EXTS.includes(path.extname(rel).toLowerCase());

/** 新建文件白名单：config / json（递归）两类目录下，类型限 json|js|txt|m3u|conf；根目录不开放新建 */
export function isWritableCreatePath(relPath) {
    const rel = normalize(relPath);
    return inManagedDir(rel) && hasManagedExt(rel);
}

/** 新建类型不符的提示（区别于目录不允许） */
export function createTypeHint() {
    return `仅支持创建 ${MANAGED_EXTS.join(' / ')} 类型的文件`;
}

/** 框架保护文件（删除一律拒绝；json/ 下框架文件同时只读） */
export function isProtectedPath(relPath) {
    return PROTECTED_FILES.has(normalize(relPath));
}

/**
 * 修改判定：已存在文件的编辑许可。
 * - .txt / .m3u 数据文件（如 json/tv、json/mv 下的直播与影片清单）全局允许编辑
 * - 根目录 json 与 config 下 js/json：保护文件也可改（保护仅禁删，env.json/player.json 等本就是用户日常维护对象）
 * - json/ 下：框架 33 个中 json 类只读（txt/m3u 数据文件除外），仅用户自建 json 可改
 * - 白名单外的已存在文件（如 spider 源）返回 false——UI 不显示编辑入口；
 *   但 files/write 对「修改已存在文件」不收紧（源编辑器保存依赖此路径）
 */
export function isEditablePath(relPath) {
    const rel = normalize(relPath);
    if (/\.(txt|m3u|conf)$/i.test(rel)) return true;
    if (rel.startsWith('json/')) {
        return isJsonDirJson(rel) && !isProtectedPath(rel);
    }
    return isConfigJsJson(rel);
}

/** 删除判定：白名单范围内且非保护（index.json/custom.json 等生成缓存可删，下次 /config 自动重建） */
export function isDeletablePath(relPath) {
    const rel = normalize(relPath);
    if (isProtectedPath(rel)) return false;
    return isWritableCreatePath(rel);
}
