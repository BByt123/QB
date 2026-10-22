import {chapterTopic} from '../taxonomy.mjs';

const sharedCounts={two:2,three:3,four:4,five:5,six:6};
const missingMedia=/\b(?:diagrams?|graphs?|charts?|photomicrographs?|micrographs?|photographs?|pictures?|illustrations?|figures?|drawings?|labelled|labeled|tables?)\b|\b(?:shown|illustrated)\s+(?:above|below)|[\ufffc\ufffd]/i;
const dependent=/\b(?:above|previous|preceding)\s+(?:experiment|investigation|results?|study|passage|information|question)|\b(?:this|the same)\s+(?:experiment|investigation|study|set-up)\b/i;
const missingReference=/\b(?:above|below)\b|\b(?:solutions?|tubes?|set-ups?|beakers?|structures?|cells?|parts?|regions?|species|organisms?|process(?:es)?|stages?|molecules?|substances?|arrows?)\s+[P-Z]\b/i;

// Only standalone text questions are safe without the legacy Word figures.
export function parseOxfordQuestions(input,source){
 const text=input.replace(/\r/g,'');
 const tokens=[...text.matchAll(/^[ \t]*(?:\[(\d{6,})\]|(\(?[ \t]*Chapter[ \t]+(\d+)[^\n]*)|((?:Multiple-choice|Short|Structured|Long|Essay)[ \t]+questions?))[ \t]*$/gmi)];
 const questions=[];let type='',topic=source.topic,sharedRemaining=0;
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i];
  if(token[2]){if(!source.subchapter)topic=chapterTopic('Ch'+Number(token[3]));type='';sharedRemaining=0;continue;}
  if(token[4]){type=/^Multiple/i.test(token[4])?'MC':/^Short/i.test(token[4])?'SQ':/^Essay/i.test(token[4])?'Essay':'LQ';sharedRemaining=0;continue;}
  const raw=text.slice(token.index+token[0].length,tokens[i+1]?.index ?? text.length);
  const block=raw.split(/^[ \t]*-{8,}[ \t]*$/m)[0].trim();
  const shared=block.match(/following[ \t]+(two|three|four|five|six|\d+)[ \t]+questions/i);
  if(shared)sharedRemaining=sharedCounts[shared[1].toLowerCase()] || Number(shared[1]);
  if(sharedRemaining>0){sharedRemaining--;continue;}
  const tags=[...block.matchAll(/\/\/([^\n]*?)\/\//g)].map(m=>m[1].trim()).join('; ');
  const cleaned=block.replace(/^[ \t]*\/\/[^\n]*$/gm,'').replace(/^[\s*(]+/,'').trim();
  const parts=cleaned.split(/^[ \t]*--[ \t]*answer[ \t]*--[ \t]*$/mi);
  let question=parts[0].trim(),answer='',answerText=parts.slice(1).join('\n').trim();
  if(!type || !topic || topic==='Oxford updates' || missingMedia.test(question+' '+tags) || missingReference.test(question) || /\b[P-Z]\b/.test(question) || /\bfollowing\s+(?:equations?|set-ups?|organisms?)\b/i.test(question) || dependent.test(question) || /\bDirections\b/i.test(question))continue;
  if(type==='MC'){
   const key=question.match(/(?:^|\n)[ \t]*([A-D])[ \t]*$/);
   if(!key)continue;answer=key[1];question=question.slice(0,key.index).trim();
   const options=[...question.matchAll(/(?:^|\n|\t+| {2,})([A-D])(?:[.)][ \t]+|\t+| {2,}|\n)/g)];
   if(options.map(o=>o[1]).join('')!=='ABCD')continue;
   if(options.some((o,j)=>!question.slice(o.index+o[0].length,options[j+1]?.index ?? question.length).trim()))continue;
  }else if(!answerText)continue;
  if(question.length<35 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(question))continue;
  questions.push({id:source.id+'-'+token[1],code:token[1],sourceId:source.id,publisher:'Oxford',topic,type,text:question,answer,answerText,marks:null,segments:[],answerSegments:[],preview:'text'});
 }
 return questions;
}
