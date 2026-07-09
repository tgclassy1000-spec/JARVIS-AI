import type { ConversationMessage } from '../../../shared/conversation/contracts';
import type { AIMessage, TokenEstimator } from '../provider/contracts';

export interface SummarizationHook {
  summarize(
    trimmedMessages: readonly AIMessage[],
    previousSummary?: string,
  ): Promise<string | undefined>;
}

export interface ContextWindow {
  readonly messages: readonly AIMessage[];
  readonly systemInstruction: string;
  readonly summary?: string;
  readonly trimmedMessageIds: readonly string[];
  readonly estimatedTokens: number;
}

export class ContextBuilder {
  public constructor(private readonly baseInstruction: string) {}

  public build(summary?: string): string {
    if (!summary) return this.baseInstruction;
    return `${this.baseInstruction}\n\nConversation summary:\n${summary}`;
  }
}

export class ContextManager {
  public constructor(
    private readonly estimator: TokenEstimator,
    private readonly tokenBudget: number,
    private readonly builder: ContextBuilder,
    private readonly summarizer?: SummarizationHook,
  ) {}

  public async build(
    messages: readonly ConversationMessage[],
    previousSummary?: string,
  ): Promise<ContextWindow> {
    const selected = messages.map<AIMessage>((message) => ({
      role: message.role,
      content: message.content,
    }));
    const trimmed: ConversationMessage[] = [];
    let systemInstruction = this.builder.build(previousSummary);
    let estimatedTokens = await this.estimator.estimate(selected, systemInstruction);

    while (selected.length > 1 && estimatedTokens > this.tokenBudget) {
      selected.shift();
      const removed = messages[trimmed.length];
      if (removed) trimmed.push(removed);
      estimatedTokens = await this.estimator.estimate(selected, systemInstruction);
    }

    let summary = previousSummary;
    if (trimmed.length > 0 && this.summarizer) {
      summary = await this.summarizer.summarize(
        trimmed.map((message) => ({ role: message.role, content: message.content })),
        previousSummary,
      );
      systemInstruction = this.builder.build(summary);
      estimatedTokens = await this.estimator.estimate(selected, systemInstruction);
    }

    return Object.freeze({
      messages: Object.freeze(selected),
      systemInstruction,
      ...(summary ? { summary } : {}),
      trimmedMessageIds: Object.freeze(trimmed.map((message) => message.id)),
      estimatedTokens,
    });
  }
}
