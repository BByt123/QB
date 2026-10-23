// Static previews are generated from the same DOCX files offered for download.
const assetPath=/^bank[/]oxford[/]preview-media[/][a-f0-9]{24}[.](png|jpe?g|gif|webp)$/;
const textOf=block=>(block.runs || []).filter(run=>run.type==='text').map(run=>run.text).join('');
function lineEstimate(block){
 if(block.type==='table')return block.rows.reduce((total,row)=>total+Math.max(1,...row.map(cell=>cell.blocks.reduce((sum,item)=>sum+lineEstimate(item),0))),0);
 return Math.max(1,...textOf(block).split('\n').map(line=>Math.ceil(line.length/72)))+(block.heading?3:0)+(block.runs || []).filter(run=>run.type!=='text').length*12;
}
function renderBlock(block,doc,translate){
 if(block.type==='table'){
  const wrapper=doc.createElement('div');wrapper.className='word-table-scroll';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label',translate('Document table'));
  const table=doc.createElement('table'),body=doc.createElement('tbody');table.className='word-table';
  for(const row of block.rows){
   const tr=doc.createElement('tr');
   for(const cell of row){const td=doc.createElement('td');td.colSpan=Math.max(1,Math.min(64,Number(cell.span) || 1));for(const item of cell.blocks)td.append(renderBlock(item,doc,translate));tr.append(td);}
   body.append(tr);
  }
  table.append(body);wrapper.append(table);return wrapper;
 }
 const paragraph=doc.createElement(block.heading===1?'h3':block.heading===2?'h4':'p');paragraph.className='word-paragraph';
 if(['left','center','right','justify'].includes(block.align))paragraph.style.textAlign=block.align;
 for(const run of block.runs || []){
  if(run.type==='text'){
   const span=doc.createElement(run.vertical==='sub'?'sub':run.vertical==='super'?'sup':'span');span.textContent=run.text;
   if(run.bold)span.style.fontWeight='700';if(run.italic)span.style.fontStyle='italic';if(run.underline)span.style.textDecoration='underline';
   if(Number.isFinite(run.size))span.style.fontSize=`${Math.max(8,Math.min(26,run.size))/12}em`;
   paragraph.append(span);
  }else if(run.type==='image' && assetPath.test(run.path)){
   const image=doc.createElement('img');image.className='word-image';image.src=new URL(run.path,doc.baseURI).href;image.alt=translate(run.alt || 'Document image');image.loading='lazy';image.decoding='async';
   image.addEventListener('error',()=>{const note=doc.createElement('span');note.className='word-image-unavailable';note.textContent=translate('This image is available in the downloaded Word file.');image.replaceWith(note);},{once:true});
   paragraph.append(image);
  }else if(run.type==='unavailable'){const note=doc.createElement('span');note.className='word-image-unavailable';note.textContent=translate('This image is available in the downloaded Word file.');paragraph.append(note);}
 }
 if(!paragraph.childNodes.length)paragraph.append(doc.createElement('br'));
 return paragraph;
}
export function renderWordPreview(container,preview,{translate=text=>text}={}){
 if(preview.version!==1 || !Array.isArray(preview.blocks) || !preview.blocks.length)throw Error('Invalid Word preview.');
 const doc=container.ownerDocument,wrapper=doc.createElement('div');wrapper.className='document-word-preview';wrapper.dataset.edition=preview.edition;
 let sheet,body,lines=0;
 function addSheet(){
  sheet=doc.createElement('article');sheet.className='document-word-sheet';sheet.setAttribute('aria-label',`${translate('Page')} ${wrapper.childElementCount+1}`);
  body=doc.createElement('div');body.className='document-text';body.dataset.content='';sheet.append(body);wrapper.append(sheet);lines=0;
 }
 for(const block of preview.blocks){
  const size=lineEstimate(block);
  if(!body || (body.childElementCount && (block.pageBreak || lines+size>52 && lines>12)))addSheet();
  body.append(renderBlock(block,doc,translate));lines+=size;
 }
 container.replaceChildren(wrapper);
 return wrapper;
}
export function renderWordTextPreview(container,text,{translate=value=>value}={}){
 const blocks=text.split(/\r?\n/).map(line=>({type:'paragraph',runs:[{type:'text',text:line}],heading:0}));
 return renderWordPreview(container,{version:1,edition:'text',blocks},{translate});
}
