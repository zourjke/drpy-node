import { adminApi } from './admin';

export const systemApi = {
    async getHealth() {
        return await adminApi.getHealth();
    },

    async restartService() {
        return await adminApi.restartService();
    },

    async getRoutes() {
        return await adminApi.getRoutes();
    },

    async getLogs(lines = 100) {
        return await adminApi.getLogs(lines);
    },

    async getApiList() {
        return await adminApi.getApiDocs();
    }
};
