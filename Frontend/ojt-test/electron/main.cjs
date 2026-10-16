const { app, BrowserWindow, ipcMain, net, protocol, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const isDevelopment = process.argv.includes("--dev");
let viteProcess;

async function waitForVite(serverUrl) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (viteProcess.exitCode !== null) {
      throw new Error("Vite exited before the desktop app could start.");
    }

    try {
      const response = await fetch(serverUrl);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  throw new Error("Timed out while starting the Vite development server.");
}

async function startDevelopmentServer() {
  const projectRoot = path.resolve(__dirname, "..");
  const viteCli = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
  const serverUrl = "http://127.0.0.1:5173";

  viteProcess = spawn(
    process.env.npm_node_execpath ||
      (process.platform === "win32" ? "node.exe" : "node"),
    [viteCli, "--host", "127.0.0.1", "--strictPort"],
    {
      cwd: projectRoot,
      stdio: "inherit",
      windowsHide: true,
    }
  );
  viteProcess.on("error", (error) => {
    console.error("Unable to start the Vite development server:", error);
  });

  await waitForVite(serverUrl);
  return serverUrl;
}

async function registerBuiltAppProtocol() {
  const distDirectory = path.resolve(__dirname, "..", "dist");

  await protocol.handle("app", async (request) => {
    const requestUrl = new URL(request.url);
    if (requestUrl.hostname !== "bundle") {
      return new Response("Not found", { status: 404 });
    }

    let requestPath;
    try {
      requestPath = decodeURIComponent(requestUrl.pathname);
    } catch {
      return new Response("Invalid path", { status: 400 });
    }

    const requestedFile = path.resolve(distDirectory, `.${requestPath}`);
    const relativePath = path.relative(distDirectory, requestedFile);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return new Response("Forbidden", { status: 403 });
    }

    let filePath = requestedFile;
    try {
      await fs.access(filePath);
    } catch {
      filePath = path.join(distDirectory, "index.html");
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

ipcMain.handle("open-folder", async (_event, folderPath) => {
  if (typeof folderPath !== "string" || !path.isAbsolute(folderPath)) {
    return { success: false, error: "The folder path is invalid." };
  }

  try {
    const fileInfo = await fs.stat(folderPath);
    if (fileInfo.isDirectory()) {
      const error = await shell.openPath(folderPath);
      return error
        ? { success: false, error }
        : { success: true };
    }

    if (fileInfo.isFile()) {
      shell.showItemInFolder(folderPath);
      return { success: true };
    }

    return { success: false, error: "The path is not a folder or file." };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Unable to open the folder.",
    };
  }
});

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (isDevelopment) {
    await window.loadURL(await startDevelopmentServer());
  } else {
    await registerBuiltAppProtocol();
    await window.loadURL("app://bundle/index.html");
  }
}

app.whenReady().then(createWindow).catch((error) => {
  console.error("Unable to start the desktop app:", error);
  app.quit();
});

app.on("before-quit", () => {
  viteProcess?.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      console.error("Unable to reopen the desktop window:", error);
    });
  }
});
