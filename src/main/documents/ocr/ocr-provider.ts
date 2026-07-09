import type { DocumentFormat } from '../../../shared/documents/contracts';
import type { OcrProvider } from '../parser/contracts';

export class UnavailableOcrProvider implements OcrProvider {
  public extractText(input: {
    readonly buffer: Uint8Array;
    readonly fileName: string;
    readonly format: DocumentFormat;
  }): Promise<string> {
    void input;
    return Promise.resolve('');
  }
}
