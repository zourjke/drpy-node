/*
@header({
  searchable: 0,
  filterable: 1,
  quickSearch: 0,
  title: '30wMV',
  lang: 'ds'
})
*/

const dbName = './data/mv/song.db';  // 数据库路径
const pageSize = 200; // 每页显示100条记录
const fixUrl = 'http://em.21dtv.com/songs/';
let songDb = null;

async function dbQuery(dbName, query) {
    if (!songDb) {
        songDb = new DataBase(dbName);
    }
    await songDb.startDb();
    const db = songDb.db;
    let data = await db.all(query);
    await songDb.endDb();
    return data
}

var rule = {
    类型: '搜索',
    title: '30wMV',
    alias: '30wMV点歌平台',
    desc: 'KTV点歌源',
    host: 'hiker://empty',
    url: '',
    searchUrl: 'hiker://empty',
    headers: {
        'User-Agent': 'PC_UA',
    },
    searchable: 0,
    quickSearch: 0,
    filterable: 1,
    double: false,
    play_parse: true,
    limit: 100,
    filter: '',
    // 推荐样式
    hikerListCol: 'icon_round_2',
    // 分类列表样式
    hikerClassListCol: 'avatar',
    // home_flag: '3-0-S',
    home_flag: '3',
    // class_flag: '3-11-S',
    class_flag: '1',
    预处理: async function () {
        songDb = new DataBase(dbName);
    },
    class_parse: async function () {
        let classes = [];
        classes.push({
            type_id: JSON.stringify({type: 'cate', id: 'cate'}),
            type_name: '类型',
            type_flag: '1'
        }, {
            type_id: JSON.stringify({type: 'singer', id: 'singer'}),
            type_name: '歌手',
            type_flag: '[CFS][CFPY]1'
        }, {
            type_id: JSON.stringify({type: 'song', id: 'song', name: '曲库', lname: '曲库'}),
            type_name: '曲库',
            type_flag: '[CFS][CFPY]1-11'
        }, {
            type_id: JSON.stringify({type: '华语歌手', id: '1'}),
            type_name: '男歌手',
            type_flag: '[CFPY][PY1][AN:喜爱歌手]2-00-S'
        }, {
            type_id: JSON.stringify({type: '华语歌手', id: '2'}),
            type_name: '女歌手',
            type_flag: '[CFPY][PY1][AN:喜爱歌手]2-00-S'
        }, {
            type_id: JSON.stringify({type: '华语歌手', id: '3'}),
            type_name: '组合歌手',
            type_flag: '[CFPY][PY1][AN:喜爱歌手]2-00-S'
        });
        return {
            class: classes,
            filters: null,
            type_flag: 1
        }
    },

    lazy: async function (flag, id, flags) {
        let {requestHost} = this;
        const parseObj = executeParse('_30wmv', requestHost, id);
        // console.log('parseObj:', parseObj);
        if (parseObj[0]) {
            const _data = await req(parseObj[1]);
            const data = JSON.parse(_data.content);
            // console.log('data:', data);
            return {
                parse: 0, url: data.url, header: data.header
            }
        }
        return {parse: 0, url: id}
    },
    proxy_rule: async function (params) {
        return ''
    },
    action: async function (action, value) {
        return ''
    },
    推荐: async function () {
        return []
    },
    一级: async function (tid, pg, filter, extend) {
        pg = pg || 1;
        extend = extend || {};

        const pageIndex = pg - 1;
        const offset = pageIndex * pageSize; // 计算当前页的偏移量
        const cid = JSON.parse(tid);

        let videos = [];
        let query = '';
        let data = [];
        let cnt = 0;
        if (cid.type == 'cate') {
            query = "SELECT id, name, (SELECT COUNT(*) FROM song_type WHERE category_id=song_category.id) AS num FROM song_category LIMIT " + pageSize + " OFFSET " + offset;
            data = await dbQuery(dbName, query);
            data.forEach(it => {
                videos.push({
                    vod_id: JSON.stringify({type: 'type', id: it.id, name: it.name, lname: it.name}),
                    vod_name: it.name,
                    vod_remarks: it.num + '条',
                    vod_tag: 'folder',
                    vod_style: '1',
                });
            });
        } else if (cid.type == 'type') {
            query = "SELECT id, name, (SELECT COUNT(*) FROM song WHERE type_id=song_type.id) AS num"
                + " FROM song_type"
                + " WHERE category_id=" + cid.id
                + " LIMIT " + pageSize + " OFFSET " + offset;
            data = await dbQuery(dbName, query);
            data.forEach(it => {
                videos.push({
                    vod_id: JSON.stringify({
                        type: 'type_song',
                        id: it.id,
                        name: it.name,
                        lname: cid.lname + '-' + it.name
                    }),
                    vod_name: it.name,
                    vod_remarks: it.num + '首',
                    vod_tag: 'folder',
                    vod_style: '[CFS][CFPY]1-11',
                });
            });
        } else if (cid.type == 'type_song') {
            let customFilter = '1';
            let wd = '';
            if (extend.custom) {
                wd = extend.custom.trim();
                const words = wd.split('-');
                if (words.length > 1) {
                    customFilter = "(singer_names like '%" + words[0] + "%' AND name like '%" + words[1] + "%')";
                } else {
                    customFilter = "(singer_names like '%" + wd + "%' OR name like '%" + wd + "%')";
                }
            } else if (extend.custom_pinyin) {
                wd = extend.custom_pinyin.trim();
                const words = wd.split('-');
                if (words.length > 1) {
                    customFilter = "(acronym like '%" + words[1] + "%' AND singer_names in (SELECT name FROM singer WHERE acronym like '%" + words[0] + "%'))";
                } else {
                    customFilter = "(acronym like '%" + wd + "%' OR singer_names in (SELECT name FROM singer WHERE acronym like '%" + wd + "%'))";
                }
            }
            query = "SELECT name, singer_names, number, format"
                + " FROM song"
                + " WHERE type_id=" + cid.id + " AND " + customFilter
                + " ORDER BY acronym COLLATE NOCASE"
                + " LIMIT " + pageSize + " OFFSET " + offset;
            data = await dbQuery(dbName, query);
            data.forEach(it => {
                videos.push({
                    vod_id: fixUrl + it.number + '.' + it.format + '#' + it.singer_names + '-' + it.name + '#' + cid.lname,
                    vod_name: it.name,
                    vod_remarks: it.singer_names,
                });
            });
            if (videos.length > 1 && pg == 1) {
                query = "SELECT COUNT(*) as num FROM song WHERE type_id=" + cid.id + " AND " + customFilter;
                const d = await dbQuery(dbName, query);
                videos.unshift({
                    vod_id: JSON.stringify({
                        type: 'type_song_page',
                        id: cid.id,
                        name: cid.name + (wd == '' ? '' : '-' + wd),
                        lname: cid.lname + (wd == '' ? '' : '-' + wd),
                        filter: customFilter
                    }),
                    vod_name: cid.name + (wd == '' ? '' : '-' + wd) + ' [分页]',
                    vod_remarks: d[0].num + '首 ' + Math.floor((d[0].num - 1) / pageSize + 1) + '页',
                    vod_tag: 'folder',
                    vod_style: '1',
                });
            }
        } else if (cid.type == 'type_song_page') {
            if (pg == 1) {
                query = "SELECT COUNT(*) as num FROM song WHERE type_id=" + cid.id + " AND " + cid.filter;
                data = await dbQuery(dbName, query);
                if (data.length > 0) {
                    for (let i = 0; i < data[0].num; i += pageSize) {
                        const pageNo = i / pageSize + 1;
                        const name = cid.lname + (data[0].num > pageSize ? ' (第' + pageNo + '页)' : '');
                        videos.push({
                            vod_id: 'multi_type_song#' + name + '#' + cid.id + '#' + i + '#' + cid.filter,
                            vod_name: '第 ' + pageNo + ' 页',
                            vod_remarks: (i + 1) + '~' + (data[0].num > pageNo * pageSize ? i + pageSize : data[0].num)
                        });
                    }
                }
            }
        } else if (cid.type == 'singer') {
            let customFilter = '1';
            let wd = '';
            if (extend.custom) {
                wd = extend.custom.trim();
                customFilter = "singer.name like '%" + wd + "%'";
            } else if (extend.custom_pinyin) {
                wd = extend.custom_pinyin.trim();
                customFilter = "singer.acronym like '%" + wd + "%'";
            }
            query = "SELECT distinct singer.name, singer_form.name as form_name, singer_region.name as region_name, (SELECT COUNT(*) FROM song WHERE singer_names=singer.name) AS num"
                + " FROM singer left join singer_form on singer.form_id=singer_form.id left join singer_region on singer.region_id=singer_region.id"
                + " WHERE " + customFilter
                + " ORDER BY acronym COLLATE NOCASE"
                + " LIMIT " + pageSize + " OFFSET " + offset;
            data = await dbQuery(dbName, query);
            data.forEach(it => {
                videos.push({
                    vod_id: 'singer#' + it.name,
                    vod_name: it.name,
                    vod_remarks: it.region_name + ' ' + it.form_name + ' ' + it.num + '首',
                });
            });
        } else if (cid.type == 'song') {
            let customFilter = '1';
            let wd = '';
            if (extend.custom) {
                wd = extend.custom.trim();
                const words = wd.split('-');
                if (words.length > 1) {
                    customFilter = "(singer_names like '%" + words[0] + "%' AND name like '%" + words[1] + "%')";
                } else {
                    customFilter = "(singer_names like '%" + wd + "%' OR name like '%" + wd + "%')";
                }
            } else if (extend.custom_pinyin) {
                wd = extend.custom_pinyin.trim();
                const words = wd.split('-');
                if (words.length > 1) {
                    customFilter = "(acronym like '%" + words[1] + "%' AND singer_names in (SELECT name FROM singer WHERE acronym like '%" + words[0] + "%'))";
                } else {
                    // customFilter = "(acronym like '%" + wd + "%' OR singer_names in (SELECT name FROM singer WHERE acronym like '%" + wd + "%'))";
                    customFilter = "(acronym like '%" + wd + "%')";
                }
            }
            query = "SELECT name, singer_names, number, format"
                + " FROM song"
                + " WHERE " + customFilter
                + " ORDER BY acronym COLLATE NOCASE"
                + " LIMIT " + pageSize + " OFFSET " + offset;
            data = await dbQuery(dbName, query);
            data.forEach(it => {
                videos.push({
                    vod_id: fixUrl + it.number + '.' + it.format + '#' + it.singer_names + '-' + it.name + '#' + cid.lname,
                    vod_name: it.name,
                    vod_remarks: it.singer_names,
                });
            });
            if (videos.length > 1 && pg == 1) {
                query = "SELECT COUNT(*) as num FROM song WHERE " + customFilter;
                const d = await dbQuery(dbName, query);
                videos.unshift({
                    vod_id: JSON.stringify({
                        type: 'song_page',
                        id: cid.id,
                        name: cid.name + (wd == '' ? '' : '-' + wd),
                        lname: cid.lname + (wd == '' ? '' : '-' + wd),
                        filter: customFilter
                    }),
                    vod_name: cid.name + (wd == '' ? '' : '-' + wd) + ' [分页]',
                    vod_remarks: d[0].num + '首 ' + Math.floor((d[0].num - 1) / pageSize + 1) + '页',
                    vod_tag: 'folder',
                    vod_style: '1',
                });
            }
        } else if (cid.type == 'song_page') {
            if (pg == 1) {
                query = "SELECT COUNT(*) as num FROM song WHERE " + cid.filter;
                data = await dbQuery(dbName, query);
                if (data.length > 0) {
                    for (let i = 0; i < data[0].num; i += pageSize) {
                        const pageNo = i / pageSize + 1;
                        const name = cid.lname + (data[0].num > pageSize ? ' (第' + pageNo + '页)' : '');
                        videos.push({
                            vod_id: 'multi_song#' + name + '#' + i + '#' + cid.filter,
                            vod_name: '第 ' + pageNo + ' 页',
                            vod_remarks: (i + 1) + '~' + (data[0].num > pageNo * pageSize ? i + pageSize : data[0].num)
                        });
                    }
                }
            }
        } else if (cid.type == '华语歌手') {
            const cate = cid.id;
            let letter = '';
            if (extend.custom_pinyin) {
                letter = extend.custom_pinyin.substring(0, 1);
            }
            const url = `https://wapi.kuwo.cn/api/www/artist/artistInfo?category=${cate}&prefix=${letter}&pn=${pg}&rn=60`;
            const _data = await req(url);
            const data = JSON.parse(_data.content).data.artistList;
            data.forEach(it => {
                videos.push({
                    vod_id: 'singer#' + it.name,
                    vod_name: it.name,
                    vod_pic: it.pic
                });
            });
        }
        return videos
    },
    二级: async function (_ids) {
        const {orId} = this;
        const id = orId;
        const urls = [];
        const ids = id.split('#');
        let _stype = ids[0];
        let _sname = ids[1];
        let _vname = '';
        let _content = '';
        let query = '';
        let data = [];
        switch (_stype) {
            case 'singer':
                _vname = '歌手搜索';
                query = "SELECT name, singer_names, number, format FROM song WHERE singer_names LIKE '%" + _sname + "%' ORDER BY acronym COLLATE NOCASE LIMIT 1000";
                data = await dbQuery(dbName, query);
                data.forEach(it => {
                    urls.push(it.singer_names + '-' + it.name + '$' + fixUrl + it.number + '.' + it.format);
                });
                break;
            case 'name':
                _vname = '歌名搜索';
                query = "SELECT name, singer_names, number, format FROM song WHERE name LIKE '%" + _sname + "%' ORDER BY acronym COLLATE NOCASE LIMIT 1000";
                data = await dbQuery(dbName, query);
                data.forEach(it => {
                    urls.push(it.singer_names + '-' + it.name + '$' + fixUrl + it.number + '.' + it.format);
                });
                break;
            case 'all':
                _vname = '混合搜索';
                query = "SELECT name, singer_names, number, format FROM song WHERE singer_names LIKE '%" + _sname + "%' OR name LIKE '%" + _sname + "%' ORDER BY acronym COLLATE NOCASE LIMIT 1000";
                data = await dbQuery(dbName, query);
                data.forEach(it => {
                    urls.push(it.singer_names + '-' + it.name + '$' + fixUrl + it.number + '.' + it.format);
                });
                break;
            case 'multi_type_song':
                _vname = '合集';
                query = "SELECT name, singer_names, number, format FROM song WHERE type_id=" + ids[2] + " AND " + ids[4] + " ORDER BY acronym COLLATE NOCASE LIMIT " + pageSize + " OFFSET " + ids[3];
                data = await dbQuery(dbName, query);
                data.forEach(it => {
                    urls.push(it.singer_names + '-' + it.name + '$' + fixUrl + it.number + '.' + it.format);
                });
                break;
            case 'multi_song':
                _vname = '合集';
                query = "SELECT name, singer_names, number, format FROM song WHERE " + ids[3] + " ORDER BY acronym COLLATE NOCASE LIMIT " + pageSize + " OFFSET " + ids[2];
                data = await dbQuery(dbName, query);
                data.forEach(it => {
                    urls.push(it.singer_names + '-' + it.name + '$' + fixUrl + it.number + '.' + it.format);
                });
                break;
            default:
                _vname = '单曲';
                _content = ids[2];
                urls.push(_sname + '$' + _stype);
                break;
        }

        let vod = {
            vod_id: id,
            vod_name: `${_vname}: ${_sname}`,
            vod_play_from: 'mv30w',
            vod_play_url: urls.join('#'),
            vod_content: _content
        };

        return vod
    },
    搜索: async function (wd, quick, pg) {
        return []
    }
}
