const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const BASE_DATA_PATH = path.join(app.getPath('desktop'), 'ABRAhub_Cinema_Local');
const IMAGES_PATH = path.join(BASE_DATA_PATH, 'images');
const STORYBOARD_PATH = path.join(BASE_DATA_PATH, 'storyboard');

// Garantir que as pastas existam
[BASE_DATA_PATH, IMAGES_PATH, STORYBOARD_PATH].forEach(p => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Handler para salvar imagem
ipcMain.handle('save-image', async (event, { base64Data, type }) => {
  try {
    const folder = type === 'storyboard' ? STORYBOARD_PATH : IMAGES_PATH;
    const fileName = `generation_${Date.now()}.png`;
    const filePath = path.join(folder, fileName);
    
    // Remover o prefixo data:image/png;base64, se existir
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filePath, base64Content, 'base64');
    
    return { success: true, filePath: `file://${filePath}`, fileName };
  } catch (error) {
    console.error('Erro ao salvar imagem local:', error);
    return { success: false, error: error.message };
  }
});

// Handler para listar imagens locais
ipcMain.handle('get-local-images', async (event, type) => {
  try {
    const folder = type === 'storyboard' ? STORYBOARD_PATH : IMAGES_PATH;
    const files = fs.readdirSync(folder);
    return files.map(file => ({
      name: file,
      path: `file://${path.join(folder, file)}`,
      createdAt: fs.statSync(path.join(folder, file)).birthtime
    }));
  } catch (error) {
    return [];
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: true,
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:8080');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

// Impedir múltiplas instâncias e tratar o link recebido
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (BrowserWindow.getAllWindows().length > 0) {
      const win = BrowserWindow.getAllWindows()[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
