import type ts from 'typescript';

import { PluginContext } from '../../src/type';
import { getPropertyType, typeToString } from '../../src/utils/common';
import { prepareTestContext } from '../helper';

describe('getPropertyType()', () => {
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
        ['property', 'number'],
        ['publicProperty', 'string'],
        ['nonExistentProperty', undefined],
        ['privateProperty', undefined],
        ['protectedProperty', undefined],
        ['a', '{ b: { c: number; }; }'],
    ])('input: %s => output: %s', (propertyName, expectedTypeString) => {
        const result = getPropertyType(ctx, type, propertyName);
        expect(typeToString(ctx, result)).toBe(expectedTypeString);
    });
});
