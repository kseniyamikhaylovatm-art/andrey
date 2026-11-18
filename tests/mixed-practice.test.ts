import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,review} from '../server/domain.js';
import {MixedPracticeSessions,mixedTasks,type MixedRecord} from '../server/mixed-practice.js';
import {choiceCorrect} from '../src/practice-choices.js';
const selection={mode:'all' as const,includeVerbs:false};
test('one session alternates recall and both translation directions and respects the selected lesson and due words',()=>{
 const state=initialState();const tasks=mixedTasks(state,selection);assert.equal(tasks.length,10);assert.deepEqual(tasks.slice(0,3).map(task=>task.kind==='choice'?task.direction:task.kind),['recall','es-ru','ru-es']);
 state.lessons.push({id:'only',date:'2026-11-18',title:'Выбранный урок',note:'',status:'planned',cardIds:state.cards.slice(0,3).map(card=>card.id)});assert.equal(mixedTasks(state,{...selection,lessonId:'only'}).length,3);assert.ok(mixedTasks(state,{...selection,lessonId:'only'}).every(task=>state.lessons[0].cardIds!.includes(task.cardId)));
 state.cards[0].seen=1;state.cards[0].due=new Date(0).toISOString();assert.equal(mixedTasks(state,{...selection,mode:'review'}).length,1);assert.throws(()=>mixedTasks(state,{...selection,lessonId:'other'}));
 const small=initialState();small.cards=small.cards.slice(0,1);assert.equal(mixedTasks(small,selection)[0].kind,'recall');
});
test('a wrong choice can be corrected but remains due in 10 minutes, repeat requests and next are idempotent',()=>{
 const state=initialState(),sessions=new MixedPracticeSessions(),effects:string[]=[];let step=sessions.start('pupil',state,selection);
 const record=(effect:MixedRecord)=>{effects.push(effect.id);if(effect.updateSchedule)review(state.cards.find(card=>card.id===effect.cardId)!,effect.correct);};
 step=sessions.answer('pupil',step.id,0,{correct:true},state,record);assert.equal(step.answered,true);assert.equal(step.correctFirst,1);step=sessions.next('pupil',step.id,0);assert.equal(step.index,1);assert.equal(sessions.next('pupil',step.id,0).index,1);
 const task=step.task!,target=state.cards.find(card=>card.id===task.cardId)!,wrong=task.optionIds!.map(id=>state.cards.find(card=>card.id===id)!).find(card=>!choiceCorrect(target,card,task.direction!))!;
 step=sessions.answer('pupil',step.id,1,{answerCardId:wrong.id},state,record);assert.equal(step.answered,false);assert.deepEqual(step.wrongIds,[wrong.id]);assert.equal(target.stage,0);const due=target.due;
 assert.throws(()=>sessions.next('pupil',step.id,1));const count=effects.length;assert.equal(sessions.answer('pupil',step.id,1,{answerCardId:wrong.id},state,record).feedback?.duplicate,true);assert.equal(effects.length,count);
 step=sessions.answer('pupil',step.id,1,{answerCardId:target.id},state,record);assert.equal(step.answered,true);assert.equal(step.correctFirst,1);assert.equal(target.stage,0);assert.equal(target.seen,1);assert.equal(target.due,due);
 assert.throws(()=>sessions.answer('other-pupil',step.id,1,{answerCardId:target.id},state,record));
 assert.throws(()=>sessions.answer('pupil',step.id,1,{answerCardId:'not-a-choice'},state,record));
});
test('saved conjugations are an optional final step and do not increment card SRS a second time',()=>{
 const state=initialState();state.cards=state.cards.filter(card=>card.es==='contar');state.verbTables.contar={presente:['cuento','cuentas','cuenta','contamos','contáis','cuentan']};
 const sessions=new MixedPracticeSessions();let step=sessions.start('pupil',state,{...selection,includeVerbs:true});assert.equal(step.total,2);
 const seen:string[]=[];step=sessions.answer('pupil',step.id,0,{correct:true},state,effect=>{if(effect.updateSchedule)review(state.cards[0],effect.correct);seen.push(effect.kind);});step=sessions.next('pupil',step.id,0);assert.equal(step.task?.kind,'verb');assert.equal(step.task?.forms?.[0],'cuento');const stage=state.cards[0].stage;
 step=sessions.answer('pupil',step.id,1,{correct:false},state,effect=>{assert.equal(effect.updateSchedule,false);seen.push(effect.kind);});assert.equal(state.cards[0].stage,stage);assert.deepEqual(seen,['card','verb']);assert.equal(sessions.next('pupil',step.id,1).task,null);
 assert.equal(mixedTasks(state,{...selection,includeVerbs:false}).length,1);
});
