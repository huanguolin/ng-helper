import { getConstructor, getStaticPublicInjectionField } from '../../src/diagnostic/utils';
import { findClassDeclaration } from '../../src/utils/common';
import { prepareTestContext } from '../helper';

describe('getStaticPublicInjectionField()', () => {
    it.each([
        [`class x {}`, false],
        [`class { static $inject = []; }`, true],
        [`class { $inject = []; }`, false],
        [`class { private static $inject = []; }`, false],
        [`class { protected static $inject = []; }`, false],
        [`class { public static $inject = []; }`, true],
    ])('input: %s => output: %s', (code, isHasOrNot) => {
        const ctx = prepareTestContext(code);
        const classNode = findClassDeclaration(ctx, ctx.sourceFile)!;
        const result = getStaticPublicInjectionField(ctx, classNode);
        expect(!!result).toBe(isHasOrNot);
    });
});

describe('getConstructor()', () => {
    it.each([
        [`class x {}`, false],
        [`class x { constructor() }`, true],
    ])('input: %s => output: %s', (code, hasOrNot) => {
        const ctx = prepareTestContext(code);
        const classNode = findClassDeclaration(ctx, ctx.sourceFile)!;
        const result = getConstructor(ctx, classNode);
        expect(!!result).toBe(hasOrNot);
    });
});
