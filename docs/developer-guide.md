# Developer Guide

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Set `GEMINI_API_KEY` only in `.env`. Do not add secrets to renderer files, tests, fixtures, docs, or screenshots.

## Project shape

- `src/main/platform`: shared Electron platform, DI, config, logging, permissions, IPC router, and security middleware.
- `src/main/conversation`: provider-neutral chat engine and Gemini implementation.
- `src/main/memory`: durable and short-term memory.
- `src/main/office`: tasks, notes, projects, reminders, dashboard, and office search.
- `src/main/documents`: document parsing, indexing, OCR seams, document sessions, and metadata.
- `src/main/web`: web search, weather, news, currency, maps, time, knowledge, caching, and rate limiting.
- `src/main/desktop`: permission-gated desktop capabilities.
- `src/main/plugins`: manifest-based local plugin platform.
- `src/main/production`: crash recovery, data protection, performance, diagnostics, security audit, and release readiness.
- `src/main/release`: installer/update/settings/first-run/backup release engineering.
- `src/shared`: typed contracts shared by Main, preload, renderer, and tests.
- `src/preload`: immutable bridge; no broad IPC escape hatch.
- `src/renderer`: React HUD interface.
- `tests`: unit, integration, renderer, IPC, smoke, production hardening, and release engineering tests.

## Adding a feature

1. Define shared contracts first.
2. Add validation schemas in the Main-process endpoint module.
3. Implement service logic behind a narrow interface.
4. Register the service in the container.
5. Register allow-listed IPC endpoints.
6. Add preload bridge methods.
7. Add renderer UI only through the typed bridge.
8. Add tests for contracts, service behavior, IPC, permissions, and renderer state.
9. Run the full validation gate.

Do not let renderer code import Node.js modules, Electron APIs, provider clients, SQLite repositories, or environment config.

## Production hardening APIs

Module 11 exposes production controls through `window.jarvis.production`:

- `dashboard`
- `recoveryReport`
- `exportDiagnostics`
- `runSecurityAudit`
- `validateBackups`
- `setDebugMode`
- `recordRendererCrash`
- `safeRestart`

These methods are typed, allow-listed, and handled in Electron Main.

## Release engineering APIs

Module 12 exposes release controls through `window.jarvis.release`:

- `dashboard`
- `completeFirstRun`
- `updateSettings`
- `checkUpdates`
- `downloadUpdate`
- `rollbackUpdate`
- `createBackup`
- `restoreBackup`

These methods are typed, allow-listed, permission-gated, and handled in Electron Main. Do not call update manifests, write downloaded installers, or read backup files from renderer code.

## Packaging commands

```powershell
npm run dist:win
npm run dist:win:unsigned
npm run release:verify-artifacts
```

Use `dist:win` in trusted signing environments with CSC signing variables configured. Use `dist:win:unsigned` for local development release candidates only.

The unsigned command builds ZIP first, reuses `release/win-unpacked` for MSI, then compiles a lightweight EXE bootstrap. Keep the generated MSI beside the EXE bootstrap; the bootstrap delegates installation, shortcuts, and uninstall registration to Windows Installer.

## Validation commands

```powershell
npm run format:check
npm run typecheck
npm run lint
npm run test:run
npm run test:coverage
npm run build
npm run test:smoke
npm run dist:win:unsigned
npm run release:verify-artifacts
npm audit --audit-level=high
```

The coverage gate must remain above 95%. Avoid adding broad tests that only exercise happy paths; Module 11 and Module 12 intentionally cover defensive branches such as non-`Error` exceptions, recovery failures, update verification failures, validation denial, and warning-only health states.

## Coding rules

- Use strict TypeScript.
- Do not use explicit `any`.
- Keep service interfaces narrow.
- Prefer immutable shared contracts.
- Return structured errors instead of leaking provider or platform internals.
- Keep secrets and credentials in Main.
- Keep new modules independently testable.
- Update architecture, security, user-facing, troubleshooting, and release docs when release behavior changes.
