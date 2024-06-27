import ts from "typescript";
import { PluginContext } from "../src/type";
import { getMinSyntaxNodeForCompletion } from "../src/utils";

describe('getMinSyntaxNodeForCompletion()', () => {
    const ctx = { ts };
    it.each([
        // 字段访问
        ['ctrl.', 'ctrl.'],
        ['ctrl.a.b.', 'ctrl.a.b.'],
        ['ctrl.a.["b"].', 'ctrl.a.["b"].'],
        ['ctrl.a.[ctrl.prefix + "b"].', 'ctrl.a.[ctrl.prefix + "b"].'],

        // 数组访问
        ['ctrl.a[ctrl.b.c.', 'ctrl.b.c.'],
        ['ctrl.a[1 + ctrl.b.c].', 'ctrl.a[1 + ctrl.b.c].'],

        // 方法调用
        ['ctrl.a(ctrl.b.c.', 'ctrl.b.c.'],
        ['ctrl.a(1, ctrl.b.c).', 'ctrl.a(1, ctrl.b.c).'],

        // 一元表达式
        ['!ctrl.a.', 'ctrl.a.'],
        ['++ctrl.a.', 'ctrl.a.'],

        // 二元表达式
        ['ctrl.a = ctrl.b.', 'ctrl.b.'],
        ['ctrl.a && ctrl.b.', 'ctrl.b.'],

        // 括号分组
        ['(ctrl.a.', 'ctrl.a.'],
        ['((ctrl.a + ctrl.b) / ctrl.c.', 'ctrl.c.'],

        // 字面量对象
        ['({ a:ctrl.b, b:ctrl.c.', 'ctrl.c.'],

        // 逗号表达式
        ['ctrl.a = 1, ctrl.b.', 'ctrl.b.'],

        // 多语句
        ['ctrl.a = ctrl.b.c; ctrl.d.', 'ctrl.d.'],
    ])('input: %s => output: %s', (input: string, output: string) => {
            const v = getMinSyntaxNodeForCompletion(ctx as PluginContext, input);
            expect(v?.node.getText(v?.sourceFile)).toBe(output);
        })
});