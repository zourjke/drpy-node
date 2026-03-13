import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'index.js',
  output: {
    file: 'dist/index.js',
    format: 'esm',
    banner: '#!/usr/bin/env node',
    inlineDynamicImports: true,
  },
  treeshake: false,
  plugins: [
    resolve({
      preferBuiltins: true,
    }),
    commonjs(),
    json(),
  ],
  external: [
    // Node.js built-ins
    'fs', 'path', 'url', 'util', 'stream', 'events', 'buffer', 'crypto',
    'child_process', 'os', 'http', 'https', 'net', 'tls', 'zlib',
    // Native modules that shouldn't be bundled
    'node-sqlite3-wasm',
    // MCP SDK - keep external for proper ESM
    '@modelcontextprotocol/sdk',
  ],
  onwarn: function(warning, warn) {
    if (['CIRCULAR_DEPENDENCY', 'EVAL'].includes(warning.code)) {
      return;
    }
    warn(warning);
  },
};
