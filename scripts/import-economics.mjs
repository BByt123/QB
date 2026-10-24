import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const WordExtractor=require('./vendor/word-extractor/word-ole-extractor.js');
const FileReader=require('./vendor/word-extractor/file-reader.js');
const {Document,Packer,Paragraph,TextRun,HeadingLevel}=require(process.env.DOCX_MODULE || 'docx');

const root=path.resolve(process.argv[2] || '../Econ resources/Pearson by topic');
const output=path.resolve(process.argv[3] || 'bank/economics');
const files=(await fs.readdir(root,{withFileTypes:true})).filter(entry=>entry.isFile() && /\.doc$/i.test(entry.name)).map(entry=>entry.name).sort();
if(!files.length)throw new Error(`No Economics DOC files found under ${root}`);
await fs.mkdir(path.join(output,'files'),{recursive:true});
await fs.mkdir(path.join(output,'text'),{recursive:true});
await fs.mkdir(path.join(output,'originals'),{recursive:true});

const topicNames={
 '1':'What is economics?','2':'The three basic economic problems','3':'Demand and supply','4':'Changes in demand and supply','5':'Price elasticity of demand and supply','6':'Market intervention (I)','7':'Market intervention (II)','8':'Ownership of firms','9':'Production and division of labour','10':'Factors of production','11':'Production in the short run and long run','12':'Expansion of firms','13':'Market and market structure','14':'Profit maximisation and output determination','15':'Consumer surplus and producer surplus','16':'Competition and efficiency','17':'The roles of government (I): market failure','18':'The roles of government (II)','19':'Monopoly pricing','20':'Anti-competitive behaviours'
};
const chapterFor=filename=>{
 const legacy=filename.match(/_b(\d+)c(\d+)/i);
 if(legacy)return {book:Number(legacy[1]),chapter:Number(legacy[2])};
 const renamed=filename.match(/^(\d)(\d{2})\.doc$/i);
 return renamed?{book:Number(renamed[1]),chapter:Number(renamed[2])}:null;
};
const sourceTopic=meta=>`B${meta.book} · Ch${String(meta.book*100+meta.chapter).padStart(3,'0')} · ${topicNames[String(meta.chapter)] || 'Economics'}`;
const questionType=section=>/multiple choice/i.test(section)?'MC':/short question/i.test(section)?'SQ':'LQ';
const clean=value=>String(value || '').replace(/\r/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim();
function parseQuestions(text,sourceId){
 const matches=[...text.matchAll(/Question code:\s*(B\d+C\d+Q\d+[^\r\n]*)/gi)];
 const headings=[...text.matchAll(/Multiple Choice Questions|Short Questions|Structured Questions/gi)];
 const codeUses=new Map();
 const questions=[];
 for(let index=0;index<matches.length;index++){
  const match=matches[index],rawCode=match[1].trim(),code=rawCode.replace(/\s+\(.+?\)$/,'');
  const start=match.index+match[0].length,end=matches[index+1]?.index ?? text.length;
  const block=clean(text.slice(start,end));
  const heading=headings.filter(item=>item.index < match.index).at(-1)?.[0] || 'Structured Questions';
  const type=questionType(heading);
  const answerMatch=type==='MC'?block.match(/(?:^|\n)Answer:\s*([A-D])\b/i):block.match(/(?:^|\n)Answers?:\s*([\s\S]*)/i);
  const answer=type==='MC'?(answerMatch?.[1] || ''):'';
  const questionText=clean((type==='MC'?block.split(/(?:^|\n)Answer:\s*[A-D]\b/i)[0]:block.split(/(?:^|\n)Answers?:/i)[0]).replace(/\n{3,}/g,'\n\n'));
  const answerText=type==='MC'?'':clean(answerMatch?.[1] || '');
  if(!questionText)continue;
  const occurrence=(codeUses.get(code) || 0)+1;codeUses.set(code,occurrence);
  questions.push({id:`${sourceId}-${code}${occurrence>1?`-${occurrence}`:''}`,code,sourceId,publisher:'Pearson',topic:sourceTopic(sourceMetaById.get(sourceId)),type,text:questionText,answer,answerText,marks:[...questionText.matchAll(/\((\d+)\s*marks?/gi)].reduce((sum,item)=>sum+Number(item[1]),0) || null,segments:[],answerSegments:[]});
 }
 return questions;
}
const sourceMetaById=new Map();
const sources=[];
for(const filename of files){
 const meta=chapterFor(filename);if(!meta)continue;
 const number=meta.book*100+meta.chapter;
 const sourceId=`econ-${String(number).padStart(3,'0')}`;
 sourceMetaById.set(sourceId,meta);
 const sourcePath=path.join(root,filename),reader=new FileReader(sourcePath);await reader.open();
 let text;try{text=(await new WordExtractor().extract(reader)).getBody();}finally{await reader.close();}
 text=clean(text);
 await fs.copyFile(sourcePath,path.join(output,'originals',filename));
 const numbered=`${String(number).padStart(3,'0')}.docx`,textName=`${String(number).padStart(3,'0')}.txt`;
 await fs.writeFile(path.join(output,'text',textName),text,'utf8');
 const outputDocx=path.join(output,'files',numbered);
 let mediaPreserved=false;
 try { const existing=await fs.readFile(outputDocx); mediaPreserved=existing.subarray(0,2).toString('hex')==='504b' && existing.includes(Buffer.from('word/media/')); } catch {}
 if(!mediaPreserved){
  const children=[new Paragraph({text:`Economics question bank ${String(number).padStart(3,'0')}`,heading:HeadingLevel.TITLE}),new Paragraph({children:[new TextRun({text:'Converted from the legacy Economics DOC resource.',bold:true})]}),new Paragraph('The source text is preserved in this web-ready Word edition.'),new Paragraph(''),...text.split('\n').map(line=>new Paragraph({text:line,spacing:{after:80}}))];
  const doc=new Document({creator:'DSE Study Library',title:`Economics question bank ${number}`,sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,bottom:1134,left:1134,right:1134}}},children}]});
  await fs.writeFile(outputDocx,await Packer.toBuffer(doc));
 }
 const topic=sourceTopic(meta);
 sources.push({id:sourceId,name:numbered,title:topic,publisher:'Pearson',path:`bank/economics/text/${textName}`,textPath:`bank/economics/text/${textName}`,downloadPath:`bank/economics/files/${numbered}`,downloadName:numbered,originalDownloadPath:`bank/economics/originals/${filename}`,originalDownloadName:filename,format:'word-text',wordEdition:mediaPreserved?'original':'text',conversionStatus:mediaPreserved?'word':'text-only',mediaPreserved,topic,topics:[topic],pages:null,questionCount:0,original:filename,sourceCode:String(number).padStart(3,'0')});
}
const questions=[];
for(const source of sources){const text=await fs.readFile(path.join(output,'text',path.basename(source.textPath)),'utf8');const items=parseQuestions(text,source.id);source.questionCount=items.length;questions.push(...items);}
const manifest={version:1,generated:new Date().toISOString(),topics:sources.map(source=>source.topic),sources,questions};
await fs.writeFile(path.join(output,'index.json'),JSON.stringify(manifest));
console.log(`Imported ${sources.length} Economics documents and ${questions.length} questions.`);
