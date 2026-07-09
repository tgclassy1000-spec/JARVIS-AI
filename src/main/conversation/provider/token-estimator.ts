import type { AIMessage, TokenEstimator } from './contracts';

export class HeuristicTokenEstimator implements TokenEstimator {
  public estimate(messages: readonly AIMessage[], systemInstruction = ''): Promise<number> {
    const characters = messages.reduce((total, message) => total + message.content.length + 8, 0);
    return Promise.resolve(Math.max(1, Math.ceil((characters + systemInstruction.length) / 4)));
  }
}
