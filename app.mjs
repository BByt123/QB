import {TYPES,escapeHtml as e,filterQuestions,sampleQuestions,scoreQuiz,validateBackup,restoreQuiz,readStored,writeStored,removeStored} from './lib.mjs';
import {renderQuestion,sourcePage,sourcePageCount} from './rendering.mjs';
import {exportPaper,exportSourcePdf,downloadBlob,chooseSaveLocation} from './exports.mjs';
import {CHAPTERS,canonicalTopic,topicLabel,topicOrder} from './taxonomy.mjs';
import {language,theme,setLanguage,applyTheme,localize,translate} from './preferences.mjs';
import {renderWordPreview,renderWordTextPreview} from './word-preview.mjs';

const $=selector=>document.querySelector(selector);
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const iconButton=(action,name,label,extra='')=>`<button class="icon-button" data-action="${action}" title="${e(label)}" aria-label="${e(label)}" ${extra}>${icon(name)}</button>`;
const hubHref=()=>location.pathname.endsWith('/biology/')||location.pathname.endsWith('/economics/')?'../':location.pathname.replace(/[^/]*$/,'');
const STORAGE='biology-bank-v1';
const QUIZ_STORAGE='biology-quiz-v1';
let bank,questionsById,sourcesById;
let personal={version:1,bookmarks:[],collections:[],overrides:{},history:[]};
let selected=new Set();
let filters={search:'',topic:'',type:'',publisher:'',sort:'topic'};
let page=1,view='home',collectionId='',activeQuestion=null,quiz=null,exporting=false,libraryMode='questions';
let documentState=null,documentToken=0;
const sourcePdfBusy=new Set();
let sourceFilters={search:'',topic:'',publisher:''};
let toastTimer,searchTimer;
let paperTitle='Biology practice paper',paperAnswers=false;
let askSaveLocation=false;
try{paperTitle=readStored('biology-paper-title') || paperTitle;}catch{}
try{askSaveLocation=typeof window.showSaveFilePicker==='function' && readStored('biology-ask-save-location')==='true';}catch{}
const effective=q=>{const result={...q,...Object.fromEntries(Object.entries(personal.overrides[q.id] || {}).filter(([,v])=>v))};result.topic=canonicalTopic(result.topic);return result;};
const icons=()=>{window.lucide?.createIcons();localize();};
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function save(){if(!writeStored(STORAGE,JSON.stringify({...personal,selected:[...selected]})))toast('Browser storage is full or unavailable. Export a backup to keep your changes.');}
function saveQuiz(){
 if(quiz){if(!writeStored(QUIZ_STORAGE,JSON.stringify(quiz)))toast('Quiz progress could not be saved in this browser.');}
 else removeStored(QUIZ_STORAGE);
}
function getFiltered(){
 const collection=personal.collections.find(c=>c.id===collectionId);
 const items=filterQuestions(bank.questions,{...filters,topic:'',savedOnly:view==='saved',bookmarks:personal.bookmarks,collectionIds:view==='collection'?(collection?.ids || []):null,overrides:personal.overrides}).filter(q=>!filters.topic || effective(q).topic===filters.topic);
 const order={MC:0,SQ:1,LQ:2,Essay:3};
 return items.sort((a,b)=>{
  const qa=effective(a),qb=effective(b);
  if(filters.sort==='type')return (order[qa.type]-order[qb.type]) || qa.topic.localeCompare(qb.topic) || a.code.localeCompare(b.code);
  if(filters.sort==='source')return a.publisher.localeCompare(b.publisher) || a.code.localeCompare(b.code);
  return topicOrder(qa.topic)-topicOrder(qb.topic) || qa.topic.localeCompare(qb.topic) || (order[qa.type]-order[qb.type]) || a.code.localeCompare(b.code);
 });
}
function topics(){return CHAPTERS.map(chapter=>chapter.topic);}
function topicOptions(selectedTopic=''){return `<option value="">All chapters</option>${topics().map(t=>`<option value="${e(t)}" ${selectedTopic===t?'selected':''}>${e(topicLabel(t,language))}</option>`).join('')}`;}
function syncNavigation(){
 const mobile=window.matchMedia('(max-width:760px)').matches,open=document.body.classList.contains('nav-open');
 const sidebar=$('.sidebar');if(sidebar)sidebar.inert=mobile && !open;
 const button=$('[data-action="toggle-nav"]');button?.setAttribute('aria-expanded',String(mobile && open));
}
function closeNavigation(){document.body.classList.remove('nav-open');syncNavigation();}
function navButton(id,label,name,count,extra=''){return `<button class="nav-item ${view===id?'active':''}" data-action="navigate" data-view="${id}" ${view===id?'aria-current="page"':''} ${extra}>${icon(name)}<span>${label}</span>${count!==undefined?`<span class="nav-count">${count.toLocaleString()}</span>`:''}</button>`;}
function shell(){
 $('#app').innerHTML=`<div class="sidebar-backdrop" data-action="close-nav"></div><aside class="sidebar" aria-label="Main navigation">
  <a class="brand" href="#home"><span class="brand-symbol">${icon('sprout')}</span><span>Biology Bank<small>DSE Study Library</small></span></a>
  <div class="subject-label"><span class="status-dot"></span> HKDSE Biology</div><a class="subject-switch" href="${e(hubHref())}" title="${e(translate('Switch subject'))}">${icon('arrow-left-right')}<span>${e(translate('Switch subject'))}</span></a>
  <div class="nav-label">WORKSPACE</div><nav>${navButton('home','Home','house')}${navButton('library','Question library','library',bank.questions.length)}${navButton('quiz','Practice quizzes','notebook-pen')}${navButton('saved','Saved questions','bookmark',personal.bookmarks.length)}${navButton('sources','Source documents','files',bank.sources.length)}</nav>
  <div class="nav-label collection-label">COLLECTIONS ${iconButton('new-collection','plus','New collection')}</div><div id="collection-nav">${personal.collections.length?personal.collections.map(c=>`<button class="nav-item ${view==='collection' && collectionId===c.id?'active':''}" data-action="open-collection" data-id="${e(c.id)}">${icon('folder')}<span>${e(c.name)}</span><span class="nav-count">${c.ids.length}</span></button>`).join(''):'<p class="sidebar-empty">No collections yet</p>'}</div>
  <div class="sidebar-bottom"><div class="library-status">${icon('hard-drive')}<span>Saved on this device</span></div>${navButton('settings','Settings & backup','settings-2')}</div>
 </aside><div class="workspace"><header class="topbar"><div class="breadcrumb">${iconButton('toggle-nav','menu','Open navigation')}<span>Workspace</span>${icon('chevron-right')}<strong>${view==='home'?'Home':view==='quiz'?'Practice quizzes':view==='sources'?'Source documents':view==='settings'?'Settings':view==='saved'?'Saved questions':view==='collection'?'Collections':'Question library'}</strong></div><div class="topbar-end"><label class="preference-control">${icon('languages')}<span class="sr-only">Language</span><select id="language-select" aria-label="Language"><option value="en" ${language==='en'?'selected':''}>English</option><option value="zh" ${language==='zh'?'selected':''}>繁體中文</option></select></label><label class="preference-control">${icon('sun-moon')}<span class="sr-only">Appearance</span><select id="theme-select" aria-label="Appearance">${['light','dark','system'].map(value=>`<option value="${value}" ${theme===value?'selected':''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></label></div></header><main id="main" tabindex="-1"></main><footer class="page-footer"><span>Biology Bank</span><span>HKDSE Biology</span></footer></div>`;
  if(view==='home'){
   renderHome();
   for(const tile of $('#main').querySelectorAll('.book-item')){
    const source=sourcesById.get(tile.dataset.id);
    if(source?.illustratedDocumentId)tile.querySelector('.quiet').firstChild.textContent=translate('Illustrated full book')+' ';
   }
  }
 else if(['library','saved','collection'].includes(view))renderLibrary();
 else if(view==='quiz')renderQuiz();
 else if(view==='sources')renderSources();
 else renderSettings();
 icons();syncNavigation();
}
function renderHome(){
 const oxford=bank.sources.filter(s=>s.publisher==='Oxford');
 const tools=[['library','library','Question library','Browse questions','mint'],['quiz','notebook-pen','Practice quizzes','Create a quiz','blue'],['saved','bookmark','Saved questions','Open saved questions','rose'],['sources','files','Source documents','Open documents','lilac']];
 $('#main').innerHTML=`<section class="home-heading"><div class="eyebrow">HKDSE Biology</div><h1>Your study workspace</h1><div class="home-stats"><span><strong>${bank.questions.length.toLocaleString()}</strong> Quiz questions</span><span><strong>${bank.sources.length}</strong> Full documents</span><span><strong>34</strong> Oxford chapters</span></div></section><section class="hub-section" aria-label="Study tools"><div class="section-title"><h2>Study tools</h2>${quiz && !quiz.finished?'<button class="text-button" data-action="navigate" data-view="quiz">Continue quiz</button>':''}</div><div class="hub-grid">${tools.map(([target,name,title,label,color])=>`<button class="hub-tile" data-action="navigate" data-view="${target}"><span class="hub-icon ${color}">${icon(name)}</span><strong>${title}</strong><span>${label}${icon('arrow-right')}</span></button>`).join('')}</div></section><section class="home-documents"><div class="section-title"><h2>Oxford question banks</h2><button class="text-button" data-action="browse-oxford">Browse Oxford ${icon('arrow-right')}</button></div><div class="book-grid">${[...oxford.filter(s=>/^Ch/.test(s.topic)).slice(0,3),oxford.find(s=>s.topic.startsWith('E1'))].filter(Boolean).map((s,i)=>`<button class="book-item" data-action="view-source" data-id="${e(s.id)}"><span class="book-cover cover-${i}"><span>OXFORD</span><strong>${e(s.topic.split(' · ')[0])}</strong><span>${e(s.title.replace(/^Chapter \d+\s*/,''))}</span>${icon('book-open')}</span><strong class="source-title">${e(topicLabel(s.topic,language))}</strong><span class="quiet">Text preview ${icon('arrow-up-right')}</span></button>`).join('')}</div></section><section class="home-library"><div><h2>Question papers</h2><p class="quiet">PDF & Word</p></div><button class="button secondary" data-action="browse-library">${icon('file-stack')}Open library</button><img src="assets/question-preview.png" alt="A page from the biology question bank" width="148" height="190"></section>`;
}
function renderLibrary(){
 const collection=personal.collections.find(c=>c.id===collectionId);
 const title=view==='saved'?'Saved questions':view==='collection'?(collection?.name || 'Collection'):'Question library';
 $('#main').innerHTML=`<section class="page-heading"><div><div class="eyebrow">THE STUDY LIBRARY</div><h1>${e(title)}</h1><p>${view==='library'?'One library. A more focused way to practise.':view==='saved'?'Questions worth coming back to.':'Your questions, brought together.'}</p></div><div class="heading-actions">${view==='collection'?iconButton('edit-collection','pencil','Rename collection',`data-id="${e(collectionId)}"`):''}<button class="button primary" data-action="quiz-config">${icon('shuffle')}<span>Create a quiz</span></button></div></section>
 <section class="metrics" aria-label="Library overview"><div><span class="metric-icon mint">${icon('layers')}</span><div><strong>${bank.questions.length.toLocaleString()}</strong><span>Quiz questions</span></div></div><div><span class="metric-icon lilac">${icon('network')}</span><div><strong>34</strong><span>Oxford chapters</span></div></div><div><span class="metric-icon blue">${icon('files')}</span><div><strong>${bank.sources.length}</strong><span>Full documents</span></div></div><div><span class="metric-icon rose">${icon('bookmark')}</span><div><strong id="saved-metric">${personal.bookmarks.length}</strong><span>Saved for later</span></div></div></section>
 <div class="library-layout"><section class="question-library" aria-label="Question library"><div class="library-section-heading"><h2>Explore questions</h2><span class="quiet">${icon('sliders-horizontal')} Your study, your order</span></div>
 <div class="filter-row"><label class="search-field">${icon('search')}<input id="search" type="search" value="${e(filters.search)}" placeholder="Search questions, keywords or IDs" aria-label="Search questions"></label><label class="topic-select"><span class="filter-label">Oxford chapters</span><select id="topic-filter" aria-label="Oxford chapters">${topicOptions(filters.topic)}</select></label><label><span class="filter-label">Publisher</span><select id="publisher-filter"><option value="">All publishers</option>${[...new Set(bank.sources.map(s=>s.publisher))].map(p=>`<option value="${e(p)}" ${filters.publisher===p?'selected':''}>${e(p)}</option>`).join('')}</select></label></div>
 ${view==='library'?`<div class="library-view-tabs" role="group" aria-label="Library view"><button data-action="library-mode" data-mode="questions" class="${libraryMode==='questions'?'active':''}" aria-pressed="${libraryMode==='questions'}">${icon('list')}Questions <span>${bank.questions.length.toLocaleString()}</span></button><button data-action="library-mode" data-mode="files" class="${libraryMode==='files'?'active':''}" aria-pressed="${libraryMode==='files'}">${icon('files')}Files <span>${bank.sources.length}</span></button></div>`:''}
 <div class="type-tabs" role="group" aria-label="Question type" ${view==='library' && libraryMode==='files'?'hidden':''}><button data-action="type-filter" data-type="" aria-pressed="${!filters.type}" class="${!filters.type?'active':''}">All questions</button>${Object.entries(TYPES).map(([key,name])=>`<button data-action="type-filter" data-type="${key}" aria-pressed="${filters.type===key}" class="${filters.type===key?'active':''}">${name}</button>`).join('')}</div>
 <div id="results"></div></section><aside class="paper-panel" aria-label="Your question paper"><div id="paper-content"></div></aside></div>`;
 renderResults();renderPaper();
}
function renderResults(){
 if(!$('#results'))return;
 if(view==='library' && libraryMode==='files'){renderLibraryFiles();return;}
 const items=getFiltered();const size=12;const pages=Math.max(1,Math.ceil(items.length/size));page=Math.min(page,pages);
 $('#results').innerHTML=`<div class="results-toolbar"><div><strong>${items.length.toLocaleString()}</strong> questions ${filters.search || filters.topic || filters.type || filters.publisher?`<button class="text-button" data-action="clear-filters">Clear filters</button>`:''}</div><label class="sort-label">Sort by <select id="sort"><option value="topic" ${filters.sort==='topic'?'selected':''}>Topic</option><option value="type" ${filters.sort==='type'?'selected':''}>Question type</option><option value="source" ${filters.sort==='source'?'selected':''}>Publisher</option></select></label></div>
 ${items.length?`<div class="select-page"><label><input type="checkbox" id="select-page" ${items.slice((page-1)*size,page*size).every(q=>selected.has(q.id))?'checked':''}> Select this page</label><span>${(page-1)*size+1}-${Math.min(page*size,items.length)} of ${items.length.toLocaleString()}</span></div><div class="question-list">${items.slice((page-1)*size,page*size).map((q,i)=>questionCard(q,(page-1)*size+i+1)).join('')}</div><div class="pagination"><button class="button secondary" data-action="previous-page" ${page===1?'disabled':''}>${icon('chevron-left')} Previous</button><span>Page <strong>${page}</strong> of ${pages}</span><button class="button secondary" data-action="next-page" ${page===pages?'disabled':''}>Next ${icon('chevron-right')}</button></div>`:`<div class="empty-state">${icon('search-x')}<h3>${view==='saved'?'No saved questions yet':view==='collection'?'This collection is empty':'No matching questions'}</h3><p>${view==='saved'?'Your bookmarked questions will appear here.':view==='collection'?'Add selected questions from the library.':'Try another keyword, topic or question type.'}</p><button class="button secondary" data-action="${view==='library'?'clear-filters':'browse-library'}">${view==='library'?'Reset filters':'Browse question library'}</button></div>`}`;
 if(view==='library'){
  const count=matchingSources().length;
  $('#results').insertAdjacentHTML('afterbegin',`<div class="document-strip"><span>${icon('files')}<strong>${count}</strong> documents</span><button class="text-button" data-action="library-mode" data-mode="files">Open documents ${icon('arrow-right')}</button></div>`);
 }
 icons();
}
function matchingSources(search=filters.search){
 const terms=search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 return bank.sources.filter(s=>(!filters.topic || s.topic===filters.topic || s.topics?.includes(filters.topic)) && (!filters.publisher || filters.publisher===s.publisher) && terms.every(term=>`${s.name} ${s.title || ''} ${s.publisher} ${s.topic} ${topicLabel(s.topic,'zh')}`.toLocaleLowerCase().includes(term))).sort((a,b)=>topicOrder(a.topic)-topicOrder(b.topic) || a.name.localeCompare(b.name,undefined,{numeric:true}));
}
function sourceCard(source){
 const destination=documentForSource(source);
 const readLabel=completeBookFor(source) || source.wordEdition==='original'?'Read complete book':'Read document';
 return `<article class="file-item"><span class="file-item-icon ${source.publisher==='Oxford'?'lilac':'mint'}">${icon(source.format==='word-text'?'file-type-2':'file-text')}</span><div class="file-item-main"><span class="file-publisher">${e(source.publisher)} <span>·</span> ${source.format==='word-text'?(source.wordEdition==='text'?'Word preview (text edition)':'Word preview'):'PDF document'}</span><button class="file-item-title source-title" data-action="view-source" data-id="${e(destination.id)}">${e(source.title || source.name)}</button><span class="quiet" data-content>${e(topicLabel(source.topic,language))}</span><small class="source-filename" data-content>${e(source.name)}</small></div><div class="file-item-actions"><button class="button secondary" data-action="view-source" data-id="${e(destination.id)}">${icon('book-open')}<span>${e(translate(readLabel))}</span></button>${sourcePdfButton(source)}${sourceWordButton(source)}</div></article>`;
}
function completeBookFor(source){return source?.illustratedDocumentId?sourcesById.get(source.illustratedDocumentId):null;}
function documentForSource(source){return completeBookFor(source) || source;}
function sourceWordButton(source){
 if(source.format!=='word-text' || !/\.docx$/i.test(source.downloadPath || ''))return '';
 const book=completeBookFor(source),target=book || source;
 const label=book || source.wordEdition==='original'?'Download full DOCX with images':'Download Word (text edition)';
 return `<a class="button secondary source-word" href="${e(target.downloadPath)}" download="${e(target.downloadName || target.name)}" title="${e(translate(label))}" aria-label="${e(translate(label))}">${icon('file-down')}<span>${e(translate(label))}</span></a>`;
}
function sourcePdfButton(source){
 if(source.format!=='word-text')return `<a class="button secondary source-pdf" href="${e(source.path)}" download="${e(source.name)}" title="Download PDF" aria-label="Download PDF">${icon('file-down')}<span>Download PDF</span></a>`;
 return `<button class="button secondary source-pdf" data-action="download-source-pdf" data-id="${e(source.id)}" ${sourcePdfBusy.has(source.id)?'disabled':''} title="Download PDF (text edition)" aria-label="Download PDF (text edition)">${icon('file-down')}<span>${sourcePdfBusy.has(source.id)?'Preparing PDF...':'Download PDF'}</span></button>`;
}
async function downloadSourcePdf(id){
 const source=sourcesById.get(id);if(!source || sourcePdfBusy.has(id))return;
 const title=source.name.replace(/\.docx?$/i,'')+' (text edition)';
 const handlePromise=askSaveLocation?chooseSaveLocation(title,'pdf'):Promise.resolve(null);
 sourcePdfBusy.add(id);document.querySelectorAll('[data-action="download-source-pdf"]').forEach(button=>{if(button.dataset.id===id){button.disabled=true;button.setAttribute('aria-busy','true');button.querySelector('span').textContent=translate('Preparing PDF...');}});
 try{
  const outputHandle=await handlePromise,response=await fetch(new URL(source.textPath,document.baseURI));if(!response.ok)throw Error('Document could not be loaded.');
  await exportSourcePdf({source,text:await response.text(),title,outputHandle});toast('PDF document saved.');
 }catch(error){if(error.name!=='AbortError'){console.error(error);toast(`Export failed: ${error.message}`);}}
 finally{sourcePdfBusy.delete(id);document.querySelectorAll('[data-action="download-source-pdf"]').forEach(button=>{if(button.dataset.id===id){button.disabled=false;button.removeAttribute('aria-busy');button.querySelector('span').textContent=translate('Download PDF');}});}
}
function renderLibraryFiles(){
 const sources=matchingSources(),size=16,pages=Math.max(1,Math.ceil(sources.length/size));page=Math.min(page,pages);
 $('#results').innerHTML=`<div class="results-toolbar"><span><strong>${sources.length}</strong> documents</span><button class="text-button" data-action="clear-filters">Clear filters</button></div>${filters.publisher==='Oxford'?'<p class="source-note">Oxford files preview and download as DOCX. Legacy files are labelled text editions; their diagrams, equations and original layout may be missing.</p>':''}<div class="file-list">${sources.slice((page-1)*size,page*size).map(sourceCard).join('')}</div>${sources.length?`<div class="pagination"><button class="button secondary" data-action="previous-page" ${page===1?'disabled':''}>${icon('chevron-left')}Previous</button><span>Page <strong>${page}</strong> of ${pages}</span><button class="button secondary" data-action="next-page" ${page===pages?'disabled':''}>Next${icon('chevron-right')}</button></div>`:'<div class="empty-history">No matching documents.</div>'}`;
 icons();
}
function questionCard(original,number){
 const q=effective(original),saved=personal.bookmarks.includes(q.id);
 const summary=q.text.replace(/\n/g,' ').replace(/^[\s\uF000-\uFFFF]+/,'');
 return `<article class="question-card ${selected.has(q.id)?'selected':''}"><div class="question-card-top"><label class="question-check"><input type="checkbox" data-select="${e(q.id)}" ${selected.has(q.id)?'checked':''} aria-label="Select question ${e(q.code)}"><span class="question-number">${String(number).padStart(2,'0')}</span></label><span class="type-badge ${q.type.toLowerCase()}">${e(TYPES[q.type] || q.type)}</span><span class="source-label">${e(q.publisher)}</span><span class="card-spacer"></span><button class="icon-button bookmark ${saved?'is-saved':''}" data-action="bookmark" data-id="${e(q.id)}" aria-pressed="${saved}" title="${saved?'Remove bookmark':'Save question'}" aria-label="${saved?'Remove bookmark':'Save question'}">${icon('bookmark')}</button></div><button class="question-preview" data-action="view-question" data-id="${e(q.id)}">${e(summary)}</button><div class="question-card-bottom"><span class="question-topic">${icon('folder-open')}${e(topicLabel(q.topic,language))}</span><span class="question-code">${e(q.code)}</span>${view==='collection'?iconButton('remove-from-collection','x',`Remove ${q.code} from this collection`,`data-id="${e(q.id)}"`):''}<button class="open-question" data-action="view-question" data-id="${e(q.id)}" aria-label="Open question ${e(q.code)}" title="Open question">${icon('arrow-up-right')}</button></div></article>`;
}
function renderPaper(){
 const target=$('#paper-content');if(!target)return;
 const items=[...selected].map(id=>questionsById.get(id)).filter(Boolean);
 const priorTitle=$('#paper-title')?.value ?? paperTitle;
 const includeAnswers=$('#include-answers')?.checked ?? paperAnswers;
 target.innerHTML=`<div class="paper-heading"><span class="paper-icon">${icon('file-stack')}</span><span class="count-badge">${items.length}</span></div><h2>Your question paper</h2><p class="quiet">${items.length?'A focused set, ready for practice.':'A fresh page for your next session.'}</p>${items.length?`<div class="paper-summary"><span>${items.length} questions</span><span>${items.reduce((n,q)=>n+(q.marks || 0),0)} known marks</span></div><ol class="paper-list">${items.slice(0,8).map(q=>`<li><span><b>${e(q.type)}</b>${e(effective(q).topic.replace(/^Chapter \d+ · /,''))}</span>${iconButton('remove-paper','x',`Remove ${q.code}`,`data-id="${e(q.id)}"`)}</li>`).join('')}</ol>${items.length>8?`<p class="quiet">+ ${items.length-8} more questions</p>`:''}<div class="paper-commands"><button class="text-button" data-action="save-collection">${icon('folder-plus')}Add to collection</button><button class="text-button danger-text" data-action="clear-paper">Clear</button></div>`:`<div class="paper-empty-art"><img src="assets/paper-study.svg" alt="A question sheet with a botanical specimen" width="230" height="180"></div>`}<div class="paper-export"><label for="paper-title">Paper name</label><input id="paper-title" maxlength="100" value="${e(priorTitle)}"><label class="checkbox-label"><input id="include-answers" type="checkbox" ${includeAnswers?'checked':''}> Include answer key</label><button class="button primary full" data-action="export-pdf" ${!items.length || exporting?'disabled':''}>${icon('file-down')}Download PDF</button><button class="button secondary full" data-action="export-word" ${!items.length || exporting?'disabled':''}>${icon('file-text')}Download Word</button><div id="export-progress" class="export-progress" aria-live="polite"></div></div><div class="paper-footnote">${icon('lock-keyhole')}<span>Your selections stay on this device.</span></div>`;
 $('#include-answers').closest('label').insertAdjacentHTML('afterend',`<label class="checkbox-label location-checkbox"><input id="ask-save-location" type="checkbox" ${askSaveLocation?'checked':''} ${typeof window.showSaveFilePicker==='function'?'':'disabled'}> Choose save folder and file name</label>${typeof window.showSaveFilePicker==='function'?'':'<p class="location-hint">This browser uses its configured Downloads location.</p>'}`);
 icons();
}
function openModal(content,className=''){
 documentToken++;
 const dialog=$('#dialog');const focused=dialog.contains(document.activeElement)?document.activeElement:null;
 const action=focused?.dataset.action,tab=focused?.dataset.tab;
 dialog.className=className;dialog.innerHTML=content;if(!dialog.open)dialog.showModal();
 if(action){const replacement=[...dialog.querySelectorAll('[data-action]')].find(el=>el.dataset.action===action && el.dataset.tab===tab);(replacement || dialog.querySelector('button,input,select,textarea'))?.focus();}
 icons();
}
function modalHeader(title,subtitle=''){return `<header class="dialog-header"><div><h2 id="dialog-title">${e(title)}</h2>${subtitle?`<p>${e(subtitle)}</p>`:''}</div>${iconButton('close-dialog','x','Close dialog')}</header>`;}
async function showQuestion(id,tab='question'){
 const original=questionsById.get(id);if(!original)return;activeQuestion=id;const q=effective(original);const source=sourcesById.get(q.sourceId);
 openModal(`${modalHeader(TYPES[q.type] || q.type,q.topic)}<div class="question-dialog-meta"><span>${e(q.code)}</span><span>${e(q.publisher)}</span><a class="text-button" href="${e(source.path)}#page=${q.segments[0]?.page || 1}" target="_blank" rel="noopener">Original source ${icon('external-link')}</a></div><div class="dialog-tabs"><button data-action="question-tab" data-tab="question" class="${tab==='question'?'active':''}">Question</button><button data-action="question-tab" data-tab="answer" class="${tab==='answer'?'active':''}">Answer key</button><button data-action="question-tab" data-tab="organize" class="${tab==='organize'?'active':''}">Organize</button></div><div class="dialog-body">${tab==='organize'?`<form data-form="organize"><label>Topic<input name="topic" required maxlength="120" list="topic-options" value="${e(q.topic)}"></label><datalist id="topic-options">${topics().map(t=>`<option value="${e(t)}">`).join('')}</datalist><label>Question type<select name="type">${Object.entries(TYPES).map(([key,name])=>`<option value="${key}" ${q.type===key?'selected':''}>${name}</option>`).join('')}</select></label><label>Tags<input name="tags" maxlength="300" value="${e(q.tags || '')}" placeholder="e.g. revision, difficult"></label><button class="button primary" type="submit">${icon('check')}Save category</button></form>`:'<div id="question-render" class="question-render"></div>'}</div><footer class="dialog-footer"><button class="button secondary" data-action="bookmark" data-id="${e(q.id)}">${icon('bookmark')}${personal.bookmarks.includes(q.id)?'Saved':'Save question'}</button><button class="button primary" data-action="toggle-paper-question" data-id="${e(q.id)}">${icon(selected.has(q.id)?'check':'plus')}${selected.has(q.id)?'Added to paper':'Add to paper'}</button></footer>`,'question-dialog');
 const sourceLink=$('.question-dialog-meta a');
 if(sourceLink){const documentSource=documentForSource(source),button=document.createElement('button');button.className='text-button';button.dataset.action='view-source';button.dataset.id=documentSource.id;button.dataset.page=q.segments[0]?.page || 1;button.dataset.backQuestion=id;button.innerHTML=`${e(translate(documentSource===source?'Original source':'View complete illustrated book'))} ${icon('book-open')}`;sourceLink.replaceWith(button);}
 const subtitle=$('.dialog-header p');if(subtitle)subtitle.textContent=topicLabel(q.topic,language);
 icons();
 if(tab!=='organize')await renderQuestion($('#question-render'),original,source,tab==='answer');
}
async function showDocument(id,number=1,backQuestion=''){
 const source=sourcesById.get(id);if(!source)return;
 const previewNotice=source.wordEdition==='original'?'Word preview includes supported formatting, tables and images. Pagination and complex Word elements may differ from the downloaded file.':'Word text edition preview. Original diagrams, equations and formatting are not included.';
 let token;
 documentState={id,page:Math.max(1,Number(number) || 1),zoom:1,pages:source.pages || 1,backQuestion};
 openModal(`${modalHeader(source.title || source.name,topicLabel(source.topic,language))}<div class="document-actions">${backQuestion?'<button class="text-button" data-action="back-to-question">'+icon('arrow-left')+'Back to question</button>':''}<span>${e(source.publisher)}</span>${sourceWordButton(source)}</div>${source.format==='word-text'?'<p class="preview-notice">'+icon('info')+'<span>'+e(translate(previewNotice))+'</span></p>':`<div class="document-toolbar">${iconButton('document-prev','chevron-left','Previous page')}<label><span>Page</span><input id="document-page" aria-label="Document page" type="number" min="1" max="${documentState.pages}" value="${documentState.page}"><span id="document-page-count">/ ${documentState.pages}</span></label>${iconButton('document-next','chevron-right','Next page')}<span class="toolbar-divider"></span>${iconButton('document-zoom-out','minus','Zoom out')}<output id="document-zoom">100%</output>${iconButton('document-zoom-in','plus','Zoom in')}${iconButton('document-fit','maximize','Fit width')}</div>`}<div id="document-content" class="document-content" aria-live="polite"><div class="loading"><span class="spinner"></span>Loading document...</div></div>`,'document-dialog');
 token=documentToken;
 $('.document-actions').insertAdjacentHTML('beforeend',sourcePdfButton(source));
 icons();
 try{
  if(source.format==='word-text'){
   let rendered=false;
   if(source.wordPreviewPath){
    try{
     const response=await fetch(new URL(source.wordPreviewPath,document.baseURI));if(!response.ok)throw Error('Word preview could not be loaded.');
     const preview=await response.json();if(token!==documentToken || !$('#document-content'))return;
     renderWordPreview($('#document-content'),preview,{translate});rendered=true;
    }catch{/* Older deployments can still display the extracted text. */}
   }
   if(!rendered){
    const response=await fetch(new URL(source.textPath || source.path,document.baseURI));if(!response.ok)throw Error('Document could not be loaded.');
    const text=source.textPath?await response.text():(await response.json()).text;
    if(token!==documentToken || !$('#document-content'))return;
    renderWordTextPreview($('#document-content'),text,{translate});
    $('.preview-notice span').textContent=translate('Text preview only. Diagrams are not included. Word downloads are labelled as original files or text editions.');
   }
  }else{
   const pages=await sourcePageCount(source);if(token!==documentToken)return;
   documentState.pages=pages;documentState.page=Math.min(documentState.page,pages);
   $('#document-page').max=pages;$('#document-page-count').textContent=`/ ${pages}`;
   await renderDocumentPage();
  }
 }catch(error){if(token===documentToken && $('#document-content')){$('#document-content').innerHTML='<div class="error-inline"><p>Document could not be loaded.</p><button class="button secondary" data-action="retry-document">Retry</button></div>';icons();}console.error(error);}
}
async function renderDocumentPage(){
 if(!documentState || !$('#document-content'))return;
 const state=documentState,token=++documentToken,source=sourcesById.get(state.id);
 state.page=Math.max(1,Math.min(state.pages,state.page));
 $('#document-page').value=state.page;$('#document-zoom').textContent=`${Math.round(state.zoom*100)}%`;
 $('[data-action="document-prev"]').disabled=state.page===1;$('[data-action="document-next"]').disabled=state.page===state.pages;
 $('[data-action="document-zoom-out"]').disabled=state.zoom<=.6;$('[data-action="document-zoom-in"]').disabled=state.zoom>=2;
 $('#document-content').innerHTML='<div class="loading"><span class="spinner"></span>Loading document...</div>';
 try{
  const canvas=await sourcePage(source,state.page,Math.min(devicePixelRatio || 1,2)*state.zoom*1.2);
  if(token!==documentToken || !$('#document-content'))return;
  const image=document.createElement('img');image.className='document-page-image';image.src=canvas.toDataURL('image/png');image.alt=`${source.name} · ${translate('Page')} ${state.page}`;image.style.width=`${Math.round(state.zoom*100)}%`;image.width=canvas.width;image.height=canvas.height;
  $('#document-content').replaceChildren(image);$('#document-content').scrollTop=0;
 }catch(error){if(token===documentToken && $('#document-content')){$('#document-content').innerHTML='<div class="error-inline"><p>Document could not be loaded.</p><button class="button secondary" data-action="retry-document">Retry</button></div>';icons();}console.error(error);}
}
function collectionDialog(id=''){
 const c=personal.collections.find(c=>c.id===id);
 openModal(`${modalHeader(c?'Rename collection':'New collection')}<form class="dialog-body" data-form="collection" data-id="${e(id)}"><label>Collection name<input name="name" required maxlength="80" autofocus value="${e(c?.name || '')}" placeholder="e.g. Cell biology revision"></label><div class="form-actions">${c?`<button type="button" class="text-button danger-text" data-action="delete-collection" data-id="${e(c.id)}">Delete collection</button>`:''}<button class="button primary" type="submit">${icon('check')}${c?'Save name':'Create collection'}</button></div></form>`);
}
function saveCollectionDialog(){
 if(!selected.size)return toast('Select questions to add to a collection.');
 openModal(`${modalHeader('Add to a collection',`${selected.size} selected questions`)}<form class="dialog-body" data-form="add-collection"><label>Collection<select name="collection"><option value="">Create a new collection</option>${personal.collections.map(c=>`<option value="${e(c.id)}">${e(c.name)}</option>`).join('')}</select></label><label>New collection name<input name="name" maxlength="80" placeholder="e.g. Next week revision"></label><button class="button primary" type="submit">${icon('folder-plus')}Add questions</button></form>`);
}
function quizConfig(){
 const defaultType=filters.type || 'MC';
 openModal(`${modalHeader('Create a practice quiz','A new set for your next study session.')}<form class="dialog-body" data-form="quiz"><fieldset><legend>Topics</legend><label class="checkbox-label"><input type="checkbox" id="quiz-all-topics" ${!filters.topic?'checked':''}> All topics</label><div class="quiz-topic-list">${topics().map(t=>`<label class="checkbox-label"><input type="checkbox" name="topics" value="${e(t)}" ${!filters.topic || filters.topic===t?'checked':''}>${e(t)}</label>`).join('')}</div></fieldset><div class="form-grid"><label>Question type<select name="type"><option value="">Mixed questions</option>${Object.entries(TYPES).map(([key,name])=>`<option value="${key}" ${defaultType===key?'selected':''}>${name}</option>`).join('')}</select></label><label>Quiz mode<select name="mode"><option value="exercise">Exercise · reveal after each answer</option><option value="exam">Exam · reveal after submit</option></select></label><label>Number of questions<input name="count" type="number" min="1" max="50" value="10" required></label><label>Time limit (minutes)<input name="minutes" type="number" min="0" max="180" value="0" required></label><label>Question pool<select name="pool"><option value="all">Entire library</option><option value="saved">Saved questions</option>${selected.size?'<option value="selected">Selected questions</option>':''}${personal.collections.map(c=>`<option value="${e(c.id)}">${e(c.name)}</option>`).join('')}</select></label></div><p class="field-error" id="quiz-config-error" role="alert"></p><button class="button primary full" type="submit">${icon('play')}Start quiz</button></form>`,'quiz-config-dialog');
 const form=$('[data-form="quiz"]');
 form.insertAdjacentHTML('afterbegin',`<label class="quiz-publisher-field"><span>Question bank</span><select id="quiz-publisher" name="publisher"><option value="">Oxford and Aristo</option>${['Oxford','Aristo'].map(p=>`<option value="${p}" ${filters.publisher===p?'selected':''}>${p}</option>`).join('')}</select></label><p class="quiet quiz-bank-note">Oxford quizzes use standalone text questions; questions needing missing figures are excluded.</p><p class="quiet quiz-available" id="quiz-available" role="status"></p>`);
 updateQuizConfig();
 icons();
}
function quizPool(form){
 const pool=form.elements.pool.value;
 const ids=pool==='saved'?personal.bookmarks:pool==='selected'?[...selected]:personal.collections.find(c=>c.id===pool)?.ids;
 return filterQuestions(bank.questions,{publisher:form.elements.publisher.value,type:form.elements.type.value,overrides:personal.overrides,collectionIds:ids || null});
}
function updateQuizConfig(){
 const form=$('[data-form="quiz"]');if(!form)return;
 const counts=new Map();quizPool(form).forEach(q=>{const topic=effective(q).topic;counts.set(topic,(counts.get(topic) || 0)+1);});
 const inputs=[...form.querySelectorAll('[name="topics"]')],all=$('#quiz-all-topics'),selectAll=all.checked;
 inputs.forEach(input=>{const count=counts.get(input.value) || 0;input.disabled=!count;if(!count)input.checked=false;else if(selectAll)input.checked=true;input.parentElement.lastChild.textContent=`${topicLabel(input.value,language)} (${count})`;input.parentElement.classList.toggle('unavailable',!count);});
 const enabled=inputs.filter(input=>!input.disabled),checked=enabled.filter(input=>input.checked);
 all.disabled=!enabled.length;all.checked=!!enabled.length && checked.length===enabled.length;all.indeterminate=!!checked.length && checked.length<enabled.length;
 const count=checked.reduce((n,input)=>n+counts.get(input.value),0);
 $('#quiz-available').textContent=translate(`${count} matching questions`);
 form.querySelector('button[type="submit"]').disabled=!count;
 $('#quiz-config-error').textContent='';
}
function quizQuestions(){return (quiz?.ids || []).map(id=>questionsById.get(id)).filter(Boolean).map(effective);}
function updateAnswered(){
 const items=quizQuestions(),score=scoreQuiz(items,quiz.responses);
 const status=$('.quiz-navigation>p');if(status)status.textContent=`${score.answered} of ${items.length} answered`;
 const nav=$(`[data-action="quiz-jump"][data-index="${quiz.current}"]`);
 nav?.classList.toggle('answered',Boolean(String(quiz.responses[items[quiz.current]?.id] || '').trim()));
}
function quizResponse(q){return String(quiz?.responses?.[q.id] || '').trim();}
function quizFeedbackVisible(q){return Boolean(quiz?.finished || (quiz?.mode==='exercise' && quizResponse(q)));}
function quizReviewMarkup(q,reveal){
 const max=Number.isFinite(Number(q.marks)) && Number(q.marks)>0?Number(q.marks):'';
 return `<div id="quiz-feedback" class="quiz-review" ${reveal?'':'hidden'}><h3>${q.type==='MC'?(q.answer?`Correct answer: ${e(q.answer)}`:'Answer key'):'Marking scheme'}</h3>${q.type!=='MC'?`<label class="mark-input">Awarded mark${max?` (out of ${max})`:''}<input id="written-mark" type="number" min="0" ${max?`max="${max}"`:''} step="1" value="${quiz.marks?.[q.id] ?? ''}" aria-label="Awarded mark"></label><p class="quiet">Written answers are self-assessed against the marking scheme.</p>`:''}<div id="quiz-answer-render" class="question-render"></div></div>`;
}
function historyId(){return crypto.randomUUID?.() || `history-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
function recordQuizHistory(status='completed'){
 if(!quiz)return;
 const score=scoreQuiz(quizQuestions(),quiz.responses);
 const date=status==='completed' && quiz.finishedAt?quiz.finishedAt:new Date().toISOString();
 personal.history.unshift({id:historyId(),date,started:quiz.started,count:score.count,answered:score.answered,correct:score.correct,total:score.total,mode:quiz.mode,status});
 personal.history=personal.history.slice(0,50);
 save();
}
function addQuizLeaveButtons(){
 if(!quiz || quiz.finished)return;
 $('.page-heading')?.insertAdjacentHTML('beforeend',`<button class="button secondary" data-action="leave-quiz">${icon('log-out')}Leave & save</button>`);
 $('.quiz-navigation')?.insertAdjacentHTML('beforeend',`<button class="text-button" data-action="leave-quiz">${icon('log-out')}Leave & save</button>`);
 icons();
}
function renderQuiz(){
 if(quiz && quizQuestions().length){renderActiveQuiz();return;}
 $('#main').innerHTML=`<section class="page-heading"><div><div class="eyebrow">MAKE TIME FOR PRACTICE</div><h1>Practice quizzes</h1><p>A few questions. A clearer understanding.</p></div><button class="button primary" data-action="quiz-config">${icon('plus')}Create a quiz</button></section><section class="quiz-intro"><div class="quiz-intro-art"><img src="assets/paper-study.svg" width="230" height="180" alt="Biology practice paper"></div><div><h2>Your next study session starts here.</h2><p>Choose your topics and question types.</p><button class="button primary" data-action="quiz-config">${icon('shuffle')}Set up a quiz</button></div></section><section class="history-section"><div class="section-title"><h2>Recent sessions</h2>${personal.history.length?`<button class="text-button danger-text" data-action="clear-history">${icon('trash-2')}Delete all</button>`:''}</div>${personal.history.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Questions</th><th>Progress</th><th>Result</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${personal.history.map(h=>`<tr><td>${e(new Date(h.date).toLocaleDateString())}</td><td>${e(h.count)}</td><td>${e(h.answered ?? 0)} / ${e(h.count)}</td><td>${h.status==='left'?'Left early':h.total?`${Math.round(h.correct/h.total*100)}%`:'Completed'}</td><td>${iconButton('delete-history','trash-2','Delete session',`data-id="${e(h.id)}"`)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-history">Your quiz sessions will appear here.</div>'}</section>`;
 icons();
}
 async function renderActiveQuiz(){
  const items=quizQuestions();if(!items.length)return;
  quiz.current=Math.max(0,Math.min(quiz.current || 0,items.length-1));
  const q=items[quiz.current],result=scoreQuiz(items,quiz.responses),reveal=quizFeedbackVisible(q),atEnd=quiz.current===items.length-1;
  $('#main').innerHTML=`<section class="page-heading"><div><div class="eyebrow">${quiz.finished?'SESSION COMPLETE':'IN PRACTICE'}</div><h1>${quiz.finished?'Your quiz results':'Biology practice'}</h1><p>${items.length} questions · ${[...new Set(items.map(item=>item.topic))].length} topics · ${quiz.mode==='exercise'?'Exercise':'Exam'} mode</p></div><div class="heading-actions">${!quiz.finished&&quiz.deadline?`<span class="timer">${icon('timer')}<span id="quiz-timer"></span></span>`:''}<button class="button ${quiz.finished?'secondary':'primary'}" data-action="${quiz.finished?'new-quiz':'finish-quiz'}">${icon(quiz.finished?'plus':'flag')}${quiz.finished?'New quiz':'Finish quiz'}</button></div></section>${quiz.finished?`<section class="quiz-score"><div><strong>${result.percent===null?'Complete':result.percent+'%'}</strong><span>${result.total?'Multiple-choice score':'Written practice'}</span></div><div><strong>${result.correct} / ${result.total}</strong><span>Correct MC answers</span></div><div><strong>${result.answered} / ${result.count}</strong><span>Questions answered</span></div><button class="button secondary" data-action="quiz-to-paper">${icon('file-stack')}Add quiz to paper</button></section>`:''}<div class="quiz-workspace"><aside class="quiz-navigation"><h2>Questions</h2><div class="quiz-numbers">${items.map((item,i)=>{const itemReveal=quiz.finished||(quiz.mode==='exercise'&&quizResponse(item));const state=itemReveal&&item.answer?(quiz.responses[item.id]===item.answer?'correct':'incorrect'):'';return `<button class="${i===quiz.current?'current':''} ${quiz.responses[item.id]?'answered':''} ${state}" data-action="quiz-jump" data-index="${i}" aria-label="Question ${i+1}" ${i===quiz.current?'aria-current="step"':''}>${i+1}</button>`;}).join('')}</div><p class="quiet">${result.answered} of ${items.length} answered</p>${quiz.finished?'':'<button class="text-button danger-text" data-action="discard-quiz">Discard session</button>'}</aside><section class="quiz-question"><div class="quiz-question-heading"><span class="type-badge ${q.type.toLowerCase()}">${TYPES[q.type]}</span><span>Question ${quiz.current+1} of ${items.length}</span><span class="quiz-publisher">${e(q.publisher)}</span><span class="quiet">${e(q.code)}</span></div><div id="quiz-render" class="question-render"></div>${q.type==='MC'?`<fieldset class="answer-options"><legend>Your answer</legend>${['A','B','C','D'].map(letter=>{const state=reveal&&q.answer?(q.answer===letter?'correct-option':quiz.responses[q.id]===letter?'incorrect-option':''):'';return `<label class="answer-option ${quiz.responses[q.id]===letter?'chosen':''} ${state}"><input type="radio" name="quiz-answer" value="${letter}" ${quiz.responses[q.id]===letter?'checked':''} ${quiz.finished?'disabled':''}><span>${letter}</span>${reveal&&q.answer===letter?icon('check'):''}</label>`;}).join('')}</fieldset>`:`<label class="written-answer">Your answer<textarea id="written-answer" rows="6" placeholder="Write your response..." ${quiz.finished?'readonly':''}>${e(quiz.responses[q.id]||'')}</textarea></label>`}${quizReviewMarkup(q,reveal)}<div class="quiz-question-footer"><button class="button secondary" data-action="quiz-prev" ${quiz.current===0?'disabled':''}>${icon('chevron-left')}Previous</button><button class="button secondary" data-action="quiz-next">${atEnd?icon('check')+'Submit quiz':'Next'+icon('chevron-right')}</button></div></section></div>`;
  icons();updateTimer();addQuizLeaveButtons();
  const savedInQuiz=personal.bookmarks.includes(q.id),bookmarkLabel=translate(savedInQuiz?'Remove bookmark':'Save question');
  $('.quiz-question-heading').insertAdjacentHTML('beforeend',`<button class="icon-button bookmark quiz-bookmark ${savedInQuiz?'is-saved':''}" data-action="bookmark" data-id="${e(q.id)}" aria-pressed="${savedInQuiz}" title="${e(bookmarkLabel)}" aria-label="${e(bookmarkLabel)}">${icon('bookmark')}</button>`);
  window.lucide?.createIcons();
  renderQuestion($('#quiz-render'),q,sourcesById.get(q.sourceId));
  if(reveal){const review=$('#quiz-feedback');if(review)review.dataset.rendered='true';renderQuestion($('#quiz-answer-render'),q,sourcesById.get(q.sourceId),true);}
 }
 function showQuizFeedback(){
  const q=quizQuestions()[quiz?.current];if(!q || !quizFeedbackVisible(q))return;
  const review=$('#quiz-feedback');if(!review)return;
  review.hidden=false;
  if(!review.dataset.rendered){review.dataset.rendered='true';renderQuestion($('#quiz-answer-render'),q,sourcesById.get(q.sourceId),true);}
 }
 function finishQuiz(){
 if(!quiz || quiz.finished)return;
 quiz.finished=true;quiz.finishedAt=new Date().toISOString();
  recordQuizHistory('completed');saveQuiz();if(view==='quiz')renderActiveQuiz();
}
 function leaveQuiz(){
  if(!quiz || quiz.finished)return;
  recordQuizHistory('left');quiz=null;saveQuiz();renderQuiz();toast('Quiz saved to history.');
 }
function updateTimer(){
 if(!quiz || quiz.finished || !quiz.deadline)return;
 const remaining=Math.max(0,Math.ceil((quiz.deadline-Date.now())/1000));
 const target=$('#quiz-timer');if(target)target.textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
 if(remaining===0){finishQuiz();toast('Time is up. Your quiz has been submitted.');}
}
function renderSources(){
 $('#main').innerHTML=`<section class="page-heading"><div><div class="eyebrow">FROM YOUR BOOKSHELF</div><h1>Source documents</h1></div><span class="source-total">${bank.sources.length} documents</span></section><div class="filter-row source-filters"><label class="search-field">${icon('search')}<input type="search" id="source-search" value="${e(sourceFilters.search)}" aria-label="Search source documents" placeholder="Search document names, topics or publishers"></label><label class="topic-select"><span class="filter-label">Oxford chapters</span><select id="source-topic">${topicOptions(sourceFilters.topic)}</select></label><label><span class="filter-label">Publisher</span><select id="source-publisher"><option value="">All publishers</option>${['Oxford','Aristo'].map(p=>`<option value="${p}" ${sourceFilters.publisher===p?'selected':''}>${p}</option>`).join('')}</select></label></div><div id="source-results"></div>`;
 renderSourceResults(sourceFilters.search);
}
function renderSourceResults(search){
 const terms=search.toLowerCase().trim().split(/\s+/).filter(Boolean);
 const sources=bank.sources.filter(s=>(!sourceFilters.topic || s.topic===sourceFilters.topic || s.topics?.includes(sourceFilters.topic)) && (!sourceFilters.publisher || s.publisher===sourceFilters.publisher) && terms.every(term=>`${s.name} ${s.title || ''} ${s.publisher} ${s.topic} ${topicLabel(s.topic,'zh')}`.toLowerCase().includes(term)));
 $('#source-results').innerHTML=`<div class="results-toolbar"><span><strong>${sources.length}</strong> documents</span></div><div class="file-list">${sources.map(sourceCard).join('')}</div>${!sources.length?'<div class="empty-history">No matching documents.</div>':''}`;icons();
}
function renderSettings(){
 $('#main').innerHTML=`<section class="page-heading"><div><div class="eyebrow">YOUR WORKSPACE</div><h1>Settings & backup</h1><p>Keep your study library close.</p></div></section><section class="settings-section"><div><h2>Personal library</h2><p>Bookmarks, collections, categories and quiz history.</p></div><div class="settings-actions"><button class="button primary" data-action="backup">${icon('download')}Export backup</button><label class="button secondary file-button">${icon('upload')}Import backup<input id="import-backup" type="file" accept=".json,application/json"></label></div></section><section class="settings-section"><div><h2>Library details</h2><p>${bank.questions.length.toLocaleString()} questions · ${bank.sources.length} source documents · ${bank.topics.length} topics</p><p>Last indexed ${e(new Date(bank.generated).toLocaleDateString())}</p></div><span class="version-label">Version 1.0</span></section><section class="settings-section"><div><h2>Device data</h2><p>${personal.bookmarks.length} saved questions · ${personal.collections.length} collections · ${personal.history.length} completed sessions</p></div><button class="button danger" data-action="reset-data">${icon('trash-2')}Reset personal data</button></section>`;
 $('#main .page-heading').insertAdjacentHTML('afterend',`<section class="settings-section"><div><h2>Display preferences</h2><p>Question text stays in its original language.</p></div><div class="settings-preferences"><label>Language<select id="settings-language"><option value="en" ${language==='en'?'selected':''}>English</option><option value="zh" ${language==='zh'?'selected':''}>繁體中文</option></select></label><label>Appearance<select id="settings-theme">${['light','dark','system'].map(value=>`<option value="${value}" ${theme===value?'selected':''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></label></div></section>`);
}
function navigate(target,id=''){
 closeNavigation();
 if(target==='collection')location.hash=`collection/${encodeURIComponent(id)}`;
 else location.hash=target;
 if(view===target && collectionId===id)shell();
}
function route(){const [target,id]=location.hash.slice(1).split('/');view=['home','library','saved','quiz','sources','settings','collection'].includes(target)?target:'home';try{collectionId=id?decodeURIComponent(id):'';}catch{collectionId='';}if(view==='collection' && !personal.collections.some(c=>c.id===collectionId))view='library';page=1;closeNavigation();shell();window.scrollTo(0,0);}
async function handleExport(format){
 if(exporting)return;const items=[...selected].map(id=>questionsById.get(id)).filter(Boolean);
 const title=$('#paper-title')?.value.trim() || 'Biology practice paper',includeAnswers=$('#include-answers')?.checked;
 const handlePromise=askSaveLocation?chooseSaveLocation(title,format):Promise.resolve(null);
 exporting=true;document.querySelectorAll('[data-action="export-pdf"],[data-action="export-word"]').forEach(b=>b.disabled=true);
 try{const outputHandle=await handlePromise;await exportPaper({questions:items.map(effective),sources:bank.sources,title,format,includeAnswers,outputHandle,onProgress:(i,total)=>{const target=$('#export-progress');if(target)target.textContent=`Preparing ${i} of ${total} questions...`;}});toast(`${format==='pdf'?'PDF':'Word'} paper saved.`);}
 catch(error){if(error.name!=='AbortError'){console.error(error);toast(`Export failed: ${error.message}`);}}
 finally{exporting=false;renderPaper();}
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]');if(!button || button.disabled)return;
 const {action,id}=button.dataset;
 if(action==='navigate')navigate(button.dataset.view);
 else if(action==='open-collection')navigate('collection',id);
 else if(action==='browse-library'){libraryMode='questions';if(filters.publisher==='Oxford')filters.publisher='';navigate('library');}
 else if(action==='browse-oxford'){libraryMode='files';filters={search:'',topic:'',type:'',publisher:'Oxford',sort:'topic'};navigate('library');}
 else if(action==='library-mode'){libraryMode=button.dataset.mode;page=1;renderLibrary();icons();}
  else if(action==='view-source')showDocument(documentForSource(sourcesById.get(id))?.id || id,button.dataset.page,button.dataset.backQuestion);
 else if(action==='download-source-pdf')await downloadSourcePdf(id);
 else if(action==='back-to-question')showQuestion(documentState.backQuestion);
 else if(action==='retry-document'){if(sourcesById.get(documentState.id).format==='word-text')showDocument(documentState.id,1,documentState.backQuestion);else renderDocumentPage();}
 else if(action==='document-prev' || action==='document-next'){documentState.page+=action==='document-next'?1:-1;renderDocumentPage();}
 else if(['document-zoom-out','document-zoom-in','document-fit'].includes(action)){documentState.zoom=action==='document-fit'?1:Math.max(.6,Math.min(2,Math.round((documentState.zoom+(action==='document-zoom-in'?.2:-.2))*10)/10));renderDocumentPage();}
 else if(action==='toggle-nav'){document.body.classList.toggle('nav-open');syncNavigation();if(document.body.classList.contains('nav-open'))$('.sidebar button')?.focus();}
 else if(action==='close-nav'){closeNavigation();$('[data-action="toggle-nav"]')?.focus();}
 else if(action==='close-dialog'){documentToken++;$('#dialog').close();}
 else if(action==='view-question')showQuestion(id);
 else if(action==='question-tab')showQuestion(activeQuestion,button.dataset.tab);
 else if(action==='type-filter'){filters.type=button.dataset.type;page=1;document.querySelectorAll('.type-tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.type===filters.type);b.setAttribute('aria-pressed',String(b.dataset.type===filters.type));});renderResults();}
 else if(action==='clear-filters'){filters={search:'',topic:'',type:'',publisher:'',sort:'topic'};page=1;renderLibrary();icons();}
 else if(action==='previous-page' || action==='next-page'){page+=action==='next-page'?1:-1;renderResults();$('.library-section-heading')?.scrollIntoView({block:'start'});}
 else if(action==='bookmark'){
  personal.bookmarks=personal.bookmarks.includes(id)?personal.bookmarks.filter(x=>x!==id):[...personal.bookmarks,id];save();
  const quizBookmark=$('.quiz-question-heading .quiz-bookmark');
  if(quizBookmark?.dataset.id===id){const saved=personal.bookmarks.includes(id),label=translate(saved?'Remove bookmark':'Save question');quizBookmark.classList.toggle('is-saved',saved);quizBookmark.setAttribute('aria-pressed',String(saved));quizBookmark.setAttribute('aria-label',label);quizBookmark.title=label;}
  if($('#dialog').open && activeQuestion===id)showQuestion(id);renderResults();
  const metric=$('#saved-metric');if(metric)metric.textContent=personal.bookmarks.length;
  const count=$('[data-view="saved"] .nav-count');if(count)count.textContent=personal.bookmarks.length;
 }
 else if(action==='toggle-paper-question'){selected.has(id)?selected.delete(id):selected.add(id);save();renderPaper();renderResults();showQuestion(id);}
 else if(action==='remove-paper'){selected.delete(id);save();renderPaper();renderResults();}
 else if(action==='remove-from-collection'){const c=personal.collections.find(c=>c.id===collectionId);if(c){c.ids=c.ids.filter(qid=>qid!==id);save();shell();toast('Question removed from collection.');}}
 else if(action==='clear-paper'){selected.clear();save();renderPaper();renderResults();}
 else if(action==='new-collection')collectionDialog();
 else if(action==='edit-collection')collectionDialog(id);
 else if(action==='save-collection')saveCollectionDialog();
 else if(action==='delete-collection'){personal.collections=personal.collections.filter(c=>c.id!==id);save();$('#dialog').close();navigate('library');shell();toast('Collection deleted.');}
 else if(action==='quiz-config'){
  if(quiz && !quiz.finished)openModal(`${modalHeader('Continue your quiz')}<div class="dialog-body"><p>You have a quiz in progress.</p><div class="form-actions"><button class="button secondary" data-action="replace-quiz">Start a new quiz</button><button class="button primary" data-action="resume-quiz">Resume quiz</button></div></div>`);
  else quizConfig();
 }
 else if(action==='resume-quiz'){$('#dialog').close();navigate('quiz');}
 else if(action==='replace-quiz' || action==='new-quiz')quizConfig();
 else if(action==='quiz-jump' || action==='quiz-prev' || action==='quiz-next'){if(action==='quiz-next' && quiz.current===quizQuestions().length-1)finishQuiz();else{quiz.current=action==='quiz-jump'?Number(button.dataset.index):quiz.current+(action==='quiz-next'?1:-1);saveQuiz();renderActiveQuiz();}}
 else if(action==='finish-quiz')finishQuiz();
  else if(action==='leave-quiz')leaveQuiz();
  else if(action==='delete-history'){personal.history=personal.history.filter(h=>h.id!==id);save();renderQuiz();}
  else if(action==='clear-history')openModal(`${modalHeader('Delete quiz history')}<div class="dialog-body"><p>All saved quiz sessions will be removed from this device.</p><div class="form-actions"><button class="button secondary" data-action="close-dialog">Cancel</button><button class="button danger" data-action="confirm-clear-history">Delete all</button></div></div>`);
  else if(action==='confirm-clear-history'){personal.history=[];save();$('#dialog').close();renderQuiz();toast('Quiz history deleted.');}
  else if(action==='discard-quiz')openModal(`${modalHeader('Discard this session')}<div class="dialog-body"><p>Your answers in this session will be removed.</p><div class="form-actions"><button class="button secondary" data-action="close-dialog">Keep practising</button><button class="button danger" data-action="confirm-discard">Discard session</button></div></div>`);
 else if(action==='confirm-discard'){quiz=null;saveQuiz();$('#dialog').close();renderQuiz();icons();}
 else if(action==='quiz-to-paper'){quiz.ids.forEach(id=>selected.add(id));save();navigate('library');toast('Quiz questions added to your paper.');}
 else if(action==='export-pdf' || action==='export-word')handleExport(action==='export-pdf'?'pdf':'word');
 else if(action==='backup'){
  try{const outputHandle=askSaveLocation?await chooseSaveLocation('biology-bank-backup','json'):null;await downloadBlob(new Blob([JSON.stringify(personal,null,2)],{type:'application/json'}),'biology-bank-backup.json',outputHandle);}
  catch(error){if(error.name!=='AbortError')toast(`Backup failed: ${error.message}`);}
 }
 else if(action==='reset-data')openModal(`${modalHeader('Reset personal data')}<div class="dialog-body"><p>This removes bookmarks, collections, categories and quiz history saved on this device.</p><div class="form-actions"><button class="button secondary" data-action="close-dialog">Cancel</button><button class="button danger" data-action="confirm-reset">Reset data</button></div></div>`);
 else if(action==='confirm-reset'){personal={version:1,bookmarks:[],collections:[],overrides:{},history:[]};selected.clear();quiz=null;save();saveQuiz();$('#dialog').close();shell();toast('Personal data reset.');}
});
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();$('#main')?.focus();$('#main')?.scrollIntoView({block:'start'});});
document.addEventListener('input',event=>{
 const target=event.target;
 if(target.id==='search'){filters.search=target.value;page=1;clearTimeout(searchTimer);searchTimer=setTimeout(renderResults,120);}
 else if(target.id==='source-search'){sourceFilters.search=target.value;renderSourceResults(target.value);}
 else if(target.id==='paper-title'){paperTitle=target.value;writeStored('biology-paper-title',target.value);}
  else if(target.id==='written-answer' && quiz && !quiz.finished){quiz.responses[quizQuestions()[quiz.current].id]=target.value;saveQuiz();updateAnswered();if(quiz.mode==='exercise')showQuizFeedback();}
  else if(target.id==='written-mark' && quiz){const id=quizQuestions()[quiz.current]?.id;if(id){quiz.marks=quiz.marks||{};if(target.value==='')delete quiz.marks[id];else quiz.marks[id]=Number(target.value);saveQuiz();}}
});
document.addEventListener('change',async event=>{
 const target=event.target;
 if(['language-select','settings-language'].includes(target.id)){setLanguage(target.value);shell();}
 else if(['theme-select','settings-theme'].includes(target.id)){applyTheme(target.value);document.querySelectorAll('#theme-select,#settings-theme').forEach(select=>select.value=theme);}
 else if(target.id==='document-page'){const value=Number(target.value);if(Number.isFinite(value)){documentState.page=Math.trunc(value);renderDocumentPage();}}
 else if(['source-topic','source-publisher'].includes(target.id)){sourceFilters[target.id==='source-topic'?'topic':'publisher']=target.value;renderSourceResults(sourceFilters.search);}
 else if(target.id==='include-answers')paperAnswers=target.checked;
 else if(target.id==='ask-save-location'){askSaveLocation=target.checked;writeStored('biology-ask-save-location',String(askSaveLocation));}
 else if(['topic-filter','publisher-filter','sort'].includes(target.id)){filters[{'topic-filter':'topic','publisher-filter':'publisher',sort:'sort'}[target.id]]=target.value;page=1;renderResults();}
 else if(target.dataset.select){target.checked?selected.add(target.dataset.select):selected.delete(target.dataset.select);save();renderPaper();renderResults();}
 else if(target.id==='select-page'){getFiltered().slice((page-1)*12,page*12).forEach(q=>target.checked?selected.add(q.id):selected.delete(q.id));save();renderPaper();renderResults();}
 else if(target.closest('[data-form="quiz"]') && ['publisher','type','pool'].includes(target.name))updateQuizConfig();
 else if(target.id==='quiz-all-topics'){document.querySelectorAll('[name="topics"]:not(:disabled)').forEach(c=>c.checked=target.checked);updateQuizConfig();}
 else if(target.name==='topics'){$('#quiz-all-topics').checked=false;updateQuizConfig();}
  else if(target.name==='quiz-answer' && quiz && !quiz.finished){quiz.responses[quizQuestions()[quiz.current].id]=target.value;saveQuiz();if(quiz.mode==='exercise')renderActiveQuiz();else{document.querySelectorAll('.answer-option').forEach(label=>label.classList.toggle('chosen',label.querySelector('input').checked));updateAnswered();}}
 else if(target.id==='import-backup'){
  try{const file=target.files[0];if(!file)return;if(file.size>5*1024*1024)throw new Error('Backup must be smaller than 5 MB.');const restored=validateBackup(JSON.parse(await file.text()),bank.questions.map(q=>q.id));personal={...restored,bookmarks:[...new Set([...personal.bookmarks,...restored.bookmarks])],collections:[...personal.collections.filter(c=>!restored.collections.some(r=>r.id===c.id)),...restored.collections],overrides:{...personal.overrides,...restored.overrides}};save();shell();toast('Backup imported.');}catch(error){toast(error.message);}target.value='';
 }
});
document.addEventListener('submit',event=>{
 const form=event.target;if(!form.dataset.form)return;event.preventDefault();const data=new FormData(form);
 if(form.dataset.form==='collection'){
  const name=data.get('name').trim();if(!name)return;const c=personal.collections.find(c=>c.id===form.dataset.id);
  if(c)c.name=name;else personal.collections.push({id:crypto.randomUUID(),name,ids:[]});save();$('#dialog').close();shell();toast(c?'Collection renamed.':'Collection created.');
 } else if(form.dataset.form==='add-collection'){
  let c=personal.collections.find(c=>c.id===data.get('collection'));
  if(!c){const name=data.get('name').trim();if(!name){form.elements.name.setCustomValidity('Enter a collection name.');form.elements.name.reportValidity();form.elements.name.addEventListener('input',()=>form.elements.name.setCustomValidity(''),{once:true});return;}c={id:crypto.randomUUID(),name,ids:[]};personal.collections.push(c);}
  c.ids=[...new Set([...c.ids,...selected])];save();$('#dialog').close();shell();toast('Questions added to collection.');
 } else if(form.dataset.form==='organize'){
  personal.overrides[activeQuestion]={topic:data.get('topic').trim(),type:data.get('type'),tags:data.get('tags').trim()};save();showQuestion(activeQuestion);if(['library','saved','collection'].includes(view))renderLibrary();icons();toast('Question category updated.');
 } else if(form.dataset.form==='quiz'){
  const selectedTopics=data.getAll('topics');const count=Number(data.get('count'));const minutes=Number(data.get('minutes'));
  if(!selectedTopics.length){$('#quiz-config-error').textContent='Choose at least one topic.';return;}
  const candidates=quizPool(form).filter(q=>selectedTopics.includes(effective(q).topic));
  if(!candidates.length){$('#quiz-config-error').textContent='No questions match this topic, type and question pool.';return;}
  const items=sampleQuestions(candidates,count);
  quiz={ids:items.map(q=>q.id),responses:{},marks:{},current:0,mode:data.get('mode')==='exercise'?'exercise':'exam',started:new Date().toISOString(),deadline:minutes?Date.now()+minutes*60000:null,finished:false};saveQuiz();$('#dialog').close();navigate('quiz');if(view==='quiz')renderActiveQuiz();if(items.length<count)toast(`Started with ${items.length} available questions.`);
 }
});
$('#dialog').addEventListener('click',event=>{if(event.target===$('#dialog')){const rect=$('#dialog').getBoundingClientRect();if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)$('#dialog').close();}});
window.addEventListener('hashchange',()=>{route();syncNavigation();$('#main')?.focus();});
window.addEventListener('resize',syncNavigation);
document.addEventListener('keydown',event=>{if(event.key==='Escape' && document.body.classList.contains('nav-open')){closeNavigation();$('[data-action="toggle-nav"]')?.focus();}});
setInterval(updateTimer,1000);
async function start(){
 try{
  const response=await fetch(new URL('bank/index.json',document.baseURI));if(!response.ok)throw new Error('Question index is unavailable.');bank=await response.json();
  const oxfordResponse=await fetch(new URL('bank/oxford/catalog.json',document.baseURI));if(!oxfordResponse.ok)throw new Error('Oxford catalog is unavailable.');
  const oxford=await oxfordResponse.json();bank.sources=[...oxford.sources,...bank.sources.filter(s=>s.publisher!=='Oxford')];
  const quizResponse=await fetch(new URL(oxford.quizPath,document.baseURI));if(!quizResponse.ok)throw new Error('Oxford question index is unavailable.');
  const oxfordQuiz=await quizResponse.json();bank.questions=[...bank.questions.filter(q=>q.publisher!=='Oxford'),...oxfordQuiz.questions];
  bank.questions.forEach(q=>{q.sourceTopic=q.topic;q.topic=canonicalTopic(q.topic);});bank.sources.forEach(s=>{if(s.publisher!=='Oxford')s.topic=canonicalTopic(s.topic);});
  bank.topics=CHAPTERS.map(c=>c.topic);
  questionsById=new Map(bank.questions.map(q=>[q.id,q]));sourcesById=new Map(bank.sources.map(s=>[s.id,s]));
  try{const raw=JSON.parse(readStored(STORAGE));if(raw){personal=validateBackup(raw,questionsById.keys());selected=new Set((Array.isArray(raw.selected)?raw.selected:[]).filter(id=>questionsById.has(id)));}}catch(error){console.warn('Personal library could not be restored',error);}
  try{quiz=restoreQuiz(JSON.parse(readStored(QUIZ_STORAGE)),questionsById.keys());}catch{}
  route();updateTimer();
 }catch(error){console.error(error);$('#app').innerHTML=`<main class="startup"><span class="brand-symbol">${icon('sprout')}</span><h1>The library could not be loaded</h1><p>Check your connection and reload the page.</p><button class="button primary" onclick="location.reload()">Reload library</button></main>`;icons();}
}
start();
