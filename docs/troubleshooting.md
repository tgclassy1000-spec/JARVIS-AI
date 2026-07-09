# Troubleshooting Guide

## App opens but the HUD is blank

1. Run `npm run typecheck`.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Check the Production dashboard for renderer crash reports.
5. Export diagnostics and inspect the `crashReports` and `errors` sections.

## Gemini chat fails

- Confirm `GEMINI_API_KEY` exists in `.env`.
- Confirm the key is not prefixed with `VITE_`.
- Restart the Electron process after changing `.env`.
- Inspect structured errors in the Chat UI and logs.

API keys are loaded in Electron Main only. If a renderer component needs a new AI behavior, add a Main-process service and typed IPC endpoint rather than calling a provider directly.

## Database integrity warning

Open the Production dashboard and inspect the Data Protection section.

- `ok`: SQLite integrity passed.
- `warn`: database is missing or backup validation could not find a backup.
- `fail`: integrity failed or recovery could not complete.

When corruption is detected, JARVIS creates a quarantine copy instead of deleting user data. Preserve the quarantined file until the user confirms recovery succeeded.

## Backup validation fails

Check that the backup directory exists and contains valid SQLite copies for the selected database paths. Run backup validation again from the Production dashboard after replacing a backup.

## Security audit fails

Common causes:

- Missing or weak Content Security Policy.
- Duplicate or non-allow-listed IPC channels.
- Suspicious secret-like text in source files.
- Dependency metadata missing or malformed.
- Permission surface wider than expected.

Fix the underlying issue, then rerun the security audit.

## Memory growth warning

The leak detector compares heap samples against `JARVIS_LEAK_THRESHOLD_BYTES`.

1. Reproduce the workflow.
2. Export diagnostics.
3. Inspect `performance.memory`, `performance.backgroundTasks`, and `performance.leakDetection`.
4. Confirm cleanup handlers are registered and called for long-lived resources.

## Debug mode

Debug mode is controlled by `JARVIS_DEBUG_MODE` at startup and can be toggled in the Production dashboard. Keep it disabled for normal production use.

## Smoke test fails

Run:

```powershell
npm run build
npm run test:smoke
```

If the smoke test still fails, export diagnostics from a dev run and inspect crash reports, security checks, and application logs.

## Installer build fails

Run the unsigned local release build first:

```powershell
npm run dist:win:unsigned
```

If the build fails:

- Confirm `out/main`, `out/preload`, and `out/renderer` exist after `npm run build`.
- Confirm `electron-builder` is installed.
- Confirm the release output directory is writable.
- For signed builds, confirm CSC signing environment variables are present only in the trusted CI/CD environment.

Then run:

```powershell
npm run release:verify-artifacts
```

The verifier expects MSI, EXE, and ZIP artifacts in the `release` directory.

For unsigned release candidates, keep the generated EXE and MSI together. The EXE is a bootstrap launcher for that MSI.

## Update check fails

- Confirm `JARVIS_UPDATE_MANIFEST_URL` points to a JSON release manifest.
- Confirm the manifest `channel` matches `JARVIS_RELEASE_CHANNEL`.
- Confirm every artifact has a valid SHA-256 digest.
- Confirm the renderer is using `window.jarvis.release.checkUpdates` and not raw network access.

If artifact download fails verification, publish a corrected artifact and manifest. Do not bypass SHA-256 verification.

## Backup import fails

- Confirm the selected file is a JARVIS backup JSON created by Module 12.
- Confirm the file was not edited after export.
- Re-run `Export Backup` if checksum validation fails.
- Restore/import stages files for review and restart; it does not overwrite live SQLite databases while JARVIS is running.
