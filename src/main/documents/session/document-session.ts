import type {
  DocumentAnalysisAction,
  DocumentAnalysisRequest,
  DocumentDetail,
} from '../../../shared/documents/contracts';

const ACTION_INSTRUCTIONS: Readonly<Record<DocumentAnalysisAction, string>> = Object.freeze({
  summarize: 'Summarize the document concisely with the most important points.',
  explain: 'Explain the document in plain language.',
  translate: 'Translate the document into the requested target language.',
  question: 'Answer the user question using only the document context.',
  'action-items': 'Extract concrete action items with owners or due dates when present.',
  'key-points': 'Extract the key points as bullets.',
  tables: 'Extract and describe tables from the document.',
  dates: 'Extract dates and explain their context.',
  names: 'Extract names and explain their context.',
  emails: 'Extract email addresses and explain their context.',
  'phone-numbers': 'Extract phone numbers and explain their context.',
  'meeting-summary': 'Create a meeting summary with decisions and next steps.',
  report: 'Create a structured report from the document.',
});

export class DocumentSession {
  public constructor(private readonly document: DocumentDetail) {}

  public prompt(request: DocumentAnalysisRequest): string {
    const chunks = this.document.chunks.map((chunk) => chunk.content).join('\n\n---\n\n');
    const tableText = this.document.tables
      .map((table) => table.rows.map((row) => row.join(' | ')).join('\n'))
      .join('\n\n');
    return [
      `Document: ${this.document.title}`,
      `Format: ${this.document.format}`,
      ACTION_INSTRUCTIONS[request.action],
      request.question ? `Question: ${request.question}` : '',
      request.targetLanguage ? `Target language: ${request.targetLanguage}` : '',
      tableText ? `Tables:\n${tableText}` : '',
      `Content:\n${chunks || this.document.preview}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
}
