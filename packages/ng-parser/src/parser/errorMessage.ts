export const ErrorMessage = {
    Expression_expected: `Expression expected`,
    Semicolon_expected: `';' expected`,
    Identifier_expected: `Identifier expected`,
    Colon_expected: `':' expected`,
    RightParen_expected: `')' expected`,
    RightBrace_expected: `'}' expected`,
    RightBracket_expected: `']' expected`,
    Property_assign_expected: `Property assignment expected`,
    Cannot_assign: `Can not assign a value to a non left-hand-value`,
    // only for ngRepeat
    Comma_expected: `',' expected`,
    Keyword_expected: `Keyword expected`,
    InKeyword_expected: `'in' keyword expected`,
    ByKeyword_expected: `'by' keyword expected`,
    // only for ngRepeat/ngController
    Unexpected_token: `Unexpected token`,
} as const;

export type ErrorMessageType = (typeof ErrorMessage)[keyof typeof ErrorMessage];
