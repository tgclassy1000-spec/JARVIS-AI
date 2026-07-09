# Architecture

## Security boundaries

Electron Main owns SQLite, Gemini, secrets, service composition, and operating-system capabilities. Preload exposes one immutable typed API with no generic IPC escape hatch. The sandboxed React renderer has no Node.js, Electron, database, or provider access.

All IPC request channels and generation events are explicitly allow-listed. Main applies trusted-origin checks, size and rate limits, Zod validation, permissions, structured errors, and redacted logging.

## Conversation platform

The provider-neutral conversation engine uses `AIProvider`, `ChatSession`, `StreamResponse`, and `TokenEstimator`. Gemini 2.5 Flash is the only implementation. Conversation messages are auto-saved in SQLite, token-budgeted context is trimmed safely, and streaming supports retries, timeout, cancellation, edit, regenerate, search, and export.

## Module 5 memory boundaries

Memory is a separate vertical under `src/main/memory`:

- `ShortTermMemory` is process-local, expiring, and never written to SQLite.
- `SqliteMemoryRepository` stores only durable long-term records.
- Long-term records have exactly one domain: user profile, preference, fact, conversation, or semantic.
- `MemoryManager` owns save, recall, update, forget, search, summarize, and duplicate merge operations.
- `ManagedConversationMemory` is the narrow adapter used by the conversation engine.

These boundaries prevent temporary session state, conversation transcripts, and durable personal facts from being mixed.

## Storage and migration

Memory uses a dedicated `memory.sqlite` database in WAL mode. `PRAGMA user_version` drives ordered schema migration; Module 5 schema version is 1. Unsupported future schemas fail closed and release the database handle.

Portable archives include schema version, timestamp, privacy settings, and every visible memory. Restore is transactional and supports merge or replace. Export produces the same validated JSON representation. Individual deletion and irreversible delete-all are exposed through separate IPC contracts.

## Extraction policy

Automatic extraction starts only when deterministic rules find an explicit durable statement. Temporary phrases such as “for now,” “today only,” and “in this chat” are rejected before Gemini is called.

Gemini receives a conservative extraction prompt and may return only names, stable preferences, frequently used software, work habits, languages, writing style, goals, long-term projects, and important reminders. Output is parsed as JSON and validated with a strict bounded schema. Invalid or inferred output is discarded. Similar candidates are deduplicated before save. Provider failures never interrupt the conversation.

## Search and recall

Keyword search covers content, summaries, and tags. Semantic search uses a deterministic local normalized-term vector and cosine similarity, so recall does not send the existing memory vault to an external embedding service. Hybrid search combines both scores, honors domain and tag filters, prioritizes pinned records, and applies bounded result limits.

Before every AI generation, relevant enabled memories are appended to the system context with an instruction to use them only when helpful. After successful generation, only the user’s durable statement is considered for extraction; assistant text is never memorized.

## Privacy and visibility

The memory toggle is persisted. Disabled memory returns no recall results and performs no automatic extraction or manual save. Delete-all removes all durable records. Every durable record is visible, editable, pinnable, searchable, exportable, and deletable in the Memory Vault HUD. There is no hidden durable-memory table.

## Module 6 office productivity platform

Office productivity is a separate vertical under `src/main/office` with shared contracts in `src/shared/office` and renderer components in `src/renderer/src/components/office`.

- `SqliteOfficeRepository` owns the dedicated `office.sqlite` database, WAL mode, foreign keys, and versioned `PRAGMA user_version` migrations.
- `OfficeManager` owns validation, normalization, CRUD orchestration, dashboard composition, reminders, global search, and natural-language command execution.
- `OfficeCommandInterpreter` uses the existing Main-process AI provider when available and falls back to deterministic local parsing for phrases such as “Remind me at 5 PM,” “Create project,” “Finish invoice,” and “Add today’s work.”
- `registerOfficeEndpoints` exposes only allow-listed typed IPC endpoints. The renderer never receives provider credentials, SQLite handles, Electron APIs, or generic IPC.
- The React Office HUD provides dashboard, projects, tasks, notes, reminders, global search, quick add, statistics, markdown note rendering, checklist/code/table support, snooze, dismiss, and complete actions.

Office intentionally does not implement OCR, desktop automation, plugin SDK, calendar sync, Gmail sync, Google Drive sync, or WhatsApp integration.

## Office data model

The Office database stores:

- tasks with priority, due date, labels, category, project link, recurrence, completion state, and progress;
- markdown notes with tags, pin/archive state, project link, and immutable version history;
- projects with goals, deadlines, status, priority, progress, task counts, and note counts;
- reminders with time/date scheduling, recurrence metadata, notification-queue status, snooze, and dismiss state.

Global search composes Office-local results with existing conversation and memory managers without duplicating those databases or changing their schemas.

## Module 6 validation gate

Tests cover migrations, task CRUD, note version history, projects, reminders, dashboard data, global search, natural-language quick add, allow-listed IPC, permission denial, bootstrap wiring, and the Office UI.

The gate requires strict TypeScript, zero ESLint warnings, coverage above 95%, a production build, Electron smoke validation, no explicit `any`, and zero dependency vulnerabilities.

## Module 7 file intelligence platform

File intelligence is a separate vertical under `src/main/documents` with shared contracts in `src/shared/documents` and renderer components in `src/renderer/src/components/documents`.

- `DocumentService` is the orchestration boundary for secure imports, parsing, OCR handoff, chunking, indexing, search, AI analysis, recents, pinning, deletion, and dashboards.
- `DocumentParserRegistry` routes supported formats to parser implementations without leaking filesystem access to the renderer.
- `DocumentParser` implementations cover PDF, DOCX, XLSX, PPTX, TXT, Markdown, CSV, JSON, PNG, JPG, JPEG, and WEBP. The parser interface is format-extensible for future modules.
- `OcrProvider` is an injectable provider seam. The default provider is intentionally unavailable, so scanned PDFs and images are detected safely and marked as OCR-unavailable unless a future approved provider is installed.
- `ChunkBuilder` creates bounded overlapping chunks for context windows, search, and future semantic enrichment.
- `DocumentIndexer` provides keyword, deterministic semantic, and hybrid search without sending the document corpus to an external embedding service.
- `DocumentSession` builds bounded document-analysis prompts for summarize, explain, translate, question-answering, action items, key points, table/date/name/email/phone extraction, meeting summaries, and reports.
- `SqliteDocumentRepository` owns the dedicated `documents.sqlite` database, WAL mode, foreign keys, versioned `PRAGMA user_version` migrations, document metadata, chunks, extracted tables, analysis history, recent documents, and pinned documents.
- `registerDocumentEndpoints` exposes only allow-listed typed IPC endpoints. The renderer never receives API keys, SQLite handles, Electron APIs, Node APIs, parser internals, or generic IPC.
- The React Document HUD provides import, recent documents, pinned state, preview, metadata, AI summary, ask-document controls, and global document search.

Document imports are permission-gated through the Module 2 permission manager. Main validates real local files, blocks directories, enforces size limits, restricts supported extensions, processes bytes temporarily, stores extracted metadata/chunks only, and cleans up through repository deletion. There is no unrestricted renderer filesystem access.

## Document search and AI boundaries

Document keyword search covers titles, extracted text previews, and chunk content. Deterministic semantic search reuses local normalized-term vectors and cosine similarity. Hybrid search combines both scores, honors format and pinned filters, applies bounded limits, and returns only document metadata plus matching snippets.

Document AI analysis uses the Main-process AI provider when available and falls back to deterministic local extraction for offline-safe actions. Provider failures do not corrupt document state. API keys remain in Electron Main and never cross preload.

## Module 7 validation gate

Tests cover parser routing, PDF extraction and scanned detection, Office Open XML parsing, image OCR routing, repository migrations, CRUD, search, AI fallback, provider-backed analysis, OCR-provider injection, security validation, allow-listed IPC, permission denial, bootstrap wiring, and the Document UI.

The gate requires strict TypeScript, zero ESLint warnings, coverage above 95%, a production build, Electron smoke validation, no explicit `any`, and zero dependency vulnerabilities.

## Module 8 web intelligence platform

Web intelligence is a separate vertical under `src/main/web` with shared contracts in `src/shared/web` and renderer components in `src/renderer/src/components/web`.

- Provider interfaces cover `WebSearchProvider`, `WeatherProvider`, `NewsProvider`, `CurrencyProvider`, `MapsProvider`, `TimeProvider`, and `KnowledgeProvider`. Every provider is replaceable through `WebProviders`.
- Default public providers are isolated behind Main-process adapters: DuckDuckGo Instant Answer search, Open-Meteo weather, Hacker News/Algolia headlines, Frankfurter currency, OpenStreetMap/Nominatim maps, `Intl` time, and Wikipedia summaries.
- `FetchWebHttpClient` enforces provider timeouts, bounded retries, redacted errors, JSON validation, and rate-limit mapping.
- `TtlCache` provides bounded in-memory caching for live results without persisting provider responses or credentials.
- `WebRateLimiter` limits tool use independently of the global IPC rate limiter.
- `SqliteWebRepository` owns the dedicated `web.sqlite` database, WAL mode, versioned `PRAGMA user_version` migrations, recent web history, and bookmarks.
- `WebIntelligenceService` owns normalization, cache lookup, rate limiting, provider orchestration, history/bookmark updates, deterministic fallback routing, Gemini-assisted tool choice, and grounded answer synthesis.
- `registerWebEndpoints` exposes only allow-listed typed IPC endpoints. Networked endpoints require the Module 2 `network` permission. The renderer never receives provider credentials, raw fetch access, Node APIs, SQLite handles, or generic IPC.
- The React Web HUD provides Ask Web, search results with citations, news cards, weather panel, currency conversion, history, and bookmarks while preserving the futuristic JARVIS theme.

Gemini integration is intentionally scoped to the Web Intelligence service. Gemini can choose among web tools for prompts such as "Latest AI news", "Weather tomorrow", "USD to INR", and "Who won today's match?", then synthesize a grounded answer from the returned tool data. Existing chat generation is not silently modified in Module 8.

## Module 8 validation gate

Tests cover provider parsing, retry behavior, invalid provider responses, caching, rate limiting, AI tool selection, deterministic fallback routing, repository migrations, bookmarks, allow-listed IPC, network permission denial, bootstrap wiring, and the Web UI.

The gate requires strict TypeScript, zero ESLint warnings, coverage above 95%, a production build, Electron smoke validation, no explicit `any`, and zero dependency vulnerabilities.

## Module 9 desktop automation platform

Desktop automation is a separate vertical under `src/main/desktop` with shared contracts in `src/shared/desktop` and renderer components in `src/renderer/src/components/desktop`.

- `DesktopAutomationService` owns application launch/restart/focus simulation, allow-listed safe commands, guarded file operations, clipboard history, notifications, screenshots, system information, and audit logs.
- `ElectronDesktopHost` is the host adapter seam for Electron and operating-system capabilities. It keeps platform APIs in Main instead of exposing Node or Electron primitives to the renderer.
- All application IDs and safe command IDs are enumerated in shared contracts. Renderer requests cannot provide arbitrary shell commands.
- File operations are confirmation-oriented and permission-gated through the Module 2 permission manager.
- `registerDesktopEndpoints` exposes only typed, allow-listed IPC endpoints for desktop capabilities. Sensitive operations require the relevant permission, and all actions are auditable.

Desktop automation intentionally does not include calendar sync, Gmail sync, Google Drive sync, WhatsApp integration, installer creation, or update orchestration. Release packaging belongs to Module 12.

## Module 10 AI skills and plugin platform

Plugins are isolated under `src/main/plugins` with strict contracts in `src/shared/plugins` and the Plugin HUD in `src/renderer/src/components/plugins`.

- `PluginManifest` declares plugin identity, version, author, minimum JARVIS version, permissions, and capabilities.
- `PluginManager` owns manifest validation, registry state, install/update/remove flows, settings, granted permissions, logs, audits, signature verification status, sandbox checks, storage/rate limits, and AI tool routing.
- Plugin permissions are explicit: network, filesystem, clipboard, desktop, notifications, and storage.
- Plugin capabilities are routed through a typed tool registry. There is no arbitrary code execution bridge, generic IPC channel, or renderer access to plugin internals.
- Plugin IPC is allow-listed, permission-gated, validated, and covered by focused bootstrap, IPC, manager, permission, and renderer tests.

The plugin platform is local and permission-first. It does not implement cloud sync, a public store, installer packaging, or update orchestration. Release packaging belongs to Module 12.

## Module 11 production hardening

Production hardening is a cross-cutting platform under `src/main/production` with shared contracts in `src/shared/production`, IPC endpoints in `src/main/production/ipc`, and the Production HUD in `src/renderer/src/components/production`.

- `CrashRecoveryService` installs Main-process exception/rejection handlers, records renderer crash events, reloads recoverable renderer failures, writes recovery reports, and supports explicit safe restart through a confirmation-only IPC contract.
- `SensitiveDataProtector` and `EncryptedCredentialVault` encrypt sensitive local values with AES-256-GCM and never expose decrypted credential state to the renderer.
- `DatabaseProtectionService` runs SQLite integrity checks, validates backups, and quarantines corrupt local databases before recovery attempts.
- `PerformanceMonitor` records startup marks, memory profiles, background task status, cleanup handler counts, and leak-detection warnings.
- `DiagnosticsService` exports structured diagnostic JSON bundles with optional logs, crash reports, data-protection status, performance snapshots, and security audit results.
- `SecurityAuditService` verifies dependency metadata, CSP posture, IPC allow-list hygiene, permission scope, secret scanning, and input fuzz safety.
- `ProductionHardeningService` composes the release dashboard, debug-mode state, diagnostics export, backup validation, security audit execution, renderer crash recording, and safe restart operations.
- `bootstrapProduction` registers the service in the central container, wires production IPC endpoints, starts the integrity background task, and keeps all production controls in Electron Main.
- The Production HUD surfaces release checks, crash recovery, data protection, performance, security audit, accessibility status, diagnostic export, debug toggle, and high-contrast controls.

## Module 11 validation gate

Tests cover crash recovery, renderer crash handling, safe restart, encryption, credential storage, database integrity and recovery, backup validation, startup/memory profiling, background scheduling, cleanup and leak detection, diagnostics export, security audit branches, production service composition, IPC permission checks, bootstrap registration, and Production HUD accessibility controls.

The release gate requires strict TypeScript, zero ESLint warnings, coverage above 95%, production build, Electron smoke validation, no explicit `any`, and zero high-severity dependency vulnerabilities.

## Module 12 public release engineering

Release engineering is a dedicated vertical under `src/main/release` with shared contracts in `src/shared/release`, IPC endpoints in `src/main/release/ipc`, and the Release HUD in `src/renderer/src/components/release`.

- `ReleaseEngineeringService` owns first-run completion state, release settings, update checks, artifact download verification, rollback checkpoints, backup export, restore/import staging, packaging status, signing status, and QA checklist metadata.
- `bootstrapRelease` registers the service in the central container, wires typed release IPC endpoints, passes known database paths as backup sources, and keeps release state under the Electron user-data release directory.
- Release IPC is allow-listed and permission-gated. Update checks/downloads require network permission. Backup export and restore/import staging require file-access permission. Release dashboard/settings require system-information permission.
- First-run captures theme, language, voice preference, granted permissions, Gemini API key configuration state, privacy settings, model selection, and release channel. If a Gemini key is supplied, it is encrypted in Main and only returned as `apiKeyConfigured`.
- Settings are exposed as one release settings object with appearance, voice, AI, memory, office, plugins, privacy, updates, and performance sections.
- The update service supports stable, beta, and development channels, validates signed-style release manifests, compares semantic versions, downloads selected Windows artifacts, verifies SHA-256, and prepares rollback metadata. It does not add any AI behavior.
- Backup export writes a local JSON artifact containing selected sections and file checksums. Restore/import validates the artifact and stages files under a restore directory instead of overwriting live SQLite databases while the app is running.
- Trusted Windows packaging uses `electron-builder` to produce NSIS EXE, MSI, and ZIP artifacts. The unsigned development path builds ZIP and MSI sequentially, then compiles a small EXE bootstrap that launches the adjacent MSI. The MSI supplies Desktop/Start Menu shortcuts and Windows uninstaller registration.
- Code signing is configured for the trusted `electron-builder` CSC pipeline. If signing secrets are absent, the unsigned development script disables certificate auto-discovery. Vite minifies/tree-shakes renderer assets, ASAR packages the application, and outer artifacts use store-mode packaging for predictable release times.

## Module 12 validation gate

Tests cover release settings persistence, encrypted first-run key handling, update manifest checks, artifact download verification, rollback state, backup export, restore/import staging, IPC validation, permission denial, bootstrap registration, and the Release HUD.

The release gate requires strict TypeScript, zero ESLint warnings, coverage above 95%, production build, Windows installer build, Electron smoke validation, regression tests, security scan, no explicit `any`, and zero high-severity dependency vulnerabilities.

Cloud sync, mobile apps, calendar sync, Gmail sync, Google Drive sync, WhatsApp integration, and voice assistant execution remain out of scope until explicitly requested.
