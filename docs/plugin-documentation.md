# Plugin Documentation

Module 10 provides the local plugin platform. Module 12 does not change plugin execution or add new AI capabilities.

## Plugin release expectations

Plugins remain manifest-first:

- `id`
- `name`
- `version`
- `author`
- `description`
- `permissions`
- `capabilities`
- `minimumJarvisVersion`

Module 12 packaging includes compiled app output and package metadata only. Local plugin state is handled through normal app data and can be included in release backups when the plugin section is selected.

## Plugin settings in Release Center

The single settings page exposes plugin release preferences:

- plugins enabled
- community plugins allowed

These settings do not bypass plugin manifest validation, permission checks, signature status, storage limits, rate limits, or sandbox checks.

## Plugin distribution

Module 12 does not add a public plugin store or cloud sync. Plugin authors should continue to validate manifests through the Plugin Dashboard and keep plugin release notes separate from core JARVIS release notes.
