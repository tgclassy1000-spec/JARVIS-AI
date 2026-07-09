import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import type { GenerationEvent } from '../shared/conversation/contracts';
import type {
  ApplicationActionRequest,
  ClipboardWriteRequest,
  FileOperationRequest,
  NotificationRequest,
  ScreenshotRequest,
  ToolRouteRequest,
} from '../shared/desktop/contracts';
import type {
  DocumentAnalysisRequest,
  DocumentImportRequest,
  DocumentPinRequest,
  DocumentSearchRequest,
} from '../shared/documents/contracts';
import type {
  CreateNoteRequest,
  CreateProjectRequest,
  CreateReminderRequest,
  CreateTaskRequest,
  OfficeQuickAddRequest,
  OfficeSearchRequest,
  SnoozeReminderRequest,
  UpdateNoteRequest,
  UpdateProjectRequest,
  UpdateReminderRequest,
  UpdateTaskRequest,
} from '../shared/office/contracts';
import type {
  CurrencyConversionRequest,
  KnowledgeRequest,
  MapLookupRequest,
  NewsRequest,
  TimeConversionRequest,
  TimeRequest,
  WeatherRequest,
  WebAssistantRequest,
  WebBookmarkRequest,
  WebSearchRequest,
} from '../shared/web/contracts';
import type {
  PluginInstallRequest,
  PluginManifest,
  PluginRemoveRequest,
  PluginSettingsUpdateRequest,
  PluginToolInvokeRequest,
  PluginToolRouteRequest,
  PluginUpdateRequest,
} from '../shared/plugins/contracts';
import type {
  BackupValidationRequest,
  DiagnosticBundleRequest,
  RendererCrashReportRequest,
  SafeRestartRequest,
} from '../shared/production/contracts';
import type {
  BackupWizardRequest,
  FirstRunWizardRequest,
  RestoreWizardRequest,
  RollbackRequest,
  SettingsUpdateRequest,
  UpdateCheckRequest,
  UpdateDownloadRequest,
} from '../shared/release/contracts';
import type { IpcResult } from '../shared/platform/errors';
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  type IpcChannel,
  type IpcRequest,
  type IpcResponse,
  type JarvisBridge,
  unwrapIpcResult,
} from '../shared/platform/ipc';

async function invoke<C extends IpcChannel>(
  channel: C,
  request: IpcRequest<C>,
): Promise<IpcResponse<C>> {
  const result = (await ipcRenderer.invoke(channel, request)) as IpcResult<IpcResponse<C>>;
  return unwrapIpcResult(result);
}

const conversationBridge: JarvisBridge['conversation'] = Object.freeze({
  list: () => invoke(IPC_CHANNELS.conversationList, {}),
  create: (request = {}) => invoke(IPC_CHANNELS.conversationCreate, request),
  get: (conversationId) => invoke(IPC_CHANNELS.conversationGet, { conversationId }),
  rename: (request) => invoke(IPC_CHANNELS.conversationRename, request),
  delete: async (conversationId) => {
    await invoke(IPC_CHANNELS.conversationDelete, { conversationId });
  },
  search: (query) => invoke(IPC_CHANNELS.conversationSearch, { query }),
  send: (request) => invoke(IPC_CHANNELS.conversationSend, request),
  edit: (request) => invoke(IPC_CHANNELS.conversationEdit, request),
  regenerate: (request) => invoke(IPC_CHANNELS.conversationRegenerate, request),
  cancel: async (generationId) => {
    const result = await invoke(IPC_CHANNELS.conversationCancel, { generationId });
    return result.cancelled;
  },
  export: (request) => invoke(IPC_CHANNELS.conversationExport, request),
  onGenerationEvent: (listener) => {
    const wrapped = (_event: IpcRendererEvent, payload: unknown) =>
      listener(payload as GenerationEvent);
    ipcRenderer.on(IPC_EVENTS.generation, wrapped);
    return () => ipcRenderer.removeListener(IPC_EVENTS.generation, wrapped);
  },
});

const memoryBridge: JarvisBridge['memory'] = Object.freeze({
  list: (kind) => invoke(IPC_CHANNELS.memoryList, { kind }),
  save: (request) => invoke(IPC_CHANNELS.memorySave, request),
  update: (request) => invoke(IPC_CHANNELS.memoryUpdate, request),
  delete: async (id) => {
    await invoke(IPC_CHANNELS.memoryDelete, { id });
  },
  search: (request) => invoke(IPC_CHANNELS.memorySearch, request),
  settings: () => invoke(IPC_CHANNELS.memorySettings, {}),
  setEnabled: (enabled) => invoke(IPC_CHANNELS.memorySetEnabled, { enabled }),
  deleteAll: async () => (await invoke(IPC_CHANNELS.memoryDeleteAll, { confirm: true })).deleted,
  export: () => invoke(IPC_CHANNELS.memoryExport, {}),
  backup: () => invoke(IPC_CHANNELS.memoryBackup, {}),
  restore: async (request) => (await invoke(IPC_CHANNELS.memoryRestore, request)).restored,
  mergeDuplicates: async () => (await invoke(IPC_CHANNELS.memoryMerge, {})).merged,
});

const officeBridge: JarvisBridge['office'] = Object.freeze({
  dashboard: () => invoke(IPC_CHANNELS.officeDashboard, {}),
  search: (request: OfficeSearchRequest) => invoke(IPC_CHANNELS.officeSearch, request),
  quickAdd: (request: OfficeQuickAddRequest) => invoke(IPC_CHANNELS.officeQuickAdd, request),
  tasks: Object.freeze({
    list: () => invoke(IPC_CHANNELS.officeTaskList, {}),
    create: (request: CreateTaskRequest) => invoke(IPC_CHANNELS.officeTaskCreate, request),
    update: (request: UpdateTaskRequest) => invoke(IPC_CHANNELS.officeTaskUpdate, request),
    delete: async (id: string) => {
      await invoke(IPC_CHANNELS.officeTaskDelete, { id });
    },
    complete: (id: string) => invoke(IPC_CHANNELS.officeTaskComplete, { id }),
  }),
  notes: Object.freeze({
    list: () => invoke(IPC_CHANNELS.officeNoteList, {}),
    create: (request: CreateNoteRequest) => invoke(IPC_CHANNELS.officeNoteCreate, request),
    update: (request: UpdateNoteRequest) => invoke(IPC_CHANNELS.officeNoteUpdate, request),
    delete: async (id: string) => {
      await invoke(IPC_CHANNELS.officeNoteDelete, { id });
    },
  }),
  projects: Object.freeze({
    list: () => invoke(IPC_CHANNELS.officeProjectList, {}),
    create: (request: CreateProjectRequest) => invoke(IPC_CHANNELS.officeProjectCreate, request),
    update: (request: UpdateProjectRequest) => invoke(IPC_CHANNELS.officeProjectUpdate, request),
    delete: async (id: string) => {
      await invoke(IPC_CHANNELS.officeProjectDelete, { id });
    },
  }),
  reminders: Object.freeze({
    list: () => invoke(IPC_CHANNELS.officeReminderList, {}),
    create: (request: CreateReminderRequest) => invoke(IPC_CHANNELS.officeReminderCreate, request),
    update: (request: UpdateReminderRequest) => invoke(IPC_CHANNELS.officeReminderUpdate, request),
    delete: async (id: string) => {
      await invoke(IPC_CHANNELS.officeReminderDelete, { id });
    },
    snooze: (request: SnoozeReminderRequest) => invoke(IPC_CHANNELS.officeReminderSnooze, request),
    dismiss: (id: string) => invoke(IPC_CHANNELS.officeReminderDismiss, { id }),
  }),
});

const documentBridge: JarvisBridge['documents'] = Object.freeze({
  dashboard: () => invoke(IPC_CHANNELS.documentDashboard, {}),
  import: (request: DocumentImportRequest) => invoke(IPC_CHANNELS.documentImport, request),
  list: () => invoke(IPC_CHANNELS.documentList, {}),
  get: (documentId: string) => invoke(IPC_CHANNELS.documentGet, { documentId }),
  pin: (request: DocumentPinRequest) => invoke(IPC_CHANNELS.documentPin, request),
  delete: async (documentId: string) => {
    await invoke(IPC_CHANNELS.documentDelete, { documentId });
  },
  search: (request: DocumentSearchRequest) => invoke(IPC_CHANNELS.documentSearch, request),
  analyze: (request: DocumentAnalysisRequest) => invoke(IPC_CHANNELS.documentAnalyze, request),
});

const webBridge: JarvisBridge['web'] = Object.freeze({
  dashboard: () => invoke(IPC_CHANNELS.webDashboard, {}),
  ask: (request: WebAssistantRequest) => invoke(IPC_CHANNELS.webAsk, request),
  search: (request: WebSearchRequest) => invoke(IPC_CHANNELS.webSearch, request),
  weather: (request: WeatherRequest) => invoke(IPC_CHANNELS.webWeather, request),
  news: (request: NewsRequest) => invoke(IPC_CHANNELS.webNews, request),
  convertCurrency: (request: CurrencyConversionRequest) =>
    invoke(IPC_CHANNELS.webCurrencyConvert, request),
  time: (request: TimeRequest) => invoke(IPC_CHANNELS.webTime, request),
  convertTime: (request: TimeConversionRequest) => invoke(IPC_CHANNELS.webTimeConvert, request),
  maps: (request: MapLookupRequest) => invoke(IPC_CHANNELS.webMaps, request),
  knowledge: (request: KnowledgeRequest) => invoke(IPC_CHANNELS.webKnowledge, request),
  history: () => invoke(IPC_CHANNELS.webHistory, {}),
  bookmarks: () => invoke(IPC_CHANNELS.webBookmarkList, {}),
  saveBookmark: (request: WebBookmarkRequest) => invoke(IPC_CHANNELS.webBookmarkSave, request),
  deleteBookmark: async (id: string) => {
    await invoke(IPC_CHANNELS.webBookmarkDelete, { id });
  },
});

const desktopBridge: JarvisBridge['desktop'] = Object.freeze({
  dashboard: () => invoke(IPC_CHANNELS.desktopDashboard, {}),
  openApplication: (request: ApplicationActionRequest) =>
    invoke(IPC_CHANNELS.desktopOpenApplication, request),
  closeApplication: (request: ApplicationActionRequest) =>
    invoke(IPC_CHANNELS.desktopCloseApplication, request),
  restartApplication: (request: ApplicationActionRequest) =>
    invoke(IPC_CHANNELS.desktopRestartApplication, request),
  bringApplicationToFront: (request: ApplicationActionRequest) =>
    invoke(IPC_CHANNELS.desktopFrontApplication, request),
  openFile: (path: string) => invoke(IPC_CHANNELS.desktopOpenFile, { path }),
  openFolder: (path: string) => invoke(IPC_CHANNELS.desktopOpenFolder, { path }),
  browseFolder: (path: string) => invoke(IPC_CHANNELS.desktopBrowseFolder, { path }),
  operateFile: (request: FileOperationRequest) =>
    invoke(IPC_CHANNELS.desktopFileOperation, request),
  readClipboard: () => invoke(IPC_CHANNELS.desktopClipboardRead, {}),
  writeClipboard: (request: ClipboardWriteRequest) =>
    invoke(IPC_CHANNELS.desktopClipboardWrite, request),
  notify: (request: NotificationRequest) => invoke(IPC_CHANNELS.desktopNotify, request),
  screenshot: (request: ScreenshotRequest) => invoke(IPC_CHANNELS.desktopScreenshot, request),
  system: () => invoke(IPC_CHANNELS.desktopSystem, {}),
  routeTool: (request: ToolRouteRequest) => invoke(IPC_CHANNELS.desktopRouteTool, request),
  auditLogs: () => invoke(IPC_CHANNELS.desktopAuditLogs, {}),
});

const pluginsBridge: JarvisBridge['plugins'] = Object.freeze({
  dashboard: () => invoke(IPC_CHANNELS.pluginDashboard, {}),
  registry: () => invoke(IPC_CHANNELS.pluginRegistry, {}),
  validateManifest: (manifest: PluginManifest) =>
    invoke(IPC_CHANNELS.pluginValidateManifest, manifest),
  install: (request: PluginInstallRequest) => invoke(IPC_CHANNELS.pluginInstall, request),
  enable: (pluginId: string) => invoke(IPC_CHANNELS.pluginEnable, { pluginId }),
  disable: (pluginId: string) => invoke(IPC_CHANNELS.pluginDisable, { pluginId }),
  update: (request: PluginUpdateRequest) => invoke(IPC_CHANNELS.pluginUpdate, request),
  remove: (request: PluginRemoveRequest) => invoke(IPC_CHANNELS.pluginRemove, request),
  settings: (request: PluginSettingsUpdateRequest) => invoke(IPC_CHANNELS.pluginSettings, request),
  reset: (pluginId: string) => invoke(IPC_CHANNELS.pluginReset, { pluginId }),
  logs: (pluginId?: string) => invoke(IPC_CHANNELS.pluginLogs, pluginId ? { pluginId } : {}),
  invokeTool: (request: PluginToolInvokeRequest) => invoke(IPC_CHANNELS.pluginInvokeTool, request),
  routeTool: (request: PluginToolRouteRequest) => invoke(IPC_CHANNELS.pluginRouteTool, request),
  auditLogs: () => invoke(IPC_CHANNELS.pluginAuditLogs, {}),
});

const productionBridge: JarvisBridge['production'] = Object.freeze({
  dashboard: () => invoke(IPC_CHANNELS.productionDashboard, {}),
  recoveryReport: () => invoke(IPC_CHANNELS.productionRecoveryReport, {}),
  exportDiagnostics: (request: DiagnosticBundleRequest = {}) =>
    invoke(IPC_CHANNELS.productionExportDiagnostics, request),
  runSecurityAudit: () => invoke(IPC_CHANNELS.productionRunSecurityAudit, {}),
  validateBackups: (request: BackupValidationRequest) =>
    invoke(IPC_CHANNELS.productionValidateBackups, request),
  setDebugMode: (enabled: boolean) => invoke(IPC_CHANNELS.productionSetDebugMode, { enabled }),
  recordRendererCrash: (request: RendererCrashReportRequest) =>
    invoke(IPC_CHANNELS.productionRecordRendererCrash, request),
  safeRestart: (request: SafeRestartRequest) => invoke(IPC_CHANNELS.productionSafeRestart, request),
});

const releaseBridge: JarvisBridge['release'] = Object.freeze({
  dashboard: () => invoke(IPC_CHANNELS.releaseDashboard, {}),
  completeFirstRun: (request: FirstRunWizardRequest) =>
    invoke(IPC_CHANNELS.releaseFirstRunComplete, request),
  updateSettings: (request: SettingsUpdateRequest) =>
    invoke(IPC_CHANNELS.releaseSettingsUpdate, request),
  checkUpdates: (request: UpdateCheckRequest = {}) =>
    invoke(IPC_CHANNELS.releaseCheckUpdates, request),
  downloadUpdate: (request: UpdateDownloadRequest) =>
    invoke(IPC_CHANNELS.releaseDownloadUpdate, request),
  rollbackUpdate: (request: RollbackRequest) => invoke(IPC_CHANNELS.releaseRollbackUpdate, request),
  createBackup: (request: BackupWizardRequest) => invoke(IPC_CHANNELS.releaseCreateBackup, request),
  restoreBackup: (request: RestoreWizardRequest) =>
    invoke(IPC_CHANNELS.releaseRestoreBackup, request),
});

const bridge: JarvisBridge = Object.freeze({
  runtime: Object.freeze({
    getInfo: () => invoke(IPC_CHANNELS.runtimeInfo, {}),
  }),
  conversation: conversationBridge,
  memory: memoryBridge,
  office: officeBridge,
  documents: documentBridge,
  web: webBridge,
  desktop: desktopBridge,
  plugins: pluginsBridge,
  production: productionBridge,
  release: releaseBridge,
});

contextBridge.exposeInMainWorld('jarvis', bridge);
console.info('[JARVIS renderer] Preload available');
