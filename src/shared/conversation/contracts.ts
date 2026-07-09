export type MessageRole = 'user' | 'assistant';
export type MessageStatus = 'complete' | 'streaming' | 'error' | 'cancelled';

export interface ConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly status: MessageStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ConversationSummary {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messageCount: number;
  readonly preview: string;
}

export interface ConversationDetail extends ConversationSummary {
  readonly messages: readonly ConversationMessage[];
}

export interface GenerationStarted {
  readonly generationId: string;
  readonly conversationId: string;
  readonly userMessage: ConversationMessage;
  readonly assistantMessage: ConversationMessage;
}

export type GenerationEvent =
  | {
      readonly type: 'delta';
      readonly generationId: string;
      readonly conversationId: string;
      readonly messageId: string;
      readonly delta: string;
    }
  | {
      readonly type: 'complete' | 'cancelled';
      readonly generationId: string;
      readonly conversationId: string;
      readonly message: ConversationMessage;
    }
  | {
      readonly type: 'error';
      readonly generationId: string;
      readonly conversationId: string;
      readonly message: ConversationMessage;
      readonly error: { readonly code: string; readonly message: string };
    };

export interface ConversationExport {
  readonly filename: string;
  readonly mimeType: 'text/markdown' | 'application/json';
  readonly content: string;
}

export interface CreateConversationRequest {
  readonly title?: string;
}

export interface ConversationIdRequest {
  readonly conversationId: string;
}

export interface RenameConversationRequest extends ConversationIdRequest {
  readonly title: string;
}

export interface SearchConversationsRequest {
  readonly query: string;
}

export interface SendMessageRequest extends ConversationIdRequest {
  readonly content: string;
}

export interface EditMessageRequest extends ConversationIdRequest {
  readonly messageId: string;
  readonly content: string;
}

export interface RegenerateMessageRequest extends ConversationIdRequest {
  readonly assistantMessageId: string;
}

export interface CancelGenerationRequest {
  readonly generationId: string;
}

export interface ExportConversationRequest extends ConversationIdRequest {
  readonly format: 'markdown' | 'json';
}
