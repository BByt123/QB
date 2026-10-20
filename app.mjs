import {TYPES,escapeHtml as e,filterQuestions,sampleQuestions,scoreQuiz,validateBackup,restoreQuiz} from './lib.mjs';
import {renderQuestion} from './rendering.mjs';
import {exportPaper,downloadBlob,chooseSaveLocation} from './exports.mjs';

const $=selector=>document.querySelector(selector);
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const iconButton=(action,name,label,extra='')=>`<button class="icon-button" data-action="${action}" title="${e(label)}" aria-label="${e(label)}" ${extra}>${icon(name)}</button>`;
const STORAGE='biology-bank-v1';
const QUIZ_STORAGE='biology-quiz-v1';
let bank,questionsById,sourcesById;
let personal={version:1,bookmarks:[],collections:[],overrides:{},history:[]};
let selected=new Set();
let filters={search:'',topic:'',type:'',publisher:'',sort:'topic'};
let page=1,view='library',collectionId='',activeQuestion=null,quiz=null,exporting=false;
let toastTimer,searchTimer;
let paperTitle='Biology practice paper',paperAnswers=false;
let askSaveLocation=false;
try{paperTitle=sessionStorage.getItem('biology-paper-title') || paperTitle;}catch{}
try{askSaveLocation=typeof window.showSaveFilePicker==='function' && localStorage.getItem('biology-ask-save-location')==='true';}catch{}
const effective=q=>({...q,...Object.fromEntries(Object.entries(personal.overrides[q.id] || {}).filter(([,v])=>v))});
const icons=()=>window.lucide?.createIcons();
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({...personal,selected:[...selected]}));}catch{toast('Browser storage is full or unavailable. Export a backup to keep your changes.');}}
function saveQuiz(){try{if(quiz)localStorage.setItem(QUIZ_STORAGE,JSON.stringify(quiz));else localStorage.removeItem(QUIZ_STORAGE);}catch{toast('Quiz progress could not be saved in this browser.');}}
function getFiltered(){
 const collection=personal.collections.find(c=>c.id===collectionId);
 const items=filterQuestions(bank.questions,{...filters,savedOnly:view==='saved',bookmarks:personal.bookmarks,collectionIds:view==='collection'?(collection?.ids || []):null,overrides:personal.overrides});
 const order={MC:0,SQ:1,LQ:2,Essay:3};
 return items.sort((a,b)=>{
  const qa=effective(a),qb=effective(b);
  if(filters.sort==='type')return (order[qa.type]-order[qb.type]) || qa.topic.localeCompare(qb.topic) || a.code.localeCompare(b.code);
  if(filters.sort==='source')return a.publisher.localeCompare(b.publisher) || a.code.localeCompare(b.code);
  return qa.topic.localeCompare(qb.topic) || (order[qa.type]-order[qb.type]) || a.code.localeCompare(b.code);
 });
}
function topics(){return [...new Set([...bank.topics,...Object.values(personal.overrides).map(o=>o.topic).filter(Boolean)])].sort();}
function syncNavigation(){
 const mobile=window.matchMedia('(max-width:760px)').matches,open=document.body.classList.contains('nav-open');
 const sidebar=$('.sidebar');if(sidebar)sidebar.inert=mobile && !open;
 const button=$('[data-action="toggle-nav"]');button?.setAttribute('aria-expanded',String(mobile && open));
}
function closeNavigation(){document.body.classList.remove('nav-open');syncNavigation();}
function navButton(id,label,name,count,extra=''){return `<button class="nav-item ${view===id?'active':''}" data-action="navigate" data-view="${id}" ${view===id?'aria-current="page"':''} ${extra}>${icon(name)}<span>${label}</span>${count!==undefined?`<span class="nav-count">${count.toLocaleString()}</span>`:''}</button>`;}
function shell(){
 $('#app').innerHTML=`<div class="sidebar-backdrop" data-action="close-nav"></div><aside class="sidebar" aria-label="Main navigation">
  <a class="brand" href="#library"><span class="brand-symbol">${icon('sprout')}</span><span>Biology Bank<small>DSE STUDY LIBRARY</small></span></a>
  <div class="subject-label"><span class="status-dot"></span> HKDSE Biology <span class="subject-year">EN</span></div>
  <div class="nav-label">WORKSPACE</div><nav>${navButton('library','Question library','library',bank.questions.length)}${navButton('saved','Saved questions','bookmark',personal.bookmarks.length)}${navButton('quiz','Practice quizzes','notebook-pen')}${navButton('sources','Source documents','files',bank.sources.length)}</nav>
  <div class="nav-label collection-label">COLLECTIONS ${iconButton('new-collection','plus','New collection')}</div><div id="collection-nav">${personal.collections.length?personal.collections.map(c=>`<button class="nav-item ${view==='collection' && collectionId===c.id?'active':''}" data-action="open-collection" data-id="${e(c.id)}">${icon('folder')}<span>${e(c.name)}</span><span class="nav-count">${c.ids.length}</span></button>`).join(''):'<p class="sidebar-empty">No collections yet</p>'}</div>
  <div class="sidebar-bottom"><div class="library-status">${icon('circle-check')}<span>Library ready<small>${bank.sources.length} source documents</small></span></div>${navButton('settings','Settings & backup','settings-2')}<div class="sidebar-footer">A little progress, every day.</div></div>
 </aside><div class="workspace"><header class="topbar"><div class="breadcrumb">${iconButton('toggle-nav','menu','Open navigation')}<span>Workspace</span>${icon('chevron-right')}<strong>${view==='quiz'?'Practice quizzes':view==='sources'?'Source documents':view==='settings'?'Settings':view==='saved'?'Saved questions':view==='collection'?'Collections':'Question library'}</strong></div><div class="topbar-end"><span class="local-status"><span class="status-dot"></span> Saved on this device</span><span class="avatar">B</span></div></header><main id="main" tabindex="-1"></main><footer class="page-footer"><span>Biology Bank</span><span>HKDSE Biology · English edition</span></footer></div>`;
 if(['library','saved','collection'].includes(view))renderLibrary();
 else if(view==='quiz')renderQuiz();
 else if(view==='sources')renderSources();
 else renderSettings();
 icons();syncNavigation();
}
function renderLibrary(){
 const collection=personal.collections.find(c=>c.id===collectionId);
 const title=view==='saved'?'Saved questions':view==='collection'?(collection?.name || 'Collection'):'Your biology question bank';
 $('#main').innerHTML=`<section class="page-heading"><div><div class="eyebrow">THE STUDY LIBRARY</div><h1>${e(title)}</h1><p>${view==='library'?'One library. A more focused way to practise.':view==='saved'?'Questions worth coming back to.':'Your questions, brought together.'}</p></div><div class="heading-actions">${view==='collection'?iconButton('edit-collection','pencil','Rename collection',`data-id="${e(collectionId)}"`):''}<button class="button primary" data-action="quiz-config">${icon('shuffle')}<span>Create a quiz</span></button></div></section>
 <section class="metrics" aria-label="Library overview"><div><span class="metric-icon mint">${icon('layers')}</span><div><strong>${bank.questions.length.toLocaleString()}</strong><span>Questions in the bank</span></div></div><div><span class="metric-icon apricot">${icon('network')}</span><div><strong>${bank.topics.length}</strong><span>Biology topics</span></div></div><div><span class="metric-icon blue">${icon('files')}</span><div><strong>${bank.sources.length}</strong><span>Source documents</span></div></div><div><span class="metric-icon rose">${icon('bookmark')}</span><div><strong id="saved-metric">${personal.bookmarks.length}</strong><span>Saved for later</span></div></div></section>
 <div class="library-layout"><section class="question-library" aria-label="Question library"><div class="library-section-heading"><h2>Explore questions</h2><span class="quiet">${icon('sliders-horizontal')} Your study, your order</span></div>
 <div class="filter-row"><label class="search-field">${icon('search')}<input id="search" type="search" value="${e(filters.search)}" placeholder="Search questions, keywords or IDs" aria-label="Search questions"></label><label class="topic-select"><span class="sr-only">Topic</span><select id="topic-filter"><option value="">All topics</option>${topics().map(t=>`<option ${filters.topic===t?'selected':''}>${e(t)}</option>`).join('')}</select></label><label><span class="sr-only">Publisher</span><select id="publisher-filter"><option value="">All publishers</option>${[...new Set(bank.sources.map(s=>s.publisher))].map(p=>`<option ${filters.publisher===p?'selected':''}>${e(p)}</option>`).join('')}</select></label></div>
 <div class="type-tabs" role="group" aria-label="Question type"><button data-action="type-filter" data-type="" aria-pressed="${!filters.type}" class="${!filters.type?'active':''}">All questions</button>${Object.entries(TYPES).map(([key,name])=>`<button data-action="type-filter" data-type="${key}" aria-pressed="${filters.type===key}" class="${filters.type===key?'active':''}">${name}</button>`).join('')}</div>
 <div id="results"></div></section><aside class="paper-panel" aria-label="Your question paper"><div id="paper-content"></div></aside></div>`;
 renderResults();renderPaper();
}
function renderResults(){
 if(!$('#results'))return;
 const items=getFiltered();const size=12;const pages=Math.max(1,Math.ceil(items.length/size));page=Math.min(page,pages);
 $('#results').innerHTML=`<div class="results-toolbar"><div><strong>${items.length.toLocaleString()}</strong> questions ${filters.search || filters.topic || filters.type || filters.publisher?`<button class="text-button" data-action="clear-filters">Clear filters</button>`:''}</div><label class="sort-label">Sort by <select id="sort"><option value="topic" ${filters.sort==='topic'?'selected':''}>Topic</option><option value="type" ${filters.sort==='type'?'selected':''}>Question type</option><option value="source" ${filters.sort==='source'?'selected':''}>Publisher</option></select></label></div>
 ${items.length?`<div class="select-page"><label><input type="checkbox" id="select-page" ${items.slice((page-1)*size,page*size).every(q=>selected.has(q.id))?'checked':''}> Select this page</label><span>${(page-1)*size+1}-${Math.min(page*size,items.length)} of ${items.length.toLocaleString()}</span></div><div class="question-list">${items.slice((page-1)*size,page*size).map((q,i)=>questionCard(q,(page-1)*size+i+1)).join('')}</div><div class="pagination"><button class="button secondary" data-action="previous-page" ${page===1?'disabled':''}>${icon('chevron-left')} Previous</button><span>Page <strong>${page}</strong> of ${pages}</span><button class="button secondary" data-action="next-page" ${page===pages?'disabled':''}>Next ${icon('chevron-right')}</button></div>`:`<div class="empty-state">${icon('search-x')}<h3>${view==='saved'?'No saved questions yet':view==='collection'?'This collection is empty':'No matching questions'}</h3><p>${view==='saved'?'Your bookmarked questions will appear here.':view==='collection'?'Add selected questions from the library.':'Try another keyword, topic or question type.'}</p><button class="button secondary" data-action="${view==='library'?'clear-filters':'browse-library'}">${view==='library'?'Reset filters':'Browse question library'}</button></div>`}`;
 icons();
}
function questionCard(original,number){
 const q=effective(original),saved=personal.bookmarks.includes(q.id);
 const summary=q.text.replace(/\n/g,' ').replace(/^[\s\uF000-\uFFFF]+/,'');
 return `<article class="question-card ${selected.has(q.id)?'selected':''}"><div class="question-card-top"><label class="question-check"><input type="checkbox" data-select="${e(q.id)}" ${selected.has(q.id)?'checked':''} aria-label="Select question ${e(q.code)}"><span class="question-number">${String(number).padStart(2,'0')}</span></label><span class="type-badge ${q.type.toLowerCase()}">${e(TYPES[q.type] || q.type)}</span><span class="source-label">${e(q.publisher)}</span><span class="card-spacer"></span><button class="icon-button bookmark ${saved?'is-saved':''}" data-action="bookmark" data-id="${e(q.id)}" aria-pressed="${saved}" title="${saved?'Remove bookmark':'Save question'}" aria-label="${saved?'Remove bookmark':'Save question'}">${icon('bookmark')}</button></div><button class="question-preview" data-action="view-question" data-id="${e(q.id)}">${e(summary)}</button><div class="question-card-bottom"><span class="question-topic">${icon('folder-open')}${e(q.topic.replace(/^Chapter \d+ · /,''))}</span><span class="question-code">${e(q.code)}</span>${view==='collection'?iconButton('remove-from-collection','x',`Remove ${q.code} from this collection`,`data-id="${e(q.id)}"`):''}<button class="open-question" data-action="view-question" data-id="${e(q.id)}" aria-label="Open question ${e(q.code)}" title="Open question">${icon('arrow-up-right')}</button></div></article>`;
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
 if(tab!=='organize')await renderQuestion($('#question-render'),original,source,tab==='answer');
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
 openModal(`${modalHeader('Create a practice quiz','A new set for your next study session.')}<form class="dialog-body" data-form="quiz"><fieldset><legend>Topics</legend><label class="checkbox-label"><input type="checkbox" id="quiz-all-topics" ${!filters.topic?'checked':''}> All topics</label><div class="quiz-topic-list">${topics().map(t=>`<label class="checkbox-label"><input type="checkbox" name="topics" value="${e(t)}" ${!filters.topic || filters.topic===t?'checked':''}>${e(t)}</label>`).join('')}</div></fieldset><div class="form-grid"><label>Question type<select name="type"><option value="">Mixed questions</option>${Object.entries(TYPES).map(([key,name])=>`<option value="${key}" ${filters.type===key?'selected':''}>${name}</option>`).join('')}</select></label><label>Number of questions<input name="count" type="number" min="1" max="50" value="10" required></label><label>Time limit (minutes)<input name="minutes" type="number" min="0" max="180" value="0" required></label><label>Question pool<select name="pool"><option value="all">Entire library</option><option value="saved">Saved questions</option>${selected.size?'<option value="selected">Selected questions</option>':''}${personal.collections.map(c=>`<option value="${e(c.id)}">${e(c.name)}</option>`).join('')}</select></label></div><p class="field-error" id="quiz-config-error" role="alert"></p><button class="button primary full" type="submit">${icon('play')}Start quiz</button></form>`,'quiz-config-dialog');
}
function quizQuestions(){return (quiz?.ids || []).map(id=>questionsById.get(id)).filter(Boolean).map(effective);}
function updateAnswered(){
 const items=quizQuestions(),score=scoreQuiz(items,quiz.responses);
 const status=$('.quiz-navigation>p');if(status)status.textContent=`${score.answered} of ${items.length} answered`;
 const nav=$(`[data-action="quiz-jump"][data-index="${quiz.current}"]`);
 nav?.classList.toggle('answered',Boolean(String(quiz.responses[items[quiz.current]?.id] || '').trim()));
}
function renderQuiz(){
 if(quiz && quizQuestions().length){renderActiveQuiz();return;}
 $('#main').innerHTML=`<section class="page-heading"><div><div class="eyebrow">MAKE TIME FOR PRACTICE</div><h1>Practice quizzes</h1><p>A few questions. A clearer understanding.</p></div><button class="button primary" data-action="quiz-config">${icon('plus')}Create a quiz</button></section><section class="quiz-intro"><div class="quiz-intro-art"><img src="assets/paper-study.svg" width="230" height="180" alt="Biology practice paper"></div><div><h2>Your next study session starts here.</h2><p>Choose your topics and question types.</p><button class="button primary" data-action="quiz-config">${icon('shuffle')}Set up a quiz</button></div></section><section class="history-section"><h2>Recent sessions</h2>${personal.history.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Questions</th><th>MC score</th><th>Result</th></tr></thead><tbody>${personal.history.map(h=>`<tr><td>${e(new Date(h.date).toLocaleDateString())}</td><td>${e(h.count)}</td><td>${h.total?`${e(h.correct)} / ${e(h.total)}`:'Written practice'}</td><td>${h.total?`${Math.round(h.correct/h.total*100)}%`:'Completed'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-history">Your completed quizzes will appear here.</div>'}</section>`;
}
async function renderActiveQuiz(){
 const items=quizQuestions();if(!items.length)return;
 quiz.current=Math.max(0,Math.min(quiz.current || 0,items.length-1));
 const q=items[quiz.current];const result=scoreQuiz(items,quiz.responses);
 $('#main').innerHTML=`<section class="page-heading"><div><div class="eyebrow">${quiz.finished?'SESSION COMPLETE':'IN PRACTICE'}</div><h1>${quiz.finished?'Your quiz results':'Biology practice'}</h1><p>${items.length} questions · ${[...new Set(items.map(q=>q.topic))].length} topics</p></div><div class="heading-actions">${!quiz.finished && quiz.deadline?`<span class="timer">${icon('timer')}<span id="quiz-timer"></span></span>`:''}<button class="button ${quiz.finished?'secondary':'primary'}" data-action="${quiz.finished?'new-quiz':'finish-quiz'}">${icon(quiz.finished?'plus':'flag')}${quiz.finished?'New quiz':'Finish quiz'}</button></div></section>
 ${quiz.finished?`<section class="quiz-score"><div><strong>${result.percent===null?'Complete':result.percent+'%'}</strong><span>${result.total?'Multiple-choice score':'Written practice'}</span></div><div><strong>${result.correct} / ${result.total}</strong><span>Correct MC answers</span></div><div><strong>${result.answered} / ${result.count}</strong><span>Questions answered</span></div><button class="button secondary" data-action="quiz-to-paper">${icon('file-stack')}Add quiz to paper</button></section>`:''}
 <div class="quiz-workspace"><aside class="quiz-navigation"><h2>Questions</h2><div class="quiz-numbers">${items.map((item,i)=>`<button class="${i===quiz.current?'current':''} ${quiz.responses[item.id]?'answered':''} ${quiz.finished && item.answer?(quiz.responses[item.id]===item.answer?'correct':'incorrect'):''}" data-action="quiz-jump" data-index="${i}" aria-label="Question ${i+1}" ${i===quiz.current?'aria-current="step"':''}>${i+1}</button>`).join('')}</div><p class="quiet">${result.answered} of ${items.length} answered</p>${quiz.finished?'':'<button class="text-button danger-text" data-action="discard-quiz">Discard session</button>'}</aside><section class="quiz-question"><div class="quiz-question-heading"><span class="type-badge ${q.type.toLowerCase()}">${TYPES[q.type]}</span><span>Question ${quiz.current+1} of ${items.length}</span><span class="quiet">${e(q.code)}</span></div><div id="quiz-render" class="question-render"></div>${q.type==='MC'?`<fieldset class="answer-options"><legend>Your answer</legend>${['A','B','C','D'].map(letter=>`<label class="answer-option ${quiz.responses[q.id]===letter?'chosen':''} ${quiz.finished && q.answer===letter?'correct-option':''}"><input type="radio" name="quiz-answer" value="${letter}" ${quiz.responses[q.id]===letter?'checked':''} ${quiz.finished?'disabled':''}><span>${letter}</span>${quiz.finished && q.answer===letter?icon('check'):''}</label>`).join('')}</fieldset>`:`<label class="written-answer">Your answer<textarea id="written-answer" rows="6" placeholder="Write your response..." ${quiz.finished?'readonly':''}>${e(quiz.responses[q.id] || '')}</textarea></label>`}${quiz.finished?`<div class="quiz-review"><h3>${q.type==='MC'?(q.answer?`Correct answer: ${q.answer}`:'Answer key'):'Marking scheme'}</h3>${q.type!=='MC'?'<p class="quiet">Written answers are self-assessed against the marking scheme.</p>':''}<div id="quiz-answer-render" class="question-render"></div></div>`:''}<div class="quiz-question-footer"><button class="button secondary" data-action="quiz-prev" ${quiz.current===0?'disabled':''}>${icon('chevron-left')}Previous</button><button class="button secondary" data-action="quiz-next" ${quiz.current===items.length-1?'disabled':''}>Next${icon('chevron-right')}</button></div></section></div>`;
 icons();updateTimer();
 renderQuestion($('#quiz-render'),q,sourcesById.get(q.sourceId));
 if(quiz.finished)renderQuestion($('#quiz-answer-render'),q,sourcesById.get(q.sourceId),true);
}
function finishQuiz(){
 if(!quiz || quiz.finished)return;
 quiz.finished=true;quiz.finishedAt=new Date().toISOString();
 const score=scoreQuiz(quizQuestions(),quiz.responses);
 personal.history.unshift({date:quiz.finishedAt,count:score.count,correct:score.correct,total:score.total});personal.history=personal.history.slice(0,50);
 save();saveQuiz();if(view==='quiz')renderActiveQuiz();
}
function updateTimer(){
 if(!quiz || quiz.finished || !quiz.deadline)return;
 const remaining=Math.max(0,Math.ceil((quiz.deadline-Date.now())/1000));
 const target=$('#quiz-timer');if(target)target.textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
 if(remaining===0){finishQuiz();toast('Time is up. Your quiz has been submitted.');}
}
function renderSources(){
 $('#main').innerHTML=`<section class="page-heading"><div><div class="eyebrow">FROM YOUR BOOKSHELF</div><h1>Source documents</h1><p>The original context, always within reach.</p></div><span class="source-total">${bank.sources.length} documents</span></section><label class="search-field source-search">${icon('search')}<input type="search" id="source-search" aria-label="Search source documents" placeholder="Search document names, topics or publishers"></label><div id="source-results"></div>`;
 renderSourceResults('');
}
function renderSourceResults(search){
 const terms=search.toLowerCase().trim().split(/\s+/).filter(Boolean);
 const sources=bank.sources.filter(s=>terms.every(term=>`${s.name} ${s.publisher} ${s.topic}`.toLowerCase().includes(term)));
 $('#source-results').innerHTML=`<div class="table-wrap"><table class="sources-table"><thead><tr><th>Document</th><th>Publisher</th><th>Pages</th><th>Questions</th><th><span class="sr-only">Open</span></th></tr></thead><tbody>${sources.map(s=>`<tr><td><div class="source-document">${icon('file-text')}<div><strong>${e(s.name)}</strong><small>${e(s.topic)}</small></div></div></td><td>${e(s.publisher)}</td><td>${s.pages}</td><td>${s.questionCount || '<span class="quiet">Full paper</span>'}</td><td><a class="icon-button" href="${e(s.path)}" target="_blank" rel="noopener" title="Open source PDF" aria-label="Open ${e(s.name)}">${icon('external-link')}</a></td></tr>`).join('')}</tbody></table>${!sources.length?'<div class="empty-history">No matching documents.</div>':''}</div>`;icons();
}
function renderSettings(){
 $('#main').innerHTML=`<section class="page-heading"><div><div class="eyebrow">YOUR WORKSPACE</div><h1>Settings & backup</h1><p>Keep your study library close.</p></div></section><section class="settings-section"><div><h2>Personal library</h2><p>Bookmarks, collections, categories and quiz history.</p></div><div class="settings-actions"><button class="button primary" data-action="backup">${icon('download')}Export backup</button><label class="button secondary file-button">${icon('upload')}Import backup<input id="import-backup" type="file" accept=".json,application/json"></label></div></section><section class="settings-section"><div><h2>Library details</h2><p>${bank.questions.length.toLocaleString()} questions · ${bank.sources.length} source documents · ${bank.topics.length} topics</p><p>Last indexed ${e(new Date(bank.generated).toLocaleDateString())}</p></div><span class="version-label">Version 1.0</span></section><section class="settings-section"><div><h2>Device data</h2><p>${personal.bookmarks.length} saved questions · ${personal.collections.length} collections · ${personal.history.length} completed sessions</p></div><button class="button danger" data-action="reset-data">${icon('trash-2')}Reset personal data</button></section>`;
}
function navigate(target,id=''){
 closeNavigation();
 if(target==='collection')location.hash=`collection/${encodeURIComponent(id)}`;
 else location.hash=target;
 if(view===target && collectionId===id)shell();
}
function route(){const [target,id]=location.hash.slice(1).split('/');view=['library','saved','quiz','sources','settings','collection'].includes(target)?target:'library';try{collectionId=id?decodeURIComponent(id):'';}catch{collectionId='';}if(view==='collection' && !personal.collections.some(c=>c.id===collectionId))view='library';page=1;shell();document.body.classList.remove('nav-open');window.scrollTo(0,0);}
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
 else if(action==='browse-library')navigate('library');
 else if(action==='toggle-nav'){document.body.classList.toggle('nav-open');syncNavigation();if(document.body.classList.contains('nav-open'))$('.sidebar button')?.focus();}
 else if(action==='close-nav'){closeNavigation();$('[data-action="toggle-nav"]')?.focus();}
 else if(action==='close-dialog')$('#dialog').close();
 else if(action==='view-question')showQuestion(id);
 else if(action==='question-tab')showQuestion(activeQuestion,button.dataset.tab);
 else if(action==='type-filter'){filters.type=button.dataset.type;page=1;document.querySelectorAll('.type-tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.type===filters.type);b.setAttribute('aria-pressed',String(b.dataset.type===filters.type));});renderResults();}
 else if(action==='clear-filters'){filters={search:'',topic:'',type:'',publisher:'',sort:'topic'};page=1;renderLibrary();icons();}
 else if(action==='previous-page' || action==='next-page'){page+=action==='next-page'?1:-1;renderResults();$('.library-section-heading')?.scrollIntoView({block:'start'});}
 else if(action==='bookmark'){
  personal.bookmarks=personal.bookmarks.includes(id)?personal.bookmarks.filter(x=>x!==id):[...personal.bookmarks,id];save();
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
 else if(action==='quiz-jump' || action==='quiz-prev' || action==='quiz-next'){quiz.current=action==='quiz-jump'?Number(button.dataset.index):quiz.current+(action==='quiz-next'?1:-1);saveQuiz();renderActiveQuiz();}
 else if(action==='finish-quiz')finishQuiz();
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
 else if(target.id==='source-search')renderSourceResults(target.value);
 else if(target.id==='paper-title'){paperTitle=target.value;try{sessionStorage.setItem('biology-paper-title',target.value);}catch{}}
 else if(target.id==='written-answer' && quiz && !quiz.finished){quiz.responses[quizQuestions()[quiz.current].id]=target.value;saveQuiz();updateAnswered();}
});
document.addEventListener('change',async event=>{
 const target=event.target;
 if(target.id==='include-answers')paperAnswers=target.checked;
 else if(target.id==='ask-save-location'){askSaveLocation=target.checked;try{localStorage.setItem('biology-ask-save-location',String(askSaveLocation));}catch{}}
 else if(['topic-filter','publisher-filter','sort'].includes(target.id)){filters[{'topic-filter':'topic','publisher-filter':'publisher',sort:'sort'}[target.id]]=target.value;page=1;renderResults();}
 else if(target.dataset.select){target.checked?selected.add(target.dataset.select):selected.delete(target.dataset.select);save();renderPaper();renderResults();}
 else if(target.id==='select-page'){getFiltered().slice((page-1)*12,page*12).forEach(q=>target.checked?selected.add(q.id):selected.delete(q.id));save();renderPaper();renderResults();}
 else if(target.id==='quiz-all-topics')document.querySelectorAll('[name="topics"]').forEach(c=>c.checked=target.checked);
 else if(target.name==='topics')$('#quiz-all-topics').checked=[...document.querySelectorAll('[name="topics"]')].every(c=>c.checked);
 else if(target.name==='quiz-answer' && quiz && !quiz.finished){quiz.responses[quizQuestions()[quiz.current].id]=target.value;saveQuiz();document.querySelectorAll('.answer-option').forEach(label=>label.classList.toggle('chosen',label.querySelector('input').checked));updateAnswered();}
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
  const selectedTopics=data.getAll('topics');const count=Number(data.get('count'));const minutes=Number(data.get('minutes'));const pool=data.get('pool');
  if(!selectedTopics.length){$('#quiz-config-error').textContent='Choose at least one topic.';return;}
  const ids=pool==='saved'?personal.bookmarks:pool==='selected'?[...selected]:personal.collections.find(c=>c.id===pool)?.ids;
  const candidates=filterQuestions(bank.questions,{type:data.get('type'),overrides:personal.overrides,collectionIds:ids || null}).filter(q=>selectedTopics.includes(effective(q).topic));
  if(!candidates.length){$('#quiz-config-error').textContent='No questions match this topic, type and question pool.';return;}
  const items=sampleQuestions(candidates,count);
  quiz={ids:items.map(q=>q.id),responses:{},current:0,started:new Date().toISOString(),deadline:minutes?Date.now()+minutes*60000:null,finished:false};saveQuiz();$('#dialog').close();navigate('quiz');if(view==='quiz')renderActiveQuiz();if(items.length<count)toast(`Started with ${items.length} available questions.`);
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
  questionsById=new Map(bank.questions.map(q=>[q.id,q]));sourcesById=new Map(bank.sources.map(s=>[s.id,s]));
  try{const raw=JSON.parse(localStorage.getItem(STORAGE));if(raw){personal=validateBackup(raw,questionsById.keys());selected=new Set((Array.isArray(raw.selected)?raw.selected:[]).filter(id=>questionsById.has(id)));}}catch(error){console.warn('Personal library could not be restored',error);}
  try{quiz=restoreQuiz(JSON.parse(localStorage.getItem(QUIZ_STORAGE)),questionsById.keys());}catch{}
  route();updateTimer();
 }catch(error){console.error(error);$('#app').innerHTML=`<main class="startup"><span class="brand-symbol">${icon('sprout')}</span><h1>The library could not be loaded</h1><p>Check your connection and reload the page.</p><button class="button primary" onclick="location.reload()">Reload library</button></main>`;icons();}
}
start();
