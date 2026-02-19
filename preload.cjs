const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveImage: (base64Data, type) => ipcRenderer.invoke('save-image', { base64Data, type }),
  getLocalImages: (type) => ipcRenderer.invoke('get-local-images', type),
  deleteLocalImage: (filePath) => ipcRenderer.invoke('delete-local-image', filePath),
});
