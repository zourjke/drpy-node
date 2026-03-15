const axios = require('axios');
// const iconv = require('iconv-lite');
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
async function decryptH264InPlace(h264Data) {
    let curDate = Date.now().toString();
    const MemoryExtend = 2048;
    let vmpTag = '';

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

    function decrypt(buf) {
        const pageHost = "https://tv.cctv.com";
        const addr = CNTVH5PlayerModule._jsmalloc(buf.length + MemoryExtend);
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

        CNTVH5PlayerModule.HEAP8.set(buf, addr);
        CNTVH5PlayerModule.HEAP8.set(Array.from(pageHost, e => e.charCodeAt(0)), addr + buf.length);
        const addr2 = CNTVH5PlayerModule._jsmalloc(curDate.length);
        CNTVH5PlayerModule.HEAP8.set(Array.from(curDate, e => e.charCodeAt(0)), addr2);

        for (const i in vmpTag)
            if ("0123456".includes(vmpTag[i]))
                StaticCallModuleVodAPI(CNTVH5PlayerModule, addr2, addr, buf.length, pageHost.length, Object.keys(StaticCallModuleVod)[i]);

        const decRet = StaticCallModuleVodAPI(CNTVH5PlayerModule, addr2, addr, buf.length, pageHost.length, Object.keys(StaticCallModuleVod)[8]);
        const retBuffer = Buffer.from(CNTVH5PlayerModule.HEAP8.subarray(addr, addr + decRet));

        CNTVH5PlayerModule._jsfree(addr);
        CNTVH5PlayerModule._jsfree(addr2);
        return retBuffer;
    }

    // 找到所有NAL单元及其在原始buffer中的位置
    const nalUnits = [];
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

                nalUnits.push({
                    startCodePos: i,
                    startCodeLen: startCodeLen,
                    headerPos: nalStart,
                    dataPos: dataStart,
                    dataEnd: dataEnd,
                    header: header,
                    data: h264Data.subarray(dataStart, dataEnd),
                    nalUnitType: nalUnitType
                });

                i = nextStart;
                continue;
            }
        }
        i++;
    }

    // 解密并替换原始buffer中的数据
    let shouldDecrypt = false;
    curDate = Date.now().toString();
    InitPlayer();

    // 创建可写的buffer副本
    const resultBuffer = Buffer.from(h264Data);

    for (const nal of nalUnits) {
        UpdatePlayer();

        const bufToDecrypt = Buffer.concat([Buffer.from([nal.header]), nal.data]);
        if (nal.nalUnitType === 25) {
            shouldDecrypt = nal.data[0] === 1;
            if (shouldDecrypt) {
                decrypt(bufToDecrypt);
            }
        } else if ((nal.nalUnitType === 1 || nal.nalUnitType === 5) && shouldDecrypt) {
            const decrypted = decrypt(bufToDecrypt);
            // 直接替换原始数据，保持起始码不变
            const decryptedData = decrypted.subarray(1); // 跳过header，因为decrypted包含了header
            const writePos = nal.dataPos;

            // 如果解密后数据小于等于原始空间，直接替换
            if (decryptedData.length <= nal.dataEnd - nal.dataPos) {
                decryptedData.copy(resultBuffer, writePos);
                // 如果解密后数据更小，填充0
                if (decryptedData.length < nal.dataEnd - nal.dataPos) {
                    resultBuffer.fill(0, writePos + decryptedData.length, nal.dataEnd);
                }
            } else {
                // 解密后数据更大，截断到原始大小
                decryptedData.copy(resultBuffer, writePos, 0, nal.dataEnd - nal.dataPos);
            }
        }
    }
    UnInitPlayer();

    return resultBuffer;
}

// ==================== TS解密处理函数 ====================
async function Parse_TS(buffer) {
    // 确保WASM模块已初始化
    await initWasmModule();

    const originalTS = Buffer.from(buffer);

    // 提取所有视频PID的payload，按PES包分组
    const videoPESPackets = [];
    let currentPESPayload = [];
    let currentPESHeader = null;
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
            const data = packet.subarray(offset);

            if (payloadStart) {
                // 保存上一个PES包
                if (inPES && currentPESPayload.length > 0 && currentPESHeader) {
                    const h264Data = Buffer.concat(currentPESPayload);
                    videoPESPackets.push({
                        header: currentPESHeader,
                        data: h264Data
                    });
                }

                // 开始新的PES包 - 保存完整PES头
                // 找到PES头结束位置：检查PES_header_data_length
                // PES结构: [00 00 01] [stream_id] [len] [flags] [flags] [header_len] ...
                let pesHeaderEnd = 9;  // 最小PES头长度
                if (data.length >= 9) {
                    // 第8字节是PES_header_data_length (从0开始计数)
                    pesHeaderEnd = 9 + data[8];
                }
                pesHeaderEnd = Math.min(pesHeaderEnd, data.length);

                currentPESHeader = data.subarray(0, pesHeaderEnd);
                currentPESPayload = [data.subarray(pesHeaderEnd)];
                inPES = true;
            } else if (inPES) {
                currentPESPayload.push(data);
            }
        }
    }

    // 保存最后一个PES包
    if (inPES && currentPESPayload.length > 0 && currentPESHeader) {
        const h264Data = Buffer.concat(currentPESPayload);
        videoPESPackets.push({
            header: currentPESHeader,
            data: h264Data
        });
    }

    // 合并所有H.264数据进行解密
    let totalH264 = Buffer.alloc(0);
    for (const pes of videoPESPackets) {
        totalH264 = Buffer.concat([totalH264, pes.data]);
    }

    // 解密所有H.264数据
    const decryptedH264 = await decryptH264InPlace(totalH264);

    // 将解密后的数据按原始PES包大小分配回去
    let h264Offset = 0;
    const resultTS = Buffer.alloc(originalTS.length);

    for (let i = 0; i < originalTS.length; i += TS_PACKET_SIZE) {
        if (i + TS_PACKET_SIZE > originalTS.length) break;
        const origPacket = originalTS.subarray(i, i + TS_PACKET_SIZE);

        // 复制非视频包
        if (origPacket[0] !== 0x47) {
            origPacket.copy(resultTS, i);
            continue;
        }

        const pid = ((origPacket[1] & 0x1F) << 8) | origPacket[2];
        if (pid !== VIDEO_PID) {
            origPacket.copy(resultTS, i);
            continue;
        }

        const payloadStart = (origPacket[1] & 0x40) !== 0;
        const adaptation = (origPacket[3] & 0x20) !== 0;
        const payload = (origPacket[3] & 0x10) !== 0;

        let offset = 4;
        if (adaptation && offset < 188) {
            const adaptationLen = origPacket[offset];
            offset += adaptationLen + 1;
        }

        // 创建新包
        const newPacket = Buffer.alloc(TS_PACKET_SIZE);
        origPacket.copy(newPacket, 0, 0, offset);

        if (payload && offset < 188) {
            const data = origPacket.subarray(offset);

            if (payloadStart) {
                // PES包开始 - 复制PES头
                let pesHeaderEnd = 9;
                if (data.length >= 9) {
                    pesHeaderEnd = 9 + data[8];
                }
                pesHeaderEnd = Math.min(pesHeaderEnd, data.length);

                origPacket.copy(newPacket, offset, offset, offset + pesHeaderEnd);
                offset += pesHeaderEnd;

                // 填充解密后的H.264数据
                const remaining = TS_PACKET_SIZE - offset;
                const toCopy = Math.min(remaining, decryptedH264.length - h264Offset);
                if (toCopy > 0) {
                    decryptedH264.copy(newPacket, offset, h264Offset, h264Offset + toCopy);
                    h264Offset += toCopy;
                    offset += toCopy;
                }
                newPacket.fill(0xFF, offset);
            } else {
                // 继续填充数据
                const remaining = TS_PACKET_SIZE - offset;
                const toCopy = Math.min(remaining, decryptedH264.length - h264Offset);
                if (toCopy > 0) {
                    decryptedH264.copy(newPacket, offset, h264Offset, h264Offset + toCopy);
                    h264Offset += toCopy;
                    offset += toCopy;
                }
                newPacket.fill(0xFF, offset);
            }
        }

        newPacket.copy(resultTS, i);
    }

    return resultTS;
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
