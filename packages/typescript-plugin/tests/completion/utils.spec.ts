import type ts from 'typescript';

import { getCompletionType, getMinSyntaxNodeForCompletion } from '../../src/completion/utils';
import { PluginContext } from '../../src/type';
import { typeToString } from '../../src/utils/common';
import { prepareTestContext } from '../helper';

describe('getCompletionType()', () => {
    const className = 'ComponentController';
    let type: ts.Type;
    let ctx: PluginContext;

    beforeAll(() => {
        ctx = prepareTestContext(`
            interface MyArrayLike<T> {
                readonly length: number;
                [index: number]: T;
            }
            class ${className} {
                a = 'abc';
                b = {
                    c: {
                        d: 5,
                    },
                    e: [1, 2, 3],
                };
                x = () => 'xxx';
                y(n: number) { return [n]; }
                t!: [number, string];
                arrLike: MyArrayLike<string> = {
                    0: '0',
                    1: '2',
                    length: 2,
                };
            }
        `);
        type = ctx.typeChecker.getTypeAtLocation(findTheNode()!);

        function findTheNode() {
            let theNode: ts.ClassDeclaration | undefined;
            ctx.ts.forEachChild(ctx.sourceFile, (node) => {
                if (ctx.ts.isClassDeclaration(node) && node.name && node.name.text === className) {
                    theNode = node;
                }
            });
            return theNode;
        }
    });

    it.each([
        // prop access
        ['ctrl.', className],
        ['ctrl.a.', 'string'],
        ['ctrl.b.c.', '{ d: number; }'],
        ['ctrl.b.c.d.', 'number'],
        ['ctrl.b.e.', 'number[]'],
        // function call
        ['ctrl.x().', 'string'],
        ['ctrl.y(ctrl.b.c.d).', 'number[]'],
        // array
        ['ctrl.b.e[0].', 'number'],
        ['ctrl.b.e[ctrl.b.c.d].', 'number'],
        ['ctrl.b.e[ctrl.b.c.d + 1].', 'number'],
        ['[ctrl.a.', 'string'],
        // tuple
        ['ctrl.t[0].', 'number'],
        ['ctrl.t[1].', 'string'],
        // arrayLike
        // TODO fix next line
        // ['ctrl.t[ctrl.b.c.d].', 'number | string'],
        ['ctrl.arrLike.', 'MyArrayLike<string>'],
        ['ctrl.arrLike.length', 'number'],
        ['ctrl.arrLike[0].', 'string'],
        // TODO 字面量测试
    ])('input: %s => output: %s', (input, output) => {
        const node = getMinSyntaxNodeForCompletion(ctx, input)!;
        const result = getCompletionType(ctx, type, node);
        expect(typeToString(ctx, result)).toBe(output);
    });

    // it('debug & test', () => {
    //     const [input, output] = ['ctrl.b.e[ctrl.b.c.d + 1].', 'number'];
    //     const node = getMinSyntaxNodeForCompletion(ctx, input)!;
    //     const result = getCompletionType(ctx, type, node);
    //     expect(typeToString(ctx, result)).toBe(output);
    // });
});

describe('getMinSyntaxNodeForCompletion()', () => {
    const ctx = prepareTestContext('');
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

        // TODO 字面量测试
    ])('input: %s => output: %s', (input: string, output: string) => {
        const v = getMinSyntaxNodeForCompletion(ctx, input);
        expect(v?.node.getText(v?.sourceFile)).toBe(output);
    });
});
