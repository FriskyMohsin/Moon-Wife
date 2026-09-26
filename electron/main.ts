import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import * as path from 'path';
import { WindowStateManager } from './windowState';

let mainWindow: BrowserWindow | null = null;
const windowStateManager = new WindowStateManager('maryam-desktop-v15');

// 1. Single Instance Lock
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log('[Electron] Another instance is already running. Exiting...');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow(): void {
  const savedState = windowStateManager.getState();

  mainWindow = new BrowserWindow({
    width: savedState.width || 1440,
    height: savedState.height || 900,
    x: savedState.x,
    y: savedState.y,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#060207',
    frame: false, // Custom sleek glassmorphic desktop titlebar
    title: 'Maryam V15.1 Desktop',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  if (savedState.isMaximized) {
    mainWindow.maximize();
  }

  // Graceful show on ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Track & persist window bounds
  const saveBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      const isMaximized = mainWindow.isMaximized();
      windowStateManager.saveState(bounds, isMaximized);
    }
  };

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('maximize', () => {
    saveBounds();
    mainWindow?.webContents.send('window:maximized-change', true);
  });
  mainWindow.on('unmaximize', () => {
    saveBounds();
    mainWindow?.webContents.send('window:maximized-change', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 2. Permission Request Handlers: Securely grant Media (Camera / Microphone)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'notifications'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      console.warn(`[Electron] Denied untrusted permission request: ${permission}`);
      callback(false);
    }
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'media' || permission === 'notifications';
  });

  // 3. Safe External URL Navigation (open external links in default browser)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url);
      }
    } catch (e) {
      console.warn('[Electron] Invalid URL attempted in openExternal:', url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Only allow navigation to localhost or local bundle
    const isLocalhost = url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:');
    const isFileUrl = url.startsWith('file://');
    if (!isLocalhost && !isFileUrl) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // 4. Load Dev URL or Production Bundle
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      console.warn(`[Electron] Could not connect to ${devServerUrl}, retrying in 1s...`, err.message);
      setTimeout(() => {
        mainWindow?.loadURL(devServerUrl);
      }, 1000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// 5. IPC Window Control Handlers
ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Clean termination when all windows are closed
app.on('window-all-closed', () => {
  app.quit();
});
