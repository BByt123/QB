import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const catalog=JSON.parse(fs.readFileSync(new URL('bank/oxford/catalog.json',root)));
test('every Word preview matches its downloadable document and has valid local content',()=>{
 for(const source of catalog.sources){
  assert.equal(source.wordPreviewPath,`bank/oxford/${source.id}.preview.json`);
  const preview=JSON.parse(fs.readFileSync(new URL(source.wordPreviewPath,root)));
  assert.equal(preview.version,1);assert.equal(preview.edition,source.wordEdition);
  assert.equal(preview.sourceHash,createHash('sha256').update(fs.readFileSync(new URL(source.downloadPath,root))).digest('hex'),source.name+' needs regenerated previews');
  let text='',images=0,tables=0;
  function visit(blocks){
   assert.ok(Array.isArray(blocks));
   for(const block of blocks){
    assert.ok(['paragraph','table'].includes(block.type));
    if(block.type==='table'){
     tables++;assert.ok(block.rows.length);
     for(const row of block.rows)for(const cell of row){assert.ok(Number.isInteger(cell.span) && cell.span>0);visit(cell.blocks);}
    }else{
     assert.ok(['left','center','right','justify'].includes(block.align));
     for(const run of block.runs){
      assert.ok(['text','image','unavailable'].includes(run.type));
      if(run.type==='text'){assert.equal(typeof run.text,'string');text+=run.text;}
      if(run.type==='image'){
       images++;assert.match(run.path,/^bank[/]oxford[/]preview-media[/][a-f0-9]{24}[.](png|jpe?g|gif|webp)$/);
       assert.ok(fs.statSync(new URL(run.path,root)).size>0,run.path);
      }
     }
    }
   }
  }
  visit(preview.blocks);assert.ok(text.length>1000,source.name);
  if(source.wordEdition==='original'){assert.ok(images>0,source.name+' images');assert.ok(tables>0,source.name+' tables');}
  else assert.match(text,/Original diagrams, equations, formatting and page breaks may not be included/);
 }
});
