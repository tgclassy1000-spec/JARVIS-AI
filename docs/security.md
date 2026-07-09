# Security

## Boundary model

JARVIS is split into three trust zones:

1. Electron Main owns secrets, SQLite, providers, filesystem access, operating-system capabilities, plugin orchestration, and production recovery.
2. Preload exposes a frozen, typed bridge with specific methods only.
3. The React renderer is sandboxed and never receives Node.js, Electron, database handles, provider clients, API keys, or generic IPC access.

All sensitive actions must cross a validated, allow-listed IPC endpoint.

## IPC security

- Every channel is listed in the shared IPC contract map.
- Main registers handlers through the central router.
- Middleware enforces origin checks, payload size limits, rate limits, schema validation, permissions, structured errors, and redacted logging.
- The renderer cannot dynamically invoke channels by string.
- Production audit checks verify duplicate, missing, or suspicious IPC channel registration patterns.

## Secret handling

- `GEMINI_API_KEY` is read only in Electron Main.
- Renderer code must never import provider clients or environment loaders.
- Logs redact token, password, secret, credential, authorization, cookie, and API-key-like fields.
- Module 11 credential storage uses AES-256-GCM for sensitive local values through `SensitiveDataProtector` and `EncryptedCredentialVault`.

## Permissions

The permission manager gates desktop and future capability classes, including:

- App launch
- File access
- Office automation
- Notifications
- Clipboard
- Network
- System information

New modules must add permissions before exposing a capability, not after.

## Content Security Policy

The renderer HTML must retain a restrictive CSP:

- `default-src 'self'`
- `script-src 'self'`
- `object-src 'none'`
- `frame-ancestors 'none'`

The Module 11 security audit verifies this posture.

## Plugin security

Plugins are manifest-first and permission-first:

- Capabilities are declared up front.
- Permissions are granted explicitly.
- Settings and storage are bounded.
- Tool invocation is routed through typed contracts.
- Signature state and sandbox checks are visible in the Plugin HUD.

The plugin platform does not expose arbitrary renderer code execution or generic Main-process access.

## Production diagnostics

Diagnostic bundles are JSON exports intended for local support review. They may include logs, crash reports, security checks, data-protection status, and performance snapshots. They must not include plaintext API keys or decrypted credentials.

Before sharing a diagnostic bundle externally, review the JSON content for local file paths or user-authored text.

## Release signing

Windows packages are built through `electron-builder`.

- Trusted signing uses the CSC environment variables supported by `electron-builder`.
- Development release candidates can use `npm run dist:win:unsigned`, which disables certificate auto-discovery.
- The unsigned EXE is a local bootstrap that launches the adjacent MSI; it does not contain credentials or bypass Windows Installer policy.
- Signing secrets must be injected by the CI/CD environment and must never be committed to `.env`, source files, docs, or tests.
- Unsigned development artifacts are for local validation only.

## Update security

The Module 12 update service is manifest-driven:

- Release channels are stable, beta, and development.
- Manifests are fetched only by Electron Main.
- Manifest shape is validated before use.
- Downloaded artifacts must match the expected SHA-256 digest.
- Failed verification blocks the artifact and records an error state.

The renderer never receives raw fetch access or filesystem write access for updates.

## Backup and restore safety

Backup export and restore/import are permission-gated. Backups contain selected local sections and checksums. Restore/import validates backup structure and stages files in a restore directory instead of overwriting active SQLite databases while JARVIS is running.

This design protects the running app from partial restore corruption and gives administrators a clear review point before applying staged data.
