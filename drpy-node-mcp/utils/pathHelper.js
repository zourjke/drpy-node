import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * PROJECT_ROOT resolution:
 * 1. root environment variable (if set and exists)
 * 2. default: drpy-node-mcp/utils -> drpy-node
 */
function findProjectRoot() {
  // Check environment variable
  if (process.env.ROOT) {
    const envRoot = path.resolve(process.env.ROOT);
    if (fs.existsSync(envRoot)) {
      return envRoot;
    }
  }

  // Default
  const defaultRoot = path.resolve(__dirname, "..", "..");
  return defaultRoot;
}

export const PROJECT_ROOT = findProjectRoot();
console.warn(`Using PROJECT_ROOT: ${PROJECT_ROOT}`);

export function resolvePath(p) {
  return path.resolve(PROJECT_ROOT, p);
}

export function isSafePath(p) {
  const resolved = resolvePath(p);
  return resolved.startsWith(PROJECT_ROOT);
}
