const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { sendSalesReport } = require('./email-server');

const DATA_FILE = 'ronatug-data.json';

function getDataFilePath() {
  return path.join(app.getPath('userData'), DATA_FILE);
}

function readDataFile() {
  const filePath = getDataFilePath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to read data file:', error);
    return null;
  }
}

function writeDataFile(data) {
  const filePath = getDataFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to write data file:', error);
    return false;
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 1000,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.removeMenu();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('load-data', () => {
  return readDataFile();
});

ipcMain.handle('save-data', (event, data) => {
  return writeDataFile(data);
});

ipcMain.handle('send-sales-report', async (event, payload) => {
  try {
    const result = await sendSalesReport(payload);
    return { success: true, info: result };
  } catch (error) {
    console.error('Error sending sales report:', error);
    return { success: false, error: error.message };
  }
});
