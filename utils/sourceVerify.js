/**
 * 源接口全流程验证引擎（设计见 docs/source-verify-design.md）
 *
 * 对单个源真实走一遍协议链路：首页 → 分类 → 详情 → 搜索（→ 可选播放深度验证），
 * 服务端内部自调用 http://127.0.0.1:{port}/api/{module}?...，pwd 取 process.env.API_PWD。
 * 纯函数与 IO 分离：步骤编排/数据判定/评分在此收敛，HTTP 由 fetchStep 执行，均无状态可单测。
 */
import {matchSourceEngine} from './sourceState.js';

const NO_DATA_MARKS = ['no_data', '无数据,防无限请求'];

/** 引擎 → /api 路由的 do 参数映射（js 为缺省引擎不传 do；dr2 无 /api 路由） */
const ENGINE_DO = {py: 'py', php: 'php', catvod: 'cat'};

/**
 * 纯函数：从源相对路径解析流程验证所需的引擎信息
 * @returns {{supported: true, moduleName: string, engine: string, doParam: string|null}
 *          | {supported: false, reason: string}}
 */
export function resolveFlowTarget(relPath) {
    const m = matchSourceEngine(relPath);
    if (!m) return {supported: false, reason: '路径不在源目录内'};
    const moduleName = m.name.replace(/\.[^.]+$/, '');
    if (m.engine === 'dr2') {
        return {supported: false, reason: 'dr2 源经 enable_dr2 以 cat 形态分发，无独立 /api 路由，仅支持代码语法验证'};
    }
    if (m.name.startsWith('_')) return {supported: false, reason: '下划线开头的源不参与加载'};
    return {
        supported: true,
        moduleName,
        engine: m.engine,
        doParam: ENGINE_DO[m.engine] || null,
    };
}

/**
 * 纯函数：构造源 API 的请求 URL（module 与参数值均 URL 编码）
 * @param {string} base 形如 http://127.0.0.1:5757
 * @param {string} moduleName 模块名（源文件名去扩展名）
 * @param {string|null} doParam 引擎 do 参数（js 为 null）
 * @param {Object} params 查询参数（ac/t/ids/wd/play/flag 等）
 * @param {string} pwd 接口密码（未配置为空串）
 */
export function buildApiUrl(base, moduleName, doParam, params, pwd) {
    const url = new URL(`${base}/api/${encodeURIComponent(moduleName)}`);
    if (pwd) url.searchParams.set('pwd', pwd);
    if (doParam) url.searchParams.set('do', doParam);
    for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    return url.toString();
}

/**
 * 纯函数：分类/搜索/详情返回的数据有效性——list 为数组且存在有效项
 * （过滤 no_data / 「无数据,防无限请求」占位，与 source-checker 检测页同判定）
 */
export function isValidListData(data) {
    if (!data || !Array.isArray(data.list)) return false;
    return data.list.some(item =>
        item && String(item.vod_id) !== 'no_data' && item.vod_name !== '无数据,防无限请求'
    );
}

/** 纯函数：首页返回有效性——class 为非空数组 */
export function isValidHomeData(data) {
    return !!data && Array.isArray(data.class) && data.class.length > 0;
}

/**
 * 纯函数：评分。播放为深度验证不计入基础分；
 * okSteps/totalSteps ≥ 0.75 → healthy，≥1 → partial，否则 dead
 */
export function computeVerdict(okSteps, totalSteps) {
    if (totalSteps <= 0) return 'dead';
    const ratio = okSteps / totalSteps;
    if (ratio >= 0.75) return 'healthy';
    if (okSteps >= 1) return 'partial';
    return 'dead';
}

/**
 * 单步请求：GET + AbortController 超时 + JSON 解析
 * @returns {Promise<{ok: boolean, httpStatus: number|null, costMs: number, data: any|null, error: string|null}>}
 */
export async function fetchStep(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const t1 = Date.now();
    try {
        const resp = await fetch(url, {signal: controller.signal, headers: {Accept: 'application/json'}});
        const costMs = Date.now() - t1;
        const data = await resp.json();
        return {ok: resp.ok, httpStatus: resp.status, costMs, data, error: resp.ok ? null : `HTTP ${resp.status}`};
    } catch (e) {
        const costMs = Date.now() - t1;
        const msg = e.name === 'AbortError' ? `请求超时(${timeoutMs}ms)` : (e.cause?.code || e.message);
        return {ok: false, httpStatus: null, costMs, data: null, error: msg};
    } finally {
        clearTimeout(timer);
    }
}

/** 从 drpy 标准 vod_play_url / vod_play_from 提取第一集播放信息；无则返回 null */
export function extractFirstPlay(vod) {
    if (!vod) return null;
    const playUrl = String(vod.vod_play_url || '');
    const playFrom = String(vod.vod_play_from || '');
    const firstItem = playUrl.split('#').find(it => it.includes('$')) || null;
    if (!firstItem) return null;
    const [name, url] = firstItem.split('$');
    if (!url) return null;
    return {name: name || '第1集', url, flag: (playFrom.split('#')[0] || '').trim()};
}

/**
 * 流程编排：依次执行 home → category → detail → search（→ play 可选），
 * 后续步骤使用前序真实返回数据（分类用 home 的 type_id，详情用分类的 vod_id，播放用详情的第一集）。
 * @param {Object} opts {base, moduleName, engine, doParam, pwd, searchKeyword, perStepTimeoutMs, verifyPlay}
 * @returns {Promise<{steps: Object[], okSteps: number, totalSteps: number, verdict: string, costMs: number}>}
 */
export async function runVerifyFlow(opts) {
    const {base, moduleName, engine, doParam, pwd = '', searchKeyword = '爱'} = opts;
    const timeoutMs = Math.min(Math.max(Number(opts.perStepTimeoutMs) || 10000, 3000), 30000);
    const verifyPlay = !!opts.verifyPlay;
    const t0 = Date.now();
    const steps = [];
    const mkStep = (step, label, r, extra = {}) => ({
        step, label, ok: !!r.ok, httpStatus: r.httpStatus ?? null,
        costMs: r.costMs, error: r.error || null, ...extra,
    });
    const buildUrl = (params) => buildApiUrl(base, moduleName, doParam, params, pwd);

    // 1. home 首页
    const home = await fetchStep(buildUrl({}), timeoutMs);
    const homeOk = home.ok && isValidHomeData(home.data);
    const firstCategory = homeOk
        ? (home.data.class.find(c => c && c.type_id !== undefined && c.type_id !== '') || null)
        : null;
    // ok = HTTP 成功 **且** 数据有效（仅 HTTP 200 不代表源可用）
    steps.push({...mkStep('home', '首页', home), ok: homeOk,
        items: homeOk ? home.data.class.length : 0,
        sample: homeOk ? home.data.class.slice(0, 3) : null,
    });

    // 2. category 分类（用 home 的真实 type_id）
    let firstVodId = null;
    if (homeOk && firstCategory) {
        const cate = await fetchStep(buildUrl({ac: 'list', t: String(firstCategory.type_id), pg: 1}), timeoutMs);
        const cateValid = cate.ok && isValidListData(cate.data);
        const firstItem = cateValid ? cate.data.list.find(it => it && it.vod_id !== undefined) : null;
        firstVodId = firstItem ? String(firstItem.vod_id) : null;
        steps.push({...mkStep('category', '分类', cate), ok: cateValid,
            items: cateValid ? cate.data.list.length : 0,
            sample: cateValid ? cate.data.list.slice(0, 3).map(it => it.vod_name) : null,
        });
    } else {
        steps.push({step: 'category', label: '分类', ok: false, skipped: true, error: homeOk ? '首页无有效分类' : '首页失败，跳过'});
    }

    // 3. detail 详情（用分类的真实 vod_id）
    let firstPlay = null;
    const detailDone = steps.some(s => s.step === 'category' && !s.skipped);
    if (detailDone && firstVodId) {
        const detail = await fetchStep(buildUrl({ac: 'detail', ids: firstVodId}), timeoutMs);
        const vod = (detail.data && Array.isArray(detail.data.list) && detail.data.list[0]) || null;
        firstPlay = extractFirstPlay(vod);
        const detailValid = detail.ok && !!vod;
        steps.push({...mkStep('detail', '详情', detail), ok: detailValid,
            items: vod ? 1 : 0,
            playable: !!firstPlay,
            sample: vod ? {vod_name: vod.vod_name, vod_play_from: vod.vod_play_from} : null,
        });
    } else {
        steps.push({step: 'detail', label: '详情', ok: false, skipped: true, error: firstVodId ? null : '分类无有效 vod_id，跳过'});
    }

    // 4. search 搜索
    const search = await fetchStep(buildUrl({wd: searchKeyword}), timeoutMs);
    const searchValid = search.ok && isValidListData(search.data);
    steps.push({...mkStep('search', '搜索', search), ok: searchValid,
        items: searchValid ? search.data.list.length : 0,
        sample: searchValid ? search.data.list.slice(0, 3).map(it => it.vod_name) : null,
    });

    // 基础分：home/category/detail/search 四步
    const baseSteps = steps.filter(s => !s.deep);
    let okSteps = steps.filter(s => ['home', 'category', 'detail', 'search'].includes(s.step) && s.ok && !s.skipped).length;
    let verdict = computeVerdict(okSteps, 4);

    // 5. play 深度验证（可选，不计入基础分）
    if (verifyPlay) {
        if (firstPlay) {
            const play = await fetchStep(buildUrl({play: firstPlay.url, flag: firstPlay.flag}), timeoutMs);
            const playData = play.data || {};
            const playOk = play.ok && !!(playData.url || playData.jx || playData.parse);
            steps.push(mkStep('play', '播放', {...play, ok: playOk}, {
                deep: true,
                items: playOk ? 1 : 0,
                sample: playOk ? {episode: firstPlay.name} : null,
            }));
        } else {
            steps.push({step: 'play', label: '播放', ok: false, deep: true, skipped: true, error: '详情未取得播放地址，跳过'});
        }
    }

    return {
        steps,
        okSteps,
        totalSteps: 4,
        verdict,
        costMs: Date.now() - t0,
    };
}
