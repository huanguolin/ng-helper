import type ts from 'typescript';

import { PluginContext, SyntaxNodeInfo } from '../type';
import {
    getPropertyType,
    createTmpSourceFile,
    typeToString,
    getTypeArguments,
    getNumberLiteralType,
    createUnionType,
} from '../utils/common';

/**
 * 依据起始类型（根类型）和最小语法节点，获取用于补全的类型。
 * 主要的几种情况：
 * ctrl.a.b.
 * ctrl.a.[0].
 * ctrl.a.[ctrl.prefix + 'b'].
 * ctrl.a(1, ctrl.b.c).
 * 1.
 * "a".
 * @param ctx 上下文
 * @param rootType 根类型
 * @param minSyntaxNode 查找目标类型的最小语法节点
 * @returns 目标类型
 */
export function getNodeType(ctx: PluginContext, rootType: ts.Type, minSyntaxNode: SyntaxNodeInfo): ts.Type | undefined {
    const logger = ctx.logger.prefix('getNodeType()');
    return visit(minSyntaxNode.minNode);

    function visit(node: ts.Node): ts.Type | undefined {
        logger.info('node text:', node.getText(minSyntaxNode.sourceFile));

        if (ctx.ts.isLiteralExpression(node)) {
            return getLiteralType(ctx, node);
        } else if (ctx.ts.isPropertyAccessExpression(node)) {
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
            logger.info('signatures:', ...signatures.map((s) => ctx.typeChecker.signatureToString(s)));
            if (signatures.length === 1) {
                return signatures[0].getReturnType();
            } else if (signatures.length > 1) {
                const matchedSignatures = signatures.filter((x) => x.parameters.length === node.arguments.length);
                if (matchedSignatures.length > 0) {
                    return matchedSignatures[0].getReturnType();
                } else {
                    logger.info('Signature arguments count not matched.');
                }
            }
        } else if (ctx.ts.isElementAccessExpression(node)) {
            const nodeType = visit(node.expression);
            if (!nodeType) {
                return;
            }

            const indexType = getIndexType(node.argumentExpression);
            if (!indexType) {
                return;
            }

            if (indexType.flags & ctx.ts.TypeFlags.NumberLike) {
                return getNumberAccessType(nodeType, indexType);
            } else if (indexType.flags & ctx.ts.TypeFlags.StringLike) {
                return getStringAccessType(nodeType, indexType);
            } else {
                logger.info(
                    '[ElementAccess] nodeType:',
                    typeToString(ctx, nodeType),
                    ', indexType:',
                    typeToString(ctx, indexType),
                );
            }
        } else {
            logger.info('======<can not be here>=====');
        }
    }

    function getIndexType(expr: ts.Expression): ts.Type | undefined {
        if (ctx.ts.isLiteralExpression(expr)) {
            return getLiteralType(ctx, expr);
        } else {
            const syntaxNode = getMinSyntaxNode(ctx, minSyntaxNode.sourceFile, expr);
            if (!syntaxNode) {
                return;
            }

            if (ctx.ts.isLiteralExpression(syntaxNode.minNode)) {
                // 它只是表达的部分结果，所以不能直接返回 getLiteralType()。
                // 这里只需考虑 number 和 string 类型。
                if (ctx.ts.isNumericLiteral(syntaxNode.minNode)) {
                    return ctx.typeChecker.getNumberType();
                } else if (ctx.ts.isStringLiteral(syntaxNode.minNode)) {
                    return ctx.typeChecker.getStringType();
                }
            } else {
                return visit(syntaxNode.minNode);
            }
        }
    }

    function getNumberAccessType(nodeType: ts.Type, indexType: ts.Type): ts.Type | undefined {
        const index = indexType.isNumberLiteral() ? indexType.value : undefined;

        // tuple
        if (ctx.typeChecker.isTupleType(nodeType)) {
            const tupleElementTypes = getTypeArguments(ctx, nodeType as ts.TypeReference);
            if (Number.isInteger(index)) {
                return tupleElementTypes[index!];
            } else {
                // 返回元组所有元素类型的 union
                return createUnionType(ctx, tupleElementTypes);
            }
        }

        // array like
        if (ctx.typeChecker.isArrayLikeType(nodeType)) {
            const elementTypes = getTypeArguments(ctx, nodeType as ts.TypeReference);
            return elementTypes[0];
        }

        // nodeType is number index type
        const numberIndexType = nodeType.getNumberIndexType();
        if (numberIndexType) {
            return numberIndexType;
        }

        if (typeof index === 'number') {
            return getPropertyType(ctx, nodeType, index.toString());
        }
    }

    function getStringAccessType(nodeType: ts.Type, indexType: ts.Type): ts.Type | undefined {
        const stringIndexType = nodeType.getStringIndexType();
        if (stringIndexType) {
            return stringIndexType;
        }

        if (indexType.isStringLiteral()) {
            return getPropertyType(ctx, nodeType, indexType.value);
        }
    }
}

function getLiteralType(ctx: PluginContext, expr: ts.LiteralExpression): ts.Type | undefined {
    if (ctx.ts.isNumericLiteral(expr)) {
        return getNumberLiteralType(ctx, Number.parseInt(expr.text, 10));
    } else if (ctx.ts.isStringLiteral(expr)) {
        return ctx.typeChecker.getStringLiteralType(expr.text);
    } else if (expr.kind === ctx.ts.SyntaxKind.TrueKeyword) {
        return ctx.typeChecker.getTrueType();
    } else if (expr.kind === ctx.ts.SyntaxKind.FalseKeyword) {
        return ctx.typeChecker.getFalseType();
    } else if (expr.kind === ctx.ts.SyntaxKind.NullKeyword) {
        return ctx.typeChecker.getNullType();
    } else if (expr.kind === ctx.ts.SyntaxKind.UndefinedKeyword) {
        return ctx.typeChecker.getUndefinedType();
    } else if (expr.kind === ctx.ts.SyntaxKind.BigIntLiteral) {
        return ctx.typeChecker.getBigIntType();
    }
}

export function getExpressionSyntaxNode(ctx: PluginContext, prefix: string): SyntaxNodeInfo | undefined {
    const sourceFile = createTmpSourceFile(ctx, prefix);
    // 这里不需要再调用 getMinSyntaxNode 来处理了，请求发送过来的 prefix 已经处理成最小节点了。
    const statement = sourceFile.statements[0];
    if (ctx.ts.isExpressionStatement(statement)) {
        return { sourceFile, minNode: statement.expression };
    }
}

/**
 * 获取用于补全的最小语法节点。举例：
 *
 * 字段访问
 * ctrl. -> ctrl.
 * ctrl.a.b. -> ctrl.a.b.
 * ctrl.a['b']. -> ctrl.a['b'].
 * ctrl.a[ctrl.prefix + 'b']. -> ctrl.a[ctrl.prefix + 'b'].
 *
 * 数组访问
 * [ctrl.b.c. -> ctrl.b.c.
 * [1 + ctrl.b.c. -> [1 + ctrl.b.c.
 *
 * 数组值
 * [ctrl.b.c. -> ctrl.b.c.
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
 * 多语句
 * ctrl.a = ctrl.b.c; ctrl.d. -> ctrl.d.
 *
 * 字面量
 * 1 -> 1
 * 'a' -> 'a'
 * 注意, 不支持下面的语句：
 * 1.toString().
 * 'a'.toString().
 *
 * @param ctx 上下文
 * @param sourceFile 编译后的源文件
 * @returns 最小语法节点
 */
export function getMinSyntaxNode(
    ctx: PluginContext,
    sourceFile: ts.SourceFile,
    node: ts.Node,
): SyntaxNodeInfo | undefined {
    return visit(node);

    function visit(node: ts.Node): SyntaxNodeInfo | undefined {
        if (ctx.ts.isSourceFile(node)) {
            return visit(node.statements[node.statements.length - 1]);
        } else if (ctx.ts.isExpressionStatement(node)) {
            return visit(node.expression);
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
        } else if (ctx.ts.isArrayLiteralExpression(node)) {
            return visit(node.elements[node.elements.length - 1]);
        } else if (ctx.ts.isPropertyAccessExpression(node)) {
            return { sourceFile, minNode: node };
        } else if (ctx.ts.isLiteralExpression(node)) {
            return { sourceFile, minNode: node };
        }
        // 其他情况不支持
    }
}
