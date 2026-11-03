import { AppError } from './ai.js';

export async function extractPdf(data: Buffer) {
  if (data.subarray(0, 4).toString() !== '%PDF') {
    throw new AppError(400, 'Выберите PDF-файл до 15 МБ.');
  }
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let pdf;
  try {
    pdf = await getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
    if (pdf.numPages > 150) throw new AppError(400, 'В файле больше 150 страниц. Загрузите его частями.');
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let line = '', previousY: number | undefined;
      const flush = () => { if (line.trim()) lines.push(line.trim()); line = ''; };
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform[5];
        if (previousY !== undefined && Math.abs(y - previousY) > 2) flush();
        if (item.str.trim()) line += (line && !/\s$/.test(line) ? ' ' : '') + item.str;
        previousY = y;
        if (item.hasEOL) flush();
      }
      flush();
      pages.push(lines.join('\n'));
    }
    const text = pages.join('\n\n');
    if (!text.trim()) throw new AppError(422, 'В PDF не найден текст. Для скана сначала нужно распознавание текста. Можно вставить список слов вручную.');
    return { pages, text };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(422, 'Не удалось прочитать PDF. Проверьте, что файл открывается и не защищён паролем. Можно вставить список слов вручную.');
  } finally {
    await pdf?.destroy();
  }
}
