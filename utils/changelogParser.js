/**
 * 更新日志 Markdown 解析器（docs/changelog-design.md §4.3/§4.4）
 *
 * 文件格式：frontmatter（--- 围栏，key: value）+ 正文按 `## 小节名` 分组，
 * 小节下的 `- ` 列表项为一条变更；小节名按 SECTION_TYPE_MAP 映射条目类型。
 * 版本号唯一来源是文件名（v{semver}.md）。
 */

import { compareVersions } from './semver.js';

// 小节名 → 条目类型映射（按展示优先级排列）
export const SECTION_TYPE_MAP = [
    { aliases: ['新增', '新功能', '特性'], type: 'feat' },
    { aliases: ['修复'], type: 'fix' },
    { aliases: ['优化', '性能'], type: 'perf' },
    { aliases: ['重构'], type: 'refactor' },
    { aliases: ['安全'], type: 'security' },
    { aliases: ['文档'], type: 'docs' },
    { aliases: ['其他'], type: 'other' },
];

// 条目类型的展示优先级（版本卡片色条取最高级别条目的颜色）
export const TYPE_PRIORITY = ['security', 'feat', 'fix', 'perf', 'refactor', 'docs', 'other'];

export const VERSION_FILE_RE = /^v(\d+\.\d+\.\d+)\.md$/;

function sectionType(name) {
    const hit = SECTION_TYPE_MAP.find((s) => s.aliases.includes(name));
    return hit ? hit.type : 'other';
}

/** 解析 `---` 围栏 frontmatter，返回 { meta, body }；无围栏时 meta 为空对象 */
export function parseFrontmatter(content) {
    const lines = content.split('\n');
    if (lines[0]?.trim() !== '---') return { meta: {}, body: content };
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (end === -1) return { meta: {}, body: content };
    const meta = {};
    for (const line of lines.slice(1, end)) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key) meta[key] = value;
    }
    return { meta, body: lines.slice(end + 1).join('\n') };
}

/**
 * 解析单个版本文件
 * @param {string} fileName 文件名（v{semver}.md）
 * @param {string} content 文件内容
 * @returns {{ ok: boolean, release?: object, warnings?: string[] }}
 */
export function parseChangelogFile(fileName, content) {
    const warnings = [];
    const m = VERSION_FILE_RE.exec(fileName);
    if (!m) return { ok: false, warnings: [`文件名不合规: ${fileName}（应为 v{semver}.md）`] };
    const version = m[1];

    const { meta, body } = parseFrontmatter(content);

    const date = /^\d{4}-\d{2}-\d{2}$/.test(meta.date || '') ? meta.date : '';
    if (!date) warnings.push(`${fileName}: frontmatter 缺少合法 date（YYYY-MM-DD）`);

    const type = ['major', 'minor', 'patch'].includes(meta.type) ? meta.type : 'patch';
    if (!['major', 'minor', 'patch'].includes(meta.type)) warnings.push(`${fileName}: type 缺省为 patch`);
    if (!meta.title) warnings.push(`${fileName}: 缺少 title`);

    const title = meta.title || `版本 v${version}`;
    const tags = (meta.tags || '').split(/[,，]/).map((t) => t.trim()).filter(Boolean);

    // 正文按 ## 小节分组；小节外裸列表归 other
    const items = [];
    let currentType = 'other';
    let currentLabel = '其他';
    for (const line of body.split('\n')) {
        const h = /^##\s+(.+?)\s*$/.exec(line);
        if (h) {
            currentType = sectionType(h[1].trim());
            currentLabel = currentType === 'other' && !SECTION_TYPE_MAP.some((s) => s.aliases.includes(h[1].trim())) ? h[1].trim() : '其他';
            continue;
        }
        const item = /^[-*]\s+(.+?)\s*$/.exec(line);
        if (item) {
            items.push({
                type: currentType,
                label: currentType === 'other' && currentLabel !== '其他' ? currentLabel : undefined,
                text: item[1],
            });
        }
    }

    return {
        ok: true,
        release: { version, date, type, title, tags, items },
        warnings,
    };
}

/** 解析归档文件 archive.md（每段 `### YYYYMMDD` + 列表/文本） */
export function parseArchive(content) {
    const items = [];
    let currentDate = '';
    for (const line of content.split('\n')) {
        const h = /^###\s+(\d{8})/.exec(line);
        if (h) { currentDate = h[1]; continue; }
        if (line.startsWith('#')) continue;
        const item = /^[-*]\s+(.+?)\s*$/.exec(line);
        if (item) {
            items.push({
                type: 'other',
                text: currentDate ? `${currentDate} ${item[1]}` : item[1],
            });
        }
    }
    return { items };
}

/** 版本列表排序（降序） */
export function sortReleases(releases) {
    return [...releases].sort((a, b) => compareVersions(b.version, a.version));
}
