export interface AIMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface ChatRequest {
  readonly messages: readonly AIMessage[];
  readonly systemInstruction?: string;
  readonly signal?: AbortSignal;
}

export interface StreamChunk {
  readonly text: string;
}

export interface StreamResponse extends AsyncIterable<StreamChunk> {
  cancel(): void;
}

export interface TokenEstimator {
  estimate(messages: readonly AIMessage[], systemInstruction?: string): Promise<number>;
}

export interface ChatSession {
  stream(request: ChatRequest): StreamResponse;
}

export interface AIProvider {
  readonly id: string;
  readonly model: string;
  readonly tokenEstimator: TokenEstimator;
  createSession(): ChatSession;
}
