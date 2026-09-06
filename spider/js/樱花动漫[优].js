/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: '樱花动漫',
  '类型': '影视',
  lang: 'ds'
})
*/

var rule = {
    title: '樱花动漫',
    host: 'http://www.yinghuadm.cn',
    url: '/index.php/vod/show/id/fyclass/page/fypage.html',
    searchUrl: '/index.php/vod/search/page/fypage/wd/+.html',
    class_name: '电视剧&电影&动画&热门推荐&其他',
    class_url: '20&21&33&23&34',
    class_parse: '',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    推荐: 'ul.c2_list li;a.tcl-img&&title;.tc_img&&data-original;.tc_wz&&Text;a.tcl-img&&href',
    一级: 'ul.c2_list li;a.tcl-img&&title;.tc_img&&data-original;.tc_wz&&Text;a.tcl-img&&href',
    二级: {
        title: 'h1&&Text',
        img: '.detail_pic .tc_img&&data-original',
        desc: '.module-info-tag&&Text',
        content: '.module-info-introduction&&Text',
        tabs: '.play-list-group-switch-item',
        lists: '.play-list-group-content:eq(#id) li'
    },

    搜索: 'ul.c2_list li;a.tcl-img&&title;a.tcl-img&&href;.tc_img&&data-original;.tc_wz&&Text'
}
