/**
 * Admin API 统一调用接口
 * 所有后台管理 API 都通过这个模块调用
 */

import client from './client';

export const adminApi = {
    // ==================== 系统 ====================
    async getHealth() {
        return client.get('/api/admin/health');
    },

    async restartService() {
        return client.post('/api/admin/restart');
    },

    // ==================== 日志 ====================
    async getLogs(lines = 50) {
        return client.get('/api/admin/logs', { params: { lines } });
    },

    // WebSocket 连接在组件中直接使用

    // ==================== 配置 ====================
    async getConfig(key) {
        return client.get('/api/admin/config', { params: { key } });
    },

    async updateConfig(key, value) {
        return client.post('/api/admin/config', { key, value });
    },

    async getEnv() {
        return client.get('/api/admin/env');
    },

    // ==================== 源管理 ====================
    async listSources() {
        return client.get('/api/admin/sources');
    },

    async validateSource(path) {
        return client.post('/api/admin/sources/validate', { path });
    },

    async checkSyntax(path) {
        return client.post('/api/admin/sources/syntax', { path });
    },

    async getTemplate() {
        return client.get('/api/admin/sources/template');
    },

    async getLibsInfo() {
        return client.get('/api/admin/sources/libs');
    },

    // ==================== 文件管理 ====================
    async listDirectory(path) {
        return client.get('/api/admin/files/list', { params: { path } });
    },

    async readFile(path) {
        return client.get('/api/admin/files/read', { params: { path } });
    },

    async writeFile(path, content) {
        return client.post('/api/admin/files/write', { path, content });
    },

    async deleteFile(path) {
        return client.delete('/api/admin/files/delete', { params: { path } });
    },

    // ==================== 数据库 ====================
    async executeQuery(sql) {
        return client.post('/api/admin/db/query', { sql });
    },

    async getTables() {
        return client.get('/api/admin/db/tables');
    },

    async getTableSchema(table) {
        return client.get(`/api/admin/db/tables/${table}/schema`);
    },

    // ==================== 路由信息 ====================
    async getRoutes() {
        return client.get('/api/admin/routes');
    },

    async getApiDocs() {
        return client.get('/api/admin/docs');
    },

    // ==================== 订阅管理 ====================
    async getSubFiles() {
        return client.get('/api/admin/sub/files');
    },

    async getSubFile(name) {
        return client.get('/api/admin/sub/file', { params: { name } });
    },

    async saveSubFile(name, content) {
        return client.post('/api/admin/sub/file', { name, content });
    },

    // ==================== 备份恢复 ====================
    async getBackupConfig() {
        return client.get('/api/admin/backup/config');
    },

    async createBackup() {
        return client.post('/api/admin/backup/create');
    },

    async restoreBackup() {
        return client.post('/api/admin/backup/restore');
    }
};
