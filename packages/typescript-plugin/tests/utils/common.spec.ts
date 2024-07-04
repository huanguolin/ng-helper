// eslint-disable-next-line no-restricted-imports
import ts from 'typescript';

import { PluginContext } from '../../src/type';
import { getPropertyType } from '../../src/utils/common';
import { prepareSimpleTestData } from '../helper';

describe('getPropertyType()', () => {
    let type: ts.Type;
    let ctx: PluginContext;

    beforeAll(() => {
        const className = 'MyClass';
        // TODO add test case
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
        const data = prepareSimpleTestData(sourceCode, className);
        type = data.type;
        ctx = data.ctx;
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
        if (expectedTypeString === undefined) {
            expect(result).toBeUndefined();
        } else {
            expect(ctx.typeChecker.typeToString(result!)).toBe(expectedTypeString);
        }
    });
});
