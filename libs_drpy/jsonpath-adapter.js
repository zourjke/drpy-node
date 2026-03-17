import * as jpNamespace from './jsonpathplus.min.js';

let jp;

// Try to find JSONPath in the imported namespace (ESM/Rolldown handling of UMD)
if (jpNamespace && jpNamespace.JSONPath) {
     jp = jpNamespace.JSONPath;
} else if (jpNamespace && jpNamespace.default && jpNamespace.default.JSONPath) {
     jp = jpNamespace.default.JSONPath;
}

// Fallback to globalThis (browser/legacy behavior)
if (!jp && typeof globalThis !== 'undefined' && globalThis.JSONPath) {
    if (typeof globalThis.JSONPath.JSONPath === 'function') {
        jp = globalThis.JSONPath.JSONPath;
    } else if (typeof globalThis.JSONPath === 'function') {
        jp = globalThis.JSONPath;
    }
}

export const JSONPath = jp;
export default jp;
