/* eslint-disable no-constant-condition */

import { Scanner } from '../scanner';
import { Token } from '../scanner/token';
import {
    ErrorReporter,
    NodeFlags,
    TokenKind,
    type AssignToken,
    type ColonToken,
    type IdentifierToken,
    type NgParseError,
    type PipeToken,
    type QuestionToken,
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

    private expect<T extends Token>(tokenKind: TokenKind): T | undefined {
        const token = this.currentToken;
        if (token.is<T>(tokenKind)) {
            this.nextToken();
            return token;
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
        let questionToken: QuestionToken | undefined;
        if ((questionToken = this.expect<QuestionToken>(TokenKind.Question))) {
            const whenTrue = this.parseAssignExpression();
            const colonToken = this.consume<ColonToken>(TokenKind.Colon, 'Expect ":" for conditional expression');
            const whenFalse = this.parseAssignExpression();
            return new ConditionalExpression(condition, questionToken, whenTrue, colonToken, whenFalse);
        }
        return condition;
    }

    private parseLogicalOrExpression(): NormalExpression {
        // TODO
        return {} as BinaryExpression;
    }

    private parseIdentifier(): Identifier {
        const token = this.consume<IdentifierToken>(TokenKind.Identifier, 'Expect an "Identifier"');
        return new Identifier(token);
    }
}
