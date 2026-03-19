import { adminApi } from './admin';

export const spiderApi = {
    async listSources() {
        const result = await adminApi.listSources();
        return {
            js: result.js || [],
            catvod: result.catvod || [],
            php: result.php || [],
            py: result.py || []
        };
    },

    async validateSpider(path) {
        const result = await adminApi.validateSource(path);
        // 保持与原有格式兼容
        if (result.isValid) {
            return { isError: false, content: [{ text: result.message || '验证通过' }] };
        } else {
            return { isError: true, content: [{ text: result.error }] };
        }
    },

    async checkSyntax(path) {
        const result = await adminApi.checkSyntax(path);
        // 保持与原有格式兼容
        if (result.isValid) {
            return { isError: false, content: [{ text: result.message || '语法正确' }] };
        } else {
            return { isError: true, content: [{ text: result.error }] };
        }
    },

    async getTemplate() {
        const result = await adminApi.getTemplate();
        return result.template;
    },

    async debugRule(params) {
        // 暂未实现
        return {
            isError: true,
            content: [{ text: '调试功能暂未实现' }]
        };
    }
};
