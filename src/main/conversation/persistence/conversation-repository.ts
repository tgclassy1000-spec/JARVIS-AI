import type {
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
  MessageRole,
  MessageStatus,
} from '../../../shared/conversation/contracts';

export interface NewMessage {
  readonly conversationId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly status: MessageStatus;
}

export interface ConversationRepository {
  create(title: string): ConversationDetail;
  list(): readonly ConversationSummary[];
  get(conversationId: string): ConversationDetail | undefined;
  rename(conversationId: string, title: string): ConversationSummary | undefined;
  delete(conversationId: string): boolean;
  search(query: string): readonly ConversationSummary[];
  addMessage(message: NewMessage): ConversationMessage;
  getMessage(messageId: string): ConversationMessage | undefined;
  updateMessage(
    messageId: string,
    changes: { readonly content?: string; readonly status?: MessageStatus },
  ): ConversationMessage | undefined;
  deleteFromMessage(conversationId: string, messageId: string, inclusive: boolean): void;
  setSummary(conversationId: string, summary: string | undefined): void;
  getSummary(conversationId: string): string | undefined;
  close(): void;
}
