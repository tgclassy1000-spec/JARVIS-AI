import {
  ConsoleLogTransport,
  RotatingFileLogTransport,
  StructuredLogger,
  type ConsoleSink,
  type LogRecord,
  type LogTransport,
} from '../../src/main/platform/logging/logger';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

class MemoryTransport implements LogTransport {
  public readonly records: LogRecord[] = [];
  public write(record: LogRecord): void {
    this.records.push(record);
  }
}

describe('StructuredLogger', () => {
  it('filters levels, merges child context, and redacts secrets recursively', () => {
    const transport = new MemoryTransport();
    const logger = new StructuredLogger(
      'info',
      [transport],
      { process: 'main' },
      () => new Date('2026-01-02T03:04:05.000Z'),
    );

    logger.debug('hidden');
    logger.child({ subsystem: 'ipc' }).info('accepted', {
      apiKey: 'secret',
      nested: { authorization: 'bearer', safe: true },
      tokens: [{ password: 'secret' }],
      list: [1, { safe: 'yes' }],
    });

    expect(transport.records).toEqual([
      {
        timestamp: '2026-01-02T03:04:05.000Z',
        level: 'info',
        message: 'accepted',
        context: {
          process: 'main',
          subsystem: 'ipc',
          apiKey: '[REDACTED]',
          nested: { authorization: '[REDACTED]', safe: true },
          tokens: '[REDACTED]',
          list: [1, { safe: 'yes' }],
        },
      },
    ]);
  });

  it('writes all supported levels and survives failing transports', async () => {
    const transport = new MemoryTransport();
    const throwing: LogTransport = {
      write: () => {
        throw new Error('broken');
      },
    };
    const rejecting: LogTransport = { write: () => Promise.reject(new Error('broken async')) };
    const logger = new StructuredLogger('debug', [throwing, rejecting, transport]);

    expect(() => {
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');
    }).not.toThrow();
    await Promise.resolve();
    expect(transport.records.map((record) => record.level)).toEqual([
      'debug',
      'info',
      'warn',
      'error',
    ]);
  });

  it('serializes records through the matching console method', () => {
    const calls: Record<keyof ConsoleSink, string[]> = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
    const sink: ConsoleSink = {
      debug: (value) => calls.debug.push(value),
      info: (value) => calls.info.push(value),
      warn: (value) => calls.warn.push(value),
      error: (value) => calls.error.push(value),
    };
    const transport = new ConsoleLogTransport(sink);
    const record: LogRecord = {
      timestamp: 'now',
      level: 'warn',
      message: 'careful',
      context: {},
    };

    transport.write(record);
    expect(calls.warn).toEqual([JSON.stringify(record)]);
  });

  it('supports the default console transport for production composition', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const transport = new ConsoleLogTransport();
    transport.write({ timestamp: 'now', level: 'info', message: 'ready', context: {} });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('rotates structured file logs for production diagnostics', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jarvis-logs-'));
    const transport = new RotatingFileLogTransport({
      directory,
      filename: 'jarvis.log',
      maxBytes: 80,
      maxFiles: 2,
    });
    try {
      transport.write({ timestamp: 'one', level: 'info', message: 'a'.repeat(40), context: {} });
      transport.write({ timestamp: 'two', level: 'warn', message: 'b'.repeat(40), context: {} });
      transport.write({ timestamp: 'three', level: 'error', message: 'c'.repeat(40), context: {} });
      const files = transport.files();
      expect(files.length).toBeGreaterThan(1);
      expect(readFileSync(files[0]!, 'utf8')).toContain('three');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
// @vitest-environment node
