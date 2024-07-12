import {
    canCompletionNgDirective,
    isInStartTagAnd,
    isContainsNgFilter,
    getTagAndTheAttrNameWhenInAttrValue,
    getTextInTemplate,
    getStartTagText,
    getBeforeCursorText,
    getAfterCursorText,
    getTextInDbQuotes,
} from '../lib/html';

describe('isInStartTagAnd()', () => {
    it.each([
        [' ', false],
        ['<>', false],
        ['</', false],
        ['<></', false],
        ['>', false],
        ['/>', false],
        ['<', true],
        ['><', true],
        ['/><', true],
        ['/>< ', true],
    ])('input: %s => output: %s', (input: string, output: boolean) => {
        const v = isInStartTagAnd(input, () => true);
        expect(v).toBe(output);
    });
});

describe('canCompletionNgDirective()', () => {
    it.each([
        ['<', false],
        ['<di', false],
        ['<div', false],
        ['<div ', true],
        ['<div class', true],
        ['<div class=', false],
        ['<div class="', false],
        ['<div class="btn', false],
        ['<div class="btn ', false],
        ['<div class="btn"', true],
        ['<div class="btn" ', true],
        ['<div class="btn"  tit', true],
        ['<div class="btn"  title=" ', false],
        ['<div class="btn"  title=" "', true],
        ['<div class="btn" ng-if="click()"', true],
        ['<div class="btn" ng-hide', true],
        ['<div class="btn" ng-hide ', true],
    ])('input: %s => output: %s', (input: string, output: boolean) => {
        const v = canCompletionNgDirective(input);
        expect(v).toBe(output);
    });
});

describe('getTagAndTheAttrNameWhenInAttrValue()', () => {
    it.each([
        ['<div class="', 'div', 'class'],
        ['<div class="btn', 'div', 'class'],
        ['<div class="btn ', 'div', 'class'],
        ['<div class="btn"  title=" ', 'div', 'title'],
        ['<div class="btn" ng-if="click()', 'div', 'ng-if'],
        ['<common-btn class="btn', 'common-btn', 'class'],
        ['<common-btn class="btn" ng-if="click()', 'common-btn', 'ng-if'],
        ['<common-btn ng-click="n = n + 1', 'common-btn', 'ng-click'],
    ])('input: %s => output: %s', (input: string, tag: string, attr: string) => {
        const v = getTagAndTheAttrNameWhenInAttrValue(input);
        expect(v.tagName).toBe(tag);
        expect(v.attrName).toBe(attr);
    });
});

describe('isContainsNgFilter()', () => {
    it.each([
        ['', false],
        ['  ', false],
        ['||', false],
        ['a||', false],
        ['||b', false],
        ['a||b', false],
        ['|', true],
        ['"A"|', true],
        ['|date', true],
        ['"A"|date', true],
        ['"A" | date', true],
    ])('input: %s => output: %s', (input: string, output: boolean) => {
        const v = isContainsNgFilter(input);
        expect(v).toBe(output);
    });
});

describe('getStartTagText()', () => {
    it.each([
        // 正常情况
        ['<div >', 2, { str: '<div >', start: 0, length: 6, relativeOffset: 2 }],
        ['<h1/>', 1, { length: 5, relativeOffset: 1, start: 0, str: '<h1/>' }],
        ['< />', 1, { length: 4, relativeOffset: 1, start: 0, str: '< />' }],
        ['<h1><span></h1>', /* s */ 5, { length: 6, relativeOffset: 1, start: 4, str: '<span>' }],
        // 包含 angular 模版
        ['<h1 ng-if="a > 3" />', /* a */ 11, { length: 20, relativeOffset: 11, start: 0, str: '<h1 ng-if="a > 3" />' }],
        ['<h1 ng-if="a > 3" />', /* " */ 10, { length: 20, relativeOffset: 10, start: 0, str: '<h1 ng-if="a > 3" />' }],
        ['<h1 ng-if="a > 3" />', /* = */ 9, { length: 20, relativeOffset: 9, start: 0, str: '<h1 ng-if="a > 3" />' }],
        ['<h1 ng-if="a > 3"disabled />', /* d */ 17, { length: 28, relativeOffset: 17, start: 0, str: '<h1 ng-if="a > 3"disabled />' }],
        // 多个标签
        ['<h1>text</h1>', /* t */ 4, undefined],
        ['<h1>{{"text" | t}}</h1>', /* e */ 8, undefined],
        ['</h1>', /* 1 */ 3, undefined],
        ['h1></h1>', /* 1 */ 1, undefined],
        // 注意下面的不算在开始标签内
        ['</>', 0, undefined],
        ['</>', 1, undefined],
        ['</>', 2, undefined],
        ['<>', 0, undefined],
        ['<>', 1, undefined],
    ])('given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getStartTagText(text, offset);
        expect(result).toStrictEqual(expectedOutput);
    });
});

describe('getTextInDbQuotes()', () => {
    it.each([
        // 正常情况
        ['<div class="abc">', /* a */ 12, { str: 'abc', start: 12, length: 3, relativeOffset: 0 }],
        ['<div class="abc">', /* b */ 13, { str: 'abc', start: 12, length: 3, relativeOffset: 1 }],
        ['<div class="abc">', /* c */ 14, { str: 'abc', start: 12, length: 3, relativeOffset: 2 }],
        // 范围外
        ['<div class="abc">', /* v */ 3, undefined],
        ['<div class="abc">', /* " */ 11, undefined],
        ['<div class="abc">', /* " */ 15, undefined],
        ['<div class="abc">', /* > */ 16, undefined],
        // 引号不成对
        ['<div class="abc>', /* a */ 12, undefined],
        ['<div class=abc">', /* b */ 12, undefined],
        // 多个引号对
        ['<div class="abc" id="def">', 20, undefined],
        ['<div class="abc" id="def">', 21, { str: 'def', start: 21, length: 3, relativeOffset: 0 }],
        ['<div class="abc" id="def">', 22, { str: 'def', start: 21, length: 3, relativeOffset: 1 }],
        // 不能 trim
        ['<div class=" abc ">', 12, { str: ' abc ', start: 12, length: 5, relativeOffset: 0 }],
    ])('given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getTextInDbQuotes(text, offset);
        expect(result).toStrictEqual(expectedOutput);
    });

    it.each([
        ['', 0],
        ['<div class="abc">', -1],
    ])('invalid input: %s, should throw error', (text, offset) => {
        expect(() => getTextInDbQuotes(text, offset)).toThrow();
    });
});

describe('getTextInTemplate()', () => {
    it.each([
        // 正常情况
        ['{{x}}', 2, { str: 'x', start: 2, length: 1, relativeOffset: 0 }],
        ['{{}}', 2, { str: '', start: 2, length: 0, relativeOffset: 0 }],
        ['{{1234}}', 4, { str: '1234', start: 2, length: 4, relativeOffset: 2 }],
        // 模板标记缺失
        ['{text}}', 2, undefined],
        ['text}}', 2, undefined],
        ['{{text}', 2, undefined],
        ['{{text', 2, undefined],
        // 范围外
        ['0{{}}5', 0, undefined],
        ['0{{}}5', 5, undefined],
        ['0{{}}5', 1, undefined],
        ['0{{}}5', 2, undefined],
        ['0{{}}5', 4, undefined],
        // 多个模板起始标记
        ['0{{3}}6{{9}}', 9, { str: '9', start: 9, length: 1, relativeOffset: 0 }],
        ['0{{3}}6{{9}}', 3, { str: '3', start: 3, length: 1, relativeOffset: 0 }],
        ['0{{3}}6{{9}}', 6, undefined],
        // 不能 trim
        ['{{  }}', 2, { str: '  ', start: 2, length: 2, relativeOffset: 0 }],
    ])('given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getTextInTemplate(text, offset);
        expect(result).toStrictEqual(expectedOutput);
    });

    it.each([
        ['', 0],
        ['{{1}}', -1],
    ])('invalid input: %s, should throw error', (text, offset) => {
        expect(() => getTextInTemplate(text, offset)).toThrow();
    });
});

describe('getBeforeCursorText()', () => {
    it.each([
        ['1234', 2, '12'],
        ['1234', 1, '1'],
        ['1234', 0, ''],
        ['1234', 3, '123'],
        ['', 0, ''],
    ])('given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getBeforeCursorText({ str: text, start: 0, length: text.length, relativeOffset: offset });
        expect(result).toBe(expectedOutput);
    });
});

describe('getAfterCursorText()', () => {
    it.each([
        ['1234', 2, '34'],
        ['1234', 1, '234'],
        ['1234', 0, '1234'],
        ['1234', 3, '4'],
        ['', 0, ''],
    ])('given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getAfterCursorText({ str: text, start: 0, length: text.length, relativeOffset: offset });
        expect(result).toBe(expectedOutput);
    });
});
