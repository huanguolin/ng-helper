import { Scanner } from '../../src/scanner';
import { TokenKind, type ScanError } from '../../src/types';

describe('Scanner', () => {
    const scanner = new Scanner();

    describe('scan()', () => {
        it('should tokenize a string', function () {
            const tokens = scanAll(scanner, 'a.bc[22]+1.3|f:\'a\\\'c\':"d\\"e"');

            let i = 0;
            expect(tokens[i].start).toEqual(0);
            expect(tokens[i].kind).toEqual(TokenKind.Identifier);
            expect(tokens[i].value).toEqual('a');

            i++;
            expect(tokens[i].start).toEqual(1);
            expect(tokens[i].kind).toEqual(TokenKind.Dot);

            i++;
            expect(tokens[i].start).toEqual(2);
            expect(tokens[i].kind).toEqual(TokenKind.Identifier);
            expect(tokens[i].value).toEqual('bc');

            i++;
            expect(tokens[i].start).toEqual(4);
            expect(tokens[i].kind).toEqual(TokenKind.LeftBracket);

            i++;
            expect(tokens[i].start).toEqual(5);
            expect(tokens[i].kind).toEqual(TokenKind.Number);
            expect(tokens[i].value).toEqual('22');

            i++;
            expect(tokens[i].start).toEqual(7);
            expect(tokens[i].kind).toEqual(TokenKind.RightBracket);

            i++;
            expect(tokens[i].start).toEqual(8);
            expect(tokens[i].kind).toEqual(TokenKind.Plus);

            i++;
            expect(tokens[i].start).toEqual(9);
            expect(tokens[i].kind).toEqual(TokenKind.Number);
            expect(tokens[i].value).toEqual('1.3');

            i++;
            expect(tokens[i].start).toEqual(12);
            expect(tokens[i].kind).toEqual(TokenKind.Pipe);

            i++;
            expect(tokens[i].start).toEqual(13);
            expect(tokens[i].kind).toEqual(TokenKind.Identifier);
            expect(tokens[i].value).toEqual('f');

            i++;
            expect(tokens[i].start).toEqual(14);
            expect(tokens[i].kind).toEqual(TokenKind.Colon);

            i++;
            expect(tokens[i].start).toEqual(15);
            expect(tokens[i].kind).toEqual(TokenKind.String);
            expect(tokens[i].value).toEqual("a'c");

            i++;
            expect(tokens[i].start).toEqual(21);
            expect(tokens[i].kind).toEqual(TokenKind.Colon);

            i++;
            expect(tokens[i].start).toEqual(22);
            expect(tokens[i].kind).toEqual(TokenKind.String);
            expect(tokens[i].value).toEqual('d"e');
        });

        describe('identifiers', () => {
            it.each([
                ['a', 'a'],
                ['abc', 'abc'],
                ['  abc', 'abc'],
                [' \nabc  ', 'abc'],
                ['abc123', 'abc123'],
                ['_$abc', '_$abc'],
                ['$abc1', '$abc1'],
            ])('should scan identifier: %s => %s', (input, output) => {
                scanner.initialize(input);
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.Identifier);
                expect(token.value).toBe(output);
            });

            it.each([
                ['undefined', TokenKind.Undefined],
                ['null', TokenKind.Null],
                ['true', TokenKind.True],
                ['false', TokenKind.False],
            ])('should recognize keywords: %s => %s', (input, tokenKind) => {
                const tokens = scanAll(scanner, input);
                expect(tokens[0].kind).toEqual(tokenKind);
            });

            it('should tokenize identifiers with spaces around dots the same as without spaces', () => {
                const spaces = scanAll(scanner, 'foo. bar . baz')
                    .map((x) => x.toString())
                    .join();
                const noSpaces = scanAll(scanner, 'foo.bar.baz')
                    .map((x) => x.toString())
                    .join();

                expect(spaces).toEqual(noSpaces);
            });
        });

        describe('numbers', () => {
            it('should scan integer', () => {
                scanner.initialize('123');
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.Number);
                expect(token.value).toBe('123');
            });

            it('should scan decimal number', () => {
                scanner.initialize('123.456');
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.Number);
                expect(token.value).toBe('123.456');
            });

            it('should scan number with scientific notation', () => {
                scanner.initialize('1.23e-4');
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.Number);
                expect(token.value).toBe('1.23e-4');
            });

            it('should scan number starting with dot', () => {
                scanner.initialize('.123');
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.Number);
                expect(token.value).toBe('.123');
            });
        });

        describe('strings', () => {
            it('should scan double quoted string', () => {
                scanner.initialize('"hello"');
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.String);
                expect(token.value).toBe('hello');
            });

            it('should scan single quoted string', () => {
                scanner.initialize("'world'");
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.String);
                expect(token.value).toBe('world');
            });

            it('should handle escape sequences', () => {
                scanner.initialize('"hello\\nworld\\t!"');
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.String);
                expect(token.value).toBe('hello\nworld\t!');
            });

            it('should handle unicode escape sequences', () => {
                scanner.initialize('"\\u0041"');
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.String);
                expect(token.value).toBe('A');
            });
        });

        describe('operators', () => {
            it('should scan single-char operators', () => {
                const tokens = scanAll(scanner, '+ - * /');

                expect(tokens.map((t) => t.kind)).toEqual([
                    TokenKind.Plus,
                    TokenKind.Minus,
                    TokenKind.Multiply,
                    TokenKind.Divide,
                ]);
            });

            it('should scan multi-char operators', () => {
                const tokens = scanAll(scanner, '=== !== && ||');

                expect(tokens.map((t) => t.kind)).toEqual([
                    TokenKind.StrictEqual,
                    TokenKind.StrictNotEqual,
                    TokenKind.And,
                    TokenKind.Or,
                ]);
            });
        });

        describe('whitespace handling', () => {
            it('should skip whitespace', () => {
                const tokens = scanAll(scanner, '   123   456   ');

                expect(tokens.map((t) => t.value)).toEqual(['123', '456']);
            });

            it('should handle all types of whitespace', () => {
                scanner.initialize('\n\r\t\v\u00A0123');
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.Number);
                expect(token.value).toBe('123');
            });
        });

        describe('error handling', () => {
            it('should report unterminated string', () => {
                const errors: ScanError[] = [];
                scanner.initialize('"unclosed', (error) => errors.push(error));
                scanner.scan();

                expect(errors.length).toBe(1);
                expect(errors[0].message).toContain('Unterminated string');
                expect(errors[0].start).toBe(9);
            });

            it('should report invalid characters', () => {
                const errors: ScanError[] = [];
                scanner.initialize('@', (error) => errors.push(error));
                scanner.scan();

                expect(errors.length).toBe(1);
                expect(errors[0].message).toContain('Unexpected character');
            });
        });
    });
});

// Helper function to scan all tokens
function scanAll(scanner: Scanner, input?: string) {
    if (input) {
        scanner.initialize(input);
    }

    const tokens = [];
    let token;
    while ((token = scanner.scan()).kind !== TokenKind.EOF) {
        tokens.push(token);
    }
    return tokens;
}
