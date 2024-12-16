import { Scanner } from '../../src/scanner';
import { ErrorReporter, TokenKind, type NgParseError } from '../../src/types';

describe('Scanner', () => {
    const scanner = new Scanner();

    describe('scan()', () => {
        it('should tokenize a string', function () {
            const tokens = scanAll(scanner, 'a.bc[22]+1.3|f:\'a\\\'c\':"d\\"e"');

            let i = 0;
            expect(tokens[i].start).toEqual(0);
            expect(tokens[i].end).toEqual(1);
            expect(tokens[i].kind).toEqual(TokenKind.Identifier);
            expect(tokens[i].value).toEqual('a');

            i++;
            expect(tokens[i].start).toEqual(1);
            expect(tokens[i].end).toEqual(2);
            expect(tokens[i].kind).toEqual(TokenKind.Dot);

            i++;
            expect(tokens[i].start).toEqual(2);
            expect(tokens[i].end).toEqual(4);
            expect(tokens[i].kind).toEqual(TokenKind.Identifier);
            expect(tokens[i].value).toEqual('bc');

            i++;
            expect(tokens[i].start).toEqual(4);
            expect(tokens[i].end).toEqual(5);
            expect(tokens[i].kind).toEqual(TokenKind.LeftBracket);

            i++;
            expect(tokens[i].start).toEqual(5);
            expect(tokens[i].end).toEqual(7);
            expect(tokens[i].kind).toEqual(TokenKind.Number);
            expect(tokens[i].value).toEqual('22');

            i++;
            expect(tokens[i].start).toEqual(7);
            expect(tokens[i].end).toEqual(8);
            expect(tokens[i].kind).toEqual(TokenKind.RightBracket);

            i++;
            expect(tokens[i].start).toEqual(8);
            expect(tokens[i].end).toEqual(9);
            expect(tokens[i].kind).toEqual(TokenKind.Plus);

            i++;
            expect(tokens[i].start).toEqual(9);
            expect(tokens[i].end).toEqual(12);
            expect(tokens[i].kind).toEqual(TokenKind.Number);
            expect(tokens[i].value).toEqual('1.3');

            i++;
            expect(tokens[i].start).toEqual(12);
            expect(tokens[i].end).toEqual(13);
            expect(tokens[i].kind).toEqual(TokenKind.Pipe);

            i++;
            expect(tokens[i].start).toEqual(13);
            expect(tokens[i].end).toEqual(14);
            expect(tokens[i].kind).toEqual(TokenKind.Identifier);
            expect(tokens[i].value).toEqual('f');

            i++;
            expect(tokens[i].start).toEqual(14);
            expect(tokens[i].end).toEqual(15);
            expect(tokens[i].kind).toEqual(TokenKind.Colon);

            i++;
            expect(tokens[i].start).toEqual(15);
            expect(tokens[i].end).toEqual(21);
            expect(tokens[i].kind).toEqual(TokenKind.String);
            expect(tokens[i].value).toEqual("a'c");

            i++;
            expect(tokens[i].start).toEqual(21);
            expect(tokens[i].end).toEqual(22);
            expect(tokens[i].kind).toEqual(TokenKind.Colon);

            i++;
            expect(tokens[i].start).toEqual(22);
            expect(tokens[i].end).toEqual(28);
            expect(tokens[i].kind).toEqual(TokenKind.String);
            expect(tokens[i].value).toEqual('d"e');
        });

        it('should return EOF token', () => {
            scanner.initialize('', []);
            const token = scanner.scan();
            expect(token.kind).toBe(TokenKind.EOF);
        });

        describe('invalid characters', () => {
            it.each(['@', '`', '~', '#', '^', '&'])('should report invalid characters: %s', (ch) => {
                const errors: NgParseError[] = [];
                scanner.initialize(ch, [], (error) => errors.push(error));
                scanner.scan();

                expect(errors.length).toBe(1);
                expect(errors[0].message).toBe('Unexpected character: ' + ch);
                expect(errors[0].reporter).toBe(ErrorReporter.Scanner);
            });

            it('should not report invalid characters in strings', () => {
                const errors: NgParseError[] = [];
                scanner.initialize('"@`~#^&"', [], (error) => errors.push(error));
                const tokens = scanAll(scanner);
                expect(errors.length).toBe(0);
                expect(tokens.length).toBe(1);
                expect(tokens[0].kind).toBe(TokenKind.String);
                expect(tokens[0].value).toBe('@`~#^&');
            });

            it('should continue scanning after invalid characters', () => {
                const errors: NgParseError[] = [];
                scanner.initialize('123@`~||#^&"str"', [], (error) => errors.push(error));
                const tokens = scanAll(scanner);

                expect(errors.length).toBe(6);
                expect(tokens.length).toBe(3);

                expect(tokens[0].kind).toBe(TokenKind.Number);
                expect(tokens[0].start).toBe(0);
                expect(tokens[0].end).toBe(3);

                expect(tokens[1].kind).toBe(TokenKind.Or);
                expect(tokens[1].start).toBe(6);
                expect(tokens[1].end).toBe(8);

                expect(tokens[2].kind).toBe(TokenKind.String);
                expect(tokens[2].start).toBe(11);
                expect(tokens[2].end).toBe(16);
            });
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
                scanner.initialize(input, []);
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.Identifier);
                expect(token.value).toBe(output);
            });

            it.each([
                ['abc𠮷', 'abc', 3],
                ['𠮷abc', 'abc', 0],
            ])('should scan identifier with multi-byte characters: %s => %s', (input, output, errorAt) => {
                const errors: NgParseError[] = [];
                scanner.initialize(input, [], (error) => errors.push(error));
                const token = scanAll(scanner)[0];

                expect(token.kind).toBe(TokenKind.Identifier);
                expect(token.value).toBe(output);

                expect(errors.length).toBe(1);
                expect(errors[0].message).toBe('Unexpected character: 𠮷');
                expect(errors[0].start).toBe(errorAt);
                expect(errors[0].end).toBe(errorAt + 2);
            });

            it.each(['undefined', 'null', 'true', 'false', 'as', 'in'])('should recognize keywords: %s', (input) => {
                const tokens = scanAll(scanner, input, ['undefined', 'null', 'true', 'false', 'as', 'in']);
                expect(tokens[0].kind).toEqual(TokenKind.Keyword);
                expect(tokens[0].value).toEqual(input);
            });

            it.each(['undefined', 'null', 'true', 'false', 'as', 'in'])(
                'should not recognize keywords: %s',
                (input) => {
                    const tokens = scanAll(scanner, input);
                    expect(tokens[0].kind).toEqual(TokenKind.Identifier);
                    expect(tokens[0].value).toEqual(input);
                },
            );

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
                const token = scanAll(scanner, '123')[0];
                expect(token.kind).toBe(TokenKind.Number);
                expect(token.value).toBe('123');
            });

            it.each([
                ['123.456', '123.456'],
                ['.456', '.456'],
            ])('should scan decimal number: %s', (input, output) => {
                const token = scanAll(scanner, input)[0];
                expect(token.kind).toBe(TokenKind.Number);
                expect(token.value).toBe(output);
            });

            it.each([
                ['10e4', '10e4'],
                ['1.23e-4', '1.23e-4'],
                ['1.23E-4', '1.23E-4'],
                ['1.23e+4', '1.23e+4'],
                ['1.23E+4', '1.23E+4'],
            ])('should scan number with scientific notation: %s', (input, output) => {
                const token = scanAll(scanner, input)[0];
                expect(token.kind).toBe(TokenKind.Number);
                expect(token.value).toBe(output);
                expect(token.start).toBe(0);
                expect(token.end).toBe(output.length);
            });

            it.each([
                ['1.23e', 5],
                ['1.23e-', 6],
                ['1.23e+', 6],
                ['10E+', 4],
                ['10E+abc', 4],
            ])('should report digit expected: %s at %s', (input, at) => {
                const errors: NgParseError[] = [];
                scanner.initialize(input, [], (error) => errors.push(error));
                scanner.scan();

                expect(errors.length).toBe(1);
                expect(errors[0].message).toBe('Digit expected');
                expect(errors[0].start).toBe(at);
            });
        });

        describe('strings', () => {
            it('should scan quoted string', () => {
                const token1 = scanAll(scanner, '"hello"')[0];
                expect(token1.kind).toBe(TokenKind.String);
                expect(token1.value).toBe('hello');
                expect(token1.start).toBe(0);
                expect(token1.end).toBe(7);

                const token2 = scanAll(scanner, "'world'")[0];
                expect(token2.kind).toBe(TokenKind.String);
                expect(token2.value).toBe('world');
                expect(token2.start).toBe(0);
                expect(token2.end).toBe(7);
            });

            it.each([
                ['"\\""', '"'],
                ["'\\''", "'"],
                ['"\\"\\b\\n\\f\\r\\t\\v\\u00A0"', '"\b\n\f\r\t\v\u00A0'],
                ['"\\m"', 'm'],
            ])('should handle escape sequences: %s', (input, output) => {
                const token = scanAll(scanner, input)[0];
                expect(token.kind).toBe(TokenKind.String);
                expect(token.value).toBe(output);
                expect(token.start).toBe(0);
                expect(token.end).toBe(input.length);
            });

            it.each([
                ['"\\u0041"', 'A'],
                ['"\\u0041\\u0042"', 'AB'],
                ['"\uD801\uDC37\uD842\uDFB7"', '𐐷𠮷'],
            ])('should handle unicode escape sequences: %s', (input, output) => {
                const token = scanAll(scanner, input)[0];
                expect(token.kind).toBe(TokenKind.String);
                expect(token.value).toBe(output);
                expect(token.start).toBe(0);
                expect(token.end).toBe(input.length);
            });

            it('should report unterminated string', () => {
                const errors: NgParseError[] = [];
                const input = '"unclosed';
                scanner.initialize(input, [], (error) => errors.push(error));
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.String);
                expect(token.value).toBe(input.slice(1));

                expect(errors.length).toBe(1);
                expect(errors[0].message).toBe('Unterminated string');
                expect(errors[0].start).toBe(input.length);
                expect(errors[0].end).toBe(input.length);
            });

            it('should report unexpected end of text', () => {
                const errors: NgParseError[] = [];
                scanner.initialize('"invalid\\', [], (error) => errors.push(error));
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.String);
                expect(token.value).toBe('invalid');

                expect(errors.length).toBe(2);
                expect(errors[0].message).toBe('Unexpected end of text');
                expect(errors[0].start).toBe(9);
            });

            it.each([
                ['"\\u"', 3],
                ['"\\uD"', 4],
                ['"\\uDD"', 5],
                ['"\\uDDD"', 6],
                ['"\\um"', 3],
                ['"\\uDm"', 4],
                ['"\\uDDm"', 5],
                ['"\\uDDDm"', 6],
            ])('should report hexadecimal digit expected: %s at %s', (input, at) => {
                const errors: NgParseError[] = [];
                scanner.initialize(input, [], (error) => errors.push(error));
                const token = scanner.scan();

                expect(token.kind).toBe(TokenKind.String);
                expect(token.value).toBe(input.slice(1, input.length - 1));

                expect(errors.length).toBe(1);
                expect(errors[0].message).toBe('Hexadecimal digit expected');
                expect(errors[0].start).toBe(at);
            });
        });

        describe('whitespace handling', () => {
            it('should skip whitespace', () => {
                const tokens = scanAll(scanner, '   123   456   ');
                expect(tokens.map((t) => t.value)).toEqual(['123', '456']);
            });

            it('should handle all types of whitespace', () => {
                const token = scanAll(scanner, '\n\r\t\v\u00A0123')[0];
                expect(token.kind).toBe(TokenKind.Number);
                expect(token.value).toBe('123');
                expect(token.start).toBe(5);
                expect(token.end).toBe(8);
            });
        });

        describe('operators', () => {
            it('should scan single-char operators', () => {
                const tokens = scanAll(scanner, '+ - * / % > < ! = | . , ; : ? ( ) { } [ ]');

                expect(tokens.map((t) => t.kind)).toEqual([
                    TokenKind.Plus,
                    TokenKind.Minus,
                    TokenKind.Multiply,
                    TokenKind.Divide,
                    TokenKind.Modulo,
                    TokenKind.GreaterThan,
                    TokenKind.LessThan,
                    TokenKind.Not,
                    TokenKind.Assign,
                    TokenKind.Pipe,
                    TokenKind.Dot,
                    TokenKind.Comma,
                    TokenKind.Semicolon,
                    TokenKind.Colon,
                    TokenKind.Question,
                    TokenKind.LeftParen,
                    TokenKind.RightParen,
                    TokenKind.LeftBrace,
                    TokenKind.RightBrace,
                    TokenKind.LeftBracket,
                    TokenKind.RightBracket,
                ]);
            });

            it('should scan multi-char operators', () => {
                const tokens = scanAll(scanner, '=== == !== != && || >= <= ');

                expect(tokens.map((t) => t.kind)).toEqual([
                    TokenKind.StrictEqual,
                    TokenKind.Equal,
                    TokenKind.StrictNotEqual,
                    TokenKind.NotEqual,
                    TokenKind.And,
                    TokenKind.Or,
                    TokenKind.GreaterThanOrEqual,
                    TokenKind.LessThanOrEqual,
                ]);
            });
        });
    });

    describe('lookAhead()', () => {
        it('should return preview result without affecting scanner position', () => {
            scanner.initialize('123 456', []);

            // Look ahead to get first token
            const firstToken = scanner.lookAhead(() => scanner.scan());
            expect(firstToken.kind).toBe(TokenKind.Number);
            expect(firstToken.value).toBe('123');

            // Actual scan should return the same token
            const actualToken = scanner.scan();
            expect(actualToken.kind).toBe(TokenKind.Number);
            expect(actualToken.value).toBe('123');
        });

        it('should support multiple tokens look ahead', () => {
            scanner.initialize('123 456', []);

            // Look ahead multiple tokens
            const tokens = scanner.lookAhead(() => {
                const results = [];
                results.push(scanner.scan()); // 123
                results.push(scanner.scan()); // 456
                return results;
            });

            expect(tokens).toHaveLength(2);
            expect(tokens[0].value).toBe('123');
            expect(tokens[1].value).toBe('456');

            // Scanner position should not be affected
            const firstScan = scanner.scan();
            expect(firstScan.value).toBe('123');
        });

        it('should off error report in look ahead', () => {
            const errors: NgParseError[] = [];
            scanner.initialize('123 @#$ 456', [], (error) => errors.push(error));

            // Look ahead through invalid characters
            const result = scanner.lookAhead(() => {
                scanner.scan(); // 123
                scanner.scan(); // @#$
                return scanner.scan(); // 456
            });

            // error report should off
            expect(errors.length).toBe(0);

            // test lookAhead() return
            expect(result.value).toBe('456');

            // Scanner should still be at the start
            const firstScan = scanner.scan();
            expect(firstScan.value).toBe('123');
        });
    });
});

// Helper function to scan all tokens
function scanAll(scanner: Scanner, input?: string, keywords?: string[]) {
    if (input) {
        scanner.initialize(input, keywords ?? []);
    }

    const tokens = [];
    let token;
    while ((token = scanner.scan()).kind !== TokenKind.EOF) {
        tokens.push(token);
    }
    return tokens;
}
