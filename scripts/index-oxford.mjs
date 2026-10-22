import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {parseOxfordQuestions} from './oxford-questions.mjs';

export async function indexOxford(){
 const catalog=JSON.parse(await fs.readFile('bank/oxford/catalog.json','utf8'));
 const questions=[],codes=new Set();
 for(const source of catalog.sources){
  const items=parseOxfordQuestions(await fs.readFile(source.textPath,'utf8'),source).filter(q=>!codes.has(q.code) && codes.add(q.code));
  source.questionCount=items.length;questions.push(...items);
 }
 const quizPath='bank/oxford/questions.json';
 await fs.writeFile(quizPath,JSON.stringify({questions}));
 await fs.writeFile('bank/oxford/catalog.json',JSON.stringify({...catalog,quizPath}));
 console.log('Indexed '+questions.length+' standalone Oxford text questions from '+catalog.sources.length+' documents. Figure-dependent and shared-passage items are excluded.');
 return questions;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)await indexOxford();
