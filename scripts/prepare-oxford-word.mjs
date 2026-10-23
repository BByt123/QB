import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);
export async function prepareOxfordWord({resourceRoot=path.resolve('../resources/Oxford resource')}={}){
 const catalogPath='bank/oxford/catalog.json';
 const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8'));
 const {Document,Packer,Paragraph,TextRun,HeadingLevel}=require(process.env.DOCX_MODULE || 'docx');
 for(const source of catalog.sources){
  const original=/\.docx$/i.test(source.name);
  const downloadPath=`bank/oxford/${source.id}.docx`;
  if(original){
   await fs.copyFile(path.join(resourceRoot,source.original),downloadPath);
  }else{
   const text=await fs.readFile(source.textPath,'utf8');
   const children=[
    new Paragraph({text:source.title || source.name,heading:HeadingLevel.TITLE}),
    new Paragraph({children:[new TextRun({text:'Text edition',bold:true})]}),
    new Paragraph('This Word file contains the extracted text of '+source.name+'. Original diagrams, equations and formatting are not included. The original resource file is preserved separately.'),
    new Paragraph(''),
    ...text.replace(/\r/g,'').split('\n').map(line=>new Paragraph({text:line.replace(/[^\x09\x20-\uD7FF\uE000-\uFFFD]/g,''),spacing:{after:80}}))
   ];
   const doc=new Document({creator:'Biology Bank',title:source.title || source.name,description:'Oxford question bank text edition without original diagrams or formatting',styles:{default:{document:{run:{font:'Arial',size:22,color:'000000'}},title:{run:{color:'000000'}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,bottom:1134,left:1134,right:1134}}},children}]});
   await fs.writeFile(downloadPath,await Packer.toBuffer(doc));
  }
  source.downloadPath=downloadPath;
  source.downloadName=original?source.name:source.name.replace(/\.doc$/i,' (text edition).docx');
  source.wordEdition=original?'original':'text';
 }
 await fs.writeFile(catalogPath,JSON.stringify(catalog));
 console.log(`Prepared ${catalog.sources.length} direct DOCX downloads: original DOCX resources and labelled legacy text editions.`);
 console.log('After changing Word files, run npm run prepare:word-preview to refresh the formatted previews.');
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await prepareOxfordWord({resourceRoot:path.resolve(process.argv[2] || '../resources/Oxford resource')});
