/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Token } from './scanner/token';

export interface Location {
    readonly start: number;
    readonly end: number;
}

export enum TokenKind {
    /**
     * '+'
     */
    Plus,
    /**
     * '-'
     */
    Minus,
    /**
     * '*'
     */
    Multiply,
    /**
     * '/'
     */
    Divide,
    /**
     * '%'
     */
    Modulo,
    /**
     * '==='
     */
    StrictEqual,
    /**
     * '!=='
     */
    StrictNotEqual,
    /**
     * '=='
     */
    Equal,
    /**
     * '!='
     */
    NotEqual,
    /**
     * '<'
     */
    LessThan,
    /**
     * '<='
     */
    LessThanOrEqual,
    /**
     * '>'
     */
    GreaterThan,
    /**
     * '>='
     */
    GreaterThanOrEqual,
    /**
     * '&&'
     */
    And,
    /**
     * '||'
     */
    Or,
    /**
     * '!'
     */
    Not,
    /**
     * '='
     */
    Assign,
    /**
     * '|'
     */
    Pipe,
    /**
     * ';'
     */
    Semicolon,
    /**
     * ','
     */
    Comma,
    /**
     * '.'
     */
    Dot,
    /**
     * ':'
     */
    Colon,
    /**
     * '?'
     */
    Question,
    /**
     * '('
     */
    LeftParen,
    /**
     * ')'
     */
    RightParen,
    /**
     * '{'
     */
    LeftBrace,
    /**
     * '}'
     */
    RightBrace,
    /**
     * '['
     */
    LeftBracket,
    /**
     * ']'
     */
    RightBracket,
    /**
     * 'true'
     */
    True,
    /**
     * 'false'
     */
    False,
    /**
     * 'null'
     */
    Null,
    /**
     * 'undefined'
     */
    Undefined,
    /**
     * String
     * "xyz"
     * 'xyz'
     */
    String,
    /**
     * Number
     * 123
     * 123.456
     * .456
     * 1.23e4
     */
    Number,
    /**
     * Identifier
     * x
     * xyz
     */
    Identifier,
    /**
     * End of file
     */
    EOF,
}

export type LiteralTokenKind =
    | TokenKind.Number
    | TokenKind.String
    | TokenKind.True
    | TokenKind.False
    | TokenKind.Undefined
    | TokenKind.Null;

export type MultiplicativeOperatorOrHigher = TokenKind.Multiply | TokenKind.Divide | TokenKind.Modulo;
export type AdditiveOperator = TokenKind.Plus | TokenKind.Minus;
export type AdditiveOperatorOrHigher = MultiplicativeOperatorOrHigher | AdditiveOperator;
export type RelationalOperator =
    | TokenKind.LessThan
    | TokenKind.LessThanOrEqual
    | TokenKind.GreaterThan
    | TokenKind.GreaterThanOrEqual;
export type RelationalOperatorOrHigher = AdditiveOperatorOrHigher | RelationalOperator;
export type EqualityOperator = TokenKind.Equal | TokenKind.StrictEqual | TokenKind.NotEqual | TokenKind.StrictNotEqual;
export type EqualityOperatorOrHigher = RelationalOperatorOrHigher | EqualityOperator;
export type LogicalOperatorOrHigher = TokenKind.And | TokenKind.Or;
export type AssignmentOperatorOrHigher = LogicalOperatorOrHigher | TokenKind.Assign;
export type BinaryOperator = AssignmentOperatorOrHigher | TokenKind.Comma;

export interface PunctuationToken<TKind extends TokenKind> extends Token {
    readonly kind: TKind;
}

export type NotToken = PunctuationToken<TokenKind.Not>;
export type QuestionToken = PunctuationToken<TokenKind.Question>;
export type AssignToken = PunctuationToken<TokenKind.Assign>;
export type ColonToken = PunctuationToken<TokenKind.Colon>;
export type BinaryOperatorToken = PunctuationToken<BinaryOperator>;

export interface Error extends Location {
    readonly message: string;
}

export type ScanErrorHandler = (error: Error) => void;

export enum SyntaxKind {
    Program,
    ExpressionStatement,
    AssignExpression,
    ConditionalExpression,
    BinaryExpression,
    UnaryExpression,
    ArrayLiteralExpression,
    ObjectLiteralExpression,
    ElementAccessExpression,
    PropertyAccessExpression,
    CallExpression,
    GroupExpression,
    PropertyAssignment,
    Identifier,
    Literal,
}

export interface Node extends Location {
    readonly kind: SyntaxKind;
}

export interface Program extends Node {
    readonly kind: SyntaxKind.Program;
    readonly source: string;
    readonly statements: ExpressionStatement[];
    readonly errors: Error[];
}

export interface Expression extends Node {
    _expressionBrand: any;
}

export interface LeftHandSideExpression extends Expression {
    _leftHandSideExpressionBrand: any;
}

export interface ExpressionStatement extends Node {
    readonly kind: SyntaxKind.ExpressionStatement;
    readonly expression: Expression;
}

export interface AssignExpression extends Expression {
    readonly kind: SyntaxKind.AssignExpression;
    readonly left: LeftHandSideExpression;
    readonly operator: AssignToken;
    readonly initializer: Expression;
}

export interface ConditionalExpression extends Expression {
    readonly kind: SyntaxKind.ConditionalExpression;
    readonly condition: Expression;
    readonly questionToken: QuestionToken;
    readonly whenTrue: Expression;
    readonly colonToken: ColonToken;
    readonly whenFalse: Expression;
}

export interface BinaryExpression extends Expression {
    readonly kind: SyntaxKind.BinaryExpression;
    readonly left: Expression;
    readonly operatorToken: BinaryOperatorToken;
    readonly right: Expression;
}

export interface UnaryExpression extends Expression {
    readonly kind: SyntaxKind.UnaryExpression;
    readonly operator: NotToken;
    readonly operand: UnaryExpression;
}

export interface CallExpression extends Expression {
    readonly kind: SyntaxKind.CallExpression;
    readonly expression: LeftHandSideExpression;
    readonly arguments: Expression[];
}

export interface ArrayLiteralExpression extends Expression {
    readonly kind: SyntaxKind.ArrayLiteralExpression;
    readonly elements: Expression[];
}

export interface PropertyAssignment extends Node {
    readonly kind: SyntaxKind.PropertyAssignment;
    readonly name: Identifier;
    readonly initializer: Expression;
}

export interface ObjectLiteralExpression extends Expression {
    readonly kind: SyntaxKind.ObjectLiteralExpression;
    readonly properties: PropertyAssignment[];
}

export interface PropertyAccessExpression extends LeftHandSideExpression {
    readonly kind: SyntaxKind.PropertyAccessExpression;
    readonly parent: LeftHandSideExpression;
    readonly name: Identifier;
}

export interface ElementAccessExpression extends LeftHandSideExpression {
    readonly kind: SyntaxKind.ElementAccessExpression;
    readonly expression: LeftHandSideExpression;
    readonly argumentExpression: Expression;
}

export interface Identifier extends Node {
    readonly kind: SyntaxKind.Identifier;
    readonly name: string;
}

export interface Literal extends Node {
    readonly kind: SyntaxKind.Literal;
    readonly literalTokenKind: LiteralTokenKind;
    /**
     * Only number/string has this.
     */
    readonly value?: string;
}
