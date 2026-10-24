import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const bank = JSON.parse(fs.readFileSync(new URL('bank/economics/index.json', root), 'utf8'));

test('Economics bank keeps renamed sources, topics and questions together', () => {
  assert.equal(bank.sources.length, 35);
  assert.equal(bank.questions.length, 3947);
  assert.equal(new Set(bank.questions.map(question => question.id)).size, bank.questions.length);
  assert.equal(bank.topics.length, 35);
  assert.equal(bank.topics[0], 'B1 · Ch101 · What is economics?');
  assert.equal(bank.topics[7], 'B2 · Ch208 · Ownership of firms');
  assert.deepEqual(bank.sources.slice(0, 3).map(source => source.name), ['101.docx', '102.docx', '103.docx']);
  assert.deepEqual(bank.sources.slice(-2).map(source => source.name), ['714.docx', '715.docx']);
  assert.deepEqual(bank.sources.slice(0, 3).map(source => source.sourceCode), ['101', '102', '103']);
});

test('Economics source downloads expose both web editions and untouched media-safe originals', () => {
  for (const source of bank.sources) {
    assert.ok(['text', 'original'].includes(source.wordEdition), source.name);
    assert.equal(source.mediaPreserved, source.wordEdition === 'original', source.name);
    assert.equal(source.conversionStatus, source.mediaPreserved ? 'word' : 'text-only', source.name);
    assert.match(source.downloadPath, /\.docx$/);
    assert.match(source.originalDownloadPath, /\.doc$/);
    assert.equal(fs.readFileSync(new URL(`../${source.downloadPath}`, import.meta.url)).subarray(0, 2).toString(), 'PK', source.name);
    assert.equal(fs.readFileSync(new URL(`../${source.originalDownloadPath}`, import.meta.url)).subarray(0, 2).toString('hex'), 'd0cf', source.name);
    assert.equal(source.questionCount, bank.questions.filter(question => question.sourceId === source.id).length, source.name);
  }
});
