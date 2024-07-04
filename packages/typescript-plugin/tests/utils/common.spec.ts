import type ts from 'typescript';

import { PluginContext } from '../../src/type';
import { getPropertyType, typeToString } from '../../src/utils/common';
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
            const nodeX = (ctx.sourceFile?.statements[1] as ts.VariableStatement).declarationList.declarations[0].name as ts.Identifier;
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
            const nodeX = (ctx.sourceFile?.statements[0] as ts.VariableStatement).declarationList.declarations[0].name as ts.Identifier;
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
        let type: ts.Type;
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
            const nodeX = (ctx.sourceFile?.statements[1] as ts.VariableStatement).declarationList.declarations[0].name as ts.Identifier;
            type = ctx.typeChecker.getTypeAtLocation(nodeX);
        });

        it.each([
            ['nonExistentProperty', undefined],
            ['a', 'number'],
            ['b', '{ m: string; }'],
            ['c', 'string[]'],
            ['foo', '(bar: string) => void'],
        ])('input: %s => output: %s', (propertyName, expectedTypeString) => {
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });
    });

    describe('intersection interface', () => {
        let type: ts.Type;
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
                let x: A1 & A2;
            `;
            ctx = prepareTestContext(sourceCode);
            const nodeX = (ctx.sourceFile?.statements[2] as ts.VariableStatement).declarationList.declarations[0].name as ts.Identifier;
            type = ctx.typeChecker.getTypeAtLocation(nodeX);
        });

        it.each([
            ['nonExistentProperty', undefined],
            ['a', 'number'],
            ['b', '{ m: string; }'],
            ['c', 'string[]'],
            ['foo', '(bar: string) => void'],
        ])('input: %s => output: %s', (propertyName, expectedTypeString) => {
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });
    });

    describe('ts build-in type', () => {
        let type: ts.Type;
        let ctx: PluginContext;

        beforeAll(() => {
            const sourceCode = `
                let x: string;
            `;
            ctx = prepareTestContext(sourceCode);
            const nodeX = (ctx.sourceFile?.statements[0] as ts.VariableStatement).declarationList.declarations[0].name as ts.Identifier;
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
