import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveFlowTarget,
    buildApiUrl,
    isValidListData,
    isValidHomeData,
    computeVerdict,
    extractFirstPlay,
    runVerifyFlow,
} from '../../utils/sourceVerify.js';

// ==================== resolveFlowTarget ====================

test('resolveFlowTarget: 各引擎 do 映射与模块名解析', () => {
    const js = resolveFlowTarget('spider/js/热门推荐.js');
    assert.equal(js.supported, true);
    assert.equal(js.moduleName, '热门推荐');
    assert.equal(js.doParam, null);

    assert.equal(resolveFlowTarget('spider/py/abc.py').doParam, 'py');
    assert.equal(resolveFlowTarget('spider/php/abc.php').doParam, 'php');
    assert.equal(resolveFlowTarget('spider/catvod/abc.js').doParam, 'cat');
});

test('resolveFlowTarget: dr2 不支持流程验证 / 非源目录拒绝 / _前缀拒绝', () => {
    const dr2 = resolveFlowTarget('spider/js_dr2/abc.js');
    assert.equal(dr2.supported, false);
    assert.ok(dr2.reason.includes('仅支持代码语法验证'));
    assert.equal(resolveFlowTarget('controllers/index.js').supported, false);
    assert.equal(resolveFlowTarget('spider/js/_x.js').supported, false);
});

// ==================== buildApiUrl ====================

test('buildApiUrl: module 编码、pwd/do/参数拼接、空值跳过', () => {
    const url = buildApiUrl('http://127.0.0.1:5757', '热门推荐', null, {ac: 'list', t: '1', pg: 1, wd: ''}, 'dzyyds');
    const u = new URL(url);
    assert.equal(u.pathname, '/api/' + encodeURIComponent('热门推荐'));
    assert.equal(u.searchParams.get('pwd'), 'dzyyds');
    assert.equal(u.searchParams.get('ac'), 'list');
    assert.equal(u.searchParams.get('t'), '1');
    assert.equal(u.searchParams.get('pg'), '1');
    assert.equal(u.searchParams.has('wd'), false); // 空值跳过
    const u2 = new URL(buildApiUrl('http://127.0.0.1:5757', 'x', 'py', {}, ''));
    assert.equal(u2.searchParams.get('do'), 'py');
    assert.equal(u2.searchParams.has('pwd'), false);
});

// ==================== 数据有效性判定 ====================

test('isValidListData: list 数组且过滤占位项', () => {
    assert.equal(isValidListData({list: [{vod_id: 1, vod_name: 'a'}]}), true);
    assert.equal(isValidListData({list: [{vod_id: 'no_data'}]}), false);
    assert.equal(isValidListData({list: [{vod_name: '无数据,防无限请求'}]}), false);
    assert.equal(isValidListData({list: []}), false);
    assert.equal(isValidListData({}), false);
    assert.equal(isValidListData(null), false);
});

test('isValidHomeData: class 非空数组', () => {
    assert.equal(isValidHomeData({class: [{type_id: 1}]}), true);
    assert.equal(isValidHomeData({class: []}), false);
    assert.equal(isValidHomeData({}), false);
});

test('extractFirstPlay: drpy 播放串解析第一集', () => {
    const vod = {vod_play_from: 'qq#m3u8', vod_play_url: '第1集$https://a/1.m3u8#第2集$https://a/2.m3u8'};
    assert.deepEqual(extractFirstPlay(vod), {name: '第1集', url: 'https://a/1.m3u8', flag: 'qq'});
    assert.equal(extractFirstPlay({vod_play_url: 'https://a/1.mp4'}), null); // 无 $ 分隔
    assert.equal(extractFirstPlay(null), null);
});

// ==================== computeVerdict ====================

test('computeVerdict: 评分边界', () => {
    assert.equal(computeVerdict(3, 4), 'healthy');
    assert.equal(computeVerdict(4, 4), 'healthy');
    assert.equal(computeVerdict(2, 4), 'partial');
    assert.equal(computeVerdict(1, 4), 'partial');
    assert.equal(computeVerdict(0, 4), 'dead');
    assert.equal(computeVerdict(0, 0), 'dead');
});

// ==================== runVerifyFlow（mock fetchStep 无法注入——用本地 http 服务实测编排） ====================

test('runVerifyFlow: 编排/数据流/评分（本地 mock 源服务）', async () => {
    const http = await import('node:http');
    const data = {
        '/api/ok-src': (q) => {
            if (q.get('play') !== null) return {jx: 0, url: 'https://cdn/1.mp4', parse: 0};
            if (q.get('ac') === 'list') return {list: [{vod_id: 7, vod_name: '剧A'}, {vod_id: 'no_data'}]};
            if (q.get('ac') === 'detail') return {list: [{vod_id: 7, vod_name: '剧A', vod_play_from: 'qq', vod_play_url: '第1集$https://cdn/1.mp4'}]};
            if (q.has('wd')) return {list: [{vod_id: 9, vod_name: '搜索结果'}]};
            return {class: [{type_id: 1, type_name: '都市'}]};
        },
        '/api/dead-src': () => ({error: ' site dead'}),
    };
    const server = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://x');
        res.setHeader('content-type', 'application/json');
        res.setHeader('connection', 'close'); // 禁用 keep-alive，避免连接残留阻止测试退出
        const mod = u.pathname.replace('/api/', '');
        res.end(JSON.stringify((data['/api/' + mod] || (() => ({})))(u.searchParams)));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;

    // 健康源：4/4 → healthy；detail 拿到 vod_play_url → playable；category 过滤 no_data 后 items=1
    const good = await runVerifyFlow({base, moduleName: 'ok-src', engine: 'js', doParam: null, searchKeyword: '爱', verifyPlay: false});
    assert.equal(good.verdict, 'healthy');
    assert.equal(good.okSteps, 4);
    const cateStep = good.steps.find(s => s.step === 'category');
    assert.equal(cateStep.items, 2); // items 为返回 list 原始长度（有效性判定不剔除占位项）
    const detailStep = good.steps.find(s => s.step === 'detail');
    assert.equal(detailStep.playable, true);

    // 死源：0/4 → dead；home 失败后 category/detail 标记 skipped
    const dead = await runVerifyFlow({base, moduleName: 'dead-src', engine: 'js', doParam: null, searchKeyword: '爱'});
    assert.equal(dead.verdict, 'dead');
    const catSkipped = dead.steps.find(s => s.step === 'category');
    assert.equal(catSkipped.skipped, true);

    // 深度播放：play 步骤执行且不计入 totalSteps
    const withPlay = await runVerifyFlow({base, moduleName: 'ok-src', engine: 'js', doParam: null, verifyPlay: true});
    const playStep = withPlay.steps.find(s => s.step === 'play');
    assert.equal(playStep.ok, true);
    assert.equal(playStep.deep, true);
    assert.equal(withPlay.totalSteps, 4);

    server.close();
});
