import { renderSegment } from './rendering.mjs';
import { safeFilename } from './lib.mjs';
const textFor=value=>String(value).replace(/[^\x20-\x7E\n]/g,' ').replace(/\s+/g,' ').trim();
export async function downloadBlob(blob,filename,outputHandle=null) {
 if(outputHandle){const writable=await outputHandle.createWritable();await writable.write(blob);await writable.close();return;}
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function chooseSaveLocation(title,format) {
 if(typeof window.showSaveFilePicker!=='function')return null;
 const extension=format==='pdf'?'pdf':format==='word'?'docx':'json';
 const descriptions={pdf:'PDF document',word:'Word document',json:'JSON backup'};
 return window.showSaveFilePicker({suggestedName:`${safeFilename(title)}.${extension}`,types:[{description:descriptions[format] || 'File',accept:{[extension==='pdf'?'application/pdf':extension==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/json']:[`.${extension}`]}}]});
}
export async function exportPaper({questions,sources,title='Biology practice paper',format='pdf',includeAnswers=false,outputHandle=null,onProgress=()=>{}}) {
 if(!questions.length) throw new Error('Select at least one question.');
 if(questions.length>100) throw new Error('Export up to 100 questions per paper.');
 const sourceMap=new Map(sources.map(s=>[s.id,s]));
 if(format==='pdf') {
  const {PDFDocument,StandardFonts,rgb}=window.PDFLib;
  const pdfDoc=await PDFDocument.create();
  const regular=await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold=await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page,y;
  const newPage=()=>{page=pdfDoc.addPage([595.28,841.89]);y=792;};
  const line=(text,size=11,font=regular)=>{
   const words=textFor(text).split(' ').flatMap(word=>{
    const chunks=[];let part='';
    for(const char of word){if(part && font.widthOfTextAtSize(part+char,size)>500){chunks.push(part);part='';}part+=char;}
    chunks.push(part);return chunks;
   });let row='';
   for(const word of words) { const next=row?`${row} ${word}`:word;if(font.widthOfTextAtSize(next,size)>500 && row) {if(y<60)newPage();page.drawText(row,{x:46,y,size,font});y-=size*1.5;row=word;}else row=next; }
   if(row){if(y<60)newPage();page.drawText(row,{x:46,y,size,font});y-=size*1.5;}
  };
  const richLine=async(text,size=11,font=regular)=>{
   if(/^[\x20-\x7E]*$/.test(text)){line(text,size,font);return;}
   const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=Math.ceil(size*3.4);
   const ctx=canvas.getContext('2d');ctx.font=`${font===bold?'bold ':''}${size*2}px Arial, sans-serif`;ctx.textBaseline='top';
   let row='';const rows=[];
   for(const char of text){if(ctx.measureText(row+char).width>990 && row){rows.push(row);row='';}row+=char;}
   if(row)rows.push(row);
   for(const textRow of rows){
    if(y<size*1.6+52)newPage();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';ctx.fillText(textRow,0,0);
    const data=await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer();
    const image=await pdfDoc.embedPng(data);page.drawImage(image,{x:46,y:y-canvas.height/2+size*.2,width:500,height:canvas.height/2});y-=size*1.6;
   }
  };
  newPage();await richLine(title,21,bold);y-=8;
  line(`${questions.length} questions | HKDSE Biology`,10);line('Name: __________________________   Date: __________________');y-=22;
  const imageBlock=async(source,segment)=>{
   const canvas=await renderSegment(source,segment,1.7);
   const data=await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer();
   const image=await pdfDoc.embedPng(data);
   const width=Math.min(503,segment.width);
   const naturalHeight=width*image.height/image.width;
   const scale=Math.min(1,710/naturalHeight);
   const h=naturalHeight*scale,w=width*scale;
   if(y-h<52)newPage();
   page.drawImage(image,{x:46,y:y-h,width:w,height:h});y-=h+10;
  };
  for(let i=0;i<questions.length;i++) {
   const q=questions[i];onProgress(i,questions.length);
   if(y<150)newPage();
   line(`Question ${i+1} | ${q.type} | ${q.code}`,10,bold);
   await richLine(q.topic,9);y-=4;
   for(const segment of q.segments) await imageBlock(sourceMap.get(q.sourceId),segment);
   y-=20;
  }
  if(includeAnswers){newPage();line('Answer key and marking schemes',19,bold);y-=15;
   for(let i=0;i<questions.length;i++){const q=questions[i];if(y<130)newPage();line(`Question ${i+1} | ${q.code}`,10,bold);
    if(q.answer)line(`Correct answer: ${q.answer}`);
    else if(q.answerSegments.length) for(const segment of q.answerSegments)await imageBlock(sourceMap.get(q.sourceId),segment);
    else line(q.answerText || 'No marking scheme is available in the source.');y-=15;
   }
  }
  for(const [i,p] of pdfDoc.getPages().entries())p.drawText(`${i+1} / ${pdfDoc.getPageCount()}    Biology Bank`,{x:46,y:28,size:8,font:regular,color:rgb(.4,.4,.4)});
  await downloadBlob(new Blob([await pdfDoc.save()],{type:'application/pdf'}),`${safeFilename(title)}.pdf`,outputHandle);
 } else {
  const {Document,Packer,Paragraph,TextRun,ImageRun,HeadingLevel,PageBreak}=window.docx;
  const children=[new Paragraph({text:title,heading:HeadingLevel.TITLE}),new Paragraph(`${questions.length} questions | HKDSE Biology`),new Paragraph('Name: __________________________   Date: __________________'),new Paragraph('')];
  const addImage=async(q,segment)=>{
   const canvas=await renderSegment(sourceMap.get(q.sourceId),segment,1.7);
   const data=new Uint8Array(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer());
   const w=Math.min(640,segment.width*1.2);const h=w*canvas.height/canvas.width;const ratio=Math.min(1,870/h);
   children.push(new Paragraph({children:[new ImageRun({data,type:'png',transformation:{width:Math.round(w*ratio),height:Math.round(h*ratio)},altText:{title:q.code,description:q.text,name:q.code}})],spacing:{after:150}}));
  };
  for(let i=0;i<questions.length;i++) {
   const q=questions[i];onProgress(i,questions.length);
   children.push(new Paragraph({text:`Question ${i+1} | ${q.type} | ${q.code}`,heading:HeadingLevel.HEADING_2,keepNext:true}),new Paragraph({children:[new TextRun({text:q.topic,size:19,color:'555555'})],keepNext:true}));
   for(const segment of q.segments)await addImage(q,segment);
   children.push(new Paragraph(''));
  }
  if(includeAnswers){children.push(new Paragraph({children:[new PageBreak()]}),new Paragraph({text:'Answer key and marking schemes',heading:HeadingLevel.HEADING_1}));
   for(let i=0;i<questions.length;i++){const q=questions[i];children.push(new Paragraph({text:`Question ${i+1} | ${q.code}`,heading:HeadingLevel.HEADING_2,keepNext:true}));
    if(q.answer)children.push(new Paragraph(`Correct answer: ${q.answer}`));
    else if(q.answerSegments.length)for(const segment of q.answerSegments)await addImage(q,segment);
    else children.push(new Paragraph(q.answerText || 'No marking scheme is available in the source.'));
   }
  }
  const doc=new Document({creator:'Biology Bank',title,styles:{default:{document:{run:{font:'Arial',size:22,color:'000000'}},title:{run:{color:'000000'}},heading1:{run:{color:'000000'}},heading2:{run:{color:'000000'}}}},sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:800,bottom:800,left:800,right:800}}},children}]});
  await downloadBlob(await Packer.toBlob(doc),`${safeFilename(title)}.docx`,outputHandle);
 }
 onProgress(questions.length,questions.length);
}
