import { ERROR_CODES } from '../../src/shared/platform/errors';
import { ConfigurationManager } from '../../src/main/platform/config/configuration';
import { PlatformError } from '../../src/main/platform/errors/platform-error';

describe('ConfigurationManager', () => {
  it('builds immutable safe defaults without copying unrelated secrets', () => {
    const manager = ConfigurationManager.fromEnvironment({ GEMINI_API_KEY: 'never-copy-me' });
    const config = manager.value;

    expect(config).toEqual({
      environment: 'production',
      logging: { level: 'info' },
      ipc: { maxRequestBytes: 65_536, rateLimitPerMinute: 120 },
      ai: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        timeoutMs: 60_000,
        maxAttempts: 3,
        contextTokenBudget: 32_000,
      },
      web: {
        timeoutMs: 12_000,
        maxAttempts: 2,
        cacheTtlMs: 300_000,
        rateLimitPerMinute: 120,
      },
      production: {
        debugMode: false,
        logMaxBytes: 1_048_576,
        logMaxFiles: 5,
        diagnosticRetentionDays: 30,
        backupRetentionDays: 14,
        leakThresholdBytes: 64_000_000,
      },
      release: {
        channel: 'stable',
        updateManifestUrl: undefined,
        unsignedDevelopmentFallback: true,
      },
    });
    expect(JSON.stringify(config)).not.toContain('never-copy-me');
    expect(manager.getGeminiApiKey()).toBe('never-copy-me');
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.ipc)).toBe(true);
  });

  it('coerces validated environment overrides', () => {
    const config = ConfigurationManager.fromEnvironment({
      NODE_ENV: 'test',
      JARVIS_LOG_LEVEL: 'debug',
      JARVIS_IPC_MAX_REQUEST_BYTES: '4096',
      JARVIS_IPC_RATE_LIMIT: '25',
      JARVIS_AI_TIMEOUT_MS: '5000',
      JARVIS_AI_MAX_ATTEMPTS: '2',
      JARVIS_AI_CONTEXT_TOKENS: '8192',
      JARVIS_WEB_TIMEOUT_MS: '7000',
      JARVIS_WEB_MAX_ATTEMPTS: '4',
      JARVIS_WEB_CACHE_TTL_MS: '120000',
      JARVIS_WEB_RATE_LIMIT: '40',
      JARVIS_DEBUG_MODE: 'true',
      JARVIS_LOG_MAX_BYTES: '8192',
      JARVIS_LOG_MAX_FILES: '2',
      JARVIS_DIAGNOSTIC_RETENTION_DAYS: '7',
      JARVIS_BACKUP_RETENTION_DAYS: '5',
      JARVIS_LEAK_THRESHOLD_BYTES: '1048576',
      JARVIS_RELEASE_CHANNEL: 'beta',
      JARVIS_UPDATE_MANIFEST_URL: 'https://updates.example.com/jarvis/beta/latest.json',
      JARVIS_UNSIGNED_DEVELOPMENT_FALLBACK: 'false',
    }).value;

    expect(config.environment).toBe('test');
    expect(config.logging.level).toBe('debug');
    expect(config.ipc).toEqual({ maxRequestBytes: 4096, rateLimitPerMinute: 25 });
    expect(config.ai).toMatchObject({ timeoutMs: 5000, maxAttempts: 2, contextTokenBudget: 8192 });
    expect(config.web).toEqual({
      timeoutMs: 7000,
      maxAttempts: 4,
      cacheTtlMs: 120_000,
      rateLimitPerMinute: 40,
    });
    expect(config.production).toEqual({
      debugMode: true,
      logMaxBytes: 8192,
      logMaxFiles: 2,
      diagnosticRetentionDays: 7,
      backupRetentionDays: 5,
      leakThresholdBytes: 1_048_576,
    });
    expect(config.release).toEqual({
      channel: 'beta',
      updateManifestUrl: 'https://updates.example.com/jarvis/beta/latest.json',
      unsignedDevelopmentFallback: false,
    });
  });

  it('throws a non-public structured error for invalid values', () => {
    expect(() =>
      ConfigurationManager.fromEnvironment({ JARVIS_IPC_MAX_REQUEST_BYTES: '10' }),
    ).toThrowError(PlatformError);

    try {
      ConfigurationManager.fromEnvironment({ JARVIS_LOG_LEVEL: 'verbose' });
    } catch (error) {
      expect(error).toBeInstanceOf(PlatformError);
      expect((error as PlatformError).code).toBe(ERROR_CODES.configInvalid);
      expect((error as PlatformError).exposeMessage).toBe(false);
    }
  });
});
// @vitest-environment node
