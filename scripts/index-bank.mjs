import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pageSlices } from '../lib.mjs';
if (process.env.CANVAS_MODULE) {
 const canvas=await import(pathToFileURL(process.env.CANVAS_MODULE));
 Object.assign(globalThis,{DOMMatrix:canvas.DOMMatrix,ImageData:canvas.ImageData,Path2D:canvas.Path2D});
}
const {getDocument}=await import('../vendor/pdf.mjs');
const sources=JSON.parse((await fs.readFile('bank/sources.json','utf8')).replace(/^\uFEFF/,''));
const questions=[];
const topics={1:'Studying biology',2:'Molecules of life',3:'Cell structure',4:'Movement across membranes',5:'Enzymes',6:'Food and nutrition',7:'Nutrition in humans',8:'Gas exchange in humans',9:'Transport in humans',10:'Nutrition in plants',11:'Transport in plants',12:'Cell division',13:'Reproduction in plants',14:'Reproduction in humans',15:'Growth and development',16:'Coordination in plants',17:'Coordination in humans',18:'Support and movement',19:'Homeostasis',20:'Ecosystems',21:'Photosynthesis',22:'Respiration',23:'Infectious diseases',24:'Non-infectious diseases',25:'Defence against pathogens',26:'Sense organs',27:'Molecular genetics',28:'Inheritance',29:'Biodiversity',30:'Evolution',31:'Variation',32:'Temperature regulation',33:'Excretion and osmoregulation',34:'Exercise physiology',35:'Hormonal control of reproduction',36:'Human impacts on ecosystems',37:'Conservation'};
function linesOf(content,height) {
 const rows=[];
 for(const item of content.items) {
  if(!item.str?.trim()) continue;
  const y=height-item.transform[5]-item.height;
  let row=rows.find(r=>Math.abs(r.y-y)<3);
  if(!row) {row={y,height:item.height,items:[]};rows.push(row);}
  row.items.push({x:item.transform[4],width:item.width,str:item.str});
  row.height=Math.max(row.height,item.height);
 }
 return rows.sort((a,b)=>a.y-b.y).map(row=>({...row,text:row.items.sort((a,b)=>a.x-b.x).map((item,i,items)=>(i && item.x-items[i-1].x-items[i-1].width>2?' ':'')+item.str).join('').replace(/\s+/g,' ').trim()}));
}
for (const [sourceIndex,source] of sources.entries()) {
 if(process.env.DEBUG_SOURCE && source.name!==process.env.DEBUG_SOURCE) continue;
 const doc=await getDocument({data:new Uint8Array(await fs.readFile(source.path)),useSystemFonts:true,isEvalSupported:false,standardFontDataUrl:pathToFileURL(path.resolve('vendor/standard_fonts')+path.sep).href}).promise;
 const pages=[];
 const all=[];
 for(let p=0;p<doc.numPages;p++) {
  const page=await doc.getPage(p+1);
  const viewport=page.getViewport({scale:1});
  const lines=linesOf(await page.getTextContent(),viewport.height).filter(l=>l.y>48 && l.y<viewport.height-45);
  pages.push({width:viewport.width,height:viewport.height,lines});
  for(const line of lines) all.push({...line,page:p});
 }
 if(process.env.DEBUG_SOURCE) { console.log(all.filter(l=>!process.env.DEBUG_PAGE || l.page===Number(process.env.DEBUG_PAGE)-1)); process.exit(0); }
 source.pages=pages.length;
 const chapter=Number(source.name.match(/Ch(\d+)/i)?.[1] || 0);
 const testChapter=source.name.match(/ChTest_(\d+)/i)?.[1];
 source.topic=chapter?`Chapter ${String(chapter).padStart(2,'0')} · ${topics[chapter] || 'Biology'}`:testChapter?`Chapter test ${testChapter}`:/^Iq\d+/i.test(source.name)?`Integrated questions ${source.name.match(/\d+/)[0]}`:`${source.publisher} biology`;
 const typeMatch=source.name.match(/_(MC|SQ|LQ|Essay)_/i);
 source.type=typeMatch ? {mc:'MC',sq:'SQ',lq:'LQ',essay:'Essay'}[typeMatch[1].toLowerCase()] : '';
 const markers=all.map((l,i)=>({l,i,id:l.text.replace(/\s/g,'').match(/\|!\|([A-Za-z0-9_-]+)\|!\|/)?.[1]})).filter(m=>m.id);
 let shared=null;
 for(let m=0;m<markers.length;m++) {
  const marker=markers[m];
  const next=markers[m+1];
  const endIndex=next?.i ?? all.length;
  const content=all.slice(marker.i+1,endIndex);
  const answerIndex=content.findIndex(l=>l.text.includes('##'));
  if(answerIndex<0) continue;
  const answerLine=content[answerIndex];
  const questionLines=content.slice(0,answerIndex);
  const secondAnswer=content.findIndex((l,i)=>i>answerIndex && l.text.includes('##'));
  const skillIndex=content.findIndex((l,i)=>i>answerIndex && /Skills? assessed/.test(l.text));
  const answerEnd=secondAnswer>=0?content[secondAnswer]:skillIndex>=0?content[skillIndex]:next?.l || {page:pages.length-1,y:pages.at(-1).height-48};
  const type=source.type || (/MC/.test(marker.id)?'MC':'LQ');
  let text=questionLines.map(l=>l.text).join('\n').replace(/[\uF000-\uFFFF]/g,'').trim();
  if(!text) continue;
  const cropEnd={page:answerLine.page,y:answerLine.y-3};
  let cropStart={page:marker.l.page,y:marker.l.y+marker.l.height+3};
  let contextSegments=[];
  if(shared && m<shared.end) {contextSegments=shared.segments;text=shared.text+'\n'+text;}
  if(type==='MC') {
   const direction=questionLines.findIndex(l=>/Directions:.*following\s+(two|three|four|five|\d+)\s+questions/i.test(l.text));
   if(direction>=0) {
    const countText=questionLines[direction].text.match(/following\s+(two|three|four|five|\d+)/i)[1].toLowerCase();
    const count=({two:2,three:3,four:4,five:5})[countText] || Number(countText);
    let option=questionLines.findIndex((l,i)=>i>direction && /^A\.(?:\s|$)/.test(l.text));
    if(option<0)option=questionLines.findIndex((l,i)=>i>direction && /\?\s*$/.test(l.text))+1;
    let stem=option;
    // Preserve the passage across pages; split at the paragraph before the options.
    for(let i=option-1;i>direction+1;i--) {
     const line=questionLines[i],previous=questionLines[i-1];
     if(line.page!==previous.page || line.y-previous.y>Math.max(22,line.height*1.8)) {stem=i;break;}
    }
    if(stem>direction) {
     const start=questionLines[direction],end=questionLines[stem];
     shared={end:m+count,segments:pageSlices({page:start.page,y:start.y-2},{page:end.page,y:end.y-4},pages),text:questionLines.slice(direction,stem).map(l=>l.text).join('\n')};
    }
   }
  }
  const answerText=content.slice(answerIndex+(type==='MC'?0:1),secondAnswer>=0?secondAnswer:skillIndex>=0?skillIndex:undefined).map(l=>l.text).join('\n').replace(/##/g,'').trim();
  questions.push({id:`${source.id}-${marker.id}`,code:marker.id,sourceId:source.id,publisher:source.publisher,topic:source.topic,type,text,answer:type==='MC'?answerLine.text.match(/##\s*([A-D])\s*##/)?.[1] || '':'',answerText,marks:type==='MC'?1:[...text.matchAll(/\((\d+)\s*marks?\)/gi)].reduce((sum,m)=>sum+Number(m[1]),0) || null,segments:[...contextSegments,...pageSlices(cropStart,cropEnd,pages)],answerSegments:type==='MC'?[]:pageSlices({page:answerLine.page,y:answerLine.y+answerLine.height+3},{page:answerEnd.page,y:answerEnd.y-3},pages)});
 }
 source.questionCount=questions.filter(q=>q.sourceId===source.id).length;
 await doc.destroy();
 console.log(`${sourceIndex+1}/${sources.length} ${source.name}: ${source.questionCount} questions`);
}
const manifest={version:1,generated:new Date().toISOString(),questions,sources,topics:[...new Set(questions.map(q=>q.topic))].sort()};
await fs.writeFile('bank/index.json',JSON.stringify(manifest));
console.log(`Indexed ${questions.length} questions in ${sources.length} sources.`);
