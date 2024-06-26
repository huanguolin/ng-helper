import type ts from "typescript";
import { PluginContext, PrefixItem } from "./type";
import { NgCompletionResponse, NgCompletionResponseItem } from "@ng-helper/shared/lib/plugin";

export function scanPrefix(prefix: string): PrefixItem[] {
    // TODO 要考虑的情况有
    // 对象访问 ctrl.a.
    // 函数调用1 ctrl.b(1, ctrl.c). 特殊处理，判断点前面有右括号 ')'
    // 函数调用2 ctrl.b(1, ctrl.c).m. 复杂 case 暂不处理
    // 函数调用3 ctrl.g(ctrl.h, ctrl.i.
    // 函数调用4 ctrl.g({ a: ctrl.i.
    // 数组访问1 ctrl.d[0].
    // 数组访问2 ctrl.d[ctrl.j]. 特殊处理，判断点前面有右括号 ']'
    // 数组访问3 ctrl.d[1 + ctrl.i]. 特殊处理，判断点前面有右括号 ']'
    // 数组访问4 ctrl.d[ctrl.
    // 数组访问4 ctrl.d[1 + ctrl.i].m. 复杂 case 暂不处理
    // 二元运算符 ctrl.e + ctrl.f.
    // 三元表达式 ctrl.j ? ctrl.k : ctrl.l.
    // filter (ctrl.m + 'abc') | xxx
    // repeat item in ctrl.n.
    //
    // 特殊处理点前 ）和 ] 的情况，复杂情况暂不对应
    // 其他情况使用分割符分割，分隔符包括：空白符、逗号、冒号、【二元操作符(含=)】、！、大括号、小括号、中括号、？
    return [];
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
