const SYNONYMS: Readonly<Record<string, string>> = Object.freeze({
  coding: 'programming',
  code: 'programming',
  dev: 'programming',
  javascript: 'typescript',
  js: 'typescript',
  editor: 'ide',
  vscode: 'ide',
  colour: 'color',
  favourite: 'favorite',
  prefers: 'prefer',
  likes: 'prefer',
});

function terms(text: string): readonly string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((term) => term.length > 1)
    .map((term) => SYNONYMS[term] ?? term);
}

export function semanticVector(text: string): Readonly<Record<string, number>> {
  const vector: Record<string, number> = {};
  for (const term of terms(text)) vector[term] = (vector[term] ?? 0) + 1;
  return Object.freeze(vector);
}

export function cosineSimilarity(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const value of Object.values(left)) leftNorm += value * value;
  for (const value of Object.values(right)) rightNorm += value * value;
  for (const [term, value] of Object.entries(left)) dot += value * (right[term] ?? 0);
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}
