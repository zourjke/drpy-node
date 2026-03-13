#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Read manifest.json
const manifestJsonPath = path.join(__dirname, '..', 'manifest.json');
const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));

// Update manifest version to match package.json version
manifestJson.version = packageJson.version;

// Write updated manifest.json
fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2) + '\n');

console.log(`✅ Synced version to ${packageJson.version} in manifest.json`);