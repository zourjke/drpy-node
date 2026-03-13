import dayjs from 'dayjs';
import {IOS_UA} from '../misc.js';
import {reqs} from '../req.js';
import {ENV} from "../env.js";

const apiUrl = 'https://api.aliyundrive.com';
// const openApiUrl = 'https://open.aliyundrive.com/adrive/v1.0';
const userUrl = 'https://user.aliyundrive.com'
const subtitleExts = ['srt', 'ass', 'scc', 'stl', 'ttml'];

class AliDrive {
    constructor() {
        this.shareTokenCache = {}; // 共享令牌缓存
        this.user = {}; // 用户信息
        this.oauth = {}; // OAuth 信息
        this.saveFileIdCaches = {};
        this.saveDirName = 'drpy'; // 保存目录名称
        this.CLIENT_ID = "76917ccccd4441c39457a04f6084fb2f";
        this.deviceId = 'PkDvH8q6GRgBASQOA6EMvOI8';
        this.saveDirId = null; // 保存目录ID
        this.sid = ''
        this.baseHeaders = {
            'User-Agent': IOS_UA, // 用户代理
            Referer: 'https://www.aliyundrive.com/', // 引用来源
        };
    }

    // 初始化方法，加载本地配置
    async init() {
        if (this.token) {
            console.log('阿里token获取成功：' + this.token)
        }
        if (this.ali_refresh_token === '') {
            this.oauth.access_token = null
        } else {
            let exp = JSON.parse(CryptoJS.enc.Base64.parse(this.ali_refresh_token.split('.')[1]).toString(CryptoJS.enc.Utf8))
            let now = Math.floor(Date.now() / 1000)
            if (exp.exp < now) {
                this.oauth.access_token = null
                console.log('阿里ali_refresh_token已过期,重新获取阿里ali_refresh_token')
            } else {
                this.oauth.access_token = this.ali_refresh_token
                console.log('阿里ali_refresh_token未过期，继续使用,可使用时间截止到：' + (new Date(exp.exp * 1000)).toLocaleString())
                console.log('阿里ali_refresh_token获取成功：' + this.ali_refresh_token)
            }
        }
    }

    get token() {
        // console.log('env.cookie.quark:',ENV.get('quark_cookie'));
        return ENV.get('ali_token');
    }

    get ali_refresh_token() {
        // console.log('env.cookie.quark:',ENV.get('quark_cookie'));
        return ENV.get('ali_refresh_token');
    }

    // 从分享链接中提取分享ID和文件夹ID
    getShareData(url) {
        const regex = /https:\/\/www\.alipan\.com\/s\/([^\\/]+)(\/folder\/([^\\/]+))?|https:\/\/www\.aliyundrive\.com\/s\/([^\\/]+)(\/folder\/([^\\/]+))?/;
        const matches = regex.exec(url);
        if (matches) {
            return {
                shareId: matches[1] || matches[4],
                folderId: matches[3] || matches[6] || 'root',
            };
        }
        return null;
    }

    // 计算两个字符串的最长公共子序列（LCS）
    lcs(str1, str2) {
        if (!str1 || !str2) {
            return {
                length: 0,
                sequence: '',
                offset: 0,
            };
        }

        let sequence = '';
        const str1Length = str1.length;
        const str2Length = str2.length;
        const num = new Array(str1Length);
        let maxlen = 0;
        let lastSubsBegin = 0;

        for (let i = 0; i < str1Length; i++) {
            const subArray = new Array(str2Length);
            for (let j = 0; j < str2Length; j++) {
                subArray[j] = 0;
            }
            num[i] = subArray;
        }
        let thisSubsBegin = null;
        for (let i = 0; i < str1Length; i++) {
            for (let j = 0; j < str2Length; j++) {
                if (str1[i] !== str2[j]) {
                    num[i][j] = 0;
                } else {
                    if (i === 0 || j === 0) {
                        num[i][j] = 1;
                    } else {
                        num[i][j] = 1 + num[i - 1][j - 1];
                    }

                    if (num[i][j] > maxlen) {
                        maxlen = num[i][j];
                        thisSubsBegin = i - num[i][j] + 1;
                        if (lastSubsBegin === thisSubsBegin) {
                            sequence += str1[i];
                        } else {
                            lastSubsBegin = thisSubsBegin;
                            sequence = ''; // clear it
                            sequence += str1.substr(lastSubsBegin, i + 1 - lastSubsBegin);
                        }
                    }
                }
            }
        }
        return {
            length: maxlen,
            sequence: sequence,
            offset: thisSubsBegin,
        };
    }

    // 找到最佳的最长公共子序列匹配
    findBestLCS(mainItem, targetItems) {
        const results = [];
        let bestMatchIndex = 0;

        for (let i = 0; i < targetItems.length; i++) {
            const currentLCS = this.lcs(mainItem.name, targetItems[i].name);
            results.push({target: targetItems[i], lcs: currentLCS});
            if (currentLCS.length > results[bestMatchIndex].lcs.length) {
                bestMatchIndex = i;
            }
        }

        const bestMatch = results[bestMatchIndex];

        return {allLCS: results, bestMatch: bestMatch, bestMatchIndex: bestMatchIndex};
    }

    // 延迟函数
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // 发送API请求
    async api(url, data, headers, retry) {
        headers = headers || {};
        const auth = url.startsWith('adrive/');
        Object.assign(headers, this.baseHeaders);
        if (auth) {
            await this.refreshAccessToken()
            Object.assign(headers, {
                Authorization: this.user.auth,
            });
        }

        const resp = await reqs
            .post(`${apiUrl}/${url}`, data, {
                headers: headers,
            })
            .catch((err) => {
                console.error(err);
                return err.response || {status: 500, data: {}};
            });
        if (resp.status === 401) {
            console.error('请求未授权，尝试刷新 Token 并重试');
            await this.refreshAccessToken();
            Object.assign(headers, {
                Authorization: this.user.auth,
            });
            return await this.api(url, data, headers, retry - 1);
        } else if (resp.status === 429 && retry > 0) {
            console.error('请求频繁，请稍后再试');
            await this.delay(1000);
            await this.refreshAccessToken();
            return await this.api(url, data, headers, retry - 1);
        }
        return resp.data || {};
    }

    // 发送开放API请求
    async openApi(url, data, headers, retry = 3) {
        headers = headers || {};
        let resp = ''
        if (url.startsWith('http')) {
            Object.assign(headers, {
                Authorization: "Bearer " + this.oauth.access_token,
            });
            resp = await reqs
                .post(`${url}`, data, {
                    headers: headers,
                })
                .catch((err) => {
                    console.error(err);
                    return err.response || {status: 500, data: {}};
                });
        } else {
            Object.assign(headers, {
                Authorization: this.user.auth,
            });
            resp = await reqs
                .post(`${apiUrl}/${url}`, data, {
                    headers: headers,
                })
                .catch((err) => {
                    console.error(err);
                    return err.response || {status: 500, data: {}};
                });
        }

        if (resp.status === 429 && retry > 0) {
            await this.delay(1000);
            return await this.api(url, data, headers, retry - 1);
        }
        return resp.data || {};
    }

    //alist获取授权码
    // async getCode(auth){
    //     const url = `https://open.aliyundrive.com/oauth/users/authorize?client_id=${this.CLIENT_ID}&redirect_uri=https://alist.nn.ci/tool/aliyundrive/callback&scope=user:base,file:all:read,file:all:write&state=Ojo%3D&response_type=code&relogin=true`
    //     let data = JSON.stringify({
    //         "scope": "user:base,file:all:read,file:all:write",
    //         "authorize": 1,
    //         "drives": [
    //             "backup",
    //             "resource"
    //         ],
    //         "folder": ""
    //     })
    //     let headers = {
    //         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    //         'Accept': 'application/json, text/plain, */*',
    //         'Accept-Encoding': 'gzip, deflate, br, zstd',
    //         'Content-Type': 'application/json',
    //     }
    //     Object.assign(headers, {
    //         Authorization: auth,
    //     });
    //     const res = await reqs.post(url,data,{headers})
    //     const parsedUrl = new URL(res.data.redirectUri);
    //     return parsedUrl.searchParams.get("code");
    // }
    //
    // // 获取 OAuth Token
    // async openAuth() {
    //     if (!this.oauth.access_token || this.oauth.expire_time - dayjs().unix() < 120 && this.user.auth) {
    //         try {
    //             const code = await this.getCode(this.user.auth)
    //             const response = await reqs.post('https://api.nn.ci/alist/ali_open/code', {
    //                     "code": code,
    //                     "grant_type": "authorization_code",
    //                     "client_id": "",
    //                     "client_secret": ""
    //                 }, {
    //                     headers: {
    //                         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    //                         'Content-Type': 'application/json',
    //                         'origin': 'https://alist.nn.ci',
    //                         'referer': 'https://alist.nn.ci/'
    //                     }
    //                 })
    //                 if (response.status === 200) {
    //                     this.oauth = response.data;
    //                     const info = JSON.parse(CryptoJS.enc.Base64.parse(this.oauth.access_token.split('.')[1]).toString(CryptoJS.enc.Utf8));
    //                     this.oauth.expire_time = info.exp;
    //                     this.oauth.auth = `${this.oauth.token_type} ${this.oauth.access_token}`;
    //                     await ENV.set('ali_refresh_token', this.oauth.access_token);
    //                     // await ENV.set('oauth_cache', this.oauth);
    //                     console.log("授权成功")
    //                 }
    //         } catch(err){
    //             if(err.status === '429'){
    //                 console.error('请求频繁，请稍后再试')
    //             }else if(err.status === '401'){
    //                 console.error("授权未成功，请重新授权")
    //             }
    //             return err.response || {status: 500, data: {}};
    //         }
    //
    //     }else {
    //         console.log("已授权")
    //     }
    // }

    // 获取 drive_sid
    async getDriveSid() {
        let data = JSON.stringify({
            "scopes": [
                "user:base",
                "file:all:read",
                "file:all:write"
            ],
            "width": 300,
            "height": 300
        });
        let headers = {
            'Content-Type': 'application/json'
        }
        let resp = await reqs.post('https://aliyundrive-oauth.messense.me/oauth/authorize/qrcode', data, {headers})
        if (resp.data.sid) {
            this.sid = resp.data.sid
        }
    }

    //drive_flag
    async getDriveFlag() {
        let body = {
            "authorize": 1,
            "scope": "user:base,file:all:read,file:all:write",
            "drives": ["backup", "resource"],
            "scopes": ["user:base", "file:all:read", "file:all:write"],
            "sid": this.sid
        }
        let headers = {
            'authorization': this.user.auth
        };
        let resp = await reqs.post('https://open.aliyundrive.com/oauth/users/qrcode/authorize?sid=' + this.sid, body, {headers})
        return resp.data.result
    }

    //drive_status
    async getDriveCode() {
        let status = await reqs.get(`https://openapi.aliyundrive.com/oauth/qrcode/${this.sid}/status`)
        if (status.data.status === 'LoginSuccess') {
            return status.data.authCode
        }
    }

    // drive获取授权码
    async driveAuth() {
        await this.init()
        if (!this.oauth.access_token || this.oauth.expire_time - dayjs().unix() < 120 && this.user.auth) {
            let headers = this.baseHeaders
            Object.assign(headers, {
                'Authorization': this.user.auth,
            })
            await this.getDriveSid()
            let flag = await this.getDriveFlag()
            if (flag) {
                let code = await this.getDriveCode()
                let data = {
                    code: code,
                    grant_type: "authorization_code"
                }
                let response = await reqs.post('https://aliyundrive-oauth.messense.me/oauth/access_token', data)
                if (response.status === 200) {
                    this.oauth = response.data;
                    const info = JSON.parse(CryptoJS.enc.Base64.parse(this.oauth.access_token.split('.')[1]).toString(CryptoJS.enc.Utf8));
                    this.oauth.expire_time = info.exp;
                    this.oauth.auth = `${this.oauth.token_type} ${this.oauth.access_token}`;
                    await ENV.set('ali_refresh_token', this.oauth.access_token);
                    // await ENV.set('oauth_cache', this.oauth);
                    console.log("授权成功")
                }
            }
        } else {
            console.log("已授权，无需再授权")
        }
    }

    // 登录并获取用户信息
    async refreshAccessToken() {
        if (!this.user.user_id || this.user.expire_time - dayjs().unix() < 120) {
            let loginResp = await reqs
                .post(
                    'https://auth.aliyundrive.com/v2/account/token',
                    {
                        refresh_token: this.user.refresh_token || this.token,
                        grant_type: 'refresh_token',
                    },
                    {headers: this.baseHeaders}
                )
                .catch((err) => {
                    return err.response || {status: 500, data: {}};
                });
            if (loginResp.status === 200) {
                this.user = loginResp.data;
                this.user.expire_time = dayjs(loginResp.data.expire_time).unix();
                this.user.auth = `${this.user.token_type} ${this.user.access_token}`;
                ENV.set('ali_token', this.user.refresh_token);
                // await ENV.set('user_cache', this.user);
            } else {
                console.error('刷新 Access Token 失败');
            }
        }
    }

    // 清除保存目录中的文件
    async clearSaveDir() {
        const listData = await this.openApi(`adrive/v3/file/list`, {
            drive_id: this.user.drive.resource_drive_id,
            parent_file_id: this.saveDirId,
            limit: 100,
            order_by: 'updated_at',
            order_direction: 'DESC',
        });
        if (listData.items) {
            for (const item of listData.items) {
                const del = await this.openApi(`v2/recyclebin/trash`, {
                    drive_id: this.user.drive.resource_drive_id,
                    file_id: item.file_id,
                });
                console.log(del);
            }
        }
    }

    // 创建保存目录
    async createSaveDir(clean) {
        if (!this.user.device_id) return;
        if (this.saveDirId) {
            if (clean) await this.clearSaveDir();
            return;
        }
        let driveInfo = await this.userApi(`/v2/user/get`, {});
        if (driveInfo.resource_drive_id) {
            this.user.drive = driveInfo;
            const resource_drive_id = driveInfo.resource_drive_id;
            const listData = await this.openApi(`adrive/v3/file/list`, {
                drive_id: resource_drive_id,
                parent_file_id: 'root',
                limit: 100,
                order_by: 'updated_at',
                order_direction: 'DESC',
            });
            if (listData.items) {
                for (const item of listData.items) {
                    if (item.name === this.saveDirName) {
                        this.saveDirId = item.file_id;
                        await this.clearSaveDir();
                        break;
                    }
                }
                if (!this.saveDirId) {
                    const create = await this.openApi(`adrive/v2/file/createWithFolders`, {
                        check_name_mode: 'refuse',
                        drive_id: resource_drive_id,
                        name: this.saveDirName,
                        parent_file_id: 'root',
                        type: 'folder',
                    });
                    console.log(create);
                    if (create.file_id) {
                        this.saveDirId = create.file_id;
                    }
                }
            }
        }
    }

    // 获取共享令牌
    async getShareToken(shareData) {
        if (!this.shareTokenCache[shareData.shareId] || this.shareTokenCache[shareData.shareId].expire_time - dayjs().unix() < 120) {
            delete this.shareTokenCache[shareData.shareId];
            const shareToken = await this.api(`v2/share_link/get_share_token`, {
                share_id: shareData.shareId,
                share_pwd: shareData.sharePwd || '',
            });
            if (shareToken.expire_time) {
                shareToken.expire_time = dayjs(shareToken.expire_time).unix();
                this.shareTokenCache[shareData.shareId] = shareToken;
            }
        }
    }

    // 根据分享链接获取文件列表
    async getFilesByShareUrl(shareInfo) {
        const shareData = typeof shareInfo === 'string' ? this.getShareData(shareInfo) : shareInfo;
        if (!shareData) return [];
        await this.getShareToken(shareData);
        if (!this.shareTokenCache[shareData.shareId]) return [];

        const videos = [];
        const subtitles = [];
        const listFile = async (shareId, folderId, nextMarker) => {
            const listData = await this.api(
                `adrive/v2/file/list_by_share`,
                {
                    share_id: shareId,
                    parent_file_id: folderId,
                    limit: 200,
                    order_by: 'name',
                    order_direction: 'ASC',
                    marker: nextMarker || '',
                },
                {
                    'X-Share-Token': this.shareTokenCache[shareId].share_token,
                }
            );

            const items = listData.items;
            if (!items) return [];

            if (listData.next_marker) {
                const nextItems = await listFile(shareId, folderId, listData.next_marker);
                for (const item of nextItems) {
                    items.push(item);
                }
            }

            const subDir = [];

            for (const item of items) {
                if (item.type === 'folder') {
                    subDir.push(item);
                } else if (item.type === 'file' && item.category === 'video') {
                    let text = /[#|'"\[\]&<>]/g
                    if (item.size < 1024 * 1024 * 5) continue;
                    item.name = item.name.replace(/玩偶哥.*【神秘的哥哥们】/g, '');
                    item.name = text.test(item.name) ? item.name.replace(text, '') : item.name
                    videos.push(item);
                } else if (item.type === 'file' && subtitleExts.some((x) => item.file_extension.endsWith(x))) {
                    subtitles.push(item);
                }
            }

            for (const dir of subDir) {
                const subItems = await listFile(dir.share_id, dir.file_id);
                for (const item of subItems) {
                    items.push(item);
                }
            }

            return items;
        };
        await listFile(shareData.shareId, shareData.folderId);
        if (subtitles.length > 0) {
            videos.forEach((item) => {
                const matchSubtitle = this.findBestLCS(item, subtitles);
                if (matchSubtitle.bestMatch) {
                    item.subtitle = matchSubtitle.bestMatch.target;
                }
            });
        }

        return videos;
    }

    // 保存文件到指定目录
    async save(shareId, fileId, clean) {
        await this.refreshAccessToken();
        await this.driveAuth()
        // await this.openAuth();
        await this.createSaveDir(clean);
        if (clean) {
            const saves = Object.keys(this.saveFileIdCaches);
            for (const save of saves) {
                delete this.saveFileIdCaches[save];
            }
        }
        if (!this.saveDirId) return null;
        await this.getShareToken({
            shareId: shareId,
        });
        if (!this.shareTokenCache[shareId]) return null;

        const saveResult = await this.api(
            `adrive/v2/file/copy`,
            {
                file_id: fileId,
                share_id: shareId,
                auto_rename: true,
                to_parent_file_id: this.saveDirId,
                to_drive_id: this.user.drive.resource_drive_id,
            },
            {
                'X-Share-Token': this.shareTokenCache[shareId].share_token,
            }
        );
        if (saveResult.file_id) return saveResult.file_id;
        return false;
    }

    // 获取实时转码信息
    async getLiveTranscoding(shareId, fileId) {
        if (!this.saveFileIdCaches[fileId]) {
            const saveFileId = await this.save(shareId, fileId, true);
            if (!saveFileId) return null;
            this.saveFileIdCaches[fileId] = saveFileId;
        }
        const transcoding = await this.openApi(`v2/file/get_video_preview_play_info`, {
            file_id: this.saveFileIdCaches[fileId],
            drive_id: this.user.drive.resource_drive_id,
            category: 'live_transcoding',
            url_expire_sec: '14400',
        });
        if (transcoding.video_preview_play_info && transcoding.video_preview_play_info.live_transcoding_task_list) {
            return transcoding.video_preview_play_info.live_transcoding_task_list;
        }
        return null;
    }

    // 获取下载链接
    async getDownload(shareId, fileId) {
        if (!this.saveFileIdCaches[fileId]) {
            const saveFileId = await this.save(shareId, fileId, true);
            if (!saveFileId) return null;
            this.saveFileIdCaches[fileId] = saveFileId;
        }
        const down = await this.openApi(`https://open.aliyundrive.com/adrive/v1.0/openFile/getDownloadUrl`, {
            file_id: this.saveFileIdCaches[fileId],
            drive_id: this.user.drive.resource_drive_id,
        }, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) aDrive/6.7.3 Chrome/112.0.5615.165 Electron/24.1.3.7 Safari/537.36',
            'Content-Type': 'application/json',
            'x-canary': 'client=windows,app=adrive,version=v6.7.3',
        });
        if (down.url) {
            return down;
        }
        return null;
    }

    async userApi(url, param) {
        url = url.startsWith('http') ? url : `${userUrl}${url}`;
        let headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'accept-language': 'zh-CN,zh;q=0.9',
            'referer': 'https://www.alipan.com/'
        }
        Object.assign(headers, {
            Authorization: this.user.auth,
        });
        let resp = await reqs.post(url, {param}, {headers})
        if (resp.status === 200) {
            return resp.data
        } else {
            console.log("获取用户信息失败")
            return null
        }
    }
}

export const Ali = new AliDrive();
