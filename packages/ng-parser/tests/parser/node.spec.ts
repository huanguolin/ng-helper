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
} from '../../src/types';

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
        const program = new Program('test;', [statement], []);

        expect(program.source).toBe('test;');
        expect(program.statements).toHaveLength(1);
        expect(program.errors).toHaveLength(0);
        expect(program.kind).toBe(SyntaxKind.Program);

        // test start and end
        expect(program.start).toBe(0);
        expect(program.end).toBe(5);
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
        expect(assign.initializer).toBe(right);
    });
});

describe('ConditionalExpression', () => {
    it('should have correct kind and store properties', () => {
        const condition = new Literal(createToken(TokenKind.True));
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
});

describe('UnaryExpression', () => {
    it('should have correct kind and store properties', () => {
        const operator = createToken<UnaryOperatorToken>(TokenKind.Not);
        const operand = new Literal(createToken(TokenKind.True));

        const unary = new UnaryExpression(operator, operand);

        expect(unary.kind).toBe(SyntaxKind.UnaryExpression);
        expect(unary.operator).toBe(operator);
        expect(unary.operand).toBe(operand);
    });
});

describe('CallExpression', () => {
    it('should have correct kind and store properties', () => {
        const name = new Identifier(createToken(TokenKind.Identifier, { value: 'fn' }));
        const args: NormalExpression[] = [new Literal(createToken(TokenKind.Number, { value: '42' }))];

        const call = new CallExpression(name, args);

        expect(call.kind).toBe(SyntaxKind.CallExpression);
        expect(call.name).toBe(name);
        expect(call.args).toBe(args);
    });
});

describe('ArrayLiteralExpression', () => {
    it('should have correct kind and store properties', () => {
        const elements = [
            new Literal(createToken(TokenKind.Number, { value: '1' })),
            new Literal(createToken(TokenKind.Number, { value: '2' })),
        ];

        const array = new ArrayLiteralExpression(elements);

        expect(array.kind).toBe(SyntaxKind.ArrayLiteralExpression);
        expect(array.elements).toBe(elements);
    });
});

describe('ObjectLiteralExpression', () => {
    it('should have correct kind and store properties', () => {
        const property = new Identifier(createToken(TokenKind.Identifier, { value: 'key' }));
        const value = new Literal(createToken(TokenKind.Number, { value: '42' }));
        const assignment = new PropertyAssignment(property, value);

        const object = new ObjectLiteralExpression([assignment]);

        expect(object.kind).toBe(SyntaxKind.ObjectLiteralExpression);
        expect(object.properties).toHaveLength(1);
        expect(object.properties[0]).toBe(assignment);
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
