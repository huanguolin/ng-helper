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
     * End of file
     */
    EOF,
    /**
     * Invalid token
     */
    Invalid,
}
