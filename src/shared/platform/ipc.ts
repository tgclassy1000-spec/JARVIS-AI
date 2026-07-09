import type { IpcResult } from './errors';
import type {
  CancelGenerationRequest,
  ConversationDetail,
  ConversationExport,
  ConversationIdRequest,
  ConversationSummary,
  CreateConversationRequest,
  EditMessageRequest,
  ExportConversationRequest,
  GenerationEvent,
  GenerationStarted,
  RegenerateMessageRequest,
  RenameConversationRequest,
  SearchConversationsRequest,
  SendMessageRequest,
} from '../conversation/contracts';
import type {
  MemoryArchive,
  MemoryEnabledRequest,
  MemoryExport,
  MemoryIdRequest,
  MemoryKind,
  MemoryRecord,
  MemoryRestoreRequest,
  MemorySearchRequest,
  MemorySearchResult,
  MemorySettings,
  SaveMemoryRequest,
  UpdateMemoryRequest,
} from '../memory/contracts';
import type {
  CreateNoteRequest,
  CreateProjectRequest,
  CreateReminderRequest,
  CreateTaskRequest,
  NoteIdRequest,
  OfficeDashboard,
  OfficeNote,
  OfficeProject,
  OfficeQuickAddRequest,
  OfficeQuickAddResult,
  OfficeReminder,
  OfficeSearchRequest,
  OfficeSearchResult,
  OfficeTask,
  ProjectIdRequest,
  ReminderIdRequest,
  SnoozeReminderRequest,
  TaskIdRequest,
  UpdateNoteRequest,
  UpdateProjectRequest,
  UpdateReminderRequest,
  UpdateTaskRequest,
} from '../office/contracts';
import type {
  ApplicationActionRequest,
  ApplicationActionResult,
  AuditLogEntry,
  ClipboardSnapshot,
  ClipboardWriteRequest,
  DesktopDashboard,
  DesktopFileEntry,
  DesktopFolderListing,
  FilePathRequest,
  FileOperationRequest,
  FileOperationResult,
  NotificationRequest,
  DesktopNotification,
  ScreenshotRecord,
  ScreenshotRequest,
  SystemInformation,
  ToolRouteRequest,
  ToolRouteResult,
} from '../desktop/contracts';
import type {
  DocumentAnalysisRequest,
  DocumentAnalysisResult,
  DocumentDashboard,
  DocumentDetail,
  DocumentIdRequest,
  DocumentImportRequest,
  DocumentMetadata,
  DocumentPinRequest,
  DocumentSearchRequest,
  DocumentSearchResult,
} from '../documents/contracts';
import type {
  CurrencyConversionRequest,
  CurrencyConversionResponse,
  KnowledgeRequest,
  KnowledgeResponse,
  MapLookupRequest,
  MapLookupResponse,
  NewsRequest,
  NewsResponse,
  TimeConversionRequest,
  TimeConversionResponse,
  TimeRequest,
  TimeResponse,
  WeatherRequest,
  WeatherResponse,
  WebAssistantRequest,
  WebAssistantResponse,
  WebBookmark,
  WebBookmarkIdRequest,
  WebBookmarkRequest,
  WebDashboard,
  WebHistoryEntry,
  WebSearchRequest,
  WebSearchResponse,
} from '../web/contracts';
import type {
  InstalledPlugin,
  PluginAuditEntry,
  PluginDashboard,
  PluginIdRequest,
  PluginInstallRequest,
  PluginLogEntry,
  PluginManifest,
  PluginRemoveRequest,
  PluginRemoveResult,
  PluginRouteResult,
  PluginSettingsUpdateRequest,
  PluginToolInvokeRequest,
  PluginToolRouteRequest,
  PluginToolResult,
  PluginUpdateRequest,
  PluginValidationReport,
} from '../plugins/contracts';
import type {
  BackupValidationReport,
  BackupValidationRequest,
  DebugModeRequest,
  DebugModeState,
  DiagnosticBundle,
  DiagnosticBundleRequest,
  ProductionDashboard,
  RecoveryReport,
  RendererCrashReportRequest,
  SafeRestartRequest,
  SafeRestartResult,
  SecurityAuditReport,
} from '../production/contracts';
import type {
  BackupArtifact,
  BackupWizardRequest,
  FirstRunWizardRequest,
  ReleaseDashboard,
  RestoreWizardRequest,
  RestoreWizardResult,
  RollbackRequest,
  RollbackResult,
  SettingsUpdateRequest,
  ReleaseSettings,
  UpdateCheckRequest,
  UpdateDownloadRequest,
  UpdateDownloadResult,
  UpdateState,
} from '../release/contracts';

export const IPC_CHANNELS = {
  runtimeInfo: 'platform:runtime-info',
  conversationList: 'conversation:list',
  conversationCreate: 'conversation:create',
  conversationGet: 'conversation:get',
  conversationRename: 'conversation:rename',
  conversationDelete: 'conversation:delete',
  conversationSearch: 'conversation:search',
  conversationSend: 'conversation:send',
  conversationEdit: 'conversation:edit',
  conversationRegenerate: 'conversation:regenerate',
  conversationCancel: 'conversation:cancel',
  conversationExport: 'conversation:export',
  memoryList: 'memory:list',
  memorySave: 'memory:save',
  memoryUpdate: 'memory:update',
  memoryDelete: 'memory:delete',
  memorySearch: 'memory:search',
  memorySettings: 'memory:settings',
  memorySetEnabled: 'memory:set-enabled',
  memoryDeleteAll: 'memory:delete-all',
  memoryExport: 'memory:export',
  memoryBackup: 'memory:backup',
  memoryRestore: 'memory:restore',
  memoryMerge: 'memory:merge',
  officeDashboard: 'office:dashboard',
  officeSearch: 'office:search',
  officeQuickAdd: 'office:quick-add',
  officeTaskList: 'office:task:list',
  officeTaskCreate: 'office:task:create',
  officeTaskUpdate: 'office:task:update',
  officeTaskDelete: 'office:task:delete',
  officeTaskComplete: 'office:task:complete',
  officeNoteList: 'office:note:list',
  officeNoteCreate: 'office:note:create',
  officeNoteUpdate: 'office:note:update',
  officeNoteDelete: 'office:note:delete',
  officeProjectList: 'office:project:list',
  officeProjectCreate: 'office:project:create',
  officeProjectUpdate: 'office:project:update',
  officeProjectDelete: 'office:project:delete',
  officeReminderList: 'office:reminder:list',
  officeReminderCreate: 'office:reminder:create',
  officeReminderUpdate: 'office:reminder:update',
  officeReminderDelete: 'office:reminder:delete',
  officeReminderSnooze: 'office:reminder:snooze',
  officeReminderDismiss: 'office:reminder:dismiss',
  documentDashboard: 'document:dashboard',
  documentImport: 'document:import',
  documentList: 'document:list',
  documentGet: 'document:get',
  documentPin: 'document:pin',
  documentDelete: 'document:delete',
  documentSearch: 'document:search',
  documentAnalyze: 'document:analyze',
  webDashboard: 'web:dashboard',
  webAsk: 'web:ask',
  webSearch: 'web:search',
  webWeather: 'web:weather',
  webNews: 'web:news',
  webCurrencyConvert: 'web:currency:convert',
  webTime: 'web:time',
  webTimeConvert: 'web:time:convert',
  webMaps: 'web:maps',
  webKnowledge: 'web:knowledge',
  webHistory: 'web:history',
  webBookmarkList: 'web:bookmark:list',
  webBookmarkSave: 'web:bookmark:save',
  webBookmarkDelete: 'web:bookmark:delete',
  desktopDashboard: 'desktop:dashboard',
  desktopOpenApplication: 'desktop:application:open',
  desktopCloseApplication: 'desktop:application:close',
  desktopRestartApplication: 'desktop:application:restart',
  desktopFrontApplication: 'desktop:application:front',
  desktopOpenFile: 'desktop:file:open',
  desktopOpenFolder: 'desktop:folder:open',
  desktopBrowseFolder: 'desktop:folder:browse',
  desktopFileOperation: 'desktop:file:operation',
  desktopClipboardRead: 'desktop:clipboard:read',
  desktopClipboardWrite: 'desktop:clipboard:write',
  desktopNotify: 'desktop:notify',
  desktopScreenshot: 'desktop:screenshot',
  desktopSystem: 'desktop:system',
  desktopRouteTool: 'desktop:tool:route',
  desktopAuditLogs: 'desktop:audit:list',
  pluginDashboard: 'plugin:dashboard',
  pluginRegistry: 'plugin:registry',
  pluginValidateManifest: 'plugin:manifest:validate',
  pluginInstall: 'plugin:install',
  pluginEnable: 'plugin:enable',
  pluginDisable: 'plugin:disable',
  pluginUpdate: 'plugin:update',
  pluginRemove: 'plugin:remove',
  pluginSettings: 'plugin:settings',
  pluginReset: 'plugin:reset',
  pluginLogs: 'plugin:logs',
  pluginInvokeTool: 'plugin:tool:invoke',
  pluginRouteTool: 'plugin:tool:route',
  pluginAuditLogs: 'plugin:audit:list',
  productionDashboard: 'production:dashboard',
  productionRecoveryReport: 'production:recovery:report',
  productionExportDiagnostics: 'production:diagnostics:export',
  productionRunSecurityAudit: 'production:security:audit',
  productionValidateBackups: 'production:backup:validate',
  productionSetDebugMode: 'production:debug:set',
  productionRecordRendererCrash: 'production:renderer-crash:record',
  productionSafeRestart: 'production:restart:safe',
  releaseDashboard: 'release:dashboard',
  releaseFirstRunComplete: 'release:first-run:complete',
  releaseSettingsUpdate: 'release:settings:update',
  releaseCheckUpdates: 'release:updates:check',
  releaseDownloadUpdate: 'release:updates:download',
  releaseRollbackUpdate: 'release:updates:rollback',
  releaseCreateBackup: 'release:backup:create',
  releaseRestoreBackup: 'release:backup:restore',
} as const;

export const IPC_EVENTS = {
  generation: 'conversation:generation-event',
} as const;

export const ALLOWED_IPC_CHANNELS = Object.values(IPC_CHANNELS);
export const ALLOWED_IPC_EVENTS = Object.values(IPC_EVENTS);

export type IpcChannel = (typeof ALLOWED_IPC_CHANNELS)[number];

export type DesktopPlatform = 'windows' | 'macos' | 'linux' | 'other';

export type EmptyRequest = Readonly<Record<string, never>>;

export interface RuntimeInfo {
  readonly appVersion: string;
  readonly electronVersion: string;
  readonly platform: DesktopPlatform;
}

export interface IpcContractMap {
  readonly [IPC_CHANNELS.runtimeInfo]: {
    readonly request: EmptyRequest;
    readonly response: RuntimeInfo;
  };
  readonly [IPC_CHANNELS.conversationList]: {
    readonly request: EmptyRequest;
    readonly response: readonly ConversationSummary[];
  };
  readonly [IPC_CHANNELS.conversationCreate]: {
    readonly request: CreateConversationRequest;
    readonly response: ConversationDetail;
  };
  readonly [IPC_CHANNELS.conversationGet]: {
    readonly request: ConversationIdRequest;
    readonly response: ConversationDetail;
  };
  readonly [IPC_CHANNELS.conversationRename]: {
    readonly request: RenameConversationRequest;
    readonly response: ConversationSummary;
  };
  readonly [IPC_CHANNELS.conversationDelete]: {
    readonly request: ConversationIdRequest;
    readonly response: { readonly deleted: true };
  };
  readonly [IPC_CHANNELS.conversationSearch]: {
    readonly request: SearchConversationsRequest;
    readonly response: readonly ConversationSummary[];
  };
  readonly [IPC_CHANNELS.conversationSend]: {
    readonly request: SendMessageRequest;
    readonly response: GenerationStarted;
  };
  readonly [IPC_CHANNELS.conversationEdit]: {
    readonly request: EditMessageRequest;
    readonly response: GenerationStarted;
  };
  readonly [IPC_CHANNELS.conversationRegenerate]: {
    readonly request: RegenerateMessageRequest;
    readonly response: GenerationStarted;
  };
  readonly [IPC_CHANNELS.conversationCancel]: {
    readonly request: CancelGenerationRequest;
    readonly response: { readonly cancelled: boolean };
  };
  readonly [IPC_CHANNELS.conversationExport]: {
    readonly request: ExportConversationRequest;
    readonly response: ConversationExport;
  };
  readonly [IPC_CHANNELS.memoryList]: {
    readonly request: { readonly kind?: MemoryKind };
    readonly response: readonly MemoryRecord[];
  };
  readonly [IPC_CHANNELS.memorySave]: {
    readonly request: SaveMemoryRequest;
    readonly response: MemoryRecord;
  };
  readonly [IPC_CHANNELS.memoryUpdate]: {
    readonly request: UpdateMemoryRequest;
    readonly response: MemoryRecord;
  };
  readonly [IPC_CHANNELS.memoryDelete]: {
    readonly request: MemoryIdRequest;
    readonly response: { readonly deleted: true };
  };
  readonly [IPC_CHANNELS.memorySearch]: {
    readonly request: MemorySearchRequest;
    readonly response: readonly MemorySearchResult[];
  };
  readonly [IPC_CHANNELS.memorySettings]: {
    readonly request: EmptyRequest;
    readonly response: MemorySettings;
  };
  readonly [IPC_CHANNELS.memorySetEnabled]: {
    readonly request: MemoryEnabledRequest;
    readonly response: MemorySettings;
  };
  readonly [IPC_CHANNELS.memoryDeleteAll]: {
    readonly request: { readonly confirm: true };
    readonly response: { readonly deleted: number };
  };
  readonly [IPC_CHANNELS.memoryExport]: {
    readonly request: EmptyRequest;
    readonly response: MemoryExport;
  };
  readonly [IPC_CHANNELS.memoryBackup]: {
    readonly request: EmptyRequest;
    readonly response: MemoryArchive;
  };
  readonly [IPC_CHANNELS.memoryRestore]: {
    readonly request: MemoryRestoreRequest;
    readonly response: { readonly restored: number };
  };
  readonly [IPC_CHANNELS.memoryMerge]: {
    readonly request: EmptyRequest;
    readonly response: { readonly merged: number };
  };
  readonly [IPC_CHANNELS.officeDashboard]: {
    readonly request: EmptyRequest;
    readonly response: OfficeDashboard;
  };
  readonly [IPC_CHANNELS.officeSearch]: {
    readonly request: OfficeSearchRequest;
    readonly response: readonly OfficeSearchResult[];
  };
  readonly [IPC_CHANNELS.officeQuickAdd]: {
    readonly request: OfficeQuickAddRequest;
    readonly response: OfficeQuickAddResult;
  };
  readonly [IPC_CHANNELS.officeTaskList]: {
    readonly request: EmptyRequest;
    readonly response: readonly OfficeTask[];
  };
  readonly [IPC_CHANNELS.officeTaskCreate]: {
    readonly request: CreateTaskRequest;
    readonly response: OfficeTask;
  };
  readonly [IPC_CHANNELS.officeTaskUpdate]: {
    readonly request: UpdateTaskRequest;
    readonly response: OfficeTask;
  };
  readonly [IPC_CHANNELS.officeTaskDelete]: {
    readonly request: TaskIdRequest;
    readonly response: { readonly deleted: true };
  };
  readonly [IPC_CHANNELS.officeTaskComplete]: {
    readonly request: TaskIdRequest;
    readonly response: OfficeTask;
  };
  readonly [IPC_CHANNELS.officeNoteList]: {
    readonly request: EmptyRequest;
    readonly response: readonly OfficeNote[];
  };
  readonly [IPC_CHANNELS.officeNoteCreate]: {
    readonly request: CreateNoteRequest;
    readonly response: OfficeNote;
  };
  readonly [IPC_CHANNELS.officeNoteUpdate]: {
    readonly request: UpdateNoteRequest;
    readonly response: OfficeNote;
  };
  readonly [IPC_CHANNELS.officeNoteDelete]: {
    readonly request: NoteIdRequest;
    readonly response: { readonly deleted: true };
  };
  readonly [IPC_CHANNELS.officeProjectList]: {
    readonly request: EmptyRequest;
    readonly response: readonly OfficeProject[];
  };
  readonly [IPC_CHANNELS.officeProjectCreate]: {
    readonly request: CreateProjectRequest;
    readonly response: OfficeProject;
  };
  readonly [IPC_CHANNELS.officeProjectUpdate]: {
    readonly request: UpdateProjectRequest;
    readonly response: OfficeProject;
  };
  readonly [IPC_CHANNELS.officeProjectDelete]: {
    readonly request: ProjectIdRequest;
    readonly response: { readonly deleted: true };
  };
  readonly [IPC_CHANNELS.officeReminderList]: {
    readonly request: EmptyRequest;
    readonly response: readonly OfficeReminder[];
  };
  readonly [IPC_CHANNELS.officeReminderCreate]: {
    readonly request: CreateReminderRequest;
    readonly response: OfficeReminder;
  };
  readonly [IPC_CHANNELS.officeReminderUpdate]: {
    readonly request: UpdateReminderRequest;
    readonly response: OfficeReminder;
  };
  readonly [IPC_CHANNELS.officeReminderDelete]: {
    readonly request: ReminderIdRequest;
    readonly response: { readonly deleted: true };
  };
  readonly [IPC_CHANNELS.officeReminderSnooze]: {
    readonly request: SnoozeReminderRequest;
    readonly response: OfficeReminder;
  };
  readonly [IPC_CHANNELS.officeReminderDismiss]: {
    readonly request: ReminderIdRequest;
    readonly response: OfficeReminder;
  };
  readonly [IPC_CHANNELS.documentDashboard]: {
    readonly request: EmptyRequest;
    readonly response: DocumentDashboard;
  };
  readonly [IPC_CHANNELS.documentImport]: {
    readonly request: DocumentImportRequest;
    readonly response: DocumentDetail;
  };
  readonly [IPC_CHANNELS.documentList]: {
    readonly request: EmptyRequest;
    readonly response: readonly DocumentMetadata[];
  };
  readonly [IPC_CHANNELS.documentGet]: {
    readonly request: DocumentIdRequest;
    readonly response: DocumentDetail;
  };
  readonly [IPC_CHANNELS.documentPin]: {
    readonly request: DocumentPinRequest;
    readonly response: DocumentMetadata;
  };
  readonly [IPC_CHANNELS.documentDelete]: {
    readonly request: DocumentIdRequest;
    readonly response: { readonly deleted: true };
  };
  readonly [IPC_CHANNELS.documentSearch]: {
    readonly request: DocumentSearchRequest;
    readonly response: readonly DocumentSearchResult[];
  };
  readonly [IPC_CHANNELS.documentAnalyze]: {
    readonly request: DocumentAnalysisRequest;
    readonly response: DocumentAnalysisResult;
  };
  readonly [IPC_CHANNELS.webDashboard]: {
    readonly request: EmptyRequest;
    readonly response: WebDashboard;
  };
  readonly [IPC_CHANNELS.webAsk]: {
    readonly request: WebAssistantRequest;
    readonly response: WebAssistantResponse;
  };
  readonly [IPC_CHANNELS.webSearch]: {
    readonly request: WebSearchRequest;
    readonly response: WebSearchResponse;
  };
  readonly [IPC_CHANNELS.webWeather]: {
    readonly request: WeatherRequest;
    readonly response: WeatherResponse;
  };
  readonly [IPC_CHANNELS.webNews]: {
    readonly request: NewsRequest;
    readonly response: NewsResponse;
  };
  readonly [IPC_CHANNELS.webCurrencyConvert]: {
    readonly request: CurrencyConversionRequest;
    readonly response: CurrencyConversionResponse;
  };
  readonly [IPC_CHANNELS.webTime]: {
    readonly request: TimeRequest;
    readonly response: TimeResponse;
  };
  readonly [IPC_CHANNELS.webTimeConvert]: {
    readonly request: TimeConversionRequest;
    readonly response: TimeConversionResponse;
  };
  readonly [IPC_CHANNELS.webMaps]: {
    readonly request: MapLookupRequest;
    readonly response: MapLookupResponse;
  };
  readonly [IPC_CHANNELS.webKnowledge]: {
    readonly request: KnowledgeRequest;
    readonly response: KnowledgeResponse;
  };
  readonly [IPC_CHANNELS.webHistory]: {
    readonly request: EmptyRequest;
    readonly response: readonly WebHistoryEntry[];
  };
  readonly [IPC_CHANNELS.webBookmarkList]: {
    readonly request: EmptyRequest;
    readonly response: readonly WebBookmark[];
  };
  readonly [IPC_CHANNELS.webBookmarkSave]: {
    readonly request: WebBookmarkRequest;
    readonly response: WebBookmark;
  };
  readonly [IPC_CHANNELS.webBookmarkDelete]: {
    readonly request: WebBookmarkIdRequest;
    readonly response: { readonly deleted: true };
  };
  readonly [IPC_CHANNELS.desktopDashboard]: {
    readonly request: EmptyRequest;
    readonly response: DesktopDashboard;
  };
  readonly [IPC_CHANNELS.desktopOpenApplication]: {
    readonly request: ApplicationActionRequest;
    readonly response: ApplicationActionResult;
  };
  readonly [IPC_CHANNELS.desktopCloseApplication]: {
    readonly request: ApplicationActionRequest;
    readonly response: ApplicationActionResult;
  };
  readonly [IPC_CHANNELS.desktopRestartApplication]: {
    readonly request: ApplicationActionRequest;
    readonly response: ApplicationActionResult;
  };
  readonly [IPC_CHANNELS.desktopFrontApplication]: {
    readonly request: ApplicationActionRequest;
    readonly response: ApplicationActionResult;
  };
  readonly [IPC_CHANNELS.desktopOpenFile]: {
    readonly request: FilePathRequest;
    readonly response: DesktopFileEntry;
  };
  readonly [IPC_CHANNELS.desktopOpenFolder]: {
    readonly request: FilePathRequest;
    readonly response: DesktopFolderListing;
  };
  readonly [IPC_CHANNELS.desktopBrowseFolder]: {
    readonly request: FilePathRequest;
    readonly response: DesktopFolderListing;
  };
  readonly [IPC_CHANNELS.desktopFileOperation]: {
    readonly request: FileOperationRequest;
    readonly response: FileOperationResult;
  };
  readonly [IPC_CHANNELS.desktopClipboardRead]: {
    readonly request: EmptyRequest;
    readonly response: ClipboardSnapshot;
  };
  readonly [IPC_CHANNELS.desktopClipboardWrite]: {
    readonly request: ClipboardWriteRequest;
    readonly response: ClipboardSnapshot;
  };
  readonly [IPC_CHANNELS.desktopNotify]: {
    readonly request: NotificationRequest;
    readonly response: DesktopNotification;
  };
  readonly [IPC_CHANNELS.desktopScreenshot]: {
    readonly request: ScreenshotRequest;
    readonly response: ScreenshotRecord;
  };
  readonly [IPC_CHANNELS.desktopSystem]: {
    readonly request: EmptyRequest;
    readonly response: SystemInformation;
  };
  readonly [IPC_CHANNELS.desktopRouteTool]: {
    readonly request: ToolRouteRequest;
    readonly response: ToolRouteResult;
  };
  readonly [IPC_CHANNELS.desktopAuditLogs]: {
    readonly request: EmptyRequest;
    readonly response: readonly AuditLogEntry[];
  };
  readonly [IPC_CHANNELS.pluginDashboard]: {
    readonly request: EmptyRequest;
    readonly response: PluginDashboard;
  };
  readonly [IPC_CHANNELS.pluginRegistry]: {
    readonly request: EmptyRequest;
    readonly response: readonly PluginManifest[];
  };
  readonly [IPC_CHANNELS.pluginValidateManifest]: {
    readonly request: PluginManifest;
    readonly response: PluginValidationReport;
  };
  readonly [IPC_CHANNELS.pluginInstall]: {
    readonly request: PluginInstallRequest;
    readonly response: InstalledPlugin;
  };
  readonly [IPC_CHANNELS.pluginEnable]: {
    readonly request: PluginIdRequest;
    readonly response: InstalledPlugin;
  };
  readonly [IPC_CHANNELS.pluginDisable]: {
    readonly request: PluginIdRequest;
    readonly response: InstalledPlugin;
  };
  readonly [IPC_CHANNELS.pluginUpdate]: {
    readonly request: PluginUpdateRequest;
    readonly response: InstalledPlugin;
  };
  readonly [IPC_CHANNELS.pluginRemove]: {
    readonly request: PluginRemoveRequest;
    readonly response: PluginRemoveResult;
  };
  readonly [IPC_CHANNELS.pluginSettings]: {
    readonly request: PluginSettingsUpdateRequest;
    readonly response: InstalledPlugin;
  };
  readonly [IPC_CHANNELS.pluginReset]: {
    readonly request: PluginIdRequest;
    readonly response: InstalledPlugin;
  };
  readonly [IPC_CHANNELS.pluginLogs]: {
    readonly request: Partial<PluginIdRequest>;
    readonly response: readonly PluginLogEntry[];
  };
  readonly [IPC_CHANNELS.pluginInvokeTool]: {
    readonly request: PluginToolInvokeRequest;
    readonly response: PluginToolResult;
  };
  readonly [IPC_CHANNELS.pluginRouteTool]: {
    readonly request: PluginToolRouteRequest;
    readonly response: PluginRouteResult;
  };
  readonly [IPC_CHANNELS.pluginAuditLogs]: {
    readonly request: EmptyRequest;
    readonly response: readonly PluginAuditEntry[];
  };
  readonly [IPC_CHANNELS.productionDashboard]: {
    readonly request: EmptyRequest;
    readonly response: ProductionDashboard;
  };
  readonly [IPC_CHANNELS.productionRecoveryReport]: {
    readonly request: EmptyRequest;
    readonly response: RecoveryReport;
  };
  readonly [IPC_CHANNELS.productionExportDiagnostics]: {
    readonly request: DiagnosticBundleRequest;
    readonly response: DiagnosticBundle;
  };
  readonly [IPC_CHANNELS.productionRunSecurityAudit]: {
    readonly request: EmptyRequest;
    readonly response: SecurityAuditReport;
  };
  readonly [IPC_CHANNELS.productionValidateBackups]: {
    readonly request: BackupValidationRequest;
    readonly response: BackupValidationReport;
  };
  readonly [IPC_CHANNELS.productionSetDebugMode]: {
    readonly request: DebugModeRequest;
    readonly response: DebugModeState;
  };
  readonly [IPC_CHANNELS.productionRecordRendererCrash]: {
    readonly request: RendererCrashReportRequest;
    readonly response: RecoveryReport;
  };
  readonly [IPC_CHANNELS.productionSafeRestart]: {
    readonly request: SafeRestartRequest;
    readonly response: SafeRestartResult;
  };
  readonly [IPC_CHANNELS.releaseDashboard]: {
    readonly request: EmptyRequest;
    readonly response: ReleaseDashboard;
  };
  readonly [IPC_CHANNELS.releaseFirstRunComplete]: {
    readonly request: FirstRunWizardRequest;
    readonly response: ReleaseDashboard;
  };
  readonly [IPC_CHANNELS.releaseSettingsUpdate]: {
    readonly request: SettingsUpdateRequest;
    readonly response: ReleaseSettings;
  };
  readonly [IPC_CHANNELS.releaseCheckUpdates]: {
    readonly request: UpdateCheckRequest;
    readonly response: UpdateState;
  };
  readonly [IPC_CHANNELS.releaseDownloadUpdate]: {
    readonly request: UpdateDownloadRequest;
    readonly response: UpdateDownloadResult;
  };
  readonly [IPC_CHANNELS.releaseRollbackUpdate]: {
    readonly request: RollbackRequest;
    readonly response: RollbackResult;
  };
  readonly [IPC_CHANNELS.releaseCreateBackup]: {
    readonly request: BackupWizardRequest;
    readonly response: BackupArtifact;
  };
  readonly [IPC_CHANNELS.releaseRestoreBackup]: {
    readonly request: RestoreWizardRequest;
    readonly response: RestoreWizardResult;
  };
}

export type IpcRequest<C extends IpcChannel> = IpcContractMap[C]['request'];
export type IpcResponse<C extends IpcChannel> = IpcContractMap[C]['response'];

export interface JarvisBridge {
  readonly runtime: {
    getInfo(): Promise<RuntimeInfo>;
  };
  readonly conversation: {
    list(): Promise<readonly ConversationSummary[]>;
    create(request?: CreateConversationRequest): Promise<ConversationDetail>;
    get(conversationId: string): Promise<ConversationDetail>;
    rename(request: RenameConversationRequest): Promise<ConversationSummary>;
    delete(conversationId: string): Promise<void>;
    search(query: string): Promise<readonly ConversationSummary[]>;
    send(request: SendMessageRequest): Promise<GenerationStarted>;
    edit(request: EditMessageRequest): Promise<GenerationStarted>;
    regenerate(request: RegenerateMessageRequest): Promise<GenerationStarted>;
    cancel(generationId: string): Promise<boolean>;
    export(request: ExportConversationRequest): Promise<ConversationExport>;
    onGenerationEvent(listener: (event: GenerationEvent) => void): () => void;
  };
  readonly memory: {
    list(kind?: MemoryKind): Promise<readonly MemoryRecord[]>;
    save(request: SaveMemoryRequest): Promise<MemoryRecord>;
    update(request: UpdateMemoryRequest): Promise<MemoryRecord>;
    delete(id: string): Promise<void>;
    search(request: MemorySearchRequest): Promise<readonly MemorySearchResult[]>;
    settings(): Promise<MemorySettings>;
    setEnabled(enabled: boolean): Promise<MemorySettings>;
    deleteAll(): Promise<number>;
    export(): Promise<MemoryExport>;
    backup(): Promise<MemoryArchive>;
    restore(request: MemoryRestoreRequest): Promise<number>;
    mergeDuplicates(): Promise<number>;
  };
  readonly office: {
    dashboard(): Promise<OfficeDashboard>;
    search(request: OfficeSearchRequest): Promise<readonly OfficeSearchResult[]>;
    quickAdd(request: OfficeQuickAddRequest): Promise<OfficeQuickAddResult>;
    tasks: {
      list(): Promise<readonly OfficeTask[]>;
      create(request: CreateTaskRequest): Promise<OfficeTask>;
      update(request: UpdateTaskRequest): Promise<OfficeTask>;
      delete(id: string): Promise<void>;
      complete(id: string): Promise<OfficeTask>;
    };
    notes: {
      list(): Promise<readonly OfficeNote[]>;
      create(request: CreateNoteRequest): Promise<OfficeNote>;
      update(request: UpdateNoteRequest): Promise<OfficeNote>;
      delete(id: string): Promise<void>;
    };
    projects: {
      list(): Promise<readonly OfficeProject[]>;
      create(request: CreateProjectRequest): Promise<OfficeProject>;
      update(request: UpdateProjectRequest): Promise<OfficeProject>;
      delete(id: string): Promise<void>;
    };
    reminders: {
      list(): Promise<readonly OfficeReminder[]>;
      create(request: CreateReminderRequest): Promise<OfficeReminder>;
      update(request: UpdateReminderRequest): Promise<OfficeReminder>;
      delete(id: string): Promise<void>;
      snooze(request: SnoozeReminderRequest): Promise<OfficeReminder>;
      dismiss(id: string): Promise<OfficeReminder>;
    };
  };
  readonly documents: {
    dashboard(): Promise<DocumentDashboard>;
    import(request: DocumentImportRequest): Promise<DocumentDetail>;
    list(): Promise<readonly DocumentMetadata[]>;
    get(documentId: string): Promise<DocumentDetail>;
    pin(request: DocumentPinRequest): Promise<DocumentMetadata>;
    delete(documentId: string): Promise<void>;
    search(request: DocumentSearchRequest): Promise<readonly DocumentSearchResult[]>;
    analyze(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult>;
  };
  readonly web: {
    dashboard(): Promise<WebDashboard>;
    ask(request: WebAssistantRequest): Promise<WebAssistantResponse>;
    search(request: WebSearchRequest): Promise<WebSearchResponse>;
    weather(request: WeatherRequest): Promise<WeatherResponse>;
    news(request: NewsRequest): Promise<NewsResponse>;
    convertCurrency(request: CurrencyConversionRequest): Promise<CurrencyConversionResponse>;
    time(request: TimeRequest): Promise<TimeResponse>;
    convertTime(request: TimeConversionRequest): Promise<TimeConversionResponse>;
    maps(request: MapLookupRequest): Promise<MapLookupResponse>;
    knowledge(request: KnowledgeRequest): Promise<KnowledgeResponse>;
    history(): Promise<readonly WebHistoryEntry[]>;
    bookmarks(): Promise<readonly WebBookmark[]>;
    saveBookmark(request: WebBookmarkRequest): Promise<WebBookmark>;
    deleteBookmark(id: string): Promise<void>;
  };
  readonly desktop: {
    dashboard(): Promise<DesktopDashboard>;
    openApplication(request: ApplicationActionRequest): Promise<ApplicationActionResult>;
    closeApplication(request: ApplicationActionRequest): Promise<ApplicationActionResult>;
    restartApplication(request: ApplicationActionRequest): Promise<ApplicationActionResult>;
    bringApplicationToFront(request: ApplicationActionRequest): Promise<ApplicationActionResult>;
    openFile(path: string): Promise<DesktopFileEntry>;
    openFolder(path: string): Promise<DesktopFolderListing>;
    browseFolder(path: string): Promise<DesktopFolderListing>;
    operateFile(request: FileOperationRequest): Promise<FileOperationResult>;
    readClipboard(): Promise<ClipboardSnapshot>;
    writeClipboard(request: ClipboardWriteRequest): Promise<ClipboardSnapshot>;
    notify(request: NotificationRequest): Promise<DesktopNotification>;
    screenshot(request: ScreenshotRequest): Promise<ScreenshotRecord>;
    system(): Promise<SystemInformation>;
    routeTool(request: ToolRouteRequest): Promise<ToolRouteResult>;
    auditLogs(): Promise<readonly AuditLogEntry[]>;
  };
  readonly plugins: {
    dashboard(): Promise<PluginDashboard>;
    registry(): Promise<readonly PluginManifest[]>;
    validateManifest(manifest: PluginManifest): Promise<PluginValidationReport>;
    install(request: PluginInstallRequest): Promise<InstalledPlugin>;
    enable(pluginId: string): Promise<InstalledPlugin>;
    disable(pluginId: string): Promise<InstalledPlugin>;
    update(request: PluginUpdateRequest): Promise<InstalledPlugin>;
    remove(request: PluginRemoveRequest): Promise<PluginRemoveResult>;
    settings(request: PluginSettingsUpdateRequest): Promise<InstalledPlugin>;
    reset(pluginId: string): Promise<InstalledPlugin>;
    logs(pluginId?: string): Promise<readonly PluginLogEntry[]>;
    invokeTool(request: PluginToolInvokeRequest): Promise<PluginToolResult>;
    routeTool(request: PluginToolRouteRequest): Promise<PluginRouteResult>;
    auditLogs(): Promise<readonly PluginAuditEntry[]>;
  };
  readonly production: {
    dashboard(): Promise<ProductionDashboard>;
    recoveryReport(): Promise<RecoveryReport>;
    exportDiagnostics(request?: DiagnosticBundleRequest): Promise<DiagnosticBundle>;
    runSecurityAudit(): Promise<SecurityAuditReport>;
    validateBackups(request: BackupValidationRequest): Promise<BackupValidationReport>;
    setDebugMode(enabled: boolean): Promise<DebugModeState>;
    recordRendererCrash(request: RendererCrashReportRequest): Promise<RecoveryReport>;
    safeRestart(request: SafeRestartRequest): Promise<SafeRestartResult>;
  };
  readonly release: {
    dashboard(): Promise<ReleaseDashboard>;
    completeFirstRun(request: FirstRunWizardRequest): Promise<ReleaseDashboard>;
    updateSettings(request: SettingsUpdateRequest): Promise<ReleaseSettings>;
    checkUpdates(request?: UpdateCheckRequest): Promise<UpdateState>;
    downloadUpdate(request: UpdateDownloadRequest): Promise<UpdateDownloadResult>;
    rollbackUpdate(request: RollbackRequest): Promise<RollbackResult>;
    createBackup(request: BackupWizardRequest): Promise<BackupArtifact>;
    restoreBackup(request: RestoreWizardRequest): Promise<RestoreWizardResult>;
  };
}

export function unwrapIpcResult<T>(result: IpcResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`${result.error.code}: ${result.error.message}`);
}
