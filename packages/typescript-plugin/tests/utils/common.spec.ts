import type ts from 'typescript';

import { PluginContext } from '../../src/type';
import { getPropertyType, isUnionType, typeToString } from '../../src/utils/common';
import { prepareTestContext } from '../helper';

describe('getPropertyType()', () => {
    describe('class', () => {
        let type: ts.Type;
        let ctx: PluginContext;

        beforeAll(() => {
            const className = 'MyClass';
            const sourceCode = `
                class ${className} {
                    property: number;
                    public publicProperty: string;
                    private privateProperty: boolean;
                    protected protectedProperty: string;
                    a = {
                        b: {
                            c: 5,
                        },
                    };
                    foo(bar: string) {}
                    foo2 = (bar: string) => {};
                }
            `;
            ctx = prepareTestContext(sourceCode);
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
            ['nonExistentProperty', undefined],
            ['privateProperty', undefined],
            ['protectedProperty', undefined],
            ['property', 'number'],
            ['publicProperty', 'string'],
            ['a', '{ b: { c: number; }; }'],
            ['foo', '(bar: string) => void'],
            ['foo2', '(bar: string) => void'],
        ])('input: %s => output: %s', (propertyName, expectedTypeString) => {
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });
    });

    describe('typeof class', () => {
        let type: ts.Type;
        let ctx: PluginContext;

        beforeAll(() => {
            const sourceCode = `
                class A {
                    a = { b: [1, 2]; };
                    private c = '';
                    protected d = 1;
                    foo(bar: string) {}
                    foo2 = (bar: string) => {};
                }
                const x = A;
            `;
            ctx = prepareTestContext(sourceCode);
            const nodeX = findVariableDeclaration(ctx, 'x');
            type = ctx.typeChecker.getTypeAtLocation(nodeX);
        });

        it.each([
            ['nonExistentProperty', undefined],
            ['c', undefined],
            ['d', undefined],
            ['a', '{ b: number[]; }'],
            ['foo', '(bar: string) => void'],
            ['foo2', '(bar: string) => void'],
        ])('input: %s => output: %s', (propertyName, expectedTypeString) => {
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });
    });

    describe('literal object', () => {
        let type: ts.Type;
        let ctx: PluginContext;

        beforeAll(() => {
            const sourceCode = `
                const x = {
                    a: 1;
                    b: { m: 'm'; };
                    c: ['1', '2'];
                    foo(bar: string) {}
                    foo2: (bar: string) => {};
                };
            `;
            ctx = prepareTestContext(sourceCode);
            const nodeX = findVariableDeclaration(ctx, 'x');
            type = ctx.typeChecker.getTypeAtLocation(nodeX);
        });

        it.each([
            ['nonExistentProperty', undefined],
            ['a', 'number'],
            ['b', '{ m: string; }'],
            ['c', 'string[]'],
            ['foo', '(bar: string) => void'],
            ['foo2', '(bar: string) => void'],
        ])('input: %s => output: %s', (propertyName, expectedTypeString) => {
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });
    });

    describe('interface', () => {
        let ctx: PluginContext;

        beforeAll(() => {
            const sourceCode = `
                interface A {
                    a: number;
                    b: { m: string; };
                    c: string[];
                    foo: (bar: string) => void;
                }
                let x: A;
            `;
            ctx = prepareTestContext(sourceCode);
        });

        it.each([
            ['nonExistentProperty', undefined],
            ['a', 'number'],
            ['b', '{ m: string; }'],
            ['c', 'string[]'],
            ['foo', '(bar: string) => void'],
        ])('[interface node] input: %s => output: %s', (propertyName, expectedTypeString) => {
            const nodeInterfaceA = (ctx.sourceFile?.statements[0] as ts.InterfaceDeclaration).name;
            const type = ctx.typeChecker.getTypeAtLocation(nodeInterfaceA);
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });

        it.each([
            ['nonExistentProperty', undefined],
            ['a', 'number'],
            ['b', '{ m: string; }'],
            ['c', 'string[]'],
            ['foo', '(bar: string) => void'],
        ])('[variable node] input: %s => output: %s', (propertyName, expectedTypeString) => {
            const nodeX = findVariableDeclaration(ctx, 'x');
            const type = ctx.typeChecker.getTypeAtLocation(nodeX);
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });
    });

    describe('intersection interface', () => {
        let ctx: PluginContext;

        beforeAll(() => {
            const sourceCode = `
                interface A1 {
                    a: number;
                    b: { m: string; };
                }
                interface A2 {
                    c: string[];
                    foo: (bar: string) => void;
                }
                let x: A1 & A2 & { d: boolean; };
                type B = A1 & A2;
                let y: B;
            `;
            ctx = prepareTestContext(sourceCode);
        });

        it.each([
            ['nonExistentProperty', undefined],
            ['a', 'number'],
            ['b', '{ m: string; }'],
            ['c', 'string[]'],
            ['d', 'boolean'],
            ['foo', '(bar: string) => void'],
        ])('[variable case 1] input: %s => output: %s', (propertyName, expectedTypeString) => {
            const nodeX = findVariableDeclaration(ctx, 'x');
            const type = ctx.typeChecker.getTypeAtLocation(nodeX);
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });

        it.each([
            ['nonExistentProperty', undefined],
            ['a', 'number'],
            ['b', '{ m: string; }'],
            ['c', 'string[]'],
            ['foo', '(bar: string) => void'],
        ])('[variable case 2] input: %s => output: %s', (propertyName, expectedTypeString) => {
            const nodeY = findVariableDeclaration(ctx, 'y');
            const type = ctx.typeChecker.getTypeAtLocation(nodeY);
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });

        it.each([
            ['nonExistentProperty', undefined],
            ['a', 'number'],
            ['b', '{ m: string; }'],
            ['c', 'string[]'],
            ['foo', '(bar: string) => void'],
        ])('[type alias] input: %s => output: %s', (propertyName, expectedTypeString) => {
            const nodeB = (ctx.sourceFile?.statements[3] as ts.TypeAliasDeclaration).name;
            const type = ctx.typeChecker.getTypeAtLocation(nodeB);
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });
    });

    describe('ts build-in type', () => {
        let type: ts.Type;
        let ctx: PluginContext;

        beforeAll(() => {
            const sourceCode = `let x: string;`;
            ctx = prepareTestContext(sourceCode);
            const nodeX = findVariableDeclaration(ctx, 'x');
            type = ctx.typeChecker.getTypeAtLocation(nodeX);
        });

        it.each([
            ['nonExistentProperty', undefined],
            ['length', 'number'],
            ['slice', '(start?: number, end?: number) => string'],
        ])('input: %s => output: %s', (propertyName, expectedTypeString) => {
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });
    });
});

describe('isUnionType()', () => {
    let ctx: PluginContext;

    beforeAll(() => {
        const sourceCode = `
            let x: string | number;
            let y: boolean;
            let z: string;
            let a: number;
        `;
        ctx = prepareTestContext(sourceCode);
    });

    it.each([
        ['x', true],
        ['y', true],
        ['z', false],
        ['a', false],
    ])('input: %s => output: %s', (varName, expected) => {
        const node = findVariableDeclaration(ctx, varName);
        const type = ctx.typeChecker.getTypeAtLocation(node);
        const result = isUnionType(ctx, type);
        expect(result).toBe(expected);
    });
});

function findVariableDeclaration(ctx: PluginContext, varName: string): ts.Identifier {
    let node: ts.Identifier | undefined = undefined;

    for (const statement of ctx.sourceFile.statements) {
        if (ctx.ts.isVariableStatement(statement)) {
            const n = statement.declarationList.declarations[0].name;
            if (ctx.ts.isIdentifier(n) && n.text === varName) {
                node = n;
            }
        }
    }

    return node!;
}
