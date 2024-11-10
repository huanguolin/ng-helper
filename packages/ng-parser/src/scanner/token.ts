import { TokenKind, type Location } from '../types';

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

export class Token implements Location {
    readonly kind: TokenKind;
    readonly start: number;
    readonly end: number;
    readonly value?: string;

    constructor({
        kind,
        start,
        end,
        value,
    }: {
        kind: TokenKind;
        start: number;
        end: number;
        /**
         * string/number/identifier
         */
        value?: string;
    }) {
        this.kind = kind;
        this.start = start;
        this.end = end;
        if (this.hasValue(kind)) {
            this.value = value;
        }
    }

    is(tokenKind: TokenKind): boolean {
        return this.kind === tokenKind;
    }

    toString(): string {
        if (this.value) {
            return this.value;
        }
        const map = kindToSignMap as Record<TokenKind, string>;
        return map[this.kind] || ''; // EOF is ''
    }

    private hasValue(kind: TokenKind) {
        return kind === TokenKind.String || kind === TokenKind.Number || kind === TokenKind.Identifier;
    }
}
