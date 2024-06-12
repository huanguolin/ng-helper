import { canCompletionNgDirective, isInStartTagAnd } from '../lib/html';

describe('isInStartTagAnd()', () => {
    it.each([
        [' ', false],
        ['<>', false],
        ['</', false],
        ['<></', false],
        ['>', false],
        ['/>', false],
        ['<', true],
        ['><', true],
        ['/><', true],
        ['/>< ', true],
    ])('input: %s => output: %s', (input: string, output: boolean) => {
        const v = isInStartTagAnd(input, () => true);
        expect(v).toBe(output);
    })
});

describe('canCompletionInStartTag()', () => {
    it.each([
        ['<', false],
        ['<di', false],
        ['<div', false],
        ['<div ', true],
        ['<div class', true],
        ['<div class=', false],
        ['<div class="', false],
        ['<div class="btn', false],
        ['<div class="btn ', false],
        ['<div class="btn"', true],
        ['<div class="btn" ', true],
        ['<div class="btn"  tit', true],
        ['<div class="btn"  title=" ', false],
        ['<div class="btn"  title=" "', true],
        ['<div class="btn" ng-if="click()"', true],
        ['<div class="btn" ng-hide', true],
        ['<div class="btn" ng-hide ', true],
    ])('input: %s => output: %s', (input: string, output: boolean) => {
        const v = canCompletionNgDirective(input);
        expect(v).toBe(output);
    })
});