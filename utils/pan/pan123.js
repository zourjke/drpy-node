import {log} from '../log.js';
import axios from "axios";
import {ENV} from "../env.js";
import {base64Decode} from "../../libs_drpy/crypto-util.js";


class Pan123 {
    constructor() {
        // this.regex = /https:\/\/(www.123684.com|www.123865.com|www.123912.com|www.123pan.com|www.123pan.cn|www.123592.com|123684.com|123865.com|123912.com|123pan.com|123pan.cn|123592.com)\/s\/([^\\/]+)/
        this.regex = /https?:\/\/(?:www\.)?(?:123684|123865|123912|123pan|123592)\.(?:com|cn)\/s\/([^\/]+)/;
        this.regex_ = /https?:\/\/[^\s/]+?\.123pan\.(?:com|cn)\/123pan\/([^\/]+)/
        this.api = 'https://www.123684.com/b/api/share/';
        this.loginUrl = 'https://login.123pan.com/api/user/sign_in';
        this.cate = ''
        this.shareUrl = []
    }

    async init() {
        if(this.passport){
            log("获取盘123账号成功")
        }
        if(this.password){
            log("获取盘123密码成功")
        }
        if(this.auth){
            let info = JSON.parse(CryptoJS.enc.Base64.parse(this.auth.split('.')[1]).toString(CryptoJS.enc.Utf8))
            if(info.exp > Math.floor(Date.now() / 1000)){
                log("登录成功")
            }else {
                log("登录过期，重新登录")
                await this.loin()
            }
        }else {
            log("尚未登录，开始登录")
            await this.loin()
        }
    }

    get passport(){
        return ENV.get('pan_passport')
    }

    get password(){
        return ENV.get('pan_password')
    }

    get auth(){
        return ENV.get('pan_auth')
    }

    async loin(){
        let data = JSON.stringify({
            "passport": this.passport,
            "password": this.password,
            "remember": true
        });
        let config = {
            method: 'POST',
            url: this.loginUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
                'App-Version': '43',
                'Referer': 'https://login.123pan.com/centerlogin?redirect_url=https%3A%2F%2Fwww.123684.com&source_page=website',
            },
            data: data
        };

        let auth = (await axios.request(config)).data
        ENV.set('pan_auth',auth.data.token)
    }

    // getShareData(url){
    //     this.SharePwd = ''
    //     url = decodeURIComponent(url);
    //     if(url.indexOf('提取码') > 0 && url.indexOf('?')<0){
    //         url = url.replace(/提取码:|提取码|提取码：/g,'?')
    //     }
    //     if(url.indexOf('提取码')>0 && url.indexOf('?')>0){
    //         url = url.replace(/提取码:|提取码|提取码：|/g,'')
    //     }
    //     if(url.indexOf('：')>0){
    //         url = url.replace('：','')
    //     }
    //     if(url.indexOf('pwd')>0){
    //         url = url.replace('pwd=','')
    //     }
    //     const matches = this.regex.exec(url);
    //     if(url.indexOf('?') > 0){
    //         this.SharePwd = url.split('?')[1].match(/[A-Za-z0-9]+/)[0];
    //         log(this.SharePwd)
    //     }
    //     if (matches) {
    //         if(matches[2].indexOf('?') > 0){
    //             return matches[2].split('?')[0]
    //         }else if(matches[2].indexOf('html') > 0) {
    //             return matches[2].replace('.html', '')
    //         }else {
    //             return  matches[2].match(/www/g)?matches[1]:matches[2];
    //         }
    //     }
    //     return null;
    // }

    getShareData(url) {
        // 初始化提取码
        this.SharePwd = '';
        // 解码URL（增加空值判断，避免报错）
        if (!url) return null;
        url = decodeURIComponent(url).trim();

        // 统一处理提取码相关的字符串替换（合并重复逻辑）
        url = url.replace(/提取码[:：]?|pwd=/g, '') // 合并匹配提取码关键词
            .replace(/：/g, ''); // 替换中文冒号

        // 提取分享码（核心正则匹配）
        const matches = this.regex.exec(url) || this.regex_.exec(url);
        if (!matches) return null; // 无匹配直接返回null

        // 提取提取码（增加安全判断，避免数组越界/匹配不到时报错）
        if (url.includes('?')) {
            const pwdMatch = url.split('?')[1]?.match(/[A-Za-z0-9]+/);
            this.SharePwd = pwdMatch ? pwdMatch[0] : '';
            log(this.SharePwd);
        }

        // 处理匹配到的分享ID（核心逻辑）
        let shareId = matches[1];
        // 情况1：ID中包含?，取前面部分
        if (shareId.includes('?')) {
            shareId = shareId.split('?')[0];
        }
        // 情况2：ID中包含html后缀，去掉后缀
        else if (shareId.includes('html')) {
            shareId = shareId.replace('.html', '');
        }
        // 情况3：兼容异常的www前缀（原逻辑保留）
        else if (shareId.match(/www/g)) {
            shareId = matches[1]; // 原逻辑的matches[1]实际是这里的shareId，修正逻辑歧义
        }

        // 确保返回的ID非空且有效
        return shareId?.trim() || null;
    }

    async getFilesByShareUrl(shareKey){
        let file = {}
        if(this.shareUrl.length >= 15){
            this.shareUrl = []
        }
        let cate = await this.getShareInfo(shareKey, this.SharePwd, 0, 0)
        if(cate && Array.isArray(cate)){
            await Promise.all(cate.map(async (item) => {
                if (!(item.filename in file)) {
                    file[item.filename] = [];
                }
                const fileData = await this.getShareList(item.shareKey,item.SharePwd,item.next, item.fileId);
                if (fileData && fileData.length > 0) {
                    file[item.filename].push(...fileData);
                }
            }));
        }
        // 过滤掉空数组
        for (let key in file) {
            if (file[key].length === 0) {
                delete file[key];
            }
        }
        return file;
    }

    async getShareInfo(shareKey,SharePwd,next,ParentFileId) {
        let cate = []
        let list = await axios.get(this.api+`get?limit=100&next=${next}&orderBy=file_name&orderDirection=asc&shareKey=${shareKey.trim()}&SharePwd=${SharePwd||''}&ParentFileId=${ParentFileId}&Page=1`,{
            headers: {},
        });
        if(list.status === 200){
            if(list.data.code === 5103){
                log(list.data.message);
            }else {
                let info = list.data.data;
                let next = info.Next;
                let infoList = info.InfoList
                infoList.forEach(item => {
                    if(item.Category === 0){
                        cate.push({
                            filename:item.FileName,
                            shareKey:shareKey,
                            SharePwd:SharePwd,
                            next:next,
                            fileId:item.FileId
                        });
                    }
                })
                if(cate.length === 0){
                    infoList.forEach(item => {
                        if(item.Category === 2){
                            if(item.DownloadUrl!==undefined){
                                this.shareUrl.push({
                                    id:item.FileId,
                                    url:item.DownloadUrl,
                                })
                            }
                            cate.push({
                                filename:item.FileName,
                                shareKey:shareKey,
                                SharePwd:SharePwd,
                                next:next,
                                fileId:item.FileId
                            });
                        }
                    })
                }
                let result =  await Promise.all(cate.map(async (it)=> this.getShareInfo(shareKey,SharePwd,next, it.fileId)));
                result = result.filter(item => item !== undefined && item !== null);
                return [...cate,...result.flat()];
            }
        }
    }

    async getShareList(shareKey,SharePwd,next,ParentFileId) {
        let video = []
        let link = this.api+`get?limit=100&next=${next}&orderBy=file_name&orderDirection=asc&shareKey=${shareKey.trim()}&SharePwd=${SharePwd||''}&ParentFileId=${ParentFileId}&Page=1`
        let infoList = (await axios.request({
            method:'get',
            url:link,
            headers: {

            },
        })).data;
        if(infoList.data.Next === ''){
            let list = await this.getShareList(shareKey, SharePwd, 0, 0)
            list.forEach(it=>{
                let text = /[#|'"\[\]&<>]/g
                let filename = it.FileName = text.test(it.FileName) ? it.FileName.replace(text,'') : it.FileName
                if(it.DownloadUrl!==undefined){
                    this.shareUrl.push({
                        id:it.FileId,
                        url:it.DownloadUrl,
                    })
                }
                video.push({
                    ShareKey: shareKey,
                    FileId: it.FileId,
                    S3KeyFlag: it.S3KeyFlag,
                    Size: it.Size,
                    Etag: it.Etag,
                    FileName: filename,
                })
            })
        }
        infoList.data.InfoList.forEach(it=>{
            if(it.Category === 2){
                if(it.DownloadUrl!==undefined){
                    this.shareUrl.push({
                        id:it.FileId,
                        url:it.DownloadUrl,
                    })
                }

                video.push({
                    ShareKey: shareKey,
                    FileId: it.FileId,
                    S3KeyFlag: it.S3KeyFlag,
                    Size: it.Size,
                    Etag: it.Etag,
                    FileName: it.FileName,
                })
            }
        })
        return video;
    }

    async getDownloadUrl(shareKey,FileId,S3KeyFlag,Size,Etag){
        let list = this.shareUrl
        let link = ''
        list.forEach(item=>{
            if(String(item.id) === FileId){
                link = item.url
            }
        })
        let html = await axios.get(link,{
            maxRedirects: 0,
        }).catch(e=>e.response)
        if(html.status === 302){
            let url = html.headers.get('location')
            url = url.replace('_24_24','').replace('&trade_key=123pan-thumbnail','')
            return url;
        }
    }

    async getDownload(shareKey,FileId,S3KeyFlag,Size,Etag) {
        await this.init();
        let data = JSON.stringify({
            "ShareKey": shareKey,
            "FileID": FileId,
            "S3KeyFlag": S3KeyFlag,
            "Size": Size,
            "Etag": Etag
        });
        let config = {
            method: 'POST',
            url: `${this.api}download/info`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Authorization': `Bearer ${this.auth}`,
                'Content-Type': 'application/json;charset=UTF-8',
                'platform': 'android',
            },
            data: data
        };
        let down = (await axios.request(config)).data.data
        return base64Decode((new URL(down.DownloadURL)).searchParams.get('params'));
    }

    async getLiveTranscoding(shareKey,FileId,S3KeyFlag,Size,Etag){
        await this.init();
        let config = {
            method: 'GET',
            url: `https://www.123684.com/b/api/video/play/info`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
                'Authorization': `Bearer ${this.auth}`,
                'Content-Type': 'application/json;charset=UTF-8',
                'platform': 'android',
            },
            params:{
                "etag": Etag,
                "size": Size,
                "from": "1",
                "shareKey": shareKey
            }
        };
        let down = (await axios.request(config)).data.data
        if(down?.video_play_info){
            let videoinfo = []
            down.video_play_info.forEach(item => {
                if(item.url!==''){
                    videoinfo.push({
                        name:item.resolution,
                        url:item.url
                    })
                }
            })
            return videoinfo;
        }
        return []
    }
}

export const Pan = new Pan123();
