/**
 * 全局模块注册器
 *
 * 将drpy-node项目中的核心模块和工具库注册到全局对象（globalThis）上，
 * 使得这些模块可以在整个应用程序中直接访问，无需重复导入。
 *
 * 主要功能：
 * - 注册网络请求工具（reqs）
 * - 注册加密工具（forge）
 * - 注册实用工具集（misc, utils）
 * - 注册Cookie和环境变量管理器
 * - 注册各大网盘服务接口（夸克、UC、阿里、百度等）
 * - 注册压缩工具和网络通信组件
 * - 注册结果处理函数
 *
 * 使用场景：
 * - 在drpy源解析器中直接使用全局工具
 * - 在插件开发中访问核心功能
 * - 在脚本执行环境中提供统一的API接口
 *
 * @module dsGlobal
 * @author drpy-node
 * @since 1.0.0
 */

// import '../libs_drpy/jsonpathplus.min.js'; //htmlParser里引入过了
// globalThis.JSONbig = JSONbig; // 必须在drpyS.js里引入

// 网络请求工具 - 提供HTTP请求功能
import {getFirstLetter} from "../utils/pinyin-tool.js";
import {createFTPClient} from "../utils/ftp.js";
import {toBeijingTime} from "../utils/datetime-format.js";

globalThis.reqs = reqs;

// 加密工具库 - 提供各种加密算法和数字签名功能
globalThis.forge = forge

// 杂项工具集 - 提供各种辅助功能和实用方法
globalThis.misc = misc;

// 通用工具库 - 提供字符串处理、数据转换等常用工具
globalThis.utils = utils;

// Cookie管理器 - 处理HTTP Cookie的存储和管理
globalThis.COOKIE = COOKIE;

// 环境变量管理器 - 管理应用程序配置和环境变量
globalThis.ENV = ENV;

// 夸克网盘接口 - 提供夸克网盘的文件操作功能
globalThis.Quark = Quark;

// UC网盘接口 - 提供UC网盘的文件操作功能
globalThis.UC = UC;

// 阿里云盘接口 - 提供阿里云盘的文件操作功能
globalThis.Ali = Ali;

// 云盘通用接口 - 提供通用的云盘操作抽象
globalThis.Cloud = Cloud;

// 云盘服务接口 - 另一个云盘服务的实现
globalThis.Yun = Yun;

// 网盘通用接口 - 提供网盘操作的统一接口
globalThis.Pan = Pan;

// 百度网盘接口 - 提供百度网盘的文件操作功能
globalThis.Baidu = Baidu;

// 百度网盘接口2 - 百度网盘的另一个实现版本
globalThis.Baidu2 = Baidu2;

// 迅雷网盘
globalThis.Xun = Xun;

// webdav
globalThis.createWebDAVClient = createWebDAVClient;
// ftp
globalThis.createFTPClient = createFTPClient;

// AI服务接口 - 提供人工智能相关服务
globalThis.AIS = AIS;

// zlib压缩库 - 提供数据压缩和解压缩功能
globalThis.zlib = zlib;

// minizlib压缩库 - 轻量级的压缩库实现
globalThis.minizlib = minizlib

// XMLHttpRequest - 提供标准的HTTP请求接口
globalThis.XMLHttpRequest = XMLHttpRequest;

// WebSocket - 提供WebSocket客户端功能
globalThis.WebSocket = WebSocket;

// WebSocket服务器 - 提供WebSocket服务端功能
globalThis.WebSocketServer = WebSocketServer;

// 结果设置函数 - 用于设置和处理执行结果
globalThis.setResult = setResult;

// ds沙箱文件读写函数
// globalThis.pathLib = pathLib;

// UA
globalThis.MOBILE_UA = MOBILE_UA;
globalThis.PC_UA = PC_UA;
// 其他常用
globalThis.$js = $js;
globalThis.getFirstLetter = getFirstLetter;
globalThis.get_size = get_size;
globalThis.urljoin = urljoin;
globalThis.toBeijingTime = toBeijingTime;