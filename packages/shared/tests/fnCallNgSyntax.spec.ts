import { getActiveParameterIndex, getFnCallNode } from '../lib/fnCallNgSyntax';

describe('getFnCallNode', () => {
    it.each([
        // Literal tests
        ['1', undefined],
        ["'a'", undefined],

        // Identifier tests
        ['$event', undefined],

        // Property access tests
        ['ctrl.', undefined],
        ['ctrl.a[ctrl.f(', 'ctrl.f('],
        ['ctrl.a[ctrl.prefix + ctrl.f(', 'ctrl.f('],

        // Array tests
        ['[ctrl.b.c(', 'ctrl.b.c('],
        ['[1, 1 + ctrl.f(', 'ctrl.f('],

        // Method call tests
        ['ctrl.a(ctrl.b.c.', 'ctrl.a(ctrl.b.c.'],
        ['ctrl.a(1, a = ctrl.', 'ctrl.a(1, a = ctrl.'],
        ['ctrl.a(1, ctrl.b.c).', undefined],
        ['ctrl.a(1, 1 + ctrl.b.c(', 'ctrl.b.c('],

        // Conditional expression tests
        ['ctrl.a ? 1 : 2', undefined],
        ['ctrl.a ? ctrl.b : x ? x : ctrl.c(', 'ctrl.c('],

        // Unary expression tests
        ['!+ctrl.a.', undefined],
        ['!ctrl.a(', 'ctrl.a('],

        // Binary expression tests
        ['ctrl.a = ctrl.b(', 'ctrl.b('],
        ['ctrl.a && ctrl.b(', 'ctrl.b('],
        ['ctrl.a && ctrl.b()', 'ctrl.b()'],

        // Group expression tests
        ['(1 + ctrl.a(', 'ctrl.a('],

        // Object literal tests
        ['({ a:ctrl.b, b:ctrl.c(', 'ctrl.c('],

        // Filter tests
        ['ctrl.a | f1', undefined],
        ['ctrl.a | f2 :1 :a(', 'a('],

        // Multiple statements tests
        ['ctrl.a = ctrl.b.c; x = ctrl.d(', 'ctrl.d('],
    ])('test input on end for signatureHelp: %s => %s', (expr, expectedText) => {
        testSyntax(expr, expr.length - 1, expectedText);
    });

    it.each([
        // Element access tests
        ['x[c()].m + 1', 4, 'c()'],
        ['x[c()].m + 1', 5, undefined],

        // Array tests
        ['[x(1), 1]', 2, 'x(1)'],
        ['[x(1), 1]', 5, undefined],

        // Method call tests
        ['x(1, c(5-))', 2, 'x(1, c(5-))'],
        ['x(1, c(5-))', 7, 'c(5-)'],

        // Conditional expression tests
        ['c() ? 1 : 2', 3, undefined],
        ['c() ? 1 : 2', 1, 'c()'],
        ['c() ? x(b) : 2', 6, 'x(b)'],
        ['c() ? 1 : x(b)', 11, 'x(b)'],

        // Binary expression tests
        ['x(6) > ctrl.b', 2, 'x(6)'],
        ['1 + x(6, 7) === ctrl.', 4, 'x(6, 7)'],

        // Group expression tests
        ['((x. + b()) / ctrl.c)', 8, 'b()'],

        // Object literal tests
        ['({ a: x(), b:ctrl.c }', 6, 'x()'],
        ['({ [1 + x()]:ctrl., b:ctrl.c }', 9, 'x()'],

        // Filter tests
        ['x | f1 | f2', 5, undefined],
        ['x | f1 :a = m ? c() : d', 17, 'c()'],

        // Multiple statements tests
        ['x = c(); ctrl.a = ctrl.b.c;', 5, 'c()'],
    ])('test input on middle for signatureHelp: %s', (expr, cursorAt, expectedText) => {
        testSyntax(expr, cursorAt, expectedText);
    });

    // NgRepeat tests
    it.each([
        ['item in items', 0, undefined],
        ['item in x()', 10, 'x()'],
        ['item in items track by item.id', 29, undefined],
        ['item in items as alias', 20, undefined],
    ])('test ng-repeat attributes: %s', (expr, cursorAt, expectedText) => {
        testSyntax(expr, cursorAt, expectedText);
    });

    // NgController tests
    it.each([
        ['MyController as ctrl', 0, undefined],
        ['MyController as ctrl', 19, undefined],
    ])('test ng-controller attributes: %s', (expr, cursorAt, expectedText) => {
        testSyntax(expr, cursorAt, expectedText);
    });

    function testSyntax(expr: string, cursorAt: number, expectedText?: string) {
        const result = getFnCallNode(expr, cursorAt);
        if (expectedText) {
            expect(expr.slice(result?.start, result?.end)).toEqual(expectedText);
        } else {
            expect(result).toBeUndefined();
        }
    }
});

describe('getActiveParameterIndex', () => {
    it.each([
        ['x()', 0, -1],
        ['x()', 1, 0],
        ['x()', 2, 0],
        ['x(1, 2, 3)', 1, 0],
        ['x(1, 2, 3)', 2, 0],
        ['x(1, 2, 3)', 3, 1],
        ['x(1, 2, 3)', 4, 1],
        ['x(1, 2, 3)', 5, 1],
        ['x(1, 2, 3)', 6, 2],
        ['x(1, 2, 3)', 7, 2],
        ['x(1, 2, 3)', 8, 2],
        ['x(1, 2, 3)', 9, 2],
    ])('test %s, %s => %s', (expr, cursorAt, expectedText) => {
        testSyntax(expr, cursorAt, expectedText);
    });

    function testSyntax(expr: string, cursorAt: number, expectedActiveParamIndex: number) {
        const result = getActiveParameterIndex(getFnCallNode(expr, cursorAt)!, cursorAt);
        expect(result).toBe(expectedActiveParamIndex);
    }
});
