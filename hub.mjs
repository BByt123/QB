import {language,theme,setLanguage,applyTheme} from './preferences.mjs';
const $=selector=>document.querySelector(selector);
const labels={en:{title:'Choose your study subject',subtitle:'Open a focused workspace with searchable questions, saved items, quizzes and source files.'},zh:{title:'選擇學習科目',subtitle:'進入可搜尋題目、儲存題目、練習測驗及來源檔案的專注學習空間。'}};
function applyLanguage(){document.documentElement.lang=language==='zh'?'zh-Hant':'en';$('#hub-title').textContent=labels[language].title;$('#hub-subtitle').textContent=labels[language].subtitle;$('#hub-language').value=language;$('#hub-theme').value=theme;}
$('#hub-language').addEventListener('change',event=>{setLanguage(event.target.value);applyLanguage();});
$('#hub-theme').addEventListener('change',event=>{applyTheme(event.target.value);applyLanguage();});
applyLanguage();window.lucide?.createIcons();
