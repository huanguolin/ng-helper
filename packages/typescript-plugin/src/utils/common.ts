import { NgTypeInfo } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { PluginContext } from '../type';

export function createTmpSourceFile(ctx: PluginContext, codeText: string, name: string = 'tmp') {
    return ctx.ts.createSourceFile(`ng-helper///${name}.ts`, codeText, ctx.ts.ScriptTarget.ES5, false, ctx.ts.ScriptKind.JS);
}

export function getPropertyType(ctx: PluginContext, type: ts.Type, propertyName: string): ts.Type | undefined {
    if (isTypeOfType(ctx, type)) {
        return getPropertyTypeViaSymbol(ctx, type, propertyName);
    } else {
        return getPropertyTypeViaType(ctx, type, propertyName);
    }
    // TODO 联合类型处理
    // else if (type.isUnion()) {
    //     const list = type.types.map((x) => getPropertyType(ctx, x, propertyName)).filter((x) => !!x) as ts.Type[];
    //     if (list.length === type.types.length) {
    //         return createUnionType(ctx, list);
    //     }
    // }
}

export function createUnionType(ctx: PluginContext, types: ts.Type[]): ts.Type {
    // 创建一个临时的联合类型节点
    const unionTypeNode = ctx.ts.factory.createUnionTypeNode(
        types.map((type) => ctx.typeChecker.typeToTypeNode(type, undefined, ctx.ts.NodeBuilderFlags.None) as ts.TypeNode),
    );

    // 使用 typeChecker 获取这个节点的类型
    return ctx.typeChecker.getTypeFromTypeNode(unionTypeNode);
}

function getPropertyTypeViaSymbol(ctx: PluginContext, type: ts.Type, propertyName: string): ts.Type | undefined {
    const symbol = type.getSymbol();
    if (!symbol) {
        return;
    }

    const members = symbol.members;
    if (!members) {
        return;
    }

    const targetMemberSymbol = Array.from(members.values()).find((x) => x.getName() === propertyName);
    if (!targetMemberSymbol || !targetMemberSymbol.valueDeclaration) {
        return;
    }

    // 排除非公开的
    const modifiers = ctx.ts.getCombinedModifierFlags(targetMemberSymbol.valueDeclaration);
    if (modifiers & ctx.ts.ModifierFlags.NonPublicAccessibilityModifier) {
        return;
    }

    return ctx.typeChecker.getTypeOfSymbolAtLocation(targetMemberSymbol, targetMemberSymbol.valueDeclaration);
}

function getPropertyTypeViaType(ctx: PluginContext, type: ts.Type, propertyName: string): ts.Type | undefined {
    const symbol = type.getProperty(propertyName);
    if (!symbol || !symbol.valueDeclaration) {
        return;
    }

    // 排除非公开的
    const modifiers = ctx.ts.getCombinedModifierFlags(symbol.valueDeclaration);
    if (modifiers & ctx.ts.ModifierFlags.NonPublicAccessibilityModifier) {
        return;
    }

    return ctx.typeChecker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
}

/**
 * 判断类型是否是 typeof X。
 */
export function isTypeOfType(ctx: PluginContext, type: ts.Type): boolean {
    if (!type.symbol) {
        return false;
    }

    if (type.aliasTypeArguments) {
        return false;
    }

    return type !== ctx.typeChecker.getDeclaredTypeOfSymbol(type.symbol);
}

export function getSymbolDocument(ctx: PluginContext, symbol: ts.Symbol): string {
    return ctx.ts.displayPartsToString(symbol.getDocumentationComment(ctx.typeChecker));
}

export function getPublicMembersTypeInfoOfType(ctx: PluginContext, type: ts.Type): NgTypeInfo[] | undefined {
    if (isTypeOfType(ctx, type)) {
        return getPublicMembersTypeInfoViaSymbol(ctx, type);
    } else {
        return getPublicMembersTypeInfoViaType(ctx, type);
    }
}

function getPublicMembersTypeInfoViaSymbol(ctx: PluginContext, type: ts.Type): NgTypeInfo[] | undefined {
    const symbol = type.getSymbol();
    if (!symbol) {
        return;
    }

    const members = symbol.members;
    if (!members) {
        return;
    }

    const result = Array.from(members.values())
        .map((x) => buildTypeInfo(ctx, x))
        .filter((x) => !!x) as NgTypeInfo[];
    return result;
}

function getPublicMembersTypeInfoViaType(ctx: PluginContext, type: ts.Type): NgTypeInfo[] | undefined {
    const result = type
        .getApparentProperties()
        .map((x) => buildTypeInfo(ctx, x))
        .filter((x) => !!x) as NgTypeInfo[];
    return result;
}

function buildTypeInfo(ctx: PluginContext, memberSymbol: ts.Symbol): NgTypeInfo | undefined {
    if (!memberSymbol.valueDeclaration) {
        return;
    }

    const modifiers = ctx.ts.getCombinedModifierFlags(memberSymbol.valueDeclaration);
    if (modifiers & ctx.ts.ModifierFlags.NonPublicAccessibilityModifier) {
        return;
    }

    const memberName = memberSymbol.getName();
    // angular.js 内部方法属性过滤掉
    // js 内部方法属性以 __ 开头的
    if (memberName.startsWith('$') || memberName.startsWith('__')) {
        return;
    }

    const memberType = ctx.typeChecker.getTypeOfSymbolAtLocation(memberSymbol, memberSymbol.valueDeclaration);
    if (memberSymbol.flags & (ctx.ts.SymbolFlags.Method | ctx.ts.SymbolFlags.Function | ctx.ts.SymbolFlags.Property)) {
        const item: NgTypeInfo = {
            kind: 'property',
            name: memberName,
            typeString: ctx.typeChecker.typeToString(memberType),
            document: getSymbolDocument(ctx, memberSymbol),
        };
        if (memberSymbol.flags & ctx.ts.SymbolFlags.Property) {
            return item;
        }

        let paramNames: string[] = [];
        let returnType = 'unknown';
        const signatures = memberType.getCallSignatures();
        if (signatures.length > 0) {
            const signature = signatures[0];
            paramNames = signature.parameters.map((x) => x.getName());
            returnType = ctx.typeChecker.typeToString(signature.getReturnType());
        }
        return {
            ...item,
            kind: 'method',
            paramNames,
            returnType,
        };
    }
}

export function typeToString(ctx: PluginContext, type?: ts.Type): string | undefined {
    return type ? ctx.typeChecker.typeToString(type) : undefined;
}

export function isCommaListExpression(ctx: PluginContext, node: ts.Node): node is ts.CommaListExpression {
    if (typeof ctx.ts.isCommaListExpression === 'function') {
        return ctx.ts.isCommaListExpression(node);
    }

    if (ctx.ts.isBinaryExpression(node)) {
        return node.operatorToken.kind === ctx.ts.SyntaxKind.CommaToken;
    }
    return false;
}

export function findClassDeclaration(ctx: PluginContext, node: ts.Node): ts.ClassDeclaration | undefined {
    if (ctx.ts.isClassDeclaration(node)) {
        return node;
    }

    return node.forEachChild((child: ts.Node) => findClassDeclaration(ctx, child));
}
