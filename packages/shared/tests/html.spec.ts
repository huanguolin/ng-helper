import {
    canCompletionNgDirective,
    isInStartTagAnd,
    isContainsNgFilter,
    getTagAndTheAttrNameWhenInAttrValue,
    getTemplateText,
    getStartTagText,
} from '../lib/html';

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

describe('getTemplateText()', () => {
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
        const result = getTemplateText(text, offset);
        expect(result).toStrictEqual(expectedOutput);
    });

    it.each([
        ['', 0],
        ['{{1}}', -1],
    ])('invalid input: %s, should throw error', (text, offset) => {
        expect(() => getTemplateText(text, offset)).toThrow();
    });
});
