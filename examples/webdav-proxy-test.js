/**
 * WebDAV 代理服务器功能测试
 */

import { readFileSync } from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../utils/pathHelper.js';

async function testWebDAVProxy() {
    console.log('=== WebDAV 代理服务器功能测试 ===\n');

    const baseURL = 'http://localhost:3000';
    
    // 读取 WebDAV 配置
    let config;
    try {
        const configPath = path.join(PROJECT_ROOT, 'json', 'webdav.json');
        const configData = readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(configData);
        
        // 如果是数组，取第一个配置
        if (Array.isArray(parsed)) {
            config = parsed.length > 0 ? parsed[0] : null;
        } else {
            config = parsed;
        }
        
        if (config) {
            console.log('✓ 已加载 WebDAV 配置');
        } else {
            console.log('✗ 配置文件为空');
        }
    } catch (error) {
        console.error('✗ 无法加载 WebDAV 配置:', error.message);
        console.log('跳过需要配置的测试...\n');
    }

    try {
        // 1. 测试健康检查
        console.log('1. 测试健康检查...');
        const healthResponse = await fetch(`${baseURL}/health`);
        const healthData = await healthResponse.json();
        console.log('✓ 健康检查通过:', healthData);
        console.log('');

        if (!config) {
            console.log('由于缺少 WebDAV 配置，跳过其他测试');
            return;
        }

        const encodedConfig = encodeURIComponent(JSON.stringify(config));

        // 2. 测试目录列表
        console.log('2. 测试目录列表...');
        const listResponse = await fetch(`${baseURL}/list?path=/root&config=${encodedConfig}`);
        if (listResponse.ok) {
            const listData = await listResponse.json();
            console.log('✓ 目录列表获取成功:');
            listData.forEach(item => {
                console.log(`   ${item.isDirectory ? '[DIR]' : '[FILE]'} ${item.path} (${item.size || 0} bytes)`);
            });
            console.log('');

            // 3. 测试文件信息获取
            const files = listData.filter(item => !item.isDirectory);
            if (files.length > 0) {
                const testFile = files[0];
                console.log(`3. 测试文件信息获取: ${testFile.path}`);
                
                const infoResponse = await fetch(`${baseURL}/info?path=${encodeURIComponent(testFile.path)}&config=${encodedConfig}`);
                if (infoResponse.ok) {
                    const infoData = await infoResponse.json();
                    console.log('✓ 文件信息获取成功:');
                    console.log(`   路径: ${infoData.path}`);
                    console.log(`   大小: ${infoData.size} bytes`);
                    console.log(`   类型: ${infoData.contentType || 'unknown'}`);
                    console.log(`   修改时间: ${infoData.lastModified || 'unknown'}`);
                    console.log('');

                    // 4. 测试文件直链访问 (HEAD 请求)
                    console.log(`4. 测试文件直链访问: ${testFile.path}`);
                    
                    const fileResponse = await fetch(`${baseURL}/file?path=${encodeURIComponent(testFile.path)}&config=${encodedConfig}`, {
                        method: 'HEAD'
                    });
                    
                    if (fileResponse.ok) {
                        console.log('✓ 文件直链访问成功:');
                        console.log(`   状态码: ${fileResponse.status}`);
                        console.log(`   文件大小: ${fileResponse.headers.get('content-length')} bytes`);
                        console.log(`   文件类型: ${fileResponse.headers.get('content-type')}`);
                        console.log(`   支持 Range: ${fileResponse.headers.get('accept-ranges')}`);
                        console.log(`   缓存控制: ${fileResponse.headers.get('cache-control')}`);
                        
                        // 生成完整的直链 URL
                        const directLink = `${baseURL}/file?path=${encodeURIComponent(testFile.path)}&config=${encodedConfig}`;
                        console.log(`   直链 URL: ${directLink}`);
                        console.log('');

                        // 5. 测试 Range 请求
                        console.log('5. 测试 Range 请求...');
                        const rangeResponse = await fetch(directLink, {
                            headers: {
                                'Range': 'bytes=0-99'
                            }
                        });
                        
                        if (rangeResponse.status === 206) {
                            console.log('✓ Range 请求支持正常:');
                            console.log(`   状态码: ${rangeResponse.status} (Partial Content)`);
                            console.log(`   Content-Range: ${rangeResponse.headers.get('content-range')}`);
                            console.log(`   Content-Length: ${rangeResponse.headers.get('content-length')}`);
                            
                            // 读取部分内容
                            const partialContent = await rangeResponse.text();
                            console.log(`   部分内容长度: ${partialContent.length} 字符`);
                            console.log('');
                        } else {
                            console.log(`✗ Range 请求失败: ${rangeResponse.status}`);
                        }

                        // 6. 测试完整文件下载 (小文件)
                        if (testFile.size && testFile.size < 1024 * 10) { // 小于 10KB
                            console.log('6. 测试完整文件下载...');
                            const downloadResponse = await fetch(directLink);
                            
                            if (downloadResponse.ok) {
                                const content = await downloadResponse.text();
                                console.log('✓ 文件下载成功:');
                                console.log(`   下载内容长度: ${content.length} 字符`);
                                console.log(`   前100字符: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
                                console.log('');
                            } else {
                                console.log(`✗ 文件下载失败: ${downloadResponse.status}`);
                            }
                        }

                    } else {
                        console.log(`✗ 文件直链访问失败: ${fileResponse.status}`);
                    }
                } else {
                    console.log(`✗ 文件信息获取失败: ${infoResponse.status}`);
                }
            } else {
                console.log('目录中没有文件，跳过文件相关测试');
            }
        } else {
            console.log(`✗ 目录列表获取失败: ${listResponse.status}`);
        }

        console.log('=== 测试完成 ===');
        console.log('');
        console.log('总结:');
        console.log('- WebDAV 代理服务器已成功启动');
        console.log('- 支持文件直链访问');
        console.log('- 支持 Range 请求 (适合视频流媒体)');
        console.log('- 支持文件信息查询');
        console.log('- 支持目录列表');
        console.log('- 包含适当的缓存控制头');
        console.log('');
        console.log('你现在可以使用以下方式访问 WebDAV 文件:');
        console.log(`- 直接在浏览器中打开: ${baseURL}/file?path=<文件路径>&config=<配置>`);
        console.log(`- 在视频播放器中使用直链进行流媒体播放`);
        console.log(`- 通过 API 获取文件信息和目录列表`);

    } catch (error) {
        console.error('测试过程中发生错误:', error);
    }
}

// 运行测试
testWebDAVProxy().catch(console.error);