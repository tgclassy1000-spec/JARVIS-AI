# J.A.R.V.I.S. Desktop

A from-scratch Electron, React, and strict TypeScript desktop assistant. The legacy root-level browser prototype remains a visual reference only and is never imported.

## Implemented modules: 1-3 and 5-12

- Sandboxed Electron platform with typed, validated, allow-listed IPC
- Gemini 2.5 Flash streaming conversation engine
- SQLite multi-session conversation history and context management
- Modular personal memory with isolated short-term and long-term stores
- User profile, preferences, facts, conversation, and semantic memory domains
- Conservative Gemini extraction of explicitly stated durable information
- Hybrid keyword/semantic recall before each AI request
- Versioned migrations, portable backup/restore, export, and full deletion
- Visible memory review HUD with edit, pin, search, filters, privacy toggle, and export
- Production Office productivity platform with tasks, markdown notes, projects, reminders, dashboard, statistics, global search, and natural-language quick add
- Dedicated Office SQLite database with versioned migrations, repositories, validation, transactions, note version history, snooze/dismiss, and project goals
- Production File Intelligence platform with secure document import, metadata extraction, chunking, indexing, recent/pinned documents, keyword and semantic search, and AI document actions
- Document support for PDF, DOCX, XLSX, PPTX, TXT, Markdown, CSV, JSON, PNG, JPG, JPEG, and WEBP, with OCR provider seams for scanned PDFs and images
- Secure Web Intelligence platform with replaceable providers for search, weather, news, currency, maps, time, and knowledge
- AI-grounded web assistant, citations, summaries, result ranking, weather, headlines, currency conversion, world time, history, bookmarks, retries, caching, rate limiting, and credential isolation
- Permission-first desktop automation for allow-listed applications, guarded file operations, clipboard, notifications, screenshots, system information, and audit logs
- AI Skills & Plugin platform with strict manifests, validation, registry, settings, logs, signatures, sandbox checks, rate limits, permission gates, and AI tool routing
- Production hardening with crash recovery, encrypted local credential storage, SQLite integrity checks, backup validation, performance profiling, background scheduling, diagnostics export, security audits, accessibility controls, and release validation docs
- Public release engineering with Windows MSI, trusted-pipeline NSIS EXE, unsigned EXE bootstrap, ZIP packaging, shortcuts, uninstaller support, code-signing pipeline configuration, release channels, update checks/download verification, rollback checkpoints, first-run wizard, single settings page, backup/restore staging, and QA commands

Voice execution, calendar sync, email sync, Google Drive sync, WhatsApp integration, cloud sync, and mobile apps are not implemented.

## Local setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Set `GEMINI_API_KEY` in `.env`. It is read only by Electron Main and never crosses preload.

## Validation

```powershell
npm run check
npm run test:coverage
npm run build
npm run test:smoke
npm run dist:win:unsigned
npm run release:verify-artifacts
npm audit
```

See [architecture documentation](docs/architecture.md).

Additional production references:

- [Security](docs/security.md)
- [Developer Guide](docs/developer-guide.md)
- [User Manual](docs/user-manual.md)
- [Administrator Guide](docs/administrator-guide.md)
- [API Documentation](docs/api.md)
- [Plugin Documentation](docs/plugin-documentation.md)
- [Release Notes](docs/release-notes.md)
- [Troubleshooting Guide](docs/troubleshooting.md)
- [Release Checklist](docs/release-checklist.md)
