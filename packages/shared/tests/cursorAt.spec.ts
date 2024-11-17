import { getCursorAtInfo } from '../lib/cursorAt';
import type { Cursor } from '../lib/html';

describe('getCursorAtInfo()', () => {
    // Helper function to create cursor position
    const cursor = (at: number, isHover = true): Cursor => ({ at, isHover });

    describe('tag related', () => {
        it.each([
            // At start tag
            1, 2, 3,
            // At end tag
            8, 9, 10,
        ])('should detect cursor at tag name while cursor at %s', (at) => {
            const html = '<div>a</div>';
            const result = getCursorAtInfo(html, cursor(at));
            expect(result).toEqual({
                type: 'tagName',
                tagName: 'div',
                attrNames: [],
                parentTagName: undefined,
            });
        });

        it.each([
            // At space between tag name and attribute
            4,
            // At quote before attribute value
            11,
            // At quote after attribute value
            16,
        ])('should detect cursor at start tag when cursor at %s', (at) => {
            const html = '<div class="test">content</div>';
            const result = getCursorAtInfo(html, cursor(at));
            expect(result).toEqual({
                type: 'startTag',
                tagName: 'div',
                attrNames: ['class'],
                parentTagName: undefined,
                start: 0,
                end: 18,
            });
        });

        it.each([
            // '<'
            6,
            // '/'
            7,
            // '>'
            11,
        ])('should detect cursor at end tag when cursor at %s', (at) => {
            const html = '<div>a</div>';
            const result = getCursorAtInfo(html, cursor(at));
            expect(result).toEqual({
                type: 'endTag',
                tagName: 'div',
                attrNames: [],
                parentTagName: undefined,
            });
        });
    });

    describe('attribute related', () => {
        it.each([
            // At start of attribute name
            5,
            // In middle of attribute name
            7,
            // At end of attribute name
            9,
        ])('should detect cursor at attribute name when cursor at %s', (at) => {
            const html = '<div class="test">content</div>';
            const result = getCursorAtInfo(html, cursor(at));
            expect(result).toEqual({
                type: 'attrName',
                cursorAtAttrName: 'class',
                tagName: 'div',
                attrNames: ['class'],
                parentTagName: undefined,
            });
        });

        it.each([
            // At start of attribute value
            12,
            // In middle of attribute value
            13,
            // At end of attribute value
            15,
        ])('should detect cursor at attribute value when cursor at %s', (at) => {
            const html = '<div class="test">content</div>';
            const result = getCursorAtInfo(html, cursor(at));
            expect(result).toEqual({
                type: 'attrValue',
                attrName: 'class',
                attrValue: 'test',
                context: [],
            });
        });
    });

    describe('template related', () => {
        it.each([
            // At start of template
            7,
            // In middle of template
            8,
            // At end of template
            11,
        ])('should detect cursor in template expression when cursor at %s', (at) => {
            const html = '<div>{{value}}</div>';
            const result = getCursorAtInfo(html, cursor(at));
            expect(result).toEqual({
                type: 'template',
                template: 'value',
                context: [],
            });
        });

        it.each([
            // At start of template
            21,
            // In middle of template
            22,
            // At end of template
            25,
        ])('should detect cursor in attribute template when cursor at %s', (at) => {
            const html = '<div title="prefix {{value}} suffix">content</div>';
            const result = getCursorAtInfo(html, cursor(at));
            expect(result).toEqual({
                type: 'template',
                template: 'value',
                context: [],
            });
        });
    });

    describe('context related', () => {
        it.each([
            // At start of template
            39,
            // In middle of template
            43,
            // At end of template
            47,
        ])('should collect ng-repeat context when cursor at %s', (at) => {
            const html = `<div ng-repeat="item in items"><span>{{item.name}}</span></div>`;
            const result = getCursorAtInfo(html, cursor(at));
            expect(result).toEqual({
                type: 'template',
                template: 'item.name',
                context: [
                    {
                        kind: 'ng-repeat',
                        value: 'item in items',
                    },
                ],
            });
        });

        it.each([
            // At start of template
            132,
            // In middle of template
            137,
            // At end of template
            141,
        ])('should collect nested contexts when cursor at %s', (at) => {
            const html = `
                <div ng-controller="MainCtrl">
                    <div ng-repeat="item in items">
                        <span>{{item.name}}</span>
                    </div>
                </div>
            `;
            const result = getCursorAtInfo(html, cursor(at));
            expect(result).toEqual({
                type: 'template',
                template: 'item.name',
                context: [
                    {
                        kind: 'ng-repeat',
                        value: 'item in items',
                    },
                    {
                        kind: 'ng-controller',
                        value: 'MainCtrl',
                    },
                ],
            });
        });
    });

    describe('text related', () => {
        it.each([
            // At start of text content
            5,
            // In middle of text content
            7,
            // At end of text content
            9,
        ])('should detect cursor at text content when cursor at %s', (at) => {
            const html = '<p>content</p>';
            const result = getCursorAtInfo(html, cursor(at));
            expect(result).toEqual({
                type: 'text',
                parentTagName: 'p',
                siblingTagNames: [],
            });
        });

        it('should detect cursor at text with nested parent tag', () => {
            const html = '<div><span>nested text</span></div>';
            const result = getCursorAtInfo(html, cursor(12));
            expect(result).toEqual({
                type: 'text',
                parentTagName: 'span',
                siblingTagNames: [],
            });
        });

        it('should detect cursor at text with sibling tag', () => {
            const html = '<div>text<span></span></div>';
            const result = getCursorAtInfo(html, cursor(5));
            expect(result).toEqual({
                type: 'text',
                parentTagName: 'div',
                siblingTagNames: ['span'],
            });
        });

        it('should detect cursor at text with only text', () => {
            const html = 'text';
            const result = getCursorAtInfo(html, cursor(1));
            expect(result).toEqual({ type: 'text', siblingTagNames: [] });
        });

        it('should detect cursor at text with whitespace text', () => {
            const html = '  ';
            const result = getCursorAtInfo(html, cursor(0));
            expect(result).toEqual({ type: 'text', siblingTagNames: [] });
        });
    });

    describe('edge cases', () => {
        it('should throw error for invalid cursor position', () => {
            const html = '<div>content</div>';
            expect(() => getCursorAtInfo(html, cursor(-1))).toThrow();
            expect(() => getCursorAtInfo(html, cursor(100))).toThrow();
        });

        it('should return undefined with empty text', () => {
            const html = '';
            const result = getCursorAtInfo(html, cursor(0));
            expect(result).toBeUndefined();
        });

        it('should handle empty elements', () => {
            const html = '<div></div>';
            const result = getCursorAtInfo(html, cursor(2));
            expect(result).toEqual({
                type: 'tagName',
                tagName: 'div',
                attrNames: [],
                parentTagName: undefined,
            });
        });

        it('should handle self-closing tags', () => {
            const html = '<input type="text" />';
            const result = getCursorAtInfo(html, cursor(3));
            expect(result).toEqual({
                type: 'tagName',
                tagName: 'input',
                attrNames: ['type'],
                parentTagName: undefined,
            });
        });
    });
});
