const defaultAlcoholKeywords = ['맥주','소주','막걸리','생맥주','카스','테라','참이슬','처음처럼','진로이즈백','새로','청하'];
const defaultBeverageKeywords = ['음료수','콜라','사이다','환타','코카콜라','펩시'];

function normalize(value) {
  return String(value ?? '').toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
}

function classifyReceiptItem(name, alcoholKeywords = defaultAlcoholKeywords, beverageKeywords = defaultBeverageKeywords) {
  const normalized = normalize(name);
  if (alcoholKeywords.some((keyword) => normalized.includes(normalize(keyword)))) return 'alcohol';
  if (beverageKeywords.some((keyword) => normalized.includes(normalize(keyword)))) return 'nonalcohol';
  return 'common';
}

module.exports = { defaultAlcoholKeywords, defaultBeverageKeywords, classifyReceiptItem };
