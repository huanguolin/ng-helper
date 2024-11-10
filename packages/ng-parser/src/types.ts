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
    | TokenKind.True
    | TokenKind.False
    | TokenKind.Null
    | TokenKind.Undefined
    | TokenKind.String
    | TokenKind.Number;
export type MultiplicativeOperator = TokenKind.Multiply | TokenKind.Divide | TokenKind.Modulo;
export type AdditiveOperator = TokenKind.Plus | TokenKind.Minus;
export type UnaryOperator = TokenKind.Plus | TokenKind.Minus | TokenKind.Not;
export type RelationalOperator =
    | TokenKind.LessThan
    | TokenKind.LessThanOrEqual
    | TokenKind.GreaterThan
    | TokenKind.GreaterThanOrEqual;
export type EqualityOperator = TokenKind.Equal | TokenKind.StrictEqual | TokenKind.NotEqual | TokenKind.StrictNotEqual;
export type LogicalOperator = TokenKind.And | TokenKind.Or;
export type BinaryOperator =
    | LogicalOperator
    | EqualityOperator
    | RelationalOperator
    | AdditiveOperator
    | MultiplicativeOperator;

export interface PunctuationToken<TKind extends TokenKind> extends Token {
    readonly kind: TKind;
}

export type IdentifierToken = PunctuationToken<TokenKind.Identifier>;
export type DotToken = PunctuationToken<TokenKind.Dot>;
export type PipeToken = PunctuationToken<TokenKind.Pipe>;
export type QuestionToken = PunctuationToken<TokenKind.Question>;
export type AssignToken = PunctuationToken<TokenKind.Assign>;
export type LeftBracketToken = PunctuationToken<TokenKind.LeftBracket>;
export type RightBracketToken = PunctuationToken<TokenKind.RightBracket>;
export type LeftParenToken = PunctuationToken<TokenKind.LeftParen>;
export type RightParenToken = PunctuationToken<TokenKind.RightParen>;
export type ColonToken = PunctuationToken<TokenKind.Colon>;
export type UnaryToken = PunctuationToken<UnaryOperator>;
export type BinaryOperatorToken = PunctuationToken<BinaryOperator>;
export type LiteralTokenToken = PunctuationToken<LiteralTokenKind>;

export enum ErrorReporter {
    Scanner,
    Parser,
}

export interface NgParseError extends Location {
    readonly message: string;
    readonly reporter: ErrorReporter;
}

export type ErrorHandler = (error: NgParseError) => void;

export enum SyntaxKind {
    Program,
    ExpressionStatement,
    FilterExpression,
    AssignExpression,
    ConditionalExpression,
    BinaryExpression,
    UnaryExpression,
    ArrayLiteralExpression,
    ObjectLiteralExpression,
    PropertyAssignment,
    ElementAccess,
    PropertyAccessExpression,
    ElementAccessExpression,
    CallExpression,
    Identifier,
    Literal,
    GroupExpression,
}

export enum NodeFlags {
    None = 0,
    Expression = 1 << 0,
    NormalExpression = Expression | (1 << 1),
    LeftHandExpression = NormalExpression | (1 << 2),
}
