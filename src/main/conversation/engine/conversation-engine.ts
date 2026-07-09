import { randomUUID } from 'node:crypto';

import type {
  ConversationDetail,
  ConversationExport,
  ConversationMessage,
  ConversationSummary,
  GenerationEvent,
  GenerationStarted,
} from '../../../shared/conversation/contracts';
import { ERROR_CODES } from '../../../shared/platform/errors';
import { PlatformError, toPublicError } from '../../platform/errors/platform-error';
import type { Logger } from '../../platform/logging/logger';
import type { ConversationMemory } from '../../memory/conversation-memory';
import type { ContextManager } from '../context/context-manager';
import type { ConversationRepository } from '../persistence/conversation-repository';
import type { AIProvider } from '../provider/contracts';

export type GenerationEventSink = (event: GenerationEvent) => void;

interface ActiveGeneration {
  readonly conversationId: string;
  readonly controller: AbortController;
}

export interface ConversationEngineOptions {
  readonly repository: ConversationRepository;
  readonly provider: AIProvider;
  readonly contextManager: ContextManager;
  readonly logger: Logger;
  readonly idFactory?: () => string;
  readonly defaultTitle?: string;
  readonly schedule?: (task: () => void) => void;
  readonly memory?: ConversationMemory;
}

function friendlyTitle(content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  return collapsed.length > 48 ? `${collapsed.slice(0, 45)}…` : collapsed;
}

function exportFilename(title: string, extension: string): string {
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${safe || 'conversation'}.${extension}`;
}

export class ConversationEngine {
  readonly #repository: ConversationRepository;
  readonly #provider: AIProvider;
  readonly #contextManager: ContextManager;
  readonly #logger: Logger;
  readonly #idFactory: () => string;
  readonly #defaultTitle: string;
  readonly #schedule: (task: () => void) => void;
  readonly #memory: ConversationMemory | undefined;
  readonly #active = new Map<string, ActiveGeneration>();

  public constructor(options: ConversationEngineOptions) {
    this.#repository = options.repository;
    this.#provider = options.provider;
    this.#contextManager = options.contextManager;
    this.#logger = options.logger;
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#defaultTitle = options.defaultTitle ?? 'New conversation';
    this.#schedule = options.schedule ?? setImmediate;
    this.#memory = options.memory;
  }

  public create(title = this.#defaultTitle): ConversationDetail {
    return this.#repository.create(title.trim() || this.#defaultTitle);
  }

  public list(): readonly ConversationSummary[] {
    return this.#repository.list();
  }

  public get(conversationId: string): ConversationDetail {
    return this.requireConversation(conversationId);
  }

  public rename(conversationId: string, title: string): ConversationSummary {
    const renamed = this.#repository.rename(conversationId, title.trim());
    if (!renamed) throw this.conversationNotFound(conversationId);
    return renamed;
  }

  public delete(conversationId: string): void {
    for (const [generationId, generation] of this.#active) {
      if (generation.conversationId === conversationId) this.cancel(generationId);
    }
    if (!this.#repository.delete(conversationId)) throw this.conversationNotFound(conversationId);
  }

  public search(query: string): readonly ConversationSummary[] {
    const normalized = query.trim();
    return normalized ? this.#repository.search(normalized) : this.list();
  }

  public send(
    conversationId: string,
    content: string,
    sink: GenerationEventSink,
  ): GenerationStarted {
    const conversation = this.requireConversation(conversationId);
    this.assertConversationIdle(conversationId);
    const userMessage = this.#repository.addMessage({
      conversationId,
      role: 'user',
      content: content.trim(),
      status: 'complete',
    });
    if (conversation.messageCount === 0 && conversation.title === this.#defaultTitle) {
      this.#repository.rename(conversationId, friendlyTitle(content));
    }
    return this.startAfterUser(userMessage, sink);
  }

  public edit(
    conversationId: string,
    messageId: string,
    content: string,
    sink: GenerationEventSink,
  ): GenerationStarted {
    this.requireConversation(conversationId);
    this.assertConversationIdle(conversationId);
    const message = this.#repository.getMessage(messageId);
    if (!message || message.conversationId !== conversationId || message.role !== 'user') {
      throw this.messageNotFound(messageId);
    }
    this.#repository.deleteFromMessage(conversationId, messageId, false);
    const updated = this.#repository.updateMessage(messageId, {
      content: content.trim(),
      status: 'complete',
    });
    if (!updated) throw this.messageNotFound(messageId);
    return this.startAfterUser(updated, sink);
  }

  public regenerate(
    conversationId: string,
    assistantMessageId: string,
    sink: GenerationEventSink,
  ): GenerationStarted {
    const conversation = this.requireConversation(conversationId);
    this.assertConversationIdle(conversationId);
    const index = conversation.messages.findIndex((message) => message.id === assistantMessageId);
    const assistant = conversation.messages[index];
    const user = conversation.messages[index - 1];
    if (!assistant || assistant.role !== 'assistant' || !user || user.role !== 'user') {
      throw this.messageNotFound(assistantMessageId);
    }
    this.#repository.deleteFromMessage(conversationId, assistantMessageId, true);
    return this.startAfterUser(user, sink);
  }

  public cancel(generationId: string): boolean {
    const active = this.#active.get(generationId);
    if (!active) return false;
    active.controller.abort(new DOMException('Generation stopped', 'AbortError'));
    return true;
  }

  public export(conversationId: string, format: 'markdown' | 'json'): ConversationExport {
    const conversation = this.requireConversation(conversationId);
    if (format === 'json') {
      return Object.freeze({
        filename: exportFilename(conversation.title, 'json'),
        mimeType: 'application/json',
        content: JSON.stringify(conversation, null, 2),
      });
    }
    const messages = conversation.messages
      .map((message) => `## ${message.role === 'user' ? 'You' : 'JARVIS'}\n\n${message.content}`)
      .join('\n\n---\n\n');
    return Object.freeze({
      filename: exportFilename(conversation.title, 'md'),
      mimeType: 'text/markdown',
      content: `# ${conversation.title}\n\n${messages}\n`,
    });
  }

  public close(): void {
    for (const generation of this.#active.values()) generation.controller.abort();
    this.#active.clear();
    this.#repository.close();
  }

  private startAfterUser(
    userMessage: ConversationMessage,
    sink: GenerationEventSink,
  ): GenerationStarted {
    const generationId = this.#idFactory();
    const assistantMessage = this.#repository.addMessage({
      conversationId: userMessage.conversationId,
      role: 'assistant',
      content: '',
      status: 'streaming',
    });
    const controller = new AbortController();
    this.#active.set(generationId, { conversationId: userMessage.conversationId, controller });
    this.#schedule(
      () => void this.runGeneration(generationId, userMessage, assistantMessage, controller, sink),
    );
    return Object.freeze({
      generationId,
      conversationId: userMessage.conversationId,
      userMessage,
      assistantMessage,
    });
  }

  private async runGeneration(
    generationId: string,
    userMessage: ConversationMessage,
    assistantMessage: ConversationMessage,
    controller: AbortController,
    sink: GenerationEventSink,
  ): Promise<void> {
    let content = '';
    try {
      const conversation = this.requireConversation(assistantMessage.conversationId);
      const contextMessages = conversation.messages.filter(
        (message) => message.id !== assistantMessage.id && message.status === 'complete',
      );
      const previousSummary = this.#repository.getSummary(conversation.id);
      const context = await this.#contextManager.build(contextMessages, previousSummary);
      if (context.summary !== previousSummary) {
        this.#repository.setSummary(conversation.id, context.summary);
      }

      const session = this.#provider.createSession();
      const recalledMemory = this.#memory?.recall(userMessage.content);
      const stream = session.stream({
        messages: context.messages,
        systemInstruction: recalledMemory
          ? `${context.systemInstruction}\n\n${recalledMemory}`
          : context.systemInstruction,
        signal: controller.signal,
      });
      for await (const chunk of stream) {
        content += chunk.text;
        this.#repository.updateMessage(assistantMessage.id, { content, status: 'streaming' });
        sink({
          type: 'delta',
          generationId,
          conversationId: conversation.id,
          messageId: assistantMessage.id,
          delta: chunk.text,
        });
      }

      const completed = this.#repository.updateMessage(assistantMessage.id, {
        content,
        status: 'complete',
      });
      if (!completed) throw this.messageNotFound(assistantMessage.id);
      sink({ type: 'complete', generationId, conversationId: conversation.id, message: completed });
      void this.#memory?.extract(userMessage.content, conversation.id);
    } catch (error) {
      const publicError = toPublicError(error);
      const cancelled =
        publicError.code === ERROR_CODES.generationCancelled || controller.signal.aborted;
      const failed = this.#repository.updateMessage(assistantMessage.id, {
        content,
        status: cancelled ? 'cancelled' : 'error',
      });
      if (failed) {
        if (cancelled) {
          sink({
            type: 'cancelled',
            generationId,
            conversationId: assistantMessage.conversationId,
            message: failed,
          });
        } else {
          sink({
            type: 'error',
            generationId,
            conversationId: assistantMessage.conversationId,
            message: failed,
            error: { code: publicError.code, message: publicError.message },
          });
        }
      }
      this.#logger.error('Conversation generation failed.', {
        generationId,
        conversationId: assistantMessage.conversationId,
        errorCode: publicError.code,
      });
    } finally {
      this.#active.delete(generationId);
    }
  }

  private requireConversation(conversationId: string): ConversationDetail {
    const conversation = this.#repository.get(conversationId);
    if (!conversation) throw this.conversationNotFound(conversationId);
    return conversation;
  }

  private conversationNotFound(conversationId: string): PlatformError {
    return new PlatformError(ERROR_CODES.conversationNotFound, 'Conversation was not found.', {
      metadata: { conversationId },
    });
  }

  private messageNotFound(messageId: string): PlatformError {
    return new PlatformError(ERROR_CODES.messageNotFound, 'Conversation message was not found.', {
      metadata: { messageId },
    });
  }

  private assertConversationIdle(conversationId: string): void {
    const active = [...this.#active.values()].some(
      (generation) => generation.conversationId === conversationId,
    );
    if (active) {
      throw new PlatformError(
        ERROR_CODES.generationActive,
        'A response is already being generated for this conversation.',
      );
    }
  }
}
