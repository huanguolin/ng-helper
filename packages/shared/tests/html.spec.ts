import { canCompletionAttrValue, canCompletionNgDirective, canCompletionTemplate, isInStartTagAnd } from '../lib/html';

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

describe('canCompletionNgDirective()', () => {
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

describe('canCompletionAttrValue()', () => {
    it.each([
        ['<', false],
        ['<di', false],
        ['<div', false],
        ['<div ', false],
        ['<div class', false],
        ['<div class=', false],
        ['<div class="', true],
        ['<div class="btn', true],
        ['<div class="btn ', true],
        ['<div class="btn"', false],
        ['<div class="btn" ', false],
        ['<div class="btn"  tit', false],
        ['<div class="btn"  title=" ', true],
        ['<div class="btn"  title=" "', false],
        ['<div class="btn" ng-if="click()"', false],
        ['<div class="btn" ng-hide', false],
        ['<div class="btn" ng-hide ', false],
    ])('input: %s => output: %s', (input: string, output: boolean) => {
        const v = canCompletionAttrValue(input);
        expect(v).toBe(output);
    })
});

describe('canCompletionTemplate()', () => {
    it.each([
        ['{{', true],
        ['{{}}', false],
        ['{{\n}}', false],
        ['{{}', false],
        ['{{ ctrl', true],
        ['<x-c attr-title="{{', true],
        ['{{ <div', false],
    ])('input: %s => output: %s', (input: string, output: boolean) => {
        const v = canCompletionTemplate(input);
        expect(v).toBe(output);
    })
});