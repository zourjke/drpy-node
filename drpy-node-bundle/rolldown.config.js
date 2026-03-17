import { defineConfig } from 'rolldown';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read extension files content
const es6ExtendContent = fs.readFileSync(path.resolve(__dirname, '../libs_drpy/es6-extend.js'), 'utf8');
const reqExtendContent = fs.readFileSync(path.resolve(__dirname, '../libs_drpy/req-extend.js'), 'utf8');

// Node.js built-in modules
const builtins = [
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'fs/promises',
  'http', 'http2', 'https', 'inspector', 'module', 'net', 'os', 'path',
  'perf_hooks', 'process', 'punycode', 'querystring', 'readline', 'repl',
  'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events', 'tty',
  'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
];

export default defineConfig({
  input: 'entry.js',
  output: {
    file: 'libs/localDsCore.bundled.js',
    format: 'esm',
    sourcemap: false,
    inlineDynamicImports: true,
    banner: `
import { createRequire as _createRequire } from 'module';
import { fileURLToPath as _fileURLToPath } from 'url';
import { dirname as _dirname } from 'path';
const __filename = _fileURLToPath(import.meta.url);
const __dirname = _dirname(__filename);
const _originalRequire = _createRequire(import.meta.url);
const require = (moduleName) => {
  if (moduleName === 'pako') return global.pako;
  return _originalRequire(moduleName);
};
`,
  },
  platform: 'node',
  treeshake: false, // Ensure no code is removed
  resolve: {
    conditionNames: ['node', 'import'],
    alias: {
      'pako': path.resolve(__dirname, '../libs_drpy/pako.min.js'),
      'puppeteer': path.resolve(__dirname, 'puppeteer-mock.js'),
      [path.resolve(__dirname, '../libs_drpy/jsonpathplus.min.js')]: path.resolve(__dirname, 'shim/jsonpath-shim.js')
    }
  },
  external: (id) => {
    // Check if it's a built-in module
    if (builtins.includes(id) || id.startsWith('node:')) {
      return true;
    }
    // Bundle everything else (relative paths, absolute paths, npm packages)
    return false;
  },
  plugins: [
    {
      name: 'inline-extend-code',
      transform(code, id) {
        // Normalize path separators to handle Windows/Unix differences
        const normalizedId = id.split(path.sep).join('/');
        if (normalizedId.endsWith('utils/file.js')) {
          let newCode = code;
          // Inline es6_extend_code
          // Replaces: export const es6_extend_code = readFileSync(es6JsPath, 'utf8');
          newCode = newCode.replace(
            /export\s+const\s+es6_extend_code\s*=\s*readFileSync\(es6JsPath,\s*['"]utf8['"]\);/,
            () => `export const es6_extend_code = ${JSON.stringify(es6ExtendContent)};`
          );
          
          // Inline req_extend_code
          // Replaces: export const req_extend_code = readFileSync(reqJsPath, 'utf8');
          newCode = newCode.replace(
            /export\s+const\s+req_extend_code\s*=\s*readFileSync\(reqJsPath,\s*['"]utf8['"]\);/,
            () => `export const req_extend_code = ${JSON.stringify(reqExtendContent)};`
          );
          
          return newCode;
        }
      }
    }
  ]
});
