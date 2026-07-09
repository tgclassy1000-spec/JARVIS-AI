# Administrator Guide

## Supported release artifacts

Module 12 prepares Windows release artifacts:

- MSI for managed deployment.
- NSIS EXE installer for signed interactive releases.
- EXE bootstrap plus adjacent MSI for unsigned development release candidates.
- ZIP for portable/no-install distribution.

The signed NSIS installer and the MSI both support interactive deployment. In the unsigned fallback, the EXE launches the adjacent MSI; the MSI creates Desktop and Start Menu shortcuts and registers the uninstaller.

## Build commands

Unsigned local release candidate:

```powershell
npm run dist:win:unsigned
npm run release:verify-artifacts
```

Trusted signed release:

```powershell
npm run dist:win
npm run release:verify-artifacts
```

Signed releases require CSC signing variables injected by the trusted build environment. Do not store signing material in the repository or `.env`.

## Update channels

JARVIS supports three release channels:

- stable
- beta
- development

Configure the channel with:

```powershell
JARVIS_RELEASE_CHANNEL=stable
JARVIS_UPDATE_MANIFEST_URL=https://updates.example.com/jarvis/stable/latest.json
```

Each update manifest must include the release version, channel, notes, and Windows artifacts with SHA-256 hashes.

## Backup policy

Use the Release tab to export backups before update tests. Restore/import validates and stages files for review instead of replacing live SQLite databases while JARVIS is running.

Recommended administrator flow:

1. Export backup.
2. Run production diagnostics.
3. Install or update JARVIS.
4. Run smoke/regression checks.
5. Keep the backup until the release candidate is accepted.

## Security expectations

- Keep API keys and signing secrets out of renderer code.
- Review diagnostic bundles before sharing.
- Publish only artifacts that pass SHA-256 verification.
- Do not disable IPC allow-listing or permission gates for deployments.
