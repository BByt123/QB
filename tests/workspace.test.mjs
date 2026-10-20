import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CHAPTERS,canonicalTopic,topicLabel,topicOrder} from '../taxonomy.mjs';
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
 assert.equal(catalog.sources.length,46);
 assert.equal(new Set(catalog.sources.map(s=>s.id)).size,46);
 assert.equal(catalog.sources.filter(s=>s.name.endsWith('.docx')).length,5);
 for(const chapter of CHAPTERS)assert.ok(catalog.sources.some(s=>s.topic===chapter.topic),chapter.id);
 for(const source of catalog.sources){
  const preview=fs.readFileSync(new URL('../'+source.textPath,import.meta.url),'utf8');
  assert.ok(preview.length>1000,source.name);
  assert.equal(JSON.parse(fs.readFileSync(new URL('../'+source.path,import.meta.url))).textPath,source.textPath);
  assert.equal(source.questionCount,0,'Text previews must not pretend to be diagram-complete quiz questions');
  assert.ok(fs.existsSync(new URL('../'+source.downloadPath,import.meta.url)),source.name);
 }
});
