import { Parser } from './parser';
import type { Program } from './parser/node';

const parser = new Parser();

export function ngParse(sourceText: string): Program {
    // one-time-binding: see https://docs.angularjs.org/guide/expression#one-time-binding
    if (sourceText.trim().startsWith('::')) {
        // 替换为空格避免报错位置偏移
        sourceText = sourceText.replace(/::/, '  ');
    }
    return parser.parse(sourceText);
}
