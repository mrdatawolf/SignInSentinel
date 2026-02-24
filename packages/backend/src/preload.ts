import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getServerPort: () => ipcRenderer.invoke("get-server-port"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});
