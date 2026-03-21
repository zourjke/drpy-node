import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findProjectRoot() {
  // Check environment variable
  if (process.env.ROOT) {
    const envRoot = path.resolve(process.env.ROOT);
    if (fs.existsSync(envRoot)) {
      return envRoot;
    }
  }

  // Default: utils/pathHelper.js -> one level up
  return path.resolve(__dirname, '..');
}

export const PROJECT_ROOT = findProjectRoot();

export function resolvePath(p) {
  return path.resolve(PROJECT_ROOT, p);
}

export function isSafePath(p) {
  const resolved = resolvePath(p);
  return resolved.startsWith(PROJECT_ROOT);
}
