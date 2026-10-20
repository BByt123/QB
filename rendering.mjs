import * as pdfjs from './vendor/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
const cache=new Map();
function acquireSource(source) {
 if(!cache.has(source.id)) {
  const promise=pdfjs.getDocument({url:new URL(source.path,document.baseURI).href,standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,wasmUrl:new URL('./vendor/wasm/',import.meta.url).href,isEvalSupported:false}).promise;
  cache.set(source.id,{promise,users:0});
  promise.catch(()=>cache.delete(source.id));
 }
 const entry=cache.get(source.id);entry.users++;
 return entry;
}
function trimCache() {
 for(const [id,entry] of cache) {
  if(cache.size<=8)break;
  if(!entry.users){cache.delete(id);entry.promise.then(doc=>doc.destroy()).catch(()=>{});}
 }
}
export async function renderSegment(source,segment,scale=1.6) {
 const entry=acquireSource(source);
 try {
 const doc=await entry.promise;
 const page=await doc.getPage(segment.page);
 const canvas=document.createElement('canvas');
 canvas.width=Math.ceil(segment.width*scale);
 canvas.height=Math.ceil(segment.height*scale);
 const context=canvas.getContext('2d');
 await page.render({canvasContext:context,viewport:page.getViewport({scale}),transform:[1,0,0,1,-segment.x*scale,-segment.y*scale],background:'white'}).promise;
 return canvas;
 } finally {entry.users--;trimCache();}
}
export async function renderQuestion(container,question,source,answer=false) {
 if(!container)return;
 const segments=answer?question.answerSegments:question.segments;
 if(!segments.length) { const p=document.createElement('p');p.className='answer-text';p.textContent=answer?(question.answer?`Correct answer: ${question.answer}`:question.answerText):question.text;container.replaceChildren(p);return; }
 container.innerHTML='<div class="loading"><span class="spinner"></span>Loading question...</div>';
 const fragment=document.createDocumentFragment();
 try {
  for(const segment of segments) {
   const canvas=await renderSegment(source,segment,Math.min(window.devicePixelRatio || 1,2)*1.3);
   const image=document.createElement('img');
   image.src=canvas.toDataURL('image/png');
   image.alt=answer?(question.answerText || 'Marking scheme from the original source'):question.text;
   image.className='question-image';image.width=canvas.width;image.height=canvas.height;
   fragment.append(image);
  }
  if(container.isConnected) container.replaceChildren(fragment);
 } catch(error) {
  container.innerHTML='<p class="error-inline">The source could not be loaded. Check your connection and try again.</p>';
  console.error(error);
 }
}
