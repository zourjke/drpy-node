import path from 'path';
import fs from '../../utils/fsWrapper.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRootDir = path.resolve(__dirname, '../../');
const subDir = path.join(projectRootDir, 'public/sub');

// Ensure sub directory exists
fs.ensureDirSync(subDir);

export const getSubFiles = async (request, reply) => {
    try {
        const files = await fs.readdir(subDir);
        const result = [];
        for (const file of files) {
            const filePath = path.join(subDir, file);
            const stats = await fs.stat(filePath);
            if (stats.isFile()) {
                result.push({
                    name: file,
                    size: stats.size,
                    mtime: stats.mtime
                });
            }
        }
        return reply.send({ success: true, data: result });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ success: false, message: error.message });
    }
};

export const getSubFileContent = async (request, reply) => {
    const { name } = request.query;
    if (!name) {
        return reply.code(400).send({ success: false, message: 'Filename is required' });
    }
    
    // Basic security check to prevent directory traversal
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
        return reply.code(400).send({ success: false, message: 'Invalid filename' });
    }

    const filePath = path.join(subDir, name);
    try {
        if (!await fs.pathExists(filePath)) {
            return reply.code(404).send({ success: false, message: 'File not found' });
        }
        const content = await fs.readFile(filePath, 'utf-8');
        return reply.send({ success: true, data: content });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ success: false, message: error.message });
    }
};

export const saveSubFileContent = async (request, reply) => {
    const { name, content } = request.body;
    if (!name) {
        return reply.code(400).send({ success: false, message: 'Filename is required' });
    }

    // Basic security check
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
        return reply.code(400).send({ success: false, message: 'Invalid filename' });
    }

    const filePath = path.join(subDir, name);
    try {
        await fs.writeFile(filePath, content, 'utf-8');
        return reply.send({ success: true, message: 'File saved successfully' });
    } catch (error) {
        request.log.error(error);
        return reply.code(500).send({ success: false, message: error.message });
    }
};
