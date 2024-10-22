import {
    canCompletionHtmlAttr,
    isContainsNgFilter,
    getTextInTemplate,
    indexOfNgFilter,
    getMapValues,
    getBeforeCursorText,
    getHtmlTagAt,
    getTheAttrWhileCursorAtValue,
    canCompletionComponentName,
    Cursor,
    HtmlTag,
    getAttrValueStart,
    type Location,
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

describe('getMapValues()', () => {
    it.each([
        {
            input: `{ 'class-x': ctrl.x, 'class-y': ctrl.y, z: ctrl.z > 5 }`,
            output: [
                { text: ' ctrl.x', start: 12 },
                { text: ' ctrl.y', start: 31 },
                { text: ' ctrl.z > 5 ', start: 42 },
            ],
        },
        {
            input: `{}`,
            output: undefined,
        },
        {
            input: `{ 'class-x': ctrl.x`,
            output: undefined,
        },
        {
            input: `{ 'class-x': ctrl.x, }`,
            output: undefined,
        },
        {
            input: `{ 'class-x': ctrl.x, extra: }`,
            output: undefined,
        },
    ])('given input: "%s", should return %s', ({ input, output }) => {
        const result = getMapValues(input);
        expect(result).toStrictEqual(output);
    });
});

describe('getHtmlTagAt()', () => {
    const h1Tag: HtmlTag = {
        tagName: 'h1',
        attrs: [],
        parent: {
            end: 47,
            start: 4,
            tagName: 'div',
        },
        start: 27,
        end: 41,
        startTagEnd: 31,
        endTagStart: 36,
    };
    const divTag: HtmlTag = {
        tagName: 'div',
        attrs: [
            {
                name: { text: 'class', start: 9 },
                value: { text: 'container', start: 16 },
            },
        ],
        children: [
            {
                tagName: 'h1',
                start: 27,
                end: 41,
            },
        ],
        start: 4,
        end: 47,
        startTagEnd: 27,
        endTagStart: 41,
    };

    it.each([
        [{ at: 0, isHover: true }, undefined],
        [{ at: 4, isHover: false }, undefined],
        [{ at: 4, isHover: true }, divTag],
        [{ at: 26, isHover: true }, divTag],
        [{ at: 27, isHover: true }, h1Tag],
        [{ at: 28, isHover: false }, h1Tag],
        [{ at: 33, isHover: true }, h1Tag],
        [{ at: 40, isHover: true }, h1Tag],
        [{ at: 41, isHover: true }, divTag],
        [{ at: 41, isHover: false }, h1Tag],
        [{ at: 47, isHover: false }, divTag],
    ])('input cursor: %s, return tag: %s', (cursor, htmlTag) => {
        const htmlText = 'text<div class="container"><h1>Title</h1></div>';
        const tag = getHtmlTagAt(htmlText, cursor);
        expect(tag).toEqual(htmlTag);
    });

    it('parse no value attr should ok', () => {
        const htmlText = '<h1 disabled>Title</h1>';
        const tag = getHtmlTagAt(htmlText, { at: 3, isHover: true });
        expect(tag?.tagName).toEqual('h1');
        expect(tag?.attrs.length).toEqual(1);
        expect(tag?.attrs[0].name.text).toEqual('disabled');
        expect(tag?.attrs[0].value).toBeUndefined();
    });

    it.each([[{ at: 4, isHover: true }], [{ at: 4, isHover: false }]])('should throw error when cursor invalid: %s', (cursor) => {
        const htmlText = '123';
        expect(() => getHtmlTagAt(htmlText, cursor)).toThrow();
    });

    it(`test: 'ctrl' auto completion not working on <div ng-class="c">, see https://github.com/huanguolin/ng-helper/issues/2`, () => {
        const htmlText = '<h1 ng-class="c">Title</h1>';
        const tag = getHtmlTagAt(htmlText, { at: 15, isHover: false });
        expect(tag?.tagName).toEqual('h1');
        expect(tag?.attrs.length).toEqual(1);
        expect(tag?.attrs[0].name).toEqual({ text: 'ng-class', start: 4 });
        expect(tag?.attrs[0].value).toEqual({ text: 'c', start: 14 });
    });

    it('parse pure text', () => {
        const htmlText = 'some text';
        const tag = getHtmlTagAt(htmlText, { at: 3, isHover: true });
        expect(tag).toBeUndefined();
    });

    it('text + <tag> and cursor at text', () => {
        const htmlText = 'text <h1>h1</h1>';
        const tag = getHtmlTagAt(htmlText, { at: 3, isHover: true });
        expect(tag).toBeUndefined();
    });

    it('text + <tag> and cursor at <tag>', () => {
        const htmlText = 'text <h1>h1</h1>';
        const tag = getHtmlTagAt(htmlText, { at: 7, isHover: true });
        expect(tag?.tagName).toEqual('h1');
        expect(tag?.attrs.length).toEqual(0);
    });
});

describe('getAttrValueStart()', () => {
    it.each([
        [{ name: 'class', value: 'container' }, { startOffset: 0, endOffset: 16 }, 'class="container"', 7],
        [{ name: 'id', value: 'myDiv' }, { startOffset: 0, endOffset: 11 }, 'id="myDiv"', 4],
        [{ name: 'disabled', value: '' }, { startOffset: 0, endOffset: 8 }, 'disabled', undefined],
        [{ name: 'data-test', value: 'value' }, { startOffset: 0, endOffset: 18 }, 'data-test="value"', 11],
        [{ name: 'style', value: 'color: red' }, { startOffset: 0, endOffset: 19 }, 'style="color: red"', 7],
        [{ name: 'ng-click', value: 'doSomething()' }, { startOffset: 0, endOffset: 25 }, `ng-click='doSomething()'`, 10],
    ])('given attr: %p, location: %p, htmlText: %p, should return %p', (attr, location, htmlText, expectedOutput) => {
        const result = getAttrValueStart(attr, location as Location, htmlText);
        expect(result).toBe(expectedOutput);
    });
});

describe('getTheAttrWhileCursorAtValue()', () => {
    const divTag = {
        tagName: 'div',
        attrs: [
            { name: { text: 'class', start: 9 }, value: { text: 'container', start: 16 } },
            { name: { text: 'id', start: 26 }, value: { text: 'myDiv', start: 30 } },
            { name: { text: 'disabled', start: 37 } },
        ],
        start: 4,
        end: 37,
        startTagEnd: 32,
        endTagStart: 32,
    };

    it.each([
        [divTag, { at: 4, isHover: false }, undefined],
        [divTag, { at: 16, isHover: true }, { name: { text: 'class', start: 9 }, value: { text: 'container', start: 16 } }],
        [divTag, { at: 16, isHover: false }, undefined],
        [divTag, { at: 37, isHover: false }, undefined],
    ])('given tag: %p and cursor: %p, should return %p', (tag, cursor, expectedOutput) => {
        const result = getTheAttrWhileCursorAtValue(tag, cursor);
        expect(result).toEqual(expectedOutput);
    });
});

describe('canCompletionComponentName()', () => {
    it.each([
        ['  ', { at: 0, isHover: true }, true, undefined],
        ['  ', { at: 1, isHover: false }, true, undefined],
        ['<div> </div>', { at: 6, isHover: false }, true, 'div'],
        ['<div> </div>', { at: 5, isHover: false }, false, undefined],
        ['<div></div>', { at: 6, isHover: false }, true, 'div'],
        ['<div></div>', { at: 5, isHover: false }, false, undefined],
        ['<div></div>', { at: 7, isHover: false }, false, undefined],
        ['<div> ', { at: 6, isHover: false }, true, 'div'],
        ['<div> ', { at: 5, isHover: false }, false, undefined],
        ['<div> ', { at: 1, isHover: false }, false, undefined],
        ['<div> ', { at: 0, isHover: false }, true, undefined],
        ['<br /> ', { at: 7, isHover: false }, true, undefined],
        ['<br /> ', { at: 6, isHover: false }, false, undefined],
        ['<span><</span>', { at: 7, isHover: true }, true, 'span'],
        ['{{}}', { at: 2, isHover: true }, false, undefined],
        ['<span>{{}}</span>', { at: 8, isHover: true }, false, undefined],
        ['<span>{{}}</span>', { at: 6, isHover: true }, true, 'span'],
    ])('input: %s, cursor: %p => canComplete: %p, tagName: %p', (input: string, cursor: Cursor, canComplete: boolean, tagName?: string) => {
        const v = canCompletionComponentName(input, cursor);
        expect(v.canComplete).toBe(canComplete);
        expect(v.tag?.tagName).toBe(tagName);
    });
});
