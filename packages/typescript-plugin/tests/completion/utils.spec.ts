import type ts from 'typescript';

import { getNodeType, getExpressionSyntaxNode, getMinSyntaxNode } from '../../src/completion/utils';
import { PluginContext } from '../../src/type';
import { createTmpSourceFile, typeToString } from '../../src/utils/common';
import { prepareTestContext } from '../helper';

describe('getNodeType()', () => {
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
                arrLike2: MyArrayLike<number> = {
                    0: 0,
                    1: 2,
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
        // element access
        ['ctrl.b.e[0].', 'number'],
        ['ctrl.b.e[ctrl.b.c.d].', 'number'],
        ['ctrl.b.e[ctrl.b.c.d + 1].', 'number'],
        // tuple
        ['ctrl.t[0].', 'number'],
        ['ctrl.t[1].', 'string'],
        // arrayLike
        ['ctrl.t[ctrl.b.c.d].', 'string | number'],
        ['ctrl.arrLike.', 'MyArrayLike<string>'],
        ['ctrl.arrLike.length', 'number'],
        ['ctrl.arrLike[0].', 'string'],
        ['ctrl.arrLike2.', 'MyArrayLike<number>'],
        ['ctrl.arrLike2[0].', 'number'],
        // literal
        ['1.', '1'],
        ['"a".', '"a"'],
    ])('input: %s => output: %s', (input, output) => {
        const node = getExpressionSyntaxNode(ctx, input)!;
        const result = getNodeType(ctx, type, node);
        expect(typeToString(ctx, result)).toBe(output);
    });
});

describe('getMinSyntaxNode()', () => {
    const ctx = prepareTestContext('');
    it.each([
        // 字段访问
        ['ctrl.', 'ctrl.'],
        ['ctrl.a.b.', 'ctrl.a.b.'],
        ['ctrl.a["b"].', 'ctrl.a["b"].'],
        ['ctrl.a[ctrl.prefix + "b"].', 'ctrl.a[ctrl.prefix + "b"].'],

        // 数组访问
        ['[ctrl.b.c.', 'ctrl.b.c.'],
        ['[1, ctrl.b.c.', 'ctrl.b.c.'],

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

        // 多语句
        ['ctrl.a = ctrl.b.c; ctrl.d.', 'ctrl.d.'],

        // 字面量
        ['1', '1'],
        ['"a"', '"a"'],
    ])('input: %s => output: %s', (input: string, output: string) => {
        const sourceFile = createTmpSourceFile(ctx, input);
        const v = getMinSyntaxNode(ctx, sourceFile, sourceFile);
        expect(v?.minNode.getText(v?.sourceFile)).toBe(output);
    });
});
