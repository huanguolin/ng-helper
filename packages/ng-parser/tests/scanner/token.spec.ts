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

        it('should return operator sign for operator tokens', () => {
            const tokens = [
                { kind: TokenKind.Plus, expected: '+' },
                { kind: TokenKind.Minus, expected: '-' },
                { kind: TokenKind.StrictEqual, expected: '===' },
                { kind: TokenKind.And, expected: '&&' },
            ];

            tokens.forEach(({ kind, expected }) => {
                const token = new Token({ kind, start: 0, end: 1 });
                expect(token.toString()).toBe(expected);
            });
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
});
