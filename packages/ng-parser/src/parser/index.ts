/* eslint-disable no-constant-condition */

import { Debug } from '../debug';
import { Scanner } from '../scanner';
import { Token } from '../scanner/token';
import {
    ErrorReporter,
    NodeFlags,
    SyntaxKind,
    TokenKind,
    type AssignToken,
    type BinaryOperatorToken,
    type ColonToken,
    type DotToken,
    type IdentifierToken,
    type KeywordToken,
    type LeftBraceToken,
    type LeftBracketToken,
    type LeftParenToken,
    type LiteralToken,
    type Location,
    type Mutable,
    type NgParseError,
    type PipeToken,
    type QuestionToken,
    type RightBraceToken,
    type RightBracketToken,
    type RightParenToken,
    type SemicolonToken,
    type UnaryOperatorToken,
} from '../types';

import { ErrorMessage, type ErrorMessageType } from './errorMessage';
import { NgControllerProgram } from './ngControllerNode';
import { NgRepeatProgram } from './ngRepeatNode';
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

const EXPR_KEYWORDS = ['true', 'false', 'null', 'undefined'];
const NG_REPEAT_KEYWORDS = [...EXPR_KEYWORDS, 'in', 'as', 'track', 'by'];
const NG_CONTROLLER_KEYWORDS = ['as'];

export class Parser {
    private scanner = new Scanner();
    private errors: NgParseError[] = [];
    private sourceText: string = '';
    private previousToken?: Token;
    private currentToken!: Token;

    private initializeParser(sourceText: string, keywords: string[]) {
        this.errors = [];
        this.sourceText = sourceText;
        this.scanner.initialize(sourceText, keywords, this.reportError.bind(this));
        this.nextToken();
    }

    // #region parse ng-controller
    parseNgController(sourceText: string): NgControllerProgram {
        this.initializeParser(sourceText, NG_CONTROLLER_KEYWORDS);

        if (this.isEnd()) {
            return new NgControllerProgram(sourceText, this.errors);
        }

        const config = this.parseNgControllerConfig();

        if (!this.isEnd()) {
            this.reportErrorAtCurrentToken(ErrorMessage.Unexpected_token);
        }

        return new NgControllerProgram(sourceText, this.errors, config);
    }

    private parseNgControllerConfig() {
        const controllerName = this.consume<IdentifierToken>(TokenKind.Identifier, ErrorMessage.Identifier_expected);
        const as = this.parseAsClause();
        return { controllerName, as };
    }

    private parseAsClause(): IdentifierToken | undefined {
        const asKeyword = this.expect<KeywordToken>(TokenKind.Keyword);
        if (asKeyword && asKeyword.value === 'as') {
            return this.consume<IdentifierToken>(TokenKind.Identifier, ErrorMessage.Identifier_expected);
        }
        return undefined;
    }
    // #endregion parse ng-controller

    // #region parse ng-repeat
    parseNgRepeat(sourceText: string): NgRepeatProgram {
        this.initializeParser(sourceText, NG_REPEAT_KEYWORDS);

        if (this.isEnd()) {
            return new NgRepeatProgram(sourceText, this.errors);
        }

        // official code: https://github.com/angular/angular.js/blob/d8f77817eb5c98dec5317bc3756d1ea1812bcfbe/src/ng/parse.js#L101
        const { mode, itemKey, itemValue } = this.parseItemDeclaration();
        this.parseInKeyword();
        const items = this.parseItemsExpression();
        const { as, trackBy } = this.parseAsAndTrackBy();

        return new NgRepeatProgram(sourceText, this.errors, { mode, itemKey, itemValue, items, as, trackBy });
    }

    private parseItemDeclaration() {
        let mode: 'array' | 'object' = 'array';
        let itemKey: IdentifierToken | undefined;
        let itemValue: IdentifierToken | undefined;

        if (this.expect(TokenKind.LeftParen)) {
            mode = 'object';
            itemKey = this.consume<IdentifierToken>(TokenKind.Identifier, ErrorMessage.Identifier_expected);
            this.consume(TokenKind.Comma, ErrorMessage.Comma_expected);
            itemValue = this.consume<IdentifierToken>(TokenKind.Identifier, ErrorMessage.Identifier_expected);
            this.consume(TokenKind.RightParen, ErrorMessage.RightParen_expected);
        } else {
            itemValue = this.consume<IdentifierToken>(TokenKind.Identifier, ErrorMessage.Identifier_expected);
        }

        return { itemKey, itemValue, mode };
    }

    private parseInKeyword() {
        const inKeyword = this.consume<KeywordToken>(TokenKind.Keyword, ErrorMessage.Keyword_expected);
        if (inKeyword.value !== 'in') {
            this.reportErrorAt(ErrorMessage.InKeyword_expected, inKeyword.start >= 0 ? inKeyword : this.token());
        }
    }

    private parseItemsExpression() {
        const asOrTrackByIndex = this.findAsOrTrackByIndex();

        if (asOrTrackByIndex !== -1) {
            this.scanner.setScanRange({ end: asOrTrackByIndex });
        }

        const items = this.parseExpression();

        if (asOrTrackByIndex !== -1) {
            this.scanner.setScanRange({ end: this.sourceText.length });
            this.nextToken();
        }

        return items;
    }

    private findAsOrTrackByIndex() {
        const asIndex = this.sourceText.search(/\sas(\s|$)/);
        const trackByIndex = this.sourceText.search(/\strack(\s|$)/);
        return asIndex !== -1 ? asIndex : trackByIndex;
    }

    private parseAsAndTrackBy() {
        let as: IdentifierToken | undefined;
        let trackBy: Expression | undefined;

        if (!this.isEnd()) {
            let keyword = this.expect<KeywordToken>(TokenKind.Keyword);

            if (keyword?.value === 'as') {
                as = this.consume<IdentifierToken>(TokenKind.Identifier, ErrorMessage.Identifier_expected);
                keyword = this.expect<KeywordToken>(TokenKind.Keyword);
            }

            if (keyword?.value === 'track') {
                trackBy = this.parseTrackBy();
            } else if (keyword?.value === 'by') {
                this.reportErrorAt(ErrorMessage.Unexpected_token, keyword);
            }

            if (!this.isEnd()) {
                this.reportErrorAtCurrentToken(ErrorMessage.Unexpected_token);
            }
        }

        return { as, trackBy };
    }

    private parseTrackBy() {
        const byKeyword = this.consume(TokenKind.Keyword, ErrorMessage.Keyword_expected);
        if (byKeyword.value === 'by') {
            return this.parseExpression();
        }

        this.reportErrorAt(ErrorMessage.ByKeyword_expected, byKeyword.start >= 0 ? byKeyword : this.token());
        return undefined;
    }
    // #endregion parse ng-repeat

    parse(sourceText: string): Program {
        this.initializeParser(sourceText, EXPR_KEYWORDS);

        const statements: ExpressionStatement[] = [];
        while (!this.isEnd()) {
            if (this.isUnExpectedTokenOfExpressionStart()) {
                this.skipUnExpectedTokenOfExpressionStart();
            } else {
                statements.push(this.parseExpressionStatement());
            }
        }

        return new Program(sourceText, this.errors, statements);
    }

    private isUnExpectedTokenOfExpressionStart(): boolean {
        return this.token().is(
            TokenKind.Semicolon,
            TokenKind.Comma,
            TokenKind.RightBrace,
            TokenKind.RightBracket,
            TokenKind.RightParen,
            TokenKind.Colon,
        );
    }

    private skipUnExpectedTokenOfExpressionStart() {
        if (!this.token().is(TokenKind.Semicolon)) {
            this.reportErrorAtCurrentToken(ErrorMessage.Expression_expected);
        }
        this.nextToken();
    }

    private isEnd(): boolean {
        return this.token().is(TokenKind.EOF);
    }

    private reportError(error: NgParseError) {
        // 同一个位置只报错一次
        const lastError = this.errors[this.errors.length - 1];
        if (lastError && lastError.start === error.start) {
            return;
        }

        this.assertErrorLocation(error);
        this.errors.push(error);
    }

    private assertErrorLocation({ start, end }: Location) {
        Debug.assert(start >= 0);
        Debug.assert(end >= 0);
        Debug.assert(start <= this.sourceText.length);
        Debug.assert(end <= this.sourceText.length);
        Debug.assert(start <= end);
    }

    private reportErrorAt(message: ErrorMessageType, errorLocation: Location) {
        if (errorLocation.end > this.sourceText.length) {
            (errorLocation as Mutable<Location>).end = this.sourceText.length;
        }
        this.reportError({
            reporter: ErrorReporter.Parser,
            start: errorLocation.start,
            end: errorLocation.end,
            message,
        });
    }

    private reportErrorAtCurrentToken(message: ErrorMessageType) {
        this.reportErrorAt(message, this.token());
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

    // private lookAhead<T>(callback: () => T): T {
    //     // save state
    //     const saveErrors = this.errors;
    //     const savePreviousToken = this.previousToken;
    //     const saveCurrentToken = this.currentToken;

    //     const result = this.scanner.lookAhead<T>(callback);

    //     // restore
    //     this.errors = saveErrors;
    //     this.previousToken = savePreviousToken;
    //     this.currentToken = saveCurrentToken;

    //     return result;
    // }

    private consume<T extends Token>(tokenKind: TokenKind, message: ErrorMessageType): T;
    private consume<T extends Token>(tokenKinds: TokenKind[], message: ErrorMessageType): T;
    private consume<T extends Token>(tokenKind: TokenKind | TokenKind[], message: ErrorMessageType): T {
        const token = this.token();
        const arr = Array.isArray(tokenKind) ? tokenKind : [tokenKind];
        if (arr.some((k) => token.is<T>(k))) {
            this.nextToken();
            return token as T;
        } else {
            this.reportErrorAtCurrentToken(message);
            return this.createMissToken(arr[0]);
        }
    }

    private createMissToken<T extends Token>(tokenKind: TokenKind): T {
        return Token.createEmpty(tokenKind);
    }

    private createMissIdentifier(): Identifier {
        return new Identifier(this.createMissToken<IdentifierToken>(TokenKind.Identifier));
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
        const semicolon = this.isEnd()
            ? this.createMissToken<SemicolonToken>(TokenKind.Semicolon) // 这个 ';' 是可以省略的
            : this.consume(TokenKind.Semicolon, ErrorMessage.Semicolon_expected);
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
        const token = this.consume<IdentifierToken>(TokenKind.Identifier, ErrorMessage.Identifier_expected);
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
        const assignToken = this.expect<AssignToken>(TokenKind.Assign);
        if (assignToken) {
            if (!left.checkIs<LeftHandExpression>(NodeFlags.LeftHandExpression)) {
                this.reportErrorAt(ErrorMessage.Cannot_assign, left);
            }
            left = new AssignExpression(left, assignToken, this.parseAssignExpression());
        }
        return left;
    }

    private parseConditionalExpression(): NormalExpression {
        const condition = this.parseLogicalOrExpression();
        const questionToken = this.expect<QuestionToken>(TokenKind.Question);
        if (questionToken) {
            const whenTrue = this.parseNormalExpression();
            const colonToken = this.consume<ColonToken>(TokenKind.Colon, ErrorMessage.Colon_expected);
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
        return this.parseChainableExpression();
    }

    private parseChainableExpression(): NormalExpression {
        let primary = this.parsePrimaryExpression();

        let token: Token | undefined;
        while ((token = this.expect(TokenKind.LeftParen, TokenKind.Dot, TokenKind.LeftBracket))) {
            if (token.is<LeftParenToken>(TokenKind.LeftParen)) {
                const args = this.parseArguments();
                const rightParen = this.consume<RightParenToken>(
                    TokenKind.RightParen,
                    ErrorMessage.RightParen_expected,
                );
                // literal is not callable
                // e.g. 6(1), 'x'() or null()
                // 注意：
                // 除了这里定义的关键字 null/undefined/true/false,
                // 其他的 js 关键字（如： for/return/break 等）可以作为标识符，也就能调用方法。
                if (primary.is<Literal>(SyntaxKind.Literal)) {
                    this.reportErrorAt(ErrorMessage.Literal_not_callable, primary);
                }
                primary = new CallExpression(primary, token, args, rightParen);
            } else if (token.is<DotToken>(TokenKind.Dot)) {
                // keywords also can used as identifiers(e.g. 'foo.null')
                const name = this.consume<IdentifierToken>(
                    [TokenKind.Identifier, TokenKind.Keyword],
                    ErrorMessage.Identifier_expected,
                );
                primary = new PropertyAccessExpression(primary, token, name);
            } else if (token.is<LeftBracketToken>(TokenKind.LeftBracket)) {
                primary = new ElementAccessExpression(primary, this.parseElementAccess(token));
            } else {
                Debug.fail('Impossible run into this place!');
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
        } else if (this.expect(TokenKind.String, TokenKind.Number, TokenKind.Keyword)) {
            return new Literal(this.previousToken as LiteralToken);
        } else {
            this.reportErrorAtCurrentToken(ErrorMessage.Expression_expected);
            return this.createMissIdentifier();
        }
    }

    private parseGroupExpression() {
        const leftParen = this.previousToken as LeftParenToken;
        const expression = this.parseExpression();
        const rightParen = this.consume<RightParenToken>(TokenKind.RightParen, ErrorMessage.RightParen_expected);
        return new GroupExpression(leftParen, expression, rightParen);
    }

    private parseObjectLiteralExpression(): ObjectLiteralExpression {
        const leftBrace = this.previousToken as LeftBraceToken;
        const properties = this.parseObjectProperties();
        const rightBrace = this.consume<RightBraceToken>(TokenKind.RightBrace, ErrorMessage.RightBrace_expected);
        return new ObjectLiteralExpression(leftBrace, properties, rightBrace);
    }

    private parseArrayLiteralExpression(): ArrayLiteralExpression {
        const leftBracket = this.previousToken as LeftBracketToken;
        const elements = this.parseArrayElements();
        const rightBracket = this.consume<RightBracketToken>(
            TokenKind.RightBracket,
            ErrorMessage.RightBracket_expected,
        );
        return new ArrayLiteralExpression(leftBracket, elements, rightBracket);
    }

    private parseObjectProperties(): PropertyAssignment[] {
        const properties: PropertyAssignment[] = [];
        if (!this.token().is(TokenKind.RightBrace)) {
            do {
                if (this.token().is(TokenKind.RightBrace, TokenKind.EOF)) {
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

        if (token.is<IdentifierToken>(TokenKind.Identifier)) {
            key = new Identifier(token);
            this.nextToken();
            if (this.token().is(TokenKind.Comma, TokenKind.RightBrace, TokenKind.EOF)) {
                // Support ES6 object initializer
                // 官方代码: https://github.com/angular/angular.js/blob/d8f77817eb5c98dec5317bc3756d1ea1812bcfbe/src/ng/parse.js#L527
                // 官方测试: https://github.com/angular/angular.js/blob/d8f77817eb5c98dec5317bc3756d1ea1812bcfbe/test/ng/parseSpec.js#L1360
                const value = key;
                return new PropertyAssignment(key, value);
            }
        } else if (token.is<LiteralToken>(TokenKind.String, TokenKind.Number)) {
            key = new Literal(token);
            this.nextToken();
        } else if (token.is<LeftBracketToken>(TokenKind.LeftBracket)) {
            this.nextToken();
            key = this.parseElementAccess(token);
        } else {
            this.reportErrorAtCurrentToken(ErrorMessage.Property_assign_expected);
            key = this.createMissIdentifier();
        }
        this.consume<ColonToken>(TokenKind.Colon, ErrorMessage.Colon_expected);
        const value = this.parseNormalExpression();
        return new PropertyAssignment(key, value);
    }

    private parseArrayElements(): Expression[] {
        const elements: Expression[] = [];
        if (!this.token().is(TokenKind.RightBracket)) {
            do {
                if (this.token().is(TokenKind.RightBracket, TokenKind.EOF)) {
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
            ErrorMessage.RightBracket_expected,
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
