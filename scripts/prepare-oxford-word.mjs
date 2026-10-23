import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export async function prepareOxfordWord({resourceRoot=path.resolve('../resources/Oxford resource')}={}){
 const catalogPath='bank/oxford/catalog.json';
 const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8'));
 const illustratedBooks=catalog.sources.filter(source=>source.wordEdition==='original');
 for(const source of catalog.sources){
  const downloadPath=`bank/oxford/${source.id}.docx`;
  const wordPath=source.original.replace(/\.doc$/i,'.docx');
  await fs.copyFile(path.join(resourceRoot,wordPath),downloadPath);
  source.downloadPath=downloadPath;
  source.downloadName=source.name;
  const illustratedBook=source.wordEdition==='text'
   ?illustratedBooks.find(book=>book.topics?.includes(source.topic))
   :null;
  if(illustratedBook)source.illustratedDocumentId=illustratedBook.id;
  else delete source.illustratedDocumentId;
 }
 await fs.writeFile(catalogPath,JSON.stringify(catalog));
 console.log(`Prepared ${catalog.sources.length} Word downloads and linked chapter editions to complete illustrated books where available.`);
 console.log('After changing Word files, run npm run prepare:word-preview to refresh the formatted previews.');
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await prepareOxfordWord({resourceRoot:path.resolve(process.argv[2] || '../resources/Oxford resource')});
