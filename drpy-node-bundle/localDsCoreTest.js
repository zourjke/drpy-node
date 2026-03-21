// import * as localtDsCore from './localDsCore.js';
import * as localtDsCore from './libs/localDsCore.bundled.js';

const start = performance.now();

console.log(getEngine)
// const a = await getEngine('爱推图[画]', {}, {proxyUrl: "xx"})
// console.log(a)
// const b = await getEngine('奇奇[官]', {do: 'cat'})
// console.log(b)
// const c = await getEngine('果果[官]', {do: 'cat', ac: 'list', t: '3'})
// console.log(c)
// const d = await getEngine('设置中心', {do: 'ds'})
// console.log(d)
// const e = await getEngine('B站 ᵈᶻ', {do: 'php'})
const e = await getEngine('30wMV[听]', {
    do: 'ds',
    // play: 'http://em.21dtv.com/songs/100093410.mkv',
    parse: '_30wmv',
    url: 'http://em.21dtv.com/songs/100093410.mkv',
}, {requestHost: 'http://127.0.0.1:5757'})
// console.log(e)
const end = performance.now();

console.log(`耗时: ${end - start} ms`);
// process.exit(0);

const f = await getEngine('央视大全[官]', {
    do: 'ds',
    proxy: 1,
    url: '',
}, {
    requestHost: 'http://127.0.0.1:5757',
    proxyPath: 'https://dh5wswx02.v.cntv.cn/asp/h5e/hls/2000/0303000a/3/default/b90af013c16e44de9e4f1f56dab91f63/1.ts'
})

const [statuCode, contentType, buffer, headers] = f;
console.log('resutl: header:', headers, 'buffer length:', buffer.length);

const g = await getEngine('360影视[官]', {do: 'ds', ac: 'list', t: '2', ext: 'eyLnsbvlnosiOiLoqIDmg4UifQ=='})
console.log(g)

const h = await getEngine('腾云驾雾[官]', {do: 'ds', ac: 'list', t: 'movie', ext: 'eyJzb3J0IjoiODEifQ=='})
console.log(h)