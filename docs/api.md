# API Documentation

Renderer code accesses JARVIS through the immutable preload bridge at `window.jarvis`. There is no generic IPC method.

## Release API

Module 12 adds `window.jarvis.release`.

```ts
window.jarvis.release.dashboard();
window.jarvis.release.completeFirstRun(request);
window.jarvis.release.updateSettings(request);
window.jarvis.release.checkUpdates(request);
window.jarvis.release.downloadUpdate(request);
window.jarvis.release.rollbackUpdate({ confirm: true });
window.jarvis.release.createBackup(request);
window.jarvis.release.restoreBackup(request);
```

## Release permissions

- Dashboard, first-run, settings, and rollback require system-information permission.
- Update check and download require network permission.
- Backup export and restore/import require file-access permission.

## Update manifest shape

```json
{
  "version": "0.12.1",
  "channel": "stable",
  "publishedAt": "2026-07-08T00:00:00.000Z",
  "notes": ["Release note"],
  "artifacts": [
    {
      "kind": "exe",
      "platform": "windows",
      "architecture": "x64",
      "url": "https://updates.example.com/JARVIS-0.12.1-x64.exe",
      "sha256": "64-character-hex-digest",
      "sizeBytes": 123456
    }
  ]
}
```

Supported artifact kinds are `msi`, `exe`, and `portable-zip`. Supported channels are `stable`, `beta`, and `development`.

## Backup behavior

`createBackup` exports selected sections to a local JSON artifact. `restoreBackup` validates the artifact and, when confirmed, stages files for a future restart. It does not overwrite active databases in-place.

## Secret policy

The bridge never returns plaintext API keys, signing secrets, downloaded artifact bytes, SQLite handles, Node APIs, or raw Electron APIs.
