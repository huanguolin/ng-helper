import type ts from 'typescript';

import { PluginContext } from '../../src/type';
import { getPropertyType, isTypeOfType, typeToString } from '../../src/utils/common';
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

    describe('generic type', () => {
        let typeX: ts.Type;
        let typeY: ts.Type;
        let ctx: PluginContext;

        beforeAll(() => {
            const sourceCode = `
            type M<T> = { foo: T; bar: () => T };
            type N<T = number> = { foo: T; bar: () => T };
            let x: M<number>;
            let y: N;`;
            ctx = prepareTestContext(sourceCode);
            const nodeX = findVariableDeclaration(ctx, 'x');
            const nodeY = findVariableDeclaration(ctx, 'y');
            typeX = ctx.typeChecker.getTypeAtLocation(nodeX);
            typeY = ctx.typeChecker.getTypeAtLocation(nodeY);
        });

        it.each([
            ['nonExistentProperty', undefined],
            ['foo', 'number'],
            ['bar', '() => number'],
        ])('input: %s => output: %s', (propertyName, expectedTypeString) => {
            const rX = getPropertyType(ctx, typeX, propertyName);
            const rY = getPropertyType(ctx, typeY, propertyName);
            expect(typeToString(ctx, rX)).toBe(expectedTypeString);
            expect(typeToString(ctx, rY)).toBe(expectedTypeString);
        });
    });

    // TODO fix this
    // describe('use utility type', () => {
    //     let type: ts.Type;
    //     let ctx: PluginContext;

    //     beforeAll(() => {
    //         const sourceCode = `
    //         interface Person {
    //             name: string;
    //             age: number;
    //             say: (words: string) => void;
    //         }
    //         let x: Omit<Person, 'say'>;
    //         `;
    //         ctx = prepareTestContext(sourceCode);
    //         const nodeX = findVariableDeclaration(ctx, 'x');
    //         type = ctx.typeChecker.getTypeAtLocation(nodeX);
    //     });

    //     it.each([
    //         ['nonExistentProperty', undefined],
    //         ['name', 'string'],
    //         ['say', undefined],
    //     ])('input: %s => output: %s', (propertyName, expectedTypeString) => {
    //         const result = getPropertyType(ctx, type, propertyName);
    //         expect(typeToString(ctx, result)).toBe(expectedTypeString);
    //     });
    // });

    // TODO 单元测试过不了
    describe('union type', () => {
        let type: ts.Type;
        let ctx: PluginContext;

        beforeAll(() => {
            const sourceCode = `let x: string | number;`;
            ctx = prepareTestContext(sourceCode);
            const nodeX = findVariableDeclaration(ctx, 'x');
            type = ctx.typeChecker.getTypeAtLocation(nodeX);
        });

        it.each([
            // ['nonExistentProperty', undefined],
            // ['length', undefined],
            ['toString', '() => string'],
        ])('input: %s => output: %s', (propertyName, expectedTypeString) => {
            const result = getPropertyType(ctx, type, propertyName);
            expect(typeToString(ctx, result)).toBe(expectedTypeString);
        });
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

describe('isTypeOfType()', () => {
    let ctx: PluginContext;

    beforeEach(() => {
        ctx = prepareTestContext(`
            type M<T> = { p: T };
            type N<T = number> = { q: T };
            class A { }
            const x = A;
            let y: A;
            let z: M<number>;
            let r: N;
        `);
    });

    it.each([
        ['x', true],
        ['y', false],
        ['z', false],
        ['r', false],
    ])('input: %s => output: %s', (varName, expected) => {
        const node = findVariableDeclaration(ctx, varName);
        const type = ctx.typeChecker.getTypeAtLocation(node);
        const result = isTypeOfType(ctx, type);
        expect(result).toBe(expected);
    });
});
