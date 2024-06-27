import * as ts from "typescript";
import { PluginContext } from "../src/type";
import { getMinSyntaxNodeForCompletion, getPropertyType } from "../src/utils";
import { createTsTestProgram } from "./helper";

describe('getPropertyType()', () => {
    let program: ts.Program;
    let type: ts.Type;
    let ctx: any;

    beforeAll(() => {
        const sourceFileName = "test.ts";
        const className = 'MyClass';
        const sourceCode = `
            class ${className} {
                property: number;
                public publicProperty: string;
                private privateProperty: boolean;
                protected protectedProperty: string;
            }
        `;
        const sourceFiles: Record<string, string> = { [sourceFileName]: sourceCode };
        program = createTsTestProgram(sourceFiles);

        const sourceFile = program.getSourceFile(sourceFileName)!;
        let myClassNode: ts.ClassDeclaration | undefined;
        ts.forEachChild(sourceFile, node => {
            if (ts.isClassDeclaration(node) && node.name && node.name.text === className) {
                myClassNode = node;
            }
        });

        const typeChecker = program.getTypeChecker();
        type = typeChecker.getTypeAtLocation(myClassNode!);

        ctx = {
            ts,
            typeChecker,
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