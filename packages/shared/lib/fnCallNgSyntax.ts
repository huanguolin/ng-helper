import { NgControllerProgram } from '@ng-helper/ng-parser/src/parser/ngControllerNode';
import { NgRepeatProgram } from '@ng-helper/ng-parser/src/parser/ngRepeatNode';
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
import type { INodeVisitor, Location, Programs } from '@ng-helper/ng-parser/src/types';

import { ngParse } from './ngParse';

class FnCallNgSyntaxVisitor implements INodeVisitor<CallExpression | undefined, Program> {
    private cursorAt = 0;

    getCursorAtFnCallSyntax(program: Programs, cursorAt: number): CallExpression | undefined {
        if (cursorAt < 0 || cursorAt >= program.source.length) {
            return;
        }

        this.cursorAt = cursorAt;

        if (program instanceof NgControllerProgram) {
            return;
        } else if (program instanceof NgRepeatProgram) {
            return this.getNgRepeatFnCallSyntax(program);
        }

        return program.accept(this);
    }

    private getNgRepeatFnCallSyntax(program: NgRepeatProgram): CallExpression | undefined {
        if (program.config && this.isAt(program.config.items)) {
            return program.config.items.accept(this);
        }
    }

    private isAt(node: Location): boolean {
        return isAt(node, this.cursorAt);
    }

    visitProgram(node: Program): CallExpression | undefined {
        for (const statement of node.statements) {
            if (this.isAt(statement)) {
                return statement.accept(this);
            }
        }
    }

    visitExpressionStatement(node: ExpressionStatement): CallExpression | undefined {
        if (this.isAt(node.expression)) {
            return node.expression.accept(this);
        }
    }

    visitFilterExpression(node: FilterExpression): CallExpression | undefined {
        if (!this.isAt(node)) {
            return;
        }

        if (this.isAt(node.name)) {
            return;
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

    visitAssignExpression(node: AssignExpression): CallExpression | undefined {
        if (!this.isAt(node)) {
            return;
        }

        if (this.isAt(node.left)) {
            return node.left.accept(this);
        } else if (this.isAt(node.right)) {
            return node.right.accept(this);
        }
    }

    visitConditionalExpression(node: ConditionalExpression): CallExpression | undefined {
        if (!this.isAt(node)) {
            return;
        }

        if (this.isAt(node.condition)) {
            return node.condition.accept(this);
        } else if (this.isAt(node.whenTrue)) {
            return node.whenTrue.accept(this);
        } else if (this.isAt(node.whenFalse)) {
            return node.whenFalse.accept(this);
        }
    }

    visitBinaryExpression(node: BinaryExpression): CallExpression | undefined {
        if (!this.isAt(node)) {
            return;
        }

        if (this.isAt(node.left)) {
            return node.left.accept(this);
        } else if (this.isAt(node.right)) {
            return node.right.accept(this);
        }
    }

    visitUnaryExpression(node: UnaryExpression): CallExpression | undefined {
        if (!this.isAt(node)) {
            return;
        }

        if (this.isAt(node.operand)) {
            return node.operand.accept(this);
        }
    }

    visitArrayLiteralExpression(node: ArrayLiteralExpression): CallExpression | undefined {
        if (!this.isAt(node)) {
            return;
        }

        for (const element of node.elements) {
            if (this.isAt(element)) {
                return element.accept(this);
            }
        }
    }

    visitObjectLiteralExpression(node: ObjectLiteralExpression): CallExpression | undefined {
        if (!this.isAt(node)) {
            return;
        }

        for (const property of node.properties) {
            if (this.isAt(property)) {
                return property.accept(this);
            }
        }
    }

    visitPropertyAssignment(node: PropertyAssignment): CallExpression | undefined {
        if (!this.isAt(node)) {
            return;
        }

        if (this.isAt(node.property)) {
            return node.property.accept(this);
        } else if (this.isAt(node.initializer)) {
            return node.initializer.accept(this);
        }
    }

    visitElementAccess(node: ElementAccess): CallExpression | undefined {
        if (this.isAt(node.expression)) {
            return node.expression.accept(this);
        }
    }

    visitPropertyAccessExpression(node: PropertyAccessExpression): CallExpression | undefined {
        if (!this.isAt(node)) {
            return;
        }

        if (this.isAt(node.parent)) {
            return node.parent.accept(this);
        }
    }

    visitElementAccessExpression(node: ElementAccessExpression): CallExpression | undefined {
        if (!this.isAt(node)) {
            return;
        }

        if (this.isAt(node.elementExpression)) {
            return node.elementExpression.accept(this);
        } else if (this.isAt(node.parent)) {
            return node.parent.accept(this);
        }
    }

    visitCallExpression(node: CallExpression): CallExpression | undefined {
        if (!this.isAt(node)) {
            return;
        }

        for (const arg of node.args) {
            if (this.isAt(arg)) {
                const n = arg.accept(this);
                if (n) {
                    return n;
                }
            }
        }

        return node;
    }

    visitIdentifier(_node: Identifier): CallExpression | undefined {
        return;
    }

    visitLiteral(_node: Literal): CallExpression | undefined {
        return;
    }

    visitGroupExpression(node: GroupExpression): CallExpression | undefined {
        if (this.isAt(node.expression)) {
            return node.expression.accept(this);
        }
    }
}

function isAt(node: Location, cursorAt: number): boolean {
    return cursorAt >= node.start && cursorAt < node.end;
}

const fnCallNgSyntaxVisitor = new FnCallNgSyntaxVisitor();

export function getFnCallNode(
    ngExprStr: string,
    cursorAt: number,
    attrName?: 'ng-repeat' | 'ng-controller',
): CallExpression | undefined {
    if (!ngExprStr || typeof ngExprStr !== 'string') {
        return;
    }

    const program = ngParse(ngExprStr, attrName);

    return fnCallNgSyntaxVisitor.getCursorAtFnCallSyntax(program, cursorAt);
}

export function getActiveParameterIndex(callNode: CallExpression, cursorAt: number): number {
    let activeIndex = -1;
    if (cursorAt >= callNode.callee.end) {
        const args = callNode.args;

        if (args.length === 0) {
            activeIndex = 0;
        } else {
            let i = 0;
            while (i < args.length && cursorAt >= args[i].end) {
                i++;
            }
            if (i >= args.length) {
                i = args.length - 1;
            }
            activeIndex = i;
        }
    }
    return activeIndex;
}
