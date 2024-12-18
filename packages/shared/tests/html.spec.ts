import { canCompletionHtmlAttr, getTextInTemplate, getAttrValueStart, type Location } from '../lib/html';

describe('getAttrValueStart()', () => {
    it.each([
        [{ name: 'class', value: 'container' }, { startOffset: 0, endOffset: 16 }, 'class="container"', 7],
        [{ name: 'id', value: 'myDiv' }, { startOffset: 0, endOffset: 11 }, 'id="myDiv"', 4],
        [{ name: 'disabled', value: '' }, { startOffset: 0, endOffset: 8 }, 'disabled', undefined],
        [{ name: 'data-test', value: 'value' }, { startOffset: 0, endOffset: 18 }, 'data-test="value"', 11],
        [{ name: 'style', value: 'color: red' }, { startOffset: 0, endOffset: 19 }, 'style="color: red"', 7],
        [
            { name: 'ng-click', value: 'doSomething()' },
            { startOffset: 0, endOffset: 25 },
            `ng-click='doSomething()'`,
            10,
        ],
    ])('given attr: %p, location: %p, htmlText: %p, should return %p', (attr, location, htmlText, expectedOutput) => {
        const result = getAttrValueStart(attr, location as Location, htmlText);
        expect(result).toBe(expectedOutput);
    });
});

describe('getTextInTemplate()', () => {
    it.each([
        // 正常情况
        ['{{x}}', 2, { text: 'x', start: 2, cursor: { at: 0, isHover: true } }],
        ['{{}}', 2, { text: '', start: 2, cursor: { at: 0, isHover: true } }],
        ['{{1234}}', 4, { text: '1234', start: 2, cursor: { at: 2, isHover: true } }],
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
        ['0{{3}}6{{9}}', 9, { text: '9', start: 9, cursor: { at: 0, isHover: true } }],
        ['0{{3}}6{{9}}', 3, { text: '3', start: 3, cursor: { at: 0, isHover: true } }],
        ['0{{3}}6{{9}}', 6, undefined],
        // 不能 trim
        ['{{  }}', 2, { text: '  ', start: 2, cursor: { at: 0, isHover: true } }],
    ])('given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getTextInTemplate(text, { at: offset, isHover: true });
        expect(result).toStrictEqual(expectedOutput);
    });

    it.each([
        ['', 1],
        ['{{1}}', -1],
    ])('invalid input: %s, should throw error', (text, offset) => {
        expect(() => getTextInTemplate(text, { at: offset, isHover: true })).toThrow();
    });
});

describe('canCompletionHtmlAttr()', () => {
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
        const v = canCompletionHtmlAttr(input);
        expect(v).toBe(output);
    });
});
