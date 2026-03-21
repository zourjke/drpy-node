import {jsDecoder} from '../../libs_drpy/drpyCustom.js';

/**
 * 通用解密接口
 * 支持 base64, gzip, aes, rsa
 */
export async function decode(req, reply) {
    try {
        const { type, code } = req.body;

        if (!type || !code) {
            return reply.code(400).send({ error: 'Missing required parameters: type and code' });
        }

        let result = '';

        switch (type) {
            case 'base64':
                result = jsDecoder.base64Decode(code);
                break;
            case 'gzip':
                result = jsDecoder.ungzip(code);
                break;
            case 'aes':
                result = jsDecoder.aes_decrypt(code);
                break;
            case 'rsa':
                result = jsDecoder.rsa_decode(code);
                break;
            default:
                return reply.code(400).send({ error: 'Unsupported decode type' });
        }

        return reply.send({ success: true, result });
    } catch (e) {
        return reply.code(500).send({ error: `Decode failed: ${e.message}` });
    }
}
