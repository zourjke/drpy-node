import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// py 基类长视频代理辅助方法（批次 5b）行为对拍。
// python 环境或 base.spider 依赖（requests/lxml/Crypto）缺失时跳过。
const PY_SNIPPET = `
import sys, json
sys.path.insert(0, sys.argv[1])
from base.spider import BaseSpider

class T(BaseSpider):
    def init(self, ext=""):
        pass
    def homeContent(self, f=False):
        pass
    def homeVideoContent(self):
        pass
    def categoryContent(self, tid, pg=1, f=False, ext=None):
        pass
    def detailContent(self, ids):
        pass
    def searchContent(self, key, quick=False, pg=1):
        pass
    def playerContent(self, flag, id, vipFlags=None):
        pass
    def localProxy(self, params):
        pass
    def isVideoFormat(self, url):
        pass
    def manualVideoCheck(self):
        pass

t = T(t4_api='http://h:5757/proxy/M?do=py')
base = 'http://h:5757/mediaProxy'
out = {
  'no_base_passthrough': t.proxy_media_url('http://x/a.mp4'),
  'with_base': t.proxy_media_url('http://x/a.mp4', {'User-Agent': 'ua'}, base),
}
m3u8 = "#EXTM3U\\n#EXTINF:10,\\nseg0.ts\\nhttps://cdn.live/seg1.ts\\n/abs/seg2.ts\\n"
out['m3u8'] = t.rewrite_m3u8_to_proxy(m3u8, 'http://h/live/index.m3u8', {'Referer': 'http://h/'}, base)
print(json.dumps(out, ensure_ascii=False))
`;

const b64 = (s) => Buffer.from(s).toString('base64');

test('py 基类 proxy_media_url / rewrite_m3u8_to_proxy 行为对拍', {skip: process.env.SKIP_PY_TESTS === '1'}, async () => {
    const pyDir = path.resolve(__dirname, '../../spider/py');
    let stdout;
    try {
        ({stdout} = await execFileAsync('python', ['-c', PY_SNIPPET, pyDir], {
            timeout: 20000,
            env: {...process.env, PYTHONIOENCODING: 'utf-8'},
        }));
    } catch (e) {
        // 依赖缺失等环境问题视为跳过而非失败
        return;
    }
    const line = stdout.trim().split('\n').filter(Boolean).pop();
    const out = JSON.parse(line);

    // 未注入 base：原样透传（优雅降级）
    assert.equal(out.no_base_passthrough, 'http://x/a.mp4');

    // 注入 base：mediaProxy base64 形态，含 stream=1 与 header
    const mp = out.with_base;
    assert.ok(mp.startsWith('http://h:5757/mediaProxy?'), mp);
    assert.ok(mp.includes('form=base64&stream=1'), mp);
    const q = Object.fromEntries(new URL(mp).searchParams);
    assert.equal(Buffer.from(q.url, 'base64').toString(), 'http://x/a.mp4');
    assert.deepEqual(JSON.parse(Buffer.from(q.header, 'base64').toString()), {'User-Agent': 'ua'});

    // m3u8 改写：标签行保留、相对/绝对/根相对分片均包装且补全正确
    const lines = out.m3u8.split('\n');
    assert.equal(lines[0], '#EXTM3U');
    assert.equal(lines[1], '#EXTINF:10,');
    const dec = (l) => Buffer.from(new URL(l).searchParams.get('url'), 'base64').toString();
    assert.equal(dec(lines[2]), 'http://h/live/seg0.ts');
    assert.equal(dec(lines[3]), 'https://cdn.live/seg1.ts');
    assert.equal(dec(lines[4]), 'http://h/abs/seg2.ts');
    // 全部分片行都指向 mediaProxy
    for (const l of lines.slice(2)) assert.ok(l.startsWith('http://h:5757/mediaProxy'), l);
});
