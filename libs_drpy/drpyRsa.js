import crypto from 'crypto';

export const RSA = {
    // 清理 PEM 格式，提取 base64 内容
    cleanPEM: function (pem) {
        return pem
            .replace(/-----BEGIN[^-]+-----/g, '')
            .replace(/-----END[^-]+-----/g, '')
            .replace(/\s+/g, '');
    },
    // 格式化私钥为标准 PEM 格式
    formatPrivateKey: function (pem) {
        if (pem.includes('-----BEGIN')) {
            return pem;
        }
        return `-----BEGIN RSA PRIVATE KEY-----\n${pem}\n-----END RSA PRIVATE KEY-----`;
    },

    // 格式化公钥为标准 PEM 格式
    formatPublicKey: function (pem) {
        if (pem.includes('-----BEGIN')) {
            return pem;
        }
        return `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----`;
    },

    // 从私钥提取公钥
    extractPublicKeyFromPrivate: function (privateKeyPem) {
        const privateKey = this.formatPrivateKey(privateKeyPem);

        try {
            // 使用Node.js crypto模块从私钥创建公钥
            const keyObject = crypto.createPrivateKey({
                key: privateKey,
                format: 'pem',
                type: 'pkcs1'
            });
            const publicKey = crypto.createPublicKey(keyObject);
            return publicKey.export({type: 'spki', format: 'pem'});
        } catch (error) {
            console.error("PKCS1格式失败:", error.message);
            // 如果PKCS1格式失败，尝试PKCS8格式
            try {
                const keyObject = crypto.createPrivateKey({
                    key: privateKey,
                    format: 'pem',
                    type: 'pkcs8'
                });
                const publicKey = crypto.createPublicKey(keyObject);
                return publicKey.export({type: 'spki', format: 'pem'});
            } catch (error2) {
                console.error("PKCS8格式也失败:", error2.message);
                throw error;
            }
        }
    },

    // 手动移除 PKCS1 填充
    removePKCS1Padding: function (buffer) {
        // PKCS1 填充格式: 0x00 0x02 [随机字节] 0x00 [数据]
        if (buffer[0] !== 0x00 || buffer[1] !== 0x02) {
            throw new Error('Invalid PKCS1 padding');
        }

        // 找到第二个 0x00 字节，它标志着填充的结束
        let dataStart = -1;
        for (let i = 2; i < buffer.length; i++) {
            if (buffer[i] === 0x00) {
                dataStart = i + 1;
                break;
            }
        }

        if (dataStart === -1) {
            throw new Error('Invalid PKCS1 padding: no data separator found');
        }

        return buffer.slice(dataStart);
    },

    // 分段解密长数据
    decryptLongData: function (privateKey, encryptedData) {
        // 动态获取密钥大小
        let keySize;
        try {
            const keyObj = crypto.createPrivateKey(privateKey);
            const keyDetails = keyObj.asymmetricKeyDetails;
            keySize = (keyDetails.modulusLength || 2048) / 8; // 默认2048位
        } catch (error) {
            console.warn('无法获取私钥大小，使用默认值256字节:', error.message);
            keySize = 256; // 2048 bits / 8 = 256 bytes
        }
        
        const chunks = [];

        // 分段解密
        for (let i = 0; i < encryptedData.length; i += keySize) {
            const segment = encryptedData.slice(i, i + keySize);
            try {
                // 尝试不同的填充方式
                let decryptedSegment;
                try {
                    // 强制使用 NO_PADDING 避免 Node 24+ 原生 PKCS1 解密出现的乱码问题
                    // Node 24+ (OpenSSL 3.2+) 引入了对 PKCS1 的隐式拒绝机制，遇到非标准填充会返回随机乱码而不报错
                    decryptedSegment = crypto.privateDecrypt({
                        key: privateKey,
                        padding: crypto.constants.RSA_NO_PADDING
                    }, segment);
                    // 手动移除 PKCS1 填充
                    decryptedSegment = this.removePKCS1Padding(decryptedSegment);
                } catch (error) {
                    console.error('NO_PADDING 错误:', error.message);
                    throw error;
                }
                chunks.push(decryptedSegment);
            } catch (error) {
                console.error(`解密第 ${Math.floor(i / keySize) + 1} 段失败:`, error.message);
                throw error;
            }
        }

        // 合并所有解密段
        return Buffer.concat(chunks);
    },

    // 分段加密长数据
    encryptLongData: function (publicKey, data) {
        // 动态获取密钥大小
        let keySize;
        try {
            const keyObj = crypto.createPublicKey(publicKey);
            const keyDetails = keyObj.asymmetricKeyDetails;
            keySize = (keyDetails.modulusLength || 2048) / 8; // 默认2048位
        } catch (error) {
            console.warn('无法获取密钥大小，使用默认值2048位:', error.message);
            keySize = 256; // 默认2048位 = 256字节
        }

        const maxLength = keySize - 11; // 使用JSEncrypt的标准PKCS1填充开销
        const chunks = [];

        try {
            // 将Buffer转换为字符串进行Unicode边界分块
            const string = data.toString('utf8');
            let subStart = 0;
            let subEnd = 0;
            let bitLen = 0;
            let tmpPoint = 0;

            for (let i = 0, len = string.length; i < len; i++) {
                const charCode = string.charCodeAt(i);

                // 根据Unicode字符计算UTF-8字节数（与JSEncrypt相同的逻辑）
                if (charCode <= 127) {
                    bitLen += 1;
                } else if (charCode <= 2047) {
                    bitLen += 2;
                } else if (charCode <= 65535) {
                    bitLen += 3;
                } else {
                    bitLen += 4;
                }

                if (bitLen > maxLength) {
                    // 到达分块边界，加密当前段
                    const subStr = string.substring(subStart, subEnd);
                    const segment = Buffer.from(subStr, 'utf8');

                    try {
                        const encryptedSegment = crypto.publicEncrypt({
                            key: publicKey,
                            padding: crypto.constants.RSA_PKCS1_PADDING
                        }, segment);

                        chunks.push(encryptedSegment);
                    } catch (error) {
                        console.error(`加密第 ${chunks.length + 1} 段失败:`, error.message);
                        throw error;
                    }

                    // 重置为下一段
                    subStart = subEnd;
                    bitLen = bitLen - tmpPoint;
                } else {
                    subEnd = i;
                    tmpPoint = bitLen;
                }
            }

            // 加密最后一段
            if (subStart < string.length) {
                const subStr = string.substring(subStart, string.length);
                const segment = Buffer.from(subStr, 'utf8');

                try {
                    const encryptedSegment = crypto.publicEncrypt({
                        key: publicKey,
                        padding: crypto.constants.RSA_PKCS1_PADDING
                    }, segment);

                    chunks.push(encryptedSegment);
                } catch (error) {
                    console.error(`加密最后一段失败:`, error.message);
                    throw error;
                }
            }

            return Buffer.concat(chunks);
        } catch (error) {
            console.error('长数据加密失败:', error.message);
            throw error;
        }
    },

    // 解密方法
    decode: function (data, privateKeyPem) {
        try {
            const encryptedBuffer = Buffer.from(data, 'base64');
            const privateKey = this.formatPrivateKey(privateKeyPem);

            console.time("RSA解密");
            const decryptedData = this.decryptLongData(privateKey, encryptedBuffer);
            console.timeEnd("RSA解密");

            return decryptedData.toString('utf8');
        } catch (error) {
            console.error("解密过程中发生错误:", error);
            throw error;
        }
    },

    // 加密方法
    encode: function (plainText, keyPem) {
        try {
            const dataBuffer = Buffer.from(plainText, 'utf8');
            let publicKey;

            // 判断输入的是私钥还是公钥
            // 检查是否包含PRIVATE KEY标识，或者是否为base64格式的私钥
            const isPrivateKey = keyPem.includes('PRIVATE KEY') || this.isBase64PrivateKey(keyPem);

            if (isPrivateKey) {
                // 如果是私钥，提取公钥
                publicKey = this.extractPublicKeyFromPrivate(keyPem);
            } else {
                // 如果是公钥，直接使用
                publicKey = this.formatPublicKey(keyPem);
            }

            console.time("RSA加密");
            const encryptedData = this.encryptLongData(publicKey, dataBuffer);
            console.timeEnd("RSA加密");

            return encryptedData.toString('base64');
        } catch (error) {
            console.error("加密过程中发生错误:", error);
            throw error;
        }
    },

    // 检测是否为base64格式的私钥
    isBase64PrivateKey: function (keyString) {
        // 如果已经包含PEM头部，则不是纯base64
        if (keyString.includes('-----')) {
            return false;
        }

        // 检查是否为有效的base64字符串
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(keyString)) {
            return false;
        }

        // 尝试解码并检查是否为RSA私钥格式
        try {
            const formattedKey = this.formatPrivateKey(keyString);
            // 尝试创建私钥对象来验证
            const keyObject = crypto.createPrivateKey({
                key: formattedKey,
                format: 'pem',
                type: 'pkcs1'
            });
            return true;
        } catch (error) {
            // 如果PKCS1失败，尝试PKCS8
            try {
                const formattedKey = this.formatPrivateKey(keyString);
                const keyObject = crypto.createPrivateKey({
                    key: formattedKey,
                    format: 'pem',
                    type: 'pkcs8'
                });
                return true;
            } catch (error2) {
                return false;
            }
        }
    },
};


// 跑不通，暂时不用
export const RSA2 = {
    // 清理 PEM 格式，提取 base64 内容
    cleanPEM: function (pem) {
        // 移除头部和尾部标记
        pem = pem.replace(/-----BEGIN [A-Z0-9 ]+-----/g, "")
            .replace(/-----END [A-Z0-9 ]+-----/g, "");
        // 移除所有空格和换行符
        pem = pem.replace(/\s/g, "");
        return pem;
    },
    importPrivateKey: function (pem) {
        const binaryDer = Uint8Array.from(Buffer.from(this.cleanPEM(pem), 'base64'));

        // 导入私钥
        const importedKey = crypto.subtle.importKey(
            "pkcs8",
            binaryDer,
            {
                name: "RSA-PKCS1-v1_5",
                hash: "SHA-256"
            },
            false, // 不可导出
            ["decrypt"]
        );
        return importedKey;
    },
    importPublicKey: function (pem) {
        const binaryDer = Uint8Array.from(Buffer.from(this.cleanPEM(pem), 'base64'));
        const importedKey = crypto.subtle.importKey(
            "spki", // 使用 spki 格式
            binaryDer, // DER 格式的公钥
            {
                name: "RSA-PKCS1-v1_5",
                hash: "SHA-256"  // 指定哈希算法
            },
            false, // 不可导出
            ["encrypt"] // 公钥通常用于加密和验证签名
        );
        return importedKey;
    },

    // 分段加密
    encryptMergedData: function (publicKey, data) {
        // 计算每个段的最大长度
        // 对于 RSA-PKCS1-v1_5，加密段的最大长度 = 密钥长度（字节） - 11
        const modulusLengthBytes = (publicKey.algorithm.modulusLength + 7) >> 3;
        //const modulusLengthBytes = 117;
        const segmentLength = modulusLengthBytes - 11;
        // 将数据编码为Uint8Array
        const dataBuffer = new TextEncoder().encode(data);
        if (dataBuffer.length > segmentLength) {
            const segments = [];
            for (let i = 0; i < dataBuffer.length; i += segmentLength) {
                const segment = dataBuffer.slice(i, i + segmentLength);
                segments.push(crypto.subtle.encrypt({name: 'RSA-PKCS1-v1_5'}, publicKey, segment));
            }
            return Buffer.concat(segments.map(b => Buffer.from(b))).toString('base64');
        }
        return Buffer.from(crypto.subtle.encrypt({name: "RSA-PKCS1-v1_5"}, publicKey, dataBuffer)).toString('base64');
    },

    // 分段解密
    decryptMergedData: function (privateKey, mergedData) {
        const segmentLength = (privateKey.algorithm.modulusLength + 7) >> 3; // 每个段的长度
        //const segmentLength = 256;
        if (mergedData.length > segmentLength) {
            const segments = [];
            for (let i = 0; i < mergedData.length; i += segmentLength) {
                const segment = mergedData.slice(i, i + segmentLength);
                segments.push(Buffer.from(crypto.subtle.decrypt({name: 'RSA-PKCS1-v1_5'}, privateKey, segment)));
            }
            return Buffer.concat(segments).toString('utf8');
        }
        return Buffer.from(crypto.subtle.decrypt({name: "RSA-PKCS1-v1_5"}, privateKey, mergedData)).toString('utf8');
    },
    decode: function (data, key) {
        try {
            const mergedDataArray = Uint8Array.from(Buffer.from(data, 'base64'));
            const privateKey = this.importPrivateKey(key);
            console.log(privateKey);
            //console.time("RSA");
            const decryptedData = this.decryptMergedData(privateKey, mergedDataArray);
            //console.timeEnd("RSA");
            return Buffer.from(decryptedData).toString();
        } catch (error) {
            console.error("解密过程中发生错误:", error);
            throw error;
        }
    },
    encode: function (plainText, publicKeyPem) {
        try {
            const publicKey = this.importPublicKey(publicKeyPem);
            //console.time("RSA加密");
            const encryptedData = this.encryptMergedData(publicKey, plainText);
            const encryptedBase64 = Buffer.from(encryptedData).toString('base64');
            //console.timeEnd("RSA加密");
            return encryptedBase64;
        } catch (error) {
            console.error("加密过程中发生错误:", error);
            throw error;
        }
    }
};