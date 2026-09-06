import {LRUCache} from 'lru-cache';

/**
 * 有界缓存代理 (L11)
 *
 * 以普通对象的访问语法（this.x[key] 读、写、delete、in、Object.keys）
 * 提供带容量上限与 TTL 的 LRU 缓存。网盘解析器历史上把这些缓存定义为裸对象 {}，
 * 条目只增不减；替换为本工厂后行为语法完全不变，仅多出"淘汰"能力。
 *
 * ⚠️ 使用约束：仅支持属性语法（bracket/dot 数据键）。不要对该对象调用
 * .has()/.get()/.size 等方法——Proxy get trap 会把未知键当数据键返回 undefined。
 *
 * @param {Object} [options]
 * @param {number} [options.max=500] 最大条目数
 * @param {number} [options.ttl=30*60*1000] 过期毫秒数
 * @returns {Object} 行为等同普通对象的 LRU 缓存
 */
export function boundedCache({max = 500, ttl = 30 * 60 * 1000} = {}) {
    const store = new LRUCache({max, ttl});
    return new Proxy(
        {},
        {
            get(_, key) {
                if (typeof key === 'symbol') return undefined;
                return store.get(key);
            },
            set(_, key, value) {
                if (typeof key !== 'symbol') store.set(key, value);
                return true;
            },
            has(_, key) {
                return typeof key !== 'symbol' && store.has(key);
            },
            deleteProperty(_, key) {
                if (typeof key !== 'symbol') store.delete(key);
                return true;
            },
            ownKeys() {
                return [...store.keys()];
            },
            getOwnPropertyDescriptor() {
                // 使 Object.keys/展开运算可用
                return {enumerable: true, configurable: true};
            }
        }
    );
}

export default boundedCache;
