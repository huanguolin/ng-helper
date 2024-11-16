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
} as const;

export type ErrorMessageType = (typeof ErrorMessage)[keyof typeof ErrorMessage];
