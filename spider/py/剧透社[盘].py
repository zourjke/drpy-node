"""
@header({
  searchable: 1,
  filterable: 1,
  quickSearch: 1,
  title: '剧透社[盘]',
  lang: 'hipy'
})
"""

import sys
import json
import re
import requests

sys.path.append('..')
from base.spider import Spider

class Spider(Spider):
    name = "剧透社"
    host = "https://1.star2.cn"
    timeout = 5000
    limit = 20
    default_image = "https://images.gamedog.cn/gamedog/imgfile/20241205/05105843u5j9.png"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    def getName(self):
        return self.name
    
    def init(self, extend=""):
        self.session = requests.Session()
        self.session.verify = False
        self.headers_with_referer = self.headers.copy()
        self.headers_with_referer["Referer"] = f"{self.host}/"
        self.session.headers.update(self.headers_with_referer)
        self.session.get(f"{self.host}/ju/", allow_redirects=True, timeout=self.timeout/1000, verify=False)
    
    def homeContent(self, filter):
        return {
            'class': [
                {"type_name": "国剧", "type_id": "ju"},
                {"type_name": "电影", "type_id": "mv"},
                {"type_name": "动漫", "type_id": "dm"},
                {"type_name": "短剧", "type_id": "dj"},
                {"type_name": "综艺", "type_id": "zy"},
                {"type_name": "韩日", "type_id": "rh"},
                {"type_name": "英美", "type_id": "ym"},
                {"type_name": "外剧", "type_id": "wj"}
            ]
        }
    
    def categoryContent(self, tid, pg, filter, extend):
        result = {
            'list': [],
            'page': pg,
            'pagecount': 9999,
            'limit': self.limit,
            'total': 999999
        }
        url = f"{self.host}/{tid}/" if pg == 1 else f"{self.host}/{tid}/?page={pg}"
            
        response = self.session.get(url, allow_redirects=True, timeout=self.timeout/1000, verify=False)
        if response.status_code == 200:
            videos = self._parse_video_list(response.text)
            result['list'] = videos
        
        return result
    
    def _parse_video_list(self, html_text):
        videos = []
        
        def build_full_url(href):
            if href.startswith("http"):
                return href
            return f"{self.host}{href}" if href.startswith("/") else f"{self.host}/{href}"
        
        pattern = r'<li[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*class="main"[^>]*>(.*?)</a>.*?</li>'
        for match in re.finditer(pattern, html_text, re.S):
            href = match.group(1)
            name = match.group(2).strip()
            
            if href and name and href.startswith("/"):
                cleaned_name = re.sub(r'^【[^】]*】', '', name).strip()
                final_name = cleaned_name if cleaned_name else name
                videos.append({
                    "vod_id": build_full_url(href),
                    "vod_name": final_name,
                    "vod_pic": self.default_image,
                    "vod_remarks": "",
                    "vod_content": final_name
                })
        
        return videos
    
    def detailContent(self, array):
        result = {'list': []}
        if array:
            vod_id = array[0]
            detail_url = vod_id if vod_id.startswith("http") else f"{self.host}{vod_id}"
            
            response = self.session.get(detail_url, allow_redirects=True, timeout=self.timeout/1000, verify=False)
            if response.status_code == 200:
                vod = self._parse_detail_page(response.text, detail_url)
                if vod:
                    result['list'] = [vod]
        return result
    
    def _parse_detail_page(self, html_text, detail_url):
        title_match = re.search(r'<h1[^>]*>(.*?)</h1>', html_text, re.S)
        title = title_match.group(1).strip() if title_match else "未知标题"
        title = re.sub(r'^【[^】]+】', '', title).strip() or "未知标题"
        
        play_url_list = []
        link_pattern = r'<a[^>]*href="([^"]*)"[^>]*>.*?</a>'
        for match in re.finditer(link_pattern, html_text, re.S):
            href = match.group(1)
            if href and "pan.baidu.com" in href:
                play_url_list.append(f"百度网盘$push://{href}")
            elif href and "pan.quark.cn" in href:
                play_url_list.append(f"夸克网盘$push://{href}")
        
        play_from = "剧透社" if play_url_list else "无资源"
        play_url = "#".join(play_url_list) if play_url_list else "暂无资源$#"
        
        return {
            "vod_id": detail_url,
            "vod_name": title,
            "vod_pic": self.default_image,
            "vod_content": title,
            "vod_remarks": "",
            "vod_play_from": play_from,
            "vod_play_url": play_url
        }
    
    def searchContent(self, key, quick, pg='1'):
        url = f"{self.host}/search/?keyword={key}"
        response = self.session.get(url, allow_redirects=True, timeout=self.timeout/1000, verify=False)
        if response.status_code == 200:
            return {'list': self._parse_video_list(response.text)}
        
        return {'list': []}
    
    def playerContent(self, flag, id, vipFlags):
        return {
            "parse": 0,
            "playUrl": "",
            "url": id,
            "header": json.dumps(self.headers)
        }
    
    def homeVideoContent(self):
        return {"list": []}
    
    def isVideoFormat(self, url):
        return False
    
    def localProxy(self, url):
        return None
    
    def manualVideoCheck(self, url):
        return None