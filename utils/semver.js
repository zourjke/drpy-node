/**
 * semver 数值段比较（忽略预发布后缀）
 * 从 pluginMarket 抽取为公共工具，供更新日志排序等场景复用
 */

/**
 * a>b 返回 1，a<b 返回 -1，相等返回 0
 */
export function compareVersions(a, b) {
    const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d) return d > 0 ? 1 : -1;
    }
    return 0;
}

export default compareVersions;
