import { CursorAtContext } from '../lib/cursorAt';
import { getNgScopes, NgScope } from '../lib/ngScope';

describe('getNgScopes()', () => {
    it('should return empty array when context is empty', () => {
        const context: CursorAtContext[] = [];
        const result = getNgScopes(context);
        expect(result).toEqual([]);
    });

    it('ng-controller scope', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-controller', value: 'MyController as ctrl', startAt: 0 }];
        const result = getNgScopes(context);
        const expected: NgScope[] = [
            {
                kind: 'ng-controller',
                vars: [{ kind: 'as', name: 'ctrl' }],
            },
        ];
        expect(result).toEqual(expected);
    });

    it('ng-repeat object scope', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-repeat', value: '(k, v) in items | f1 as list', startAt: 0 }];
        const result = getNgScopes(context);
        const expected: NgScope[] = [
            {
                kind: 'ng-repeat',
                vars: [
                    { kind: 'key', name: 'k', location: { start: 1, end: 2 } },
                    { kind: 'value', name: 'v', location: { start: 4, end: 5 } },
                    { kind: 'as', name: 'list', location: { start: 24, end: 28 } },
                ],
            },
        ];
        expect(result).toEqual(expected);
    });

    it('ng-repeat array scope', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-repeat', value: 'item in items | f1 as list', startAt: 0 }];
        const result = getNgScopes(context);
        const expected: NgScope[] = [
            {
                kind: 'ng-repeat',
                vars: [
                    { kind: 'item', name: '$first', replaceTo: '(items | f1)[0]' },
                    { kind: 'item', name: '$middle', replaceTo: '(items | f1)[0]' },
                    { kind: 'item', name: '$last', replaceTo: '(items | f1)[0]' },
                    { kind: 'item', name: '$even', replaceTo: '(items | f1)[0]' },
                    { kind: 'item', name: '$odd', replaceTo: '(items | f1)[0]' },
                    { kind: 'item', name: '$index', typeString: 'number' },
                    { kind: 'item', name: 'item', replaceTo: '(items | f1)[0]', location: { start: 0, end: 4 } },
                    { kind: 'as', name: 'list', location: { start: 22, end: 26 } },
                ],
            },
        ];
        expect(result).toEqual(expected);
    });

    it('should handle multiple contexts', () => {
        const context: CursorAtContext[] = [
            { kind: 'ng-controller', value: 'MyController as ctrl', startAt: 0 },
            { kind: 'ng-repeat', value: 'item in items', startAt: 0 },
        ];
        const result = getNgScopes(context);
        const expected: NgScope[] = [
            {
                kind: 'ng-controller',
                vars: [{ kind: 'as', name: 'ctrl' }],
            },
            {
                kind: 'ng-repeat',
                vars: [
                    { kind: 'item', name: '$first', replaceTo: 'items[0]' },
                    { kind: 'item', name: '$middle', replaceTo: 'items[0]' },
                    { kind: 'item', name: '$last', replaceTo: 'items[0]' },
                    { kind: 'item', name: '$even', replaceTo: 'items[0]' },
                    { kind: 'item', name: '$odd', replaceTo: 'items[0]' },
                    { kind: 'item', name: '$index', typeString: 'number' },
                    {
                        kind: 'item',
                        name: 'item',
                        replaceTo: 'items[0]',
                        location: { start: 0, end: 4 },
                    },
                ],
            },
        ];
        expect(result).toEqual(expected);
    });

    it('should handle invalid ng-repeat syntax', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-repeat', value: 'invalid syntax', startAt: 0 }];
        const result = getNgScopes(context);
        expect(result).toEqual([
            {
                kind: 'ng-repeat',
                vars: [],
            },
        ]);
    });

    it('should handle invalid ng-controller syntax', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-controller', value: 'invalid syntax', startAt: 0 }];
        const result = getNgScopes(context);
        expect(result).toEqual([
            {
                kind: 'ng-controller',
                vars: [],
            },
        ]);
    });

    it('should handle empty ng-controller value', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-controller', value: '', startAt: 0 }];
        const result = getNgScopes(context);
        expect(result).toEqual([
            {
                kind: 'ng-controller',
                vars: [],
            },
        ]);
    });

    it('should handle ng-repeat with track by', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-repeat', value: 'item in items track by item.id', startAt: 0 }];
        const result = getNgScopes(context);
        expect(result).toEqual([
            {
                kind: 'ng-repeat',
                vars: [
                    { kind: 'item', name: '$first', replaceTo: 'items[0]' },
                    { kind: 'item', name: '$middle', replaceTo: 'items[0]' },
                    { kind: 'item', name: '$last', replaceTo: 'items[0]' },
                    { kind: 'item', name: '$even', replaceTo: 'items[0]' },
                    { kind: 'item', name: '$odd', replaceTo: 'items[0]' },
                    { kind: 'item', name: '$index', typeString: 'number' },
                    { kind: 'item', name: 'item', replaceTo: 'items[0]', location: { start: 0, end: 4 } },
                ],
            },
        ]);
    });
});
