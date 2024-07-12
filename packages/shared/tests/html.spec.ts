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
    parseStartTagText,
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
        ['<div >', 2, { str: '<div >', start: 0, cursorAt: 2 }],
        ['<h1/>', 1, { cursorAt: 1, start: 0, str: '<h1/>' }],
        ['< />', 1, { cursorAt: 1, start: 0, str: '< />' }],
        ['<h1><span></h1>', /* s */ 5, { cursorAt: 1, start: 4, str: '<span>' }],
        // 包含 angular 模版
        ['<h1 ng-if="a > 3" />', /* a */ 11, { cursorAt: 11, start: 0, str: '<h1 ng-if="a > 3" />' }],
        ['<h1 ng-if="a > 3" />', /* " */ 10, { cursorAt: 10, start: 0, str: '<h1 ng-if="a > 3" />' }],
        ['<h1 ng-if="a > 3" />', /* = */ 9, { cursorAt: 9, start: 0, str: '<h1 ng-if="a > 3" />' }],
        ['<h1 ng-if="a > 3"disabled />', /* d */ 17, { cursorAt: 17, start: 0, str: '<h1 ng-if="a > 3"disabled />' }],
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
        ['<div class="abc">', /* a */ 12, { str: 'abc', start: 12, cursorAt: 0 }],
        ['<div class="abc">', /* b */ 13, { str: 'abc', start: 12, cursorAt: 1 }],
        ['<div class="abc">', /* c */ 14, { str: 'abc', start: 12, cursorAt: 2 }],
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
        ['<div class="abc" id="def">', 21, { str: 'def', start: 21, cursorAt: 0 }],
        ['<div class="abc" id="def">', 22, { str: 'def', start: 21, cursorAt: 1 }],
        // 不能 trim
        ['<div class=" abc ">', 12, { str: ' abc ', start: 12, cursorAt: 0 }],
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
        ['{{x}}', 2, { str: 'x', start: 2, cursorAt: 0 }],
        ['{{}}', 2, { str: '', start: 2, cursorAt: 0 }],
        ['{{1234}}', 4, { str: '1234', start: 2, cursorAt: 2 }],
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
        ['0{{3}}6{{9}}', 9, { str: '9', start: 9, cursorAt: 0 }],
        ['0{{3}}6{{9}}', 3, { str: '3', start: 3, cursorAt: 0 }],
        ['0{{3}}6{{9}}', 6, undefined],
        // 不能 trim
        ['{{  }}', 2, { str: '  ', start: 2, cursorAt: 0 }],
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
        const result = getBeforeCursorText({ str: text, start: 0, cursorAt: offset });
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
        const result = getAfterCursorText({ str: text, start: 0, cursorAt: offset });
        expect(result).toBe(expectedOutput);
    });
});

describe('parseStartTagText()', () => {
    it.each([
        ['<div>', { name: { str: 'div', start: 1 }, attrs: [], isSelfClosing: false }],
        [
            '<div class="abc">',
            {
                name: { str: 'div', start: 1 },
                attrs: [{ name: { str: 'class', start: 5 }, value: { str: 'abc', start: 12 } }],
                isSelfClosing: false,
            },
        ],
        [
            '<div class="abc" id="def">',
            {
                name: { str: 'div', start: 1 },
                attrs: [
                    { name: { str: 'class', start: 5 }, value: { str: 'abc', start: 12 } },
                    { name: { str: 'id', start: 17 }, value: { str: 'def', start: 21 } },
                ],
                isSelfClosing: false,
            },
        ],
        [
            '<input type="text" />',
            {
                name: { str: 'input', start: 1 },
                attrs: [{ name: { str: 'type', start: 7 }, value: { str: 'text', start: 13 } }],
                isSelfClosing: true,
            },
        ],
        [
            '<img src="image.jpg" alt="Image" />',
            {
                name: { str: 'img', start: 1 },
                attrs: [
                    { name: { str: 'src', start: 5 }, value: { str: 'image.jpg', start: 10 } },
                    { name: { str: 'alt', start: 21 }, value: { str: 'Image', start: 26 } },
                ],
                isSelfClosing: true,
            },
        ],
        [
            '<img \t\n ng-if=" x>3 && x < 10 && (x / 3 > 2)" \t\n  src="image.jpg" />',
            {
                name: { str: 'img', start: 1 },
                attrs: [
                    { name: { str: 'ng-if', start: 8 }, value: { str: ' x>3 && x < 10 && (x / 3 > 2)', start: 15 } },
                    { name: { str: 'src', start: 50 }, value: { str: 'image.jpg', start: 55 } },
                ],
                isSelfClosing: true,
            },
        ],
    ])('given startTagText: "%s", should return %s', (startTagText, expectedOutput) => {
        const result = parseStartTagText(startTagText);
        expect(result).toStrictEqual(expectedOutput);
    });

    it.each(['<div', '<div class="abc"', '<div class="abc" ng-if=" x>3', '<', '</div>', '<input type = "text" />'])(
        'given invalid startTagText: "%s", should throw error',
        (startTagText) => {
            expect(() => parseStartTagText(startTagText)).toThrow();
        },
    );
});
