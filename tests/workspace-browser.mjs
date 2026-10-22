import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.TEST_URL || 'http://127.0.0.1:4174/';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
const errors=[];
await fs.mkdir('test-results',{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
const action=name=>page.locator(`[data-action="${name}"]`);
async function imageCheck(selector){
 await page.locator(selector).waitFor();
 await page.waitForFunction(selector=>{const img=document.querySelector(selector);return img?.complete && img.naturalWidth>0;},selector);
 const ink=await page.locator(selector).evaluate(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);const a=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<a.length;i+=4)if(a[i]<180 && a[i+1]<180 && a[i+2]<180)n++;return n;});
 assert.ok(ink>100,'Document image contains content');
}
try{
 await page.goto(origin);await page.locator('.hub-tile').first().waitFor();
 assert.equal(await page.locator('main h1').textContent(),'Your study workspace');
 assert.equal(await page.locator('.hub-tile').count(),4);
 await imageCheck('.home-library img');
 await page.screenshot({path:'test-results/home-light.png',fullPage:true});
 await page.locator('#language-select').selectOption('zh');
 await page.getByRole('heading',{name:'學習工作區',exact:true}).waitFor();
 assert.equal(await page.locator('html').getAttribute('lang'),'zh-Hant');
 await page.locator('#theme-select').selectOption('dark');
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.screenshot({path:'test-results/home-dark-zh.png',fullPage:true,animations:'disabled'});
 await page.reload();await page.locator('.hub-tile').first().waitFor();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 assert.equal(await page.locator('#language-select').inputValue(),'zh');
 await action('browse-oxford').click();await page.locator('.file-item').first().waitFor();
 assert.equal(await page.locator('#publisher-filter').inputValue(),'Oxford');
 assert.match(await page.locator('#topic-filter option').nth(1).textContent(),/^Ch1 · 生物/);
 assert.equal(await page.locator('#topic-filter option').count(),35);
 await page.locator('#topic-filter').selectOption({index:30});
 await page.locator('#search').fill('qb_4_ch30');
 await page.waitForFunction(()=>document.querySelectorAll('.file-item').length===1);
 assert.equal(await page.locator('.file-item').count(),1);
 await page.locator('.file-item-title').click();await page.locator('.document-text').first().waitFor();
 assert.match(await page.locator('#document-content').innerText(),/Evolution II/);
 assert.ok(await page.locator('.document-word-sheet').count()>0);
 assert.ok(await page.locator('.document-word-sheet').first().evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(255, 255, 255)'));
 assert.match(await page.locator('.preview-notice').textContent(),/文字預覽/);
 assert.match(await page.locator('.document-actions .source-word').getAttribute('href'),/\.docx$/);
 assert.match(await page.locator('.document-actions .source-word').textContent(),/文字版/);
 assert.equal(await page.locator('.document-actions [data-action="download-source-pdf"]').count(),1);
 await page.screenshot({path:'test-results/oxford-document.png'});
 await page.setViewportSize({width:375,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.ok(await page.locator('.document-word-sheet').first().evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
 await page.screenshot({path:'test-results/oxford-word-preview-mobile.png',animations:'disabled'});
 await page.setViewportSize({width:1440,height:1050});
 await page.keyboard.press('Escape');
 await page.locator('#topic-filter').selectOption('');
 await page.locator('#search').fill('qb update_4');
 await page.waitForFunction(()=>document.querySelectorAll('.file-item').length===1 && document.querySelector('.source-filename')?.textContent.includes('qb update_4'));
 await page.locator('.file-item-title').click();await page.locator('.document-text').first().waitFor();
 assert.match(await page.locator('.document-actions a').getAttribute('href'),/\.docx$/);
 await page.keyboard.press('Escape');
 await page.locator('#search').fill('');
 await page.locator('#topic-filter').selectOption({index:34});
 assert.equal(await page.locator('.file-item').count(),2);
 await page.locator('#language-select').selectOption('en');
 await page.locator('#theme-select').selectOption('light');
 await page.locator('#topic-filter').selectOption('');
 await page.locator('#publisher-filter').selectOption('Aristo');
 await page.locator('.file-item-title').first().click();await imageCheck('.document-page-image');
 assert.equal(await page.locator('#document-page').inputValue(),'1');
 await action('document-zoom-in').click();await imageCheck('.document-page-image');
 assert.equal(await page.locator('#document-zoom').textContent(),'120%');
 await action('document-fit').click();await imageCheck('.document-page-image');
 await page.screenshot({path:'test-results/pdf-viewer.png'});await page.keyboard.press('Escape');
 await action('library-mode').filter({hasText:'Questions'}).click();
 await page.locator('#search').fill('BCEMA0010000044');await page.waitForTimeout(200);
 await page.locator('.question-preview').click();await imageCheck('#question-render .question-image:first-child');
 await action('view-source').click();await imageCheck('.document-page-image');
 await action('back-to-question').click();await imageCheck('#question-render .question-image:first-child');
 await page.keyboard.press('Escape');
 for(const width of [320,375,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const lang of ['en','zh']){
   await page.locator('#language-select').selectOption(lang);
   for(const view of ['home','library','sources','saved','settings','quiz']){
    await page.goto(origin+'#'+view);await page.locator('main h1').waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${view}/${lang} fits ${width}`);
   }
  }
  if(width===375){await page.goto(origin+'#home');await page.locator('.hub-tile').first().waitFor();await page.locator('#theme-select').selectOption('dark');await page.screenshot({path:'test-results/home-mobile-dark-zh.png',fullPage:true,animations:'disabled'});}
 }
 await page.setViewportSize({width:375,height:844});await page.goto(origin+'#home');await page.locator('.hub-tile').first().waitFor();
 assert.ok(await page.locator('.sidebar').evaluate(el=>el.inert));
 await action('toggle-nav').click();assert.equal(await page.locator('.sidebar').evaluate(el=>el.inert),false);
 await page.keyboard.press('Escape');assert.ok(await page.locator('.sidebar').evaluate(el=>el.inert));
 assert.deepEqual(errors,[]);
 console.log('Workspace browser checks passed: hub, Oxford documents and chapters, bilingual UI, themes, persistence, in-app PDF and Word previews, responsive layouts, keyboard navigation.');
}catch(error){console.error((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:'test-results/workspace-failure.png'});throw error;}finally{await browser.close();}
