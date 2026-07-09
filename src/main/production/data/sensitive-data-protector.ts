import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import { ERROR_CODES } from '../../../shared/platform/errors';
import type { EncryptionStatus } from '../../../shared/production/contracts';
import { PlatformError } from '../../platform/errors/platform-error';

const PREFIX = 'jarvis:v1';
const ALGORITHM = 'aes-256-gcm';

export interface SensitiveDataProtectorOptions {
  readonly applicationSecret: string;
  readonly machineSecret: string;
  readonly randomBytes?: (size: number) => Buffer;
}

function keyFromSecrets(applicationSecret: string, machineSecret: string): Buffer {
  return createHash('sha256')
    .update(applicationSecret, 'utf8')
    .update('\0')
    .update(machineSecret, 'utf8')
    .digest();
}

function encode(value: Buffer): string {
  return value.toString('base64url');
}

function decode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export class SensitiveDataProtector {
  readonly #key: Buffer;
  readonly #randomBytes: (size: number) => Buffer;

  public constructor(options: SensitiveDataProtectorOptions) {
    this.#key = keyFromSecrets(options.applicationSecret, options.machineSecret);
    this.#randomBytes = options.randomBytes ?? randomBytes;
  }

  public encrypt(plainText: string): string {
    const iv = this.#randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.#key, iv);
    const cipherText = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}:${encode(iv)}:${encode(tag)}:${encode(cipherText)}`;
  }

  public decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== PREFIX) {
      throw new PlatformError(ERROR_CODES.dataIntegrityFailed, 'Encrypted payload is invalid.');
    }
    try {
      const iv = decode(parts[2]!);
      const tag = decode(parts[3]!);
      const cipherText = decode(parts[4]!);
      const decipher = createDecipheriv(ALGORITHM, this.#key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
    } catch (error) {
      throw new PlatformError(
        ERROR_CODES.dataIntegrityFailed,
        'Encrypted payload could not be opened.',
        {
          cause: error,
        },
      );
    }
  }

  public isEncrypted(payload: string): boolean {
    return payload.startsWith(`${PREFIX}:`);
  }

  public fingerprint(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  public matchesFingerprint(value: string, fingerprint: string): boolean {
    const left = Buffer.from(this.fingerprint(value), 'hex');
    const right = Buffer.from(fingerprint, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  }
}

export class EncryptedCredentialVault {
  readonly #protector: SensitiveDataProtector;
  readonly #entries = new Map<string, string>();

  public constructor(protector: SensitiveDataProtector) {
    this.#protector = protector;
  }

  public set(key: string, value: string): void {
    this.#entries.set(key, this.#protector.encrypt(value));
  }

  public get(key: string): string | undefined {
    const encrypted = this.#entries.get(key);
    return encrypted ? this.#protector.decrypt(encrypted) : undefined;
  }

  public delete(key: string): boolean {
    return this.#entries.delete(key);
  }

  public encryptedValue(key: string): string | undefined {
    return this.#entries.get(key);
  }

  public status(): EncryptionStatus {
    return Object.freeze({
      available: true,
      algorithm: ALGORITHM,
      credentialStore: 'encrypted-local',
      encryptedCredentialCount: this.#entries.size,
    });
  }
}
