import { ngParse } from '../src';

import { checkNoErrorAndLocations, compareAstUseSExpr } from './testUtils';

describe('ngParse()', () => {
    describe('should handle one-time-binding expression', () => {
        it('normal case', () => {
            const result = ngParse('::1 + 2');
            const expected = ngParse('  1 + 2');
            expect(result).toStrictEqual(expected);
        });

        it('has space avoid "::"', () => {
            const result = ngParse('  ::  1 + 2');
            const expected = ngParse('      1 + 2');
            expect(result).toStrictEqual(expected);
        });

        it('should not replace ":"', () => {
            const program = ngParse(':1 + 2');
            compareAstUseSExpr(program, '(+ 1 2)');
        });
    });

    it('should working without one-time-binding', () => {
        const program = ngParse('1+2');
        compareAstUseSExpr(program, '(+ 1 2)');
        checkNoErrorAndLocations(program);
    });
});
