// UMD 全局挂载型 shim 的公共挂载件（各 *-shim.mjs 共用）：
// rolldown 的 CJS interop 会让 UMD 走 module.exports 分支，浏览器分支的
// globalThis 挂载不会发生 → drpyCustom.js 末尾的 `export const X = globalThis.X`
// 变 undefined，沙箱裸引用即 ReferenceError。这里把 interop 取回的模块对象
// （default ?? namespace）幂等挂回全局，并原样作为 default 导出。
export function mountUmdGlobal(name, lib) {
    const value = lib.default ?? lib;
    if (typeof globalThis !== 'undefined' && !globalThis[name]) {
        globalThis[name] = value;
    }
    return value;
}
