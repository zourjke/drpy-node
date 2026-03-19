import { adminApi } from './admin';

export const configApi = {
    async getConfig() {
        return await adminApi.getConfig();
    },

    async updateConfig(key, value) {
        return await adminApi.updateConfig(key, value);
    },

    async getConfigValue(key) {
        return await adminApi.getConfig(key);
    }
};
