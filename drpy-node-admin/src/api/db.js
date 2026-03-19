import { adminApi } from './admin';

export const dbApi = {
    async query(sql) {
        const result = await adminApi.executeQuery(sql);
        return result.data;
    },

    async getTables() {
        const result = await adminApi.getTables();
        return result.tables;
    },

    async getTableSchema(table) {
        const result = await adminApi.getTableSchema(table);
        return result.columns;
    }
};
