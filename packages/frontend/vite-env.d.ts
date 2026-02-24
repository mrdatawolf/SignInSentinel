/// <reference types="vite/client" />

interface ElectronAPI {
  getServerPort: () => Promise<number>;
  getAppVersion: () => Promise<string>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
