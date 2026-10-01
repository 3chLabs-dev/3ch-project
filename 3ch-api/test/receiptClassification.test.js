const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyReceiptItem } = require('../src/services/receiptClassification');

test('관리 키워드로 술과 음료를 구분하고 나머지는 음식으로 둔다', () => {
  assert.equal(classifyReceiptItem('카스 생맥주 500'), 'alcohol');
  assert.equal(classifyReceiptItem('코카 콜라', ['소주'], ['코카콜라']), 'nonalcohol');
  assert.equal(classifyReceiptItem('오븐 닭발'), 'common');
});

test('술과 음료 단어가 함께 있으면 술 구분을 우선한다', () => {
  assert.equal(classifyReceiptItem('소주 콜라 세트'), 'alcohol');
});
