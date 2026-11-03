import {exampleTenseNames, type ExampleTense} from './types';

/** Accept existing lesson labels as well as the stable IDs saved by the editor. */
export function exampleTense(value?:string):ExampleTense|null {
  if(!value)return null;
  if(Object.hasOwn(exampleTenseNames,value))return value as ExampleTense;
  const name=value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
  const aliases: Record<string,ExampleTense>={
    'presente':'presente','presente de indicativo':'presente','настоящее':'presente',
    'futuro proximo':'futuro_proximo','ir a + infinitivo':'futuro_proximo','ir + a + infinitivo':'futuro_proximo',
    'gerundio':'gerundio_presente','presente continuo':'gerundio_presente','presente progresivo':'gerundio_presente','estar + gerundio':'gerundio_presente','estoy + gerundio':'gerundio_presente','estoy hablando':'gerundio_presente',
    'preterito perfecto':'perfecto','preterito perfecto compuesto':'perfecto','perfecto':'perfecto',
    'preterito indefinido':'indefinido','preterito perfecto simple':'indefinido','indefinido':'indefinido',
    'preterito imperfecto':'imperfecto','imperfecto':'imperfecto',
  };
  return Object.hasOwn(aliases,name)?aliases[name]:null;
}
