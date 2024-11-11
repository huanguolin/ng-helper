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
    type LeftBraceToken,
    type LeftBracketToken,
    type LeftParenToken,
    type LiteralToken,
    type NgParseError,
    type PipeToken,
    type QuestionToken,
    type RightBraceToken,
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
        return this.token().is(TokenKind.EOF);
    }

    private handleError(error: NgParseError) {
        this.errors.push(error);
    }

    private reportError(message: string, token?: Token) {
        if (!token) {
            token = this.token();
        }
        this.handleError({
            reporter: ErrorReporter.Parser,
            start: token.start,
            end: token.end,
            message,
        });
    }

    // 使用 token() 能避免直接使用 currentToken 导致的类型流分析不正确。
    // 比如，前一步判断了 currentToken 不是 A 类型，接着调用了 nextToken() 后，
    // currentToken 又有可能是 A 类型了，但是直接使用 currentToken，IDE 可能提示错误。
    private token<T extends Token = Token>(): T {
        return this.currentToken as T;
    }

    private nextToken(): Token {
        this.previousToken = this.token();
        this.currentToken = this.scanner.scan();
        return this.token();
    }

    private consume<T extends Token>(tokenKind: TokenKind, message: string): T {
        const token = this.token();
        if (token.is<T>(tokenKind)) {
            this.nextToken();
            return token;
        } else {
            this.reportError(message);
            return Token.createEmpty(tokenKind);
        }
    }

    private expect<T extends Token>(...tokenKinds: TokenKind[]): T | undefined {
        const token = this.token();
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
        const token = this.consume<IdentifierToken>(TokenKind.Identifier, 'Expect an "Identifier" after "|"');
        const name = new Identifier(token);
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
                this.reportError('Can not assign a value to a non left-hand-value', this.previousToken);
            }
            left = new AssignExpression(left, assignToken, this.parseConditionalExpression());
        }
        return left;
    }

    private parseConditionalExpression(): NormalExpression {
        const condition = this.parseLogicalOrExpression();
        const questionToken = this.expect<QuestionToken>(TokenKind.Question);
        if (questionToken) {
            const whenTrue = this.parseNormalExpression();
            const colonToken = this.consume<ColonToken>(TokenKind.Colon, 'Expect ":" for conditional expression');
            const whenFalse = this.parseNormalExpression();
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
        }
        return this.parseChain();
    }

    private parseChain(): NormalExpression {
        let primary = this.parsePrimaryExpression();

        let token: Token | undefined;
        while ((token = this.expect(TokenKind.LeftParen, TokenKind.Dot, TokenKind.LeftBracket))) {
            if (token.is<LeftParenToken>(TokenKind.LeftParen)) {
                const args = this.parseArguments();
                const rightParen = this.consume<RightParenToken>(TokenKind.RightParen, 'Expect ")" end of arguments');
                primary = new CallExpression(primary, token, args, rightParen);
            } else if (token.is<DotToken>(TokenKind.Dot)) {
                const name = this.consume<IdentifierToken>(TokenKind.Identifier, 'Expect an identifier after "."');
                primary = new PropertyAccessExpression(primary, token, name);
            } else if (token.is<LeftBracketToken>(TokenKind.LeftBracket)) {
                primary = new ElementAccessExpression(primary, this.parseElementAccess(token));
            } else {
                throw new Error('Impossible here!');
            }
        }
        return primary;
    }

    private parsePrimaryExpression(): NormalExpression {
        if (this.expect(TokenKind.LeftParen)) {
            return this.parseGroupExpression();
        } else if (this.expect(TokenKind.LeftBracket)) {
            return this.parseArrayLiteralExpression();
        } else if (this.expect(TokenKind.LeftBrace)) {
            return this.parseObjectLiteralExpression();
        } else if (this.expect(TokenKind.Identifier)) {
            return new Identifier(this.previousToken as IdentifierToken);
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
            return new Literal(this.previousToken as LiteralToken);
        } else {
            this.reportError('Unexpected token: ' + this.token().toString());
            this.nextToken();
            return this.parsePrimaryExpression();
        }
    }

    private parseGroupExpression() {
        const leftParen = this.previousToken as LeftParenToken;
        const expression = this.parseExpression();
        const rightParen = this.consume<RightParenToken>(TokenKind.RightParen, 'Expect ")" end of group expression');
        return new GroupExpression(leftParen, expression, rightParen);
    }

    private parseObjectLiteralExpression(): ObjectLiteralExpression {
        const leftBrace = this.previousToken as LeftBraceToken;
        const properties = this.parseObjectProperties();
        const rightBrace = this.consume<RightBraceToken>(TokenKind.RightBrace, 'Expect "}" end of object literal');
        return new ObjectLiteralExpression(leftBrace, properties, rightBrace);
    }

    private parseArrayLiteralExpression(): ArrayLiteralExpression {
        const leftBracket = this.previousToken as LeftBracketToken;
        const elements = this.parseArrayElements();
        const rightBracket = this.consume<RightBracketToken>(TokenKind.RightBracket, 'Expect "]" end of array literal');
        return new ArrayLiteralExpression(leftBracket, elements, rightBracket);
    }

    private parseObjectProperties(): PropertyAssignment[] {
        const properties: PropertyAssignment[] = [];
        if (!this.token().is(TokenKind.RightBrace)) {
            do {
                if (this.token().is(TokenKind.RightBrace)) {
                    // Support trailing commas per ES5.1.
                    break;
                }
                properties.push(this.parseObjectProperty());
            } while (this.expect(TokenKind.Comma));
        }
        return properties;
    }

    private parseObjectProperty(): PropertyAssignment {
        const token = this.token();
        let key: ElementAccess | Identifier | Literal;
        if (token.is<LiteralToken>(TokenKind.String, TokenKind.Number)) {
            key = new Literal(token);
        } else if (token.is<IdentifierToken>(TokenKind.Identifier)) {
            key = new Identifier(token);
        } else if (token.is<LeftBracketToken>(TokenKind.LeftBracket)) {
            key = this.parseElementAccess(token);
        } else {
            this.reportError('Expected an object property key, but got: ' + this.token().toString());
            key = new Identifier(Token.createEmpty<IdentifierToken>(TokenKind.Identifier));
            this.nextToken();
        }
        this.consume<ColonToken>(TokenKind.Colon, 'Expect ":" after property key');
        const value = this.parseNormalExpression();
        return new PropertyAssignment(key, value);
    }

    private parseArrayElements(): Expression[] {
        const elements: Expression[] = [];
        if (!this.token().is(TokenKind.RightBracket)) {
            do {
                if (this.token().is(TokenKind.RightBrace)) {
                    // Support trailing commas per ES5.1.
                    break;
                }
                elements.push(this.parseNormalExpression());
            } while (this.expect(TokenKind.Comma));
        }
        return elements;
    }

    private parseElementAccess(leftBracketToken: LeftBracketToken): ElementAccess {
        const expression = this.parseNormalExpression();
        const rightBracketToken = this.consume<RightBracketToken>(
            TokenKind.RightBracket,
            'Expect "]" end of element access',
        );
        return new ElementAccess(leftBracketToken, expression, rightBracketToken);
    }

    private parseArguments(): Expression[] {
        const args: Expression[] = [];
        if (!this.token().is(TokenKind.RightParen)) {
            do {
                args.push(this.parseExpression());
            } while (this.expect(TokenKind.Comma));
        }
        return args;
    }
}
