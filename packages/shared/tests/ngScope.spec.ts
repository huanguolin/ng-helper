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
                    { kind: 'itemKey', name: 'k' },
                    { kind: 'itemValue', name: 'v' },
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
                    { kind: 'itemValue', name: 'item' },
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
                vars: [{ kind: 'itemValue', name: 'item' }],
            },
        ];
        expect(result).toEqual(expected);
    });
});
