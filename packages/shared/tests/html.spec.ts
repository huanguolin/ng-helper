import { isInDbQuote, canCompletionNgDirective, isInTemplate, isInStartTagAnd, getTemplateInnerText, isContainsNgFilter, getTemplateText } from '../lib/html';

describe('isContainsNgFilter()', () => {
    it.each([
        ['', false],
        ['  ', false],
        ['||', false],
        ['a||', false],
        ['||b', false],
        ['a||b', false],
        ['|', true],
        ['"A"|', true],
        ['|date', true],
        ['"A"|date', true],
        ['"A" | date', true],
    ])('input: %s => output: %s', (input: string, output: boolean) => {
        const v = isContainsNgFilter(input);
        expect(v).toBe(output);
    })
});

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
        ['"', true],
        ['""', false],
        ['{{ "', true],
        ['"a" "', true],
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
        const v = isInDbQuote(input);
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
        const v = isInTemplate(input);
        expect(v).toBe(output);
    })
});

describe('getTemplateInnerText()', () => {
    it.each([
        ['some text before {{template', 'template'], // 正常情况
        ['text without template markers', undefined], // 无模板起始标记
        ['text with {{illegal}} character}', undefined], // 含非法字符
        ['text with {{<html>', undefined], // 含非法字符
        ['start {{ignore this}} end {{template start', 'template start'], // 多个模板起始标记
        ['{{  ', ''], // trim
        ['', undefined], // 空字符串输入
    ])('given input "%s", should return "%s"', (input, expectedOutput) => {
        expect(getTemplateInnerText(input)).toBe(expectedOutput);
    });
});

describe('getTemplateText()', () => {
    it.each([
        ['some text before {{template', '{{template'], // 正常情况
        ['text without template markers', undefined], // 无模板起始标记
        ['text with {{illegal}} character}', undefined], // 含非法字符
        ['text with {{<html>', undefined], // 含非法字符
        ['start {{ignore this}} end {{template start', '{{template start'], // 多个模板起始标记
        ['{{  ', '{{  '],
        ['', undefined],
    ])('given input "%s", should return "%s"', (input, expectedOutput) => {
        expect(getTemplateText(input)).toBe(expectedOutput);
    });
});