import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const WordExtractor=require('./vendor/word-extractor/word-ole-extractor.js');
const FileReader=require('./vendor/word-extractor/file-reader.js');
const {Document,Packer,Paragraph,TextRun,HeadingLevel}=require(process.env.DOCX_MODULE || 'docx');
const root=path.resolve(process.argv[2] || '../resources');
const sourceRoot=path.resolve(process.argv[3] || path.join(root,'Oxford resource'));
const relativeFiles=(await fs.readdir(sourceRoot,{recursive:true})).filter(file=>/\.doc$/i.test(file)).sort();
if(!relativeFiles.length)throw new Error(`No legacy DOC files found under ${sourceRoot}`);

for(const relativePath of relativeFiles){
 const sourcePath=path.join(sourceRoot,relativePath);
 const outputPath=sourcePath.replace(/\.doc$/i,'.docx');
 const reader=new FileReader(sourcePath);
 await reader.open();
 let text;
 try{text=(await new WordExtractor().extract(reader)).getBody();}finally{await reader.close();}
 if(!text.trim())throw new Error(`No text could be extracted from ${relativePath}`);
 const fileName=path.basename(sourcePath);
 const title=fileName.replace(/\.doc$/i,'').replace(/[_]+/g,' ');
 const children=[
  new Paragraph({text:title,heading:HeadingLevel.TITLE}),
  new Paragraph({children:[new TextRun({text:'Text edition',bold:true})]}),
  new Paragraph('Converted from the legacy DOC resource. The original DOC file is preserved. Original diagrams, equations, formatting and page breaks may not be included.'),
  new Paragraph(''),
  ...text.replace(/\r/g,'').split('\n').map(line=>new Paragraph({text:line.replace(/[^\x09\x20-\uD7FF\uE000-\uFFFD]/g,''),spacing:{after:80}}))
 ];
 const document=new Document({creator:'Biology Bank',title,description:'Extracted text edition of a legacy Oxford DOC question bank',styles:{default:{document:{run:{font:'Arial',size:22,color:'000000'}},title:{run:{color:'000000'}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,bottom:1134,left:1134,right:1134}}},children}]});
 await fs.writeFile(outputPath,await Packer.toBuffer(document));
 console.log(`${relativePath} -> ${path.relative(sourceRoot,outputPath)}`);
}
console.log(`Converted ${relativeFiles.length} legacy DOC resources to labelled DOCX text editions. Original DOC files are unchanged.`);
