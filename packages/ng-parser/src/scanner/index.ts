import { TokenKind, type ScanErrorHandler } from '../types';
import { noop } from '../utils';

import { kindToSignMap, Token } from './token';

const signToKindMap = Object.entries(kindToSignMap).reduce(
    (s, [k, v]) => Object.assign(s, { [v]: k }),
    {} as Record<string, TokenKind>,
);

export class Scanner {
    private source = '';
    private lastEnd = 0;
    private pos = 0;
    private onError: ScanErrorHandler = noop;
    private inError = false;

    initialize(source: string, onError?: ScanErrorHandler) {
        this.source = source;
        this.lastEnd = 0;
        this.pos = 0;
        if (onError) {
            this.onError = onError;
        }
        this.inError = false;
    }

    scan(): Token {
        if (this.isEnd()) {
            return this.createEOFToken();
        }

        const ch = this.advanceAndSkipSpace();
        // 跳过所有的空白符后，有可能到达末尾，从而返回了空字符串
        if (!ch) {
            return this.createEOFToken();
        } else if (this.isStringStart(ch)) {
            return this.readString();
        } else if (this.isNumberStart(ch)) {
            return this.readNumber();
        } else if (this.isIdentifierStart(ch)) {
            return this.readIdentifier();
        } else {
            const ch2 = ch + this.peek();
            const ch3 = ch2 + this.peek(1);
            const sign1 = signToKindMap[ch];
            const sign2 = signToKindMap[ch2];
            const sign3 = signToKindMap[ch3];
            const sign = sign3 ?? sign2 ?? sign1;
            if (isNumberType(sign)) {
                return this.createToken({
                    kind: sign,
                    value: isNumberType(sign3) ? ch3 : isNumberType(ch2) ? ch2 : ch,
                });
            } else {
                if (!this.inError) {
                    this.inError = true;
                    this.reportError(`Unexpected character: ${ch}`);
                }
                return this.scan();
            }
        }
    }

    private createEOFToken(): Token {
        return this.createToken({ kind: TokenKind.EOF, value: '' });
    }

    private reportError(message: string) {
        this.onError({
            start: this.pos,
            end: this.pos + 1,
            message,
        });
    }

    private readIdentifier(): Token {
        // TODO
    }

    private isIdentifierStart(ch: string): boolean {
        return ('a' <= ch && ch <= 'z') || ('A' <= ch && ch <= 'Z') || '_' === ch || ch === '$';
    }

    private readNumber(): Token {
        // TODO
    }

    private isNumberStart(ch: string): boolean {
        // support number like .3
        return this.isNumber(ch) || (ch === '.' && this.isNumber(this.peek()));
    }

    private isNumber(ch: string): boolean {
        return typeof ch === 'string' && '0' <= ch && ch <= '9';
    }

    private isStringStart(ch: string): boolean {
        return ch === '"' || ch === "'";
    }

    private readString(): Token {
        // TODO
    }

    private advanceAndSkipSpace(): string {
        while (!this.isEnd()) {
            const c = this.source.charAt(this.pos++);
            if (!this.isWhitespace(c)) {
                return c;
            }
        }
        return '';
    }

    private peek(n = 0): string {
        return this.source.charAt(this.pos + n);
    }

    private isEnd(): boolean {
        return this.pos >= this.source.length;
    }

    private isWhitespace(ch: string): boolean {
        // IE treats non-breaking space as \u00A0
        return ch === ' ' || ch === '\r' || ch === '\t' || ch === '\n' || ch === '\v' || ch === '\u00A0';
    }

    private createToken(tokenInfo: { kind: TokenKind; value: string }): Token {
        const t = new Token({
            ...tokenInfo,
            start: this.pos - tokenInfo.value.length,
            end: this.pos,
            trivia: this.lastEnd < this.pos ? this.source.slice(this.lastEnd, this.pos) : undefined,
        });
        this.inError = false;
        this.lastEnd = t.start;
        return t;
    }
}

function isNumberType(n: unknown): n is number {
    return typeof n === 'number';
}
