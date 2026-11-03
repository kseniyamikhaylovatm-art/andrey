export interface CardPair { es: string; ru: string; line: number }
export interface ImportIssue { line: number; text: string; reason: string }

/** Split only a pair separator; keep hyphens inside words and translations. */
export function parseCardPairs(text: string) {
  const cards: CardPair[] = [];
  const issues: ImportIssue[] = [];
  const lines = text.normalize('NFC').replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((raw, index) => {
    const value = raw.trim().replace(/^(?:[•●▪*]\s*|\d+[.)]\s+)/u, '').trim();
    if (!value) return;
    const separator = /\s+[-–—]\s*|\s*[-–—]\s+|[–—]|(?<=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])-(?=[А-Яа-яЁё])/u.exec(value);
    const es = separator ? value.slice(0, separator.index).trim() : '';
    const ru = separator ? value.slice(separator.index + separator[0].length).trim() : '';
    if (!separator || !es || !ru) {
      issues.push({ line: index + 1, text: raw, reason: 'Нужна строка «слово — перевод» с обеими частями.' });
    } else if (es.length > 4000 || ru.length > 4000) {
      issues.push({ line: index + 1, text: raw, reason: 'Слово или перевод длиннее 4000 символов.' });
    } else {
      cards.push({ es, ru, line: index + 1 });
    }
  });
  return { cards, issues };
}
