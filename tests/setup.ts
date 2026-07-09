import '@testing-library/jest-dom/vitest';

import type { ConversationDetail } from '../src/shared/conversation/contracts';
import type {
  AuditLogEntry,
  DesktopDashboard,
  DesktopNotification,
  ScreenshotRecord,
  SystemInformation,
} from '../src/shared/desktop/contracts';
import type {
  DocumentDashboard,
  DocumentDetail,
  DocumentMetadata,
} from '../src/shared/documents/contracts';
import type {
  OfficeDashboard,
  OfficeNote,
  OfficeProject,
  OfficeReminder,
  OfficeTask,
} from '../src/shared/office/contracts';
import type { JarvisBridge } from '../src/shared/platform/ipc';
import type {
  InstalledPlugin,
  PluginAuditEntry,
  PluginDashboard,
  PluginLogEntry,
  PluginManifest,
  PluginToolResult,
} from '../src/shared/plugins/contracts';
import type {
  AccessibilityStatus,
  DataProtectionStatus,
  DebugModeState,
  PerformanceSnapshot,
  ProductionDashboard,
  RecoveryReport,
  SecurityAuditReport,
} from '../src/shared/production/contracts';
import type {
  BackupArtifact,
  ReleaseDashboard,
  ReleaseSettings,
  RestoreWizardResult,
  UpdateState,
} from '../src/shared/release/contracts';
import type {
  NewsArticle,
  WebBookmark,
  WebDashboard,
  WebHistoryEntry,
  WebSearchResult,
} from '../src/shared/web/contracts';

const emptyConversation: ConversationDetail = {
  id: 'test-conversation',
  title: 'Test conversation',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  messageCount: 0,
  preview: '',
  messages: [],
};

const officeTask: OfficeTask = {
  id: 'task',
  title: 'Review invoice',
  description: '',
  completed: false,
  priority: 'medium',
  labels: [],
  progress: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const officeNote: OfficeNote = {
  id: 'note',
  title: 'Pinned note',
  content: '- [ ] Ship Module 6',
  tags: ['module-6'],
  pinned: true,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  versions: [],
};

const officeProject: OfficeProject = {
  id: 'project',
  name: 'Apollo',
  description: '',
  status: 'active',
  priority: 'medium',
  progress: 0,
  goals: [],
  taskCount: 0,
  noteCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const officeReminder: OfficeReminder = {
  id: 'reminder',
  title: 'Stand up',
  note: '',
  remindAt: '2026-01-01T01:00:00.000Z',
  status: 'scheduled',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const officeDashboard: OfficeDashboard = {
  todayTasks: [officeTask],
  upcomingDeadlines: [officeProject],
  pinnedNotes: [officeNote],
  recentConversations: [],
  recentMemories: [],
  quickActions: ['Create task'],
  statistics: {
    openTasks: 1,
    completedTasks: 0,
    activeProjects: 1,
    scheduledReminders: 1,
    pinnedNotes: 1,
  },
};

const documentDetail: DocumentDetail = {
  id: 'document',
  title: 'Module 7 Brief.md',
  format: 'markdown',
  sourcePath: 'A:\\J.A.R.V.I.S\\Module 7 Brief.md',
  byteSize: 2048,
  mimeType: 'text/markdown',
  checksum: 'checksum',
  wordCount: 42,
  characterCount: 240,
  tableCount: 1,
  ocrStatus: 'not-required',
  pinned: true,
  importedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastOpenedAt: '2026-01-01T00:00:00.000Z',
  preview: 'Module 7 document intelligence brief with action items.',
  chunks: [
    {
      id: 'chunk',
      documentId: 'document',
      index: 0,
      content: 'Module 7 document intelligence brief with action items.',
      tokenEstimate: 12,
    },
  ],
  tables: [
    {
      title: 'Plan',
      rows: [
        ['Feature', 'Status'],
        ['Documents', 'Ready'],
      ],
    },
  ],
};

const documentMetadata: DocumentMetadata = documentDetail;

const documentDashboard: DocumentDashboard = {
  recent: [documentMetadata],
  pinned: [documentMetadata],
  totalDocuments: 1,
  totalChunks: 1,
  supportedFormats: [
    'pdf',
    'docx',
    'xlsx',
    'pptx',
    'txt',
    'markdown',
    'csv',
    'json',
    'png',
    'jpg',
    'jpeg',
    'webp',
  ],
};

const webSearchResult: WebSearchResult = {
  id: 'search-1',
  title: 'JARVIS web intelligence',
  url: 'https://example.com/jarvis-web',
  snippet: 'Secure real-time web intelligence result.',
  source: 'example.com',
  rank: 1,
  score: 1,
};

const webArticle: NewsArticle = {
  id: 'news-1',
  title: 'AI systems gain better web grounding',
  url: 'https://example.com/news',
  source: 'example.com',
  summary: 'AI web grounding summary.',
  category: 'technology',
  publishedAt: '2026-01-01T00:00:00.000Z',
};

const webHistory: WebHistoryEntry = {
  id: 'history-1',
  kind: 'search',
  title: 'Latest AI news',
  query: 'Latest AI news',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const webBookmark: WebBookmark = {
  id: 'bookmark-1',
  kind: 'search',
  title: 'JARVIS web intelligence',
  query: 'jarvis web',
  url: 'https://example.com/jarvis-web',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const webDashboard: WebDashboard = {
  history: [webHistory],
  bookmarks: [webBookmark],
  tools: ['search', 'weather', 'news', 'currency', 'maps', 'time', 'knowledge'],
};

const desktopSystem: SystemInformation = {
  cpu: { model: 'Test CPU', cores: 8, loadPercent: 0 },
  ram: { totalBytes: 16_000_000_000, freeBytes: 8_000_000_000, usedPercent: 50 },
  disk: {
    label: 'Documents',
    totalBytes: 500_000_000_000,
    freeBytes: 250_000_000_000,
    usedPercent: 50,
  },
  battery: { available: false, charging: false, percent: 0 },
  gpu: { vendor: 'test', model: 'gpu' },
  operatingSystem: { platform: 'Windows (win32)', release: 'test', arch: 'x64' },
  network: { online: true, interfaces: ['Ethernet'] },
};

const desktopScreenshot: ScreenshotRecord = {
  id: 'shot-1',
  kind: 'screen',
  dataUrl: 'data:image/png;base64,',
  width: 100,
  height: 60,
  capturedAt: '2026-01-01T00:00:00.000Z',
};

const desktopNotification: DesktopNotification = {
  id: 'notification-1',
  kind: 'desktop',
  title: 'J.A.R.V.I.S.',
  body: 'Test notification',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const desktopAudit: AuditLogEntry = {
  id: 'audit-1',
  action: 'desktop.test',
  target: 'test',
  allowed: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  detail: 'Test audit entry.',
};

const desktopDashboard: DesktopDashboard = {
  allowedApplications: [
    { id: 'chrome', name: 'Google Chrome', favorite: true, supported: true },
    { id: 'vscode', name: 'Visual Studio Code', favorite: true, supported: true },
  ],
  runningApplications: [],
  recentApplications: [],
  favoriteApplications: [
    { id: 'chrome', name: 'Google Chrome', favorite: true, supported: true },
    { id: 'vscode', name: 'Visual Studio Code', favorite: true, supported: true },
  ],
  recentFiles: [],
  favoriteFolders: [
    {
      path: 'A:\\Users\\Test\\Downloads',
      name: 'Downloads',
      kind: 'folder',
      sizeBytes: 0,
      modifiedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  clipboardHistory: [],
  notifications: [desktopNotification],
  screenshots: [desktopScreenshot],
  system: desktopSystem,
  auditLogs: [desktopAudit],
};

const pluginManifest: PluginManifest = {
  name: 'JARVIS Translate',
  id: 'jarvis-translate',
  version: '1.0.0',
  author: 'JARVIS Core',
  description: 'Adds isolated translation and summarization skills.',
  permissions: ['storage'],
  capabilities: [
    {
      id: 'translate-text',
      name: 'Translate',
      description: 'Translate text between languages.',
      kind: 'translate',
      requiredPermissions: [],
    },
  ],
  minimumJarvisVersion: '0.8.0',
};

const installedPlugin: InstalledPlugin = {
  manifest: pluginManifest,
  source: 'local',
  status: 'enabled',
  installedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  verification: {
    status: 'verified',
    reason: 'Trusted test signature.',
    checkedAt: '2026-01-01T00:00:00.000Z',
  },
  settings: {
    configuration: {},
    grantedPermissions: ['storage'],
    storage: {},
    storageBytes: 0,
  },
};

const pluginLog: PluginLogEntry = {
  id: 'plugin-log',
  pluginId: pluginManifest.id,
  level: 'audit',
  message: 'Plugin test log.',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const pluginAudit: PluginAuditEntry = {
  id: 'plugin-audit',
  pluginId: pluginManifest.id,
  action: 'plugin.test',
  allowed: true,
  detail: 'Plugin test audit.',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const pluginToolResult: PluginToolResult = {
  pluginId: pluginManifest.id,
  capabilityId: 'translate-text',
  capabilityKind: 'translate',
  executedBy: 'tool-registry',
  output: {
    message: 'Translate accepted by the isolated tool registry.',
    pluginCodeExecuted: false,
    sandbox: 'isolated',
  },
};

const pluginDashboard: PluginDashboard = {
  installed: [installedPlugin],
  registry: [pluginManifest],
  availableSkills: pluginManifest.capabilities,
  updates: [],
  logs: [pluginLog],
  audit: [pluginAudit],
};

const recoveryReport: RecoveryReport = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  restartAvailable: true,
  reports: [],
  recommendations: ['No crash reports recorded in this profile.'],
};

const dataProtectionStatus: DataProtectionStatus = {
  encryption: {
    available: true,
    algorithm: 'aes-256-gcm',
    credentialStore: 'encrypted-local',
    encryptedCredentialCount: 0,
  },
  databaseIntegrity: [
    {
      name: 'test',
      path: 'A:\\J.A.R.V.I.S\\test.sqlite',
      ok: true,
      detail: 'ok',
      checkedAt: '2026-01-01T00:00:00.000Z',
      recovered: false,
    },
  ],
  backupValidation: [],
};

const performanceSnapshot: PerformanceSnapshot = {
  capturedAt: '2026-01-01T00:00:00.000Z',
  uptimeMs: 42,
  startup: [{ name: 'test-bootstrap', elapsedMs: 1 }],
  memory: {
    rssBytes: 100_000_000,
    heapUsedBytes: 32_000_000,
    heapTotalBytes: 64_000_000,
    externalBytes: 1_000_000,
  },
  backgroundTasks: [
    {
      id: 'database-integrity-watch',
      intervalMs: 900_000,
      runCount: 1,
      failureCount: 0,
      lastRunAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  cleanupHandlers: 0,
  leakDetection: {
    status: 'pass',
    sampleCount: 2,
    heapGrowthBytes: 1024,
    detail: 'Heap growth is within the configured threshold.',
  },
};

const securityAudit: SecurityAuditReport = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  checks: [
    {
      area: 'security',
      name: 'CSP verification',
      status: 'pass',
      detail: 'Renderer Content Security Policy blocks unsafe script execution.',
      checkedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  summary: { passed: 1, warnings: 0, failed: 0 },
};

const accessibilityStatus: AccessibilityStatus = {
  keyboardNavigation: 'pass',
  screenReaderLabels: 'pass',
  highContrastMode: 'pass',
  reducedMotion: 'pass',
  checkedAt: '2026-01-01T00:00:00.000Z',
};

const debugMode: DebugModeState = {
  enabled: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const productionDashboard: ProductionDashboard = {
  overallStatus: 'pass',
  checks: [
    {
      area: 'crash-recovery',
      name: 'Crash recovery',
      status: 'pass',
      detail: 'Global and renderer crash recovery hooks are registered.',
      checkedAt: '2026-01-01T00:00:00.000Z',
    },
    ...securityAudit.checks,
  ],
  recovery: recoveryReport,
  dataProtection: dataProtectionStatus,
  performance: performanceSnapshot,
  security: securityAudit,
  accessibility: accessibilityStatus,
  debugMode,
};

const releaseSettings: ReleaseSettings = {
  appearance: { theme: 'dark', reducedMotion: false },
  voice: { enabled: false },
  ai: { provider: 'gemini', model: 'gemini-2.5-flash', apiKeyConfigured: false },
  memory: { enabled: true },
  office: { notificationsEnabled: true },
  plugins: { enabled: true, allowCommunityPlugins: false },
  privacy: { diagnosticsOptIn: false, crashReportsOptIn: true, localOnlyMode: false },
  updates: { channel: 'stable', automaticChecks: false, automaticDownloads: false },
  performance: { startOnBoot: false, hardwareAcceleration: true, backgroundTasks: true },
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const releaseUpdateState: UpdateState = {
  currentVersion: '0.12.0-test',
  channel: 'stable',
  updateAvailable: false,
  status: 'idle',
};

const releaseBackup: BackupArtifact = {
  filename: 'jarvis-backup-test.json',
  path: 'A:\\J.A.R.V.I.S\\release\\jarvis-backup-test.json',
  sha256: 'a'.repeat(64),
  sizeBytes: 1024,
  createdAt: '2026-01-01T00:00:00.000Z',
  sections: ['settings', 'memory'],
};

const releaseRestore: RestoreWizardResult = {
  validated: true,
  restored: false,
  requiresRestart: false,
  summary: 'Backup is valid. Confirm restore to stage files for the next restart.',
  sections: ['settings', 'memory'],
};

const releaseDashboard: ReleaseDashboard = {
  appVersion: '0.12.0-test',
  channel: 'stable',
  firstRun: {
    completed: false,
    language: 'en-US',
    grantedPermissions: [],
  },
  settings: releaseSettings,
  updates: releaseUpdateState,
  rollback: {
    available: false,
    currentVersion: '0.12.0-test',
    reason: 'No downloaded update checkpoint exists.',
  },
  packaging: {
    outputDirectory: 'A:\\J.A.R.V.I.S\\release',
    targets: [
      {
        kind: 'msi',
        enabled: true,
        description: 'Windows MSI package for managed deployments.',
      },
      {
        kind: 'exe',
        enabled: true,
        description: 'NSIS setup executable with uninstaller support.',
      },
      {
        kind: 'portable-zip',
        enabled: true,
        description: 'Portable ZIP artifact for no-install environments.',
      },
    ],
    desktopShortcut: true,
    startMenuShortcut: true,
    uninstaller: true,
    compression: 'maximum',
    asar: true,
    developmentFilesExcluded: true,
  },
  signing: {
    mode: 'unsigned-development',
    certificateConfigured: false,
    pipeline: 'electron-builder-csc',
    fallbackAllowed: true,
  },
  qa: [
    {
      id: 'production-build',
      label: 'Production build',
      status: 'pending',
      command: 'npm run build',
    },
    {
      id: 'installer-build',
      label: 'Installer artifacts',
      status: 'pending',
      command: 'npm run dist:win:unsigned',
    },
  ],
};

const bridge: JarvisBridge = {
  runtime: {
    getInfo: () =>
      Promise.resolve({
        appVersion: '0.1.0-test',
        electronVersion: 'test-runtime',
        platform: 'windows',
      }),
  },
  conversation: {
    list: () => Promise.resolve([]),
    create: () => Promise.resolve(emptyConversation),
    get: () => Promise.resolve(emptyConversation),
    rename: () => Promise.resolve(emptyConversation),
    delete: () => Promise.resolve(),
    search: () => Promise.resolve([]),
    send: () => Promise.reject(new Error('Not configured in this test.')),
    edit: () => Promise.reject(new Error('Not configured in this test.')),
    regenerate: () => Promise.reject(new Error('Not configured in this test.')),
    cancel: () => Promise.resolve(false),
    export: () => Promise.resolve({ filename: 'test.md', mimeType: 'text/markdown', content: '' }),
    onGenerationEvent: () => () => undefined,
  },
  memory: {
    list: () => Promise.resolve([]),
    save: (request) =>
      Promise.resolve({
        id: 'memory',
        kind: request.kind,
        content: request.content,
        summary: request.summary ?? request.content,
        tags: request.tags ?? [],
        pinned: request.pinned ?? false,
        sourceConversationId: request.sourceConversationId,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    update: () => Promise.reject(new Error('Not configured in this test.')),
    delete: () => Promise.resolve(),
    search: () => Promise.resolve([]),
    settings: () => Promise.resolve({ enabled: true }),
    setEnabled: (enabled) => Promise.resolve({ enabled }),
    deleteAll: () => Promise.resolve(0),
    export: () =>
      Promise.resolve({ filename: 'memory.json', mimeType: 'application/json', content: '{}' }),
    backup: () =>
      Promise.resolve({
        schemaVersion: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        settings: { enabled: true },
        memories: [],
      }),
    restore: () => Promise.resolve(0),
    mergeDuplicates: () => Promise.resolve(0),
  },
  office: {
    dashboard: () => Promise.resolve(officeDashboard),
    search: () => Promise.resolve([]),
    quickAdd: () =>
      Promise.resolve({
        action: { kind: 'create-task', task: officeTask },
        interpretedAs: 'Created a task from natural language.',
      }),
    tasks: {
      list: () => Promise.resolve([officeTask]),
      create: (request) => Promise.resolve({ ...officeTask, title: request.title }),
      update: (request) =>
        Promise.resolve({
          ...officeTask,
          title: request.title ?? officeTask.title,
          description: request.description ?? officeTask.description,
          priority: request.priority ?? officeTask.priority,
          labels: request.labels ?? officeTask.labels,
          progress: request.progress ?? officeTask.progress,
        }),
      delete: () => Promise.resolve(),
      complete: () => Promise.resolve({ ...officeTask, completed: true, progress: 100 }),
    },
    notes: {
      list: () => Promise.resolve([officeNote]),
      create: (request) => Promise.resolve({ ...officeNote, title: request.title }),
      update: (request) =>
        Promise.resolve({
          ...officeNote,
          title: request.title ?? officeNote.title,
          content: request.content ?? officeNote.content,
          tags: request.tags ?? officeNote.tags,
          pinned: request.pinned ?? officeNote.pinned,
          archived: request.archived ?? officeNote.archived,
        }),
      delete: () => Promise.resolve(),
    },
    projects: {
      list: () => Promise.resolve([officeProject]),
      create: (request) => Promise.resolve({ ...officeProject, name: request.name }),
      update: (request) =>
        Promise.resolve({
          ...officeProject,
          name: request.name ?? officeProject.name,
          description: request.description ?? officeProject.description,
          status: request.status ?? officeProject.status,
          priority: request.priority ?? officeProject.priority,
          progress: request.progress ?? officeProject.progress,
        }),
      delete: () => Promise.resolve(),
    },
    reminders: {
      list: () => Promise.resolve([officeReminder]),
      create: (request) => Promise.resolve({ ...officeReminder, title: request.title }),
      update: (request) =>
        Promise.resolve({
          ...officeReminder,
          title: request.title ?? officeReminder.title,
          note: request.note ?? officeReminder.note,
          remindAt: request.remindAt ?? officeReminder.remindAt,
        }),
      delete: () => Promise.resolve(),
      snooze: (request) =>
        Promise.resolve({ ...officeReminder, status: 'snoozed', snoozedUntil: request.until }),
      dismiss: () => Promise.resolve({ ...officeReminder, status: 'dismissed' }),
    },
  },
  documents: {
    dashboard: () => Promise.resolve(documentDashboard),
    import: (request) =>
      Promise.resolve({
        ...documentDetail,
        title: request.filePath.split('\\').pop() ?? documentDetail.title,
        pinned: request.pin ?? false,
      }),
    list: () => Promise.resolve([documentMetadata]),
    get: () => Promise.resolve(documentDetail),
    pin: (request) =>
      Promise.resolve({
        ...documentMetadata,
        pinned: request.pinned,
      }),
    delete: () => Promise.resolve(),
    search: () =>
      Promise.resolve([
        {
          document: documentMetadata,
          chunk: documentDetail.chunks[0],
          score: 1,
          match: 'Module 7 document intelligence brief',
        },
      ]),
    analyze: (request) =>
      Promise.resolve({
        documentId: request.documentId,
        action: request.action,
        content: `Analysis for ${request.action}`,
        generatedAt: '2026-01-01T00:00:00.000Z',
      }),
  },
  web: {
    dashboard: () => Promise.resolve(webDashboard),
    ask: (request) =>
      Promise.resolve({
        prompt: request.prompt,
        intent: 'news',
        answer: `Grounded answer for ${request.prompt}`,
        usedTools: ['news'],
        citations: [
          {
            title: webArticle.title,
            url: webArticle.url,
            source: webArticle.source,
            accessedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
      }),
    search: () =>
      Promise.resolve({
        query: 'jarvis',
        results: [webSearchResult],
        citations: [
          {
            title: webSearchResult.title,
            url: webSearchResult.url,
            source: webSearchResult.source,
            accessedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        summary: webSearchResult.snippet,
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    weather: (request) =>
      Promise.resolve({
        location: request.location,
        latitude: 40.71,
        longitude: -74.01,
        current: {
          temperatureCelsius: 21,
          condition: 'Clear sky',
          humidityPercent: 55,
          windKph: 12,
          observedAt: '2026-01-01T00:00:00.000Z',
        },
        forecast: [
          {
            date: '2026-01-01',
            minCelsius: 18,
            maxCelsius: 24,
            precipitationProbabilityPercent: 5,
            sunrise: '2026-01-01T07:00:00.000Z',
            sunset: '2026-01-01T17:00:00.000Z',
          },
        ],
        provider: 'test',
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    news: (request) =>
      Promise.resolve({
        category: request.category ?? 'top',
        country: request.country,
        articles: [webArticle],
        citations: [
          {
            title: webArticle.title,
            url: webArticle.url,
            source: webArticle.source,
            accessedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    convertCurrency: (request) =>
      Promise.resolve({
        amount: request.amount,
        from: request.from,
        to: request.to,
        rate: 83,
        converted: request.amount * 83,
        asOf: '2026-01-01',
        provider: 'test',
        cached: false,
      }),
    time: (request) =>
      Promise.resolve({
        timeZone: request.timeZone,
        isoDateTime: '2026-01-01T00:00:00.000Z',
        displayTime: 'Jan 1, 2026, 12:00:00 AM',
        offsetMinutes: 0,
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    convertTime: (request) =>
      Promise.resolve({
        fromTimeZone: request.fromTimeZone,
        toTimeZone: request.toTimeZone,
        sourceIsoDateTime: request.isoDateTime ?? '2026-01-01T00:00:00.000Z',
        convertedIsoDateTime: '2026-01-01T00:00:00.000Z',
        displayTime: 'Jan 1, 2026, 12:00:00 AM',
      }),
    maps: (request) =>
      Promise.resolve({
        query: request.query,
        places: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    knowledge: (request) =>
      Promise.resolve({
        topic: request.topic,
        title: request.topic,
        summary: 'Knowledge summary',
        url: 'https://example.com/wiki',
        citation: {
          title: request.topic,
          url: 'https://example.com/wiki',
          source: 'example.com',
          accessedAt: '2026-01-01T00:00:00.000Z',
        },
        generatedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
      }),
    history: () => Promise.resolve([webHistory]),
    bookmarks: () => Promise.resolve([webBookmark]),
    saveBookmark: (request) =>
      Promise.resolve({
        id: 'bookmark-new',
        kind: request.kind,
        title: request.title,
        query: request.query,
        url: request.url,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    deleteBookmark: () => Promise.resolve(),
  },
  desktop: {
    dashboard: () => Promise.resolve(desktopDashboard),
    openApplication: (request) =>
      Promise.resolve({
        app: {
          id: request.appId,
          name: request.appId,
          status: 'opened',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        confirmationRequired: false,
      }),
    closeApplication: (request) =>
      Promise.resolve({
        app: {
          id: request.appId,
          name: request.appId,
          status: 'closed',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        confirmationRequired: !request.confirm,
      }),
    restartApplication: (request) =>
      Promise.resolve({
        app: {
          id: request.appId,
          name: request.appId,
          status: 'restarted',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        confirmationRequired: !request.confirm,
      }),
    bringApplicationToFront: (request) =>
      Promise.resolve({
        app: {
          id: request.appId,
          name: request.appId,
          status: 'front',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        confirmationRequired: false,
      }),
    openFile: (path) =>
      Promise.resolve({
        path,
        name: path,
        kind: 'file',
        sizeBytes: 1,
        modifiedAt: '2026-01-01T00:00:00.000Z',
      }),
    openFolder: (path) => Promise.resolve({ path, entries: [], readOnly: true }),
    browseFolder: (path) => Promise.resolve({ path, entries: [], readOnly: true }),
    operateFile: (request) =>
      Promise.resolve({
        kind: request.kind,
        sourcePath: request.sourcePath,
        destinationPath: request.destinationPath,
        confirmationRequired: !request.confirm,
        completed: Boolean(request.confirm),
      }),
    readClipboard: () =>
      Promise.resolve({ text: 'clipboard', updatedAt: '2026-01-01T00:00:00.000Z' }),
    writeClipboard: (request) =>
      Promise.resolve({ text: request.text, updatedAt: '2026-01-01T00:00:00.000Z' }),
    notify: (request) => Promise.resolve({ ...desktopNotification, kind: request.kind }),
    screenshot: (request) => Promise.resolve({ ...desktopScreenshot, kind: request.kind }),
    system: () => Promise.resolve(desktopSystem),
    routeTool: () =>
      Promise.resolve({
        command: 'open-vscode',
        summary: 'Opening VS Code from the allow-list.',
        result: {
          app: {
            id: 'vscode',
            name: 'Visual Studio Code',
            status: 'opened',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          confirmationRequired: false,
        },
      }),
    auditLogs: () => Promise.resolve([desktopAudit]),
  },
  plugins: {
    dashboard: () => Promise.resolve(pluginDashboard),
    registry: () => Promise.resolve([pluginManifest]),
    validateManifest: () => Promise.resolve({ valid: true, issues: [] }),
    install: (request) =>
      Promise.resolve({
        ...installedPlugin,
        manifest: request.manifest,
        verification: {
          status: request.signature?.trusted ? 'verified' : 'missing',
          reason: request.signature?.trusted ? 'Trusted test signature.' : 'No signature.',
          checkedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    enable: () => Promise.resolve({ ...installedPlugin, status: 'enabled' }),
    disable: () => Promise.resolve({ ...installedPlugin, status: 'disabled' }),
    update: (request) => Promise.resolve({ ...installedPlugin, manifest: request.manifest }),
    remove: (request) =>
      Promise.resolve({
        pluginId: request.pluginId,
        confirmationRequired: !request.confirm,
        removed: Boolean(request.confirm),
      }),
    settings: (request) =>
      Promise.resolve({
        ...installedPlugin,
        settings: {
          ...installedPlugin.settings,
          configuration: request.configuration ?? installedPlugin.settings.configuration,
          grantedPermissions:
            request.grantedPermissions ?? installedPlugin.settings.grantedPermissions,
        },
      }),
    reset: () =>
      Promise.resolve({
        ...installedPlugin,
        settings: { configuration: {}, grantedPermissions: [], storage: {}, storageBytes: 0 },
      }),
    logs: () => Promise.resolve([pluginLog]),
    invokeTool: () => Promise.resolve(pluginToolResult),
    routeTool: () =>
      Promise.resolve({
        selected: true,
        reason: 'Selected Translate from JARVIS Translate.',
        tool: pluginToolResult,
      }),
    auditLogs: () => Promise.resolve([pluginAudit]),
  },
  production: {
    dashboard: () => Promise.resolve(productionDashboard),
    recoveryReport: () => Promise.resolve(recoveryReport),
    exportDiagnostics: () =>
      Promise.resolve({
        filename: 'jarvis-diagnostics-test.json',
        mimeType: 'application/json',
        content: JSON.stringify({ test: true }),
        generatedAt: '2026-01-01T00:00:00.000Z',
        sections: ['performance', 'securityAudit'],
      }),
    runSecurityAudit: () => Promise.resolve(securityAudit),
    validateBackups: () =>
      Promise.resolve({
        generatedAt: '2026-01-01T00:00:00.000Z',
        results: [],
      }),
    setDebugMode: (enabled) =>
      Promise.resolve({
        enabled,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    recordRendererCrash: () => Promise.resolve(recoveryReport),
    safeRestart: () =>
      Promise.resolve({
        accepted: true,
        report: {
          id: 'restart-report',
          kind: 'safe-restart',
          process: 'main',
          reason: 'user-requested',
          message: 'Safe restart requested.',
          recovered: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          metadata: {},
        },
      }),
  },
  release: {
    dashboard: () => Promise.resolve(releaseDashboard),
    completeFirstRun: () =>
      Promise.resolve({
        ...releaseDashboard,
        firstRun: {
          completed: true,
          completedAt: '2026-01-01T00:00:00.000Z',
          language: 'en-US',
          grantedPermissions: [],
        },
      }),
    updateSettings: (request) =>
      Promise.resolve({
        ...releaseSettings,
        appearance: {
          ...releaseSettings.appearance,
          ...request.appearance,
        },
        updates: {
          ...releaseSettings.updates,
          ...request.updates,
        },
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    checkUpdates: () =>
      Promise.resolve({
        ...releaseUpdateState,
        status: 'current',
        lastCheckedAt: '2026-01-01T00:00:00.000Z',
      }),
    downloadUpdate: (request) =>
      Promise.resolve({
        artifact: {
          kind: request.kind,
          platform: 'windows',
          architecture: 'x64',
          url: 'https://example.com/jarvis.exe',
          sha256: 'b'.repeat(64),
          sizeBytes: 42,
        },
        filePath: `A:\\J.A.R.V.I.S\\release\\JARVIS.${request.kind}`,
        sha256: 'b'.repeat(64),
        verified: true,
        downloadedBytes: 42,
        downloadedAt: '2026-01-01T00:00:00.000Z',
      }),
    rollbackUpdate: () =>
      Promise.resolve({
        accepted: false,
        state: releaseDashboard.rollback,
      }),
    createBackup: () => Promise.resolve(releaseBackup),
    restoreBackup: () => Promise.resolve(releaseRestore),
  },
};

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'jarvis', {
    configurable: true,
    value: bridge,
  });
}
