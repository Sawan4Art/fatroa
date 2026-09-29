// Electron main process — FatoraStone (EXE packaging)
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const DEV = !!process.env.FATORA_DEV;
const START_URL = 'http://localhost:3000';

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 420,
    minHeight: 560,
    autoHideMenuBar: true,
    backgroundColor: '#1c1917',
    title: 'فاتورة ستون',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  Menu.setApplicationMenu(null);

  if (DEV) {
    win.loadURL(START_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  }

  // External links open in the system browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => { win = null; });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
