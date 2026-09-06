import net from "net";
import {Parser} from 'pickleparser';

const HOST = "127.0.0.1";
const PORT = 57570;
// 单包上限与超时可经环境变量覆写（默认值=历史硬编码，不配置则行为不变）；
// python 守护进程侧读取同名变量，需与 docs/envdoc.md 登记保持一致
const MAX_MSG_SIZE = Number(process.env.BRIDGE_PACKET_MAX) || 10 * 1024 * 1024;
const TIMEOUT = Number(process.env.BRIDGE_TIMEOUT) || 30_000;

/**
 * Node.js -> Python 请求包（保持 JSON 格式，Python 端需要 json.loads）
 */
function encodePacket(obj) {
    const jsonStr = JSON.stringify(obj);
    const payload = Buffer.from(jsonStr, "utf-8");
    const header = Buffer.alloc(4);
    header.writeUInt32BE(payload.length, 0);
    return Buffer.concat([header, payload]);
}

/**
 * Python -> Node.js 响应包（pickle 解码）
 */
function decodePacket(buffer) {
    const parser = new Parser();
    return parser.parse(buffer);
}

export async function netCallPythonMethod(script_path, methodName, env, ...args) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let recvBuffer = Buffer.alloc(0);
        let expectedLength = null;

        // 超时处理
        const timer = setTimeout(() => {
            client.destroy();
            reject(new Error("Python守护进程响应超时"));
        }, TIMEOUT);

        client.connect(PORT, HOST, () => {
            const req = {
                script_path,
                method_name: methodName,
                env,
                args,
            };
            const packet = encodePacket(req);
            client.write(packet);
        });

        client.on("data", (chunk) => {
            recvBuffer = Buffer.concat([recvBuffer, chunk]);

            while (true) {
                if (expectedLength === null) {
                    if (recvBuffer.length >= 4) {
                        expectedLength = recvBuffer.readUInt32BE(0);
                        recvBuffer = recvBuffer.slice(4);
                        if (expectedLength <= 0 || expectedLength > MAX_MSG_SIZE) {
                            clearTimeout(timer);
                            client.destroy();
                            return reject(new Error("Invalid packet length"));
                        }
                    } else {
                        break;
                    }
                }

                if (expectedLength !== null && recvBuffer.length >= expectedLength) {
                    const payload = recvBuffer.slice(0, expectedLength);
                    recvBuffer = recvBuffer.slice(expectedLength);
                    expectedLength = null;

                    try {
                        const resp = decodePacket(payload);
                        clearTimeout(timer);
                        client.destroy();

                        if (resp && typeof resp === "object" && resp.error) {
                            reject(new Error(`Python错误: ${resp.error}\n${resp.traceback || ""}`));
                        } else if (resp && typeof resp === "object" && "result" in resp) {
                            resolve(resp.result);
                        } else {
                            resolve(resp);
                        }
                    } catch (e) {
                        clearTimeout(timer);
                        client.destroy();
                        reject(e);
                    }
                } else {
                    break;
                }
            }
        });

        client.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });

        client.on("close", () => {
            clearTimeout(timer);
        });
    });
}
