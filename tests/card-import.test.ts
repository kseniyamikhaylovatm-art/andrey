import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCardPairs } from '../server/card-import.js';

test('bulk pairs support dash variants, phrases, bullets, CRLF and internal hyphens', () => {
  const result = parseCardPairs('• la casa — дом\r\n2. el vecino – сосед\n\nhacer la compra - покупать продукты\nhola—привет\nadiós-пока\nel e-mail — электронная почта — адрес\nbien-être — благополучие');
  assert.deepEqual(result.cards.map(({ es, ru }) => [es, ru]), [
    ['la casa','дом'], ['el vecino','сосед'], ['hacer la compra','покупать продукты'],
    ['hola','привет'], ['adiós','пока'], ['el e-mail','электронная почта — адрес'], ['bien-être','благополучие'],
  ]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.cards[2].line, 4);
});

test('malformed rows are reported rather than silently discarded or guessed', () => {
  const result = parseCardPairs('Слова урока\n— только перевод\nsolo —\nbuenos días — доброе утро');
  assert.deepEqual(result.issues.map(i => i.line), [1,2,3]);
  assert.deepEqual(result.cards, [{es:'buenos días',ru:'доброе утро',line:4}]);
});
