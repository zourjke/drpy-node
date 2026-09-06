/**
 * 一次性迁移脚本：docs/updateRecord.md → docs/changelog/*.md
 *
 * - `### YYYYMMDD` 切分段落，段内 `更新至V{semver}` 提取版本
 * - 有版本号 → 生成 docs/changelog/v{semver}.md（type 缺省 patch，人工抽查修订）
 * - 无版本号的早期段落 → 合并进 docs/changelog/archive.md
 * - 旧内容统一放入 `## 其他` 小节：编号列表 `1. ` 与普通段落行都转为 `- ` 列表项，保证内容不丢失
 *
 * 执行：node scripts/migrate-changelog.mjs（跑完归档本脚本）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'docs', 'updateRecord.md');
const OUT_DIR = path.join(ROOT, 'docs', 'changelog');

const content = fs.readFileSync(SRC, 'utf-8');

// 按日期标题切段
const headings = [...content.matchAll(/^### (\d{8})\s*$/gm)];
if (headings.length === 0) {
    console.error('未找到任何 ### YYYYMMDD 段落');
    process.exit(1);
}

const segments = headings.map((h, i) => ({
    date: h[1],
    body: content.slice(h.index + h[0].length, i + 1 < headings.length ? headings[i + 1].index : content.length),
}));

const versionRe = /更新至V(\d+\.\d+\.\d+)/;
const versioned = [];
const archived = [];

for (const seg of segments) {
    const rawLines = seg.body.split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && !versionRe.test(l));
    const items = rawLines.map((l) => '- ' + l.replace(/^\d+[.、)\s]+/, '').replace(/^[-*•]\s*/, ''));
    const m = seg.body.match(versionRe);
    if (m) {
        versioned.push({ version: m[1], date: seg.date, items });
    } else {
        archived.push({ date: seg.date, items });
    }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
for (const v of versioned) {
    const md = [
        '---',
        `date: ${v.date.slice(0, 4)}-${v.date.slice(4, 6)}-${v.date.slice(6, 8)}`,
        'type: patch',
        `title: V${v.version} 版本更新`,
        '---',
        '',
        '## 其他',
        '',
        ...v.items,
        '',
    ].join('\n');
    fs.writeFileSync(path.join(OUT_DIR, `v${v.version}.md`), md, 'utf-8');
    written++;
}

if (archived.length > 0) {
    const archiveMd = ['# 历史归档（结构化迁移前的早期记录）', '']
        .concat(archived.flatMap((a) => [`### ${a.date}`, '', ...a.items, '']))
        .join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'archive.md'), archiveMd, 'utf-8');
}

console.log(`迁移完成：${written} 个版本文件，${archived.length} 个段落进入 archive.md`);
console.log(`版本列表：${versioned.map((v) => v.version).join(', ')}`);
