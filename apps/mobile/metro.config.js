// Metro сам находит корень pnpm-workspace и общий node_modules (Expo SDK 52+)
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
