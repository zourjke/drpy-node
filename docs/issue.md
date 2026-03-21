# drpy-node 踩坑与兼容性问题记录

## 1. Node.js 24+ RSA PKCS1 解密乱码问题

### 现象描述
在 Node.js 18-23 环境下，使用 `crypto.privateDecrypt` 结合 `RSA_PKCS1_PADDING` 解密长文本数据（如前端使用 `JSEncrypt` 生成的密文）时一切正常。但在 Node.js 24+ 环境下，解密结果会出现中文乱码，且数据长度发生截断/变化，且**全程不会抛出任何报错**。

### 问题根源
该问题源于 Node.js 24 底层升级至 **OpenSSL 3.2+** 后引入的安全机制变更：
1. **隐式拒绝机制 (Implicit Rejection)**：为了防御针对 RSA PKCS#1 v1.5 填充的马文攻击 (Marvin Attack)，OpenSSL 3.2+ 改变了对非标准填充密文的处理行为。
2. 当使用 `RSA_PKCS1_PADDING` 解密遇到格式不完全标准的填充（常见于前端老旧 JS 库加密的数据）时，**它不再像以前那样抛出解密失败的 Error**，而是确定性地返回一段与预期长度相同的**伪随机乱码**。
3. 导致我们的代码直接采纳了这段“伪随机乱码”作为成功解密的结果，最终输出了乱码文本。

### 解决方案
为了在所有 Node.js 版本（18~24+）中保持一致且稳定的解密行为，需要放弃依赖底层的自动 PKCS1 解包，改为手动解包：

1. **强制使用 `RSA_NO_PADDING`**：在调用 `crypto.privateDecrypt` 时强制使用无填充模式，直接获取原始的解密数据块，这能完全绕过 OpenSSL 的“隐式拒绝”乱码机制。
2. **手动移除 PKCS1 填充**：实现 `removePKCS1Padding` 方法，手动解析 `0x00 0x02 [随机字节] 0x00 [真实数据]` 的填充结构，精准提取出真实数据。
3. **动态适应密钥长度**：不再硬编码分段大小，而是通过 `crypto.createPrivateKey(privateKey).asymmetricKeyDetails.modulusLength` 动态获取密钥位数，以支持 1024/2048 等不同位数的密钥。

### 核心代码参考
```javascript
// drpyRsa.js
let decryptedSegment;
try {
    // 强制使用 NO_PADDING 避免 Node 24+ (OpenSSL 3.2+) 原生 PKCS1 解密的隐式拒绝乱码机制
    decryptedSegment = crypto.privateDecrypt({
        key: privateKey,
        padding: crypto.constants.RSA_NO_PADDING
    }, segment);
    
    // 手动移除 PKCS1 填充: 0x00 0x02 [随机字节] 0x00 [数据]
    decryptedSegment = this.removePKCS1Padding(decryptedSegment);
} catch (error) {
    console.error('NO_PADDING 解密错误:', error.message);
    throw error;
}
```
