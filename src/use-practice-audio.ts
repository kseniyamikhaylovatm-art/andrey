import {useCallback,useEffect,useRef,useState} from 'react';
import {speak} from './api';
import {FeedbackPlayer} from './practice-audio';

interface Preferences { autoSpeak: boolean; feedback: boolean }
const storageKey = 'mi:practice-audio';
function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    return { autoSpeak: typeof saved?.autoSpeak === 'boolean' ? saved.autoSpeak : true, feedback: typeof saved?.feedback === 'boolean' ? saved.feedback : true };
  } catch { return {autoSpeak:true,feedback:true}; }
}

export function usePracticeAudio(notify:(message:string)=>void) {
  const [preferences,setPreferences] = useState(readPreferences);
  const latest = useRef(preferences), callback = useRef(notify), player = useRef<FeedbackPlayer|null>(null), warned = useRef(new Set<string>());
  latest.current = preferences; callback.current = notify;
  const warn = useCallback((message:string) => { if (!warned.current.has(message)) { warned.current.add(message); callback.current(message); } }, []);
  const cancelSpeech = useCallback(() => { try { window.speechSynthesis?.cancel(); } catch { /* browser is closing */ } }, []);
  const unlock = useCallback(() => {
    if (!latest.current.feedback) return;
    player.current ??= new FeedbackPlayer(() => warn('Браузер не смог включить звуки ответов. Текстовая проверка работает.'));
    player.current.unlock();
  }, [warn]);
  const say = useCallback((word:string) => {
    try { speak(word,false,warn); } catch (error) { warn((error as Error).message); }
  }, [warn]);
  const startWord = useCallback((word:string) => {
    player.current?.stop(); cancelSpeech(); unlock();
    if (latest.current.autoSpeak) say(word);
  }, [cancelSpeech,unlock,say]);
  const prepareAnswer = useCallback(() => { cancelSpeech(); unlock(); }, [cancelSpeech,unlock]);
  const answer = useCallback((correct:boolean) => { if (latest.current.feedback) player.current?.play(correct); }, []);
  const stop = useCallback(() => { cancelSpeech(); player.current?.stop(); }, [cancelSpeech]);
  const save = useCallback((value:Preferences) => {
    latest.current = value; setPreferences(value);
    try { localStorage.setItem(storageKey,JSON.stringify(value)); } catch { /* usable without browser storage */ }
  }, []);
  const setAutoSpeak = useCallback((enabled:boolean,word?:string) => {
    save({...latest.current,autoSpeak:enabled});
    if (!enabled) cancelSpeech(); else if (word) say(word);
  }, [save,cancelSpeech,say]);
  const setFeedback = useCallback((enabled:boolean) => {
    save({...latest.current,feedback:enabled});
    if (enabled) unlock(); else player.current?.stop();
  }, [save,unlock]);
  useEffect(() => () => { cancelSpeech(); player.current?.close(); player.current=null; }, [cancelSpeech]);
  return {preferences,startWord,prepareAnswer,answer,stop,setAutoSpeak,setFeedback};
}
