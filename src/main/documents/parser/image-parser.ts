import { basename } from 'node:path';

import type { DocumentFormat } from '../../../shared/documents/contracts';
import type { DocumentParser, ParsedDocument } from './contracts';

export class ImageDocumentParser implements DocumentParser {
  public readonly formats: readonly DocumentFormat[] = ['png', 'jpg', 'jpeg', 'webp'];

  public parse(input: {
    readonly buffer: Uint8Array;
    readonly fileName: string;
    readonly format: DocumentFormat;
  }): ParsedDocument {
    return Object.freeze({
      title: basename(input.fileName),
      format: input.format,
      text: '',
      tables: Object.freeze([]),
      needsOcr: true,
    });
  }
}
