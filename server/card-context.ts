import {conjugate,knownVerbs} from './domain.js';
import {exampleTense} from '../src/example-tenses.js';
import {exampleTenseNames,type AppState,type Card,type CardContextData,type ExampleTense} from '../src/types.js';

const tenses=Object.keys(exampleTenseNames) as ExampleTense[];
type Six=[string,string,string,string,string,string];
interface Frame {verb:string;tail:string;ru:Six}
const frames:Record<string,Frame>={
  hablar:{verb:'hablar',tail:'con mi vecino',ru:['Сегодня я разговариваю с соседом.','Завтра я собираюсь поговорить с соседом.','Сейчас я разговариваю с соседом.','Сегодня я уже поговорил с соседом.','Вчера я поговорил с соседом.','Раньше я разговаривал с соседом.']},
  contar:{verb:'contar',tail:'una historia de mi viaje',ru:['Сегодня я рассказываю историю о своей поездке.','Завтра я собираюсь рассказать историю о своей поездке.','Сейчас я рассказываю историю о своей поездке.','Сегодня я уже рассказал историю о своей поездке.','Вчера я рассказал историю о своей поездке.','Раньше я рассказывал историю о своей поездке.']},
  prometer:{verb:'prometer',tail:'practicar español cada día',ru:['Сегодня я обещаю практиковать испанский каждый день.','Завтра я собираюсь пообещать практиковать испанский каждый день.','Сейчас я обещаю практиковать испанский каждый день.','Сегодня я пообещал практиковать испанский каждый день.','Вчера я пообещал практиковать испанский каждый день.','Раньше я обещал практиковать испанский каждый день.']},
  escaparse:{verb:'escaparse',tail:'del ruido de la ciudad',ru:['Сегодня я сбегаю от городского шума.','Завтра я собираюсь сбежать от городского шума.','Сейчас я сбегаю от городского шума.','Сегодня я уже сбежал от городского шума.','Вчера я сбежал от городского шума.','Раньше я сбегал от городского шума.']},
  negociar:{verb:'negociar',tail:'el precio del alquiler',ru:['Сегодня я обсуждаю цену аренды.','Завтра я собираюсь обсудить цену аренды.','Сейчас я обсуждаю цену аренды.','Сегодня я уже обсудил цену аренды.','Вчера я обсудил цену аренды.','Раньше я обсуждал цену аренды.']},
  currar:{verb:'currar',tail:'en casa',ru:['Сегодня я работаю дома.','Завтра я собираюсь работать дома.','Сейчас я работаю дома.','Сегодня я уже поработал дома.','Вчера я работал дома.','Раньше я работал дома.']},
  dejar:{verb:'dejar',tail:'las llaves en la mesa',ru:['Сегодня я оставляю ключи на столе.','Завтра я собираюсь оставить ключи на столе.','Сейчас я оставляю ключи на столе.','Сегодня я уже оставил ключи на столе.','Вчера я оставил ключи на столе.','Раньше я оставлял ключи на столе.']},
  llegar:{verb:'llegar',tail:'a la playa',ru:['Сегодня я приезжаю на пляж.','Завтра я собираюсь приехать на пляж.','Сейчас я прибываю на пляж.','Сегодня я уже приехал на пляж.','Вчера я приехал на пляж.','Раньше я приезжал на пляж.']},
  ver:{verb:'ver',tail:'el mar desde el balcón',ru:['Сегодня я вижу море с балкона.','Завтра я собираюсь посмотреть на море с балкона.','Сейчас я смотрю на море с балкона.','Сегодня я уже посмотрел на море с балкона.','Вчера я увидел море с балкона.','Раньше я видел море с балкона.']},
  decir:{verb:'decir',tail:'la verdad',ru:['Сегодня я говорю правду.','Завтра я собираюсь сказать правду.','Сейчас я говорю правду.','Сегодня я уже сказал правду.','Вчера я сказал правду.','Раньше я говорил правду.']},
  alquilar:{verb:'alquilar',tail:'una tabla de surf',ru:['Сегодня я беру напрокат доску для сёрфинга.','Завтра я собираюсь взять напрокат доску для сёрфинга.','Сейчас я беру напрокат доску для сёрфинга.','Сегодня я уже взял напрокат доску для сёрфинга.','Вчера я взял напрокат доску для сёрфинга.','Раньше я брал напрокат доску для сёрфинга.']},
  quedar:{verb:'quedar',tail:'con mi amigo',ru:['Сегодня я договариваюсь о встрече с другом.','Завтра я собираюсь договориться о встрече с другом.','Сейчас я договариваюсь о встрече с другом.','Сегодня я уже договорился о встрече с другом.','Вчера я договорился о встрече с другом.','Раньше я договаривался о встрече с другом.']},
  hacer:{verb:'hacer',tail:'la compra en el mercado',ru:['Сегодня я покупаю продукты на рынке.','Завтра я собираюсь купить продукты на рынке.','Сейчас я покупаю продукты на рынке.','Сегодня я уже купил продукты на рынке.','Вчера я купил продукты на рынке.','Раньше я покупал продукты на рынке.']},
  ir:{verb:'ir',tail:'a clase de surf',ru:['Сегодня я иду на занятие сёрфингом.','Завтра я собираюсь пойти на занятие сёрфингом.','Сейчас я иду на занятие сёрфингом.','Сегодня я уже сходил на занятие сёрфингом.','Вчера я сходил на занятие сёрфингом.','Раньше я ходил на занятие сёрфингом.']},
  tener:{verb:'tener',tail:'problemas con el coche',ru:['Сегодня у меня проблемы с машиной.','Завтра у меня будут проблемы с машиной.','Сейчас у меня возникают проблемы с машиной.','Сегодня у меня уже были проблемы с машиной.','Вчера у меня были проблемы с машиной.','Раньше у меня бывали проблемы с машиной.']},
  ser:{verb:'ser',tail:'más paciente con mi vecino',ru:['Сегодня я терпеливее к своему соседу.','Завтра я собираюсь быть терпеливее к своему соседу.','Сейчас я проявляю больше терпения к своему соседу.','Сегодня я уже проявил больше терпения к своему соседу.','Вчера я был терпеливее к своему соседу.','Раньше я был терпеливее к своему соседу.']},
  actuar:{verb:'actuar',tail:'con calma',ru:['Сегодня я действую спокойно.','Завтра я собираюсь действовать спокойно.','Сейчас я действую спокойно.','Сегодня я уже действовал спокойно.','Вчера я действовал спокойно.','Раньше я действовал спокойно.']},
  remar:{verb:'remar',tail:'hacia la playa',ru:['Сегодня я гребу к пляжу.','Завтра я собираюсь грести к пляжу.','Сейчас я гребу к пляжу.','Сегодня я уже грёб к пляжу.','Вчера я грёб к пляжу.','Раньше я грёб к пляжу.']},
};
const nounFrames:Record<string,Frame>={
  'el barrio':{verb:'pasear',tail:'por el barrio',ru:['Сегодня я гуляю по району.','Завтра я собираюсь погулять по району.','Сейчас я гуляю по району.','Сегодня я уже погулял по району.','Вчера я гулял по району.','Раньше я гулял по району.']},
  'la casera':{...frames.hablar,tail:'con la casera',ru:['Сегодня я разговариваю с хозяйкой квартиры.','Завтра я собираюсь поговорить с хозяйкой квартиры.','Сейчас я разговариваю с хозяйкой квартиры.','Сегодня я уже поговорил с хозяйкой квартиры.','Вчера я поговорил с хозяйкой квартиры.','Раньше я разговаривал с хозяйкой квартиры.']},
  'el vecino':frames.hablar,
  'las olas':{verb:'ver',tail:'las olas desde la playa',ru:['Сегодня я вижу волны с пляжа.','Завтра я собираюсь посмотреть на волны с пляжа.','Сейчас я смотрю на волны с пляжа.','Сегодня я уже посмотрел на волны с пляжа.','Вчера я видел волны с пляжа.','Раньше я видел волны с пляжа.']},
  'la cuenta':{verb:'revisar',tail:'la cuenta del restaurante',ru:['Сегодня я проверяю счёт в ресторане.','Завтра я собираюсь проверить счёт в ресторане.','Сейчас я проверяю счёт в ресторане.','Сегодня я уже проверил счёт в ресторане.','Вчера я проверил счёт в ресторане.','Раньше я проверял счёт в ресторане.']},
  'la tabla':{...frames.alquilar},
  'el billete':{verb:'comprar',tail:'el billete de tren',ru:['Сегодня я покупаю билет на поезд.','Завтра я собираюсь купить билет на поезд.','Сейчас я покупаю билет на поезд.','Сегодня я уже купил билет на поезд.','Вчера я купил билет на поезд.','Раньше я покупал билет на поезд.']},
  'la fianza':{verb:'negociar',tail:'el importe de la fianza',ru:['Сегодня я обсуждаю сумму залога.','Завтра я собираюсь обсудить сумму залога.','Сейчас я обсуждаю сумму залога.','Сегодня я уже обсудил сумму залога.','Вчера я обсудил сумму залога.','Раньше я обсуждал сумму залога.']},
  'la casa':{verb:'revisar',tail:'la casa antes de alquilarla',ru:['Сегодня я осматриваю дом, прежде чем его арендовать.','Завтра я собираюсь осмотреть дом, прежде чем его арендовать.','Сейчас я осматриваю дом, прежде чем его арендовать.','Сегодня я уже осмотрел дом, прежде чем его арендовать.','Вчера я осмотрел дом, прежде чем его арендовать.','Раньше я осматривал дом, прежде чем его арендовать.']},
};
const fixed:Record<string,{es:Six;ru:Six;verb?:string;suffix?:string}>={
  estar:{verb:'estar',es:['Hoy estoy en casa.','Mañana voy a estar en casa.','Ahora estoy en casa y estoy preparando la cena.','Hoy he estado en casa.','Ayer estuve en casa.','Antes estaba en casa por las tardes.'],ru:['Сегодня я дома.','Завтра я собираюсь быть дома.','Сейчас я дома и готовлю ужин.','Сегодня я уже был дома.','Вчера я был дома.','Раньше по вечерам я был дома.']},
  'estar de acuerdo':{verb:'estar',suffix:'de acuerdo',es:['Estoy de acuerdo con mi vecino.','Voy a estar de acuerdo si el precio es justo.','Estoy hablando con mi vecino y estamos de acuerdo.','Hoy he estado de acuerdo con mi vecino.','Ayer estuve de acuerdo con mi vecino.','Antes estaba de acuerdo con mi vecino.'],ru:['Я согласен со своим соседом.','Я соглашусь, если цена будет справедливой.','Я сейчас разговариваю с соседом, и мы согласны друг с другом.','Сегодня я был согласен со своим соседом.','Вчера я был согласен со своим соседом.','Раньше я был согласен со своим соседом.']},
  'estar a punto de':{verb:'estar',suffix:'a punto de salir',es:['Estoy a punto de salir de casa.','Mañana a las ocho voy a estar a punto de salir de casa.','Estoy preparando la mochila porque estoy a punto de salir.','Hoy he estado a punto de perder el autobús.','Ayer estuve a punto de perder el autobús.','Estaba a punto de salir cuando sonó el teléfono.'],ru:['Я вот-вот выйду из дома.','Завтра в восемь я буду уже собираться выйти из дома.','Я сейчас собираю рюкзак, потому что вот-вот выйду.','Сегодня я чуть не опоздал на автобус.','Вчера я чуть не опоздал на автобус.','Я как раз собирался выходить, когда зазвонил телефон.']},
  '¿cuánto cuesta?':{es:['En el mercado pregunto: «¿Cuánto cuesta?».','En el mercado voy a preguntar: «¿Cuánto cuesta?».','Estoy preguntando cuánto cuesta un kilo de tomates.','Hoy he preguntado cuánto cuesta un kilo de tomates.','Ayer pregunté cuánto costaba un kilo de tomates.','Antes preguntaba cuánto costaban las naranjas.'],ru:['На рынке я спрашиваю: «Сколько стоит?».','На рынке я собираюсь спросить: «Сколько стоит?».','Я сейчас спрашиваю, сколько стоит килограмм помидоров.','Сегодня я уже спросил, сколько стоит килограмм помидоров.','Вчера я спросил, сколько стоил килограмм помидоров.','Раньше я спрашивал, сколько стоили апельсины.']},
  '¿me lo puede repetir?':{es:['En clase digo: «¿Me lo puede repetir?».','Si no entiendo, voy a decir: «¿Me lo puede repetir?».','Estoy diciendo: «¿Me lo puede repetir?».','Hoy he dicho: «¿Me lo puede repetir?».','Ayer dije: «¿Me lo puede repetir?».','Antes decía: «¿Me lo puede repetir?».'],ru:['На занятии я говорю: «Можете мне это повторить?».','Если не пойму, собираюсь сказать: «Можете мне это повторить?».','Я сейчас говорю: «Можете мне это повторить?».','Сегодня я уже сказал: «Можете мне это повторить?».','Вчера я сказал: «Можете мне это повторить?».','Раньше я говорил: «Можете мне это повторить?».']},
  'llevo … estudiando':{es:['Llevo dos meses estudiando español.','Voy a seguir estudiando español: ya llevo dos meses.','Estoy estudiando español; llevo dos meses con el curso.','Hoy he estudiado español; llevo dos meses con el curso.','Ayer estudié español; ya llevaba dos meses con el curso.','Llevaba dos meses estudiando español cuando conocí a mi vecino.'],ru:['Я учу испанский уже два месяца.','Собираюсь продолжать учить испанский: я занимаюсь уже два месяца.','Сейчас я учу испанский; курсом занимаюсь два месяца.','Сегодня я позанимался испанским; курсом занимаюсь два месяца.','Вчера я занимался испанским; к тому моменту я занимался уже два месяца.','Я учил испанский уже два месяца, когда познакомился с соседом.']},
};
const key=(value:string)=>value.normalize('NFC').toLocaleLowerCase('es').trim().replace(/\s+/g,' ');
const own=<T>(map:Record<string,T>,term:string):T|undefined=>Object.hasOwn(map,term)?map[term]:undefined;

export function cardContext(card:Card,tables:AppState['verbTables']={}):CardContextData {
  const term=key(card.es), phrase=term==='hacer la compra';
  const frame=own(frames,term)||own(nounFrames,term)||(phrase?frames.hacer:undefined)||Object.values(nounFrames).find(f=>f.verb===term);
  const preset=own(fixed,term);
  const verb=preset?.verb||(phrase?'hacer':knownVerbs.includes(term)||Object.hasOwn(tables,term)?term:null);
  const suffix=preset?.suffix||(phrase?'la compra':null);
  const forms:CardContextData['forms']={};
  const formNotes:CardContextData['formNotes']={};
  if(verb)for(const tense of tenses){
    if(verb==='estar'&&tense==='gerundio_presente'){
      formNotes[tense]='Здесь estar помогает образовать действие «прямо сейчас»: estoy preparando. Для состояния «быть» не используем искусственное estoy estando.';
      continue;
    }
    const table=tables[verb]?.[tense]||conjugate(verb,tense);
    if(table)forms[tense]=suffix?table.map(form=>form+' '+suffix):table;
  }
  const examples:CardContextData['examples']=[];
  tenses.forEach((tense,i)=>{
    const saved=card.examples.filter(e=>exampleTense(e.tense)===tense);
    if(saved.length){examples.push(...saved.map(e=>({...e,tense,origin:'card' as const})));return;}
    if(preset){examples.push({es:preset.es[i],ru:preset.ru[i],tense,origin:'library'});return;}
    if(!frame)return;
    const form=(tables[frame.verb]?.[tense]||conjugate(frame.verb,tense))?.[0];
    if(!form)return;
    const cue=['Hoy','Mañana','Ahora','Hoy','Ayer','Antes'][i];
    examples.push({es:`${cue} ${form} ${frame.tail}.`,ru:frame.ru[i],tense,origin:'library'});
  });
  return {verb,forms,formNotes,examples,originalExamples:card.examples.filter(e=>!exampleTense(e.tense))};
}
