import { getMinNgSyntaxInfo } from '../lib/minNgSyntax';

describe('getMinNgSyntaxInfo', () => {
    it.each([
        // Literal tests
        ['1', '1', 'literal'],
        ["'a'", "'a'", 'literal'],

        // Identifier tests
        ['$event', '$event', 'identifier'],

        // Property access tests
        ['ctrl.', 'ctrl.', 'propertyAccess'],
        ['ctrl.a.b.', 'ctrl.a.b.', 'propertyAccess'],
        ["ctrl.a['b'].", "ctrl.a['b'].", 'propertyAccess'],
        ["ctrl.a[ctrl.prefix + 'b'].", "ctrl.a[ctrl.prefix + 'b'].", 'propertyAccess'],

        // Array tests
        ['[ctrl.b.c.', 'ctrl.b.c.', 'propertyAccess'],
        ['[1, 1 + ctrl.', 'ctrl.', 'propertyAccess'],
        ['[1 + 2, a = ctrl.b.c.', 'ctrl.b.c.', 'propertyAccess'],

        // Method call tests
        ['ctrl.a(ctrl.b.c.', 'ctrl.b.c.', 'propertyAccess'],
        ['ctrl.a(1, a = ctrl.', 'ctrl.', 'propertyAccess'],
        ['ctrl.a(1, ctrl.b.c).', 'ctrl.a(1, ctrl.b.c).', 'propertyAccess'],

        // Conditional expression tests
        ['ctrl.a ? ctrl.b : ctrl.c.', 'ctrl.c.', 'propertyAccess'],
        ['ctrl.a ? ctrl.b : x ? x : ctrl.c.', 'ctrl.c.', 'propertyAccess'],

        // Unary expression tests
        ['!ctrl.a.', 'ctrl.a.', 'propertyAccess'],
        ['!+ctrl.a.', 'ctrl.a.', 'propertyAccess'],
        ['!!-ctrl.a.', 'ctrl.a.', 'propertyAccess'],

        // Binary expression tests
        ['ctrl.a = ctrl.b.', 'ctrl.b.', 'propertyAccess'],
        ['ctrl.a && ctrl.b.', 'ctrl.b.', 'propertyAccess'],

        // Group expression tests
        ['(ctrl.a.', 'ctrl.a.', 'propertyAccess'],
        ['((ctrl.a + ctrl.b) / ctrl.c.', 'ctrl.c.', 'propertyAccess'],

        // Object literal tests
        ['({ a:ctrl.b, b:ctrl.c.', 'ctrl.c.', 'propertyAccess'],

        // Filter tests
        ['ctrl.a | filterName', 'filterName', 'filterName'],
        ['ctrl.a | filterName :1 :a = x ? x : ctrl.', 'ctrl.', 'propertyAccess'],

        // Multiple statements tests
        ['ctrl.a = ctrl.b.c; x = ctrl.d.', 'ctrl.d.', 'propertyAccess'],
    ])('test input on end for completion: %s => %s', (expr, expectedValue, expectedType) => {
        testSyntax(
            expr,
            expr.length - 1,
            expectedValue,
            expectedType as 'none' | 'literal' | 'propertyAccess' | 'filterName',
        );
    });

    it.each([
        // Literal tests
        ['1 + ctrl.a', 0, '1', 'literal'],
        ["'a' + ctrl.b", 2, "'a'", 'literal'],

        // Identifier tests
        ['index = x * y', 4, 'index', 'identifier'],
        ['index = x * y', 8, 'x', 'identifier'],

        // Property access tests
        ['ctrl. + 1', 4, 'ctrl.', 'propertyAccess'],
        ["ctrl.a['b']. = 1 + 2", 11, "ctrl.a['b'].", 'propertyAccess'],
        ["ctrl.a[ctrl.prefix + 'b']. > 2", 25, "ctrl.a[ctrl.prefix + 'b'].", 'propertyAccess'],

        // Array tests
        ['[ctrl.b.c., 1]', 9, 'ctrl.b.c.', 'propertyAccess'],
        ['[1, 1 + ctrl., 3]', 12, 'ctrl.', 'propertyAccess'],
        ['[1 + 2, a = ctrl.b.c., 3]', 20, 'ctrl.b.c.', 'propertyAccess'],

        // Method call tests
        ['ctrl.a(ctrl.b.c.)', 15, 'ctrl.b.c.', 'propertyAccess'],
        ['ctrl.a(1, a = ctrl., 3)', 18, 'ctrl.', 'propertyAccess'],
        ['ctrl.a(1, ctrl.b.c). + 1', 19, 'ctrl.a(1, ctrl.b.c).', 'propertyAccess'],

        // Conditional expression tests
        ['ctrl. ? ctrl.b : ctrl.c', 4, 'ctrl.', 'propertyAccess'],
        ['ctrl.a ? ctrl.b. : x ? x : ctrl.c', 15, 'ctrl.b.', 'propertyAccess'],
        ['ctrl.a ? ctrl.b : x ? ctrl. : y', 26, 'ctrl.', 'propertyAccess'],

        // Unary expression tests
        ['!ctrl.a. || a > 3', 7, 'ctrl.a.', 'propertyAccess'],
        ['!+ctrl.a. && b < 2', 8, 'ctrl.a.', 'propertyAccess'],
        ['!!-ctrl.a. || ""', 9, 'ctrl.a.', 'propertyAccess'],

        // Binary expression tests
        ['ctrl. > ctrl.b', 4, 'ctrl.', 'propertyAccess'],
        ['1 + ctrl. === ctrl.b', 8, 'ctrl.', 'propertyAccess'],

        // Group expression tests
        ['(ctrl.a. <= ctrl.b)', 7, 'ctrl.a.', 'propertyAccess'],
        ['((ctrl. + ctrl.b) / ctrl.c)', 6, 'ctrl.', 'propertyAccess'],

        // Object literal tests
        ['({ a:ctrl., b:ctrl.c }', 9, 'ctrl.', 'propertyAccess'],
        ['({ [1 + ctrl. * 2]:ctrl., b:ctrl.c }', 12, 'ctrl.', 'propertyAccess'],

        // Filter tests
        ['ctrl.a | f1 | f2', 10, 'f1', 'filterName'],
        ['ctrl.a | f1 :a = x ? x. : y', 22, 'x.', 'propertyAccess'],
        ['ctrl.a | f1 :x. || b', 14, 'x.', 'propertyAccess'],

        // Multiple statements tests
        ['x = ctrl.d.; ctrl.a = ctrl.b.c;', 10, 'ctrl.d.', 'propertyAccess'],
    ])('test input on middle for completion: %s', (expr, cursorAt, expectedValue, expectedType) => {
        testSyntax(expr, cursorAt, expectedValue, expectedType as 'none' | 'literal' | 'propertyAccess' | 'filterName');
    });

    // hover 时，表达式既可以是完整的，也可以是不完整的
    it.each([
        // Literal tests
        ['1 + ctrl.a', 0, '1', 'literal'],
        ["'a' + ctrl.b", 2, "'a'", 'literal'],

        // Identifier tests
        ['index = x * y', 4, 'index', 'identifier'],
        ['index = x * y', 8, 'x', 'identifier'],

        // Property access tests
        ['ctrl.b + 1', 5, 'ctrl.b', 'propertyAccess'],
        ['ctrl.b.c + 1', 5, 'ctrl.b', 'propertyAccess'],
        ['ctrl.b + 1', 1, 'ctrl', 'identifier'],
        ['ctrl.b + 1', 3, 'ctrl', 'identifier'],
        ['ctrl.b + 1', 7, '', 'none'],
        ["ctrl.a['b']. = 1 + 2", 5, 'ctrl.a', 'propertyAccess'],
        ["ctrl.a[ctrl.prefix + 'b']. > 2", 9, 'ctrl', 'identifier'],

        // Array tests
        ['[ctrl.b.c, 1]', 6, 'ctrl.b', 'propertyAccess'],
        ['[ctrl.b.c, 1]', 7, 'ctrl.b.c', 'propertyAccess'], // 在 hover 时，这种情况应该先判断是否在标识符字符上
        ['[1, 1 + ctrl., 3]', 4, '1', 'literal'],
        ['[1 + 2, a = ctrl.b.c, 3]', 13, 'ctrl', 'identifier'],

        // Method call tests
        ['ctrl.a(ctrl.b.c.)', 5, 'ctrl.a', 'propertyAccess'],
        ['ctrl.a(1, a = ctrl.b, 3)', 17, 'ctrl', 'identifier'],
        ['ctrl.a(1, ctrl.b.c).b() + 1', 20, 'ctrl.a(1, ctrl.b.c).b', 'propertyAccess'],
        ['ctrl.a(1, ctrl.b.c)() + 1', 15, 'ctrl.b', 'propertyAccess'],

        // Conditional expression tests
        ['ctrl. ? ctrl.b : ctrl.c', 3, 'ctrl', 'identifier'],
        ['ctrl.a ? ctrl.b. : x ? x : ctrl.c', 14, 'ctrl.b', 'propertyAccess'],
        ['ctrl.a ? ctrl.b : x ? ctrl. : y', 20, '', 'none'],

        // Unary expression tests
        ['!ctrl.a. || a > 3', 5, 'ctrl.a', 'propertyAccess'], // 在 hover 时，这种情况应该先判断是否在标识符字符上
        ['!+ctrl.a. && b < 2', 7, 'ctrl.a', 'propertyAccess'],
        ['!!-ctrl.a. || ""', 5, 'ctrl', 'identifier'],

        // Binary expression tests
        ['ctrl. > ctrl.b', 13, 'ctrl.b', 'propertyAccess'],
        ['1 + ctrl. === ctrl.b', 6, 'ctrl', 'identifier'],

        // Group expression tests
        ['(ctrl.a <= ctrl.b)', 16, 'ctrl.b', 'propertyAccess'],
        ['((ctrl.x + ctrl.b) / ctrl.c)', 7, 'ctrl.x', 'propertyAccess'],

        // Object literal tests
        ['({ a:ctrl., b:ctrl.c }', 3, 'a', 'identifier'],
        ['({ [1 + ctrl.x * 2]:ctrl., b:ctrl.c }', 13, 'ctrl.x', 'propertyAccess'],

        // Filter tests
        ['ctrl.a | f1 | f2', 9, 'f1', 'filterName'],
        ['ctrl.a | f1 :a = x ? x. : y', 13, 'a', 'identifier'],
        ['ctrl.a | f1 :x. || b', 13, 'x', 'identifier'],

        // Multiple statements tests
        ['x = ctrl.d.; ctrl.a = ctrl.b.c;', 9, 'ctrl.d', 'propertyAccess'],
    ])('test for hover: %s', (expr, cursorAt, expectedValue, expectedType) => {
        testSyntax(expr, cursorAt, expectedValue, expectedType as 'none' | 'literal' | 'propertyAccess' | 'filterName');
    });
});

function testSyntax(
    expr: string,
    cursorAt: number,
    expectedValue: string,
    expectedType: 'none' | 'literal' | 'propertyAccess' | 'filterName',
) {
    const result = getMinNgSyntaxInfo(expr, cursorAt);
    expect(result).toEqual({ type: expectedType, value: expectedValue });
}
