import { ngParse } from '../src';
import { NgControllerProgram } from '../src/parser/ngControllerNode';
import { NgRepeatProgram } from '../src/parser/ngRepeatNode';

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

    describe('with attrName', () => {
        it('should handle ng-repeat attribute', () => {
            const sourceText = 'item in items';
            const result = ngParse(sourceText, 'ng-repeat');
            expect(result instanceof NgRepeatProgram).toBeTruthy();
        });

        it('should handle ng-controller attribute', () => {
            const sourceText = 'MyController as ctrl';
            const result = ngParse(sourceText, 'ng-controller');
            expect(result instanceof NgControllerProgram).toBeTruthy();
        });
    });
});
