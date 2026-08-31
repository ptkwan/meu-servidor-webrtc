const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

// --- ESCUDO ANTI-CRASH ---
process.on('uncaughtException', (error) => console.error('Erro Crítico:', error));
process.on('unhandledRejection', (reason) => console.error('Promessa Rejeitada:', reason));
// -------------------------

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Remove o menu superior feio
    mainWindow.setMenu(null); 
    
    // Carrega a interface
    mainWindow.loadFile('index.html');

}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});

ipcMain.on('close-app', () => app.quit());

// Função que pega as telas do PC para compartilhar
ipcMain.handle('GET_SOURCES', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    return sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() }));
});
