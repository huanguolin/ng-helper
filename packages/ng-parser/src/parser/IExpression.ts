export enum ExpressionKind {
    Assign,
    Group,
    Binary,
    Unary,
    Identifier,
    Literal,
    Call,
}

export interface IExpression {
    kind: ExpressionKind;
    // TODO: accept, foreachChildNode
    // accept: <R>(visitor: IExpressionVisitor<R>) => R;
}
