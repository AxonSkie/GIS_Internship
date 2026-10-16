const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  openFolder: (folderPath) => ipcRenderer.invoke("open-folder", folderPath),
});
