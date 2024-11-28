import { Token } from '../../src/scanner/token';
import { TokenKind } from '../../src/types';

describe('Token', () => {
    describe('constructor()', () => {
        it('should create token with basic properties', () => {
            const token = new Token({
                kind: TokenKind.Plus,
                start: 0,
                end: 1,
            });

            expect(token.kind).toBe(TokenKind.Plus);
            expect(token.start).toBe(0);
            expect(token.end).toBe(1);
            expect(token.value).toBeUndefined();
        });

        it('should set value for String token', () => {
            const token = new Token({
                kind: TokenKind.String,
                start: 0,
                end: 5,
                value: 'hello',
            });

            expect(token.value).toBe('hello');
        });

        it('should set value for Number token', () => {
            const token = new Token({
                kind: TokenKind.Number,
                start: 0,
                end: 2,
                value: '42',
            });

            expect(token.value).toBe('42');
        });

        it('should set value for Identifier token', () => {
            const token = new Token({
                kind: TokenKind.Identifier,
                start: 0,
                end: 3,
                value: 'foo',
            });

            expect(token.value).toBe('foo');
        });
    });

    describe('toString()', () => {
        it('should return value for tokens with value', () => {
            const token = new Token({
                kind: TokenKind.String,
                start: 0,
                end: 5,
                value: 'hello',
            });

            expect(token.toString()).toBe('hello');
        });

        it.each([
            { kind: TokenKind.Plus, expected: '+' },
            { kind: TokenKind.Minus, expected: '-' },
            { kind: TokenKind.Multiply, expected: '*' },
            { kind: TokenKind.Divide, expected: '/' },
            { kind: TokenKind.Modulo, expected: '%' },
            { kind: TokenKind.And, expected: '&&' },
            { kind: TokenKind.Or, expected: '||' },
            { kind: TokenKind.Not, expected: '!' },
            { kind: TokenKind.StrictEqual, expected: '===' },
            { kind: TokenKind.Equal, expected: '==' },
            { kind: TokenKind.StrictNotEqual, expected: '!==' },
            { kind: TokenKind.NotEqual, expected: '!=' },
            { kind: TokenKind.GreaterThan, expected: '>' },
            { kind: TokenKind.GreaterThanOrEqual, expected: '>=' },
            { kind: TokenKind.LessThan, expected: '<' },
            { kind: TokenKind.LessThanOrEqual, expected: '<=' },
            { kind: TokenKind.Assign, expected: '=' },
            { kind: TokenKind.Pipe, expected: '|' },
            { kind: TokenKind.Semicolon, expected: ';' },
            { kind: TokenKind.Comma, expected: ',' },
            { kind: TokenKind.Dot, expected: '.' },
            { kind: TokenKind.Colon, expected: ':' },
            { kind: TokenKind.Question, expected: '?' },
            { kind: TokenKind.LeftParen, expected: '(' },
            { kind: TokenKind.RightParen, expected: ')' },
            { kind: TokenKind.LeftBrace, expected: '{' },
            { kind: TokenKind.RightBrace, expected: '}' },
            { kind: TokenKind.LeftBracket, expected: '[' },
            { kind: TokenKind.RightBracket, expected: ']' },
            { kind: TokenKind.True, expected: 'true' },
            { kind: TokenKind.False, expected: 'false' },
            { kind: TokenKind.Undefined, expected: 'undefined' },
            { kind: TokenKind.Null, expected: 'null' },
        ])('should return operator sign for %s', ({ kind, expected }) => {
            const token = new Token({ kind, start: 0, end: 1 });
            expect(token.toString()).toBe(expected);
        });

        it('should return empty string for EOF token', () => {
            const token = new Token({
                kind: TokenKind.EOF,
                start: 0,
                end: 0,
            });

            expect(token.toString()).toBe('');
        });
    });

    describe('shouldHaveValue()', () => {
        it.each([TokenKind.String, TokenKind.Number, TokenKind.Identifier])('should return true for %s', (kind) => {
            expect(Token.shouldHaveValue(kind)).toBe(true);
        });
    });
});
