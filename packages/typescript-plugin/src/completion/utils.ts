import type ts from 'typescript';

import { PluginContext, SyntaxNodeInfo } from '../type';
import { getPropertyType, createTmpSourceFile, typeToString } from '../utils/common';

/**
 * 依据起始类型（根类型）和最小语法节点，获取用于补全的类型。
 * 主要的几种情况：
 * ctrl.a.b.
 * ctrl.a.[0].
 * ctrl.a.[ctrl.prefix + 'b'].
 * ctrl.a(1, ctrl.b.c).
 * @param ctx 上下文
 * @param rootType 根类型
 * @param minSyntaxNode 查找目标类型的最小语法节点
 * @returns 目标类型
 */
export function getCompletionType(ctx: PluginContext, rootType: ts.Type, minSyntaxNode: SyntaxNodeInfo): ts.Type | undefined {
    const logger = ctx.logger.prefix('getCompletionType()');
    return visit(minSyntaxNode.node);

    function visit(node: ts.Node): ts.Type | undefined {
        logger.info('node text:', node.getText(minSyntaxNode.sourceFile));

        if (ctx.ts.isPropertyAccessExpression(node)) {
            const nodeType = ctx.ts.isIdentifier(node.expression) ? rootType : visit(node.expression);
            logger.info('prop type:', typeToString(ctx, nodeType), 'node.name:', node.name.text);
            if (nodeType) {
                return node.name.text ? getPropertyType(ctx, nodeType, node.name.text) : nodeType;
            }
        } else if (ctx.ts.isCallExpression(node)) {
            const nodeType = visit(node.expression);
            if (!nodeType) {
                return;
            }

            const signatures = nodeType.getCallSignatures();
            logger.info('signatures:', ...signatures);
            if (signatures.length === 1) {
                return signatures[0].getReturnType();
            } else if (signatures.length > 1) {
                const matchedSignatures = signatures.filter((x) => x.parameters.length === node.arguments.length);
                if (matchedSignatures.length > 0) {
                    // TODO 按照入参类型找到合适的函数签名
                    return matchedSignatures[0].getReturnType();
                }
            }
        } else if (ctx.ts.isElementAccessExpression(node)) {
            const nodeType = visit(node.expression);
            if (!nodeType) {
                return;
            }

            if (ctx.typeChecker.isTupleType(nodeType)) {
                const tupleElementTypes = ctx.typeChecker.getTypeArguments(nodeType as ts.TypeReference);
                const v = node.argumentExpression;
                if (ctx.ts.isLiteralExpression(v) && v.kind === ctx.ts.SyntaxKind.NumericLiteral) {
                    const index = Number.parseInt(v.text);
                    return tupleElementTypes[index];
                } else {
                    // TODO
                    // return ctx.typeChecker.getUnionType(tupleElementTypes);
                }
            } else if (ctx.typeChecker.isArrayType(nodeType)) {
                const typeArguments = ctx.typeChecker.getTypeArguments(nodeType as ts.TypeReference);
                return typeArguments.length > 0 ? typeArguments[0] : undefined;
            } else if (ctx.typeChecker.isArrayLikeType(nodeType)) {
                // TODO
            }
        } else {
            logger.info('can not be here!');
        }
    }
}

/**
 * 获取用于补全的最小语法节点。举例：
 *
 * 字段访问
 * ctrl. -> ctrl.
 * ctrl.a.b. -> ctrl.a.b.
 * ctrl.a.['b']. -> ctrl.a.['b'].
 * ctrl.a.[ctrl.prefix + 'b']. -> ctrl.a.[ctrl.prefix + 'b'].
 *
 * 数组访问
 * ctrl.a[ctrl.b.c. -> ctrl.b.c.
 * ctrl.a[1 + ctrl.b.c]. -> ctrl.a[1 + ctrl.b.c].
 *
 * 方法调用
 * ctrl.a(ctrl.b.c. -> ctrl.b.c.
 * ctrl.a(1, ctrl.b.c). -> ctrl.a(1, ctrl.b.c).
 *
 * 一元表达式
 * !ctrl.a. -> ctrl.a.
 * ++ctrl.a. -> ctrl.a.
 *
 * 二元表达式
 * ctrl.a = ctrl.b. -> ctrl.b.
 * ctrl.a && ctrl.b. -> ctrl.b.
 *
 * 括号分组
 * (ctrl.a. -> ctrl.a.
 * ((ctrl.a + ctrl.b) / ctrl.c. -> ctrl.c.
 *
 * 字面量对象
 * ({ a:ctrl.b, b:ctrl.c. -> ctrl.c.
 *
 * 逗号表达式
 * ctrl.a = 1, ctrl.b. -> ctrl.b.
 *
 * 多语句
 * ctrl.a = ctrl.b.c; ctrl.d. -> ctrl.d.
 *
 * @param ctx 上下文
 * @param prefix 补全前缀字符串
 * @returns 最小语法节点
 */
export function getMinSyntaxNodeForCompletion(ctx: PluginContext, prefix: string): SyntaxNodeInfo | undefined {
    const sourceFile = createTmpSourceFile(ctx, prefix);
    return visit(sourceFile);

    function visit(node: ts.Node): SyntaxNodeInfo | undefined {
        if (ctx.ts.isSourceFile(node)) {
            return visit(node.statements[node.statements.length - 1]);
        } else if (ctx.ts.isExpressionStatement(node)) {
            return visit(node.expression);
        } else if (ctx.ts.isCommaListExpression(node)) {
            return visit(node.elements[node.elements.length - 1]);
        } else if (ctx.ts.isBinaryExpression(node)) {
            return visit(node.right);
        } else if (ctx.ts.isPrefixUnaryExpression(node)) {
            return visit(node.operand);
        } else if (ctx.ts.isParenthesizedExpression(node)) {
            return visit(node.expression);
        } else if (ctx.ts.isObjectLiteralExpression(node)) {
            return visit(node.properties[node.properties.length - 1]);
        } else if (ctx.ts.isPropertyAssignment(node)) {
            return visit(node.initializer);
        } else if (ctx.ts.isCallExpression(node)) {
            return visit(node.arguments[node.arguments.length - 1]);
        } else if (ctx.ts.isElementAccessExpression(node)) {
            return visit(node.argumentExpression);
        } else if (ctx.ts.isPropertyAccessExpression(node)) {
            return { sourceFile, node };
        }
        // 其他情况不支持
    }
}
