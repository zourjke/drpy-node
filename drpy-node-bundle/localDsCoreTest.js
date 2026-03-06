// import * as localtDsCore from './localDsCore.js';
const start = performance.now();
import * as localtDsCore from './libs/localDsCore.bundled.js';

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