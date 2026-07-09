import { z } from 'zod';

import { ERROR_CODES } from '../../../shared/platform/errors';
import { PlatformError } from '../errors/platform-error';

const booleanEnv = z
  .preprocess((value) => {
    if (value === undefined) return false;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'yes';
    }
    return value;
  }, z.boolean())
  .default(false);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  JARVIS_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  JARVIS_IPC_MAX_REQUEST_BYTES: z.coerce.number().int().min(1_024).max(1_048_576).default(65_536),
  JARVIS_IPC_RATE_LIMIT: z.coerce.number().int().min(1).max(10_000).default(120),
  GEMINI_API_KEY: z.string().trim().min(1).optional(),
  JARVIS_AI_MODEL: z.literal('gemini-2.5-flash').default('gemini-2.5-flash'),
  JARVIS_AI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(60_000),
  JARVIS_AI_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  JARVIS_AI_CONTEXT_TOKENS: z.coerce.number().int().min(1_024).max(1_000_000).default(32_000),
  JARVIS_WEB_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(12_000),
  JARVIS_WEB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(2),
  JARVIS_WEB_CACHE_TTL_MS: z.coerce.number().int().min(1_000).max(86_400_000).default(300_000),
  JARVIS_WEB_RATE_LIMIT: z.coerce.number().int().min(1).max(10_000).default(120),
  JARVIS_DEBUG_MODE: booleanEnv,
  JARVIS_LOG_MAX_BYTES: z.coerce.number().int().min(8_192).max(104_857_600).default(1_048_576),
  JARVIS_LOG_MAX_FILES: z.coerce.number().int().min(1).max(20).default(5),
  JARVIS_DIAGNOSTIC_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  JARVIS_BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(14),
  JARVIS_LEAK_THRESHOLD_BYTES: z.coerce
    .number()
    .int()
    .min(1_048_576)
    .max(1_073_741_824)
    .default(64_000_000),
  JARVIS_RELEASE_CHANNEL: z.enum(['stable', 'beta', 'development']).default('stable'),
  JARVIS_UPDATE_MANIFEST_URL: z.string().url().optional(),
  JARVIS_UNSIGNED_DEVELOPMENT_FALLBACK: booleanEnv.default(true),
});

export interface AppConfig {
  readonly environment: 'development' | 'test' | 'production';
  readonly logging: {
    readonly level: 'debug' | 'info' | 'warn' | 'error';
  };
  readonly ipc: {
    readonly maxRequestBytes: number;
    readonly rateLimitPerMinute: number;
  };
  readonly ai: {
    readonly provider: 'gemini';
    readonly model: 'gemini-2.5-flash';
    readonly timeoutMs: number;
    readonly maxAttempts: number;
    readonly contextTokenBudget: number;
  };
  readonly web: {
    readonly timeoutMs: number;
    readonly maxAttempts: number;
    readonly cacheTtlMs: number;
    readonly rateLimitPerMinute: number;
  };
  readonly production: {
    readonly debugMode: boolean;
    readonly logMaxBytes: number;
    readonly logMaxFiles: number;
    readonly diagnosticRetentionDays: number;
    readonly backupRetentionDays: number;
    readonly leakThresholdBytes: number;
  };
  readonly release: {
    readonly channel: 'stable' | 'beta' | 'development';
    readonly updateManifestUrl?: string;
    readonly unsignedDevelopmentFallback: boolean;
  };
}

export class ConfigurationManager {
  readonly #config: AppConfig;
  readonly #geminiApiKey: string | undefined;

  private constructor(config: AppConfig, geminiApiKey?: string) {
    this.#config = Object.freeze({
      ...config,
      logging: Object.freeze({ ...config.logging }),
      ipc: Object.freeze({ ...config.ipc }),
      ai: Object.freeze({ ...config.ai }),
      web: Object.freeze({ ...config.web }),
      production: Object.freeze({ ...config.production }),
      release: Object.freeze({ ...config.release }),
    });
    this.#geminiApiKey = geminiApiKey;
  }

  public static fromEnvironment(
    environment: Readonly<Record<string, string | undefined>>,
  ): ConfigurationManager {
    const parsed = environmentSchema.safeParse(environment);
    if (!parsed.success) {
      throw new PlatformError(ERROR_CODES.configInvalid, 'Environment configuration is invalid.', {
        metadata: { issues: parsed.error.issues.map((issue) => issue.path.join('.')) },
        exposeMessage: false,
      });
    }

    return new ConfigurationManager(
      {
        environment: parsed.data.NODE_ENV,
        logging: { level: parsed.data.JARVIS_LOG_LEVEL },
        ipc: {
          maxRequestBytes: parsed.data.JARVIS_IPC_MAX_REQUEST_BYTES,
          rateLimitPerMinute: parsed.data.JARVIS_IPC_RATE_LIMIT,
        },
        ai: {
          provider: 'gemini',
          model: parsed.data.JARVIS_AI_MODEL,
          timeoutMs: parsed.data.JARVIS_AI_TIMEOUT_MS,
          maxAttempts: parsed.data.JARVIS_AI_MAX_ATTEMPTS,
          contextTokenBudget: parsed.data.JARVIS_AI_CONTEXT_TOKENS,
        },
        web: {
          timeoutMs: parsed.data.JARVIS_WEB_TIMEOUT_MS,
          maxAttempts: parsed.data.JARVIS_WEB_MAX_ATTEMPTS,
          cacheTtlMs: parsed.data.JARVIS_WEB_CACHE_TTL_MS,
          rateLimitPerMinute: parsed.data.JARVIS_WEB_RATE_LIMIT,
        },
        production: {
          debugMode: parsed.data.JARVIS_DEBUG_MODE,
          logMaxBytes: parsed.data.JARVIS_LOG_MAX_BYTES,
          logMaxFiles: parsed.data.JARVIS_LOG_MAX_FILES,
          diagnosticRetentionDays: parsed.data.JARVIS_DIAGNOSTIC_RETENTION_DAYS,
          backupRetentionDays: parsed.data.JARVIS_BACKUP_RETENTION_DAYS,
          leakThresholdBytes: parsed.data.JARVIS_LEAK_THRESHOLD_BYTES,
        },
        release: {
          channel: parsed.data.JARVIS_RELEASE_CHANNEL,
          updateManifestUrl: parsed.data.JARVIS_UPDATE_MANIFEST_URL,
          unsignedDevelopmentFallback: parsed.data.JARVIS_UNSIGNED_DEVELOPMENT_FALLBACK,
        },
      },
      parsed.data.GEMINI_API_KEY,
    );
  }

  public get value(): AppConfig {
    return this.#config;
  }

  public getGeminiApiKey(): string | undefined {
    return this.#geminiApiKey;
  }
}
