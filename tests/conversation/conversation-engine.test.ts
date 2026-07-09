// @vitest-environment node

import type { GenerationEvent } from '../../src/shared/conversation/contracts';
import { ERROR_CODES } from '../../src/shared/platform/errors';
import {
  ContextBuilder,
  ContextManager,
  type SummarizationHook,
} from '../../src/main/conversation/context/context-manager';
import { ConversationEngine } from '../../src/main/conversation/engine/conversation-engine';
import { SqliteConversationRepository } from '../../src/main/conversation/persistence/sqlite-conversation-repository';
import type {
  AIProvider,
  ChatRequest,
  ChatSession,
  StreamChunk,
  StreamResponse,
} from '../../src/main/conversation/provider/contracts';
import { HeuristicTokenEstimator } from '../../src/main/conversation/provider/token-estimator';
import { PlatformError } from '../../src/main/platform/errors/platform-error';
import type { Logger } from '../../src/main/platform/logging/logger';
import type { ConversationMemory } from '../../src/main/memory/conversation-memory';

type StreamFactory = (request: ChatRequest) => AsyncIterable<StreamChunk>;

class MockProvider implements AIProvider {
  public readonly id = 'mock';
  public readonly model = 'mock-model';
  public readonly tokenEstimator = new HeuristicTokenEstimator();
  public constructor(private readonly factories: StreamFactory[]) {}
  public createSession(): ChatSession {
    const factory = this.factories.shift();
    if (!factory) throw new Error('No mock response configured.');
    return {
      stream: (request): StreamResponse => {
        const iterable = factory(request);
        return {
          cancel: vi.fn(),
          [Symbol.asyncIterator]: () => iterable[Symbol.asyncIterator](),
        };
      },
    };
  }
}

const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child() {
    return this;
  },
};

async function* response(...parts: string[]): AsyncGenerator<StreamChunk> {
  await Promise.resolve();
  for (const text of parts) yield { text };
}

function createEngine(
  factories: StreamFactory[],
  tokenBudget = 10_000,
  summarizer?: SummarizationHook,
  memory?: ConversationMemory,
) {
  let repositoryId = 0;
  let generationId = 0;
  const repository = new SqliteConversationRepository(
    ':memory:',
    () => new Date('2026-01-01T00:00:00.000Z'),
    () => `message-${++repositoryId}`,
  );
  const provider = new MockProvider(factories);
  const contextManager = new ContextManager(
    provider.tokenEstimator,
    tokenBudget,
    new ContextBuilder('System'),
    summarizer,
  );
  return new ConversationEngine({
    repository,
    provider,
    contextManager,
    logger,
    idFactory: () => `generation-${++generationId}`,
    memory,
  });
}

function terminalSink() {
  const events: GenerationEvent[] = [];
  let resolve!: (event: GenerationEvent) => void;
  const completed = new Promise<GenerationEvent>((done) => {
    resolve = done;
  });
  const sink = (event: GenerationEvent) => {
    events.push(event);
    if (event.type !== 'delta') resolve(event);
  };
  return { events, completed, sink };
}

describe('ConversationEngine', () => {
  it('streams, auto-saves, names, searches, renames, and exports conversations', async () => {
    const engine = createEngine([() => response('Hello', ' world')]);
    const conversation = engine.create();
    const terminal = terminalSink();
    const started = engine.send(conversation.id, 'Explain TypeScript', terminal.sink);
    const completed = await terminal.completed;

    expect(started.generationId).toBe('generation-1');
    expect(terminal.events.filter((event) => event.type === 'delta')).toHaveLength(2);
    expect(completed.type).toBe('complete');
    expect(engine.get(conversation.id).messages.at(-1)?.content).toBe('Hello world');
    expect(engine.list()[0]?.title).toBe('Explain TypeScript');
    expect(engine.search('Hello')).toHaveLength(1);
    expect(engine.search('  ')).toHaveLength(1);

    expect(engine.rename(conversation.id, 'Renamed').title).toBe('Renamed');
    expect(engine.export(conversation.id, 'markdown').content).toContain('## JARVIS');
    expect(engine.export(conversation.id, 'json').mimeType).toBe('application/json');
    engine.close();
  });

  it('supports multiple sessions, editing, and response regeneration', async () => {
    const engine = createEngine([
      () => response('First answer'),
      () => response('Edited answer'),
      () => response('Regenerated answer'),
    ]);
    const firstConversation = engine.create('First');
    const secondConversation = engine.create('Second');
    expect(engine.list()).toHaveLength(2);

    const firstRun = terminalSink();
    engine.send(firstConversation.id, 'Original prompt', firstRun.sink);
    await firstRun.completed;
    const firstHistory = engine.get(firstConversation.id);
    const user = firstHistory.messages[0];
    const assistant = firstHistory.messages[1];
    expect(user).toBeDefined();
    expect(assistant).toBeDefined();

    const editRun = terminalSink();
    engine.edit(firstConversation.id, user!.id, 'Edited prompt', editRun.sink);
    await editRun.completed;
    expect(engine.get(firstConversation.id).messages.map((message) => message.content)).toEqual([
      'Edited prompt',
      'Edited answer',
    ]);

    const regenerateRun = terminalSink();
    const editedAssistant = engine.get(firstConversation.id).messages[1]!;
    engine.regenerate(firstConversation.id, editedAssistant.id, regenerateRun.sink);
    await regenerateRun.completed;
    expect(engine.get(firstConversation.id).messages.at(-1)?.content).toBe('Regenerated answer');

    engine.delete(secondConversation.id);
    expect(engine.list()).toHaveLength(1);
    engine.close();
  });

  it('cancels active generation and reports unknown cancellation attempts', async () => {
    const engine = createEngine([
      (request) =>
        (async function* () {
          if (request.signal?.aborted) throw request.signal.reason;
          await new Promise<void>((_resolve, reject) => {
            request.signal?.addEventListener(
              'abort',
              () =>
                reject(
                  request.signal?.reason instanceof Error
                    ? request.signal.reason
                    : new Error('Aborted'),
                ),
              { once: true },
            );
          });
          yield { text: 'never' };
        })(),
    ]);
    const conversation = engine.create();
    const terminal = terminalSink();
    const started = engine.send(conversation.id, 'Stop this', terminal.sink);
    expect(engine.cancel(started.generationId)).toBe(true);
    expect((await terminal.completed).type).toBe('cancelled');
    expect(engine.cancel('missing')).toBe(false);
    engine.close();
  });

  it('rejects overlapping generations in one conversation', async () => {
    const engine = createEngine([
      (request) =>
        (async function* () {
          if (request.signal?.aborted) throw request.signal.reason;
          await new Promise<void>((_resolve, reject) => {
            request.signal?.addEventListener(
              'abort',
              () =>
                reject(
                  request.signal?.reason instanceof Error
                    ? request.signal.reason
                    : new Error('Generation aborted'),
                ),
              { once: true },
            );
          });
          yield { text: 'never' };
        })(),
    ]);
    const conversation = engine.create();
    const terminal = terminalSink();
    const started = engine.send(conversation.id, 'First request', terminal.sink);

    expect(() => engine.send(conversation.id, 'Second request', vi.fn())).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.generationActive }),
    );
    engine.cancel(started.generationId);
    await terminal.completed;
    engine.close();
  });

  it('cancels active work when its conversation is deleted', async () => {
    const engine = createEngine([
      (request) =>
        (async function* () {
          if (request.signal?.aborted) throw request.signal.reason;
          await new Promise<void>((_resolve, reject) => {
            request.signal?.addEventListener(
              'abort',
              () => reject(new Error('Deleted while streaming')),
              { once: true },
            );
          });
          yield { text: 'never' };
        })(),
    ]);
    const conversation = engine.create();
    const terminal = terminalSink();
    engine.send(conversation.id, 'Delete this chat', terminal.sink);
    engine.delete(conversation.id);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(() => engine.get(conversation.id)).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.conversationNotFound }),
    );
    engine.close();
  });

  it('persists rolling summaries when context is trimmed', async () => {
    const instructions: string[] = [];
    const summarizer: SummarizationHook = {
      summarize: () => Promise.resolve('Earlier conversation summary'),
    };
    const engine = createEngine(
      [
        () => response('First answer'),
        (request) => {
          instructions.push(request.systemInstruction ?? '');
          return response('Second answer');
        },
      ],
      8,
      summarizer,
    );
    const conversation = engine.create();
    const first = terminalSink();
    engine.send(conversation.id, 'First prompt', first.sink);
    await first.completed;
    const second = terminalSink();
    engine.send(conversation.id, 'Second prompt', second.sink);
    await second.completed;
    expect(instructions[0]).toContain('Earlier conversation summary');
    engine.close();
  });

  it('recalls relevant long-term memory before generation and extracts after completion', async () => {
    const extract = vi.fn(() => Promise.resolve());
    const memory: ConversationMemory = {
      recall: () => 'Relevant user memories:\n- Prefers concise answers',
      extract,
    };
    let instruction = '';
    const engine = createEngine(
      [
        (request) => {
          instruction = request.systemInstruction ?? '';
          return response('Concise answer');
        },
      ],
      10_000,
      undefined,
      memory,
    );
    const conversation = engine.create();
    const terminal = terminalSink();
    engine.send(conversation.id, 'Explain types', terminal.sink);
    await terminal.completed;
    expect(instruction).toContain('Prefers concise answers');
    expect(extract).toHaveBeenCalledWith('Explain types', conversation.id);
    engine.close();
  });

  it('maps provider errors into persisted error messages', async () => {
    const engine = createEngine([
      () => ({
        [Symbol.asyncIterator]: () => ({
          next: () =>
            Promise.reject(new PlatformError(ERROR_CODES.quotaExceeded, 'Quota exhausted')),
        }),
      }),
    ]);
    const conversation = engine.create();
    const terminal = terminalSink();
    engine.send(conversation.id, 'Fail', terminal.sink);
    const event = await terminal.completed;
    expect(event.type).toBe('error');
    if (event.type === 'error') expect(event.error.code).toBe(ERROR_CODES.quotaExceeded);
    expect(engine.get(conversation.id).messages.at(-1)?.status).toBe('error');
    engine.close();
  });

  it('rejects missing conversations and invalid message operations', () => {
    const engine = createEngine([]);
    expect(() => engine.get('missing')).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.conversationNotFound }),
    );
    expect(() => engine.rename('missing', 'Title')).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.conversationNotFound }),
    );
    expect(() => engine.delete('missing')).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.conversationNotFound }),
    );

    const conversation = engine.create('');
    expect(conversation.title).toBe('New conversation');
    expect(() => engine.edit(conversation.id, 'missing', 'content', vi.fn())).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.messageNotFound }),
    );
    expect(() => engine.regenerate(conversation.id, 'missing', vi.fn())).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.messageNotFound }),
    );
    engine.close();
  });
});
