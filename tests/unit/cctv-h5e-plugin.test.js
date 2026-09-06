import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// 插件目录不入库（.gitignore /plugins/），缺失时跳过（本地安装插件后可跑）
const PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../plugins/cctv-h5e');
const PLUGIN_ENTRY = path.join(PLUGIN_DIR, 'index.js');
const PLUGIN_AVAILABLE = existsSync(PLUGIN_ENTRY);
const SKIP = !PLUGIN_AVAILABLE && '插件未安装（plugins/cctv-h5e 不存在）';

async function importPlugin() {
    return import(pathToFileURL(PLUGIN_ENTRY).href);
}

test('cctv-h5e 插件纯函数', {skip: SKIP}, async t => {
    const plugin = await importPlugin();

    await t.test('pickBinary 按平台-架构选择二进制', () => {
        const bin = plugin.pickBinary();
        if (['win32-x64', 'linux-x64', 'linux-arm64'].includes(`${process.platform}-${process.arch}`)) {
            assert.ok(bin, '支持平台应解析出二进制路径');
            assert.ok(existsSync(bin));
        } else {
            assert.equal(bin, null, '不支持平台返回 null');
        }
        assert.equal(plugin.pickBinary('darwin', 'arm64'), null);
    });

    await t.test('isAllowedUrl 央视域名白名单', () => {
        assert.ok(plugin.isAllowedUrl('https://dh5wswx02.v.cntv.cn/asp/h5e/a.ts'));
        assert.ok(plugin.isAllowedUrl('https://drm.cntv.vod.dnsv1.com/asp/enc2/x.m3u8'));
        assert.ok(plugin.isAllowedUrl('http://newcntv.qcloudcdn.com/asp/hls/main/0.ts'));
        assert.ok(plugin.isAllowedUrl('https://tv.cctv.com/lm/xwlb/index.shtml'));
        assert.ok(!plugin.isAllowedUrl('http://127.0.0.1:5757/proxy/x'));
        assert.ok(!plugin.isAllowedUrl('https://evil.example.com/asp/h5e/a.ts'));
        assert.ok(!plugin.isAllowedUrl('https://cntv.cn.evil.com/a.ts'));
        assert.ok(!plugin.isAllowedUrl('ftp://vdn.apps.cntv.cn/a.ts'));
        assert.ok(!plugin.isAllowedUrl('not a url'));
    });

    await t.test('normalizeEncryptedUrl 归一 enc2 CDN host', () => {
        assert.equal(
            plugin.normalizeEncryptedUrl('https://other.cdn.com/asp/enc2/hls/a.m3u8'),
            'https://drm.cntv.vod.dnsv1.com/asp/enc2/hls/a.m3u8'
        );
        assert.equal(
            plugin.normalizeEncryptedUrl('https://dh5wswx02.v.cntv.cn/asp/h5e/hls/a.m3u8'),
            'https://dh5wswx02.v.cntv.cn/asp/h5e/hls/a.m3u8',
            '非 enc2 路径不动'
        );
    });

    await t.test('pickEncryptedPlaylist 三级兜底', () => {
        assert.equal(plugin.pickEncryptedPlaylist({hls_h5e_url: 'a', hls_enc_url: 'b', hls_enc2_url: 'c'}), 'a');
        assert.equal(plugin.pickEncryptedPlaylist({hls_enc_url: 'b', hls_enc2_url: 'c'}), 'b');
        assert.equal(plugin.pickEncryptedPlaylist({hls_enc2_url: 'c'}), 'c');
        assert.equal(plugin.pickEncryptedPlaylist({}), '');
        assert.equal(plugin.pickEncryptedPlaylist(undefined), '');
    });

    await t.test('rewriteM3u8 variant/ts 行按前缀重写且保留注释行', () => {
        const text = [
            '#EXTM3U',
            '',
            '#EXT-X-STREAM-INF:BANDWIDTH=460800',
            'https://cdn.cntv.cn/450.m3u8',
            '#EXTINF:10,',
            '0.ts',
        ].join('\n');
        const out = plugin.rewriteM3u8(text, 'https://cdn.cntv.cn/main.m3u8', 'PM?', 'PT?');
        const lines = out.split('\n');
        assert.equal(lines[0], '#EXTM3U');
        // 行尾伪后缀：帮按 URL 后缀嗅探格式的播放器识别（fragment 不发给服务器）
        assert.equal(lines[3], 'PM?' + encodeURIComponent('https://cdn.cntv.cn/450.m3u8') + '#.m3u8');
        assert.equal(lines[5], 'PT?' + encodeURIComponent('https://cdn.cntv.cn/0.ts') + '#.ts');
    });

    await t.test('buildLiveAuthKey 与网页播放器同款签名结构', () => {
        const key = plugin.buildLiveAuthKey('cctv1', 1700000000000, 123);
        assert.match(key, /^1700000000000-123-[0-9a-f]{32}$/);
        // md5('cctv1' + time + number + secret) 固定值校验
        assert.equal(key.split('-')[2], '4b68646779a7d99144437cd665c19e15');
    });

    await t.test('isEncryptedTsUrl 识别点播 h5e 与直播 cdrm', () => {
        assert.ok(plugin.isEncryptedTsUrl('https://dh5wswx02.v.cntv.cn/asp/h5e/hls/2000/a/0.ts'));
        assert.ok(plugin.isEncryptedTsUrl('https://ldncctvwbcdali.v.myalicdn.com/ldncctvwbcd/cdrmldcctv1_1td/1.ts'));
        assert.ok(!plugin.isEncryptedTsUrl('https://newcntv.qcloudcdn.com/asp/hls/main/0.ts'), '明文点播不误判');
        assert.ok(!plugin.isEncryptedTsUrl('https://piccpndali.v.myalicdn.com/audio/cctv1_2/1.ts'), '直播音频流不误判');
    });

    await t.test('detectVideoPid 从 TS 探测视频 PID', () => {
        // 造一个最小 TS：视频 PID 0x100（PES 起始，stream_id 0xe0）×3 + 音频 PID 0x101（stream_id 0xc0）×1
        const pkt = (pid, pusi, streamId) => {
            const b = Buffer.alloc(188, 0xff);
            b[0] = 0x47;
            b[1] = (pusi ? 0x40 : 0x00) | (pid >> 8);
            b[2] = pid & 0xff;
            b[3] = 0x10; // afc=1 仅载荷
            if (pusi) {
                b[4] = 0; b[5] = 0; b[6] = 1; b[7] = streamId; // PES 起始码
            }
            return b;
        };
        const buf = Buffer.concat([pkt(0x100, true, 0xe0), pkt(0x100, true, 0xe0), pkt(0x100, true, 0xe0), pkt(0x101, true, 0xc0)]);
        assert.equal(plugin.detectVideoPid(buf), 0x100);
        assert.equal(plugin.detectVideoPid(Buffer.alloc(0)), 0x100, '空输入回退默认');
    });

    await t.test('直播 m3u8 重写：多分片丢头部半截切片、单分片保留', () => {
        const media = ['#EXTM3U', '#EXT-X-TARGETDURATION:5', '#EXTINF:4,', 'a.ts', '#EXTINF:4,', 'b.ts', '#EXTINF:4,', 'c.ts'].join('\n');
        const out = plugin.rewriteLiveMedia(media, 'http://x/index.m3u8', {__host: 'h', base: 'PB?'}).split('\n');
        const rows = out.filter(l => l.startsWith('PB?'));
        assert.equal(rows.length, 2, '丢弃头部第 1 个分片（半截切片非 IDR 对齐）');
        assert.match(rows[0], /b\.ts#\.ts$/, '保留的第 1 行是原第 2 个分片');
        assert.ok(out.some(l => l.startsWith('#EXTINF')), '标签行保留');
        // 单分片列表：不丢（丢了就无内容）
        const single = plugin.rewriteLiveMedia('#EXTM3U\n#EXTINF:4,\na.ts', 'http://x/index.m3u8', {__host: 'h'});
        assert.ok(single.includes('PT?') || single.includes('a.ts') || single.split('\n').some(l => l && !l.startsWith('#') && l.includes('ts')), '单分片保留');
    });
});

test('cctv-h5e 二进制解密对拍（fixture 锁定 sha256）', {skip: SKIP}, async () => {
    const {pickBinary} = await importPlugin();
    const bin = pickBinary();
    assert.ok(bin, '当前平台应有解密二进制');
    const enc = await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tests/fixtures/cctv_h5e_segment.enc.ts'));
    const out = await new Promise((resolve, reject) => {
        const proc = spawn(bin, ['--stream'], {stdio: ['pipe', 'pipe', 'pipe']});
        const chunks = [];
        proc.stdout.on('data', c => chunks.push(c));
        proc.stderr.on('data', () => {});
        proc.on('error', reject);
        // 截断样本尾部 PES 不完整：退出码 3（无完整 NAL 后段）仍是有效输出
        proc.on('close', () => resolve(Buffer.concat(chunks)));
        proc.stdin.end(enc);
    });
    assert.equal(out.length, enc.length, '解密输出与输入等长（188 对齐语义）');
    const sha = createHash('sha256').update(out).digest('hex');
    assert.equal(sha, 'd7c1737ec806e6e7ed6e0d984b1d72c913c979a7b1b50b0d742c22dece667eee');
});
