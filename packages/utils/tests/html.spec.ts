import { canCompletionInStartTag } from '../lib/html';

describe('canCompletionInStartTag()', () => {
    it.each([
        ['<', false],
        ['<di', false],
        ['<div', false],
        ['<div ', true],
        ['<div class', false],
        ['<div class=', false],
        ['<div class="', false],
        ['<div class="btn', false],
        ['<div class="btn ', false],
        ['<div class="btn"', true],
        ['<div class="btn" ', true],
        ['<div class="btn"  tit', false],
        ['<div class="btn"  title=" ', false],
        ['<div class="btn"  title=" "', true],
    ])('input: %s => output: %s', (input: string, output: boolean) => {
        const v = canCompletionInStartTag(input);
        expect(v).toBe(output);
    })
});