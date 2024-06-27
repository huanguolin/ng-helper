import * as ts from "typescript";
import { PluginContext } from "../src/type";
import { getCompletionType, getMinSyntaxNodeForCompletion, getPropertyType } from "../src/utils";
import { prepareSimpleTestData } from "./helper";

describe('getCompletionType()', () => {
    const className = 'ComponentController';
    let type: ts.Type;
    let ctx: PluginContext;

    beforeAll(() => {
        const sourceCode = `
            class ${className} {
                a = 'abc';
                b = {
                    c: {
                        d: 5,
                    },
                    e: [1, 2, 3],
                };
            }
        `;
        const data = prepareSimpleTestData(sourceCode, className);
        type = data.type;
        ctx = {
            ts,
            typeChecker: data.typeChecker,
        } as PluginContext;
    });

    it.each([
        ["ctrl.", className],
        ["ctrl.a.", "string"],
        ["ctrl.b.c.", "{ d: number; }"],
        ["ctrl.b.c.d.", "number"],
        ["ctrl.b.e.", "number[]"],
        // TODO fill test
    ])('input: %s => output: %s', (input, output) => {
        const node = getMinSyntaxNodeForCompletion(ctx, input)!;
        const result = getCompletionType(ctx, type, node);
        if (output === undefined) {
            expect(result).toBeUndefined();
        } else {
            expect(ctx.typeChecker.typeToString(result!)).toBe(output)
        }
    });
});

describe('getPropertyType()', () => {
    let type: ts.Type;
    let ctx: any;

    beforeAll(() => {
        const className = 'MyClass';
        const sourceCode = `
            class ${className} {
                property: number;
                public publicProperty: string;
                private privateProperty: boolean;
                protected protectedProperty: string;
            }
        `;
        const data = prepareSimpleTestData(sourceCode, className);
        type = data.type;
        ctx = {
            ts,
            typeChecker: data.typeChecker,
        };
    });

    it.each([
        ['property', ts.TypeFlags.Number],
        ['publicProperty', ts.TypeFlags.String],
        ['nonExistentProperty', undefined],
        ['privateProperty', undefined],
        ['protectedProperty', undefined],
    ])('input: %s => output: %s', (propertyName, expectedFlags) => {
        const result = getPropertyType(ctx, type, propertyName);
        if (expectedFlags === undefined) {
            expect(result).toBeUndefined();
        } else {
            expect(result!.flags).toBe(expectedFlags);
        }
    });
});

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
