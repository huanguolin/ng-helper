import { TokenKind, type LocationWithTrivia } from '../types';
import { stringRegex } from '../utils';

export const kindToSignMap = {
    [TokenKind.Plus]: '+',
    [TokenKind.Minus]: '-',
    [TokenKind.Multiply]: '*',
    [TokenKind.Divide]: '/',
    [TokenKind.Modulo]: '%',
    [TokenKind.StrictEqual]: '===',
    [TokenKind.StrictNotEqual]: '!==',
    [TokenKind.Equal]: '==',
    [TokenKind.NotEqual]: '!=',
    [TokenKind.LessThan]: '<',
    [TokenKind.LessThanOrEqual]: '<=',
    [TokenKind.GreaterThan]: '>',
    [TokenKind.GreaterThanOrEqual]: '>=',
    [TokenKind.And]: '&&',
    [TokenKind.Or]: '||',
    [TokenKind.Not]: '!',
    [TokenKind.Assign]: '=',
    [TokenKind.Pipe]: '|',
    [TokenKind.Semicolon]: ';',
    [TokenKind.Comma]: ',',
    [TokenKind.Dot]: '.',
    [TokenKind.Colon]: ':',
    [TokenKind.Question]: '?',
    [TokenKind.LeftParen]: '(',
    [TokenKind.RightParen]: ')',
    [TokenKind.LeftBrace]: '{',
    [TokenKind.RightBrace]: '}',
    [TokenKind.LeftBracket]: '[',
    [TokenKind.RightBracket]: ']',
} as const;

export class Token implements LocationWithTrivia {
    readonly kind: TokenKind;
    readonly start: number;
    readonly end: number;
    readonly trivia?: string;
    readonly value?: string;
    readonly hasError: boolean;

    constructor({
        kind,
        start,
        end,
        trivia,
        value,
    }: {
        kind: TokenKind;
        start: number;
        end: number;
        trivia?: string;
        /**
         * string/number/identifier
         * 注意:
         * 1. 这里是原样保存，比如 .3 不会存为 0.3.
         * 2. 字符串是包含前后引号的，当然，在有错误时可能没有结尾引号。
         */
        value?: string;
    }) {
        this.kind = kind;
        this.start = start;
        this.end = end;
        this.trivia = trivia;
        if (this.hasValue(kind)) {
            this.value = value;
        }
        this.hasError = this.checkError();
    }

    checkError() {
        let hasErr = !!this.trivia && this.trivia.trim().length > 0;
        if (!hasErr && this.kind === TokenKind.String) {
            // 有可能缺失结尾引号
            hasErr = !stringRegex.test(this.value!);
        }
        return hasErr;
    }

    getFullStart(): number {
        if (this.trivia) {
            return this.start - this.trivia.length;
        }
        return this.start;
    }

    toString(): string {
        if (this.value) {
            return this.value;
        }
        const map = kindToSignMap as Record<TokenKind, string>;
        return map[this.kind] || ''; // EOF is ''
    }

    toFullString(): string {
        return this.trivia + this.toString();
    }

    private hasValue(kind: TokenKind) {
        return kind === TokenKind.String || kind === TokenKind.Number || kind === TokenKind.Identifier;
    }
}
