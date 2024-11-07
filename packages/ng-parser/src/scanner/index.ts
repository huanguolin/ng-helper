import { TokenKind, type ScanErrorHandler } from '../types';
import { noop } from '../utils';

import { kindToSignMap, Token } from './token';

const signToKindMap = Object.entries(kindToSignMap).reduce(
    (s, [k, v]) => Object.assign(s, { [v]: k }),
    {} as Record<string, TokenKind>,
);

export class Scanner {
    private source = '';
    private pos = 0;
    private onError: ScanErrorHandler = noop;

    initialize(source: string, onError?: ScanErrorHandler) {
        this.source = source;
        this.pos = 0;
        if (onError) {
            this.onError = onError;
        }
    }

    scan(): Token {
        while (!this.isEnd()) {
            const ch = this.at(this.pos);
            if (this.isWhitespace(ch)) {
                this.pos++;
                continue;
            } else if (this.isStringStart(ch)) {
                return this.readString();
            } else if (this.isNumberStart(ch)) {
                return this.readNumber();
            } else if (this.isIdentifierStart(ch)) {
                return this.readIdentifier();
            } else {
                const ch2 = ch + this.at(this.pos + 1);
                const ch3 = ch2 + this.at(this.pos + 2);
                const sign1 = signToKindMap[ch];
                const sign2 = signToKindMap[ch2];
                const sign3 = signToKindMap[ch3];
                const sign = sign3 ?? sign2 ?? sign1;
                if (isNumberType(sign)) {
                    const value = isNumberType(sign3) ? ch3 : isNumberType(ch2) ? ch2 : ch;
                    this.pos += value.length;
                    return this.createToken({
                        kind: sign,
                        value,
                    });
                } else {
                    this.reportError(`Unexpected character: ${ch}`);
                    this.pos++;
                    return this.scan();
                }
            }
        }
        return this.createEOFToken();
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
        const start = this.pos;
        while (this.isIdentifierContinue(this.at(this.pos))) {
            this.pos++;
        }
        return this.createToken({
            kind: TokenKind.Identifier,
            value: this.source.slice(start, this.pos),
        });
    }

    private isIdentifierContinue(ch: string): boolean {
        return this.isIdentifierStart(ch) || this.isDigit(ch);
    }

    private isIdentifierStart(ch: string): boolean {
        return ('a' <= ch && ch <= 'z') || ('A' <= ch && ch <= 'Z') || '_' === ch || ch === '$';
    }

    private readNumber(): Token {
        const mainFragment = this.scanNumberFragment();

        // 小数
        let decimalFragment: string | undefined;
        if (this.at(this.pos) === '.') {
            this.pos++;
            decimalFragment = this.scanNumberFragment();
        }

        // 科学计数法
        let scientificFragment: string | undefined;
        if (this.at(this.pos).toLowerCase() === 'e') {
            this.pos++;
            let sign = '';
            if (this.at(this.pos) === '-' || this.at(this.pos) === '+') {
                sign = this.at(this.pos);
                this.pos++;
            }
            const number = this.scanNumberFragment();
            if (!number) {
                this.reportError('Digit expected');
            } else {
                scientificFragment = sign + number;
            }
        }

        // 组合最终结果
        let result = mainFragment;
        if (decimalFragment) {
            result += '.' + decimalFragment;
        }
        if (scientificFragment) {
            result += scientificFragment;
        }

        return this.createToken({
            kind: TokenKind.Number,
            value: result,
        });
    }

    private scanNumberFragment(): string {
        const start = this.pos;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const c = this.at(this.pos);
            if (this.isDigit(c)) {
                this.pos++;
            } else {
                break;
            }
        }
        return this.source.slice(start, this.pos);
    }

    private isNumberStart(ch: string): boolean {
        // support number like .3
        return this.isDigit(ch) || (ch === '.' && this.isDigit(this.at(this.pos + 1)));
    }

    private isDigit(ch: string): boolean {
        return '0' <= ch && ch <= '9';
    }

    private isStringStart(ch: string): boolean {
        return ch === '"' || ch === "'";
    }

    private readString(): Token {
        const stringStart = this.pos;

        const quote = this.at(this.pos);
        this.pos++;

        let result = '';
        let start = this.pos;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.isEnd()) {
                result += this.source.slice(start, this.pos);
                this.reportError('Unterminated string');
                break;
            }

            const ch = this.at(this.pos);
            if (ch === quote) {
                result += this.source.slice(start, this.pos);
                this.pos++;
                break;
            }
            if (ch === '\\') {
                result += this.source.substring(start, this.pos);
                result += this.scanEscapeSequence();
                start = this.pos;
                continue;
            }
            this.pos++;
        }
        return this.createToken({ kind: TokenKind.String, value: result, start: stringStart });
    }

    private scanEscapeSequence(): string {
        const start = this.pos;
        this.pos++;

        if (this.isEnd()) {
            this.reportError('Unexpected end of text');
            return '';
        }

        const ch = this.at(this.pos);
        this.pos++;
        switch (ch) {
            case 'u':
                // TODO: support unicode escape sequence
                return ch;
        }
        return '';
    }

    private at(n: number): string {
        return this.source.charAt(n);
    }

    private isEnd(): boolean {
        return this.pos >= this.source.length;
    }

    private isWhitespace(ch: string): boolean {
        // IE treats non-breaking space as \u00A0
        return ch === ' ' || ch === '\r' || ch === '\t' || ch === '\n' || ch === '\v' || ch === '\u00A0';
    }

    private createToken(tokenInfo: { kind: TokenKind; value: string; start?: number }): Token {
        const t = new Token({
            ...tokenInfo,
            start: tokenInfo.start ?? this.pos - tokenInfo.value.length,
            end: this.pos,
        });
        return t;
    }
}

function isNumberType(n: unknown): n is number {
    return typeof n === 'number';
}