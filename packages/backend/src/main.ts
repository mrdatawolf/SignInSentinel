import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import path from "path";
import { initDatabase } from "./database/connection";
import { startServer } from "./server";
import { initEncryption } from "./services/encryption.service";
import { runAllPrechecks } from "./services/precheck.service";
import { logger, addFileTransport } from "./utils/logger";

let mainWindow: BrowserWindow | null = null;
let serverPort: number = 0;
let closeServer: (() => void) | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "SignInSentinel",
  });

  // In production, serve the built React app
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  } else {
    // In dev, load from Vite dev server
    mainWindow.loadURL(`http://localhost:5173`);
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function bootstrap() {
  const userDataPath = app.getPath("userData");

  // Set up file logging
  addFileTransport(userDataPath);
  logger.info(`App starting. User data: ${userDataPath}`);

  // 1. Initialize encryption via OS keychain
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString("signin-sentinel-master-key");
    initEncryption(encrypted);
    logger.info("Encryption initialized via safeStorage.");
  } else {
    logger.warn("safeStorage not available. Passwords will not be encrypted.");
  }

  // 2. Initialize database
  logger.info("Initializing database...");
  await initDatabase(userDataPath);
  logger.info("Database initialized.");

  // 3. Start Express server on ephemeral port
  logger.info("Starting Express server...");
  const server = await startServer(0);
  serverPort = server.port;
  closeServer = server.close;
  logger.info(`Express server running on port ${serverPort}`);

  // 4. Run startup prechecks (non-blocking — results saved to DB)
  runAllPrechecks().catch((err) => {
    logger.error("Startup prechecks failed:", err);
  });

  // 5. Create window
  await createWindow();
}

// IPC handlers
ipcMain.handle("get-server-port", () => serverPort);
ipcMain.handle("get-app-version", () => app.getVersion());

// App lifecycle
app.whenReady().then(bootstrap).catch((err) => {
  logger.error("Failed to start application:", err);
  app.quit();
});

app.on("window-all-closed", () => {
  if (closeServer) {
    closeServer();
    logger.info("Express server stopped.");
  }
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
