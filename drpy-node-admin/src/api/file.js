import { adminApi } from './admin';

export const fileApi = {
    async listDirectory(path = '.') {
        const result = await adminApi.listDirectory(path);
        return result;
    },

    async readFile(path) {
        const result = await adminApi.readFile(path);
        return result;
    },

    async writeFile(path, content) {
        const result = await adminApi.writeFile(path, content);
        return result;
    },

    async deleteFile(path) {
        const result = await adminApi.deleteFile(path);
        return result;
    }
};
