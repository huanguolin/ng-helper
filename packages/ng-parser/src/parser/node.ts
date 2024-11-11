import type { Token } from '../scanner/token';
import type {
    AssignToken,
    BinaryOperatorToken,
    ColonToken,
    DotToken,
    LeftBracketToken,
    LeftParenToken,
    LiteralTokenKind,
    LiteralTokenToken,
    Location,
    NgParseError,
    PipeToken,
    QuestionToken,
    RightBracketToken,
    RightParenToken,
    UnaryOperatorToken,
} from '../types';
import { SyntaxKind, NodeFlags } from '../types';

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
}

export class ExpressionStatement extends Node {
    readonly expression: Expression;

    constructor(expression: Expression, semicolon: Token) {
        super(SyntaxKind.ExpressionStatement, expression, semicolon);
        this.expression = expression;
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
}

export class UnaryExpression extends NormalExpression {
    readonly operator: UnaryOperatorToken;
    readonly operand: NormalExpression;

    constructor(operator: UnaryOperatorToken, operand: NormalExpression) {
        super(SyntaxKind.UnaryExpression, operator, operand);
        this.operator = operator;
        this.operand = operand;
    }
}

export class CallExpression extends NormalExpression {
    readonly name: LeftHandExpression;
    readonly args: Expression[];
    constructor(name: LeftHandExpression, args: Expression[]) {
        super(SyntaxKind.CallExpression, name, ...args);
        this.name = name;
        this.args = args;
    }
}

export class ArrayLiteralExpression extends NormalExpression {
    readonly elements: NormalExpression[];
    constructor(elements: NormalExpression[]) {
        super(SyntaxKind.ArrayLiteralExpression, ...elements);
        this.elements = elements;
    }
}

export class ObjectLiteralExpression extends NormalExpression {
    readonly properties: PropertyAssignment[];
    constructor(properties: PropertyAssignment[]) {
        super(SyntaxKind.ObjectLiteralExpression, ...properties);
        this.properties = properties;
    }
}

export class PropertyAssignment extends Node {
    readonly property: ElementAccess | Identifier;
    readonly initializer: NormalExpression;

    constructor(property: ElementAccess | Identifier, initializer: NormalExpression) {
        super(SyntaxKind.PropertyAssignment, property, initializer);
        this.property = property;
        this.initializer = initializer;
    }
}

export class ElementAccess extends Node {
    readonly expression: NormalExpression;
    constructor(leftBracket: LeftBracketToken, expression: NormalExpression, rightBracket: RightBracketToken) {
        super(SyntaxKind.ElementAccess, leftBracket, expression, rightBracket);
        this.expression = expression;
    }
}

export class PropertyAccessExpression extends LeftHandExpression {
    readonly parent: NormalExpression;
    readonly name: Identifier;
    constructor(parent: NormalExpression, dot: DotToken, name: Identifier) {
        super(SyntaxKind.PropertyAccessExpression, parent, dot, name);
        this.parent = parent;
        this.name = name;
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
}

export class Identifier extends LeftHandExpression {
    readonly name: string;
    constructor(identifierToken: Token) {
        super(SyntaxKind.Identifier, identifierToken);
        this.name = identifierToken.value!;
    }
}

export class Literal extends NormalExpression {
    readonly literalTokenKind: LiteralTokenKind;
    /**
     * Only for number/string.
     */
    readonly value?: string;
    constructor(literalToken: LiteralTokenToken) {
        super(SyntaxKind.Literal, literalToken);
        this.literalTokenKind = literalToken.kind;
        this.value = literalToken.value;
    }
}

export class GroupExpression extends NormalExpression {
    readonly expression: NormalExpression;
    constructor(leftParen: LeftParenToken, expression: NormalExpression, rightParen: RightParenToken) {
        super(SyntaxKind.GroupExpression, leftParen, expression, rightParen);
        this.expression = expression;
    }
}
