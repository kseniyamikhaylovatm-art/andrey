import { useRef, useState } from 'react';
import { Check, FileText, Upload, X } from 'lucide-react';
import { api } from './api';
import { useApp } from './context';
import { Badge, Button, Field, Modal } from './ui';

interface Pair { es: string; ru: string; line: number }
interface Preview { cards: Pair[]; issues: { line: number; text: string; reason: string }[] }

export function CardImportModal({ close }: { close: () => void }) {
  const { state, refresh, notify } = useApp();
  const [text, setText] = useState('');
  const [source, setSource] = useState('Список карточек');
  const [topic, setTopic] = useState('Повседневное');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{added:number;duplicates:number} | null>(null);
  const requestVersion = useRef(0);
  const current = useRef({ source, topic });
  current.current = { source, topic };

  async function parse(value: string) {
    const version = ++requestVersion.current;
    setBusy(true); setError(''); setDone(null);
    try {
      const result = await api<Preview>('/import/cards/preview', { text: value });
      if (version === requestVersion.current) setPreview(result);
    } catch (e) {
      if (version === requestVersion.current) setError((e as Error).message);
    } finally { if (version === requestVersion.current) setBusy(false); }
  }
  async function upload(file: File) {
    if (file.size > 15 * 1024 * 1024) { setError('Файл больше 15 МБ. Разделите PDF на части.'); return; }
    setBusy(true); setError(''); setDone(null); setPreview(null);
    try {
      const response = await fetch('/api/import/pdf', { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSource(file.name); setText(result.text);
      if (result.text.length > 200000) throw new Error('В файле слишком много текста. Разделите PDF или оставьте в поле часть списка до 200 000 символов.');
      await parse(result.text);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const invalid = preview?.cards.some(c => !c.es.trim() || !c.ru.trim() || c.es.length > 4000 || c.ru.length > 4000);
  return <Modal title="Загрузить PDF карточек" close={close} wide>
    <div className="form">
      <div className="notice"><FileText size={20}/><span>Все карточки из одного файла. Каждая строка: <strong>испанское слово — русский перевод</strong>. Работает без ИИ.</span></div>
      <label className="upload-area">
        <Upload size={30}/><strong>{busy ? 'Читаем список…' : 'Выберите PDF карточек'}</strong>
        <span>Текстовый PDF · до 15 МБ · до 1000 карточек за один раз</span>
        <input aria-label="Выберите PDF карточек" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }}/>
      </label>
      <div className="form-row">
        <Field label="Источник или название списка"><input value={source} disabled={busy} onChange={e => setSource(e.target.value)} required maxLength={4000}/></Field>
        <Field label="Тема для всех карточек"><input value={topic} disabled={busy} onChange={e => setTopic(e.target.value)} required maxLength={4000} list="card-import-topics"/><datalist id="card-import-topics">{state.plan.topics.map(t => <option key={t} value={t}/>)}</datalist></Field>
      </div>
      <Field label="Список карточек · можно вставить текст или исправить строки из PDF">
        <textarea rows={6} value={text} disabled={busy} maxLength={200000} placeholder={'la casa — дом\nel vecino — сосед\nhacer la compra — покупать продукты'} onChange={e => { setText(e.target.value); setPreview(null); setDone(null); setError(''); }}/>
      </Field>
      <Button secondary disabled={busy || !text.trim() || text.length > 200000} onClick={() => void parse(text)}>{busy ? 'Разбираем…' : 'Проверить список'}</Button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {preview && <>
        <div className="section-heading"><h3>Проверьте карточки</h3><Badge gold>{preview.cards.length} карточек</Badge></div>
        {preview.issues.length > 0 && <div className="form-error"><strong>Не удалось разобрать строк: {preview.issues.length}.</strong><p>Исправьте их в списке выше и нажмите «Проверить список». Или добавьте только карточки ниже.</p><details><summary>Показать строки</summary>{preview.issues.map(i => <p className="small" key={i.line}>Строка {i.line}: {i.text}<br/>{i.reason}</p>)}</details></div>}
        <div className="import-cards">
          {preview.cards.map((pair, i) => <div className="import-card" key={i}>
            <div className="section-heading"><small>Строка {pair.line}</small><button className="icon-btn" aria-label={'Не добавлять карточку ' + (i + 1)} disabled={busy} onClick={() => setPreview({ ...preview, cards: preview.cards.filter((_, j) => i !== j) })}><X size={17}/></button></div>
            <div className="form-row">
              <Field label={'Испанский · карточка ' + (i + 1)}><input lang="es" value={pair.es} disabled={busy} maxLength={4000} onChange={e => setPreview({ ...preview, cards: preview.cards.map((c, j) => i === j ? { ...c, es: e.target.value } : c) })}/></Field>
              <Field label={'Перевод · карточка ' + (i + 1)}><input value={pair.ru} disabled={busy} maxLength={4000} onChange={e => setPreview({ ...preview, cards: preview.cards.map((c, j) => i === j ? { ...c, ru: e.target.value } : c) })}/></Field>
            </div>
          </div>)}
        </div>
        {!preview.cards.length && <p className="muted">Не найдены пары «слово — перевод». Проверьте разделители и переносы строк.</p>}
        <small className="muted">Повторы пропускаем. Существующие карточки, переводы и прогресс не заменяем. При загрузке фото или скана потребуется распознавание текста.</small>
        <Button disabled={busy || !preview.cards.length || invalid || !source.trim() || !topic.trim()} onClick={async () => {
          setBusy(true); setError('');
          try {
            const result = await api<{added:number;duplicates:number}>('/import/cards/confirm', { cards: preview.cards.map(({es,ru}) => ({es,ru})), ...current.current });
            setDone(result); setPreview(null); setText('');
            notify(`Добавлено карточек: ${result.added}. Повторов пропущено: ${result.duplicates}.`);
            try { await refresh(); } catch { setError('Карточки добавлены. Обновите страницу, чтобы увидеть их в базе.'); }
          } catch (e) { setError((e as Error).message); }
          finally { setBusy(false); }
        }}><Check size={17}/>{busy ? 'Сохраняем…' : 'Добавить все карточки'}</Button>
      </>}
      {done && <div className="notice" role="status"><Check size={20}/><span>Готово! Добавлено: <strong>{done.added}</strong>. Повторов пропущено: <strong>{done.duplicates}</strong>. Карточки доступны в «Автоматизация → База фраз».</span></div>}
    </div>
  </Modal>;
}
