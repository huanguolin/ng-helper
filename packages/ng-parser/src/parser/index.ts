/* eslint-disable no-constant-condition */

import { Scanner } from '../scanner';
import { Token } from '../scanner/token';
import {
    ErrorReporter,
    NodeFlags,
    TokenKind,
    type AssignToken,
    type BinaryOperatorToken,
    type ColonToken,
    type DotToken,
    type IdentifierToken,
    type LeftBracketToken,
    type LeftParenToken,
    type LiteralTokenToken,
    type NgParseError,
    type PipeToken,
    type QuestionToken,
    type RightBracketToken,
    type RightParenToken,
    type UnaryOperatorToken,
} from '../types';

import {
    Program,
    ExpressionStatement,
    Expression,
    type NormalExpression,
    FilterExpression,
    Identifier,
    AssignExpression,
    type LeftHandExpression,
    ConditionalExpression,
    BinaryExpression,
    UnaryExpression,
    CallExpression,
    PropertyAccessExpression,
    ElementAccessExpression,
    ElementAccess,
    GroupExpression,
    ArrayLiteralExpression,
    ObjectLiteralExpression,
    PropertyAssignment,
    Literal,
} from './node';

export class Parser {
    private scanner = new Scanner();
    private errors: NgParseError[] = [];
    private previousToken?: Token;
    private currentToken!: Token;

    parse(sourceText: string): Program {
        this.errors = [];
        this.scanner.initialize(sourceText, this.handleError.bind(this));

        this.nextToken();

        const statements: ExpressionStatement[] = [];
        while (!this.isEnd()) {
            statements.push(this.parseExpressionStatement());
        }

        return new Program(sourceText, statements, this.errors);
    }

    private isEnd(): boolean {
        return this.currentToken.is(TokenKind.EOF);
    }

    private handleError(error: NgParseError) {
        this.errors.push(error);
    }

    private reportError(message: string, token?: Token) {
        if (!token) {
            token = this.currentToken;
        }
        this.handleError({
            reporter: ErrorReporter.Parser,
            start: token.start,
            end: token.end,
            message,
        });
    }

    private nextToken(): Token {
        this.previousToken = this.currentToken;
        this.currentToken = this.scanner.scan();
        return this.currentToken;
    }

    private nextTokenAnd<T>(func: () => T): T {
        this.nextToken();
        return func();
    }

    private consume<T extends Token>(tokenKind: TokenKind, message: string): T {
        const token = this.currentToken;
        if (token.is<T>(tokenKind)) {
            this.nextToken();
            return token;
        } else {
            this.reportError(message);
            return Token.createEmpty(tokenKind) as T;
        }
    }

    private expect<T extends Token>(...tokenKinds: TokenKind[]): T | undefined {
        const token = this.currentToken;
        if (tokenKinds.some((kind) => token.is<T>(kind))) {
            this.nextToken();
            return token as T;
        }
    }

    private parseExpressionStatement(): ExpressionStatement {
        const expression = this.parseExpression();
        const semicolon = this.consume(TokenKind.Semicolon, 'Expect ";" after expression');
        return new ExpressionStatement(expression, semicolon);
    }

    private parseExpression(): Expression {
        return this.parseFilterChain();
    }

    private parseFilterChain(): Expression {
        let left = this.parseNormalExpression();
        let pipeToken: PipeToken | undefined;
        while ((pipeToken = this.expect<PipeToken>(TokenKind.Pipe))) {
            left = this.parseFilterExpression(left, pipeToken) as NormalExpression;
        }
        return left;
    }

    private parseFilterExpression(input: NormalExpression, pipeToken: PipeToken): Expression {
        const name = this.parseIdentifier();
        const args: NormalExpression[] = [];
        while (this.expect(TokenKind.Colon)) {
            args.push(this.parseNormalExpression());
        }
        return new FilterExpression(input, pipeToken, name, args);
    }

    private parseNormalExpression(): NormalExpression {
        return this.parseAssignExpression();
    }

    private parseAssignExpression(): NormalExpression {
        let left = this.parseConditionalExpression();
        let assignToken: AssignToken | undefined;
        while ((assignToken = this.expect<AssignToken>(TokenKind.Assign))) {
            if (!left.checkIs<LeftHandExpression>(NodeFlags.LeftHandExpression)) {
                this.reportError('Can not to assign a value to a non left-hand-value', this.previousToken);
            }
            left = new AssignExpression(left, assignToken, this.parseConditionalExpression());
        }
        return left;
    }

    private parseConditionalExpression(): NormalExpression {
        const condition = this.parseLogicalOrExpression();
        const questionToken = this.expect<QuestionToken>(TokenKind.Question);
        if (questionToken) {
            const whenTrue = this.parseAssignExpression();
            const colonToken = this.consume<ColonToken>(TokenKind.Colon, 'Expect ":" for conditional expression');
            const whenFalse = this.parseAssignExpression();
            return new ConditionalExpression(condition, questionToken, whenTrue, colonToken, whenFalse);
        }
        return condition;
    }

    private parseLogicalOrExpression(): NormalExpression {
        let left = this.parseLogicalAndExpression();
        let binaryToken: BinaryOperatorToken | undefined;
        while ((binaryToken = this.expect<BinaryOperatorToken>(TokenKind.Or))) {
            left = new BinaryExpression(left, binaryToken, this.parseLogicalAndExpression());
        }
        return left;
    }

    private parseLogicalAndExpression(): NormalExpression {
        let left = this.parseEqualityExpression();
        let binaryToken: BinaryOperatorToken | undefined;
        while ((binaryToken = this.expect<BinaryOperatorToken>(TokenKind.And))) {
            left = new BinaryExpression(left, binaryToken, this.parseEqualityExpression());
        }
        return left;
    }

    private parseEqualityExpression(): NormalExpression {
        let left = this.parseRelationalExpression();
        let binaryToken: BinaryOperatorToken | undefined;
        while (
            (binaryToken = this.expect<BinaryOperatorToken>(
                TokenKind.Equal,
                TokenKind.NotEqual,
                TokenKind.StrictEqual,
                TokenKind.StrictNotEqual,
            ))
        ) {
            left = new BinaryExpression(left, binaryToken, this.parseRelationalExpression());
        }
        return left;
    }

    private parseRelationalExpression(): NormalExpression {
        let left = this.parseAdditiveExpression();
        let binaryToken: BinaryOperatorToken | undefined;
        while (
            (binaryToken = this.expect<BinaryOperatorToken>(
                TokenKind.LessThan,
                TokenKind.LessThanOrEqual,
                TokenKind.GreaterThan,
                TokenKind.GreaterThanOrEqual,
            ))
        ) {
            left = new BinaryExpression(left, binaryToken, this.parseAdditiveExpression());
        }
        return left;
    }

    private parseAdditiveExpression(): NormalExpression {
        let left = this.parseMultiplicativeExpression();
        let binaryToken: BinaryOperatorToken | undefined;
        while ((binaryToken = this.expect<BinaryOperatorToken>(TokenKind.Plus, TokenKind.Minus))) {
            left = new BinaryExpression(left, binaryToken, this.parseMultiplicativeExpression());
        }
        return left;
    }

    private parseMultiplicativeExpression(): NormalExpression {
        let left = this.parseUnaryExpression();
        let binaryToken: BinaryOperatorToken | undefined;
        while (
            (binaryToken = this.expect<BinaryOperatorToken>(TokenKind.Multiply, TokenKind.Divide, TokenKind.Modulo))
        ) {
            left = new BinaryExpression(left, binaryToken, this.parseUnaryExpression());
        }
        return left;
    }

    private parseUnaryExpression(): NormalExpression {
        const unaryToken = this.expect<UnaryOperatorToken>(TokenKind.Not, TokenKind.Minus, TokenKind.Plus);
        if (unaryToken) {
            return new UnaryExpression(unaryToken, this.parseUnaryExpression());
        } else {
            const primary = this.parsePrimaryExpression();

            // CallExpression
            const callToken = this.expect<LeftParenToken>(TokenKind.LeftParen);
            if (callToken) {
                if (!primary.checkIs<LeftHandExpression>(NodeFlags.LeftHandExpression)) {
                    this.reportError('Expect a left-hand-value for call expression', primary);
                }
                const args = this.parseArguments();
                this.consume<RightParenToken>(TokenKind.RightParen, 'Expect ")" end of arguments');
                return new CallExpression(primary, args);
            }

            // PropertyAccessExpression
            const dotToken = this.expect<DotToken>(TokenKind.Dot);
            if (dotToken) {
                if (!primary.checkIs<LeftHandExpression>(NodeFlags.LeftHandExpression)) {
                    this.reportError('Expect a left-hand-value for property access expression', primary);
                }
                const name = this.parseIdentifier();
                return new PropertyAccessExpression(primary, dotToken, name);
            }

            // ElementAccessExpression
            const leftBracketToken = this.expect<LeftBracketToken>(TokenKind.LeftBracket);
            if (leftBracketToken) {
                if (!primary.checkIs<LeftHandExpression>(NodeFlags.LeftHandExpression)) {
                    this.reportError('Expect a left-hand-value for element access expression', primary);
                }
                return new ElementAccessExpression(primary, this.parseElementAccess(leftBracketToken));
            }

            return primary;
        }
    }

    private parsePrimaryExpression(): NormalExpression {
        let leftParenToken: LeftParenToken | undefined;
        if ((leftParenToken = this.expect<LeftParenToken>(TokenKind.LeftParen))) {
            const expression = this.parseExpression();
            const rightParenToken = this.consume<RightParenToken>(
                TokenKind.RightParen,
                'Expect ")" end of group expression',
            );
            return new GroupExpression(leftParenToken, expression, rightParenToken);
        } else if (this.expect(TokenKind.LeftBracket)) {
            return this.parseArrayLiteralExpression();
        } else if (this.expect(TokenKind.LeftBrace)) {
            return this.parseObjectLiteralExpression();
        } else if (
            this.expect(
                TokenKind.String,
                TokenKind.Number,
                TokenKind.True,
                TokenKind.False,
                TokenKind.Null,
                TokenKind.Undefined,
            )
        ) {
            return new Literal(this.previousToken as LiteralTokenToken);
        }
        return this.parseIdentifier();
    }

    private parseObjectLiteralExpression(): ObjectLiteralExpression {
        const properties = this.parseObjectProperties();
        this.consume(TokenKind.RightBrace, 'Expect "}" end of object literal');
        return new ObjectLiteralExpression(properties);
    }

    private parseArrayLiteralExpression(): ArrayLiteralExpression {
        const elements = this.parseArrayElements();
        this.consume<RightBracketToken>(TokenKind.RightBracket, 'Expect "]" end of array literal');
        return new ArrayLiteralExpression(elements);
    }

    private parseObjectProperties(): PropertyAssignment[] {
        const properties: PropertyAssignment[] = [];
        if (!this.currentToken.is(TokenKind.RightBrace)) {
            // TODO: support trailing comma
            do {
                properties.push(this.parseObjectProperty());
            } while (this.expect(TokenKind.Comma));
        }
        return properties;
    }

    private parseObjectProperty(): PropertyAssignment {
        const key = this.parseIdentifier();
        this.consume<ColonToken>(TokenKind.Colon, 'Expect ":" after property key');
        const value = this.parseAssignExpression();
        return new PropertyAssignment(key, value);
    }

    private parseArrayElements(): Expression[] {
        const elements: Expression[] = [];
        if (!this.currentToken.is(TokenKind.RightBracket)) {
            // TODO: support trailing comma
            do {
                elements.push(this.parseExpression());
            } while (this.expect(TokenKind.Comma));
        }
        return elements;
    }

    private parseElementAccess(leftBracketToken: LeftBracketToken): ElementAccess {
        const expression = this.parseAssignExpression();
        const rightBracketToken = this.consume<RightBracketToken>(
            TokenKind.RightBracket,
            'Expect "]" end of element access',
        );
        return new ElementAccess(leftBracketToken, expression, rightBracketToken);
    }

    private parseArguments(): Expression[] {
        const args: Expression[] = [];
        if (!this.currentToken.is(TokenKind.RightParen)) {
            do {
                args.push(this.parseExpression());
            } while (this.expect(TokenKind.Comma));
        }
        return args;
    }

    private parseIdentifier(): Identifier {
        const token = this.consume<IdentifierToken>(TokenKind.Identifier, 'Expect an "Identifier"');
        return new Identifier(token);
    }
}
