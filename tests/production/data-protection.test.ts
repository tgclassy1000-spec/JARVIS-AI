// @vitest-environment node

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { PlatformError } from '../../src/main/platform/errors/platform-error';
import { DatabaseProtectionService } from '../../src/main/production/data/database-protection-service';
import {
  EncryptedCredentialVault,
  SensitiveDataProtector,
} from '../../src/main/production/data/sensitive-data-protector';

function createDatabase(path: string): void {
  const database = new DatabaseSync(path);
  database.exec("CREATE TABLE health (id TEXT PRIMARY KEY); INSERT INTO health VALUES ('ok');");
  database.close();
}

describe('production data protection', () => {
  it('encrypts local credentials and rejects invalid or tampered payloads', () => {
    const protector = new SensitiveDataProtector({
      applicationSecret: 'jarvis',
      machineSecret: 'machine',
      randomBytes: (size) => Buffer.alloc(size, 7),
    });
    const encrypted = protector.encrypt('secret credential');
    expect(encrypted).not.toContain('secret credential');
    expect(protector.isEncrypted(encrypted)).toBe(true);
    expect(protector.decrypt(encrypted)).toBe('secret credential');
    expect(protector.matchesFingerprint('value', protector.fingerprint('value'))).toBe(true);
    expect(protector.matchesFingerprint('value', protector.fingerprint('other'))).toBe(false);
    expect(() => protector.decrypt('plain')).toThrow(PlatformError);
    expect(() => protector.decrypt(`${encrypted.slice(0, -3)}bad`)).toThrow(PlatformError);

    const vault = new EncryptedCredentialVault(protector);
    vault.set('gemini', 'api-key');
    expect(vault.encryptedValue('gemini')).not.toBe('api-key');
    expect(vault.get('gemini')).toBe('api-key');
    expect(vault.status()).toMatchObject({
      available: true,
      algorithm: 'aes-256-gcm',
      encryptedCredentialCount: 1,
    });
    expect(vault.delete('gemini')).toBe(true);
    expect(vault.get('gemini')).toBeUndefined();
  });

  it('checks SQLite integrity, validates backups, and quarantines corruption safely', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-data-'));
    const backupDirectory = join(directory, 'backups');
    const databasePath = join(directory, 'jarvis.sqlite');
    const corruptPath = join(directory, 'corrupt.sqlite');
    createDatabase(databasePath);
    writeFileSync(corruptPath, 'not sqlite');
    const service = new DatabaseProtectionService({
      databasePaths: [databasePath, join(directory, 'missing.sqlite')],
      backupDirectory,
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    try {
      const integrity = service.checkIntegrity();
      expect(integrity[0]).toMatchObject({ ok: true, detail: 'ok', recovered: false });
      expect(integrity[1]).toMatchObject({ ok: false, detail: 'Database file is missing.' });

      const corrupt = service.checkIntegrity([corruptPath])[0];
      expect(corrupt).toMatchObject({ ok: false, recovered: true });
      expect(corrupt?.quarantinePath).toContain('corrupt');

      const backups = service.validateBackups({
        databasePaths: [databasePath, join(directory, 'missing.sqlite')],
      });
      expect(backups.results[0]).toMatchObject({ valid: true, detail: 'ok' });
      expect(backups.results[1]).toMatchObject({ valid: false });
      expect(service.lastBackupValidation()).toHaveLength(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
