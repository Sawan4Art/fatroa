// Secure bridge — no Node APIs exposed to the web layer (contextIsolation)
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('fatoraDesktop', {
  platform: process.platform,
  isDesktop: true,
  version: process.versions.electron
});
