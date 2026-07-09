# Release Notes

## 0.12.0 — Module 12 Public Release Engineering

Module 12 prepares JARVIS for public Windows release without adding AI features, changing architecture, or changing assistant business logic.

### Added

- Windows release packaging through `electron-builder`.
- NSIS EXE target for trusted signing environments.
- Lightweight unsigned EXE bootstrap for local release candidates; it launches the adjacent MSI.
- MSI target.
- ZIP target for portable distribution.
- Desktop shortcut and Start Menu shortcut configuration.
- Uninstaller support.
- Trusted code-signing pipeline support through CSC signing variables.
- Unsigned development fallback script.
- Release channels: stable, beta, development.
- Update service with manifest validation, version checking, artifact download, SHA-256 verification, and rollback checkpoint state.
- First-run wizard state for theme, language, voice preference, permissions, Gemini key status, privacy, model selection, and release channel.
- Single settings page covering appearance, voice, AI, memory, office, plugins, privacy, updates, and performance.
- Backup export and restore/import staging.
- Release Center HUD.
- Release artifact verification script.
- Administrator guide, API documentation, plugin documentation, release notes, and updated release checklist.

### Security

- Renderer receives no raw filesystem, network, update, signing, or installer capabilities.
- Release IPC endpoints are typed, allow-listed, validated, and permission-gated.
- Gemini API keys submitted through first-run are encrypted locally and not returned to the renderer.
- Downloaded update artifacts must pass SHA-256 verification.

### Not included

- New AI features.
- Architecture changes.
- Business logic changes.
- Cloud sync.
- Mobile apps.
- Calendar, Gmail, Google Drive, or WhatsApp sync.
- Voice assistant execution.
