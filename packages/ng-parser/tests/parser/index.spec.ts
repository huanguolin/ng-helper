import { Parser } from '../../src/parser';
import type { Expression, Node } from '../../src/parser/node';
import type {
    ArrayLiteralExpression,
    AssignExpression,
    BinaryExpression,
    CallExpression,
    ConditionalExpression,
    ElementAccess,
    ElementAccessExpression,
    ExpressionStatement,
    FilterExpression,
    GroupExpression,
    Identifier,
    Literal,
    ObjectLiteralExpression,
    Program,
    PropertyAccessExpression,
    PropertyAssignment,
    UnaryExpression,
} from '../../src/parser/node';
import { resolveLocation } from '../../src/parser/utils';
import { Token } from '../../src/scanner/token';
import { SyntaxKind, TokenKind, type INodeVisitor, type Location } from '../../src/types';

const MISSING_IDENTIFIER = '$$';

class SExpr implements INodeVisitor<string> {
    toString(node: Expression): string {
        return node.accept(this);
    }

    visitProgram(node: Program): string {
        return node.statements.map((stmt) => stmt.accept(this)).join(';');
    }
    visitExpressionStatement(node: ExpressionStatement): string {
        return node.expression.accept(this);
    }
    visitFilterExpression(node: FilterExpression): string {
        const arr = [node.input.accept(this), ...node.args.map((arg) => arg.accept(this))];
        return `(filter ${node.name.accept(this)}| ${arr.join(' ')})`;
    }
    visitBinaryExpression(node: BinaryExpression): string {
        return `(${node.operator.toString()} ${node.left.accept(this)} ${node.right.accept(this)})`;
    }
    visitUnaryExpression(node: UnaryExpression): string {
        return `(${node.operator.toString()} ${node.operand.accept(this)})`;
    }
    visitAssignExpression(node: AssignExpression): string {
        return `(= ${node.left.accept(this)} ${node.right.accept(this)})`;
    }
    visitConditionalExpression(node: ConditionalExpression): string {
        return `(cond? ${node.condition.accept(this)} ${node.whenTrue.accept(this)} ${node.whenFalse.accept(this)})`;
    }
    visitArrayLiteralExpression(node: ArrayLiteralExpression): string {
        const arr = ['[array]', ...node.elements.map((element) => element.accept(this))];
        return `(${arr.join(' ')})`;
    }
    visitObjectLiteralExpression(node: ObjectLiteralExpression): string {
        const arr = ['{object}', ...node.properties.map((property) => property.accept(this))];
        return `(${arr.join(' ')})`;
    }
    visitPropertyAssignment(node: PropertyAssignment): string {
        return `(${node.property.accept(this)} ${node.initializer.accept(this)})`;
    }
    visitElementAccess(node: ElementAccess): string {
        return `[${node.expression.accept(this)}]`;
    }
    visitCallExpression(node: CallExpression): string {
        const arr = [node.callee.accept(this), ...node.args.map((arg) => arg.accept(this))];
        return `(${arr.join(' ')})`;
    }
    visitPropertyAccessExpression(node: PropertyAccessExpression): string {
        return `${node.parent.accept(this)}.${node.name.accept(this)}`;
    }
    visitElementAccessExpression(node: ElementAccessExpression): string {
        return `${node.parent.accept(this)}[${node.elementExpression.accept(this)}]`;
    }
    visitIdentifier(node: Identifier): string {
        return node.name || MISSING_IDENTIFIER;
    }
    visitGroupExpression(node: GroupExpression): string {
        return node.expression.accept(this);
    }
    visitLiteral(node: Literal): string {
        if (node.literalTokenKind === TokenKind.String) {
            return `"${node.value}"`;
        }
        return Token.shouldHaveValue(node.literalTokenKind)
            ? node.value ?? ''
            : Token.createEmpty(node.literalTokenKind).toString();
    }
}

class LocationValidator implements INodeVisitor<boolean> {
    private strict = true;
    validate(node: Expression, strict = true): boolean {
        this.strict = strict;
        return node.accept(this);
    }

    private compareToChildren(parent: Node, childNodes: Node[], childTokens: Token[] = []): boolean {
        if (!this.checkLocations(parent, ...childTokens, ...childNodes)) {
            return false;
        }

        const childLocations = [...(childTokens as Location[]), ...(childNodes as Location[])];
        if (childLocations.length > 0) {
            const { start, end } = resolveLocation(...childLocations);
            if (start < parent.start || end > parent.end) {
                return false;
            }
        }

        return childNodes.every((child) => child.accept(this));
    }

    private checkLocations(...nodes: Location[]): boolean {
        if (!this.strict) {
            return true;
        }
        return nodes.every((node) => node.start >= 0 && node.end >= 0 && node.end >= node.start);
    }

    visitProgram(node: Program): boolean {
        if (node.start < 0 || (node.source.length > 0 && node.end > node.source.length)) {
            return false;
        }
        return this.compareToChildren(node, node.statements);
    }
    visitExpressionStatement(node: ExpressionStatement): boolean {
        return this.compareToChildren(node, [node.expression]);
    }
    visitFilterExpression(node: FilterExpression): boolean {
        return this.compareToChildren(node, [node.input, node.name, ...node.args]);
    }
    visitBinaryExpression(node: BinaryExpression): boolean {
        return this.compareToChildren(node, [node.left, node.right], [node.operator]);
    }
    visitUnaryExpression(node: UnaryExpression): boolean {
        return this.compareToChildren(node, [node.operand], [node.operator]);
    }
    visitAssignExpression(node: AssignExpression): boolean {
        return this.compareToChildren(node, [node.left, node.right], [node.operator]);
    }
    visitConditionalExpression(node: ConditionalExpression): boolean {
        return this.compareToChildren(node, [node.condition, node.whenTrue, node.whenFalse]);
    }
    visitArrayLiteralExpression(node: ArrayLiteralExpression): boolean {
        return this.compareToChildren(node, node.elements);
    }
    visitObjectLiteralExpression(node: ObjectLiteralExpression): boolean {
        return this.compareToChildren(node, node.properties);
    }
    visitPropertyAssignment(node: PropertyAssignment): boolean {
        return this.compareToChildren(node, [node.property, node.initializer]);
    }
    visitElementAccess(node: ElementAccess): boolean {
        return this.compareToChildren(node, [node.expression]);
    }
    visitCallExpression(node: CallExpression): boolean {
        return this.compareToChildren(node, [node.callee, ...node.args]);
    }
    visitPropertyAccessExpression(node: PropertyAccessExpression): boolean {
        return this.compareToChildren(node, [node.parent, node.name]);
    }
    visitElementAccessExpression(node: ElementAccessExpression): boolean {
        return this.compareToChildren(node, [node.parent, node.elementExpression]);
    }
    visitIdentifier(node: Identifier): boolean {
        return this.compareToChildren(node, []);
    }
    visitGroupExpression(node: GroupExpression): boolean {
        return this.compareToChildren(node, [node.expression]);
    }
    visitLiteral(node: Literal): boolean {
        return this.compareToChildren(node, []);
    }
}

describe('Parser', () => {
    const parser = new Parser();
    const sExpr = new SExpr();
    const locationValidator = new LocationValidator();

    function parse(text: string) {
        return parser.parse(text);
    }

    function noErrorAndCheckLocations(program: Program) {
        expect(program.errors).toHaveLength(0);
        expect(locationValidator.validate(program)).toBe(true);
    }

    function looseValidateLocation(program: Program) {
        expect(locationValidator.validate(program, false)).toBe(true);
    }

    describe('statement', () => {
        it('should handle an empty list of tokens', () => {
            const program = parse('');
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe('');
        });

        it('single statement', () => {
            const program = parse('foo;');
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe('foo');
        });

        it('multiple statements', () => {
            const program = parse('foo; bar; foo = bar; man = shell');
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe('foo;bar;(= foo bar);(= man shell)');
        });

        it('single statement without semicolon', () => {
            const program = parse('foo');
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe('foo');
        });

        it.each([
            ['foo;;;;bar', 'foo;bar'],
            [';foo', 'foo'],
            [';;;;', ''],
        ])('should skip empty expressions', (input, expected) => {
            const program = parse(input);
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });

        it.each([
            ['foo bar', 'foo;bar', 1, [4, 7]],
            ['foo bar baz', 'foo;bar;baz', 2, [4, 7], [8, 11]],
        ])(
            'error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe('Expect ";" after expression');
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );
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
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });

        it.each([
            // $$ 代表缺失的标识符
            ['a |', '(filter $$| a)', 1, [3, 3]],
            ['a | f1 | ;', '(filter $$| (filter f1| a))', 1, [9, 10]],
        ])(
            'error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe('Expect an "Identifier" after "|"');
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );
    });

    describe('assign expression', () => {
        it.each([
            ['a = b', '(= a b)'],
            ['a = b + c', '(= a (+ b c))'],
            ['a = b = c', '(= a (= b c))'],
        ])('parse %s', (input, expected) => {
            const program = parse(input);
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });

        it.each([
            ['1 = a', '(= 1 a)', 1, [0, 1]],
            ['a + 1 = b', '(= (+ a 1) b)', 1, [0, 5]],
        ])(
            'error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe('Can not assign a value to a non left-hand-value');
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );
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
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });

        it.each([
            ['a ? b c', '(cond? a b c)', 1, [6, 7]],
            ['a ? b m ? n : o', '(cond? a b (cond? m n o))', 1, [6, 7]],
            ['a ? m ? n : o c', '(cond? a (cond? m n o) c)', 1, [14, 15]],
        ])(
            '(1) error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe('Expect ":" for conditional expression');
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );

        it('(2) error-tolerant', () => {
            const input = 'a ? b';
            const expected = '(cond? a b $$)';
            const program = parse(input);
            looseValidateLocation(program);
            expect(sExpr.toString(program)).toBe(expected);
            expect(program.errors).toHaveLength(1);
            expect(program.errors[0].message).toBe('Expect ":" for conditional expression');
            expect(program.errors[0].start).toBe(5);
            expect(program.errors[0].end).toBe(5);
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
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
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
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });

        it.each([
            ['+-!foo', '(+ (- (! foo)))'],
            ['-!+foo', '(- (! (+ foo)))'],
            ['!+-foo', '(! (+ (- foo)))'],
        ])('should handle all unary operators with the same precedence: %s', (input, expected) => {
            const program = parse(input);
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });
    });

    describe('call expression', () => {
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
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });

        it.each([['a(b', '(a b)', 1, [3, 3]]])(
            'error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe('Expect ")" end of call expression');
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );
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
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });

        it.each([`undefined`, `true`, `false`, `null`])(
            'should not confuse `%s` when used as identifiers',
            (keyword) => {
                const program = parse('foo.' + keyword);
                noErrorAndCheckLocations(program);
                expect(sExpr.toString(program)).toBe('foo.' + keyword);
            },
        );

        it.each([
            // $$ 代表缺失的标识符
            ['a.', 'a.$$', 1, [2, 2]],
            ['a.b.', 'a.b.$$', 1, [4, 4]],
            // assign expression
            ['a. = 123', '(= a.$$ 123)', 1, [3, 4]],
            ['a. = c.', '(= a.$$ c.$$)', 2, [3, 4], [7, 7]],
            // conditional expression
            ['a. > b. ? c. : d.', '(cond? (> a.$$ b.$$) c.$$ d.$$)', 4, [3, 4], [8, 9], [13, 14], [17, 17]],
            // binary expression
            ['1 + a.b.', '(+ 1 a.b.$$)', 1, [8, 8]],
            ['a.b. + 1', '(+ a.b.$$ 1)', 1, [5, 6]],
            // unary expression
            ['-!a.b.', '(- (! a.b.$$))', 1, [6, 6]],
            // filter expression
            ['a.b. | f1', '(filter f1| a.b.$$)', 1, [5, 6]],
            ['a.b. | f1: c.', '(filter f1| a.b.$$ c.$$)', 2, [5, 6], [13, 13]],
            // call expression
            ['a.b.()', '(a.b.$$)', 1, [4, 5]],
            ['a.b.(c., 3)', '(a.b.$$ c.$$ 3)', 2, [4, 5], [7, 8]],
            // element access
            ['a.b.[1]', 'a.b.$$[1]', 1, [4, 5]],
            ['a.b.[c.]', 'a.b.$$[c.$$]', 2, [4, 5], [7, 8]],
            // array literal
            ['[1, b.]', '([array] 1 b.$$)', 1, [6, 7]],
            ['[1, b., 3]', '([array] 1 b.$$ 3)', 1, [6, 7]],
            // object literal
            ['{a: b.}', '({object} (a b.$$))', 1, [6, 7]],
            ['{[a.]: b.}', '({object} ([a.$$] b.$$))', 2, [4, 5], [9, 10]],
            ['{a: b., c: d.}', '({object} (a b.$$) (c d.$$))', 2, [6, 7], [13, 14]],
        ])(
            'property access (1) error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe('Expect an identifier after "."');
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );

        it.each([
            ['.a', '$$.a', 1, [0, 1]],
            ['.a.b', '$$.a.b', 1, [0, 1]],
        ])(
            'property access (2) error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe(`Expression expected, but got: "."`);
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );

        it.each([
            ['a[b', 'a[b]', 1, [3, 3]],
            ['a[1 + 2', 'a[(+ 1 2)]', 1, [7, 7]],
        ])(
            'element access error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe(`Expect "]" end of element access`);
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );
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
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });

        it.each([
            ['(b', 'b', 1, [2, 2]],
            ['(b / (1 + 2)', '(/ b (+ 1 2))', 1, [12, 12]],
            ['(b / (1 + 2', '(/ b (+ 1 2))', 1, [11, 11]],
        ])(
            'error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe(`Expect ")" end of group expression`);
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );
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
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });

        it.each([
            ['{b', '({object} (b b))', 1, [2, 2]],
            ['{b: 1', '({object} (b 1))', 1, [5, 5]],
            ['{b:{a', '({object} (b ({object} (a a))))', 1, [5, 5]],
        ])(
            '(1) error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe(`Expect "}" end of object literal`);
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );
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
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });

        it.each([
            ['[b', '([array] b)', 1, [2, 2]],
            ['[b,[x', '([array] b ([array] x))', 1, [5, 5]],
        ])(
            'error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe(`Expect "]" end of array literal`);
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );
    });

    describe('literal', () => {
        it.each([['42'], ['"hello"'], ['true'], ['false'], ['null'], ['undefined']])('parse %s', (input) => {
            const program = parse(input);
            noErrorAndCheckLocations(program);
            expect(pickStatementExpression(program).kind).toBe(SyntaxKind.Literal);
            expect(sExpr.toString(program)).toBe(input);
        });

        it.each([
            ['"', '""', 1, [1, 1]],
            ['"123', '"123"', 1, [4, 4]],
        ])(
            'error-tolerant %s',
            (input: string, expected: string, errorCount: number, ...errorLocations: number[][]) => {
                const program = parse(input);
                looseValidateLocation(program);
                expect(sExpr.toString(program)).toBe(expected);
                expect(program.errors).toHaveLength(errorCount);
                program.errors.forEach((error, index) => {
                    expect(error.message).toBe(`Unterminated string`);
                    expect(error.start).toBe(errorLocations[index][0]);
                    expect(error.end).toBe(errorLocations[index][1]);
                });
            },
        );
    });

    describe('identifier', () => {
        it('parse identifier', () => {
            const program = parse('foo');
            noErrorAndCheckLocations(program);
            expect(pickStatementExpression(program).kind).toBe(SyntaxKind.Identifier);
            expect(sExpr.toString(program)).toBe('foo');
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
            noErrorAndCheckLocations(program);
            expect(sExpr.toString(program)).toBe(expected);
        });

        it('should give higher precedence to member calls than to unary expressions', () => {
            ['+', '-', '!'].forEach((op) => {
                ['foo()', 'foo.bar', 'foo[bar]'].forEach((memberCall) => {
                    const input = op + memberCall;
                    const expected = `(${op} ${memberCall === 'foo()' ? '(foo)' : memberCall})`;
                    const program = parse(input);
                    noErrorAndCheckLocations(program);
                    expect(sExpr.toString(program)).toBe(expected);
                });
            });
        });
    });
});

function pickStatementExpression(program: Program, index: number = 0): Expression {
    return program.statements[index].expression;
}
