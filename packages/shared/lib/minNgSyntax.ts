import { NgControllerProgram } from '@ng-helper/ng-parser/src/parser/ngControllerNode';
import { NgRepeatProgram } from '@ng-helper/ng-parser/src/parser/ngRepeatNode';
import {
    Program,
    type ArrayLiteralExpression,
    type AssignExpression,
    type BinaryExpression,
    type CallExpression,
    type ConditionalExpression,
    type ElementAccess,
    type ElementAccessExpression,
    type ExpressionStatement,
    type FilterExpression,
    type GroupExpression,
    type Identifier,
    type Literal,
    type ObjectLiteralExpression,
    type PropertyAccessExpression,
    type PropertyAssignment,
    type UnaryExpression,
} from '@ng-helper/ng-parser/src/parser/node';
import {
    INodeVisitor,
    SyntaxKind,
    type Location,
    type NgAttrName,
    type Programs,
} from '@ng-helper/ng-parser/src/types';

import { ngParse } from './ngParse';

type MinNgSyntaxNode = Literal | PropertyAccessExpression | FilterExpression | Identifier;
export type MinNgSyntaxType = 'none' | 'literal' | 'propertyAccess' | 'filterName' | 'identifier';

export interface BaseMinNgSyntaxInfo {
    type: MinNgSyntaxType;
    value: string;
    attrName?: NgAttrName;
}

export interface NormalMinNgSyntaxInfo extends BaseMinNgSyntaxInfo {
    attrName?: undefined;
}

export interface NgRepeatMinNgSyntaxInfo extends BaseMinNgSyntaxInfo {
    attrName: 'ng-repeat';
    /**
     * items, trackBy 用于自动补全。
     * 除了 as 其他都能用于 hover/definition。
     */
    nodeName: 'itemValue' | 'itemKey' | 'items' | 'as' | 'trackBy';
}

export interface NgControllerMinNgSyntaxInfo extends BaseMinNgSyntaxInfo {
    attrName: 'ng-controller';
    nodeName: 'controllerName' | 'as';
}

export type MinNgSyntaxInfo = NormalMinNgSyntaxInfo | NgRepeatMinNgSyntaxInfo | NgControllerMinNgSyntaxInfo;

class MinNgSyntaxVisitor implements INodeVisitor<MinNgSyntaxNode | undefined, Program> {
    private cursorAt = 0;

    getCursorAtMinSyntax(program: Programs, cursorAt: number): MinNgSyntaxInfo {
        if (cursorAt < 0 || cursorAt >= program.source.length) {
            return { type: 'none', value: '' };
        }

        this.cursorAt = cursorAt;

        if (program instanceof NgRepeatProgram) {
            return this.getNgRepeatMinNgSyntaxInfo(program);
        } else if (program instanceof NgControllerProgram) {
            return this.getNgControllerMinNgSyntaxInfo(program);
        }

        const node = program.accept(this);
        return this.getMinNgSyntaxInfoFromNode(node, program);
    }

    private getNgRepeatMinNgSyntaxInfo(program: NgRepeatProgram): MinNgSyntaxInfo {
        if (program.config) {
            if (this.isAt(program.config.itemValue)) {
                return {
                    type: 'identifier',
                    value: this.getNodeText(program, program.config.itemValue),
                    attrName: 'ng-repeat',
                    nodeName: 'itemValue',
                };
            } else if (program.config.itemKey && this.isAt(program.config.itemKey)) {
                return {
                    type: 'identifier',
                    value: this.getNodeText(program, program.config.itemKey),
                    attrName: 'ng-repeat',
                    nodeName: 'itemKey',
                };
            } else if (this.isAt(program.config.items)) {
                const node = program.config.items.accept(this);
                const result = this.getMinNgSyntaxInfoFromNode(node, program) as NgRepeatMinNgSyntaxInfo;
                if (result.type !== 'none') {
                    result.attrName = 'ng-repeat';
                    result.nodeName = 'items';
                }
                return result;
            } else if (program.config.as && this.isAt(program.config.as)) {
                return {
                    type: 'identifier',
                    value: this.getNodeText(program, program.config.as),
                    attrName: 'ng-repeat',
                    nodeName: 'as',
                };
            } else if (program.config.trackBy && this.isAt(program.config.trackBy)) {
                const node = program.config.trackBy.accept(this);
                const result = this.getMinNgSyntaxInfoFromNode(node, program) as NgRepeatMinNgSyntaxInfo;
                if (result.type !== 'none') {
                    result.attrName = 'ng-repeat';
                    result.nodeName = 'trackBy';
                }
                return result;
            }
        }
        return { type: 'none', value: '' };
    }

    private getNgControllerMinNgSyntaxInfo(program: NgControllerProgram): MinNgSyntaxInfo {
        if (program.config) {
            if (this.isAt(program.config.controllerName)) {
                return {
                    type: 'identifier',
                    value: this.getNodeText(program, program.config.controllerName),
                    attrName: 'ng-controller',
                    nodeName: 'controllerName',
                };
            } else if (program.config.as && this.isAt(program.config.as)) {
                return {
                    type: 'identifier',
                    value: this.getNodeText(program, program.config.as),
                    attrName: 'ng-controller',
                    nodeName: 'as',
                };
            }
        }
        return { type: 'none', value: '' };
    }

    private getMinNgSyntaxInfoFromNode(node: MinNgSyntaxNode | undefined, program: Programs): MinNgSyntaxInfo {
        const result: MinNgSyntaxInfo = { type: 'none', value: '' };
        if (node) {
            if (node.is<FilterExpression>(SyntaxKind.FilterExpression)) {
                result.type = 'filterName';
                result.value = this.getNodeText(program, node.name);
            } else {
                if (node.is<PropertyAccessExpression>(SyntaxKind.PropertyAccessExpression)) {
                    result.type = 'propertyAccess';
                } else if (node.is<Identifier>(SyntaxKind.Identifier)) {
                    result.type = 'identifier';
                } else {
                    result.type = 'literal';
                }
                result.value = this.getNodeText(program, node);
            }
        }
        return result;
    }

    private getNodeText(program: Programs, node: Location): string {
        return program.source.slice(node.start, node.end);
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

export function getMinNgSyntaxInfo(
    ngExprStr: string,
    cursorAt: number,
    attrName?: 'ng-repeat' | 'ng-controller',
): MinNgSyntaxInfo {
    if (!ngExprStr || typeof ngExprStr !== 'string') {
        return { type: 'none', value: '' };
    }

    const program = ngParse(ngExprStr, attrName);

    return minNgSyntaxVisitor.getCursorAtMinSyntax(program, cursorAt);
}
