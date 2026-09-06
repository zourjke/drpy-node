// 1️⃣ 导入时用别名重命名原模块的 Database
import {log, logError} from './log.js';
import pkg from 'node-sqlite3-wasm';

const {Database: SQLite3Database} = pkg; // 👈 关键别名
import {fileURLToPath} from "url";
import path from 'path';

// 2️⃣ 定义你的自定义类（可继承/扩展/完全重写）
export class DataBase {
    constructor(db_file) {
        this.db_file = db_file || './database.db';
        this.db = null;
    }

    // 自定义方法
    async initDb() {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const __rootPath = path.join(__dirname, '../');
        const __dbpath = path.join(__rootPath, this.db_file);
        // log('__dbpath:', __dbpath);
        const db = new SQLite3Database(__dbpath);
        this.db = db;
        return db
    }

    async startDb() {
        if (!this.db) {
            await this.initDb()
        }
    }

    async endDb() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }
}

async function main() {
    // 打开数据库（若不存在则创建）
    const db = new SQLite3Database("../database.db");

    // 创建表
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

    // 插入数据
    db.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
    db.run('INSERT INTO users (name) VALUES (?)', ['Bob']);

    // 查询数据
    const users = db.all('SELECT * FROM users');
    log(users);

    // 更新数据
    db.run('UPDATE users SET name = ? WHERE id = ?', ['Charlie', 1]);

    // 查询更新后的数据
    const updatedUsers = db.all('SELECT * FROM users');
    log(updatedUsers);

    // 删除数据
    db.run('DELETE FROM users WHERE id = ?', [2]);

    // 查询删除后的数据
    const finalUsers = db.all('SELECT * FROM users');
    log(finalUsers);

    // 关闭数据库
    db.close();
}

export const database = new DataBase('./database.db');

// main().catch(err => logError(err));
