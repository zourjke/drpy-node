import {log} from '../utils/log.js';
import {getOriginalJs, jsDecoder} from '../libs_drpy/drpyCustom.js';
import {readFileSync, writeFileSync, existsSync} from 'fs';
import path from "path";

// 检测命令行参数
const args = process.argv.slice(2);

if (args.length > 0) {
    // 如果有参数，读取文件并打印内容
    const filePath = args[0]; // 第一个参数作为文件路径
    let content = readFileSync(filePath, 'utf8');
    log(`文件 ${filePath} 的内容长度为:${content.length}`);
    writeFileSync(filePath.replace(/\.gz$/, '.ugz'), jsDecoder.ungzip(content), 'utf-8');
}

// 仅仅支持json post 如: {"code":"xxx"}
export default (fastify, options, done) => {
    // 注册 POST 路由
    fastify.post('/decoder', async (request, reply) => {
        const {auth_code, code} = request.body;

        if (!code || !auth_code) {
            return reply.status(400).send({error: 'Missing required parameters: code and auth_code'});
        }
        // 检查文本大小
        const textSize = Buffer.byteLength(code, 'utf8'); // 获取 UTF-8 编码的字节大小
        if (textSize > options.MAX_TEXT_SIZE) {
            return reply
                .status(400)
                .send({error: `Text content exceeds the maximum size of ${options.MAX_TEXT_SIZE / 1024} KB`});
        }

        const authFilePath = path.join(options.rootDir, 'public/nomedia.txt');

        // 检查文件是否存在
        if (!existsSync(authFilePath)) {
            return reply.status(404).send({error: 'public/nomedia.txt file not found'});
        }
        try {
            const local_auto_code = readFileSync(authFilePath, 'utf-8').trim();
            const auth_codes = jsDecoder.aes_decrypt(local_auto_code).trim().split('\n');
            // log('auth_codes:',auth_codes);
            // log('auth_code:', auth_code);
            if (!auth_codes.includes(auth_code)) {
                return reply.status(200).send({error: 'your auth_code is not correct'});
            }
        } catch (error) {
            return reply.status(200).send({error: error.message});
        }

        try {
            let result = await getOriginalJs(code);
            reply.send({success: true, result});
        } catch (error) {
            reply.status(500).send({error: error.message});
        }
    });
    done();
};
