import type { DocumentFormat } from '../../../shared/documents/contracts';
import { ERROR_CODES } from '../../../shared/platform/errors';
import { PlatformError } from '../../platform/errors/platform-error';
import type { DocumentParser, ParsedDocument } from './contracts';
import { ImageDocumentParser } from './image-parser';
import { OoxmlDocumentParser } from './ooxml-parser';
import { PdfDocumentParser } from './pdf-parser';
import { TextDocumentParser } from './text-parser';

export class DocumentParserRegistry {
  readonly #parsers: readonly DocumentParser[];

  public constructor(parsers: readonly DocumentParser[] = defaultDocumentParsers()) {
    this.#parsers = Object.freeze([...parsers]);
  }

  public parse(input: {
    readonly buffer: Uint8Array;
    readonly fileName: string;
    readonly format: DocumentFormat;
  }): ParsedDocument {
    const parser = this.#parsers.find((candidate) => candidate.formats.includes(input.format));
    if (!parser) {
      throw new PlatformError(
        ERROR_CODES.documentUnsupported,
        'Document format is not supported.',
        {
          metadata: { format: input.format },
        },
      );
    }
    return parser.parse(input);
  }
}

export function defaultDocumentParsers(): readonly DocumentParser[] {
  return Object.freeze([
    new TextDocumentParser(),
    new PdfDocumentParser(),
    new OoxmlDocumentParser(),
    new ImageDocumentParser(),
  ]);
}
