import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type {
  BackupValidationReport,
  BackupValidationRequest,
  BackupValidationResult,
  DatabaseIntegrityReport,
} from '../../../shared/production/contracts';

export interface DatabaseProtectionServiceOptions {
  readonly databasePaths: readonly string[];
  readonly backupDirectory: string;
  readonly clock?: () => Date;
}

function compactTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function databaseName(path: string): string {
  return basename(path).replace(/\.sqlite$/i, '') || 'database';
}

function integrityCheck(path: string): string {
  const database = new DatabaseSync(path);
  try {
    const row = database.prepare('PRAGMA integrity_check').get() as
      { readonly integrity_check: string } | undefined;
    return row?.integrity_check ?? 'missing integrity response';
  } finally {
    database.close();
  }
}

export class DatabaseProtectionService {
  readonly #databasePaths: readonly string[];
  readonly #backupDirectory: string;
  readonly #clock: () => Date;
  #lastBackupValidation: readonly BackupValidationResult[] = Object.freeze([]);

  public constructor(options: DatabaseProtectionServiceOptions) {
    this.#databasePaths = Object.freeze([...options.databasePaths]);
    this.#backupDirectory = options.backupDirectory;
    this.#clock = options.clock ?? (() => new Date());
    mkdirSync(this.#backupDirectory, { recursive: true });
  }

  public checkIntegrity(
    paths: readonly string[] = this.#databasePaths,
  ): readonly DatabaseIntegrityReport[] {
    return Object.freeze(paths.map((path) => this.checkOne(path)));
  }

  public validateBackups(request: BackupValidationRequest): BackupValidationReport {
    const backupDirectory = request.backupDirectory ?? this.#backupDirectory;
    mkdirSync(backupDirectory, { recursive: true });
    const generatedAt = this.#clock().toISOString();
    const results = request.databasePaths.map((sourcePath) =>
      this.validateBackup(sourcePath, backupDirectory, generatedAt),
    );
    this.#lastBackupValidation = Object.freeze(results);
    return Object.freeze({ generatedAt, results: this.#lastBackupValidation });
  }

  public lastBackupValidation(): readonly BackupValidationResult[] {
    return this.#lastBackupValidation;
  }

  public recoverCorruption(path: string): DatabaseIntegrityReport {
    const checkedAt = this.#clock().toISOString();
    if (!existsSync(path)) {
      return Object.freeze({
        name: databaseName(path),
        path,
        ok: false,
        detail: 'Database file is missing.',
        checkedAt,
        recovered: false,
      });
    }
    const quarantinePath = join(
      this.#backupDirectory,
      `${databaseName(path)}.${compactTimestamp(this.#clock())}.corrupt-copy.sqlite`,
    );
    copyFileSync(path, quarantinePath);
    return Object.freeze({
      name: databaseName(path),
      path,
      ok: false,
      detail: 'Corrupt database was copied to quarantine for manual recovery.',
      checkedAt,
      recovered: true,
      quarantinePath,
    });
  }

  private checkOne(path: string): DatabaseIntegrityReport {
    const checkedAt = this.#clock().toISOString();
    if (!existsSync(path)) {
      return Object.freeze({
        name: databaseName(path),
        path,
        ok: false,
        detail: 'Database file is missing.',
        checkedAt,
        recovered: false,
      });
    }
    try {
      const result = integrityCheck(path);
      return Object.freeze({
        name: databaseName(path),
        path,
        ok: result.toLowerCase() === 'ok',
        detail: result,
        checkedAt,
        recovered: false,
      });
    } catch {
      return this.recoverCorruption(path);
    }
  }

  private validateBackup(
    sourcePath: string,
    backupDirectory: string,
    checkedAt: string,
  ): BackupValidationResult {
    if (!existsSync(sourcePath)) {
      return Object.freeze({
        sourcePath,
        valid: false,
        detail: 'Source database is missing.',
        checkedAt,
      });
    }
    const backupPath = join(
      backupDirectory,
      `${databaseName(sourcePath)}.${compactTimestamp(this.#clock())}.backup.sqlite`,
    );
    try {
      copyFileSync(sourcePath, backupPath);
      const detail = integrityCheck(backupPath);
      return Object.freeze({
        sourcePath,
        backupPath,
        valid: detail.toLowerCase() === 'ok',
        detail,
        checkedAt,
      });
    } catch (error) {
      return Object.freeze({
        sourcePath,
        backupPath,
        valid: false,
        detail: error instanceof Error ? error.message : 'Backup validation failed.',
        checkedAt,
      });
    }
  }
}
