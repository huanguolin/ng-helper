import {
    canCompletionNgDirective,
    isContainsNgFilter,
    getTextInTemplate,
    getStartTagText,
    getBeforeCursorText,
    getAfterCursorText,
    getTextInDbQuotes,
    parseStartTagText,
    HtmlStartTag,
    Cursor,
    getTheAttrWhileCursorAtValue,
    indexOfNgFilter,
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

describe('indexOfNgFilter()', () => {
    it.each([
        ['', -1],
        ['abc', -1],
        ['abc |', 4],
        ['abc | def', 4],
        ['abc | def |', 4],
        ['| abc', 0],
        ['| abc | def', 0],
        ['|', 0],
        ['x|', 1],
        ['|y', 0],
        ['x|y', 1],
        ['abc || def', -1],
        ['abc | | def', 4],
        ['||', -1],
    ])('input: %s => output: %s', (input: string, output: number) => {
        const result = indexOfNgFilter(input);
        expect(result).toBe(output);
    });
});

describe('getStartTagText()', () => {
    it.each([
        // 正常情况
        ['<div >', 2, { text: '<div >', start: 0, cursor: { at: 2, isHover: true } }],
        ['<h1/>', 1, { cursor: { at: 1, isHover: true }, start: 0, text: '<h1/>' }],
        ['< />', 1, { cursor: { at: 1, isHover: true }, start: 0, text: '< />' }],
        ['<h1><span></h1>', /* s */ 5, { cursor: { at: 1, isHover: true }, start: 4, text: '<span>' }],
        ['<h1><span></h1>', /* > */ 3, undefined],
        // 包含 angular 模版
        ['<h1 ng-if="a > 3" />', /* a */ 11, { cursor: { at: 11, isHover: true }, start: 0, text: '<h1 ng-if="a > 3" />' }],
        ['<h1 ng-if="a > 3" />', /* " */ 10, { cursor: { at: 10, isHover: true }, start: 0, text: '<h1 ng-if="a > 3" />' }],
        ['<h1 ng-if="a > 3" />', /* = */ 9, { cursor: { at: 9, isHover: true }, start: 0, text: '<h1 ng-if="a > 3" />' }],
        ['<h1 ng-if="a > 3"disabled />', /* d */ 17, { cursor: { at: 17, isHover: true }, start: 0, text: '<h1 ng-if="a > 3"disabled />' }],
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
    ])('[isHover = true] given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getStartTagText(text, { at: offset, isHover: true });
        expect(result).toStrictEqual(expectedOutput);
    });

    it.each([
        ['<h1><span></h1>', /* s */ 5, undefined],
        ['<h1><span></h1>', /* > */ 3, { cursor: { at: 3, isHover: false }, start: 0, text: '<h1>' }],
        ['</>', 0, undefined],
        ['</>', 1, undefined],
        ['</>', 2, undefined],
        ['<>', 0, undefined],
        ['<>', 1, undefined],
    ])('[isHover = false] given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getStartTagText(text, { at: offset, isHover: false });
        expect(result).toStrictEqual(expectedOutput);
    });
});

describe('getTextInDbQuotes()', () => {
    it.each([
        // 正常情况
        ['<div class="abc">', /* a */ 12, { text: 'abc', start: 12, cursor: { at: 0, isHover: true } }],
        ['<div class="abc">', /* b */ 13, { text: 'abc', start: 12, cursor: { at: 1, isHover: true } }],
        ['<div class="abc">', /* c */ 14, { text: 'abc', start: 12, cursor: { at: 2, isHover: true } }],
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
        ['<div class="abc" id="def">', 21, { text: 'def', start: 21, cursor: { at: 0, isHover: true } }],
        ['<div class="abc" id="def">', 22, { text: 'def', start: 21, cursor: { at: 1, isHover: true } }],
        // 不能 trim
        ['<div class=" abc ">', 12, { text: ' abc ', start: 12, cursor: { at: 0, isHover: true } }],
    ])('[isHover = true] given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getTextInDbQuotes(text, { at: offset, isHover: true });
        expect(result).toStrictEqual(expectedOutput);
    });

    it.each([
        // 正常情况
        ['<div class="abc">', /* b */ 13, { text: 'abc', start: 12, cursor: { at: 1, isHover: false } }],
        ['<div class="abc">', /* c */ 14, { text: 'abc', start: 12, cursor: { at: 2, isHover: false } }],
        ['<div class="abc">', /* " */ 15, { text: 'abc', start: 12, cursor: { at: 3, isHover: false } }],
        // 范围外
        ['<div class="abc">', /* v */ 3, undefined],
        ['<div class="abc">', /* " */ 11, undefined],
        ['<div class="abc">', /* a */ 12, undefined],
        ['<div class="abc">', /* > */ 16, undefined],
    ])('[isHover = false] given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getTextInDbQuotes(text, { at: offset, isHover: false });
        expect(result).toStrictEqual(expectedOutput);
    });

    it.each([
        ['', 0],
        ['<div class="abc">', -1],
    ])('invalid input: %s, should throw error', (text, offset) => {
        expect(() => getTextInDbQuotes(text, { at: offset, isHover: true })).toThrow();
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
        ['', 0],
        ['{{1}}', -1],
    ])('invalid input: %s, should throw error', (text, offset) => {
        expect(() => getTextInTemplate(text, { at: offset, isHover: true })).toThrow();
    });
});

describe('getBeforeCursorText()', () => {
    it.each([
        ['1234', 2, '12'],
        ['1234', 1, '1'],
        ['1234', 0, ''],
        ['1234', 3, '123'],
        ['1234', 4, '1234'],
        ['', 0, ''],
    ])('[isHover = false] given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getBeforeCursorText({ text: text, start: 0, cursor: { at: offset, isHover: false } });
        expect(result).toBe(expectedOutput);
    });

    it.each([
        ['1234', 2, '123'],
        ['1234', 1, '12'],
        ['1234', 0, '1'],
        ['1234', 3, '1234'],
        ['', 0, ''],
    ])('[isHover = true] given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getBeforeCursorText({ text: text, start: 0, cursor: { at: offset, isHover: true } });
        expect(result).toBe(expectedOutput);
    });
});

describe('getAfterCursorText()', () => {
    it.each([
        ['1234', 2, '34'],
        ['1234', 1, '234'],
        ['1234', 0, '1234'],
        ['1234', 3, '4'],
        ['1234', 4, ''],
        ['', 0, ''],
    ])('[isHover = false] given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getAfterCursorText({ text: text, start: 0, cursor: { at: offset, isHover: false } });
        expect(result).toBe(expectedOutput);
    });

    it.each([
        ['1234', 2, '4'],
        ['1234', 1, '34'],
        ['1234', 0, '234'],
        ['1234', 3, ''],
        ['', 0, ''],
    ])('[isHover = true] given text: "%s", offset: %s, should return "%s"', (text, offset, expectedOutput) => {
        const result = getAfterCursorText({ text: text, start: 0, cursor: { at: offset, isHover: true } });
        expect(result).toBe(expectedOutput);
    });
});

describe('parseStartTagText()', () => {
    it.each([
        ['<div>', undefined, { start: 0, name: { text: 'div', start: 1 }, attrs: [], isSelfClosing: false }],
        [
            '<div class="abc">',
            undefined,
            {
                start: 0,
                name: { text: 'div', start: 1 },
                attrs: [{ name: { text: 'class', start: 5 }, value: { text: 'abc', start: 12 } }],
                isSelfClosing: false,
            },
        ],
        [
            '<div class="abc" id="def">',
            undefined,
            {
                start: 0,
                name: { text: 'div', start: 1 },
                attrs: [
                    { name: { text: 'class', start: 5 }, value: { text: 'abc', start: 12 } },
                    { name: { text: 'id', start: 17 }, value: { text: 'def', start: 21 } },
                ],
                isSelfClosing: false,
            },
        ],
        [
            '<input type="text" />',
            undefined,
            {
                start: 0,
                name: { text: 'input', start: 1 },
                attrs: [{ name: { text: 'type', start: 7 }, value: { text: 'text', start: 13 } }],
                isSelfClosing: true,
            },
        ],
        [
            '<img src="image.jpg" alt="Image" />',
            99,
            {
                start: 99,
                name: { text: 'img', start: 100 },
                attrs: [
                    { name: { text: 'src', start: 104 }, value: { text: 'image.jpg', start: 109 } },
                    { name: { text: 'alt', start: 120 }, value: { text: 'Image', start: 125 } },
                ],
                isSelfClosing: true,
            },
        ],
        [
            '<img \t\n ng-if=" x>3 && x < 10 && (x / 3 > 2)" \t\n  src="image.jpg" />',
            undefined,
            {
                start: 0,
                name: { text: 'img', start: 1 },
                attrs: [
                    { name: { text: 'ng-if', start: 8 }, value: { text: ' x>3 && x < 10 && (x / 3 > 2)', start: 15 } },
                    { name: { text: 'src', start: 50 }, value: { text: 'image.jpg', start: 55 } },
                ],
                isSelfClosing: true,
            },
        ],
    ])('given startTagText: "%s", should return %s', (startTagText, baseStartAt, expectedOutput) => {
        const result = parseStartTagText(startTagText, baseStartAt);
        expect(result).toStrictEqual(expectedOutput);
    });

    it.each(['<div', '<div class="abc"', '<div class="abc" ng-if=" x>3', '<', '</div>', '<input type = "text" />'])(
        'given invalid startTagText: "%s", should throw error',
        (startTagText) => {
            expect(() => parseStartTagText(startTagText)).toThrow();
        },
    );
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

describe('getTheAttrWhileCursorAtValue()', () => {
    it('should return the attribute with value while cursor is at the value position', () => {
        const startTag: HtmlStartTag = {
            start: 0,
            name: { text: 'div', start: 1 },
            attrs: [
                { name: { text: 'class', start: 5 }, value: { text: 'abc', start: 12 } },
                { name: { text: 'id', start: 17 }, value: { text: 'def', start: 20 } },
            ],
            isSelfClosing: false,
        };
        const cursor: Cursor = { at: 14, isHover: true };

        const result = getTheAttrWhileCursorAtValue(startTag, cursor);

        expect(result).toBe(startTag.attrs[0]);
    });

    it('should return undefined if cursor is not at the value position', () => {
        const startTag: HtmlStartTag = {
            start: 0,
            name: { text: 'div', start: 1 },
            attrs: [
                { name: { text: 'class', start: 5 }, value: { text: 'abc', start: 12 } },
                { name: { text: 'id', start: 17 }, value: { text: 'def', start: 20 } },
            ],
            isSelfClosing: false,
        };
        const cursor: Cursor = { at: 8, isHover: true };

        const result = getTheAttrWhileCursorAtValue(startTag, cursor);

        expect(result).toBeUndefined();
    });

    it('should return undefined if attribute value is not present', () => {
        const startTag: HtmlStartTag = {
            start: 0,
            name: { text: 'div', start: 1 },
            attrs: [{ name: { text: 'class', start: 5 } }, { name: { text: 'id', start: 17 }, value: { text: 'def', start: 20 } }],
            isSelfClosing: false,
        };
        const cursor: Cursor = { at: 14, isHover: true };

        const result = getTheAttrWhileCursorAtValue(startTag, cursor);

        expect(result).toBeUndefined();
    });

    it('should return undefined if start tag has no attributes', () => {
        const startTag: HtmlStartTag = {
            start: 0,
            name: { text: 'div', start: 1 },
            attrs: [],
            isSelfClosing: false,
        };
        const cursor: Cursor = { at: 8, isHover: true };

        const result = getTheAttrWhileCursorAtValue(startTag, cursor);

        expect(result).toBeUndefined();
    });
});
