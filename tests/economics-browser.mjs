import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_URL || 'http://127.0.0.1:4174/';
const browser = await chromium.launch({headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge'});
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const action = name => page.locator(`[data-action="${name}"]`);

async function download(locator, expectedExtension) {
  const pending = page.waitForEvent('download');
  await locator.click();
  const item = await pending;
  assert.equal(await item.failure(), null);
  assert.match(item.suggestedFilename(), new RegExp(`\\${expectedExtension}$`));
  return item;
}

try {
  await page.goto(origin);
  await page.locator('.economics-card').waitFor();
  assert.equal(await page.locator('.subject-card').count(), 2);
  await page.locator('.economics-card').click();
  await page.locator('main h1').waitFor();
  assert.equal(await page.locator('main h1').textContent(), 'Your economics workspace');
  assert.equal(await page.locator('.hub-tile').count(), 4);
  assert.equal((await page.locator('.book-cover strong').first().textContent()).trim(), '101');

  await page.goto(origin + 'economics/#library');
  await page.locator('.question-card').first().waitFor();
  assert.equal(await page.locator('#topic-filter option').count(), 36);
  assert.match(await page.locator('#topic-filter option').nth(1).textContent(), /^B1 · Ch101 ·/);
  await page.locator('#topic-filter').selectOption({index: 1});
  await action('type-filter').filter({hasText: 'Multiple choice'}).click();
  assert.ok(await page.locator('.question-card').count() > 0);
  await page.locator('#topic-filter').selectOption('');

  await action('quiz-config').click();
  assert.match(await page.locator('.quiz-topic-list label').first().textContent(), /^B1 · Ch101 ·/);
  await page.locator('[data-form="quiz"] [name="type"]').selectOption('MC');
  await page.locator('[data-form="quiz"] [name="count"]').fill('2');
  await page.locator('[data-form="quiz"] button[type="submit"]').click();
  await page.locator('.quiz-numbers').waitFor();
  assert.equal(await page.locator('.quiz-numbers button').count(), 2);
  await action('bookmark').click();
  await page.goto(origin + 'economics/#saved');
  await page.locator('.question-card').first().waitFor();
  assert.equal(await page.locator('.question-card').count(), 1);

  await page.goto(origin + 'economics/#sources');
  await page.locator('.file-item').first().waitFor();
  assert.equal(await page.locator('.file-item').count(), 35);
  assert.match(await page.locator('.file-item .source-word').first().getAttribute('href'), /\.docx$/);
  assert.match(await page.locator('.file-item .source-original').first().getAttribute('href'), /\.doc$/);
  await download(page.locator('.file-item .source-word').first(), '.docx');
  await download(page.locator('.file-item .source-original').first(), '.doc');
  await page.locator('.file-item-title').first().click();
  await page.locator('.document-content').waitFor();
  const sourceManifest = await page.evaluate(async () => await (await fetch('bank/economics/index.json')).json());
  const firstSource = sourceManifest.sources[0];
  if (firstSource.mediaPreserved) {
    assert.match(await page.locator('.preview-notice').textContent(), /downloadable Word edition/);
  } else {
    assert.match(await page.locator('.preview-notice').textContent(), /original DOC/);
  }
  assert.equal(await page.locator('.document-actions .source-original').count(), 1);
  await download(page.locator('.document-actions .source-pdf'), '.pdf');

  await page.setViewportSize({width: 375, height: 844});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await page.locator('#document-content').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
  const privateContext = await browser.newContext({viewport: {width: 1440, height: 1000}});
  await privateContext.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('Unavailable', 'SecurityError'); }});
    Object.defineProperty(window, 'sessionStorage', {get() { throw new DOMException('Unavailable', 'SecurityError'); }});
  });
  const privatePage = await privateContext.newPage();
  await privatePage.goto(origin + 'economics/#library');
  await privatePage.locator('.question-card').first().waitFor();
  await privatePage.locator('.bookmark').first().click();
  assert.equal(await privatePage.locator('#saved-metric').textContent(), '1');
  assert.ok(await privatePage.evaluate(() => document.cookie.includes('dse-economics-bank-v1.')));
  await privatePage.reload();
  await privatePage.locator('.question-card').first().waitFor();
  assert.equal(await privatePage.locator('#saved-metric').textContent(), '1', 'Economics cookie data survives reload');
  await privateContext.close();
  assert.deepEqual(errors, []);
  console.log('Economics browser checks passed: hub, topic/type filters, quizzes, saved questions, DOCX/DOC/PDF downloads and mobile layout.');
} finally {
  await browser.close();
}
