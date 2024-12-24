import { Parser } from './parser';
import type { NgAttrName, ProgramResult } from './types';

const parser = new Parser();

export function ngParse<T extends NgAttrName>(sourceText: string, attrName?: T): ProgramResult<T> {
    // one-time-binding: see https://docs.angularjs.org/guide/expression#one-time-binding
    if (sourceText.trim().startsWith('::')) {
        // 替换为空格避免报错位置偏移
        sourceText = sourceText.replace(/::/, '  ');
    }

    if (attrName === 'ng-repeat') {
        return parser.parseNgRepeat(sourceText) as ProgramResult<T>;
    } else if (attrName === 'ng-controller') {
        return parser.parseNgController(sourceText) as ProgramResult<T>;
    } else {
        return parser.parse(sourceText) as ProgramResult<T>;
    }
}
