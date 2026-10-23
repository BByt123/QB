import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export async function prepareOxfordWord({resourceRoot=path.resolve('../resources/Oxford resource')}={}){
 const catalogPath='bank/oxford/catalog.json';
 const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8'));
 for(const source of catalog.sources){
  const original=/\.docx$/i.test(source.original);
  const downloadPath=`bank/oxford/${source.id}.docx`;
  if(original){
   await fs.copyFile(path.join(resourceRoot,source.original),downloadPath);
  }else{
   const convertedPath=source.original.replace(/\.doc$/i,'.docx');
   await fs.copyFile(path.join(resourceRoot,convertedPath),downloadPath);
  }
  source.downloadPath=downloadPath;
  source.downloadName=source.name;
  source.wordEdition=original?'original':'text';
 }
 await fs.writeFile(catalogPath,JSON.stringify(catalog));
 console.log(`Prepared ${catalog.sources.length} direct DOCX downloads: original DOCX resources and labelled legacy text editions.`);
 console.log('After changing Word files, run npm run prepare:word-preview to refresh the formatted previews.');
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await prepareOxfordWord({resourceRoot:path.resolve(process.argv[2] || '../resources/Oxford resource')});
