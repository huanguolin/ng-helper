import type ts from "typescript";
import { PluginContext, SyntaxNodeInfo } from "./type";
import { NgCompletionResponse, NgCompletionResponseItem } from "@ng-helper/shared/lib/plugin";
import assert from "assert";

/**
 * 依据起始类型（根类型）和最小语法节点，获取用于补全的类型。
 * @param ctx 上下文
 * @param rootType 根类型
 * @param minSyntaxNode 查找目标类型的最小语法节点
 * @returns 目标类型
 */
export function getCompletionType(ctx: PluginContext, rootType: ts.Type, minSyntaxNode: SyntaxNodeInfo): ts.Type | undefined {

    assert(ctx.ts.isPropertyAccessExpression(minSyntaxNode.node), 'minSyntaxNode.node must be PropertyAccessExpression!');

    return visit(minSyntaxNode.node);

    function visit(node: ts.Node): ts.Type | undefined {
        if (ctx.ts.isPropertyAccessExpression(node)) {
            if (ctx.ts.isIdentifier(node.expression)) {
                return getPropertyType(ctx, rootType, node.name.text);
            } else {
                return visit(node.expression);
            }
        } else if (ctx.ts.isElementAccessExpression(node)) {
            const nodeType = visit(node.expression);
            if (!nodeType) return;

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
        } else if (ctx.ts.isCallExpression(node)) {
            const nodeType = visit(node.expression);
            if (!nodeType) return;

            const fnTypes = nodeType.getCallSignatures();
            if (fnTypes.length > 0) {
                return fnTypes[0].getReturnType();
            }
        }
    }
}

export function getPropertyType(ctx: PluginContext, type: ts.Type, propertyName: string): ts.Type | undefined {
    const symbol = type.getProperty(propertyName);
    if (!symbol || !symbol.valueDeclaration) return;

    // 排除非公开的
    const modifiers = ctx.ts.getCombinedModifierFlags(symbol.valueDeclaration);
    if (modifiers & ctx.ts.ModifierFlags.Private || modifiers & ctx.ts.ModifierFlags.Protected) {
        return;
    }

    return ctx.typeChecker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
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
    const sourceFile = ctx.ts.createSourceFile(
        'ng-helper///prefix.ts',
        prefix,
        ctx.ts.ScriptTarget.ES5,
        false,
        ctx.ts.ScriptKind.JS);
    return visit(sourceFile);

    function visit(node: ts.Node): SyntaxNodeInfo | undefined {
        if (ctx.ts.isSourceFile(node)) {
            return visit(node.statements[node.statements.length-1]);
        } else if (ctx.ts.isExpressionStatement(node)) {
            return visit(node.expression);
        } else if (ctx.ts.isCommaListExpression(node)) {
            return visit(node.elements[node.elements.length-1]);
        } else if (ctx.ts.isBinaryExpression(node)) {
            return visit(node.right);
        } else if (ctx.ts.isPrefixUnaryExpression(node)) {
            return visit(node.operand);
        } else if (ctx.ts.isParenthesizedExpression(node)) {
            return visit(node.expression);
        } else if (ctx.ts.isObjectLiteralExpression(node)) {
            return visit(node.properties[node.properties.length-1]);
        } else if (ctx.ts.isPropertyAssignment(node)) {
            return visit(node.initializer);
        } else if (ctx.ts.isCallExpression(node)) {
            return visit(node.arguments[node.arguments.length-1]);
        } else if (ctx.ts.isElementAccessExpression(node)) {
            return visit(node.argumentExpression);
        } else if (ctx.ts.isPropertyAccessExpression(node)) {
            return { sourceFile, node };
        }
        // 其他情况不支持
    }
}

export function buildCompletionFromBindings(ctx: PluginContext, bindingsMap: Map<string, string>): NgCompletionResponse {
    if (!bindingsMap.size) {
        return;
    }

    const result: NgCompletionResponseItem[] = [];
    for (const [k, v] of bindingsMap) {
        const typeInfo = getBindType(v);
        result.push({
            kind: typeInfo.type === 'function' ? 'method' : 'property',
            name: k,
            typeInfo: typeInfo.typeString,
            document: `bindings config: ${v}`,
        });
    }
    return result;

    function getBindType(s: string) {
        const result: {
            type: 'unknown' | 'string' | 'function';
            optional: boolean;
            typeString: string;
        } = {
            type: 'unknown',
            optional: s.includes('?'),
            typeString: 'unknown',
        };

        if (s.includes('@')) {
            result.type = 'string';
            result.typeString = 'string';
        } else if (s.includes('&')) {
            result.type = 'function';
            result.typeString = '(...args: unknown[]) => unknown';
        }

        return result;
    }
}

export function buildCompletionFromPublicMembers(ctx: PluginContext, type: ts.Type): NgCompletionResponse {
    const symbol = type.getSymbol();
    if (symbol) {
        const members = symbol.members;

        if (members) {
            const result: NgCompletionResponseItem[] = [];

            members.forEach(member => {
                if (!member.valueDeclaration) {
                    return;
                }

                const modifiers = ctx.ts.getCombinedModifierFlags(member.valueDeclaration);
                if (modifiers & ctx.ts.ModifierFlags.Private || modifiers & ctx.ts.ModifierFlags.Protected) {
                    return;
                }

                if (member.flags & ctx.ts.SymbolFlags.Method || member.flags & ctx.ts.SymbolFlags.Property) {
                    const memberName = member.getName();

                    // angular.js 内部方法属性过滤掉
                    if (memberName.startsWith('$')) {
                        return;
                    }

                    const memberType = ctx.typeChecker.getTypeOfSymbolAtLocation(member, member.valueDeclaration);
                    const memberTypeString = ctx.typeChecker.typeToString(memberType);
                    result.push({
                        kind: member.flags & ctx.ts.SymbolFlags.Method ? 'method' : 'property',
                        name: memberName,
                        typeInfo: memberTypeString,
                        document: getSymbolDocument(ctx, member),
                    });
                }
            });

            return result;
        }
    }
}

export function getSymbolDocument(ctx: PluginContext, symbol: ts.Symbol): string {
    return ctx.ts.displayPartsToString(symbol.getDocumentationComment(ctx.typeChecker));
}

const LOG_PREFIX = '[@ng-helper/typescript-plugin]';
export function buildLogMsg(...args: any[]): string {
    const arr = args.map(x => x && typeof x === 'object' ? JSON.stringify(x) : x)
    arr.unshift(LOG_PREFIX);
    return arr.join(' ');
}
