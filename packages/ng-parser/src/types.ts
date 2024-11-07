export interface Location {
    start: number;
    end: number;
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

export interface ScanError extends Location {
    message: string;
}

export type ScanErrorHandler = (error: ScanError) => void;
