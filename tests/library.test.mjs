import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterQuestions,sampleQuestions,scoreQuiz,validateBackup,restoreQuiz,safeFilename,pageSlices} from '../lib.mjs';
const questions=[
 {id:'a',topic:'Cells',type:'MC',publisher:'Aristo',text:'Cell membrane',answer:'B'},
 {id:'b',topic:'Cells',type:'SQ',publisher:'Oxford',text:'Diffusion',answer:''},
 {id:'c',topic:'Plants',type:'MC',publisher:'Aristo',text:'Photosynthesis',answer:'D'},
];
test('filters combine topic, type, keywords, bookmarks, collections and personal categories',()=>{
 const overrides={a:{topic:'Revision',type:'LQ',tags:'difficult'}};
 assert.deepEqual(filterQuestions(questions,{search:'membrane difficult',topic:'Revision',type:'LQ',publisher:'Aristo',savedOnly:true,bookmarks:['a'],collectionIds:['a'],overrides}).map(q=>q.id),['a']);
 assert.equal(filterQuestions(questions,{collectionIds:[]}).length,0);
 assert.equal(filterQuestions(questions,{topic:'Cells',type:'MC'}).length,1);
 assert.equal(filterQuestions(questions,{search:'cell plants'}).length,0);
});
test('quiz sampling is unique, bounded and does not mutate the pool',()=>{
 const before=[...questions];
 const result=sampleQuestions(questions,99,()=>0.25);
 assert.equal(new Set(result).size,3);
 assert.deepEqual(questions,before);
 assert.equal(sampleQuestions(questions,-1).length,0);
 assert.equal(sampleQuestions(questions,1).length,1);
});
test('only keyed MC items are graded and written responses count as answered',()=>{
 assert.deepEqual(scoreQuiz(questions,{a:'B',b:'explanation',c:'A'}),{correct:1,total:2,answered:3,count:3,percent:50});
 assert.equal(scoreQuiz([questions[1]],{b:'  '}).percent,null);
 assert.equal(scoreQuiz([questions[1]],{b:'  '}).answered,0);
});
test('backup import rejects invalid data and removes unknown question IDs',()=>{
 assert.throws(()=>validateBackup({},['a']));
 const result=validateBackup({version:1,bookmarks:['a','bad','a'],collections:[{id:'one',name:' Cells ',ids:['b','bad']}],overrides:{a:{topic:'Revision',type:'invalid',tags:'tag'},bad:{topic:'bad'}},history:[]},['a','b']);
 assert.deepEqual(result.bookmarks,['a']);
 assert.deepEqual(result.collections[0],{id:'one',name:'Cells',ids:['b']});
 assert.equal(result.overrides.a.type,'');
 assert.equal(result.overrides.bad,undefined);
});
test('restored quiz rejects missing IDs and clamps corrupt progress',()=>{
 assert.equal(restoreQuiz({ids:['bad'],responses:{}},['a']),null);
 const result=restoreQuiz({ids:['a','a'],responses:{a:'B',bad:'C'},current:900,deadline:'invalid',finished:'yes'},['a']);
 assert.deepEqual(result.ids,['a']);
 assert.equal(result.current,0);
 assert.equal(result.deadline,null);
 assert.equal(result.finished,false);
 assert.deepEqual(result.responses,{a:'B'});
});
test('filenames and multipage crops stay within supported bounds',()=>{
 assert.equal(safeFilename('../Test:paper?. '),'..Testpaper');
 assert.equal(safeFilename('  '),'biology-question-bank');
 const slices=pageSlices({page:0,y:700},{page:1,y:150},[{width:595,height:842},{width:595,height:842}]);
 assert.equal(slices.length,2);
 assert.equal(slices[1].page,2);
 assert.ok(slices.every(s=>s.height>0 && s.y>=45 && s.x+s.width<=595));
});
test('published bank has unique questions, valid crops and existing GitHub-sized sources',()=>{
 const bank=JSON.parse(fs.readFileSync(new URL('../bank/index.json',import.meta.url)));
 const sources=new Map(bank.sources.map(s=>[s.id,s]));
 assert.equal(new Set(bank.questions.map(q=>q.id)).size,bank.questions.length);
 assert.ok(bank.questions.length>0);
 for(const source of sources.values()) {
  assert.match(source.path,/^bank\/sources\/[a-f0-9]{16}\.pdf$/);
  assert.ok(fs.statSync(new URL('../'+source.path,import.meta.url)).size<100*1024*1024,source.name);
  assert.equal(source.questionCount,bank.questions.filter(q=>q.sourceId===source.id).length);
 }
 for(const q of bank.questions) {
  assert.ok(sources.has(q.sourceId),q.id);
  assert.ok(q.segments.length,q.id);
  if(q.type==='MC')assert.match(q.answer,/^[A-D]$/,q.id);
  for(const s of [...q.segments,...q.answerSegments]) {
   assert.ok([s.x,s.y,s.width,s.height,s.page].every(Number.isFinite),q.id);
   assert.ok(s.width>0 && s.height>0 && s.x>=0 && s.y>=0 && s.page>0 && s.page<=sources.get(q.sourceId).pages,q.id);
  }
 }
});
test('dependent MC items retain shared passages from earlier pages',()=>{
 const bank=JSON.parse(fs.readFileSync(new URL('../bank/index.json',import.meta.url)));
 const dependent=bank.questions.find(q=>q.code==='BCEMA0010000044');
 assert.ok(dependent,'Known shared-passage fixture exists');
 assert.match(dependent.text,/Peter wants to study competition/);
 assert.ok(dependent.segments.length>=2);
 assert.ok(dependent.segments[0].page<dependent.segments.at(-1).page);
});
