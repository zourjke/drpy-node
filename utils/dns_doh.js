/**
 * DNS over HTTPS (DOH) Utility Module
 *
 * Uses direct HTTP requests for robust DOH resolution.
 * Reads configuration from config/player.json.
 * Automatically detects system proxy (Env vars or Windows Registry) to bypass local DNS pollution.
 */

import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {HttpsProxyAgent} from 'https-proxy-agent';
import {exec} from 'child_process';
import util from 'util';
import {ENV} from './env.js'; // Import ENV utility

const execAsync = util.promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DOH Configuration
let dohServers = null;
const configPath = path.resolve(__dirname, '../config/player.json');

// Initialize Servers Lazy
function getDohServers() {
    // Check if DOH is enabled via ENV (default: 0/false)
    const enableDoh = ENV.get('enable_doh', '0') === '1' || ENV.get('enable_doh') === 'true';
    if (!enableDoh) {
        // console.log('[DOH] DOH is disabled via ENV.');
        return [];
    }

    if (dohServers) return dohServers;
    try {
        // Load config if not loaded
        if (!dohServers) {
            try {
                if (fs.existsSync(configPath)) {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    if (config.doh && Array.isArray(config.doh) && config.doh.length > 0) {
                        dohServers = config.doh.map(server => server.url);
                        console.log(`[DOH] Loaded ${dohServers.length} DOH servers from config.`);
                    }
                }
            } catch (e) {
                console.error('[DOH] Failed to load DOH config:', e.message);
            }
        }
    } catch (e) {
        console.error('[DOH] Init failed:', e.message);
        return [];
    }
    return dohServers || [];
}

// Proxy Detection Logic
let cachedProxy = null;
let lastCheckTime = 0;
let checkPromise = null;
const PROXY_CACHE_TTL = 60000; // 60 seconds cache

export function getSystemProxy() {
    // Check if system proxy detection is enabled via ENV (default: 1/true)
    const enableProxy = ENV.get('enable_system_proxy', '1') === '1' || ENV.get('enable_system_proxy') === 'true';
    if (!enableProxy) {
        // console.log('[DOH] System proxy detection is disabled via ENV.');
        return Promise.resolve(null);
    }

    const now = Date.now();
    // 1. If cache is valid (checked within 60s), return immediately
    if (lastCheckTime > 0 && (now - lastCheckTime < PROXY_CACHE_TTL)) {
        return Promise.resolve(cachedProxy);
    }

    // 2. If a check is already in progress, join it (prevent concurrent spawning)
    if (checkPromise) {
        return checkPromise;
    }

    // 3. Start a new check
    checkPromise = (async () => {
        // Timeout option for exec commands
        const execOpts = {timeout: 300};
        let detectedProxy = null;

        try {
            // ... (Checks) ...
            // 1. Check Environment Variables
            const envProxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
            if (envProxy) {
                // console.log(`[DOH] Detected proxy from env: ${envProxy}`);
                detectedProxy = envProxy;
            }

            // 2. Check Windows Registry
            else if (process.platform === 'win32') {
                try {
                    const {stdout: enableOut} = await execAsync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable', execOpts);
                    if (/0x1/.test(enableOut)) {
                        const {stdout: serverOut} = await execAsync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer', execOpts);
                        const match = serverOut.match(/ProxyServer\s+REG_SZ\s+(.*)/i);
                        if (match && match[1]) {
                            let proxyStr = match[1].trim();
                            if (proxyStr.includes('=')) {
                                const parts = proxyStr.split(';');
                                for (const part of parts) {
                                    if (part.startsWith('https=')) {
                                        proxyStr = part.substring(6);
                                        break;
                                    }
                                }
                            }
                            if (!proxyStr.startsWith('http')) {
                                proxyStr = 'http://' + proxyStr;
                            }
                            // console.log(`[DOH] Detected system proxy: ${proxyStr}`);
                            detectedProxy = proxyStr;
                        }
                    }
                } catch (e) {
                }
            }

            // 3. Check Android/Linux global http_proxy
            else if (process.platform === 'android' || process.platform === 'linux') {
                try {
                    const {stdout} = await execAsync('settings get global http_proxy', execOpts);
                    const proxyStr = stdout ? stdout.trim() : '';
                    if (proxyStr && proxyStr !== 'null' && proxyStr !== ':0') {
                        const finalProxy = proxyStr.startsWith('http') ? proxyStr : `http://${proxyStr}`;
                        // console.log(`[DOH] Detected Android/Linux system proxy: ${finalProxy}`);
                        detectedProxy = finalProxy;
                    }
                } catch (e) {
                }
            }

            // 4. Check Linux GNOME
            if (!detectedProxy && process.platform === 'linux') {
                try {
                    const {stdout: mode} = await execAsync('gsettings get org.gnome.system.proxy mode', execOpts);
                    if (mode && mode.trim().replace(/'/g, '') === 'manual') {
                        const {stdout: host} = await execAsync('gsettings get org.gnome.system.proxy.http host', execOpts);
                        const {stdout: port} = await execAsync('gsettings get org.gnome.system.proxy.http port', execOpts);
                        const hostStr = host ? host.trim().replace(/'/g, '') : '';
                        const portStr = port ? port.trim() : '';
                        if (hostStr && portStr && portStr !== '0') {
                            detectedProxy = `http://${hostStr}:${portStr}`;
                            // console.log(`[DOH] Detected GNOME proxy: ${detectedProxy}`);
                        }
                    }
                } catch (e) {
                }
            }

            // 5. Check macOS
            if (!detectedProxy && process.platform === 'darwin') {
                try {
                    const {stdout} = await execAsync('scutil --proxy', execOpts);
                    if (/HTTPEnable\s*:\s*1/.test(stdout)) {
                        const hostMatch = stdout.match(/HTTPProxy\s*:\s*([^\s]+)/);
                        const portMatch = stdout.match(/HTTPPort\s*:\s*(\d+)/);
                        if (hostMatch && hostMatch[1]) {
                            detectedProxy = `http://${hostMatch[1]}:${portMatch && portMatch[1] ? portMatch[1] : '80'}`;
                            // console.log(`[DOH] Detected macOS proxy: ${detectedProxy}`);
                        }
                    }
                } catch (e) {
                }
            }

        } catch (e) {
            console.error('[DOH] Error detecting proxy:', e.message);
        } finally {
            // Update cache
            if (detectedProxy !== cachedProxy) {
                if (detectedProxy) console.log(`[DOH] System proxy updated: ${detectedProxy}`);
                else if (cachedProxy) console.log(`[DOH] System proxy cleared`);
                cachedProxy = detectedProxy;
            }
            lastCheckTime = Date.now();
            checkPromise = null;
        }
        return cachedProxy;
    })();

    return checkPromise;
}

// Custom request function using axios
const customRequest = async (resource) => {
    try {
        const proxy = await getSystemProxy();
        const config = {
            headers: {
                'Accept': 'application/dns-json'
            },
            timeout: 5000
        };

        if (proxy) {
            config.httpsAgent = new HttpsProxyAgent(proxy);
            config.proxy = false; // Disable axios internal proxy handling to use agent
        } else {
            config.httpsAgent = new https.Agent({rejectUnauthorized: false});
        }

        const response = await axios.get(resource, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Resolve domain using DOH
 * @param {string} domain
 * @returns {Promise<string|null>} Resolved IP or null
 */
export async function resolveDoh(domain) {
    // Return immediately if it's already an IP
    if (!domain || /^(\d{1,3}\.){3}\d{1,3}$|^\[[\da-fA-F:]+\]$/.test(domain)) return domain;
    // Skip localhost
    if (domain === 'localhost' || domain === '127.0.0.1') return domain;

    try {
        const servers = getDohServers();
        if (!servers || servers.length === 0) return null;

        for (const server of servers) {
            try {
                // Construct URL
                const url = new URL(server);
                url.searchParams.set('name', domain);
                url.searchParams.set('type', 'A');
                
                const data = await customRequest(url.toString());
                
                // Parse JSON response
                // Format: https://developers.google.com/speed/public-dns/docs/doh/json
                if (data && data.Status === 0 && data.Answer) {
                    for (const ans of data.Answer) {
                        if (ans.type === 1) return ans.data; // Type 1 is A record
                    }
                }
            } catch (e) {
                // Try next server
                continue;
            }
        }
    } catch (e) {
        // console.error(`[DOH] Failed to resolve ${domain}:`, e.message);
    }
    return null;
}
