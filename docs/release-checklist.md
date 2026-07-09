# Release Checklist

Use this checklist before marking a JARVIS build public-release ready.

## Scope confirmation

- [ ] No new AI features were added.
- [ ] Existing assistant architecture was not changed.
- [ ] Existing business logic was not changed.
- [ ] No subsequent module work was started.
- [ ] Cloud sync and mobile apps remain out of scope.

## Configuration

- [ ] `.env.example` documents production and release variables.
- [ ] `GEMINI_API_KEY` remains Main-process only.
- [ ] `JARVIS_RELEASE_CHANNEL` is set to stable, beta, or development.
- [ ] `JARVIS_UPDATE_MANIFEST_URL` is configured for update-enabled builds.
- [ ] Unsigned fallback is enabled only for development release candidates.

## Installer artifacts

- [ ] Trusted pipeline generates the NSIS EXE installer.
- [ ] Unsigned pipeline generates the MSI-adjacent EXE bootstrap.
- [ ] MSI package is generated.
- [ ] Portable ZIP artifact is generated.
- [ ] Desktop shortcut is enabled.
- [ ] Start Menu shortcut is enabled.
- [ ] Uninstaller support is enabled.
- [ ] `npm run release:verify-artifacts` passes.

## Code signing

- [ ] Trusted signing pipeline uses CI/CD-injected CSC secrets.
- [ ] Signing secrets are not committed to the repo.
- [ ] Unsigned local builds use `npm run dist:win:unsigned`.
- [ ] The unsigned EXE and MSI remain in the same distribution directory.
- [ ] Signed artifacts are verified before publication.

## Updates

- [ ] Stable, beta, and development channels are documented.
- [ ] Release manifest validates successfully.
- [ ] Version checker detects current versus newer builds.
- [ ] Downloaded artifacts are SHA-256 verified.
- [ ] Rollback checkpoint state is available after download.

## First run and settings

- [ ] First-run wizard captures theme, language, voice preference, permissions, Gemini key status, privacy, model, and channel.
- [ ] Gemini API key is encrypted locally and never returned to the renderer.
- [ ] Single settings page covers appearance, voice, AI, memory, office, plugins, privacy, updates, and performance.

## Backup and restore

- [ ] Backup export creates a local artifact with checksums.
- [ ] Restore/import validates the backup before staging.
- [ ] Restore/import stages files instead of overwriting live databases.
- [ ] Backup and restore IPC endpoints are file-permission gated.

## Security

- [ ] CSP verification passes.
- [ ] IPC allow-list audit passes.
- [ ] Permission audit passes.
- [ ] Secret scan passes.
- [ ] Dependency verification passes.
- [ ] Input fuzz checks pass.
- [ ] `npm audit --audit-level=high` reports zero vulnerabilities.

## QA

- [ ] Production build succeeds.
- [ ] Installer build succeeds.
- [ ] Electron smoke test passes.
- [ ] Regression suite passes.
- [ ] Coverage remains above 95%.
- [ ] Explicit `any` scan returns no matches.
- [ ] Release notes are updated.

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
