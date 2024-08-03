import { beautifyTypeString, getMinSyntaxNodeForHover } from '../../src/hover/utils';
import { prepareTestContext } from '../helper';

describe('beautifyTypeString()', () => {
    it('should beautify a simple type string', () => {
        const typeString = 'string';
        const expected = 'string';
        const result = beautifyTypeString(typeString);
        expect(result).toBe(expected);
    });

    it('should beautify a complex type string with indentation', () => {
        const typeString = 'type A = { prop1: string; prop2: number; }';
        const expected = `type A = {
    prop1: string;
    prop2: number;
}`;
        const result = beautifyTypeString(typeString);
        expect(result).toBe(expected);
    });

    it('should beautify a type string with nested objects', () => {
        const typeString = 'type A = { prop1: { nestedProp1: string; nestedProp2: number; }; }';
        const expected = `type A = {
    prop1: {
        nestedProp1: string;
        nestedProp2: number;
    };
}`;
        const result = beautifyTypeString(typeString);
        expect(result).toBe(expected);
    });
});

describe('getMinSyntaxNodeForHover()', () => {
    const ctx = prepareTestContext('');

    it.each([
        // 字段访问
        ['ctrl', 0, 'ctrl'],
        ['ctrl.a.b', 'ctrl'.length - 1, 'ctrl'],
        ['ctrl.a.b', 'ctrl.a'.length - 1, 'ctrl.a'],
        ['ctrl.a.b', 'ctrl.a.b'.length - 1, 'ctrl.a.b'],
        // 数组
        ['[ctrl.b.c]', '[ctrl.b'.length - 1, 'ctrl.b'],
        ['ctrl.a[ctrl.b.c]', 'ctrl.a'.length - 1, 'ctrl.a'],
        ['ctrl.a[ctrl.b.c]', 'ctrl.a[ctrl'.length - 1, 'ctrl'],
        ['ctrl.a[ctrl.b.c]', 'ctrl.a[ctrl.b'.length - 1, 'ctrl.b'],
        ['ctrl.a[1 + ctrl.b.c]', 'ctrl.a[1 + ctrl.b'.length - 1, 'ctrl.b'],
        ['ctrl.a[1 + ctrl.b.c]', 'ctrl.a[1'.length - 1, '1'],
        ['ctrl.a[1 + ctrl.b.c].d', 'ctrl.a[1 + ctrl.b.c].d'.length - 1, 'ctrl.a[1 + ctrl.b.c].d'],
        // 方法调用
        ['ctrl.a().b', 'ctrl.a().b'.length - 1, 'ctrl.a().b'],
        ['ctrl.a(1, ctrl.c).b', 'ctrl.a(1, ctrl.c).b'.length - 1, 'ctrl.a(1, ctrl.c).b'],
        ['ctrl.a(1, ctrl.c).b', 'ctrl.a(1, ctrl.c'.length - 1, 'ctrl.c'],
        ['ctrl.a(1, ctrl.c).b', 'ctrl.a(1'.length - 1, '1'],
        // 一元表达式
        ['!ctrl.a', '!ctrl.a'.length - 1, 'ctrl.a'],
        ['!ctrl.a', '!ctrl'.length - 1, 'ctrl'],
        ['++ctrl.a', '++ctrl.a'.length - 1, 'ctrl.a'],
        ['ctrl.a--', 'ctrl.a'.length - 1, 'ctrl.a'],
        // 二元表达式
        ['ctrl.a + ctrl.b', 'ctrl.a'.length - 1, 'ctrl.a'],
        ['ctrl.a || ctrl.b', 'ctrl.a || ctrl.b'.length - 1, 'ctrl.b'],
        ['ctrl.a && ctrl.b', 'c'.length - 1, 'ctrl'],
        [`ctrl.notice.canDelete && ctrl.activeTab === 'content'`, 'ctrl.notice.canDelete && ctrl.active'.length, 'ctrl.activeTab'],
        // 括号分组
        ['(ctrl.a + ctrl.b) / ctrl.c', '(ctrl'.length - 1, 'ctrl'],
        ['(ctrl.a + ctrl.b) / ctrl.c', '(ctrl.a + ctrl.b'.length - 1, 'ctrl.b'],
        // 字面量对象
        ['{ a: 1, b: ctrl.b }', '{ a: 1'.length - 1, '1'],
        ['{ a: 1, b: ctrl.b }', '{ a'.length - 1, 'a'],
        ['{ a: 1, b: ctrl.b }', '{ a: 1, b: ctrl.b'.length - 1, 'ctrl.b'],
        // 逗号表达式
        ['ctrl.a = 1, ctrl.b', 'ctrl.a'.length - 1, 'ctrl.a'],
        ['ctrl.a = 1, ctrl.b', 'ctrl.a = 1'.length - 1, '1'],
        ['ctrl.a = 1, ctrl.b', 'ctrl.a = 1, ctrl.b'.length - 1, 'ctrl.b'],
        // 多语句
        ['ctrl.a = ctrl.b.c; ctrl.d', 'ctrl.a = ctrl.b.c'.length - 1, 'ctrl.b.c'],
        // 字面量
        ['1', '1'.length - 1, '1'],
        [' "a"', ' "a"'.length - 1, '"a"'],
    ])('input: %s, %s => output: %s', (contextString: string, cursorAt: number, output: string) => {
        const v = getMinSyntaxNodeForHover(ctx, contextString, cursorAt);
        expect(v?.minNode.getText(v?.sourceFile)).toBe(output);
        if (v && ctx.ts.isIdentifier(v.minNode)) {
            expect(v.minNode === v.targetNode).toBeTruthy();
        }
    });
});
