import { CursorAtContext } from '../lib/cursorAt';
import { getNgScopes, NgScope } from '../lib/ngScope';

describe('getNgScopes()', () => {
    it('should return empty array when context is empty', () => {
        const context: CursorAtContext[] = [];
        const result = getNgScopes(context);
        expect(result).toEqual([]);
    });

    it('ng-controller scope', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-controller', value: 'MyController as ctrl' }];
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
        const context: CursorAtContext[] = [{ kind: 'ng-repeat', value: '(k, v) in items | f1 as list' }];
        const result = getNgScopes(context);
        const expected: NgScope[] = [
            {
                kind: 'ng-repeat',
                vars: [
                    { kind: 'key', name: 'k' },
                    { kind: 'value', name: 'v' },
                    { kind: 'as', name: 'list' },
                ],
            },
        ];
        expect(result).toEqual(expected);
    });

    it('ng-repeat array scope', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-repeat', value: 'item in items | f1 as list' }];
        const result = getNgScopes(context);
        const expected: NgScope[] = [
            {
                kind: 'ng-repeat',
                vars: [
                    { kind: 'item', name: 'item' },
                    { kind: 'as', name: 'list' },
                ],
            },
        ];
        expect(result).toEqual(expected);
    });

    it('should handle multiple contexts', () => {
        const context: CursorAtContext[] = [
            { kind: 'ng-controller', value: 'MyController as ctrl' },
            { kind: 'ng-repeat', value: 'item in items' },
        ];
        const result = getNgScopes(context);
        const expected: NgScope[] = [
            {
                kind: 'ng-controller',
                vars: [{ kind: 'as', name: 'ctrl' }],
            },
            {
                kind: 'ng-repeat',
                vars: [{ kind: 'item', name: 'item' }],
            },
        ];
        expect(result).toEqual(expected);
    });

    it('should handle invalid ng-repeat syntax', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-repeat', value: 'invalid syntax' }];
        const result = getNgScopes(context);
        expect(result).toEqual([
            {
                kind: 'ng-repeat',
                vars: [],
            },
        ]);
    });

    it('should handle invalid ng-controller syntax', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-controller', value: 'invalid syntax' }];
        const result = getNgScopes(context);
        expect(result).toEqual([
            {
                kind: 'ng-controller',
                vars: [],
            },
        ]);
    });

    it('should handle empty ng-controller value', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-controller', value: '' }];
        const result = getNgScopes(context);
        expect(result).toEqual([
            {
                kind: 'ng-controller',
                vars: [],
            },
        ]);
    });

    it('should handle ng-repeat with track by', () => {
        const context: CursorAtContext[] = [{ kind: 'ng-repeat', value: 'item in items track by item.id' }];
        const result = getNgScopes(context);
        expect(result).toEqual([
            {
                kind: 'ng-repeat',
                vars: [{ kind: 'item', name: 'item' }],
            },
        ]);
    });
});
