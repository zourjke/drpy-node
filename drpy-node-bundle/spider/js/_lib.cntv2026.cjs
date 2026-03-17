const axios = require('axios');
// ==================== 常量定义 ====================
const TS_PACKET_SIZE = 188;
const VIDEO_PID = 256;

// ==================== WASM模块初始化 ====================
const CNTVModuleFactory = require('./_lib.cntv-wasm.cjs');
let CNTVH5PlayerModule = null;
let wasmInitPromise = null;

async function initWasmModule() {
    if (CNTVH5PlayerModule) return;
    if (wasmInitPromise) return wasmInitPromise;

    wasmInitPromise = (async () => {
        if (typeof CNTVModuleFactory !== 'function') {
            console.error('ERROR: CNTVModuleFactory is not a function:', CNTVModuleFactory);
            // Try to handle if it's wrapped in default export
            if (CNTVModuleFactory && typeof CNTVModuleFactory.default === 'function') {
                CNTVH5PlayerModule = CNTVModuleFactory.default();
            } else if (CNTVModuleFactory && typeof CNTVModuleFactory.CNTVModule === 'function') {
                CNTVH5PlayerModule = CNTVModuleFactory.CNTVModule();
            } else {
                throw new Error('CNTVModuleFactory is not a function');
            }
        } else {
            CNTVH5PlayerModule = CNTVModuleFactory();
        }

        await new Promise((resolve) => {
            if (CNTVH5PlayerModule.calledRun) resolve();
            else CNTVH5PlayerModule.onRuntimeInitialized = resolve;
        });
    })();
    await wasmInitPromise;
}

// ==================== 从网络地址获取二进制数据 ====================
async function getBinaryFromUrl(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        });
        if (response.status !== 200) {
            throw new Error(`Failed to fetch binary: ${response.status} ${response.statusText}`);
        }
        return new Uint8Array(response.data);
    } catch (error) {
        throw new Error(`Request failed: ${error.message}`);
    }
}

// ==================== NAL单元处理 ====================
function findNALUnits(buffer) {
    const nalUnits = [];
    let i = 0;
    while (i < buffer.length - 3) {
        if (buffer[i] === 0x00 && buffer[i + 1] === 0x00) {
            let nalStart = -1;
            if (buffer[i + 2] === 0x01 && i + 3 < buffer.length) {
                nalStart = i + 3;
            } else if (buffer[i + 2] === 0x00 && buffer[i + 3] === 0x01 && i + 4 < buffer.length) {
                nalStart = i + 4;
            }
            if (nalStart >= 0) {
                let nextStart = buffer.length;
                for (let j = nalStart; j < buffer.length - 2; j++) {
                    if (buffer[j] === 0x00 && buffer[j + 1] === 0x00) {
                        if (buffer[j + 2] === 0x01 || (buffer[j + 2] === 0x00 && j + 3 < buffer.length && buffer[j + 3] === 0x01)) {
                            nextStart = j;
                            break;
                        }
                    }
                }
                const nalData = buffer.subarray(i, nextStart);
                if (nalData.length >= 2) {
                    const header = nalData[nalStart - i];
                    const data = nalData.subarray(nalStart - i + 1);
                    const nal = {header, data, nalUnitType: header & 0x1F};
                    nalUnits.push(nal);
                }
                i = nextStart;
                continue;
            }
        }
        i++;
    }
    return nalUnits;
}

// ==================== H.264解密核心 ====================
// 解密H.264数据，保持原始数据结构不变，直接在原buffer上修改
// 优化内存使用：避免创建不必要的buffer副本和对象
async function decryptH264InPlace(h264Data) {
    let curDate = Date.now().toString();
    const MemoryExtend = 2048;
    let vmpTag = '';

    // 预分配临时解密buffer（复用）
    const maxDecryptBufSize = 1024 * 1024; // 1MB上限，足够处理单个NAL
    const tempDecryptBuf = Buffer.allocUnsafe(maxDecryptBufSize);

    function _common(o) {
        const memory = CNTVH5PlayerModule._jsmalloc(curDate.length + MemoryExtend);
        CNTVH5PlayerModule.HEAP8.fill(0, memory, memory + curDate.length + MemoryExtend);
        CNTVH5PlayerModule.HEAP8.set(Array.from(curDate, e => e.charCodeAt(0)), memory);
        let ret;
        switch (o) {
            case "InitPlayer":
                ret = CNTVH5PlayerModule._CNTV_InitPlayer(memory);
                break;
            case "UnInitPlayer":
                ret = CNTVH5PlayerModule._CNTV_UnInitPlayer(memory);
                break;
            case "UpdatePlayer":
                vmpTag = CNTVH5PlayerModule._CNTV_UpdatePlayer(memory).toString(16);
                vmpTag = ['0'.repeat(8 - vmpTag.length), vmpTag].join('');
                ret = 0;
                break;
        }
        CNTVH5PlayerModule._jsfree(memory);
        return ret;
    }

    function InitPlayer() {
        return _common("InitPlayer");
    }

    function UnInitPlayer() {
        return _common("UnInitPlayer");
    }

    function UpdatePlayer() {
        return _common("UpdatePlayer");
    }

    // 解密到预分配的buffer，返回实际解密长度
    function decryptToBuf(srcBuf, destBuf) {
        const pageHost = "https://tv.cctv.com";
        const addr = CNTVH5PlayerModule._jsmalloc(srcBuf.length + MemoryExtend);
        const StaticCallModuleVod = {
            H264NalSet: function (e, t, i, n, r) {
                return e._CNTV_jsdecVOD7(t, i, n, r);
            },
            H265NalData: function (e, t, i, n, r) {
                return e._CNTV_jsdecVOD6(t, i, n, r);
            },
            AVS1AudioKey: function (e, t, i, n, r) {
                return e._CNTV_jsdecVOD5(t, i, n, r);
            },
            HEVC2AAC: function (e, t, i, n, r) {
                return e._CNTV_jsdecVOD4(t, i, n, r);
            },
            HASHMap: function (e, t, i, n, r) {
                return e._CNTV_jsdecVOD3(t, i, n, r);
            },
            BASE64Dec: function (e, t, i, n, r) {
                return e._CNTV_jsdecVOD2(t, i, n, r);
            },
            MediaSession: function (e, t, i, n, r) {
                return e._CNTV_jsdecVOD1(t, i, n, r);
            },
            Mp4fragment: function (e, t, i, n, r) {
                return e._CNTV_jsdecVOD0(t, i, n, r);
            },
            MpegAudio: function (e, t, i, n, r) {
                return e._CNTV_jsdecVOD8(t, i, n, r);
            },
            AACDemuxer: function (e, t, i, n, r) {
                return e._jsdecVOD(i, n, r);
            }
        };

        function StaticCallModuleVodAPI(e, t, i, n, r, a) {
            return StaticCallModuleVod[a](e, t, i, n, r);
        }

        CNTVH5PlayerModule.HEAP8.set(srcBuf, addr);
        CNTVH5PlayerModule.HEAP8.set(Array.from(pageHost, e => e.charCodeAt(0)), addr + srcBuf.length);
        const addr2 = CNTVH5PlayerModule._jsmalloc(curDate.length);
        CNTVH5PlayerModule.HEAP8.set(Array.from(curDate, e => e.charCodeAt(0)), addr2);

        for (const i in vmpTag)
            if ("0123456".includes(vmpTag[i]))
                StaticCallModuleVodAPI(CNTVH5PlayerModule, addr2, addr, srcBuf.length, pageHost.length, Object.keys(StaticCallModuleVod)[i]);

        const decRet = StaticCallModuleVodAPI(CNTVH5PlayerModule, addr2, addr, srcBuf.length, pageHost.length, Object.keys(StaticCallModuleVod)[8]);

        // 复制到预分配的buffer (HEAP8是Uint8Array，使用set方法)
        const copyLen = Math.min(decRet, destBuf.length);
        destBuf.set(CNTVH5PlayerModule.HEAP8.subarray(addr, addr + copyLen));

        CNTVH5PlayerModule._jsfree(addr);
        CNTVH5PlayerModule._jsfree(addr2);
        return decRet;
    }

    // 找到所有NAL单元的位置信息（只存储必要的位置信息，不存储数据引用）
    const nalUnits = [];  // { dataPos, dataEnd, header, nalUnitType }
    let i = 0;
    while (i < h264Data.length - 3) {
        if (h264Data[i] === 0x00 && h264Data[i + 1] === 0x00) {
            let startCodeLen = 0;
            let nalStart = -1;

            // 查找起始码
            if (h264Data[i + 2] === 0x01 && i + 3 < h264Data.length) {
                startCodeLen = 3;
                nalStart = i + 3;
            } else if (h264Data[i + 2] === 0x00 && h264Data[i + 3] === 0x01 && i + 4 < h264Data.length) {
                startCodeLen = 4;
                nalStart = i + 4;
            }

            if (nalStart >= 0) {
                // 找到下一个起始码位置
                let nextStart = h264Data.length;
                for (let j = nalStart; j < h264Data.length - 2; j++) {
                    if (h264Data[j] === 0x00 && h264Data[j + 1] === 0x00) {
                        if (h264Data[j + 2] === 0x01 || (h264Data[j + 2] === 0x00 && j + 3 < h264Data.length && h264Data[j + 3] === 0x01)) {
                            nextStart = j;
                            break;
                        }
                    }
                }

                const header = h264Data[nalStart];
                const dataStart = nalStart + 1;
                const dataEnd = nextStart;
                const nalUnitType = header & 0x1F;

                // 只存储位置信息，不存储subarray引用
                nalUnits.push({
                    dataPos: dataStart,
                    dataEnd: dataEnd,
                    header: header,
                    dataLen: dataEnd - dataStart,
                    nalUnitType: nalUnitType
                });

                i = nextStart;
                continue;
            }
        }
        i++;
    }

    // 解密并替换原始buffer中的数据（原地修改）
    let shouldDecrypt = false;
    curDate = Date.now().toString();
    InitPlayer();

    for (const nal of nalUnits) {
        UpdatePlayer();

        // 将数据复制到预分配的buffer进行解密
        const nalLen = nal.dataLen + 1; // +1 for header
        if (nalLen > maxDecryptBufSize) continue; // 跳过过大的NAL

        // 复制header + data到临时buffer
        tempDecryptBuf[0] = nal.header;
        h264Data.copy(tempDecryptBuf, 1, nal.dataPos, nal.dataEnd);

        if (nal.nalUnitType === 25) {
            shouldDecrypt = h264Data[nal.dataPos] === 1;
            if (shouldDecrypt) {
                decryptToBuf(tempDecryptBuf.subarray(0, nalLen), tempDecryptBuf);
            }
        } else if ((nal.nalUnitType === 1 || nal.nalUnitType === 5) && shouldDecrypt) {
            const decLen = decryptToBuf(tempDecryptBuf.subarray(0, nalLen), tempDecryptBuf);
            // 解密结果从索引1开始（跳过header）
            const decryptedDataLen = decLen - 1;
            const writePos = nal.dataPos;

            // 原地替换
            if (decryptedDataLen <= nal.dataLen) {
                // 解密数据更小或相等
                if (decryptedDataLen > 0) {
                    tempDecryptBuf.copy(h264Data, writePos, 1, 1 + decryptedDataLen);
                }
                if (decryptedDataLen < nal.dataLen) {
                    h264Data.fill(0, writePos + decryptedDataLen, nal.dataEnd);
                }
            } else {
                // 解密数据更大，截断
                tempDecryptBuf.copy(h264Data, writePos, 1, 1 + nal.dataLen);
            }
        }
    }
    UnInitPlayer();

    return h264Data;
}

// ==================== TS解密处理函数 ====================
async function Parse_TS(buffer) {
    // 确保WASM模块已初始化
    await initWasmModule();

    const originalTS = Buffer.from(buffer);

    // 第一遍扫描：计算视频数据总量并收集PES包信息
    const videoPESRanges = [];  // 只存储位置和长度信息，不存储数据引用
    let totalH264Size = 0;
    let currentPESDataSize = 0;
    let inPES = false;

    for (let i = 0; i < originalTS.length; i += TS_PACKET_SIZE) {
        if (i + TS_PACKET_SIZE > originalTS.length) break;
        const packet = originalTS.subarray(i, i + TS_PACKET_SIZE);
        if (packet[0] !== 0x47) continue;

        const pid = ((packet[1] & 0x1F) << 8) | packet[2];
        if (pid !== VIDEO_PID) continue;

        const payloadStart = (packet[1] & 0x40) !== 0;
        const adaptation = (packet[3] & 0x20) !== 0;
        const payload = (packet[3] & 0x10) !== 0;

        let offset = 4;
        if (adaptation && offset < 188) {
            const adaptationLen = packet[offset];
            offset += adaptationLen + 1;
        }

        if (payload && offset < 188) {
            const dataSize = 188 - offset;

            if (payloadStart) {
                // 保存上一个PES包的范围信息
                if (inPES && currentPESDataSize > 0) {
                    videoPESRanges.push({ size: currentPESDataSize });
                    totalH264Size += currentPESDataSize;
                }

                // 开始新的PES包 - 只计算数据大小
                let pesHeaderEnd = 9;
                const data = packet.subarray(offset);
                if (data.length >= 9) {
                    pesHeaderEnd = 9 + data[8];
                }
                pesHeaderEnd = Math.min(pesHeaderEnd, data.length);

                const pesPayloadSize = dataSize - pesHeaderEnd;
                currentPESDataSize = pesPayloadSize;
                inPES = true;
            } else if (inPES) {
                currentPESDataSize += dataSize;
            }
        }
    }

    // 保存最后一个PES包
    if (inPES && currentPESDataSize > 0) {
        videoPESRanges.push({ size: currentPESDataSize });
        totalH264Size += currentPESDataSize;
    }

    // 如果没有视频数据，直接返回原始TS
    if (totalH264Size === 0) {
        return originalTS;
    }

    // 第二遍扫描：一次性提取所有H.264数据到预分配的buffer
    const h264Data = Buffer.allocUnsafe(totalH264Size);
    let h264WritePos = 0;
    inPES = false;

    for (let i = 0; i < originalTS.length; i += TS_PACKET_SIZE) {
        if (i + TS_PACKET_SIZE > originalTS.length) break;
        const packet = originalTS.subarray(i, i + TS_PACKET_SIZE);
        if (packet[0] !== 0x47) continue;

        const pid = ((packet[1] & 0x1F) << 8) | packet[2];
        if (pid !== VIDEO_PID) continue;

        const payloadStart = (packet[1] & 0x40) !== 0;
        const adaptation = (packet[3] & 0x20) !== 0;
        const payload = (packet[3] & 0x10) !== 0;

        let offset = 4;
        if (adaptation && offset < 188) {
            const adaptationLen = packet[offset];
            offset += adaptationLen + 1;
        }

        if (payload && offset < 188) {
            if (payloadStart) {
                let pesHeaderEnd = 9;
                const data = packet.subarray(offset);
                if (data.length >= 9) {
                    pesHeaderEnd = 9 + data[8];
                }
                pesHeaderEnd = Math.min(pesHeaderEnd, data.length);

                const pesPayload = packet.subarray(offset + pesHeaderEnd);
                pesPayload.copy(h264Data, h264WritePos);
                h264WritePos += pesPayload.length;
                inPES = true;
            } else if (inPES) {
                const data = packet.subarray(offset);
                data.copy(h264Data, h264WritePos);
                h264WritePos += data.length;
            }
        }
    }

    // 解密H.264数据（原地修改）
    const decryptedH264 = await decryptH264InPlace(h264Data);

    // 第三遍扫描：将解密数据写回，原地修改originalTS
    let h264ReadPos = 0;

    for (let i = 0; i < originalTS.length; i += TS_PACKET_SIZE) {
        if (i + TS_PACKET_SIZE > originalTS.length) break;

        const pid = ((originalTS[i + 1] & 0x1F) << 8) | originalTS[i + 2];
        if (pid !== VIDEO_PID) continue;

        const payloadStart = (originalTS[i + 1] & 0x40) !== 0;
        const adaptation = (originalTS[i + 3] & 0x20) !== 0;
        const payload = (originalTS[i + 3] & 0x10) !== 0;

        let offset = 4;
        if (adaptation && offset < 188) {
            const adaptationLen = originalTS[i + offset];
            offset += adaptationLen + 1;
        }

        if (payload && offset < 188) {
            if (payloadStart) {
                let pesHeaderEnd = 9;
                if (offset + 9 <= 188) {
                    pesHeaderEnd = 9 + originalTS[i + offset + 8];
                }
                pesHeaderEnd = Math.min(pesHeaderEnd, 188 - offset);

                // 跳过PES头，直接写入解密后的H.264数据
                const writeOffset = i + offset + pesHeaderEnd;
                const remaining = 188 - offset - pesHeaderEnd;
                const toCopy = Math.min(remaining, decryptedH264.length - h264ReadPos);

                if (toCopy > 0) {
                    decryptedH264.copy(originalTS, writeOffset, h264ReadPos, h264ReadPos + toCopy);
                    h264ReadPos += toCopy;
                }

                // 填充剩余空间
                if (toCopy < remaining) {
                    originalTS.fill(0xFF, writeOffset + toCopy, i + 188);
                }
            } else {
                const writeOffset = i + offset;
                const remaining = 188 - offset;
                const toCopy = Math.min(remaining, decryptedH264.length - h264ReadPos);

                if (toCopy > 0) {
                    decryptedH264.copy(originalTS, writeOffset, h264ReadPos, h264ReadPos + toCopy);
                    h264ReadPos += toCopy;
                }

                if (toCopy < remaining) {
                    originalTS.fill(0xFF, writeOffset + toCopy, i + 188);
                }
            }
        }
    }

    return originalTS;
}

// ==================== 主处理函数 ====================
async function processFile(url, extension) {
    // 下载原始TS文件
    let buffer = await getBinaryFromUrl(url);

    // 如果是.ts文件，调用Parse_TS进行解密
    if (extension === '.ts') {
        buffer = await Parse_TS(buffer);
    }

    return buffer;
}

module.exports = {
    processFile,
}
