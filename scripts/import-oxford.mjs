import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {CHAPTERS,chapterTopic} from '../taxonomy.mjs';
import {indexOxford} from './index-oxford.mjs';
import {prepareOxfordWord} from './prepare-oxford-word.mjs';
const require=createRequire(import.meta.url);
const WordExtractor=require('./vendor/word-extractor/word-ole-extractor.js');
const FileReader=require('./vendor/word-extractor/file-reader.js');
const JSZip=require(process.env.JSZIP_MODULE || 'jszip');
const root=path.resolve(process.argv[2] || '../resources/Oxford resource');
const output='bank/oxford';
await fs.mkdir(output,{recursive:true});
const allFiles=(await fs.readdir(root,{recursive:true})).filter(f=>/\.docx?$/i.test(f)).sort();
const legacyStems=new Set(allFiles.filter(f=>/\.doc$/i.test(f)).map(f=>f.replace(/\.doc$/i,'').toLocaleLowerCase()));
const manifestPath=`${output}/conversion-manifest.json`;
let manifest={version:1,converted:{}};
try{manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
manifest.converted ||= {};
const files=allFiles.filter(f=>/\.doc$/i.test(f) || !legacyStems.has(f.replace(/\.docx$/i,'').toLocaleLowerCase()));
const sources=[],seen=new Set();
for(const file of files){
 const full=path.join(root,file),bytes=await fs.readFile(full);
 const hash=createHash('sha256').update(bytes).digest('hex');
 const relative=file.replaceAll('\\','/');
 const isDocx=/\.docx$/i.test(path.basename(file));
 const conversion=manifest.converted[relative];
 const originalHash=typeof conversion==='string'?conversion:conversion?.sourceHash;
 if(isDocx && typeof conversion==='string')manifest.converted[relative]={sourceHash:originalHash,docxHash:hash};
 const identityHash=originalHash || hash;
 if(seen.has(identityHash))continue;seen.add(identityHash);
 const originalName=path.basename(file),name=originalName.replace(/\.doc$/i,'.docx');
 const generatedEdition=/\.doc$/i.test(originalName) || Boolean(originalHash);
 const originalDocx=isDocx && !generatedEdition;
 const stableId=`oxford-${identityHash.slice(0,16)}`;
 const previewPath=`${output}/${stableId}.json`,textPath=`${output}/${stableId}.txt`;
 let text;
 if(isDocx && originalHash && conversion?.docxHash===hash){
  try{text=await fs.readFile(textPath,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 if(text===undefined && isDocx){
  const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml').async('string');
  const {xml2js}=require(process.env.XML_MODULE || 'xml-js');
  const doc=xml2js(xml,{compact:false});
  const walk=node=>node.type==='text'?node.text:node.name==='w:tab'?'\t':node.name==='w:br'?'\n':(node.elements || []).map(walk).join('')+(['w:p','w:tr'].includes(node.name)?'\n':'');
  text=walk(doc);
 }else if(text===undefined){
  const reader=new FileReader(full);await reader.open();
  try{text=(await new WordExtractor().extract(reader)).getBody();}finally{await reader.close();}
 }
 if(isDocx && originalHash)manifest.converted[relative]={sourceHash:originalHash,docxHash:hash};
 if(/\.doc$/i.test(file)){
  const convertedPath=relative.replace(/\.doc$/i,'.docx');
  const convertedBytes=await fs.readFile(path.join(root,convertedPath));
  manifest.converted[convertedPath]={sourceHash:hash,docxHash:createHash('sha256').update(convertedBytes).digest('hex')};
 }
 const elective=name.match(/qb_(E\d)_ch(\d+)/i);
 const chapter=name.match(/_ch(\d+)/i);
 const topic=elective?chapterTopic(elective[1]):chapter?chapterTopic(`Ch${Number(chapter[1])}`):'Oxford updates';
 const heading=text.split(/Multiple-choice questions/i)[0].replace(/\s+/g,' ').replace(/^\(\s*/,'').trim().slice(0,180);
 await fs.writeFile(textPath,text.replace(/\r/g,''),'utf8');
 await fs.writeFile(previewPath,JSON.stringify({textPath}));
 const chapterIds=[...new Set([...text.matchAll(/(?:^|\n)\s*\(?\s*Chapter\s*(\d+)\s+/g)].map(m=>chapterTopic(`Ch${Number(m[1])}`)))];
 const record={id:stableId,name,title:originalDocx?`Oxford updates · ${name}`:heading,publisher:'Oxford',path:previewPath,textPath,format:'word-text',topic,topics:originalDocx?chapterIds:[topic],subchapter:elective?Number(elective[2]):null,pages:null,questionCount:0,preview:'text',original:relative,wordEdition:generatedEdition?'text':'original'};
 sources.push(record);console.log(`${sources.length}. ${name} | ${heading} | ${text.length} characters`);
}
await fs.writeFile(manifestPath,JSON.stringify(manifest));
await fs.writeFile(`${output}/catalog.json`,JSON.stringify({sources,chapters:CHAPTERS}));
await indexOxford();
await prepareOxfordWord({resourceRoot:root});
console.log(`Imported ${sources.length} unique Oxford DOCX documents. Legacy DOC files are represented by labelled text editions; native DOCX updates are preserved.`);
