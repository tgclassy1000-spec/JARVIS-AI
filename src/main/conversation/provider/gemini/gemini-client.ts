import { GoogleGenAI, type Content } from '@google/genai';

import type { AIMessage } from '../contracts';

export interface GeminiStreamChunk {
  readonly text?: string;
}

export interface GeminiGenerateRequest {
  readonly model: string;
  readonly messages: readonly AIMessage[];
  readonly systemInstruction?: string;
  readonly signal: AbortSignal;
}

export interface GeminiCountRequest {
  readonly model: string;
  readonly messages: readonly AIMessage[];
  readonly systemInstruction?: string;
  readonly signal?: AbortSignal;
}

export interface GeminiClient {
  generateContentStream(request: GeminiGenerateRequest): Promise<AsyncIterable<GeminiStreamChunk>>;
  countTokens(request: GeminiCountRequest): Promise<number>;
}

function toGeminiContents(messages: readonly AIMessage[]): Content[] {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
}

export class GoogleGeminiClient implements GeminiClient {
  readonly #client: GoogleGenAI;

  public constructor(apiKey: string) {
    this.#client = new GoogleGenAI({ apiKey });
  }

  public generateContentStream(
    request: GeminiGenerateRequest,
  ): Promise<AsyncIterable<GeminiStreamChunk>> {
    return this.#client.models.generateContentStream({
      model: request.model,
      contents: toGeminiContents(request.messages),
      config: {
        abortSignal: request.signal,
        ...(request.systemInstruction ? { systemInstruction: request.systemInstruction } : {}),
      },
    });
  }

  public async countTokens(request: GeminiCountRequest): Promise<number> {
    const response = await this.#client.models.countTokens({
      model: request.model,
      contents: toGeminiContents(request.messages),
      config: {
        ...(request.signal ? { abortSignal: request.signal } : {}),
      },
    });
    return response.totalTokens ?? 0;
  }
}
