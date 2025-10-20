const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .wasm files (needed for expo-sqlite on web)
config.resolver.assetExts.push('wasm');

// Ensure .wasm files are treated as assets, not source files
config.resolver.sourceExts = config.resolver.sourceExts.filter(ext => ext !== 'wasm');

module.exports = config;

