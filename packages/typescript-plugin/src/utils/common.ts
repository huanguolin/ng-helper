import { NgTypeInfo } from '@ng-helper/shared/lib/plugin';
// eslint-disable-next-line no-restricted-imports
import ts from 'typescript';

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
 * TODO: 目前判断的不太严谨。
 */
export function isTypeOfType(ctx: PluginContext, type: ts.Type): boolean {
    if (!type.symbol) {
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
        return {
            ...item,
            kind: 'function',
            paramNames: [], // TODO
            returnType: 'unknown', // TODO
        };
    }
}
