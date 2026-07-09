import { extname } from 'node:path';

import type { DocumentFormat } from '../../../shared/documents/contracts';

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const FORMAT_MIME: Readonly<Record<DocumentFormat, string>> = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  markdown: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
});

const EXTENSION_FORMATS: Readonly<Record<string, DocumentFormat>> = Object.freeze({
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.xlsx': 'xlsx',
  '.pptx': 'pptx',
  '.txt': 'txt',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.csv': 'csv',
  '.json': 'json',
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpeg',
  '.webp': 'webp',
});

export function formatFromPath(filePath: string): DocumentFormat | undefined {
  return EXTENSION_FORMATS[extname(filePath).toLowerCase()];
}

export function isImageFormat(format: DocumentFormat): boolean {
  return format === 'png' || format === 'jpg' || format === 'jpeg' || format === 'webp';
}
