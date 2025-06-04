import type { ErrorMessageType } from '../src/parser/errorMessage';
import { NgControllerProgram } from '../src/parser/ngControllerNode';
import { NgRepeatProgram } from '../src/parser/ngRepeatNode';
import type {
    ExpressionStatement,
    FilterExpression,
    BinaryExpression,
    UnaryExpression,
    AssignExpression,
    ConditionalExpression,
    ArrayLiteralExpression,
    ObjectLiteralExpression,
    PropertyAssignment,
    ElementAccess,
    CallExpression,
    PropertyAccessExpression,
    ElementAccessExpression,
    Identifier,
    GroupExpression,
    Literal,
    Node,
} from '../src/parser/node';
import { resolveLocation } from '../src/parser/utils';
import { Token } from '../src/scanner/token';
import { type INodeVisitor, type Location, type Programs, TokenKind } from '../src/types';

const MISSING_IDENTIFIER = '$$';

export class SExpr implements INodeVisitor<string, Programs> {
    toString(node: Programs): string {
        return node.accept(this);
    }

    visitProgram(node: Programs): string {
        if (node instanceof NgRepeatProgram) {
            if (!node.config) {
                return '';
            }
            const { itemKey, itemValue, items, as, trackBy } = node.config;
            const itemKeyStr = itemKey ? `(itemKey ${itemKey.value || MISSING_IDENTIFIER})` : '';
            const itemValueStr = itemValue ? `(itemValue ${itemValue.value || MISSING_IDENTIFIER})` : '';
            const itemsStr = `(items ${items.accept(this)})`;
            const asStr = as ? `(as ${as.value || MISSING_IDENTIFIER})` : '';
            const trackByStr = trackBy ? `(trackBy ${trackBy.accept(this)})` : '';
            const s = [itemKeyStr, itemValueStr, itemsStr, asStr, trackByStr].filter(Boolean).join(' ');
            return `(ngRepeat ${s})`;
        } else if (node instanceof NgControllerProgram) {
            if (!node.config) {
                return '';
            }
            const { controllerName, as } = node.config;
            const asStr = as ? `(as ${as.value || MISSING_IDENTIFIER})` : '';
            const s = [controllerName.value || MISSING_IDENTIFIER, asStr].filter(Boolean).join(' ');
            return `(ngController ${s})`;
        }
        return node.statements.map((stmt) => stmt.accept(this)).join(';');
    }
    visitExpressionStatement(node: ExpressionStatement): string {
        return node.expression.accept(this);
    }
    visitFilterExpression(node: FilterExpression): string {
        const arr = [node.input.accept(this), ...node.args.map((arg) => arg.accept(this))];
        return `(filter ${node.name.accept(this)}| ${arr.join(' ')})`;
    }
    visitBinaryExpression(node: BinaryExpression): string {
        return `(${node.operator.toString()} ${node.left.accept(this)} ${node.right.accept(this)})`;
    }
    visitUnaryExpression(node: UnaryExpression): string {
        return `(${node.operator.toString()} ${node.operand.accept(this)})`;
    }
    visitAssignExpression(node: AssignExpression): string {
        return `(= ${node.left.accept(this)} ${node.right.accept(this)})`;
    }
    visitConditionalExpression(node: ConditionalExpression): string {
        return `(cond? ${node.condition.accept(this)} ${node.whenTrue.accept(this)} ${node.whenFalse.accept(this)})`;
    }
    visitArrayLiteralExpression(node: ArrayLiteralExpression): string {
        const arr = ['[array]', ...node.elements.map((element) => element.accept(this))];
        return `(${arr.join(' ')})`;
    }
    visitObjectLiteralExpression(node: ObjectLiteralExpression): string {
        const arr = ['{object}', ...node.properties.map((property) => property.accept(this))];
        return `(${arr.join(' ')})`;
    }
    visitPropertyAssignment(node: PropertyAssignment): string {
        return `(${node.property.accept(this)} ${node.initializer.accept(this)})`;
    }
    visitElementAccess(node: ElementAccess): string {
        return `[${node.expression.accept(this)}]`;
    }
    visitCallExpression(node: CallExpression): string {
        const arr = [node.callee.accept(this), ...node.args.map((arg) => arg.accept(this))];
        return `(${arr.join(' ')})`;
    }
    visitPropertyAccessExpression(node: PropertyAccessExpression): string {
        return `${node.parent.accept(this)}.${node.name.accept(this)}`;
    }
    visitElementAccessExpression(node: ElementAccessExpression): string {
        return `${node.parent.accept(this)}[${node.elementExpression.accept(this)}]`;
    }
    visitIdentifier(node: Identifier): string {
        return node.name || MISSING_IDENTIFIER;
    }
    visitGroupExpression(node: GroupExpression): string {
        return node.expression.accept(this);
    }
    visitLiteral(node: Literal): string {
        if (node.literalTokenKind === TokenKind.String) {
            return `"${node.value}"`;
        }
        return Token.shouldHaveValue(node.literalTokenKind)
            ? (node.value ?? '')
            : Token.createEmpty(node.literalTokenKind).toString();
    }
}

export class LocationValidator implements INodeVisitor<boolean, Programs> {
    private strict = true;
    validate(node: Programs, strict = true): boolean {
        this.strict = strict;
        return node.accept(this);
    }

    private compareToChildren(
        parent: Node<Programs>,
        childNodes: Node<Programs>[],
        childTokens: Token[] = [],
    ): boolean {
        if (!this.checkLocations(parent, ...childTokens, ...childNodes)) {
            return false;
        }

        const childLocations = [...(childTokens as Location[]), ...(childNodes as Location[])];
        if (childLocations.length > 0) {
            const { start, end } = resolveLocation(...childLocations);
            if (start < parent.start || end > parent.end) {
                return false;
            }
        }

        return childNodes.every((child) => child.accept(this));
    }

    private checkLocations(...nodes: Location[]): boolean {
        if (!this.strict) {
            return true;
        }
        return nodes.every((node) => node.start >= 0 && node.end >= 0 && node.end >= node.start);
    }

    visitProgram(node: Programs): boolean {
        if (node.start < 0 || (node.source.length > 0 && node.end > node.source.length)) {
            return false;
        }
        if (node instanceof NgRepeatProgram) {
            if (!node.config) {
                return true;
            }
            const config = node.config;
            return this.compareToChildren(
                node,
                [config.items, config.trackBy].filter(Boolean) as Node<Programs>[],
                [config.itemKey, config.itemValue, config.as].filter(Boolean) as Token[],
            );
        } else if (node instanceof NgControllerProgram) {
            if (!node.config) {
                return true;
            }
            const config = node.config;
            return this.compareToChildren(node, [], [config.controllerName, config.as].filter(Boolean) as Token[]);
        }
        return this.compareToChildren(node, node.statements);
    }
    visitExpressionStatement(node: ExpressionStatement): boolean {
        return this.compareToChildren(node, [node.expression]);
    }
    visitFilterExpression(node: FilterExpression): boolean {
        return this.compareToChildren(node, [node.input, node.name, ...node.args]);
    }
    visitBinaryExpression(node: BinaryExpression): boolean {
        return this.compareToChildren(node, [node.left, node.right], [node.operator]);
    }
    visitUnaryExpression(node: UnaryExpression): boolean {
        return this.compareToChildren(node, [node.operand], [node.operator]);
    }
    visitAssignExpression(node: AssignExpression): boolean {
        return this.compareToChildren(node, [node.left, node.right], [node.operator]);
    }
    visitConditionalExpression(node: ConditionalExpression): boolean {
        return this.compareToChildren(node, [node.condition, node.whenTrue, node.whenFalse]);
    }
    visitArrayLiteralExpression(node: ArrayLiteralExpression): boolean {
        return this.compareToChildren(node, node.elements);
    }
    visitObjectLiteralExpression(node: ObjectLiteralExpression): boolean {
        return this.compareToChildren(node, node.properties);
    }
    visitPropertyAssignment(node: PropertyAssignment): boolean {
        return this.compareToChildren(node, [node.property, node.initializer]);
    }
    visitElementAccess(node: ElementAccess): boolean {
        return this.compareToChildren(node, [node.expression]);
    }
    visitCallExpression(node: CallExpression): boolean {
        return this.compareToChildren(node, [node.callee, ...node.args]);
    }
    visitPropertyAccessExpression(node: PropertyAccessExpression): boolean {
        return this.compareToChildren(node, [node.parent, node.name]);
    }
    visitElementAccessExpression(node: ElementAccessExpression): boolean {
        return this.compareToChildren(node, [node.parent, node.elementExpression]);
    }
    visitIdentifier(node: Identifier): boolean {
        return this.compareToChildren(node, []);
    }
    visitGroupExpression(node: GroupExpression): boolean {
        return this.compareToChildren(node, [node.expression]);
    }
    visitLiteral(node: Literal): boolean {
        return this.compareToChildren(node, []);
    }
}

export class TestVisitor implements INodeVisitor<Node, Programs> {
    visitProgram(node: Programs): Node {
        return node;
    }
    visitExpressionStatement(node: ExpressionStatement): Node {
        return node;
    }
    visitFilterExpression(node: FilterExpression): Node {
        return node;
    }
    visitAssignExpression(node: AssignExpression): Node {
        return node;
    }
    visitConditionalExpression(node: ConditionalExpression): Node {
        return node;
    }
    visitBinaryExpression(node: BinaryExpression): Node {
        return node;
    }
    visitUnaryExpression(node: UnaryExpression): Node {
        return node;
    }
    visitCallExpression(node: CallExpression): Node {
        return node;
    }
    visitArrayLiteralExpression(node: ArrayLiteralExpression): Node {
        return node;
    }
    visitObjectLiteralExpression(node: ObjectLiteralExpression): Node {
        return node;
    }
    visitPropertyAccessExpression(node: PropertyAccessExpression): Node {
        return node;
    }
    visitElementAccessExpression(node: ElementAccessExpression): Node {
        return node;
    }
    visitGroupExpression(node: GroupExpression): Node {
        return node;
    }
    visitPropertyAssignment(node: PropertyAssignment): Node {
        return node;
    }
    visitElementAccess(node: ElementAccess): Node {
        return node;
    }
    visitIdentifier(node: Identifier): Node {
        return node;
    }
    visitLiteral(node: Literal): Node {
        return node;
    }
}

export type ErrorInfo = [ErrorMessageType, number, number];

const sExpr = new SExpr();
const locationValidator = new LocationValidator();

export const visitor = new TestVisitor();

export function compareAstUseSExpr(program: Programs, expected: string) {
    expect(sExpr.toString(program)).toBe(expected);
}

export function checkNoErrorAndLocations(program: Programs) {
    checkErrorAndLocations(program);
}

export function checkErrorAndLocations(program: Programs, ...errors: ErrorInfo[]) {
    expect(locationValidator.validate(program, errors.length === 0)).toBe(true);
    expect(program.errors).toHaveLength(errors.length);
    program.errors.forEach((error, index) => {
        expect(error.message).toBe(errors[index][0]);
        expect(error.start).toBe(errors[index][1]);
        expect(error.end).toBe(errors[index][2]);
    });
}
