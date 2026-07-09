import { appendFileSync, existsSync, mkdirSync, rmSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = Readonly<Record<string, unknown>>;

export interface LogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context: LogContext;
}

export interface LogTransport {
  write(record: LogRecord): void | Promise<void>;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

export interface ConsoleSink {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SECRET_KEY = /(authorization|cookie|credential|password|secret|token|api[-_]?key)/i;

function redact(value: unknown, key = ''): unknown {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redact(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function sanitizeContext(context: LogContext): LogContext {
  return Object.freeze(redact(context) as Record<string, unknown>);
}

export class ConsoleLogTransport implements LogTransport {
  public constructor(private readonly sink: ConsoleSink = console) {}

  public write(record: LogRecord): void {
    const serialized = JSON.stringify(record);
    this.sink[record.level](serialized);
  }
}

export interface RotatingFileLogTransportOptions {
  readonly directory: string;
  readonly filename?: string;
  readonly maxBytes: number;
  readonly maxFiles: number;
}

function rotatedName(basePath: string, index: number): string {
  return `${basePath}.${index}`;
}

export class RotatingFileLogTransport implements LogTransport {
  readonly #filePath: string;
  readonly #maxBytes: number;
  readonly #maxFiles: number;

  public constructor(options: RotatingFileLogTransportOptions) {
    mkdirSync(options.directory, { recursive: true });
    this.#filePath = join(options.directory, options.filename ?? 'jarvis.log');
    this.#maxBytes = options.maxBytes;
    this.#maxFiles = options.maxFiles;
  }

  public write(record: LogRecord): void {
    const line = `${JSON.stringify(record)}\n`;
    this.rotateIfNeeded(Buffer.byteLength(line, 'utf8'));
    appendFileSync(this.#filePath, line, 'utf8');
  }

  public files(): readonly string[] {
    const files = [this.#filePath];
    for (let index = 1; index <= this.#maxFiles; index += 1) {
      files.push(rotatedName(this.#filePath, index));
    }
    return Object.freeze(files.filter((file) => existsSync(file)));
  }

  private rotateIfNeeded(incomingBytes: number): void {
    if (!existsSync(this.#filePath)) return;
    const currentBytes = statSync(this.#filePath).size;
    if (currentBytes + incomingBytes <= this.#maxBytes) return;

    const oldest = rotatedName(this.#filePath, this.#maxFiles);
    if (existsSync(oldest)) rmSync(oldest, { force: true });
    for (let index = this.#maxFiles - 1; index >= 1; index -= 1) {
      const source = rotatedName(this.#filePath, index);
      if (existsSync(source)) renameSync(source, rotatedName(this.#filePath, index + 1));
    }
    renameSync(this.#filePath, rotatedName(this.#filePath, 1));
  }
}

export class StructuredLogger implements Logger {
  public constructor(
    private readonly minimumLevel: LogLevel,
    private readonly transports: readonly LogTransport[],
    private readonly baseContext: LogContext = {},
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public debug(message: string, context: LogContext = {}): void {
    this.write('debug', message, context);
  }

  public info(message: string, context: LogContext = {}): void {
    this.write('info', message, context);
  }

  public warn(message: string, context: LogContext = {}): void {
    this.write('warn', message, context);
  }

  public error(message: string, context: LogContext = {}): void {
    this.write('error', message, context);
  }

  public child(context: LogContext): Logger {
    return new StructuredLogger(
      this.minimumLevel,
      this.transports,
      { ...this.baseContext, ...context },
      this.clock,
    );
  }

  private write(level: LogLevel, message: string, context: LogContext): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minimumLevel]) return;

    const record: LogRecord = Object.freeze({
      timestamp: this.clock().toISOString(),
      level,
      message,
      context: sanitizeContext({ ...this.baseContext, ...context }),
    });

    for (const transport of this.transports) {
      try {
        const result = transport.write(record);
        if (result instanceof Promise) void result.catch(() => undefined);
      } catch {
        // Logging must never crash the application or recurse through itself.
      }
    }
  }
}
