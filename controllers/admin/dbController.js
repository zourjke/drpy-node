/**
 * 数据库查询控制器
 * 提供安全的只读 SQL 查询功能
 */

import sqlite3pkg from 'node-sqlite3-wasm';
const { Database } = sqlite3pkg;
import path from 'path';

// 执行查询
export async function executeQuery(req, reply) {
    try {
        const { sql, params } = req.body;

        if (!sql || !sql.trim()) {
            return reply.code(400).send({
                error: 'SQL 查询不能为空'
            });
        }

        // 只允许 SELECT 查询
        const trimmedSql = sql.trim().toLowerCase();
        if (!trimmedSql.startsWith('select') && !trimmedSql.startsWith('pragma')) {
            return reply.code(403).send({
                error: '只允许 SELECT 查询'
            });
        }

        // 额外安全检查
        const dangerousKeywords = [
            'drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate', 
            'replace', 'grant', 'revoke', 'lock', 'unlock', 'reindex', 'vacuum'
        ];
        
        for (const keyword of dangerousKeywords) {
            // Check for keyword surrounded by whitespace or non-word characters
            // This prevents matching "update_time" but matches "update table" or "update\ntable"
            const regex = new RegExp(`(^|[\\s\\W])${keyword}([\\s\\W]|$)`, 'i');
            if (regex.test(trimmedSql)) {
                return reply.code(403).send({
                    error: `不允许使用 ${keyword.toUpperCase()} 语句`
                });
            }
        }

        const dbPath = path.join(process.cwd(), 'database.db');
        const db = new Database(dbPath);

        try {
            const rows = db.all(sql, params || []);
            return reply.send({
                success: true,
                data: rows,
                rows: rows.length
            });
        } finally {
            db.close();
        }
    } catch (e) {
        reply.code(500).send({
            error: `SQL 错误: ${e.message}`
        });
    }
}

// 获取表结构
export async function getTables(req, reply) {
    try {
        const dbPath = path.join(process.cwd(), 'database.db');
        const db = new Database(dbPath);

        try {
            const tables = db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
            return reply.send({
                success: true,
                tables: tables.map(t => t.name)
            });
        } finally {
            db.close();
        }
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}

// 获取表结构
export async function getTableSchema(req, reply) {
    try {
        const { table } = req.params;

        if (!table) {
            return reply.code(400).send({
                error: '表名不能为空'
            });
        }

        const dbPath = path.join(process.cwd(), 'database.db');
        const db = new Database(dbPath);

        try {
            const schema = db.all(`PRAGMA table_info(${table})`);
            return reply.send({
                success: true,
                table,
                columns: schema
            });
        } finally {
            db.close();
        }
    } catch (e) {
        reply.code(500).send({
            error: e.message
        });
    }
}
