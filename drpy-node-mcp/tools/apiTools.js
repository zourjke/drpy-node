
/**
 * API Tools for drpy-node
 * Provides documentation and information about the available API endpoints.
 */

export const get_drpy_api_list = async () => {
    const apiList = [
        {
            category: "Core Video Source API",
            endpoints: [
                {
                    path: "/api/:module",
                    method: "GET/POST",
                    description: "Main interface for video sources. Supports listing categories, details, searching, and playing.",
                    params: {
                        "module": { "type": "path", "required": true, "description": "Engine name. Available: 'drpyS', 'hipy', 'php', 'xbpq', 'catvod'" },
                        "ac": { "type": "query", "required": false, "description": "Action type. 't'=Categories/List, 'ids'=Detail, 'action'=Custom Action. If omitted with 'wd', performs search." },
                        "t": { "type": "query", "required": false, "description": "Category ID (tid) when ac=t" },
                        "pg": { "type": "query", "required": false, "description": "Page number (default: 1)" },
                        "wd": { "type": "query", "required": false, "description": "Search keyword" },
                        "ids": { "type": "query", "required": false, "description": "Comma-separated VOD IDs when ac=ids" },
                        "play": { "type": "query", "required": false, "description": "URL to resolve for playback" },
                        "flag": { "type": "query", "required": false, "description": "Playlist flag (for play action)" },
                        "filter": { "type": "query", "required": false, "description": "Filter conditions (boolean/string)" },
                        "extend": { "type": "query", "required": false, "description": "Extended info (JSON string)" }
                    }
                },
                {
                    path: "/proxy/:module/:url",
                    method: "GET",
                    description: "Proxy wrapper for source requests (headers, etc.)",
                    params: {
                        "module": "Engine name",
                        "url": "Target URL (may need encoding)"
                    }
                },
                {
                    path: "/parse/:jx",
                    method: "GET",
                    description: "Video parsing interface",
                    params: {
                        "jx": "Parser name or alias",
                        "url": "Video URL to parse"
                    }
                }
            ]
        },
        {
            category: "Configuration",
            endpoints: [
                {
                    path: "/config",
                    method: "GET",
                    description: "Get the generated JSON configuration for apps (TVBox, etc.)",
                    params: {}
                },
                {
                    path: "/config/:id",
                    method: "GET",
                    description: "Get specific configuration variant"
                }
            ]
        },
        {
            category: "System & Tools",
            endpoints: [
                {
                    path: "/",
                    method: "GET",
                    description: "Home page / README"
                },
                {
                    path: "/health",
                    method: "GET",
                    description: "Server health check"
                },
                {
                    path: "/encoder",
                    method: "POST",
                    description: "Encode text/url",
                    params: { "text": "Content to encode", "mode": "Encoding mode" }
                },
                {
                    path: "/decoder",
                    method: "POST",
                    description: "Decode text/url",
                    params: { "text": "Content to decode" }
                },
                {
                    path: "/authcoder",
                    method: "GET",
                    description: "Generate random strings",
                    params: { "len": "Length", "number": "Count" }
                },
                {
                    path: "/http",
                    method: "POST",
                    description: "HTTP Proxy Request",
                    params: { "url": "Target URL", "method": "GET/POST", "headers": "Headers object", "data": "Body data" }
                },
                {
                    path: "/ai",
                    method: "GET",
                    description: "Simple AI Chat interface",
                    params: { "text": "User input" }
                },
                {
                    path: "/req/*",
                    method: "ALL",
                    description: "Request forwarder (if enabled)"
                },
                {
                    path: "/gh/release",
                    method: "GET",
                    description: "Get latest GitHub release for drpy-node"
                },
                {
                    path: "/cat/index.html",
                    method: "GET",
                    description: "Cat interface page"
                }
            ]
        },
        {
            category: "Admin & Management",
            endpoints: [
                {
                    path: "/admin/encoder",
                    method: "GET",
                    description: "Encoder tool UI"
                },
                {
                    path: "/admin/cookie-set",
                    method: "POST",
                    description: "Set system cookies",
                    params: { "cookie_auth_code": "Auth code", "key": "Cookie key", "value": "Cookie value" }
                },
                {
                    path: "/admin/download",
                    method: "GET",
                    description: "Download page for project archives"
                }
            ]
        },
        {
            category: "Task Management",
            endpoints: [
                {
                    path: "/execute-now/:taskName?",
                    method: "GET",
                    description: "Execute a cron task immediately"
                },
                {
                    path: "/tasks",
                    method: "GET",
                    description: "List all scheduled tasks"
                },
                {
                    path: "/tasks/:taskName",
                    method: "GET",
                    description: "Get details of a specific task"
                }
            ]
        },
        {
            category: "File & Image Services",
            endpoints: [
                {
                    path: "/image/upload",
                    method: "POST",
                    description: "Upload image (base64)",
                    params: { "imageId": "Unique ID", "base64Data": "Base64 content" }
                },
                {
                    path: "/image/:imageId",
                    method: "GET",
                    description: "Get image content"
                },
                {
                    path: "/image/list",
                    method: "GET",
                    description: "List stored images"
                },
                {
                    path: "/clipboard/add",
                    method: "POST",
                    description: "Add content to clipboard",
                    params: { "text": "Content", "mode": "append/overwrite" }
                },
                {
                    path: "/clipboard/read",
                    method: "GET",
                    description: "Read clipboard content"
                },
                {
                    path: "/source-checker/reports/save",
                    method: "POST",
                    description: "Save source check report"
                },
                {
                    path: "/source-checker/reports/latest",
                    method: "GET",
                    description: "Get latest source check report"
                }
            ]
        },
        {
            category: "Proxy Services",
            endpoints: [
                {
                    path: "/unified-proxy/proxy",
                    method: "GET/HEAD",
                    description: "Unified Smart Proxy (auto detects m3u8/file)",
                    params: { "url": "Target URL", "type": "force type (optional)" }
                },
                {
                    path: "/m3u8-proxy/playlist",
                    method: "GET",
                    description: "M3U8 Playlist Proxy"
                },
                {
                    path: "/mediaProxy",
                    method: "ALL",
                    description: "General Media Proxy"
                },
                {
                    path: "/file-proxy/proxy",
                    method: "GET/HEAD",
                    description: "Remote File Proxy"
                },
                {
                    path: "/webdav/file",
                    method: "GET",
                    description: "WebDAV File Proxy"
                },
                {
                    path: "/ftp/file",
                    method: "GET/HEAD",
                    description: "FTP File Proxy"
                }
            ]
        },
        {
            category: "Realtime",
            endpoints: [
                {
                    path: "/ws",
                    method: "GET",
                    description: "WebSocket connection for logs and status"
                }
            ]
        }
    ];

    return {
        content: [{
            type: "text",
            text: JSON.stringify(apiList, null, 2)
        }]
    };
};
