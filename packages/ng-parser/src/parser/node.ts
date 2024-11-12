import { Token } from '../scanner/token';
import type {
    AssignToken,
    BinaryOperatorToken,
    ColonToken,
    DotToken,
    IdentifierToken,
    LeftBraceToken,
    LeftBracketToken,
    LeftParenToken,
    LiteralTokenKind,
    LiteralToken,
    Location,
    NgParseError,
    PipeToken,
    QuestionToken,
    RightBraceToken,
    RightBracketToken,
    RightParenToken,
    UnaryOperatorToken,
    INodeVisitor,
} from '../types';
import { SyntaxKind, NodeFlags, TokenKind } from '../types';

import { resolveLocation } from './utils';

export abstract class Node {
    readonly kind: SyntaxKind;
    readonly start: number;
    readonly end: number;
    flags: NodeFlags = NodeFlags.None;

    constructor(kind: SyntaxKind, ...nodes: Location[]) {
        this.kind = kind;

        const { start, end } = resolveLocation(...nodes);
        this.start = start;
        this.end = end;
    }

    is<T extends Node>(kind: SyntaxKind): this is T {
        return this.kind === kind;
    }

    checkIs<T extends Node>(flags: NodeFlags): this is T {
        return Boolean(this.flags & flags);
    }

    abstract accept<R>(visitor: INodeVisitor): R;
}

export abstract class Expression extends Node {
    flags = NodeFlags.Expression;
}
export abstract class NormalExpression extends Expression {
    flags = NodeFlags.Expression | NodeFlags.NormalExpression;
}
export abstract class LeftHandExpression extends NormalExpression {
    flags = NodeFlags.Expression | NodeFlags.NormalExpression | NodeFlags.LeftHandExpression;
}

export class Program extends Node {
    readonly source: string;
    readonly statements: ExpressionStatement[];
    readonly errors: NgParseError[];

    constructor(source: string, statements: ExpressionStatement[], errors: NgParseError[]) {
        super(SyntaxKind.Program, ...statements);
        this.source = source;
        this.statements = statements;
        this.errors = errors;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitProgram(this);
    }
}

export class ExpressionStatement extends Node {
    readonly expression: Expression;

    constructor(expression: Expression, semicolon: Token) {
        super(SyntaxKind.ExpressionStatement, expression, semicolon);
        this.expression = expression;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitExpressionStatement(this);
    }
}

export class FilterExpression extends Expression {
    readonly input: NormalExpression;
    readonly name: Identifier;
    readonly args: NormalExpression[];
    constructor(input: NormalExpression, pipeToken: PipeToken, name: Identifier, args: NormalExpression[]) {
        super(SyntaxKind.FilterExpression, pipeToken, name, ...args);
        this.input = input;
        this.name = name;
        this.args = args;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitFilterExpression(this);
    }
}

export class AssignExpression extends NormalExpression {
    readonly left: LeftHandExpression;
    readonly operator: AssignToken;
    readonly initializer: NormalExpression;

    constructor(left: LeftHandExpression, operator: AssignToken, initializer: NormalExpression) {
        super(SyntaxKind.AssignExpression, left, operator, initializer);
        this.left = left;
        this.operator = operator;
        this.initializer = initializer;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitAssignExpression(this);
    }
}

export class ConditionalExpression extends NormalExpression {
    readonly condition: NormalExpression;
    readonly whenTrue: NormalExpression;
    readonly whenFalse: NormalExpression;

    constructor(
        condition: NormalExpression,
        questionToken: QuestionToken,
        whenTrue: NormalExpression,
        colonToken: ColonToken,
        whenFalse: NormalExpression,
    ) {
        super(SyntaxKind.ConditionalExpression, condition, questionToken, whenTrue, colonToken, whenFalse);
        this.condition = condition;
        this.whenTrue = whenTrue;
        this.whenFalse = whenFalse;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitConditionalExpression(this);
    }
}

export class BinaryExpression extends NormalExpression {
    readonly left: NormalExpression;
    readonly operator: BinaryOperatorToken;
    readonly right: NormalExpression;

    constructor(left: NormalExpression, operator: BinaryOperatorToken, right: NormalExpression) {
        super(SyntaxKind.BinaryExpression, left, operator, right);
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitBinaryExpression(this);
    }
}

export class UnaryExpression extends NormalExpression {
    readonly operator: UnaryOperatorToken;
    readonly operand: NormalExpression;

    constructor(operator: UnaryOperatorToken, operand: NormalExpression) {
        super(SyntaxKind.UnaryExpression, operator, operand);
        this.operator = operator;
        this.operand = operand;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitUnaryExpression(this);
    }
}

export class CallExpression extends NormalExpression {
    readonly name: NormalExpression;
    readonly args: Expression[];
    constructor(name: NormalExpression, leftParen: LeftParenToken, args: Expression[], rightParen: RightParenToken) {
        super(SyntaxKind.CallExpression, name, leftParen, ...args, rightParen);
        this.name = name;
        this.args = args;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitCallExpression(this);
    }
}

export class ArrayLiteralExpression extends NormalExpression {
    readonly elements: NormalExpression[];
    constructor(leftBracket: LeftBracketToken, elements: NormalExpression[], rightBracket: RightBracketToken) {
        super(SyntaxKind.ArrayLiteralExpression, leftBracket, ...elements, rightBracket);
        this.elements = elements;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitArrayLiteralExpression(this);
    }
}

export class ObjectLiteralExpression extends NormalExpression {
    readonly properties: PropertyAssignment[];
    constructor(leftBrace: LeftBraceToken, properties: PropertyAssignment[], rightBrace: RightBraceToken) {
        super(SyntaxKind.ObjectLiteralExpression, leftBrace, ...properties, rightBrace);
        this.properties = properties;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitObjectLiteralExpression(this);
    }
}

export class PropertyAssignment extends Node {
    readonly property: ElementAccess | Identifier | Literal;
    readonly initializer: NormalExpression;

    constructor(property: ElementAccess | Identifier | Literal, initializer: NormalExpression) {
        if (
            property.is<Literal>(SyntaxKind.Literal) &&
            property.literalTokenKind !== TokenKind.String &&
            property.literalTokenKind !== TokenKind.Number
        ) {
            throw new Error(
                'Expect string/number literal, but got: ' + Token.createEmpty(property.literalTokenKind).toString(),
            );
        }
        super(SyntaxKind.PropertyAssignment, property, initializer);
        this.property = property;
        this.initializer = initializer;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitPropertyAssignment(this);
    }
}

export class ElementAccess extends Node {
    readonly expression: NormalExpression;
    constructor(leftBracket: LeftBracketToken, expression: NormalExpression, rightBracket: RightBracketToken) {
        super(SyntaxKind.ElementAccess, leftBracket, expression, rightBracket);
        this.expression = expression;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitElementAccess(this);
    }
}

export class PropertyAccessExpression extends LeftHandExpression {
    readonly parent: NormalExpression;
    readonly name: Identifier;

    constructor(parent: NormalExpression, dot: DotToken, name: Identifier);
    constructor(parent: NormalExpression, dot: DotToken, name: IdentifierToken);
    constructor(parent: NormalExpression, dot: DotToken, name: Identifier | IdentifierToken) {
        super(SyntaxKind.PropertyAccessExpression, parent, dot, name);
        this.parent = parent;
        this.name = name instanceof Identifier ? name : new Identifier(name);
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitPropertyAccessExpression(this);
    }
}

export class ElementAccessExpression extends LeftHandExpression {
    readonly parent: NormalExpression;
    readonly elementExpression: NormalExpression;
    constructor(parent: NormalExpression, elementAccess: ElementAccess) {
        super(SyntaxKind.ElementAccessExpression, parent, elementAccess);
        this.parent = parent;
        this.elementExpression = elementAccess.expression;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitElementAccessExpression(this);
    }
}

export class Identifier extends LeftHandExpression {
    readonly name: string;
    constructor(identifierToken: Token) {
        super(SyntaxKind.Identifier, identifierToken);
        this.name = identifierToken.value!;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitIdentifier(this);
    }
}

export class Literal extends NormalExpression {
    readonly literalTokenKind: LiteralTokenKind;
    /**
     * Only for number/string.
     */
    readonly value?: string;
    constructor(literalToken: LiteralToken) {
        super(SyntaxKind.Literal, literalToken);
        this.literalTokenKind = literalToken.kind;
        this.value = literalToken.value;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitLiteral(this);
    }
}

export class GroupExpression extends NormalExpression {
    readonly expression: NormalExpression;
    constructor(leftParen: LeftParenToken, expression: NormalExpression, rightParen: RightParenToken) {
        super(SyntaxKind.GroupExpression, leftParen, expression, rightParen);
        this.expression = expression;
    }

    accept<R>(visitor: INodeVisitor): R {
        return visitor.visitGroupExpression(this);
    }
}
