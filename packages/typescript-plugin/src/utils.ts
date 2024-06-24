import type ts from "typescript";
import { PluginContext } from "./type";

export function listPublicMembers(ctx: PluginContext, type: ts.Type): string[] | undefined {
    const symbol = type.getSymbol();
    if (symbol) {
        const members = symbol.members;

        if (members) {
            const result: string[] = [];
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
                    const memberType = ctx.typeChecker.getTypeOfSymbolAtLocation(member, member.valueDeclaration);
                    const memberTypeString = ctx.typeChecker.typeToString(memberType);
                    if (member.flags & ctx.ts.SymbolFlags.Method) {
                        result.push(`Method: ${memberName}: ${memberTypeString}`);
                    } else {
                        result.push(`Property: ${memberName}: ${memberTypeString}`);
                    }
                }
            });
            return result;
        }
    }
    return undefined;
}

const LOG_PREFIX = '[@ng-helper/typescript-plugin]';
export function buildLogMsg(...args: any[]): string {
    const arr = args.map(x => x && typeof x === 'object' ? JSON.stringify(x) : x)
    arr.unshift(LOG_PREFIX);
    return arr.join(' ');
}
