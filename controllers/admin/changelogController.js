/**
 * 更新日志控制器（docs/changelog-design.md §5）
 *
 * 数据源：docs/changelog/ 目录（每版本一个 v{semver}.md，archive.md 为历史归档）。
 * 目录 mtime 作为缓存键，无变化直接返回缓存；结构化解析委托 utils/changelogParser。
 */

import path from 'path';
import fs from '../../utils/fsWrapper.js';
import { PROJECT_ROOT } from '../../utils/pathHelper.js';
import { compareVersions } from '../../utils/semver.js';
import { parseChangelogFile, parseArchive, sortReleases } from '../../utils/changelogParser.js';

const CHANGELOG_DIR = path.join(PROJECT_ROOT, 'docs', 'changelog');

let cache = { key: '', data: null };

// 目录快照作为缓存键：文件名 + mtime 组合，增/删/改任一文件都会使键变化
async function dirSnapshotKey() {
    const entries = (await fs.readdir(CHANGELOG_DIR)).filter((e) => e.endsWith('.md')).sort();
    const parts = [];
    for (const entry of entries) {
        const stat = await fs.stat(path.join(CHANGELOG_DIR, entry));
        parts.push(`${entry}:${Math.round(stat.mtimeMs)}`);
    }
    return parts.join('|');
}

async function loadChangelog() {
    if (!fs.existsSync(CHANGELOG_DIR)) {
        throw new Error('changelog 目录缺失');
    }

    const key = await dirSnapshotKey();
    if (cache.data && key === cache.key) return cache.data;

    const releases = [];
    const warnings = [];
    let archive = { items: [] };

    for (const entry of await fs.readdir(CHANGELOG_DIR)) {
        if (!entry.endsWith('.md')) continue;
        const content = await fs.readFile(path.join(CHANGELOG_DIR, entry), 'utf-8');
        if (entry === 'archive.md') {
            archive = parseArchive(content);
            continue;
        }
        const parsed = parseChangelogFile(entry, content);
        warnings.push(...parsed.warnings);
        if (parsed.ok) releases.push(parsed.release);
    }

    releases.sort((a, b) => compareVersions(b.version, a.version));
    cache = {
        key,
        data: {
            latest: releases[0]?.version || null,
            count: releases.length,
            releases,
            archive,
            warnings,
        },
    };
    return cache.data;
}

export async function getChangelog(req, reply) {
    try {
        const data = await loadChangelog();
        return reply.send({ success: true, data });
    } catch (e) {
        return reply.code(500).send({ error: e.message });
    }
}
