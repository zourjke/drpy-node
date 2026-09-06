<?php
/**
 * Copyright 道长所有
 * Date: 2026/01/23
 */
/**
 * PHP Spider Base Class
 * 旨在模仿 JS 版 TVBox Spider 的写法，简化 PHP 源开发
 */

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}
// 屏蔽一般警告，避免污染 JSON 输出
error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/HtmlParser.php';

abstract class BaseSpider {
    
    // 默认请求头
    protected $headers = [
        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language' => 'zh-CN,zh;q=0.9',
    ];

    /**
     * @var HtmlParser
     */
    protected $htmlParser;

    public function __construct() {
        $this->htmlParser = new HtmlParser();
    }

    /**
     * 初始化方法
     * @param string $extend 扩展参数
     */
    public function init($extend = '') {
        // 子类实现
    }

    /**
     * 获取首页分类
     * @param array $filter 筛选条件
     * @return array
     */
    public function homeContent($filter) {
        return ['class' => []];
    }

    /**
     * 获取首页推荐视频
     * @return array
     */
    public function homeVideoContent() {
        return ['list' => []];
    }

    /**
     * 获取分类详情
     * @param string $tid 分类ID
     * @param int $pg 页码
     * @param array $filter 筛选条件
     * @param array $extend 扩展参数
     * @return array
     */
    public function categoryContent($tid, $pg = 1, $filter = [], $extend = []) {
        return ['list' => [], 'page' => $pg, 'pagecount' => 1, 'limit' => 20, 'total' => 0];
    }

    /**
     * 获取视频详情
     * @param array $ids 视频ID列表
     * @return array
     */
    public function detailContent($ids) {
        return ['list' => []];
    }

    /**
     * 搜索视频
     * @param string $key 关键词
     * @param bool $quick 快速搜索
     * @param int $pg 页码
     * @return array
     */
    public function searchContent($key, $quick = false, $pg = 1) {
        return ['list' => []];
    }

    /**
     * 获取播放地址
     * @param string $flag 播放线路
     * @param string $id 视频播放ID
     * @param array $vipFlags VIP标识
     * @return array
     */
    public function playerContent($flag, $id, $vipFlags = []) {
        return ['parse' => 0, 'url' => '', 'header' => []];
    }

    /**
     * 代理请求 (可选)
     *
     * 返回五元组 [code, mediaType, content, headers, toBytes]，与 ds 源 proxy_rule 协议对齐：
     * - toBytes 缺省/0: content 为文本/字节，服务端全量返回（仅小体积内容）
     * - toBytes=2: content 为 http(s) URL，服务端 302 重定向到 /mediaProxy 流式代理
     *   （大文件/长视频推荐，headers 由服务端携带，规避播放器 302 丢自定义头）
     * 详见 docs/t4api.md「代理接口与 toBytes 协议」章节
     *
     * @param array $params
     * @return array 默认 404，避免上层空指针 500
     */
    public function localProxy($params) {
        return [404, 'text/plain', 'not found'];
    }

    /**
     * 执行 Action (可选)
     * @param string $action 动作名称
     * @param string $value 参数值
     * @return mixed
     */
    public function action($action, $value) {
        return '';
    }

    // ================== 辅助方法 ==================

    /**
     * 把媒体直链包装为服务端 mediaProxy 流式代理地址（大文件/长视频专用）
     *
     * localProxy 返回写法：
     *   return [302, 'text/html', $this->proxyMediaUrl($url, $headers, $params['__mediaProxy'] ?? ''), [], 2];
     *
     * $base 未注入（旧路由场景）时原样返回 $url，优雅降级为直连
     * @param string $url 媒体直链
     * @param array $headers 拉流所需自定义头（UA/Referer/Cookie 等），由服务端携带
     * @param string $base mediaProxy 基址，取 localProxy 的 $params['__mediaProxy']
     * @return string
     */
    public function proxyMediaUrl($url, array $headers = [], $base = '') {
        if (!$base) {
            return $url;
        }
        $qs = '?url=' . urlencode(base64_encode($url)) . '&form=base64&stream=1';
        if ($headers) {
            $qs .= '&header=' . urlencode(base64_encode(json_encode($headers, JSON_UNESCAPED_UNICODE)));
        }
        return $base . $qs;
    }

    protected function pdfa($html, $rule) {
        return $this->htmlParser->pdfa($html, $rule);
    }
    
    protected function pdfh($html, $rule, $baseUrl = '') {
        return $this->htmlParser->pdfh($html, $rule, $baseUrl);
    }
    
    protected function pd($html, $rule, $baseUrl = '') {
        if (empty($baseUrl)) {
            $baseUrl = $this->tryGetHost();
        }
        return $this->htmlParser->pd($html, $rule, $baseUrl);
    }

    /**
     * 尝试获取子类定义的 HOST 常量或属性
     */
    private function tryGetHost() {
        try {
            $ref = new ReflectionClass($this);

            // 1. 尝试获取 HOST 属性 (优先)
            if ($ref->hasProperty('HOST')) {
                $prop = $ref->getProperty('HOST');
                // PHP 8.1+ 默认可访问私有属性，只有旧版本需要手动开启
                if (PHP_VERSION_ID < 80100) {
                    $prop->setAccessible(true);
                }
                $val = $prop->getValue($this);
                if (!empty($val)) {
                    return $val;
                }
            }

            // 2. 尝试获取 const HOST 常量
            if ($ref->hasConstant('HOST')) {
                return $ref->getConstant('HOST');
            }
        } catch (Exception $e) {
            // ignore
        }
        return '';
    }

    /**
     * 快速构建分页返回结果
     * @param array $list 视频列表
     * @param int $pg 当前页码
     * @param int $total 总记录数 (可选)
     * @param int $limit 每页条数 (默认 20)
     * @return array
     */
    protected function pageResult($list, $pg, $total = 0, $limit = 20) {
        $pg = max(1, intval($pg));
        $count = count($list);
        
        if ($total > 0) {
            $pagecount = ceil($total / $limit);
        } else {
            // 如果没有提供 total，尝试根据当前列表数量估算
            if ($count < $limit) {
                // 当前页数据少于限制，说明是最后一页
                $pagecount = $pg;
                $total = ($pg - 1) * $limit + $count;
            } else {
                // 还有下一页，设置一个较大的页数
                $pagecount = 9999;
                $total = 99999;
            }
        }
        
        return [
            'list' => $list,
            'page' => $pg,
            'pagecount' => intval($pagecount),
            'limit' => intval($limit),
            'total' => intval($total)
        ];
    }

    /**
     * 封装 HTTP 请求
     * @param string $url 请求地址
     * @param array $options CURL 选项
     * @param array $headers 请求头
     * @return string|bool
     */
    protected function fetch($url, $options = [], $headers = []) {
        // 支持从 options 中传递 headers
        if (isset($options['headers'])) {
            $headers = array_merge($headers, $options['headers']);
            unset($options['headers']);
        }

        $ch = curl_init();
        
        // 1. 解析自定义 header 为关联数组
        $customHeaders = [];
        foreach ($headers as $k => $v) {
            if (is_numeric($k)) {
                // 处理 "Key: Value" 格式
                $parts = explode(':', $v, 2);
                if (count($parts) === 2) {
                    $key = trim($parts[0]);
                    $value = trim($parts[1]);
                    $customHeaders[$key] = $value;
                }
            } else {
                $customHeaders[$k] = $v;
            }
        }

        // 2. 合并请求头 (自定义覆盖默认)
        $finalHeadersMap = array_merge($this->headers, $customHeaders);

        // 3. 转换回 CURL 所需的索引数组
        $mergedHeaders = [];
        foreach ($finalHeadersMap as $k => $v) {
            if ($v === "") {
                // To send empty header in CURL, use "Header;" (no colon)
                $mergedHeaders[] = $k . ";";
            } else {
                $mergedHeaders[] = "$k: $v";
            }
        }

        $defaultOptions = [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_ENCODING => '', // 支持 GZIP 自动解压
            CURLOPT_HTTPHEADER => $mergedHeaders,
        ];

        // 处理 POST 数据
        if (isset($options['body'])) {
            $defaultOptions[CURLOPT_POST] = true;
            $defaultOptions[CURLOPT_POSTFIELDS] = $options['body'];
            unset($options['body']);
        }
        
        // 处理 Cookie
        if (isset($options['cookie'])) {
            $defaultOptions[CURLOPT_COOKIE] = $options['cookie'];
            unset($options['cookie']);
        }

        // 合并用户自定义选项
        foreach ($options as $k => $v) {
            $defaultOptions[$k] = $v;
        }

        curl_setopt_array($ch, $defaultOptions);
        $result = curl_exec($ch);
        
        if (is_resource($ch)) {
            curl_close($ch);
        }
        
        return $result;
    }

    protected function fetchJson($url, $options = []) {
        $resp = $this->fetch($url, $options);
        return json_decode($resp, true) ?: [];
    }

    /**
     * 自动运行，处理路由
     */
    public function run() {
        if (defined('DRPY_BRIDGE')) {
            return;
        }
        $ac = $_GET['ac'] ?? '';
        $t = $_GET['t'] ?? '';
        $pg = $_GET['pg'] ?? '1';
        $wd = $_GET['wd'] ?? '';
        $ids = $_GET['ids'] ?? '';
        $play = $_GET['play'] ?? ''; // 某些源使用 play 参数传递播放ID
        $flag = $_GET['flag'] ?? ''; // 播放线路
        $filter = isset($_GET['filter']) && $_GET['filter'] === 'true'; // 是否过滤
        $extend = $_GET['ext'] ?? ''; // 扩展参数
        if (!empty($extend) && is_string($extend)) {
            $decoded = json_decode(base64_decode($extend), true);
            if (is_array($decoded)) {
                $extend = $decoded;
            }
        }
        $action = $_GET['action'] ?? ''; // Action 动作
        $value = $_GET['value'] ?? ''; // Action 参数

        $this->init($extend);

        try {
            // 0. Action (优先处理)
            if ($ac === 'action') {
                echo json_encode($this->action($action, $value), JSON_UNESCAPED_UNICODE);
                return;
            }

            // 1. 播放 (Play)
            // 优先检测 play 参数或 ac=play
            if ($ac === 'play' || !empty($play)) {
                $playId = !empty($play) ? $play : ($_GET['id'] ?? '');
                echo json_encode($this->playerContent($flag, $playId), JSON_UNESCAPED_UNICODE);
                return;
            }

            // 2. 搜索 (Search)
            // 有 wd 则是搜索
            if (!empty($wd)) {
                echo json_encode($this->searchContent($wd, false, $pg), JSON_UNESCAPED_UNICODE);
                return;
            }

            // 3. 详情 (Detail)
            // 有 ids 且 ac 不为空
            if (!empty($ids) && !empty($ac)) {
                // ids 可能是逗号分隔的字符串
                $idList = explode(',', $ids);
                echo json_encode($this->detailContent($idList), JSON_UNESCAPED_UNICODE);
                return;
            }

            // 4. 分类 (Category)
            // 有 t 且 ac 不为空
            if ($t !== '' && !empty($ac)) {
                // 处理 filter
                $filterData = []; // 暂未实现复杂 filter 解析，可根据需要扩展
                echo json_encode($this->categoryContent($t, $pg, $filterData, $extend), JSON_UNESCAPED_UNICODE);
                return;
            }

            // 5. 首页 (默认)
            // 通常返回 {class: [...], list: [...]}
            // 可以分别调用 homeContent 和 homeVideoContent 合并
            $homeData = $this->homeContent($filter);
            $videoData = $this->homeVideoContent();
            
            $result = [
                'class' => $homeData['class'] ?? [],
            ];
            
            // 如果 homeContent 只有 class，合并 homeVideoContent 的 list
            if (isset($videoData['list'])) {
                $result['list'] = $videoData['list'];
            }
            // 如果 homeContent 也有 list，优先使用 homeContent 的 list (视具体逻辑而定，这里简单的合并)
            if (isset($homeData['list']) && !empty($homeData['list'])) {
                $result['list'] = $homeData['list'];
            }
            // 兼容：如果 homeContent 返回了 filters
            if (isset($homeData['filters'])) {
                $result['filters'] = $homeData['filters'];
            }

            echo json_encode($result, JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            echo json_encode(['code' => 500, 'msg' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $e) {
            echo json_encode(['code' => 500, 'msg' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
    }
}
