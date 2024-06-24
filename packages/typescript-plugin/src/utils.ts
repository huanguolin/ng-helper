import type ts from "typescript";
import { PluginContext } from "./type";
import { CompletionResponse, CompletionResponseItem } from "@ng-helper/shared/lib/plugin";

export function listPublicMembers(ctx: PluginContext, type: ts.Type): CompletionResponse {
    const symbol = type.getSymbol();
    if (symbol) {
        const members = symbol.members;

        if (members) {
            const result: CompletionResponseItem[] = [];
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
    return undefined;
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
