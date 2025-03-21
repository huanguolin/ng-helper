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
                context: [],
                attrLocations: {
                    class: {
                        start: 5,
                        end: 17,
                    },
                },
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
                context: [],
                attrLocations: { class: { start: 5, end: 17 } },
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
                relativeCursorAt: at - 12,
                tagName: 'div',
                attrNames: ['class'],
                parentTagName: undefined,
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
                relativeCursorAt: at - 7,
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
                relativeCursorAt: at - 21,
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
                        startAt: 16,
                    },
                ],
                relativeCursorAt: at - 39,
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
                        startAt: 84,
                    },
                    {
                        kind: 'ng-controller',
                        value: 'MainCtrl',
                        startAt: 37,
                    },
                ],
                relativeCursorAt: at - 132,
            });
        });

        it('should collect same level context', () => {
            const html = `<div ng-controller="MainCtrl as ctrl" ng-init="ctrl.init()"></div>`;
            const result = getCursorAtInfo(html, cursor(html.lastIndexOf('ctrl.')));
            expect(result).toEqual({
                type: 'attrValue',
                tagName: 'div',
                attrNames: ['ng-controller', 'ng-init'],
                parentTagName: undefined,
                attrValue: 'ctrl.init()',
                attrName: 'ng-init',
                context: [
                    {
                        kind: 'ng-controller',
                        value: 'MainCtrl as ctrl',
                        startAt: 20,
                    },
                ],
                relativeCursorAt: 0,
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
                context: [],
            });
        });

        it('should detect cursor at text with nested parent tag', () => {
            const html = '<div><span>nested text</span></div>';
            const result = getCursorAtInfo(html, cursor(12));
            expect(result).toEqual({
                type: 'text',
                parentTagName: 'span',
                siblingTagNames: [],
                context: [],
            });
        });

        it('should detect cursor at text with sibling tag', () => {
            const html = '<div>text<span></span></div>';
            const result = getCursorAtInfo(html, cursor(5));
            expect(result).toEqual({
                type: 'text',
                parentTagName: 'div',
                siblingTagNames: ['span'],
                context: [],
            });
        });

        it('should detect cursor at text with only text', () => {
            const html = 'text';
            const result = getCursorAtInfo(html, cursor(1));
            expect(result).toEqual({
                type: 'text',
                siblingTagNames: [],
                parentTagName: undefined,
                context: [],
            });
        });

        it('should detect cursor at text with whitespace text', () => {
            const html = '  ';
            const result = getCursorAtInfo(html, cursor(0));
            expect(result).toEqual({
                type: 'text',
                siblingTagNames: [],
                parentTagName: undefined,
                context: [],
            });
        });
    });

    describe('edge cases', () => {
        it('should throw error for invalid cursor position', () => {
            const html = '<div>content</div>';
            expect(() => getCursorAtInfo(html, cursor(-1))).toThrow();
            expect(() => getCursorAtInfo(html, cursor(100))).toThrow();
        });

        it('should return text type with empty text', () => {
            const html = '';
            const result = getCursorAtInfo(html, cursor(0));
            expect(result).toEqual({
                type: 'text',
                siblingTagNames: [],
                context: [],
            });
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
