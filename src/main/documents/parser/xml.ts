export function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function stripXml(value: string): string {
  return decodeXml(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function textNodes(xml: string): readonly string[] {
  const matches = [...xml.matchAll(/<(?:[^:>]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[^:>]+:)?t>/g)];
  return Object.freeze(matches.map((match) => decodeXml(match[1]!).trim()).filter(Boolean));
}
