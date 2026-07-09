import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { config as loadEnvironment } from 'dotenv';
import { app, BrowserWindow, shell } from 'electron';

import { bootstrapConversation, type ConversationRuntime } from './conversation/bootstrap';
import { bootstrapDesktop, type DesktopRuntime } from './desktop/bootstrap';
import { bootstrapDocuments, type DocumentRuntime } from './documents/bootstrap';
import { bootstrapPlatform, type PlatformRuntime } from './platform/bootstrap';
import { bootstrapMemory, type MemoryRuntime } from './memory/bootstrap';
import { bootstrapOffice, type OfficeRuntime } from './office/bootstrap';
import { bootstrapPlugins, type PluginRuntime } from './plugins/bootstrap';
import { bootstrapProduction, type ProductionRuntime } from './production/bootstrap';
import { bootstrapRelease, type ReleaseRuntime } from './release/bootstrap';
import { bootstrapWeb, type WebRuntime } from './web/bootstrap';
import { ElectronIpcAdapter } from './platform/ipc/electron-ipc.adapter';
import { RotatingFileLogTransport } from './platform/logging/logger';
import { PLATFORM_TOKENS } from './platform/tokens';
import { isTrustedRendererUrl } from './security/navigation';
import {
  PERMISSIONS,
  type Permission,
  type PermissionDecision,
} from '../shared/platform/permissions';

loadEnvironment({ quiet: true });

const developmentRendererUrl = process.env.ELECTRON_RENDERER_URL;
const isDevelopment = Boolean(developmentRendererUrl);
const isSmokeTest = process.env.JARVIS_SMOKE_TEST === '1';
if (isSmokeTest) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('no-sandbox');
}
if (process.env.JARVIS_USER_DATA_PATH) app.setPath('userData', process.env.JARVIS_USER_DATA_PATH);
let platformRuntime: PlatformRuntime | undefined;
let conversationRuntime: ConversationRuntime | undefined;
let memoryRuntime: MemoryRuntime | undefined;
let officeRuntime: OfficeRuntime | undefined;
let documentRuntime: DocumentRuntime | undefined;
let webRuntime: WebRuntime | undefined;
let desktopRuntime: DesktopRuntime | undefined;
let pluginRuntime: PluginRuntime | undefined;
let productionRuntime: ProductionRuntime | undefined;
let releaseRuntime: ReleaseRuntime | undefined;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 960,
    minHeight: 680,
    show: false,
    backgroundColor: '#03070d',
    title: 'J.A.R.V.I.S.',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: !isSmokeTest,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  if (isDevelopment || isSmokeTest) {
    let smokeCompleted = false;
    window.webContents.on('console-message', (details) => {
      if (details.message.startsWith('[JARVIS renderer]')) {
        console.log(details.message);
      }
      if (isSmokeTest && !smokeCompleted && details.message.includes('IPC ready')) {
        smokeCompleted = true;
        console.log('JARVIS_ELECTRON_SMOKE_OK');
        app.exit(0);
      }
    });
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url, isDevelopment, developmentRendererUrl)) event.preventDefault();
  });

  window.webContents.once('did-fail-load', (_event, errorCode, errorDescription, validatedUrl) => {
    console.error(
      `Renderer failed to load ${validatedUrl} (${String(errorCode)}): ${errorDescription}`,
    );
    if (isSmokeTest) app.exit(1);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

function getUserPath(
  name: 'home' | 'downloads' | 'documents' | 'desktop',
  fallback: string,
): string {
  try {
    return app.getPath(name);
  } catch {
    const fallbackPath = join(app.getPath('userData'), fallback);
    mkdirSync(fallbackPath, { recursive: true });
    return fallbackPath;
  }
}

function numericEnvironment(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

void app.whenReady().then(() => {
  const databaseDirectory = app.getPath('userData');
  mkdirSync(databaseDirectory, { recursive: true });
  const productionLogDirectory = join(databaseDirectory, 'production', 'logs');
  platformRuntime = bootstrapPlatform({
    environment: process.env,
    ipcAdapter: new ElectronIpcAdapter(),
    runtimeInfo: {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      processPlatform: process.platform,
    },
    isTrustedSender: (url) => isTrustedRendererUrl(url, isDevelopment, developmentRendererUrl),
    logTransports: [
      new RotatingFileLogTransport({
        directory: productionLogDirectory,
        maxBytes: numericEnvironment('JARVIS_LOG_MAX_BYTES', 1_048_576),
        maxFiles: numericEnvironment('JARVIS_LOG_MAX_FILES', 5),
      }),
    ],
    permissionPolicy: new Map<Permission, PermissionDecision>([
      [PERMISSIONS.network, 'allow'],
      [PERMISSIONS.fileAccess, 'allow'],
      [PERMISSIONS.appLaunch, 'allow'],
      [PERMISSIONS.clipboard, 'allow'],
      [PERMISSIONS.notifications, 'allow'],
      [PERMISSIONS.screenshot, 'allow'],
      [PERMISSIONS.systemInformation, 'allow'],
      [PERMISSIONS.desktopAutomation, 'allow'],
      [PERMISSIONS.plugins, 'allow'],
      [PERMISSIONS.pluginTools, 'allow'],
    ]),
  });
  const memoryDatabasePath = join(databaseDirectory, 'memory.sqlite');
  const conversationDatabasePath = join(databaseDirectory, 'conversations.sqlite');
  const officeDatabasePath = join(databaseDirectory, 'office.sqlite');
  const documentDatabasePath = join(databaseDirectory, 'documents.sqlite');
  const webDatabasePath = join(databaseDirectory, 'web.sqlite');
  memoryRuntime = bootstrapMemory({
    databasePath: memoryDatabasePath,
    logger: platformRuntime.services.resolve(PLATFORM_TOKENS.logger),
    router: platformRuntime.services.resolve(PLATFORM_TOKENS.ipcRouter),
    services: platformRuntime.services,
  });
  conversationRuntime = bootstrapConversation({
    config: platformRuntime.configuration.value,
    geminiApiKey: platformRuntime.configuration.getGeminiApiKey(),
    databasePath: conversationDatabasePath,
    logger: platformRuntime.services.resolve(PLATFORM_TOKENS.logger),
    router: platformRuntime.services.resolve(PLATFORM_TOKENS.ipcRouter),
    services: platformRuntime.services,
    memory: memoryRuntime.conversationMemory,
  });
  officeRuntime = bootstrapOffice({
    databasePath: officeDatabasePath,
    logger: platformRuntime.services.resolve(PLATFORM_TOKENS.logger),
    router: platformRuntime.services.resolve(PLATFORM_TOKENS.ipcRouter),
    services: platformRuntime.services,
    conversations: conversationRuntime.engine,
    memories: memoryRuntime.manager,
  });
  documentRuntime = bootstrapDocuments({
    databasePath: documentDatabasePath,
    logger: platformRuntime.services.resolve(PLATFORM_TOKENS.logger),
    router: platformRuntime.services.resolve(PLATFORM_TOKENS.ipcRouter),
    services: platformRuntime.services,
  });
  webRuntime = bootstrapWeb({
    config: platformRuntime.configuration.value,
    databasePath: webDatabasePath,
    logger: platformRuntime.services.resolve(PLATFORM_TOKENS.logger),
    router: platformRuntime.services.resolve(PLATFORM_TOKENS.ipcRouter),
    services: platformRuntime.services,
  });
  desktopRuntime = bootstrapDesktop({
    logger: platformRuntime.services.resolve(PLATFORM_TOKENS.logger),
    router: platformRuntime.services.resolve(PLATFORM_TOKENS.ipcRouter),
    services: platformRuntime.services,
    homeDirectory: getUserPath('home', 'Home'),
    downloadsPath: getUserPath('downloads', 'Downloads'),
    documentsPath: getUserPath('documents', 'Documents'),
    desktopPath: getUserPath('desktop', 'Desktop'),
  });
  pluginRuntime = bootstrapPlugins({
    appVersion: app.getVersion(),
    logger: platformRuntime.services.resolve(PLATFORM_TOKENS.logger),
    router: platformRuntime.services.resolve(PLATFORM_TOKENS.ipcRouter),
    services: platformRuntime.services,
  });
  productionRuntime = bootstrapProduction({
    appVersion: app.getVersion(),
    config: platformRuntime.configuration.value,
    userDataPath: databaseDirectory,
    databasePaths: [
      memoryDatabasePath,
      conversationDatabasePath,
      officeDatabasePath,
      documentDatabasePath,
      webDatabasePath,
    ],
    projectRoot: process.cwd(),
    logger: platformRuntime.services.resolve(PLATFORM_TOKENS.logger),
    router: platformRuntime.services.resolve(PLATFORM_TOKENS.ipcRouter),
    services: platformRuntime.services,
    restart: () => {
      app.relaunch();
      app.exit(0);
    },
  });
  releaseRuntime = bootstrapRelease({
    appVersion: app.getVersion(),
    config: platformRuntime.configuration.value,
    userDataPath: databaseDirectory,
    databasePaths: {
      memory: memoryDatabasePath,
      conversation: conversationDatabasePath,
      office: officeDatabasePath,
      documents: documentDatabasePath,
      web: webDatabasePath,
    },
    logger: platformRuntime.services.resolve(PLATFORM_TOKENS.logger),
    router: platformRuntime.services.resolve(PLATFORM_TOKENS.ipcRouter),
    services: platformRuntime.services,
    updateManifestUrl: platformRuntime.configuration.value.release.updateManifestUrl,
    signingCertificateConfigured: Boolean(
      process.env.CSC_LINK ??
      process.env.WIN_CSC_LINK ??
      process.env.WINDOWS_CODESIGN_CERTIFICATE_FILE,
    ),
    packageOutputDirectory: join(process.cwd(), 'release'),
    geminiApiKeyConfigured: Boolean(platformRuntime.configuration.getGeminiApiKey()),
  });
  productionRuntime.attachWindow(createMainWindow());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createMainWindow();
      productionRuntime?.attachWindow(window);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  releaseRuntime?.dispose();
  releaseRuntime = undefined;
  productionRuntime?.dispose();
  productionRuntime = undefined;
  pluginRuntime?.dispose();
  pluginRuntime = undefined;
  desktopRuntime?.dispose();
  desktopRuntime = undefined;
  webRuntime?.dispose();
  webRuntime = undefined;
  documentRuntime?.dispose();
  documentRuntime = undefined;
  officeRuntime?.dispose();
  officeRuntime = undefined;
  conversationRuntime?.dispose();
  conversationRuntime = undefined;
  memoryRuntime?.dispose();
  memoryRuntime = undefined;
  platformRuntime?.dispose();
  platformRuntime = undefined;
});
