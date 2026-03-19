/**
 * Wrapper for native fs module to simulate fs-extra methods.
 * This makes it easy to switch between native fs and fs-extra.
 */
import fs from 'fs';
import path from 'path';

// Promisified fs methods are available in fs.promises
const fsp = fs.promises;

/**
 * Ensures that the directory exists. If the directory structure does not exist, it is created.
 * @param {string} dirPath 
 */
async function ensureDir(dirPath) {
    try {
        await fsp.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

/**
 * Ensures that the directory exists synchronously.
 * @param {string} dirPath 
 */
function ensureDirSync(dirPath) {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

/**
 * Checks if a file or directory exists.
 * @param {string} fileOrDirPath 
 * @returns {Promise<boolean>}
 */
async function pathExists(fileOrDirPath) {
    try {
        await fsp.access(fileOrDirPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Copies a file or directory. The directory can have contents.
 * @param {string} src 
 * @param {string} dest 
 * @param {object} [options] 
 */
async function copy(src, dest, options = {}) {
    const stats = await fsp.stat(src);
    if (stats.isDirectory()) {
        await ensureDir(dest);
        const entries = await fsp.readdir(src);
        for (const entry of entries) {
            const srcPath = path.join(src, entry);
            const destPath = path.join(dest, entry);
            await copy(srcPath, destPath, options);
        }
    } else {
        await ensureDir(path.dirname(dest));
        if (options.overwrite !== false) {
            await fsp.copyFile(src, dest);
        } else {
            const exists = await pathExists(dest);
            if (!exists) {
                await fsp.copyFile(src, dest);
            }
        }
    }
}

/**
 * Removes a file or directory. The directory can have contents.
 * @param {string} fileOrDirPath 
 */
async function remove(fileOrDirPath) {
    try {
        await fsp.rm(fileOrDirPath, { recursive: true, force: true });
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

/**
 * Reads a JSON file and parses it.
 * @param {string} file 
 * @param {object|string} [options] 
 * @returns {Promise<any>}
 */
async function readJson(file, options) {
    const content = await fsp.readFile(file, options || 'utf-8');
    return JSON.parse(content);
}

/**
 * Writes an object to a JSON file.
 * @param {string} file 
 * @param {any} object 
 * @param {object|string} [options] 
 */
async function writeJson(file, object, options = {}) {
    const spaces = options.spaces || 2;
    const str = JSON.stringify(object, null, spaces);
    await fsp.writeFile(file, str, options);
}

/**
 * Reads a JSON file synchronously and parses it.
 * @param {string} file 
 * @param {object|string} [options] 
 * @returns {any}
 */
function readJsonSync(file, options) {
    const content = fs.readFileSync(file, options || 'utf-8');
    return JSON.parse(content);
}

/**
 * Writes an object to a JSON file synchronously.
 * @param {string} file 
 * @param {any} object 
 * @param {object|string} [options] 
 */
function writeJsonSync(file, object, options = {}) {
    const spaces = options.spaces || 2;
    const str = JSON.stringify(object, null, spaces);
    fs.writeFileSync(file, str, options);
}

// Export a combined object containing both standard fsp methods and our custom fs-extra-like methods
const fsWrapper = {
    ...fsp,
    // Original sync methods if needed
    existsSync: fs.existsSync,
    readFileSync: fs.readFileSync,
    writeFileSync: fs.writeFileSync,
    readdirSync: fs.readdirSync,
    statSync: fs.statSync,
    // Custom fs-extra methods
    ensureDir,
    ensureDirSync,
    pathExists,
    copy,
    remove,
    readJson,
    writeJson,
    readJsonSync,
    writeJsonSync,
};

export default fsWrapper;
