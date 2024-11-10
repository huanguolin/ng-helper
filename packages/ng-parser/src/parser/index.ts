/* eslint-disable no-constant-condition */

import { Scanner } from '../scanner';
import type { Token } from '../scanner/token';
import {
    ErrorReporter,
    SyntaxKind,
    TokenKind,
    type AssignExpression,
    type EOFStatement,
    type Expression,
    type ExpressionStatement,
    type NgParseError,
    type Program,
    type Statement,
} from '../types';

export class Parser {
    private scanner = new Scanner();
    private errors: NgParseError[] = [];
    private currentToken!: Token;

    parse(sourceText: string): Program {
        this.errors = [];
        this.scanner.initialize(sourceText, this.handleError.bind(this));

        this.nextToken();

        const statements: Statement[] = [];
        while (true) {
            const statement = this.paseStatement();
            statements.push(statement);
            if (statement.kind === SyntaxKind.EOFStatement) {
                break;
            }
        }

        return {
            kind: SyntaxKind.Program,
            source: sourceText,
            statements,
            start: statements[0].start,
            end: statements[statements.length - 1].end,
            errors: this.errors,
        };
    }

    private handleError(error: NgParseError) {
        this.errors.push(error);
    }

    private reportError(message: string) {
        this.handleError({
            reporter: ErrorReporter.Parser,
            start: this.currentToken.start,
            end: this.currentToken.end,
            message,
        });
    }

    private nextToken(): Token {
        this.currentToken = this.scanner.scan();
        return this.currentToken;
    }

    private nextTokenAnd<T>(func: () => T): T {
        this.nextToken();
        return func();
    }

    private consume(tokenKind: TokenKind, message: string) {
        if (this.currentToken.is(tokenKind)) {
            this.nextToken();
            return;
        }
        this.reportError(message);
    }

    private paseStatement(): Statement {
        if (this.currentToken.is(TokenKind.EOF)) {
            return {
                kind: SyntaxKind.EOFStatement,
                start: this.currentToken.start,
                end: this.currentToken.end,
            } as EOFStatement;
        }
        return this.parseExpressionStatement();
    }

    private parseExpressionStatement(): ExpressionStatement {
        const expression = this.parseExpression();
        this.consume(TokenKind.Semicolon, 'Expect ";" after expression');
        return {
            kind: SyntaxKind.ExpressionStatement,
            expression,
        } as ExpressionStatement;
    }

    private parseExpression(): Expression {
        return {
            // TODO
        } as AssignExpression;
    }
}
