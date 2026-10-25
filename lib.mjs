export const TYPES = {MC:'Multiple choice',SQ:'Short question',LQ:'Long question',Essay:'Essay'};
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const COOKIE_CHUNK_SIZE=1000,COOKIE_MAX_CHUNKS=32,COOKIE_MAX_AGE=60*60*24*365;
function cookiePath(){
 if(typeof location==='undefined')return '/';
 if(location.hostname.endsWith('github.io')){
  const segment=location.pathname.split('/').filter(Boolean)[0];
  return segment?`/${segment}/`:'/';
 }
 return '/';
}
function cookieName(key){return `dse-${String(key).replace(/[^a-zA-Z0-9_-]/g,'_')}`;}
function readCookie(name){
 if(typeof document==='undefined')return null;
 const prefix=`${name}=`;
 for(const part of document.cookie.split(';')){
  const value=part.trim();
  if(value.startsWith(prefix)){
   try{return decodeURIComponent(value.slice(prefix.length));}catch{return null;}
  }
 }
 return null;
}
function writeCookie(name,value){
 if(typeof document==='undefined')return false;
 try{
  document.cookie=`${name}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; Path=${cookiePath()}; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
  return readCookie(name)!==null;
 }catch{return false;}
}
function removeCookie(name){
 if(typeof document==='undefined')return;
 try{document.cookie=`${name}=; Max-Age=0; Path=${cookiePath()}; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;}catch{}
}
function readCookieValue(key){
 const base=cookieName(key),count=Number(readCookie(`${base}.count`));
 if(!Number.isInteger(count)||count<1||count>COOKIE_MAX_CHUNKS)return null;
 let value='';
 for(let index=0;index<count;index++){
  const chunk=readCookie(`${base}.${index}`);
  if(chunk===null)return null;
  value+=chunk;
 }
 return value;
}
function writeCookieValue(key,value){
 const base=cookieName(key),chunks=[];
 for(let offset=0;offset<value.length;offset+=COOKIE_CHUNK_SIZE)chunks.push(value.slice(offset,offset+COOKIE_CHUNK_SIZE));
 if(!chunks.length||chunks.length>COOKIE_MAX_CHUNKS)return false;
 const previous=Number(readCookie(`${base}.count`));
 let written=true;
 chunks.forEach((chunk,index)=>{written=writeCookie(`${base}.${index}`,chunk)&&written;});
 for(let index=chunks.length;index<(Number.isInteger(previous)?previous:0);index++)removeCookie(`${base}.${index}`);
 written=writeCookie(`${base}.count`,String(chunks.length))&&written;
 return written;
}
function removeCookieValue(key){
 const base=cookieName(key),count=Number(readCookie(`${base}.count`));
 if(Number.isInteger(count))for(let index=0;index<count;index++)removeCookie(`${base}.${index}`);
 removeCookie(`${base}.count`);
}
export function readStored(key){
 let local=null;
 try{local=window.localStorage.getItem(key);}catch{}
 if(local!==null)return local;
 const cookie=readCookieValue(key);
 if(cookie!==null){try{window.localStorage.setItem(key,cookie);}catch{}return cookie;}
 return null;
}
export function writeStored(key,value){
 const serialized=String(value);
 let stored=false;
 try{window.localStorage.setItem(key,serialized);stored=true;}catch{}
 if(writeCookieValue(key,serialized))stored=true;
 return stored;
}
export function removeStored(key){
 try{window.localStorage.removeItem(key);}catch{}
 removeCookieValue(key);
}
export function filterQuestions(questions, {search='',topic='',type='',publisher='',savedOnly=false,bookmarks=[],collectionIds=null,overrides={}}={}) {
 const terms=search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 const saved=new Set(bookmarks);
 const collection=collectionIds ? new Set(collectionIds) : null;
 return questions.filter(q=> {
  const o=overrides[q.id] || {};
  return (!topic || (o.topic || q.topic)===topic) && (!type || (o.type || q.type)===type) && (!publisher || q.publisher===publisher) && (!savedOnly || saved.has(q.id)) && (!collection || collection.has(q.id)) && terms.every(term=>`${q.text} ${q.id} ${o.topic || q.topic} ${q.publisher} ${o.tags || ''}`.toLocaleLowerCase().includes(term));
 });
}
export function sampleQuestions(questions, count, random=Math.random) {
 const items=[...questions];
 for(let i=items.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [items[i],items[j]]=[items[j],items[i]]; }
 return items.slice(0,Math.max(0,Math.min(items.length,Math.floor(count))));
}
export function scoreQuiz(questions,responses) {
 const gradable=questions.filter(q=>q.type==='MC' && /^[A-D]$/.test(q.answer));
 const correct=gradable.filter(q=>responses[q.id]===q.answer).length;
 const answered=questions.filter(q=>String(responses[q.id] || '').trim()).length;
 return {correct,total:gradable.length,answered,count:questions.length,percent:gradable.length ? Math.round(correct/gradable.length*100) : null};
}
export function restoreQuiz(raw, validIds) {
 const known=new Set(validIds);
 if(!raw || !Array.isArray(raw.ids) || !raw.ids.length || raw.ids.length>50 || !raw.ids.every(id=>known.has(id)) || !raw.responses || typeof raw.responses!=='object') return null;
 const ids=[...new Set(raw.ids)];
 const marks=Object.fromEntries(ids.filter(id=>Number.isFinite(Number(raw.marks?.[id]))).map(id=>[id,Math.max(0,Number(raw.marks[id]))]));
 return {ids,responses:Object.fromEntries(ids.filter(id=>typeof raw.responses[id]==='string').map(id=>[id,raw.responses[id].slice(0,50000)])),marks,current:Math.max(0,Math.min(Number.isInteger(raw.current)?raw.current:0,ids.length-1)),mode:raw.mode==='exercise'?'exercise':'exam',started:typeof raw.started==='string'?raw.started:new Date().toISOString(),deadline:Number.isFinite(raw.deadline)?raw.deadline:null,finished:raw.finished===true,finishedAt:typeof raw.finishedAt==='string'?raw.finishedAt:null};
}
export function validateBackup(data,validIds) {
 if(data?.version!==1 || !Array.isArray(data.bookmarks) || !Array.isArray(data.collections) || typeof data.overrides!=='object' || !data.overrides) throw new Error('This is not a valid Biology Bank backup.');
 const known=new Set(validIds);
 const ids=list=>[...new Set((Array.isArray(list)?list:[]).filter(id=>typeof id==='string' && known.has(id)))];
 const names=new Set();
 const collections=data.collections.filter(c=>c && typeof c.id==='string' && typeof c.name==='string' && c.name.trim()).map(c=>({id:c.id.slice(0,100),name:c.name.trim().slice(0,80),ids:ids(c.ids)})).filter(c=>!names.has(c.id) && names.add(c.id));
 const overrides=Object.fromEntries(Object.entries(data.overrides).filter(([id,o])=>known.has(id) && o && typeof o==='object').map(([id,o])=>[id,{topic:typeof o.topic==='string'?o.topic.slice(0,120):'',type:Object.hasOwn(TYPES,o.type)?o.type:'',tags:typeof o.tags==='string'?o.tags.slice(0,300):''}]));
 const history=Array.isArray(data.history)?data.history.filter(h=>h && typeof h.date==='string' && Number.isFinite(h.count) && Number.isFinite(h.correct) && Number.isFinite(h.total)).slice(0,50).map((h,index)=>({
  id:typeof h.id==='string' && h.id.trim()?h.id.slice(0,120):`history-${h.date}-${index}`,
  date:h.date,
  started:typeof h.started==='string'?h.started:h.date,
  count:Math.max(0,Math.floor(h.count)),
  answered:Number.isFinite(h.answered)?Math.max(0,Math.floor(h.answered)):Math.max(0,Math.floor(h.correct)),
  correct:Math.max(0,Math.floor(h.correct)),
  total:Math.max(0,Math.floor(h.total)),
  mode:h.mode==='exercise'?'exercise':'exam',
  status:h.status==='left'?'left':'completed'
 })):[];
 return {version:1,bookmarks:ids(data.bookmarks),collections,overrides,history};
}
export function safeFilename(value) { return String(value).replace(/[<>:"/\\|?*\x00-\x1f]/g,'').trim().replace(/[. ]+$/,'').slice(0,100) || 'biology-question-bank'; }
export function pageSlices(start,end,pages) {
 const slices=[];
 for(let p=start.page;p<=end.page;p++) {
  const top=p===start.page?start.y:55;
  const bottom=p===end.page?end.y:pages[p].height-48;
  if(bottom-top>5) slices.push({page:p+1,x:36,y:Math.max(45,top),width:pages[p].width-72,height:bottom-Math.max(45,top)});
 }
 return slices;
}
