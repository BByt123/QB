import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {CHAPTERS,chapterTopic} from '../taxonomy.mjs';
const require=createRequire(import.meta.url);
const WordExtractor=require('./vendor/word-extractor/word-ole-extractor.js');
const FileReader=require('./vendor/word-extractor/file-reader.js');
const JSZip=require(process.env.JSZIP_MODULE || 'jszip');
const root=path.resolve(process.argv[2] || '../resources/Oxford resource');
const output='bank/oxford';
await fs.mkdir(output,{recursive:true});
const files=(await fs.readdir(root,{recursive:true})).filter(f=>/\.docx?$/.test(f)).sort();
const sources=[],seen=new Set();
for(const file of files){
 const full=path.join(root,file),bytes=await fs.readFile(full);
 const hash=createHash('sha256').update(bytes).digest('hex');if(seen.has(hash))continue;seen.add(hash);
 const name=path.basename(file),id=`oxford-${hash.slice(0,16)}`;
 let text;
 if(name.endsWith('.docx')){
  const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml').async('string');
  const {xml2js}=require(process.env.XML_MODULE || 'xml-js');
  const doc=xml2js(xml,{compact:false});
  const walk=node=>node.type==='text'?node.text:node.name==='w:tab'?'\t':node.name==='w:br'?'\n':(node.elements || []).map(walk).join('')+(['w:p','w:tr'].includes(node.name)?'\n':'');
  text=walk(doc);
 }else{
  const reader=new FileReader(full);await reader.open();
  try{text=(await new WordExtractor().extract(reader)).getBody();}finally{await reader.close();}
 }
 const elective=name.match(/qb_(E\d)_ch(\d+)/i);
 const chapter=name.match(/_ch(\d+)/i);
 const topic=elective?chapterTopic(elective[1]):chapter?chapterTopic(`Ch${Number(chapter[1])}`):'Oxford updates';
 const heading=text.split(/Multiple-choice questions/i)[0].replace(/\s+/g,' ').replace(/^\(\s*/,'').trim().slice(0,180);
 const previewPath=`${output}/${id}.json`,textPath=`${output}/${id}.txt`;
 const downloadPath=name.endsWith('.docx')?`${output}/${id}.docx`:textPath;
 await fs.writeFile(textPath,text.replace(/\r/g,''),'utf8');
 await fs.writeFile(previewPath,JSON.stringify({textPath}));
 if(name.endsWith('.docx'))await fs.copyFile(full,downloadPath);
 const chapterIds=[...new Set([...text.matchAll(/(?:^|\n)\s*\(?\s*Chapter\s*(\d+)\s+/g)].map(m=>chapterTopic(`Ch${Number(m[1])}`)))];
 const record={id,name,title:name.endsWith('.docx')?`Oxford updates · ${name}`:heading,publisher:'Oxford',path:previewPath,textPath,downloadPath,format:'word-text',topic,topics:name.endsWith('.docx')?chapterIds:[topic],subchapter:elective?Number(elective[2]):null,pages:null,questionCount:0,preview:'text',original:file.replaceAll('\\','/')};
 sources.push(record);console.log(`${sources.length}. ${name} | ${heading} | ${text.length} characters`);
}
await fs.writeFile(`${output}/catalog.json`,JSON.stringify({sources,chapters:CHAPTERS}));
console.log(`Imported ${sources.length} unique Oxford documents. Text previews and downloads; original DOCX updates included. Legacy Word diagrams remain in local originals.`);
