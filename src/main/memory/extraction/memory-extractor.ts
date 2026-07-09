import { z } from 'zod';

import type { SaveMemoryRequest } from '../../../shared/memory/contracts';
import type { AIProvider } from '../../conversation/provider/contracts';

const durableSignal =
  /\b(my name is|call me|i prefer|i like|i dislike|i always|i usually|i work|my goal|my project|remember that|remind me|i speak|my writing|i use|favorite|favourite)\b/i;
const temporarySignal = /\b(for now|right now|today only|this time|temporarily|in this chat)\b/i;

const candidateSchema = z.object({
  kind: z.enum(['user-profile', 'preference', 'fact', 'conversation', 'semantic']),
  content: z.string().trim().min(3).max(2_000),
  summary: z.string().trim().min(3).max(300),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
});
const responseSchema = z.object({ memories: z.array(candidateSchema).max(5) });

export interface MemoryExtractor {
  extract(text: string, conversationId: string): Promise<readonly SaveMemoryRequest[]>;
}

function extractionPrompt(text: string): string {
  return `Extract only durable personal memory explicitly stated by the user.
Allowed: name, stable preferences, frequently used software, work habits, languages, writing style, goals, long-term projects, important reminders.
Never infer. Never save temporary conversation, questions, assistant content, secrets, credentials, medical or financial data.
Return JSON only: {"memories":[{"kind":"preference","content":"...","summary":"...","tags":["..."]}]}
User text:\n${text}`;
}

export class GeminiMemoryExtractor implements MemoryExtractor {
  public constructor(private readonly provider: () => AIProvider) {}

  public async extract(
    text: string,
    conversationId: string,
  ): Promise<readonly SaveMemoryRequest[]> {
    if (!durableSignal.test(text) || temporarySignal.test(text)) return Object.freeze([]);
    const response = this.provider()
      .createSession()
      .stream({
        messages: [{ role: 'user', content: extractionPrompt(text) }],
        systemInstruction:
          'You are a conservative personal-memory classifier. Output valid JSON only.',
      });
    let content = '';
    for await (const chunk of response) content += chunk.text;
    const json = content.replace(/^```json\s*|\s*```$/g, '');
    let decoded: unknown;
    try {
      decoded = JSON.parse(json) as unknown;
    } catch {
      return Object.freeze([]);
    }
    const parsed = responseSchema.safeParse(decoded);
    if (!parsed.success) return Object.freeze([]);
    return Object.freeze(
      parsed.data.memories.map((memory) => ({
        ...memory,
        kind: memory.kind,
        sourceConversationId: conversationId,
      })),
    );
  }
}
