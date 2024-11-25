import { ngParse } from '@ng-helper/ng-parser';
import type {
    ArrayLiteralExpression,
    AssignExpression,
    BinaryExpression,
    CallExpression,
    ConditionalExpression,
    ElementAccess,
    ElementAccessExpression,
    ExpressionStatement,
    FilterExpression,
    GroupExpression,
    Identifier,
    Literal,
    ObjectLiteralExpression,
    Program,
    PropertyAccessExpression,
    PropertyAssignment,
    UnaryExpression,
} from '@ng-helper/ng-parser/src/parser/node';
import { INodeVisitor, SyntaxKind, type Location } from '@ng-helper/ng-parser/src/types';

type MinNgSyntaxNode = Literal | PropertyAccessExpression | FilterExpression | Identifier;
export type MinNgSyntaxType = 'none' | 'literal' | 'propertyAccess' | 'filterName' | 'identifier';
export interface MinNgSyntaxInfo {
    type: MinNgSyntaxType;
    value: string;
}

class MinNgSyntaxVisitor implements INodeVisitor<MinNgSyntaxNode | undefined> {
    private cursorAt = 0;

    getCursorAtMinSyntax(program: Program, cursorAt: number): MinNgSyntaxInfo {
        if (cursorAt < 0 || cursorAt >= program.source.length) {
            return { type: 'none', value: '' };
        }

        this.cursorAt = cursorAt;
        const node = this.visitProgram(program);
        const result: MinNgSyntaxInfo = { type: 'none', value: '' };
        if (node) {
            if (node.is<FilterExpression>(SyntaxKind.FilterExpression)) {
                result.type = 'filterName';
                result.value = program.source.slice(node.name.start, node.name.end);
            } else {
                if (node.is<PropertyAccessExpression>(SyntaxKind.PropertyAccessExpression)) {
                    result.type = 'propertyAccess';
                } else if (node.is<Identifier>(SyntaxKind.Identifier)) {
                    result.type = 'identifier';
                } else {
                    result.type = 'literal';
                }
                result.value = program.source.slice(node.start, node.end);
            }
        }
        return result;
    }

    private isAt(node: Location): boolean {
        return this.cursorAt >= node.start && this.cursorAt < node.end;
    }

    visitProgram(node: Program): MinNgSyntaxNode | undefined {
        for (const statement of node.statements) {
            if (this.isAt(statement)) {
                return statement.accept(this);
            }
        }
    }
    visitExpressionStatement(node: ExpressionStatement): MinNgSyntaxNode | undefined {
        if (this.isAt(node.expression)) {
            return node.expression.accept(this);
        }
    }
    visitFilterExpression(node: FilterExpression): MinNgSyntaxNode | undefined {
        if (!this.isAt(node)) {
            return undefined;
        }

        if (this.isAt(node.name)) {
            // 在 filter name，则返回 filter node
            return node;
        } else if (this.isAt(node.input)) {
            return node.input.accept(this);
        } else {
            for (const arg of node.args) {
                if (this.isAt(arg)) {
                    return arg.accept(this);
                }
            }
        }
    }
    visitAssignExpression(node: AssignExpression): MinNgSyntaxNode | undefined {
        if (!this.isAt(node)) {
            return undefined;
        }

        if (this.isAt(node.left)) {
            return node.left.accept(this);
        } else if (this.isAt(node.right)) {
            return node.right.accept(this);
        }
    }
    visitConditionalExpression(node: ConditionalExpression): MinNgSyntaxNode | undefined {
        if (!this.isAt(node)) {
            return undefined;
        }

        if (this.isAt(node.condition)) {
            return node.condition.accept(this);
        } else if (this.isAt(node.whenTrue)) {
            return node.whenTrue.accept(this);
        } else if (this.isAt(node.whenFalse)) {
            return node.whenFalse.accept(this);
        }
    }
    visitBinaryExpression(node: BinaryExpression): MinNgSyntaxNode | undefined {
        if (!this.isAt(node)) {
            return undefined;
        }

        if (this.isAt(node.left)) {
            return node.left.accept(this);
        } else if (this.isAt(node.right)) {
            return node.right.accept(this);
        }
    }
    visitUnaryExpression(node: UnaryExpression): MinNgSyntaxNode | undefined {
        if (!this.isAt(node)) {
            return undefined;
        }

        if (this.isAt(node.operand)) {
            return node.operand.accept(this);
        }
    }
    visitArrayLiteralExpression(node: ArrayLiteralExpression): MinNgSyntaxNode | undefined {
        if (!this.isAt(node)) {
            return undefined;
        }

        for (const element of node.elements) {
            if (this.isAt(element)) {
                return element.accept(this);
            }
        }
    }
    visitObjectLiteralExpression(node: ObjectLiteralExpression): MinNgSyntaxNode | undefined {
        if (!this.isAt(node)) {
            return undefined;
        }

        for (const property of node.properties) {
            if (this.isAt(property)) {
                return property.accept(this);
            }
        }
    }
    visitPropertyAssignment(node: PropertyAssignment): MinNgSyntaxNode | undefined {
        if (!this.isAt(node)) {
            return undefined;
        }

        if (this.isAt(node.property)) {
            return node.property.accept(this);
        } else if (this.isAt(node.initializer)) {
            return node.initializer.accept(this);
        }
    }
    visitElementAccess(node: ElementAccess): MinNgSyntaxNode | undefined {
        if (this.isAt(node.expression)) {
            return node.expression.accept(this);
        }
    }
    visitPropertyAccessExpression(node: PropertyAccessExpression): MinNgSyntaxNode | undefined {
        if (!this.isAt(node)) {
            return undefined;
        }

        if (this.isAt(node.parent)) {
            return node.parent.accept(this);
        }

        return node;
    }
    visitElementAccessExpression(node: ElementAccessExpression): MinNgSyntaxNode | undefined {
        if (!this.isAt(node)) {
            return undefined;
        }

        if (this.isAt(node.elementExpression)) {
            return node.elementExpression.accept(this);
        } else if (this.isAt(node.parent)) {
            return node.parent.accept(this);
        }
    }
    visitCallExpression(node: CallExpression): MinNgSyntaxNode | undefined {
        if (!this.isAt(node)) {
            return undefined;
        }

        for (const arg of node.args) {
            if (this.isAt(arg)) {
                return arg.accept(this);
            }
        }

        if (this.isAt(node.callee)) {
            return node.callee.accept(this);
        }
    }
    visitIdentifier(node: Identifier): MinNgSyntaxNode | undefined {
        if (this.isAt(node)) {
            return node;
        }
    }
    visitLiteral(node: Literal): MinNgSyntaxNode | undefined {
        if (this.isAt(node)) {
            return node;
        }
    }
    visitGroupExpression(node: GroupExpression): MinNgSyntaxNode | undefined {
        if (this.isAt(node.expression)) {
            return node.expression.accept(this);
        }
    }
}

const minNgSyntaxVisitor = new MinNgSyntaxVisitor();

export function getMinNgSyntaxInfo(ngExprStr: string, cursorAt: number): MinNgSyntaxInfo {
    if (!ngExprStr || typeof ngExprStr !== 'string') {
        return { type: 'none', value: '' };
    }

    // TODO: 增加缓存提高效率
    const program = ngParse(ngExprStr);

    return minNgSyntaxVisitor.getCursorAtMinSyntax(program, cursorAt);
}
