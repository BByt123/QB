import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CHAPTERS,canonicalTopic,topicLabel,topicOrder} from '../taxonomy.mjs';
import {parseOxfordQuestions} from '../scripts/oxford-questions.mjs';
test('root-published subject paths have GitHub Pages fallback entrypoints',()=>{
 for(const [folder,target] of [['biology','biology-index.html'],['economics','economics.html']]){
  const entry=fs.readFileSync(new URL(`../${folder}/index.html`,import.meta.url),'utf8');
  assert.match(entry,/http-equiv="refresh"/);
  assert.match(entry,new RegExp(`\\.\\./${target}`),folder);
 }
 const economics=fs.readFileSync(new URL('../economics.html',import.meta.url),'utf8');
 assert.match(economics,/src="economics-app\.mjs"/);
 assert.doesNotMatch(economics,/src="app\.mjs"/);
});
test('Oxford chapter order matches source headings and keeps custom topics',()=>{
 assert.equal(CHAPTERS.length,34);
 assert.deepEqual(CHAPTERS.map(c=>c.id),[...Array.from({length:30},(_,i)=>`Ch${i+1}`),'E1','E2','E3','E4']);
 assert.match(canonicalTopic('Chapter 04 · Movement across membranes'),/^Ch3 · /);
 assert.match(canonicalTopic('Chapter 28 · Inheritance'),/^Ch25 · /);
 assert.match(canonicalTopic('Chapter 32 · Temperature regulation'),/^E1 · /);
 assert.equal(canonicalTopic('My revision'),'My revision');
 assert.match(topicLabel(CHAPTERS[0].topic,'zh'),/^Ch1 · 生物/);
 assert.ok(topicOrder(CHAPTERS[8].topic)<topicOrder(CHAPTERS[9].topic));
});
test('Oxford catalog contains every unique source and all core and elective chapters',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('../bank/oxford/catalog.json',import.meta.url)));
 const manifest=JSON.parse(fs.readFileSync(new URL('../bank/oxford/conversion-manifest.json',import.meta.url)));
 assert.equal(catalog.sources.length,46);
 assert.equal(new Set(catalog.sources.map(s=>s.id)).size,46);
 assert.equal(Object.keys(manifest.converted).length,47);
 assert.ok(Object.values(manifest.converted).every(entry=>/^[a-f0-9]{64}$/.test(entry.sourceHash) && /^[a-f0-9]{64}$/.test(entry.docxHash)));
 assert.equal(catalog.sources.filter(s=>s.wordEdition==='original').length,5);
 assert.equal(catalog.sources.filter(s=>s.wordEdition==='text').length,41);
 const indexed=JSON.parse(fs.readFileSync(new URL('../'+catalog.quizPath,import.meta.url))).questions;
 for(const chapter of CHAPTERS)assert.ok(catalog.sources.some(s=>s.topic===chapter.topic),chapter.id);
 for(const source of catalog.sources){
  const preview=fs.readFileSync(new URL('../'+source.textPath,import.meta.url),'utf8');
  assert.ok(preview.length>1000,source.name);
  assert.equal(JSON.parse(fs.readFileSync(new URL('../'+source.path,import.meta.url))).textPath,source.textPath);
  assert.equal(source.questionCount,indexed.filter(q=>q.sourceId===source.id).length);
  assert.ok(fs.existsSync(new URL('../'+source.downloadPath,import.meta.url)),source.name);
  assert.match(source.downloadPath,/\.docx$/);
  assert.match(source.downloadName,/\.docx$/);
  assert.match(source.name,/\.docx$/);
  assert.ok(source.original.endsWith('.docx'));
  const conversion=manifest.converted[source.original];
  assert.equal(source.wordEdition,conversion?'text':'original');
  const illustratedBook=catalog.sources.find(book=>book.wordEdition==='original' && book.topics?.includes(source.topic));
  assert.equal(source.illustratedDocumentId,illustratedBook?.id);
  if(conversion)assert.equal(source.id,`oxford-${conversion.sourceHash.slice(0,16)}`);
  assert.equal(fs.readFileSync(new URL('../'+source.downloadPath,import.meta.url)).subarray(0,2).toString(),'PK');
 }
 assert.equal(catalog.sources.filter(source=>source.illustratedDocumentId).length,29);
});
test('Oxford quiz index has keyed, separate questions with valid chapters and no missing-figure references',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('../bank/oxford/catalog.json',import.meta.url)));
 const {questions}=JSON.parse(fs.readFileSync(new URL('../'+catalog.quizPath,import.meta.url)));
 assert.ok(questions.length>1000);
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 assert.equal(new Set(questions.map(q=>q.code)).size,questions.length);
 for(const q of questions){
  assert.equal(q.publisher,'Oxford');assert.ok(catalog.sources.some(s=>s.id===q.sourceId));
  assert.ok(CHAPTERS.some(c=>c.topic===q.topic));assert.equal(q.preview,'text');
  assert.ok(q.text.length>35);assert.deepEqual(q.segments,[]);
  assert.doesNotMatch(q.text,/\b(?:diagrams?|graphs?|charts?|photographs?|photomicrographs?|labelled|above|below)\b/i);
  assert.doesNotMatch(q.text,/-- answer --|\[\d{8}\]/);
  if(q.type==='MC'){assert.match(q.answer,/^[A-D]$/);assert.doesNotMatch(q.text,/(?:^|\n)\s*[A-D]\s*$/);}
  else assert.ok(q.answerText.length>0);
 }
});
test('Oxford parser excludes missing figures and entire shared groups, and separates answers',()=>{
 const input='Chapter 1 Introducing biology\nMultiple-choice questions\n[10000001]\nDirections: The following two questions refer to an experiment.\nA\tone\nB\ttwo\nC\tthree\nD\tfour\nA\n-----\n[10000002]\nWhich option follows that experiment?\nA\tone\nB\ttwo\nC\tthree\nD\tfour\nA\n[10000003]\nWhich of the following describes a living organism?\nA\tIt can reproduce.\nB\tIt is always green.\nC\tIt cannot grow.\nD\tIt contains no cells.\nA\n[10000004]\nThe equation below represents a reaction. What is X?\nA\tone\nB\ttwo\nC\tthree\nD\tfour\nB\nShort questions\n[10000005]\nDescribe the steps involved in a scientific investigation.\n-- answer --\nObserve, hypothesize and test.\n';
 const items=parseOxfordQuestions(input,{id:'oxford-test',topic:CHAPTERS[0].topic});
 assert.deepEqual(items.map(q=>q.code),['10000003','10000005']);
 assert.equal(items[0].answer,'A');assert.doesNotMatch(items[0].text,/\nA$/);
 assert.equal(items[1].answerText,'Observe, hypothesize and test.');
});
