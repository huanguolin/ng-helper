import {
    Program,
    ExpressionStatement,
    Identifier,
    Literal,
    FilterExpression,
    AssignExpression,
    ConditionalExpression,
    BinaryExpression,
    UnaryExpression,
    CallExpression,
    ArrayLiteralExpression,
    ObjectLiteralExpression,
    PropertyAccessExpression,
    ElementAccessExpression,
    GroupExpression,
    type NormalExpression,
    PropertyAssignment,
    ElementAccess,
} from '../../src/parser/node';
import { Token } from '../../src/scanner/token';
import {
    SyntaxKind,
    NodeFlags,
    TokenKind,
    type AssignToken,
    type PipeToken,
    type QuestionToken,
    type ColonToken,
    type BinaryOperatorToken,
    type UnaryOperatorToken,
    type DotToken,
    type RightBracketToken,
    type LeftBracketToken,
    type LeftParenToken,
    type RightParenToken,
    type LeftBraceToken,
    type RightBraceToken,
} from '../../src/types';
import { visitor } from '../testUtils';

describe('Node', () => {
    // 由于 Node 是抽象类，我们使用 Identifier 来测试基础功能
    const node = new Identifier(createToken(TokenKind.Identifier, { value: 'test', end: 4 }));

    describe('is()', () => {
        it('should correctly identify node kind', () => {
            expect(node.is(SyntaxKind.Identifier)).toBe(true);
            expect(node.is(SyntaxKind.Literal)).toBe(false);
        });
    });

    describe('checkIs()', () => {
        it('should correctly check node flags', () => {
            expect(node.checkIs(NodeFlags.LeftHandExpression)).toBe(true);
            expect(node.checkIs(NodeFlags.None)).toBe(false);
        });
    });
});

describe('Expression classes', () => {
    it('should have correct flags', () => {
        const node = new Identifier(createToken(TokenKind.Identifier, { value: 'test', end: 4 }));
        expect(node.flags & NodeFlags.Expression).toBeTruthy();
        expect(node.flags & NodeFlags.NormalExpression).toBeTruthy();
        expect(node.flags & NodeFlags.LeftHandExpression).toBeTruthy();

        const literal = new Literal(createToken(TokenKind.Number, { value: '42', end: 2 }));
        expect(literal.flags & NodeFlags.Expression).toBeTruthy();
        expect(literal.flags & NodeFlags.NormalExpression).toBeTruthy();
        expect(literal.flags & NodeFlags.LeftHandExpression).toBeFalsy();
    });
});

describe('Program', () => {
    it('should correctly initialize with statements and errors', () => {
        const identifier = new Identifier(createToken(TokenKind.Identifier, { value: 'test', end: 4 }));
        const statement = new ExpressionStatement(identifier, createToken(TokenKind.Semicolon, { start: 4, end: 5 }));
        const program = new Program('test;', [], [statement]);

        expect(program.source).toBe('test;');
        expect(program.statements).toHaveLength(1);
        expect(program.errors).toHaveLength(0);
        expect(program.kind).toBe(SyntaxKind.Program);

        // test start and end
        expect(program.start).toBe(0);
        expect(program.end).toBe(5);
    });

    it('should accept visitor', () => {
        const identifier = new Identifier(createToken(TokenKind.Identifier, { value: 'test', end: 4 }));
        const statement = new ExpressionStatement(identifier, createToken(TokenKind.Semicolon, { start: 4, end: 5 }));
        const program = new Program('test', [], [statement]);
        const result = program.accept(visitor);
        expect(result).toBe(program);
    });
});

describe('ExpressionStatement', () => {
    it('should have correct kind and store expression', () => {
        const expression = new Identifier(createToken(TokenKind.Identifier, { value: 'test' }));
        const semicolon = createToken(TokenKind.Semicolon, { start: 4, end: 5 });

        const statement = new ExpressionStatement(expression, semicolon);

        expect(statement.kind).toBe(SyntaxKind.ExpressionStatement);
        expect(statement.expression).toBe(expression);
        expect(statement.start).toBe(0);
        expect(statement.end).toBe(5);
    });

    it('should working without semicolon', () => {
        const expression = new Identifier(createToken(TokenKind.Identifier, { value: 'test' }));
        const statement = new ExpressionStatement(expression);
        expect(statement.kind).toBe(SyntaxKind.ExpressionStatement);
        expect(statement.expression).toBe(expression);
    });

    it('should accept visitor', () => {
        const expression = new Identifier(createToken(TokenKind.Identifier, { value: 'test' }));
        const statement = new ExpressionStatement(expression, createToken(TokenKind.Semicolon));
        const result = statement.accept(visitor);
        expect(result).toBe(statement);
    });
});

describe('FilterExpression', () => {
    it('should have correct kind and store properties', () => {
        const input = new Literal(createToken(TokenKind.Number, { value: '42' }));
        const pipeToken = createToken<PipeToken>(TokenKind.Pipe);
        const name = new Identifier(createToken(TokenKind.Identifier, { value: 'filter' }));
        const args: NormalExpression[] = [];

        const filter = new FilterExpression(input, pipeToken, name, args);

        expect(filter.kind).toBe(SyntaxKind.FilterExpression);
        expect(filter.input).toBe(input);
        expect(filter.name).toBe(name);
        expect(filter.args).toBe(args);
    });

    it('should accept visitor', () => {
        const filter = new FilterExpression(
            new Literal(createToken(TokenKind.Number, { value: '42' })),
            createToken(TokenKind.Pipe),
            new Identifier(createToken(TokenKind.Identifier, { value: 'filter' })),
            [],
        );
        const result = filter.accept(visitor);
        expect(result).toBe(filter);
    });
});

describe('AssignExpression', () => {
    it('should have correct kind and store properties', () => {
        const left = new Identifier(createToken(TokenKind.Identifier, { value: 'x' }));
        const operator = createToken<AssignToken>(TokenKind.Assign);
        const right = new Literal(createToken(TokenKind.Number, { value: '42' }));

        const assign = new AssignExpression(left, operator, right);

        expect(assign.kind).toBe(SyntaxKind.AssignExpression);
        expect(assign.left).toBe(left);
        expect(assign.operator).toBe(operator);
        expect(assign.right).toBe(right);
    });

    it('should accept visitor', () => {
        const assign = new AssignExpression(
            new Identifier(createToken(TokenKind.Identifier, { value: 'x' })),
            createToken<AssignToken>(TokenKind.Assign),
            new Literal(createToken(TokenKind.Number, { value: '42' })),
        );
        const result = assign.accept(visitor);
        expect(result).toBe(assign);
    });
});

describe('ConditionalExpression', () => {
    it('should have correct kind and store properties', () => {
        const condition = new Literal(createToken(TokenKind.Keyword, { value: 'true' }));
        const questionToken = createToken<QuestionToken>(TokenKind.Question);
        const whenTrue = new Literal(createToken(TokenKind.Number, { value: '1' }));
        const colonToken = createToken<ColonToken>(TokenKind.Colon);
        const whenFalse = new Literal(createToken(TokenKind.Number, { value: '0' }));

        const conditional = new ConditionalExpression(condition, questionToken, whenTrue, colonToken, whenFalse);

        expect(conditional.kind).toBe(SyntaxKind.ConditionalExpression);
        expect(conditional.condition).toBe(condition);
        expect(conditional.whenTrue).toBe(whenTrue);
        expect(conditional.whenFalse).toBe(whenFalse);
    });

    it('should accept visitor', () => {
        const conditional = new ConditionalExpression(
            new Literal(createToken(TokenKind.Keyword, { value: 'true' })),
            createToken<QuestionToken>(TokenKind.Question),
            new Literal(createToken(TokenKind.Number, { value: '1' })),
            createToken<ColonToken>(TokenKind.Colon),
            new Literal(createToken(TokenKind.Number, { value: '0' })),
        );
        const result = conditional.accept(visitor);
        expect(result).toBe(conditional);
    });
});

describe('BinaryExpression', () => {
    it('should have correct kind and store properties', () => {
        const left = new Literal(createToken(TokenKind.Number, { value: '1' }));
        const operator = createToken<BinaryOperatorToken>(TokenKind.Plus);
        const right = new Literal(createToken(TokenKind.Number, { value: '2' }));

        const binary = new BinaryExpression(left, operator, right);

        expect(binary.kind).toBe(SyntaxKind.BinaryExpression);
        expect(binary.left).toBe(left);
        expect(binary.operator).toBe(operator);
        expect(binary.right).toBe(right);
    });

    it('should accept visitor', () => {
        const binary = new BinaryExpression(
            new Literal(createToken(TokenKind.Number, { value: '1' })),
            createToken<BinaryOperatorToken>(TokenKind.Plus),
            new Literal(createToken(TokenKind.Number, { value: '2' })),
        );
        const result = binary.accept(visitor);
        expect(result).toBe(binary);
    });
});

describe('UnaryExpression', () => {
    it('should have correct kind and store properties', () => {
        const operator = createToken<UnaryOperatorToken>(TokenKind.Not);
        const operand = new Literal(createToken(TokenKind.Keyword, { value: 'true' }));

        const unary = new UnaryExpression(operator, operand);

        expect(unary.kind).toBe(SyntaxKind.UnaryExpression);
        expect(unary.operator).toBe(operator);
        expect(unary.operand).toBe(operand);
    });

    it('should accept visitor', () => {
        const unary = new UnaryExpression(
            createToken<UnaryOperatorToken>(TokenKind.Not),
            new Literal(createToken(TokenKind.Keyword, { value: 'true' })),
        );
        const result = unary.accept(visitor);
        expect(result).toBe(unary);
    });
});

describe('CallExpression', () => {
    it('should have correct kind and store properties', () => {
        const name = new Identifier(createToken(TokenKind.Identifier, { value: 'fn' }));
        const leftParen = createToken<LeftParenToken>(TokenKind.LeftParen);
        const args: NormalExpression[] = [new Literal(createToken(TokenKind.Number, { value: '42' }))];
        const rightParen = createToken<RightParenToken>(TokenKind.RightParen);

        const call = new CallExpression(name, leftParen, args, rightParen);

        expect(call.kind).toBe(SyntaxKind.CallExpression);
        expect(call.callee).toBe(name);
        expect(call.args).toBe(args);
    });

    it('should accept visitor', () => {
        const call = new CallExpression(
            new Identifier(createToken(TokenKind.Identifier, { value: 'fn' })),
            createToken<LeftParenToken>(TokenKind.LeftParen),
            [new Literal(createToken(TokenKind.Number, { value: '42' }))],
            createToken<RightParenToken>(TokenKind.RightParen),
        );
        const result = call.accept(visitor);
        expect(result).toBe(call);
    });
});

describe('ArrayLiteralExpression', () => {
    it('should have correct kind and store properties', () => {
        const leftBracket = createToken<LeftBracketToken>(TokenKind.LeftBracket);
        const elements = [
            new Literal(createToken(TokenKind.Number, { value: '1' })),
            new Literal(createToken(TokenKind.Number, { value: '2' })),
        ];
        const rightBracket = createToken<RightBracketToken>(TokenKind.RightBracket);
        const array = new ArrayLiteralExpression(leftBracket, elements, rightBracket);

        expect(array.kind).toBe(SyntaxKind.ArrayLiteralExpression);
        expect(array.elements).toBe(elements);
    });

    it('should accept visitor', () => {
        const array = new ArrayLiteralExpression(
            createToken<LeftBracketToken>(TokenKind.LeftBracket),
            [
                new Literal(createToken(TokenKind.Number, { value: '1' })),
                new Literal(createToken(TokenKind.Number, { value: '2' })),
            ],
            createToken<RightBracketToken>(TokenKind.RightBracket),
        );
        const result = array.accept(visitor);
        expect(result).toBe(array);
    });
});

describe('ObjectLiteralExpression', () => {
    it('should have correct kind and store properties', () => {
        const leftBrace = createToken<LeftBraceToken>(TokenKind.LeftBrace);
        const property = new Identifier(createToken(TokenKind.Identifier, { value: 'key' }));
        const value = new Literal(createToken(TokenKind.Number, { value: '42' }));
        const assignment = new PropertyAssignment(property, value);
        const rightBrace = createToken<RightBraceToken>(TokenKind.RightBrace);

        const object = new ObjectLiteralExpression(leftBrace, [assignment], rightBrace);

        expect(object.kind).toBe(SyntaxKind.ObjectLiteralExpression);
        expect(object.properties).toHaveLength(1);
        expect(object.properties[0]).toBe(assignment);
    });

    it('should accept visitor', () => {
        const object = new ObjectLiteralExpression(
            createToken<LeftBraceToken>(TokenKind.LeftBrace),
            [
                new PropertyAssignment(
                    new Identifier(createToken(TokenKind.Identifier, { value: 'key' })),
                    new Literal(createToken(TokenKind.Number, { value: '42' })),
                ),
            ],
            createToken<RightBraceToken>(TokenKind.RightBrace),
        );
        const result = object.accept(visitor);
        expect(result).toBe(object);
    });
});

describe('PropertyAccessExpression', () => {
    it('should have correct kind and store properties', () => {
        const parent = new Identifier(createToken(TokenKind.Identifier, { value: 'obj' }));
        const dot = createToken<DotToken>(TokenKind.Dot);
        const name = new Identifier(createToken(TokenKind.Identifier, { value: 'prop' }));

        const access = new PropertyAccessExpression(parent, dot, name);

        expect(access.kind).toBe(SyntaxKind.PropertyAccessExpression);
        expect(access.parent).toBe(parent);
        expect(access.name).toBe(name);
    });

    it('should accept visitor', () => {
        const access = new PropertyAccessExpression(
            new Identifier(createToken(TokenKind.Identifier, { value: 'obj' })),
            createToken<DotToken>(TokenKind.Dot),
            new Identifier(createToken(TokenKind.Identifier, { value: 'prop' })),
        );
        const result = access.accept(visitor);
        expect(result).toBe(access);
    });
});

describe('ElementAccessExpression', () => {
    it('should have correct kind and store properties', () => {
        const parent = new Identifier(createToken(TokenKind.Identifier, { value: 'arr' }));
        const expression = new Literal(createToken(TokenKind.Number, { value: '0' }));
        const elementAccess = new ElementAccess(
            createToken<LeftBracketToken>(TokenKind.LeftBracket),
            expression,
            createToken<RightBracketToken>(TokenKind.RightBracket),
        );

        const access = new ElementAccessExpression(parent, elementAccess);

        expect(access.kind).toBe(SyntaxKind.ElementAccessExpression);
        expect(access.parent).toBe(parent);
        expect(access.elementExpression).toBe(expression);
    });

    it('should accept visitor', () => {
        const access = new ElementAccessExpression(
            new Identifier(createToken(TokenKind.Identifier, { value: 'arr' })),
            new ElementAccess(
                createToken<LeftBracketToken>(TokenKind.LeftBracket),
                new Literal(createToken(TokenKind.Number, { value: '0' })),
                createToken<RightBracketToken>(TokenKind.RightBracket),
            ),
        );
        const result = access.accept(visitor);
        expect(result).toBe(access);
    });
});

describe('GroupExpression', () => {
    it('should have correct kind and store properties', () => {
        const expression = new Literal(createToken(TokenKind.Number, { value: '42' }));
        const group = new GroupExpression(
            createToken<LeftParenToken>(TokenKind.LeftParen),
            expression,
            createToken<RightParenToken>(TokenKind.RightParen),
        );

        expect(group.kind).toBe(SyntaxKind.GroupExpression);
        expect(group.expression).toBe(expression);
    });

    it('should accept visitor', () => {
        const group = new GroupExpression(
            createToken<LeftParenToken>(TokenKind.LeftParen),
            new Literal(createToken(TokenKind.Number, { value: '42' })),
            createToken<RightParenToken>(TokenKind.RightParen),
        );
        const result = group.accept(visitor);
        expect(result).toBe(group);
    });
});

describe('PropertyAssignment', () => {
    it('should have correct kind and store properties', () => {
        const property = new Identifier(createToken(TokenKind.Identifier, { value: 'key' }));
        const value = new Literal(createToken(TokenKind.Number, { value: '42' }));

        const assignment = new PropertyAssignment(property, value);

        expect(assignment.kind).toBe(SyntaxKind.PropertyAssignment);
        expect(assignment.property).toBe(property);
        expect(assignment.initializer).toBe(value);
    });

    it('should accept string literal as property', () => {
        const property = new Literal(createToken(TokenKind.String, { value: 'key' }));
        const value = new Literal(createToken(TokenKind.Number, { value: '42' }));

        const assignment = new PropertyAssignment(property, value);
        expect(assignment.property).toBe(property);
    });

    it('should accept number literal as property', () => {
        const property = new Literal(createToken(TokenKind.Number, { value: '1' }));
        const value = new Literal(createToken(TokenKind.Number, { value: '42' }));

        const assignment = new PropertyAssignment(property, value);
        expect(assignment.property).toBe(property);
    });

    it('should accept element access as property', () => {
        const expression = new Literal(createToken(TokenKind.Number, { value: '0' }));
        const property = new ElementAccess(
            createToken<LeftBracketToken>(TokenKind.LeftBracket),
            expression,
            createToken<RightBracketToken>(TokenKind.RightBracket),
        );
        const value = new Literal(createToken(TokenKind.Number, { value: '42' }));

        const assignment = new PropertyAssignment(property, value);
        expect(assignment.property).toBe(property);
    });

    it('should throw error for invalid literal property types', () => {
        const property = new Literal(createToken(TokenKind.Keyword, { value: 'true' }));
        const value = new Literal(createToken(TokenKind.Number, { value: '42' }));

        expect(() => new PropertyAssignment(property, value)).toThrow('Expect string/number literal');
    });

    it('should accept visitor', () => {
        const assignment = new PropertyAssignment(
            new Identifier(createToken(TokenKind.Identifier, { value: 'key' })),
            new Literal(createToken(TokenKind.Number, { value: '42' })),
        );
        const result = assignment.accept(visitor);
        expect(result).toBe(assignment);
    });
});

describe('ElementAccess', () => {
    it('should have correct kind and store expression', () => {
        const expression = new Literal(createToken(TokenKind.Number, { value: '0' }));
        const leftBracket = createToken<LeftBracketToken>(TokenKind.LeftBracket);
        const rightBracket = createToken<RightBracketToken>(TokenKind.RightBracket);

        const access = new ElementAccess(leftBracket, expression, rightBracket);

        expect(access.kind).toBe(SyntaxKind.ElementAccess);
        expect(access.expression).toBe(expression);
    });

    it('should accept visitor', () => {
        const access = new ElementAccess(
            createToken<LeftBracketToken>(TokenKind.LeftBracket),
            new Literal(createToken(TokenKind.Number, { value: '0' })),
            createToken<RightBracketToken>(TokenKind.RightBracket),
        );
        const result = access.accept(visitor);
        expect(result).toBe(access);
    });
});

describe('Literal', () => {
    it.each([
        [TokenKind.Number, '42'],
        [TokenKind.String, 'hello'],
    ])('should correctly store literal value: %s, %s', (kind, value) => {
        const literal = new Literal(createToken(kind, { value, end: value.length }));
        expect(literal.kind).toBe(SyntaxKind.Literal);
        expect(literal.literalTokenKind).toBe(kind);
        expect(literal.value).toBe(value);
    });

    it('should accept visitor', () => {
        const literal = new Literal(createToken(TokenKind.Number, { value: '42' }));
        const result = literal.accept(visitor);
        expect(result).toBe(literal);
    });
});

function createToken<T extends Token>(
    kind: TokenKind,
    options: Partial<{ value: string; start: number; end: number }> = {},
): T {
    const { value, start = 0, end = 1 } = options;
    return new Token({
        kind,
        value,
        start,
        end,
    }) as T;
}
