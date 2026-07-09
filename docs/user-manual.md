# User Manual

## Starting JARVIS

Run the app from the development workspace with:

```powershell
npm run dev
```

For production verification, use:

```powershell
npm run build
npm run test:smoke
```

For Windows release artifacts, use:

```powershell
npm run dist:win:unsigned
npm run release:verify-artifacts
```

## Main areas

- Chat: Gemini-powered streaming conversation.
- Memory: review and manage durable saved memories.
- Office: tasks, notes, projects, reminders, daily dashboard, and quick add.
- Documents: import supported files, preview metadata, search, summarize, and ask questions.
- Web: search, weather, news, currency, maps, time, knowledge, history, and bookmarks.
- Desktop: permission-gated app launch, safe commands, files, clipboard, notifications, screenshots, and system information.
- Plugins: installed local plugins, registry, skills, permissions, updates, logs, and audits.
- Production: release health, crash recovery, data protection, diagnostics, performance, security, accessibility, and debug controls.
- Release: first-run setup, settings, installer targets, signing posture, updates, rollback checkpoints, backup export/import, and QA commands.

## Release Center

Open the Release tab for public release operations.

The Release Center shows:

- First-run wizard state
- Single settings page covering appearance, voice preference, AI key status, memory, office, plugins, privacy, updates, and performance
- Stable, beta, and development release channels
- Update check and verified artifact download status
- Rollback checkpoint status
- Windows MSI, EXE, and ZIP packaging targets
- Code-signing posture and unsigned development fallback

Unsigned development distributions must keep the EXE bootstrap and MSI in the same folder.

- Backup export and restore/import validation
- QA commands for release candidates

Use `Complete First Run` to save initial release preferences. If a Gemini API key is provided through the first-run flow, it is encrypted locally and the UI only shows whether a key is configured.

Use `Export Backup` before release candidate testing or before applying updates. Restore/import validation checks a backup and stages files safely instead of overwriting live data while JARVIS is running.

## Production dashboard

Open the Production tab to inspect release readiness.

The dashboard shows:

- Overall release status
- Crash recovery reports
- Database integrity
- Backup validation
- Encryption status
- Startup and memory profiling
- Background task status
- Leak detection
- Security audit results
- Accessibility status

Use `Run Security Audit` before a release candidate. Use `Export Diagnostics` when investigating a local failure. Enable debug mode only while diagnosing a problem, then disable it again.

## Accessibility controls

The Production tab includes a high-contrast toggle. The UI also honors reduced-motion preferences through CSS so animated HUD elements become still when the operating system requests reduced motion.

Keyboard users can navigate the main tabs and production actions without relying on pointer-only controls.

## Data safety

JARVIS stores local SQLite data in the Electron user data directory. Module 11 adds integrity checks and backup validation support. If corruption is detected, the recovery layer quarantines the damaged database path before attempting safe recovery.

Diagnostic exports are local JSON files. Review them before sharing because they can contain local paths, runtime metadata, and user-authored content.

## Not included

This release does not include voice assistant execution, calendar sync, email sync, Google Drive sync, WhatsApp integration, cloud sync, or mobile apps.
