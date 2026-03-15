import axios from "axios";
import {ENV} from "../env.js";
import CryptoJS from "crypto-js";

class XunDriver {
    constructor() {
        this.regex = /https:\/\/pan.xunlei.com\/s\/(.*)\?.*?pwd=([^&]+)/;//https://pan.baidu.com/s/1kbM0KWLDpeS8I49tmwS6lQ?pwd=74j5
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            "Connection": "keep-alive",
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6"
        };
        this.api = 'https://xluser-ssl.xunlei.com/';
        this.xun_api = 'https://api-pan.xunlei.com/'
        this.captcha_token = ''
        this.parent_id = ''
        this.share_id = ''
        this.pass_code = ''
        this.pass_code_token = ''
        this.filename = 'ds'
        this.fileId = ''
        this.vodID = ''
        this.client_id = 'XW5SkOhLDjnOZP7J'
        this.x_client_id = 'XW-G4v1H72tgfJym'
        this.device_id = '652c6bb3cacdb4b80e852dfc3cb3cca4'
        this.i = 0
    }

    // 初始化方法，加载本地配置
    async init() {
        if (this.auth) {
            let info = JSON.parse(CryptoJS.enc.Base64.parse(this.auth.split('.')[1]).toString(CryptoJS.enc.Utf8))
            if (info.exp > Math.floor(Date.now() / 1000)) {
                console.log("登录成功")
            } else {
                console.log("登录过期，重新登录")
            }
        } else {
            await this.getAuth()
        }
    }

    get username() {
        return ENV.get('xun_username')
    }

    get password() {
        return ENV.get('xun_password')
    }

    get auth() {
        return ENV.get('xun_auth')
    }

    get app_auth() {
        return ENV.get('xun_app_auth')
    }

    get refresh_token() {
        return ENV.get('xun_refresh_token')
    }

    get userId() {
        return ENV.get('xun_user_id')
    }

    /**
     * 延时函数
     *
     * 创建一个Promise，在指定毫秒数后resolve，用于控制请求频率。
     *
     * @param {number} ms - 延时毫秒数
     * @returns {Promise<void>} 延时Promise
     *
     * @example
     * await delay(1000); // 延时1秒
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async execUrl(url) {
        this.link = url
        const matches = this.regex.exec(url);
        if (matches && matches[1]) {
            this.share_id = matches[1];
            this.pass_code = matches[2] || '';
        }
    }

    async login() {
        let data = JSON.stringify({
            "protocolVersion": "301",
            "sequenceNo": "1000001",
            "platformVersion": "10",
            "isCompressed": "0",
            "appid": "40",
            "clientVersion": "8.03.0.9067",
            "peerID": "c9b076a446517969dff638cd37fa9ff1",
            "appName": "ANDROID-com.xunlei.downloadprovider",
            "sdkVersion": "231500",
            "devicesign": "div101.b71a923eb0e2239842599a3c016b4098612f6cf6d6e9fd1925845ec59285716c",
            "netWorkType": "2G",
            "providerName": "NONE",
            "deviceModel": "22021211RC",
            "deviceName": "Xiaomi_22021211Rc",
            "OSVersion": "12",
            "creditkey": "",
            "hl": "zh-CN",
            "userName": this.username,
            "passWord": this.password,
            "verifyKey": "",
            "verifyCode": "",
            "isMd5Pwd": "0"
        });
        let config = {
            method: 'POST',
            url: `${this.api}xluser.core.login/v3/login`,
            headers: {
                'Content-Type': 'application/json'
            },
            data: data
        };
        let login_data = (await axios.request(config))
        if (login_data.status === 200) {
            console.log('登录成功')
            return login_data.data.sessionID;
        }
    }

    async getSignCaptcha() {
        let data = JSON.stringify({
            "client_id": this.x_client_id,
            "action": "POST:/v1/auth/signin",
            "device_id": this.device_id,
            "captcha_token": "",
            "meta": {
                "phone_number": `+86 ${this.username}`
            }
        });

        let config = {
            method: 'POST',
            url: `${this.api}v1/shield/captcha/init`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Content-Type': 'application/json'
            },
            data: data
        };
        let signin = await axios.request(config)
        if (signin.status === 200) {
            return signin.data.captcha_token
        }
    }

    async getAuth() {
        let need_auth = 1;
        if (this.auth) {
            let info = JSON.parse(CryptoJS.enc.Base64.parse(this.auth.split('.')[1]).toString(CryptoJS.enc.Utf8))
            if (info.exp > Math.floor(Date.now() / 1000)) {
                console.log("登录成功");
                need_auth = 0;
            }
        }
        if (need_auth) {
            console.log("登录过期，重新登录")
            let captcha_token = await this.getSignCaptcha();
            let data = JSON.stringify({
                "username": `+86 ${this.username}`,
                "password": this.password,
                "client_id": this.x_client_id
            });
            let config = {
                method: 'POST',
                url: `${this.api}v1/auth/signin`,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                    'Content-Type': 'application/json',
                    'accept-language': 'zh-cn',
                    'x-captcha-token': captcha_token,
                    'x-client-id': this.x_client_id,
                    'x-device-id': this.device_id
                },
                data: data
            };
            let auth_data = (await axios.request(config))
            if (auth_data.status === 200) {
                ENV.set('xun_auth', auth_data.data.token_type + " " + auth_data.data.access_token)
                ENV.set('xun_user_id', auth_data.data.user_id)
            }
            await this.safecaptcha()
        }

    }

    async safecaptcha() {
        let data = JSON.stringify({
            "client_id": this.x_client_id,
            "action": "get:/drive/v1/privilege/USER_SECURITY_TOKEN",
            "device_id": this.device_id,
            "captcha_token": "",
            "meta": {
                "username": "",
                "phone_number": "",
                "email": "",
                "package_name": "pan.xunlei.com",
                "client_version": "1.92.9",
                "captcha_sign": "1.98cda33124387df2c03dea12799af2af",
                "timestamp": "1757397551603",
                "user_id": this.userId
            }
        });
        let config = {
            method: 'POST',
            url: 'https://xluser-ssl.xunlei.com/v1/shield/captcha/init',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
                'accept-language': 'zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6',
                'content-type': 'text/plain;charset=UTF-8'
            },
            data: data
        };
        let safe = (await axios.request(config)).data
        let captcha_token = safe.captcha_token
        let cfg = {
            method: 'GET',
            url: 'https://api-pan.xunlei.com/drive/v1/privilege/USER_SECURITY_TOKEN',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'accept-language': 'zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6',
                'authorization': this.auth,
                'content-type': 'application/json',
                'x-captcha-token': captcha_token,
                'x-client-id': this.x_client_id,
                'x-device-id': this.device_id
            }
        };
        let safe_data = (await axios(cfg)).data
    }

    async getCaptcha_token(path, mth) {
        let action = `${mth}:${path}`
        let data = JSON.stringify({
            "client_id": 'Xqp0kJBXWhwaTpB6',
            "action": action,
            "device_id": "1bf91caf40093318e8040916eb7ad16a",
            "captcha_token": "",
            "meta": {
                "username": "",
                "phone_number": "",
                "email": "",
                "package_name": "pan.xunlei.com",
                "client_version": "1.92.9",
                "captcha_sign": "1.cbc20fd633c54023baab5b816228bf90",
                "timestamp": "1757383155459",
                "user_id": this.userId//this.user_id
            }
        });
        let config = {
            method: 'POST',
            url: `${this.api}v1/shield/captcha/init`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
            },
            data: data
        };
        let captcha_data = (await axios.request(config))
        if (captcha_data.status === 200) {
            return captcha_data.data.captcha_token;
        }
    }

    async getAppCaptcha_token(path, mth) {
        let action = `${mth}:${path}`
        let data = JSON.stringify({
            "client_id": "XW-G4v1H72tgfJym",
            "action": action,
            "device_id": "652c6bb3cacdb4b80e852dfc3cb3cca4",
            "captcha_token": "",
            "meta": {
                "package_name": "ThunderPanPlugin",
                "client_version": "3.1.5",
                "captcha_sign": "1.ee2cef5f061a7cdf4374df81b370d2ec",
                "timestamp": "1773293019719",
                "user_id": this.userId
            }
        });
        let config = {
            method: 'POST',
            url: `${this.api}v1/shield/captcha/init`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
            },
            data: data
        };
        let captcha_data = (await axios.request(config))
        if (captcha_data.status === 200) {
            return captcha_data.data.captcha_token;
        }
    }

    sign() {
        let x = [
            "QG3/GhopO+5+T",
            "1Sv94+ANND3lDmmw",
            "q2eTxRva8b3B5d",
            "m2",
            "VIc5CZRBMU71ENfbOh0+RgWIuzLy",
            "66M8Wpw6nkBEekOtL6e",
            "N0rucK7S8W/vrRkfPto5urIJJS8dVY0S",
            "oLAR7pdUVUAp9xcuHWzrU057aUhdCJrt",
            "6lxcykBSsfI//GR9",
            "r50cz+1I4gbU/fk8",
            "tdwzrTc4SNFC4marNGTgf05flC85A",
            "qvNVUDFjfsOMqvdi2gB8gCvtaJAIqxXs"
        ]
        const c = {
            ClientID: 'Xqp0kJBXWhwaTpB6',
            ClientVersion: '1.92.9',
            PackageName: 'pan.xunlei.com',
            DeviceID: '1bf91caf40093318e8040916eb7ad16a'
        }
        const timestamp = Date.now()
        let w = c.ClientID + c.ClientVersion + c.PackageName + c.DeviceID + '1757338961011'
        for (let i = 0; i < x.length; i++) {
            w = CryptoJS.MD5(w + x[i]).toString();
        }
        return "1." + w
    }

    async getShareList() {
        let path = '/drive/v1/share'
        let mth = 'get'
        let captcha_data = await this.getCaptcha_token(path, mth)
        let config = {
            method: 'GET',
            url: `${this.xun_api}drive/v1/share?share_id=${this.share_id}&pass_code=${this.pass_code}&limit=100&page_token=&thumbnail_size=SIZE_SMALL`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'accept-language': 'zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6',
                'authorization': '',
                'x-captcha-token': captcha_data,
                'x-client-id': 'Xqp0kJBXWhwaTpB6',
                'x-device-id': '1bf91caf40093318e8040916eb7ad16a'
            }
        };
        let sharelist = await axios.request(config)
        if (sharelist.status === 200) {
            let file = {}
            let dirs = []
            let videos = []
            this.pass_code_token = sharelist.data.pass_code_token
            sharelist.data.files.map(it => {
                if (it.mime_type === '') {
                    dirs.push(it.id)
                } else {
                    let text = /[#|'"\[\]&<>]/g
                    let name = text.test(it.name) ? it.name.replace(text, '') : it.name
                    videos.push({
                        name: name,
                        fileId: it.id,
                        share_id: this.share_id,
                        parent_id: it.parent_id,
                        pass_code_token: encodeURIComponent(this.pass_code_token)
                    })
                }
            })
            if (!(sharelist.data.title in file) && sharelist.data.title !== undefined) {
                file[sharelist.data.title] = [];
            }
            if (videos.length > 0 && sharelist.data.title !== undefined) {
                file[sharelist.data.title] = [...videos]
            }
            let result = await Promise.all(dirs.map(async (id) => this.getShareDetail(id)))
            result = result.filter(item => item !== undefined && item !== null).flat()
            if (result.length >= 0) {
                file[sharelist.data.title].push(...result);
            }
            return file
        }
    }

    async getShareDetail(id) {
        let path = '/drive/v1/share'
        let mth = 'get'
        let captcha_data = await this.getCaptcha_token(path, mth)
        let config = {
            method: 'GET',
            url: `${this.xun_api}drive/v1/share/detail?share_id=${this.share_id}&parent_id=${id}&pass_code_token=${encodeURIComponent(this.pass_code_token)}&limit=100&page_token=&thumbnail_size=SIZE_SMALL`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'accept-language': 'zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6',
                'authorization': '',
                'content-type': 'application/json',
                'x-captcha-token': captcha_data,
                'x-client-id': 'Xqp0kJBXWhwaTpB6',
                'x-device-id': '1bf91caf40093318e8040916eb7ad16a'
            }
        };
        let detail_data = await axios.request(config)
        if (detail_data.status === 200) {
            let dirs = []
            let videos = []
            detail_data.data.files.map(it => {
                if (it.mime_type === '') {
                    dirs.push(it.id)
                } else {
                    let text = /[#|'"\[\]&<>]/g
                    let name = text.test(it.name) ? it.name.replace(text, '') : it.name
                    videos.push({
                        name: name,
                        fileId: it.id,
                        share_id: this.share_id,
                        parent_id: it.parent_id,
                        pass_code_token: encodeURIComponent(this.pass_code_token)
                    })
                }
            })
            let result = await Promise.all(dirs.map(async (id) => this.getShareDetail(id)))
            result = result.filter(item => item !== undefined && item !== null)
            return [...videos, ...result.flat()];
        }
    }

    async getShareUrl(fileId, share_id, pass_code_token) {
        let path = '/drive/v1/share'
        let mth = 'get'
        let captcha_data = await this.getCaptcha_token(path, mth)
        let config = {
            method: 'GET',
            url: `${this.xun_api}drive/v1/share/file_info?pass_code_token=${encodeURIComponent(pass_code_token)}&space=&file_id=${fileId}&share_id=${share_id}&&pass_code=${this.pass_code}`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'accept-language': 'zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6',
                'authorization': '',
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                'x-captcha-token': captcha_data,
                'x-client-id': 'Xqp0kJBXWhwaTpB6',
                'x-device-id': '1bf91caf40093318e8040916eb7ad16a'
            }
        };
        let url_list = await axios.request(config)
        if (url_list.status === 200) {
            let urls = []
            url_list.data.file_info.medias.map(it => {
                if (it.link !== null) {
                    urls.push(it.media_name, it.link.url + "#isVideo=true##fastPlayMode##threads=20#")
                    urls.push("猫画" + it.media_name, `http://127.0.0.1:5575/proxy?thread=${ENV.get('thread') || 6}&chunkSize=256&url=` + encodeURIComponent(it.link.url))
                }
            })
            return urls
        }
    }

    //获取分享文件列表
    async getShareData(url) {
        if (url.startsWith('https://')) {
            await this.execUrl(url)
            return await this.getShareList()
        }
        // if(url.startsWith('magnet:')){
        //     return await this.getMagnetData(url)
        // }
    }

    async saveResult(fileId, share_id, pass_code_token) {
        let path = 'drive/v1/files'
        let mth = 'get'
        let captcha_data = await this.getAppCaptcha_token(path, mth)
        let data = JSON.stringify({
            "parent_id": this.fileId,
            "share_id": share_id,
            "pass_code_token": decodeURIComponent(pass_code_token),
            "ancestor_ids": [],
            "file_ids": [
                fileId
            ],
            "specify_parent_id": true
        });
        let config = {
            method: 'POST',
            url: `${this.xun_api}drive/v1/share/restore`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
                'accept-language': 'zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6',
                'authorization': this.auth,
                'x-captcha-token': captcha_data,
                'x-client-id': 'XW-G4v1H72tgfJym',
                'x-device-id': '652c6bb3cacdb4b80e852dfc3cb3cca4'
            },
            data: data
        };
        let file_data = await axios.request(config).catch(e => e.response)
        if (file_data.status === 200) {
            console.log("转存文件成功")
        }
        if (file_data.status === 404) {
            this.i++
            if (this.i < 3) {
                await this.saveResult(fileId, share_id, pass_code_token)
            } else {
                this.i = 0
                console.log("转存失败:" + file_data.data)
            }
        }
    }

    //转存文件
    async saveFile(fileId, share_id, pass_code_token) {
        await this.createFile()
        if (this.fileId !== '' && this.fileId !== undefined) {
            await this.delay(5000)
            await this.saveResult(fileId, share_id, pass_code_token)
        }
    }

    //查询存储文件是否存在
    async getFile() {
        if (this.auth === undefined || this.auth === '') {
            await this.getAuth()
        }
        let path = 'drive/v1/files'
        let mth = 'get'
        let captcha_data = await this.getAppCaptcha_token(path, mth)
        let url = `${this.xun_api}drive/v1/files?parent_id=&filters=%7B%22phase%22%3A%7B%22eq%22%3A%22PHASE_TYPE_COMPLETE%22%7D%2C%22trashed%22%3A%7B%22eq%22%3Afalse%7D%7D&with_audit=true&thumbnail_size=SIZE_SMALL&limit=50`
        let config = {
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'accept-language': 'zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6',
                'authorization': this.auth,
                'content-type': 'application/json',
                'x-captcha-token': captcha_data,
                'x-client-id': 'XW-G4v1H72tgfJym',
                'x-device-id': '652c6bb3cacdb4b80e852dfc3cb3cca4'
            }
        };
        let file_data = await axios.request(config)
        if (file_data.status === 200) {
            file_data.data.files.map(it => {
                if (it.name === this.filename) {
                    this.fileId = it.id;
                }
            })
        }
    }

    //创建存储文件并写入文件夹ID
    async createFile() {
        await this.getFile()
        let path = 'drive/v1/files'
        let mth = 'get'
        let captcha_data = await this.getAppCaptcha_token(path, mth)
        let data = JSON.stringify({
            "parent_id": "",
            "name": this.filename,
            "kind": "drive#folder",
            "space": ""
        });
        let config = {
            method: 'POST',
            url: `${this.xun_api}drive/v1/files`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
                'accept-language': 'zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6',
                'authorization': this.auth,
                'x-captcha-token': captcha_data,
                'x-client-id': 'XW-G4v1H72tgfJym',
                'x-device-id': '652c6bb3cacdb4b80e852dfc3cb3cca4'
            },
            data: data
        };
        let file_data = await axios.request(config).catch(e => e.response)
        if (file_data.status === 200) {
            this.fileId = file_data.data.file.id
        }
    }

    //查询存储文件内容并获取文件ID
    async getVodId() {
        let path = 'drive/v1/files'
        let mth = 'get'
        let captcha_data = await this.getAppCaptcha_token(path, mth)
        let url = `${this.xun_api}drive/v1/files?parent_id=${this.fileId}&filters=%7B%22phase%22%3A%7B%22eq%22%3A%22PHASE_TYPE_COMPLETE%22%7D%2C%22trashed%22%3A%7B%22eq%22%3Afalse%7D%7D&with_audit=true&thumbnail_size=SIZE_SMALL&limit=50`
        let config = {
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'accept-language': 'zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6',
                'authorization': this.auth,
                'content-type': 'application/json',
                'x-captcha-token': captcha_data,
                'x-client-id': 'XW-G4v1H72tgfJym',
                'x-device-id': '652c6bb3cacdb4b80e852dfc3cb3cca4'
            }
        };
        let file_data = await axios.request(config)
        if (file_data.status === 200) {
            file_data.data.files.map(it => {
                this.vodID = it.id
            })
        }
        return this.vodID
    }

    //删除文件夹所有内容
    async deleteFile() {
        await this.getFile()
        if (this.fileId !== '' && this.fileId !== undefined) {
            let path = 'drive/v1/files'
            let mth = 'get'
            let captcha_data = await this.getAppCaptcha_token(path, mth)
            let data = JSON.stringify({
                "ids": [
                    this.fileId
                ],
                "space": ""
            });
            let config = {
                method: 'POST',
                url: `${this.xun_api}drive/v1/files:batchDelete`,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                    'Content-Type': 'application/json',
                    'accept-language': 'zh,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6',
                    'authorization': this.auth,
                    'x-captcha-token': captcha_data,
                    'x-client-id': 'XW-G4v1H72tgfJym',
                    'x-device-id': '652c6bb3cacdb4b80e852dfc3cb3cca4'
                },
                data: data
            };
            let delete_data = await axios.request(config).catch(e => e.response)
            if (delete_data.status === 200) {
                console.log("删除文件成功")
            } else if (delete_data.status === 404) {
                console.log("文件未找到，删除失败")
            }
        }
    }

    async getDownload_CAPTCHA_TOKEN() {
        let data = {
            "client_id": "XW-G4v1H72tgfJym",
            "action": "GET:CAPTCHA_TOKEN",
            "device_id": "652c6bb3cacdb4b80e852dfc3cb3cca4",
            "captcha_token": "",
            "meta": {
                "package_name": "ThunderPanPlugin",
                "client_version": "3.1.1",
                "captcha_sign": "1.0eada0deeeaac52a6376f2e167fa9f29",
                "timestamp": "1757378771289",
                "user_id": this.userId
            }
        };
        let config = {
            method: 'POST',
            url: `${this.api}v1/shield/captcha/init`,
            headers: {
                "User-Agent": "thunder/12.4.4.3740 Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.215 XDASKernel/22.3.27 Safari/537.36",
                "Accept-Encoding": "gzip, deflate, br",
                "Content-Type": "application/json"
            },
            data: data
        };
        let captcha_data = (await axios.request(config))
        if (captcha_data.status === 200) {
            return captcha_data.data.captcha_token;
        }
    }

    async getAppCaptcha() {
        let data = JSON.stringify({
            "client_id": 'Xqp0kJBXWhwaTpB6',
            "action": "POST:/v1/auth/signin",
            "device_id": "652c6bb3cacdb4b80e852dfc3cb3cca4",
            "captcha_token": "",
            "meta": {
                "phone_number": `+86 ${this.username}`
            }
        });

        let config = {
            method: 'POST',
            url: `${this.api}v1/shield/captcha/init`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Content-Type': 'application/json'
            },
            data: data
        };
        let signin = await axios.request(config)
        if (signin.status === 200) {
            return signin.data.captcha_token
        }
    }

    async AppAuth() {
        if (this.app_auth) {
            let info = JSON.parse(CryptoJS.enc.Base64.parse(this.app_auth.split('.')[1]).toString(CryptoJS.enc.Utf8))
            if (info.exp > Math.floor(Date.now() / 1000)) {
                console.log("登录成功")
            } else {
                console.log("登录过期，重新登录")
                let captcha_token = await this.getAppCaptcha();
                let data = JSON.stringify({
                    "username": `+86 ${this.username}`,
                    "password": this.password,
                    "client_id": 'XW-G4v1H72tgfJym'
                });
                let config = {
                    method: 'POST',
                    url: `${this.api}v1/auth/signin`,
                    headers: {
                        "User-Agent": "thunder/12.4.4.3740 Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.215 XDASKernel/22.3.27 Safari/537.36",
                        "Content-Type": "application/json",
                        "x-captcha-token": captcha_token,
                        "x-client-id": "XW-G4v1H72tgfJym",
                        "x-device-id": "652c6bb3cacdb4b80e852dfc3cb3cca4"
                    },
                    data: data
                };
                let auth_data = (await axios.request(config))
                if (auth_data.status === 200) {
                    ENV.set('xun_refresh_token', auth_data.data.refresh_token)
                    ENV.set('xun_app_auth', auth_data.data.token_type + " " + auth_data.data.access_token)
                }
            }
        }
    }

    async getDownload_auth() {
        await this.AppAuth()
        let data = JSON.stringify({
            "client_id": "XW-G4v1H72tgfJym",
            "client_secret": "Qbaferw2knfQKqxa25EYJGtZ2_6755CMwzXBN3ctW54",
            "grant_type": "refresh_token",
            "refresh_token": this.refresh_token
        });
        let config = {
            method: 'POST',
            url: 'https://xluser-ssl.xunlei.com/v1/auth/token',
            headers: {
                'User-Agent': 'thunder/12.4.4.3740 Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.215 XDASKernel/22.3.27 Safari/537.36',
                'Content-Type': 'application/json',
                'x-client-id': 'XW-G4v1H72tgfJym',
                'x-device-id': '652c6bb3cacdb4b80e852dfc3cb3cca4',
            },
            data: data
        };
        let dwon_data = await axios(config).catch(e => e.response);
        if (dwon_data.status === 200) {
            ENV.set('xun_retoken', dwon_data.data.refresh_token);
            ENV.set('xun_App_auth', dwon_data.data.token_type + " " + dwon_data.data.access_token)
        }
    }

    //下载
    async getDownloadUrl(fileId, share_id, pass_code_token) {
        try {
            await this.getDownload_auth()
            await this.deleteFile()
            await this.delay(1000)
            await this.saveFile(fileId, share_id, pass_code_token)
            let vodID = await this.getVodId()
            let x_captcha_token = await this.getDownload_CAPTCHA_TOKEN()
            let config = {
                method: 'GET',
                url: `${this.xun_api}drive/v1/files/${vodID}?space=&with[0]=public_share_tag&usage=FETCH`,
                headers: {
                    "User-Agent": "thunder/12.4.4.3740 Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.215 XDASKernel/22.3.27 Safari/537.36",
                    "Connection": "keep-alive",
                    "Accept": "*/*",
                    "Accept-Encoding": "gzip, deflate, br",
                    "x-captcha-token": x_captcha_token,
                    "authorization": this.app_auth,
                    "content-type": "application/json",
                    "x-device-id": "652c6bb3cacdb4b80e852dfc3cb3cca4"
                }
            };
            let file_data = await axios.request(config)
            if (file_data.status === 200) {
                console.log("下载地址：" + file_data.data.links['application/octet-stream'].url || file_data.data['web_content_link'])
                return file_data.data.links['application/octet-stream'].url || file_data.data['web_content_link']
            }
        } catch (e) {
            console.log(e)
            return ''
        }

    }
}

export const Xun = new XunDriver()