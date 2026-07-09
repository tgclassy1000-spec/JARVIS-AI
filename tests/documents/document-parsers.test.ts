// @vitest-environment node

import { strToU8, zipSync } from 'fflate';

import { DocumentParserRegistry } from '../../src/main/documents/parser/document-parser-registry';

function zip(entries: Readonly<Record<string, string>>): Uint8Array {
  const encoded: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(entries)) encoded[name] = strToU8(content);
  return zipSync(encoded);
}

describe('document parsers', () => {
  const registry = new DocumentParserRegistry();

  it('parses text, markdown tables, CSV tables and JSON', () => {
    const markdown = registry.parse({
      fileName: 'brief.md',
      format: 'markdown',
      buffer: strToU8('# Brief\n\n| Name | Due |\n| --- | --- |\n| Alex | 2026-01-01 |'),
    });
    expect(markdown.text).toContain('Brief');
    expect(markdown.tables[0]?.rows).toEqual([
      ['Name', 'Due'],
      ['Alex', '2026-01-01'],
    ]);
    const csv = registry.parse({
      fileName: 'data.csv',
      format: 'csv',
      buffer: strToU8('name,email\nAlex,alex@example.com'),
    });
    expect(csv.tables[0]?.rows).toEqual([
      ['name', 'email'],
      ['Alex', 'alex@example.com'],
    ]);
    const json = registry.parse({
      fileName: 'data.json',
      format: 'json',
      buffer: strToU8('{"meeting":"launch","owner":"Tony Stark"}'),
    });
    expect(json.text).toContain('"meeting": "launch"');
  });

  it('extracts simple PDF text and detects scanned PDFs', () => {
    const pdf = registry.parse({
      fileName: 'brief.pdf',
      format: 'pdf',
      buffer: strToU8('%PDF-1.4 /Type /Page BT (Hello PDF document with enough text) Tj ET'),
    });
    expect(pdf.text).toContain('Hello PDF document');
    expect(pdf.needsOcr).toBe(false);
    const scanned = registry.parse({
      fileName: 'scan.pdf',
      format: 'pdf',
      buffer: strToU8('%PDF-1.4 /Type /Page /XObject /Image'),
    });
    expect(scanned.needsOcr).toBe(true);
  });

  it('parses DOCX, XLSX and PPTX Open XML packages', () => {
    const docx = registry.parse({
      fileName: 'brief.docx',
      format: 'docx',
      buffer: zip({
        'word/document.xml':
          '<w:document><w:body><w:p><w:r><w:t>Hello DOCX</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>',
      }),
    });
    expect(docx.text).toContain('Hello DOCX');
    expect(docx.tables[0]?.rows[0]).toEqual(['A', 'B']);

    const xlsx = registry.parse({
      fileName: 'sheet.xlsx',
      format: 'xlsx',
      buffer: zip({
        'xl/sharedStrings.xml': '<sst><si><t>Name</t></si><si><t>Pepper</t></si></sst>',
        'xl/worksheets/sheet1.xml':
          '<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row></sheetData></worksheet>',
      }),
    });
    expect(xlsx.text).toContain('Name | Pepper');
    expect(xlsx.tables[0]?.rows[0]).toEqual(['Name', 'Pepper']);

    const pptx = registry.parse({
      fileName: 'deck.pptx',
      format: 'pptx',
      buffer: zip({
        'ppt/slides/slide1.xml': '<p:sld><a:t>Launch Review</a:t></p:sld>',
      }),
    });
    expect(pptx.text).toContain('Slide 1: Launch Review');
  });

  it('routes images to OCR and rejects unsupported parser registries', () => {
    const image = registry.parse({
      fileName: 'scan.png',
      format: 'png',
      buffer: new Uint8Array([1, 2, 3]),
    });
    expect(image.needsOcr).toBe(true);
    expect(() =>
      new DocumentParserRegistry([]).parse({
        fileName: 'bad.bin',
        format: 'pdf',
        buffer: new Uint8Array(),
      }),
    ).toThrow('Document format is not supported.');
  });
});
