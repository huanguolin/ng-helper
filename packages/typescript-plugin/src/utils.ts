import type ts from "typescript";
import { PluginContext, PrefixItem } from "./type";
import { NgCompletionResponse, NgCompletionResponseItem } from "@ng-helper/shared/lib/plugin";

/**
 * 获取用于补全的最小语法节点。
 * 举例：
 * ctrl -> ctrl
 * ctrl.a.b -> ctrl.a.b
 * 
 * @param prefix 
 * @returns 
//  */
// export function getMinSyntaxNodeForCompletion(prefix: string): ts.Node | undefined {
    
// }

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
