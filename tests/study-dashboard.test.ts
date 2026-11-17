import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../server/domain.js';
import {practiceStreak,studyStats,madridDay} from '../src/study-stats.js';
import {readRoute,routeHash} from '../src/navigation.js';
import type {Attempt} from '../src/types.js';
const attempt=(at:string):Attempt=>({id:at,at,kind:'card',seconds:30,correct:true});

test('the daily dashboard uses genuine exclusive card counts and excludes disabled cards from practice queues',()=>{
  const s=initialState(),now=new Date('2026-11-17T12:00:00Z');
  s.cards=s.cards.slice(0,5);
  Object.assign(s.cards[0],{seen:5,correct:4,stage:4});
  Object.assign(s.cards[1],{seen:3,correct:2,stage:1});
  Object.assign(s.cards[2],{seen:1,correct:1,stage:1,due:'2026-11-19T12:00:00Z'});
  s.cards[4].enabled=false;
  s.attempts=[attempt('2026-11-17T11:00:00Z'),attempt('2026-11-16T11:00:00Z'),attempt('2026-10-01T11:00:00Z'),attempt('2026-11-18T11:00:00Z')];
  const stats=studyStats(s,now);
  assert.deepEqual(stats.groups,{learned:1,learning:1,difficult:1,new:2});
  assert.equal(Object.values(stats.groups).reduce((n,v)=>n+v,0),s.cards.length);
  assert.equal(stats.due,2);assert.equal(stats.fresh,1);assert.equal(stats.week.length,2);assert.equal(stats.minutes,1);
});
test('streaks follow Madrid calendar days, including midnight and yesterday before today has practice',()=>{
  const items=[attempt('2026-11-16T23:30:00Z'),attempt('2026-11-16T12:00:00Z'),attempt('2026-11-15T12:00:00Z')];
  assert.equal(madridDay(items[0].at),'2026-11-17');
  assert.equal(practiceStreak(items,new Date('2026-11-17T12:00:00Z')),3);
  assert.equal(practiceStreak(items,new Date('2026-11-18T12:00:00Z')),3);
  assert.equal(practiceStreak(items,new Date('2026-11-19T12:00:00Z')),0);
  assert.equal(practiceStreak([],new Date('2026-11-17T12:00:00Z')),0);
});
test('study shortcuts preserve the target mode and encode course topics safely',()=>{
  const hash=routeHash('cards',{view:'train',mode:'all',topic:'Дом и соседи'});
  const route=readRoute(hash);assert.equal(route.tab,'cards');assert.equal(route.params.get('topic'),'Дом и соседи');assert.equal(route.params.get('mode'),'all');
  assert.equal(readRoute('#speech?mode=retell').params.get('mode'),'retell');
  assert.equal(readRoute('#unknown').tab,'plan');assert.equal(readRoute('').tab,'plan');
});
