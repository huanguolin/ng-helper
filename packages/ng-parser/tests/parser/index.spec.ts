import { Parser } from '../../src/parser';
import { ErrorMessage, type ErrorMessageType } from '../../src/parser/errorMessage';
import type { Expression } from '../../src/parser/node';
import type { Program } from '../../src/parser/node';
import { SyntaxKind } from '../../src/types';
import { checkErrorAndLocations, checkNoErrorAndLocations, compareAstUseSExpr, type ErrorInfo } from '../testUtils';

describe('Parser', () => {
    const parser = new Parser();

    function parse(text: string) {
        return parser.parse(text);
    }

    describe('statement', () => {
        it('should handle an empty list of tokens', () => {
            const program = parse('');
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, '');
        });

        it('single statement', () => {
            const program = parse('foo;');
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, 'foo');
        });

        it('multiple statements', () => {
            const program = parse('foo; bar; foo = bar; man = shell');
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, 'foo;bar;(= foo bar);(= man shell)');
        });

        it('single statement without semicolon', () => {
            const program = parse('foo');
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, 'foo');
        });

        it.each([
            ['foo;;;;bar', 'foo;bar'],
            [';foo', 'foo'],
            [';;;;', ''],
        ])('should skip empty expressions', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it.each([
            ['foo bar', 'foo;bar', err(';', 4, 7)],
            ['foo bar baz', 'foo;bar;baz', err(';', 4, 7), err(';', 8, 11)],
            // leading '}'
            ['}1', '1', err('Expr', 0, 1)],
            ['2}1', '2;1', err(';', 1, 2)],
            // leading ']'
            [']a', 'a', err('Expr', 0, 1)],
            ['1+2]a', '(+ 1 2);a', err(';', 3, 4)],
            // leading ')'
            [')a+b', '(+ a b)', err('Expr', 0, 1)],
            ['1)a+b', '1;(+ a b)', err(';', 1, 2)],
            // leading ','
            [',a+b', '(+ a b)', err('Expr', 0, 1)],
            // tail ','
            ['a+b,', '(+ a b)', err(';', 3, 4)],
            // leading ':'
            [':a+b', '(+ a b)', err('Expr', 0, 1)],
        ])('error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });

    describe('filter expression', () => {
        it.each([
            ['foo | bar', '(filter bar| foo)'],
            ['foo | bar:baz', '(filter bar| foo baz)'],
            // filter chain
            ['a | f1 | f2', '(filter f2| (filter f1| a))'],
            ['a | f1:p1 | f2:p2', '(filter f2| (filter f1| a p1) p2)'],
            // filter args support assign expression or higher
            ['a | f1:b = 123', '(filter f1| a (= b 123))'],
            ['a | f1:b(b.c, 2 + 5)', '(filter f1| a (b b.c (+ 2 5)))'],
            // mix
            ['a | f1:b = 123 | f2:c + 1', '(filter f2| (filter f1| a (= b 123)) (+ c 1))'],
            [
                'a | f1:b(b.c, 2 + 5) | f2:c + 1 :d = 456',
                '(filter f2| (filter f1| a (b b.c (+ 2 5))) (+ c 1) (= d 456))',
            ],
        ])('parse %s', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it.each([
            ['a |', '(filter $$| a)', err('Ident', 3, 3)],
            ['a | f1 | ;', '(filter $$| (filter f1| a))', err('Ident', 9, 10)],
        ])('error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });

    describe('assign expression', () => {
        it.each([
            ['a = b', '(= a b)'],
            ['a = b + c', '(= a (+ b c))'],
            ['a = b = c', '(= a (= b c))'],
        ])('parse %s', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it.each([
            ['1 = a', '(= 1 a)', err('NotAssign', 0, 1)],
            ['a + 1 = b', '(= (+ a 1) b)', err('NotAssign', 0, 5)],
        ])('error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });

    describe('conditional expression', () => {
        it.each([
            ['a>b?c:d', '(cond? (> a b) c d)'],
            ['foo || bar ? man = 1 : shell = 1', '(cond? (|| foo bar) (= man 1) (= shell 1))'],
            ['a > b ? c ? d : e : f ? g : h', '(cond? (> a b) (cond? c d e) (cond? f g h))'],
            // should parse it same as 'a?b:(c?(d?e:f):(g?h:i))'
            ['a?b:c?d?e:f:g?h:i', '(cond? a b (cond? c (cond? d e f) (cond? g h i)))'],
        ])('parse %s', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it.each([
            ['a ? b c', '(cond? a b c)', err(':', 6, 7)],
            ['a ? b m ? n : o', '(cond? a b (cond? m n o))', err(':', 6, 7)],
            ['a ? m ? n : o c', '(cond? a (cond? m n o) c)', err(':', 14, 15)],
            ['a?b', '(cond? a b $$)', err(':', 3, 3)],
        ])('error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });

    describe('binary expression', () => {
        it.each([
            ['a + b', '(+ a b)'],
            ['a + b + c', '(+ (+ a b) c)'],
            ['a - b', '(- a b)'],
            ['a - b - c', '(- (- a b) c)'],
            ['a * b', '(* a b)'],
            ['a * b * c', '(* (* a b) c)'],
            ['a / b', '(/ a b)'],
            ['a / b / c', '(/ (/ a b) c)'],
            ['a % b', '(% a b)'],
            ['a % b % c', '(% (% a b) c)'],
            ['a == b', '(== a b)'],
            ['a == b == c', '(== (== a b) c)'],
            ['a != b', '(!= a b)'],
            ['a != b != c', '(!= (!= a b) c)'],
            ['a === b', '(=== a b)'],
            ['a === b === c', '(=== (=== a b) c)'],
            ['a !== b', '(!== a b)'],
            ['a !== b !== c', '(!== (!== a b) c)'],
            ['a < b', '(< a b)'],
            ['a < b < c', '(< (< a b) c)'],
            ['a <= b', '(<= a b)'],
            ['a <= b <= c', '(<= (<= a b) c)'],
            ['a > b', '(> a b)'],
            ['a > b > c', '(> (> a b) c)'],
            ['a >= b', '(>= a b)'],
            ['a >= b >= c', '(>= (>= a b) c)'],
            ['a && b', '(&& a b)'],
            ['a && b && c', '(&& (&& a b) c)'],
            ['a || b', '(|| a b)'],
            ['a || b || c', '(|| (|| a b) c)'],
        ])('parse %s', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });
    });

    describe('unary expression', () => {
        it.each([
            ['!true', '(! true)'],
            ['!!false', '(! (! false))'],
            ['-42', '(- 42)'],
            ['--42', '(- (- 42))'],
            ['+42', '(+ 42)'],
            ['++42', '(+ (+ 42))'],
        ])('parse %s', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it.each([
            ['+-!foo', '(+ (- (! foo)))'],
            ['-!+foo', '(- (! (+ foo)))'],
            ['!+-foo', '(! (+ (- foo)))'],
        ])('should handle all unary operators with the same precedence: %s', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });
    });

    describe('call expression', () => {
        it(`fix bug: value = 'toString', get wrong token kind, cause infinite loop.`, () => {
            const program = parse('a.toString()');
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, '(a.toString)');
        });

        it.each([
            ['a()', '(a)'],
            ['foo(a = 1)', '(foo (= a 1))'],
            ['a(1, "hi")', '(a 1 "hi")'],
            // call chain
            ['(foo)(bar, baz)', '(foo bar baz)'],
            ['a()()', '((a))'],
            ['a(1)(2)', '((a 1) 2)'],
            // arg support filter expression
            ['a(1 | f1:b = 123)', '(a (filter f1| 1 (= b 123)))'],
            ['a(1 | f1:b = 123, 2 + 5)', '(a (filter f1| 1 (= b 123)) (+ 2 5))'],
        ])('parse %s', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it.each([
            ['a(b', '(a b)', err(')', 3, 3)],
            ['a(1+2', '(a (+ 1 2))', err(')', 5, 5)],
            ['a(1+2;b', '(a (+ 1 2));b', err(')', 5, 6)],
            // literal is not callable
            // 注意：除了 null/undefined/true/false, 其他的 js 关键字（如： for/return/break 等）可以作为标识符，也就能调用方法
            ['1(1)', '(1 1)', err('LiteralNotCallable', 0, 1)],
            ['"x"(1)', '("x" 1)', err('LiteralNotCallable', 0, 3)],
            ['null(1)', '(null 1)', err('LiteralNotCallable', 0, 4)],
            ['undefined(1)', '(undefined 1)', err('LiteralNotCallable', 0, 9)],
            ['true(1)', '(true 1)', err('LiteralNotCallable', 0, 4)],
            ['false(1)', '(false 1)', err('LiteralNotCallable', 0, 5)],
        ])('error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });

    describe('property/element access expression', () => {
        it.each([
            // property access
            ['a.b', 'a.b'],
            ['a.b.c', 'a.b.c'],
            ['a().b', '(a).b'],
            ['(foo + bar).man', '(+ foo bar).man'],
            // element access
            ['a[1]', 'a[1]'],
            ['a[1][2]', 'a[1][2]'],
            ['a[1 + 2]', 'a[(+ 1 2)]'],
            ['a[foo = bar]', 'a[(= foo bar)]'],
            ['a()[1]', '(a)[1]'],
            // mix
            ['foo.bar[baz]()', '(foo.bar[baz])'],
            ['foo[bar]().baz', '(foo[bar]).baz'],
            ['foo().bar[baz]', '(foo).bar[baz]'],
            ['a()[1].b["x" + i].c[3 + 4]', '(a)[1].b[(+ "x" i)].c[(+ 3 4)]'],
        ])('parse %s', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it.each([`undefined`, `true`, `false`, `null`])(
            'should not confuse `%s` when used as identifiers',
            (keyword) => {
                const program = parse('foo.' + keyword);
                checkNoErrorAndLocations(program);
                compareAstUseSExpr(program, 'foo.' + keyword);
            },
        );

        it.each([
            // $$ 代表缺失的标识符
            ['a.', 'a.$$', err('Ident', 2, 2)],
            ['a.b.', 'a.b.$$', err('Ident', 4, 4)],
            ['.a', '$$.a', err('Expr', 0, 1)],
            ['.a.b', '$$.a.b', err('Expr', 0, 1)],
            // assign expression
            ['a. = 123', '(= a.$$ 123)', err('Ident', 3, 4)],
            ['a. = c.', '(= a.$$ c.$$)', err('Ident', 3, 4), err('Ident', 7, 7)],
            // conditional expression
            [
                'a. > b. ? c. : d.',
                '(cond? (> a.$$ b.$$) c.$$ d.$$)',
                err('Ident', 3, 4),
                err('Ident', 8, 9),
                err('Ident', 13, 14),
                err('Ident', 17, 17),
            ],
            // binary expression
            ['1 + a.b.', '(+ 1 a.b.$$)', err('Ident', 8, 8)],
            ['a.b. + 1', '(+ a.b.$$ 1)', err('Ident', 5, 6)],
            // unary expression
            ['-!a.b.', '(- (! a.b.$$))', err('Ident', 6, 6)],
            // filter expression
            ['a.b. | f1', '(filter f1| a.b.$$)', err('Ident', 5, 6)],
            ['a.b. | f1: c.', '(filter f1| a.b.$$ c.$$)', err('Ident', 5, 6), err('Ident', 13, 13)],
            // call expression
            ['a.b.()', '(a.b.$$)', err('Ident', 4, 5)],
            ['a.b.(c., 3)', '(a.b.$$ c.$$ 3)', err('Ident', 4, 5), err('Ident', 7, 8)],
            // element access
            ['a.b.[1]', 'a.b.$$[1]', err('Ident', 4, 5)],
            ['a.b.[c.]', 'a.b.$$[c.$$]', err('Ident', 4, 5), err('Ident', 7, 8)],
            // array literal
            ['[1, b.]', '([array] 1 b.$$)', err('Ident', 6, 7)],
            ['[1, b., 3]', '([array] 1 b.$$ 3)', err('Ident', 6, 7)],
            // object literal
            ['{a: b.}', '({object} (a b.$$))', err('Ident', 6, 7)],
            ['{[a.]: b.}', '({object} ([a.$$] b.$$))', err('Ident', 4, 5), err('Ident', 9, 10)],
            ['{a: b., c: d.}', '({object} (a b.$$) (c d.$$))', err('Ident', 6, 7), err('Ident', 13, 14)],
        ])('property access error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });

        it.each([
            ['a[b', 'a[b]', err(']', 3, 3)],
            ['a[1 + 2', 'a[(+ 1 2)]', err(']', 7, 7)],
        ])('element access error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });

    describe('group expression', () => {
        it.each([
            ['(a)', 'a'],
            ['(a + b)', '(+ a b)'],
            ['(a + b) * c', '(* (+ a b) c)'],
            // group can contain filter expression
            ['a + (b | f1:c = 123)', '(+ a (filter f1| b (= c 123)))'],
        ])('parse %s', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it.each([
            ['(b', 'b', err(')', 2, 2)],
            ['(b / (1 + 2)', '(/ b (+ 1 2))', err(')', 12, 12)],
            ['(b / (1 + 2', '(/ b (+ 1 2))', err(')', 11, 11)],
        ])('error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });

    describe('object literal expression', () => {
        it.each([
            ['{}', '({object})'],
            ['{foo:bar}', '({object} (foo bar))'],
            ['{a: 1, b: 2}', '({object} (a 1) (b 2))'],
            // tail comma
            ['{a: 1, b: 2,}', '({object} (a 1) (b 2))'],
            // string key
            ['{"a": 1}', '({object} ("a" 1))'],
            // number key
            ['{1: x}', '({object} (1 x))'],
            // element access as key
            ['{[a]: 1}', '({object} ([a] 1))'],
            ['{[1 + a]: 1}', '({object} ([(+ 1 a)] 1))'],
            // property initializer can be assign expression
            ['{a: b = 123}', '({object} (a (= b 123)))'],
            // should understand ES6 object initializer
            ['{x,y,z}', '({object} (x x) (y y) (z z))'],
            // mix
            ['{foo: bar, "man": "shell", 42: 23}', '({object} (foo bar) ("man" "shell") (42 23))'],
            ['{foo: bar, "man": "shell", 42: 23,}', '({object} (foo bar) ("man" "shell") (42 23))'],
            [
                '{a: b = 123, [c / (3 + d)]: d + 1, "e": f + 2,}',
                '({object} (a (= b 123)) ([(/ c (+ 3 d))] (+ d 1)) ("e" (+ f 2)))',
            ],
        ])('parse %s', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it.each([
            // miss '}'
            ['{b', '({object} (b b))', err('}', 2, 2)],
            ['{b: 1', '({object} (b 1))', err('}', 5, 5)],
            ['{b:{a', '({object} (b ({object} (a a))))', err('}', 5, 5)],
            ['{[b]: 1', '({object} ([b] 1))', err('}', 7, 7)],
            // miss '}' with tail comma
            ['{b,', '({object} (b b))', err('}', 3, 3)],
            ['{b: 1,', '({object} (b 1))', err('}', 6, 6)],
            ['{b:{a,', '({object} (b ({object} (a a))))', err('}', 6, 6)],
            ['{[b]: 1,', '({object} ([b] 1))', err('}', 8, 8)],
            // miss ']'
            ['{[b: 1}', '({object} ([b] 1))', err(']', 3, 4)],
            ['{[b:{[a: 1}}', '({object} ([b] ({object} ([a] 1))))', err(']', 3, 4), err(']', 7, 8)],
            // miss key
            ['{:1}', '({object} ($$ 1))', err('PropAssign', 1, 2)],
            ['{:{:1}}', '({object} ($$ ({object} ($$ 1))))', err('PropAssign', 1, 2), err('PropAssign', 3, 4)],
            // miss ':'
            ['{a 1}', '({object} (a 1))', err(':', 3, 4)],
            ['{a{b 1}}', '({object} (a ({object} (b 1))))', err(':', 2, 3), err(':', 5, 6)],
        ])('error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });

    describe('array literal expression', () => {
        it.each([
            ['[]', '([array])'],
            ['[foo]', '([array] foo)'],
            ['[1, 2, foo]', '([array] 1 2 foo)'],
            // tail comma
            ['[1, 2, foo,]', '([array] 1 2 foo)'],
            // element initializer can be assign expression
            ['[a = 123, b = 456]', '([array] (= a 123) (= b 456))'],
        ])('parse %s', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it.each([
            ['[b', '([array] b)', err(']', 2, 2)],
            ['[b,[x', '([array] b ([array] x))', err(']', 5, 5)],
            // tail comma
            ['[b,', '([array] b)', err(']', 3, 3)],
            ['[b,[x,', '([array] b ([array] x))', err(']', 6, 6)],
        ])('error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });

    describe('literal', () => {
        it.each([['42'], ['"hello"'], ['true'], ['false'], ['null'], ['undefined']])('parse %s', (input) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            expect(pickStatementExpression(program).kind).toBe(SyntaxKind.Literal);
            compareAstUseSExpr(program, input);
        });

        it.each([
            ['"', '""', err('UnterminatedStr', 1, 1)],
            ['"123', '"123"', err('UnterminatedStr', 4, 4)],
        ])('error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });

    describe('identifier', () => {
        it('parse identifier', () => {
            const program = parse('foo');
            checkNoErrorAndLocations(program);
            expect(pickStatementExpression(program).kind).toBe(SyntaxKind.Identifier);
            compareAstUseSExpr(program, 'foo');
        });
    });

    describe('operator precedence', () => {
        it.each([
            // 一元操作符优先级高于二元操作符
            ['!a && b', '(&& (! a) b)'],
            ['-a + b', '(+ (- a) b)'],
            ['+a * b', '(* (+ a) b)'],

            // 乘除模优先级高于加减
            ['a + b * c', '(+ a (* b c))'],
            ['a * b + c', '(+ (* a b) c)'],
            ['a - b / c', '(- a (/ b c))'],
            ['a - b % c', '(- a (% b c))'],

            // 加减优先级高于比较运算符
            ['a + b > c', '(> (+ a b) c)'],
            ['a < b + c', '(< a (+ b c))'],

            // 比较运算符优先级高于相等运算符
            ['a < b == c', '(== (< a b) c)'],
            ['a === b > c', '(=== a (> b c))'],

            // 相等运算符优先级高于逻辑与
            ['a && b == c', '(&& a (== b c))'],
            ['a && b !== c', '(&& a (!== b c))'],

            // 逻辑与优先级高于逻辑或
            ['a || b && c', '(|| a (&& b c))'],

            // 逻辑或优先级高于条件运算符
            ['a || b ? c : d', '(cond? (|| a b) c d)'],

            // 条件运算符优先级高于赋值运算符
            ['a = b ? c : d', '(= a (cond? b c d))'],

            // 赋值运算符优先级高于filter
            ['foo=bar | man', '(filter man| (= foo bar))'],

            // mix
            ['a = b || c && d > e + f * g', '(= a (|| b (&& c (> d (+ e (* f g))))))'],
            ['!a && b || c ? d + e * f : g', '(cond? (|| (&& (! a) b) c) (+ d (* e f)) g)'],
        ])('should parse %s with correct precedence', (input, expected) => {
            const program = parse(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it('should give higher precedence to member calls than to unary expressions', () => {
            ['+', '-', '!'].forEach((op) => {
                ['foo()', 'foo.bar', 'foo[bar]'].forEach((memberCall) => {
                    const input = op + memberCall;
                    const expected = `(${op} ${memberCall === 'foo()' ? '(foo)' : memberCall})`;
                    const program = parse(input);
                    checkNoErrorAndLocations(program);
                    compareAstUseSExpr(program, expected);
                });
            });
        });
    });

    describe('error tolerant', () => {
        it.each([
            // miss operand
            ['>= a + b', '(>= $$ (+ a b))', err('Expr', 0, 2)],
            ['>= && a + b', '(&& (>= $$ $$) (+ a b))', err('Expr', 0, 2), err('Expr', 3, 5)],
            ['a + b *', '(+ a (* b $$))', err('Expr', 7, 7)],
            ['a + b * !', '(+ a (* b (! $$)))', err('Expr', 9, 9)],
            ['a * %', '(% (* a $$) $$)', err('Expr', 4, 5), err('Expr', 5, 5)],
            // TODO: miss operator with group
            // ['(a b)', '(+ a b)', err('Op', 5, 5)],
            // unknown char '@'
            ['@1 + 3', '(+ 1 3)', err('@', 0, 1)],
            // mess
            ['| +', '(filter $$| $$);(+ $$)', err('Expr', 0, 1), err('Ident', 2, 3), err('Expr', 3, 3)],
            ['= ([', '(= $$ ([array]))', err('Expr', 0, 1), err(']', 4, 4)],
            ['= a([', '(= $$ (a ([array])))', err('Expr', 0, 1), err(']', 5, 5)],
        ])('error-tolerant %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parse(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });

    describe('parseNgRepeat()', () => {
        describe('empty', () => {
            it('should parse empty input', () => {
                const program = parser.parseNgRepeat('');
                checkNoErrorAndLocations(program);
                compareAstUseSExpr(program, '');
            });
        });

        describe('array', () => {
            it.each([
                ['item in items', '(ngRepeat (itemValue item) (items items))'],
                ['item in ctrl.items', '(ngRepeat (itemValue item) (items ctrl.items))'],
                ['item in items track by item.id', '(ngRepeat (itemValue item) (items items) (trackBy item.id))'],
                ['item in items | f1', '(ngRepeat (itemValue item) (items (filter f1| items)))'],
                ['item in items | f1 as result', '(ngRepeat (itemValue item) (items (filter f1| items)) (as result))'],
                [
                    'item in items | f1: x as result track by $index',
                    '(ngRepeat (itemValue item) (items (filter f1| items x)) (as result) (trackBy $index))',
                ],
            ])('parse: %s', (input, expected) => {
                const program = parser.parseNgRepeat(input);
                expect(program.config?.mode).toBe('array');
                checkNoErrorAndLocations(program);
                compareAstUseSExpr(program, expected);
            });
        });

        describe('object', () => {
            it.each([
                ['(key, value) in items', '(ngRepeat (itemKey key) (itemValue value) (items items))'],
                ['(key, value) in ctrl.items', '(ngRepeat (itemKey key) (itemValue value) (items ctrl.items))'],
                [
                    '(key, value) in items track by key',
                    '(ngRepeat (itemKey key) (itemValue value) (items items) (trackBy key))',
                ],
                ['(key, value) in items | f1', '(ngRepeat (itemKey key) (itemValue value) (items (filter f1| items)))'],
                [
                    '(key, value) in items | f1 as result',
                    '(ngRepeat (itemKey key) (itemValue value) (items (filter f1| items)) (as result))',
                ],
                [
                    '(key, value) in items | f1: x as result track by $index',
                    '(ngRepeat (itemKey key) (itemValue value) (items (filter f1| items x)) (as result) (trackBy $index))',
                ],
            ])('parse: %s', (input, expected) => {
                const program = parser.parseNgRepeat(input);
                expect(program.config?.mode).toBe('object');
                checkNoErrorAndLocations(program);
                compareAstUseSExpr(program, expected);
            });
        });

        describe('error-tolerant', () => {
            it.each([
                ['item in items by', '(ngRepeat (itemValue item) (items items))', err('Unexpected', 14, 16)],
                ['item in items xx', '(ngRepeat (itemValue item) (items items))', err('Unexpected', 14, 16)],
            ])('common: %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
                const program = parser.parseNgRepeat(input);
                compareAstUseSExpr(program, expected);
                checkErrorAndLocations(program, ...errors);
            });

            // array
            it.each([
                ['in items', '(ngRepeat (itemValue $$) (items items))', err('Ident', 0, 2)],
                ['item in', '(ngRepeat (itemValue item) (items $$))', err('Expr', 7, 7)],
                ['item in ctrl.', '(ngRepeat (itemValue item) (items ctrl.$$))', err('Ident', 13, 13)],
                [
                    'item ctrl.',
                    '(ngRepeat (itemValue item) (items ctrl.$$))',
                    err('Keyword', 5, 9),
                    err('Ident', 10, 10),
                ],
                [
                    'item in ctrl. track by item.id',
                    '(ngRepeat (itemValue item) (items ctrl.$$) (trackBy item.id))',
                    err('Ident', 13, 13), // 这个 error location 和别的地方不一样, 因为里面有 scan range 的设置
                ],
                [
                    'item in ctrl. track by item.',
                    '(ngRepeat (itemValue item) (items ctrl.$$) (trackBy item.$$))',
                    err('Ident', 13, 13), // 同上
                    err('Ident', 28, 28), // 同上
                ],
                [
                    'item in ctrl.items track by',
                    '(ngRepeat (itemValue item) (items ctrl.items) (trackBy $$))',
                    err('Expr', 27, 27),
                ],
                ['item in ctrl.items track', '(ngRepeat (itemValue item) (items ctrl.items))', err('Keyword', 24, 24)],
                [
                    'item in ctrl. | f1 : ctrl. track by item.id',
                    '(ngRepeat (itemValue item) (items (filter f1| ctrl.$$ ctrl.$$)) (trackBy item.id))',
                    err('Ident', 14, 15),
                    err('Ident', 26, 26), // 同上
                ],
                [
                    'item in ctrl. | f1 : ctrl. as track by item.id',
                    '(ngRepeat (itemValue item) (items (filter f1| ctrl.$$ ctrl.$$)) (as $$) (trackBy item.id))',
                    err('Ident', 14, 15),
                    err('Ident', 26, 26), // 同上
                    err('Ident', 30, 35), // 同上
                ],
            ])('array: %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
                const program = parser.parseNgRepeat(input);
                expect(program.config?.mode).toBe('array');
                compareAstUseSExpr(program, expected);
                checkErrorAndLocations(program, ...errors);
            });

            // object
            it.each([
                ['() in items', '(ngRepeat (itemKey $$) (itemValue $$) (items items))', err('Ident', 1, 2)],
                ['(key) in items', '(ngRepeat (itemKey key) (itemValue $$) (items items))', err(',', 4, 5)],
                ['(,value) in items', '(ngRepeat (itemKey $$) (itemValue value) (items items))', err('Ident', 1, 2)],
                ['(key, value) in', '(ngRepeat (itemKey key) (itemValue value) (items $$))', err('Expr', 15, 15)],
                [
                    '(key, value) in ctrl.',
                    '(ngRepeat (itemKey key) (itemValue value) (items ctrl.$$))',
                    err('Ident', 21, 21),
                ],
                [
                    '(key, value) in ctrl. track by key',
                    '(ngRepeat (itemKey key) (itemValue value) (items ctrl.$$) (trackBy key))',
                    err('Ident', 21, 21), // 这个 error location 和别的地方不一样, 因为里面有 scan range 的设置
                ],
                [
                    '(key, value) in ctrl. track by value.',
                    '(ngRepeat (itemKey key) (itemValue value) (items ctrl.$$) (trackBy value.$$))',
                    err('Ident', 21, 21), // 同上
                    err('Ident', 37, 37),
                ],
                [
                    '(k,v) in ctrl.items track by',
                    '(ngRepeat (itemKey k) (itemValue v) (items ctrl.items) (trackBy $$))',
                    err('Expr', 28, 28),
                ],
                [
                    '(k,v) in ctrl.items track',
                    '(ngRepeat (itemKey k) (itemValue v) (items ctrl.items))',
                    err('Keyword', 25, 25),
                ],
                [
                    '( in ctrl.items track',
                    '(ngRepeat (itemKey $$) (itemValue $$) (items ctrl.items))',
                    err('Ident', 2, 4),
                    err('Keyword', 21, 21),
                ],
                [
                    '(key, value) in ctrl. | f1 : ctrl. track by value.id',
                    '(ngRepeat (itemKey key) (itemValue value) (items (filter f1| ctrl.$$ ctrl.$$)) (trackBy value.id))',
                    err('Ident', 22, 23),
                    err('Ident', 34, 34), // 同上
                ],
                [
                    '(key, value) in ctrl. | f1 : ctrl. as track by value.id',
                    '(ngRepeat (itemKey key) (itemValue value) (items (filter f1| ctrl.$$ ctrl.$$)) (as $$) (trackBy value.id))',
                    err('Ident', 22, 23),
                    err('Ident', 34, 34), // 同上
                    err('Ident', 38, 43),
                ],
            ])('object: %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
                const program = parser.parseNgRepeat(input);
                expect(program.config?.mode).toBe('object');
                compareAstUseSExpr(program, expected);
                checkErrorAndLocations(program, ...errors);
            });
        });
    });

    describe('parseNgController()', () => {
        it.each([
            ['XController', '(ngController XController)'],
            ['XController as alias', '(ngController XController (as alias))'],
        ])('parse: %s', (input, expected) => {
            const program = parser.parseNgController(input);
            checkNoErrorAndLocations(program);
            compareAstUseSExpr(program, expected);
        });

        it.each([
            ['XController as', '(ngController XController (as $$))', err('Ident', 14, 14)],
            ['as alias', '(ngController $$ (as alias))', err('Ident', 0, 2)],
            ['as', '(ngController $$ (as $$))', err('Ident', 0, 2), err('Ident', 2, 2)],
            ['XController ctrl', '(ngController XController)', err('Unexpected', 12, 16)],
        ])('error-tolerant: %s', (input: string, expected: string, ...errors: ErrorInfo[]) => {
            const program = parser.parseNgController(input);
            compareAstUseSExpr(program, expected);
            checkErrorAndLocations(program, ...errors);
        });
    });
});

/**
 * create error
 */
function err(
    key:
        | ':'
        | ','
        | ';'
        | '}'
        | ']'
        | ')'
        | 'Expr'
        | 'Ident'
        | 'PropAssign'
        | 'NotAssign'
        | 'UnterminatedStr'
        | '@'
        | 'Keyword'
        | 'InKeyword'
        | 'ByKeyword'
        | 'Unexpected'
        | 'LiteralNotCallable',
    start: number,
    end: number,
): ErrorInfo {
    let msg;
    switch (key) {
        case ')':
            msg = ErrorMessage.RightParen_expected;
            break;
        case '}':
            msg = ErrorMessage.RightBrace_expected;
            break;
        case ']':
            msg = ErrorMessage.RightBracket_expected;
            break;
        case ':':
            msg = ErrorMessage.Colon_expected;
            break;
        case ';':
            msg = ErrorMessage.Semicolon_expected;
            break;
        case ',':
            msg = ErrorMessage.Comma_expected;
            break;
        case 'Expr':
            msg = ErrorMessage.Expression_expected;
            break;
        case 'Ident':
            msg = ErrorMessage.Identifier_expected;
            break;
        case 'PropAssign':
            msg = ErrorMessage.Property_assign_expected;
            break;
        case 'NotAssign':
            msg = ErrorMessage.Cannot_assign;
            break;
        case 'LiteralNotCallable':
            msg = ErrorMessage.Literal_not_callable;
            break;
        case 'UnterminatedStr':
            msg = 'Unterminated string' as ErrorMessageType;
            break;
        case '@':
            msg = 'Unexpected character: @' as ErrorMessageType;
            break;
        case 'ByKeyword':
            msg = ErrorMessage.ByKeyword_expected;
            break;
        case 'InKeyword':
            msg = ErrorMessage.InKeyword_expected;
            break;
        case 'Keyword':
            msg = ErrorMessage.Keyword_expected;
            break;
        case 'Unexpected':
            msg = ErrorMessage.Unexpected_token;
            break;
    }
    return [msg, start, end];
}

function pickStatementExpression(program: Program, index: number = 0): Expression {
    return program.statements[index].expression;
}
