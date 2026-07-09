import type { AppConfig } from '../platform/config/configuration';
import type { ServiceContainer } from '../platform/di/service-container';
import type { IpcRouter } from '../platform/ipc/ipc-router';
import type { Logger } from '../platform/logging/logger';
import { SERVICE_TOKENS } from '../services/tokens';
import { ContextBuilder, ContextManager, type SummarizationHook } from './context/context-manager';
import { ConversationEngine } from './engine/conversation-engine';
import { registerConversationEndpoints } from './ipc/conversation.endpoints';
import { SqliteConversationRepository } from './persistence/sqlite-conversation-repository';
import { GeminiProvider } from './provider/gemini/gemini-provider';
import type { ConversationMemory } from '../memory/conversation-memory';

export interface ConversationBootstrapOptions {
  readonly config: AppConfig;
  readonly geminiApiKey?: string;
  readonly databasePath: string;
  readonly logger: Logger;
  readonly router: IpcRouter;
  readonly services: ServiceContainer;
  readonly summarizer?: SummarizationHook;
  readonly memory?: ConversationMemory;
}

export interface ConversationRuntime {
  readonly engine: ConversationEngine;
  dispose(): void;
}

export function bootstrapConversation(options: ConversationBootstrapOptions): ConversationRuntime {
  const provider = new GeminiProvider({
    apiKey: options.geminiApiKey,
    model: options.config.ai.model,
    timeoutMs: options.config.ai.timeoutMs,
    maxAttempts: options.config.ai.maxAttempts,
  });
  const repository = new SqliteConversationRepository(options.databasePath);
  const contextManager = new ContextManager(
    provider.tokenEstimator,
    options.config.ai.contextTokenBudget,
    new ContextBuilder(
      'You are J.A.R.V.I.S., a precise, capable, and concise desktop AI assistant. Use Markdown when it improves clarity.',
    ),
    options.summarizer,
  );
  const engine = new ConversationEngine({
    repository,
    provider,
    contextManager,
    logger: options.logger.child({ subsystem: 'conversation' }),
    memory: options.memory,
  });

  options.services.registerValue(SERVICE_TOKENS.aiProvider, provider);
  registerConversationEndpoints(options.router, engine);
  options.logger.info('Conversation platform initialized.', {
    provider: provider.id,
    model: provider.model,
    configured: Boolean(options.geminiApiKey),
  });

  return Object.freeze({ engine, dispose: () => engine.close() });
}
