import { randomUUID } from 'node:crypto';
import type { AppState, Card, Tense } from '../src/types.js';
export const id = () => randomUUID();
const examples: [string, string, string, string, string][] = [
  ['el barrio', 'район', 'В городе', 'Me gusta mucho este barrio.', 'Мне очень нравится этот район.'],
  ['hacer la compra', 'покупать продукты', 'Рынок', 'Ayer hice la compra en el mercado.', 'Вчера я купил продукты на рынке.'],
  ['la casera', 'хозяйка квартиры', 'Дом и соседи', 'He hablado con la casera.', 'Я поговорил с хозяйкой квартиры.'],
  ['las olas', 'волны', 'Сёрфинг', 'Hoy las olas son pequeñas.', 'Сегодня волны маленькие.'],
  ['quedar', 'договариваться о встрече', 'Повседневное', '¿Quedamos mañana a las cinco?', 'Встретимся завтра в пять?'],
  ['la cuenta', 'счёт', 'В городе', '¿Nos trae la cuenta, por favor?', 'Принесите нам счёт, пожалуйста.'],
  ['el vecino', 'сосед', 'Дом и соседи', 'Antes hablaba con mi vecino cada día.', 'Раньше я разговаривал с соседом каждый день.'],
  ['alquilar', 'арендовать', 'Дом и соседи', 'Alquilamos un piso cerca del mar.', 'Мы арендуем квартиру недалеко от моря.'],
  ['la tabla', 'доска', 'Сёрфинг', 'Necesito alquilar una tabla de surf.', 'Мне нужно арендовать доску для сёрфинга.'],
  ['¿Cuánto cuesta?', 'сколько стоит?', 'Рынок', '¿Cuánto cuesta un kilo de tomates?', 'Сколько стоит килограмм помидоров?'],
  ['el billete', 'билет', 'Путешествия', 'Compré el billete por internet.', 'Я купил билет через интернет.'],
  ['estar de acuerdo', 'быть согласным', 'Повседневное', 'Estoy de acuerdo contigo.', 'Я с тобой согласен.'],
  ['llegar', 'прибывать', 'Путешествия', 'Llegamos a Madrid el lunes.', 'Мы приехали в Мадрид в понедельник.'],
  ['contar', 'рассказывать', 'Повседневное', 'Mi vecino me contó una historia.', 'Сосед рассказал мне историю.'],
  ['dejar', 'оставлять', 'Дом и соседи', 'He dejado las llaves en casa.', 'Я оставил ключи дома.'],
  ['negociar', 'договариваться об условиях', 'Дом и соседи', 'Podemos negociar el precio.', 'Мы можем обсудить цену.'],
  ['currar', 'работать (разг.)', 'Повседневное', 'Hoy estoy currando en casa.', 'Сегодня я работаю дома.'],
  ['prometer', 'обещать', 'Повседневное', 'Te prometo que voy a practicar.', 'Обещаю тебе, что буду практиковаться.'],
  ['decir', 'говорить, сказать', 'Повседневное', '¿Qué has dicho?', 'Что ты сказал?'],
  ['ver', 'видеть', 'Путешествия', 'Ayer vimos el mar.', 'Вчера мы увидели море.'],
  ['llevo … estudiando', 'я учусь уже …', 'Повседневное', 'Llevo dos meses estudiando español.', 'Я учу испанский уже два месяца.'],
  ['¿Me lo puede repetir?', 'можете мне это повторить?', 'В городе', 'Perdone, ¿me lo puede repetir más despacio?', 'Извините, можете повторить помедленнее?'],
  ['la fianza', 'залог за аренду', 'Дом и соседи', 'Ya hemos pagado la fianza.', 'Мы уже внесли залог.'],
  ['estar a punto de', 'собираться вот-вот что-то сделать', 'Повседневное', 'Estaba a punto de salir.', 'Я как раз собирался уходить.'],
];
export function initialState(): AppState {
  return {
    cards: examples.map(([es,ru,topic,e,r],i) => ({ id:`seed-${i}`, es,ru,topic,type:es.includes('…')?'construction':es.includes(' ')?'chunk':'word', register:es==='currar'?'colloquial':'neutral', enabled:true,focused:false,examples:[{es:e,ru:r}],source:'Стартовая подборка · жизнь в Испании',stage:0,due:new Date(0).toISOString(),seen:0,correct:0 })),
    attempts:[],lessons:[],assignments:[],diary:[],speeches:[],dialogs:[],payments:[],verbTables:{},summary:null,
    audios:[{id:'audio-mercado',title:'На рынке',url:'',transcript:'Buenos días. Quería medio kilo de tomates y un kilo de naranjas. ¿Cuánto cuesta todo? Son cuatro euros con cincuenta. ¿Quiere una bolsa? No, gracias, llevo la mía.',question:'Что покупатель хочет купить? Какая общая сумма и нужна ли ему сумка?',answer:'Полкило помидоров и килограмм апельсинов. Всего 4,50 евро. Сумка не нужна: у него своя.',topic:'Рынок'},
    {id:'audio-casa',title:'Разговор с хозяйкой',url:'',transcript:'Hola, soy tu casera. Ayer vino el fontanero, pero no había nadie en casa. ¿Puedes estar mañana a las diez? Tiene que arreglar el grifo de la cocina. No va a tardar mucho.',question:'Кто приходил вчера и почему вернётся? Во сколько нужно быть дома?',answer:'Сантехник. Нужно починить кран на кухне. Завтра в десять нужно быть дома.',topic:'Дом и соседи'},
    {id:'audio-surf',title:'Первое занятие сёрфингом',url:'',transcript:'La clase empieza a las nueve y media. Primero vamos a practicar en la arena y después entramos en el agua. Hoy las olas son pequeñas. No olvides la crema de sol y una botella de agua.',question:'Когда начинается занятие? Где сначала практикуются и что нужно взять?',answer:'В 9:30. Сначала на песке, затем в воде. Взять солнцезащитный крем и бутылку воды.',topic:'Сёрфинг'}],
    plan:{ level:'A2 · в процессе',goal:'Чувствовать себя дома в Испании',goals:[
      {skill:'Словарный запас',now:'Бытовые темы · уточнить с преподавателем',target:'Уверенно общаться в магазине, с соседями и на сёрфинге'},
      {skill:'Грамматика',now:'A2 неполный',target:'Настоящее и три прошедших времени'},
      {skill:'Диалог',now:'Определим на занятии',target:'Поддерживать бытовой разговор без перехода на другой язык'},
      {skill:'Слух',now:'Определим на занятии',target:'Понимать повседневную речь в Испании'},
    ],criteria:['Объяснить соседу или хозяйке, что случилось','Рассказать, как прошёл день, используя прошедшие времена','Задать вопрос на рынке и понять ответ','Понять основные инструкции на уроке сёрфинга'],topics:['В городе','Дом и соседи','Рынок','Сёрфинг','Путешествия','Повседневное']},
  };
}
export function review(card: Card, correct: boolean, now = new Date()): void {
  card.seen++; if(correct) card.correct++;
  card.stage = correct ? Math.min(card.stage+1,6) : 0;
  card.due = new Date(+now + (correct ? [0,1,2,4,8,16,32][card.stage]*86400000 : 600000)).toISOString();
}
export function paymentBalance(s: AppState) {
  const dates = s.payments.map(p=>p.date).sort();
  const first = dates[0];
  const held = first ? s.lessons.filter(l=>l.status==='held'&&l.date>=first).length : s.lessons.filter(l=>l.status==='held').length;
  return { paid:dates.length*12,used:held,remaining:dates.length*12-held,last:dates.at(-1)||null };
}
export function localSummary(s: AppState) {
  const recent=s.attempts.filter(a=>Date.now()-Date.parse(a.at)<7*86400000);
  const scored=recent.filter(a=>a.correct!==null);
  const wrong=recent.filter(a=>a.correct===false);
  const errors = Object.entries(wrong.reduce<Record<string,number>>((r,a)=>{const k=a.tense||a.topic||'Лексика';r[k]=(r[k]||0)+1;return r;},{})).sort((a,b)=>b[1]-a[1]);
  return `За последние 7 дней: ${recent.length} ответов, ${Math.round(recent.reduce((n,a)=>n+a.seconds,0)/60)} мин практики. ${scored.length?`Точность: ${Math.round(scored.filter(a=>a.correct).length/scored.length*100)}%.`:'Ответов с проверкой пока нет.'}\n\n${errors.length?`Требуют внимания: ${errors.map(([k,v])=>`${k} (${v})`).join(', ')}.`:'Пока недостаточно ошибок для определения трудностей.'}\n\nРечевая практика: ${s.speeches.filter(x=>Date.now()-Date.parse(x.date)<7*86400000).length} работ. Диалогов: ${s.dialogs.filter(x=>Date.now()-Date.parse(x.date)<7*86400000).length}. Записей в дневнике: ${s.diary.filter(x=>Date.now()-Date.parse(x.date)<7*86400000).length}.\n\nНа ближайшем уроке: ${wrong.length?'разобрать ошибки последних тренировок и закрепить их в бытовом диалоге.':'начать с короткого разговора о жизни в Испании и уточнить цели.'}`;
}
export const persons=['yo','tú','él / ella / usted','nosotros / nosotras','vosotros / vosotras','ellos / ellas / ustedes'];
const special: Record<string, Partial<Record<Tense,string[]>> & {part?:string;ger?:string}> = {
  ser:{presente:['soy','eres','es','somos','sois','son'],indefinido:['fui','fuiste','fue','fuimos','fuisteis','fueron'],imperfecto:['era','eras','era','éramos','erais','eran']},
  ir:{presente:['voy','vas','va','vamos','vais','van'],indefinido:['fui','fuiste','fue','fuimos','fuisteis','fueron'],imperfecto:['iba','ibas','iba','íbamos','ibais','iban'],ger:'yendo'},
  estar:{presente:['estoy','estás','está','estamos','estáis','están'],indefinido:['estuve','estuviste','estuvo','estuvimos','estuvisteis','estuvieron']},
  tener:{presente:['tengo','tienes','tiene','tenemos','tenéis','tienen'],indefinido:['tuve','tuviste','tuvo','tuvimos','tuvisteis','tuvieron']},
  hacer:{presente:['hago','haces','hace','hacemos','hacéis','hacen'],indefinido:['hice','hiciste','hizo','hicimos','hicisteis','hicieron'],part:'hecho'},
  decir:{presente:['digo','dices','dice','decimos','decís','dicen'],indefinido:['dije','dijiste','dijo','dijimos','dijisteis','dijeron'],part:'dicho',ger:'diciendo'},
  ver:{presente:['veo','ves','ve','vemos','veis','ven'],indefinido:['vi','viste','vio','vimos','visteis','vieron'],imperfecto:['veía','veías','veía','veíamos','veíais','veían'],part:'visto'},
  contar:{presente:['cuento','cuentas','cuenta','contamos','contáis','cuentan']},
  llegar:{indefinido:['llegué','llegaste','llegó','llegamos','llegasteis','llegaron']},
};
export const knownVerbs=['hablar','contar','prometer','escaparse','negociar','currar','dejar','llegar','ver','decir','alquilar','quedar','ser','estar','ir','tener','hacer'];
export function conjugate(verb:string,tense:Tense):string[]|null {
  if(!knownVerbs.includes(verb)) return null;
  const reflexive=verb.endsWith('se'); const base=reflexive?verb.slice(0,-2):verb;
  const stem=base.slice(0,-2),group=base.slice(-2),sp=special[base];
  let result:string[];
  const ger=sp?.ger||stem+(group==='ar'?'ando':'iendo');
  if(tense.startsWith('gerundio_')) {
    const aux=tense==='gerundio_presente'?['estoy','estás','está','estamos','estáis','están']:tense==='gerundio_imperfecto'?['estaba','estabas','estaba','estábamos','estabais','estaban']:tense==='gerundio_indefinido'?['estuve','estuviste','estuvo','estuvimos','estuvisteis','estuvieron']:['he estado','has estado','ha estado','hemos estado','habéis estado','han estado'];
    result=aux.map(x=>x+' '+ger);
  } else if(sp?.[tense]) result=sp[tense]!;
  else if(tense==='perfecto') result=['he','has','ha','hemos','habéis','han'].map(x=>x+' '+(sp?.part||stem+(group==='ar'?'ado':'ido')));
  else { const endings=tense==='presente'?(group==='ar'?['o','as','a','amos','áis','an']:group==='er'?['o','es','e','emos','éis','en']:['o','es','e','imos','ís','en']):tense==='indefinido'?(group==='ar'?['é','aste','ó','amos','asteis','aron']:['í','iste','ió','imos','isteis','ieron']):(group==='ar'?['aba','abas','aba','ábamos','abais','aban']:['ía','ías','ía','íamos','íais','ían']); result=endings.map(e=>stem+e); }
  return reflexive?result.map((r,i)=>['me','te','se','nos','os','se'][i]+' '+r):result;
}
