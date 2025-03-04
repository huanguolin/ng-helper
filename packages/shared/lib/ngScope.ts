import { type Identifier, type PropertyAccessExpression } from '@ng-helper/ng-parser/src/parser/node';
import { SyntaxKind, type NgAttrName } from '@ng-helper/ng-parser/src/types';

import type { CursorAtContext } from './cursorAt';
import { ngParse } from './ngParse';

export interface NgScopeVar {
    kind: 'key' | 'value' | 'item' | 'as';
    name: string;
    replaceTo?: string;
    typeString?: string;
}

export interface NgScope {
    kind: NgAttrName;
    vars: NgScopeVar[];
}

export function getNgScopes(context: CursorAtContext[]) {
    const scopes: NgScope[] = [];
    for (const ctx of context) {
        if (ctx.kind === 'ng-controller') {
            scopes.push({
                kind: ctx.kind,
                vars: getNgControllerScope(ctx.value),
            });
        } else if (ctx.kind === 'ng-repeat') {
            scopes.push({
                kind: ctx.kind,
                vars: getNgRepeatScope(ctx.value),
            });
        }
    }

    return scopes;
}

function getNgControllerScope(contextStr: string): NgScopeVar[] {
    const result: NgScopeVar[] = [];
    const p = ngParse(contextStr, 'ng-controller');

    // 不同于其他地方，这里一旦有错误，就返回空数组
    if (p.errors.length > 0) {
        return result;
    }

    if (p.config?.as?.value) {
        result.push({ kind: 'as', name: p.config.as.value });
    }
    return result;
}

function getNgRepeatScope(contextStr: string): NgScopeVar[] {
    const result: NgScopeVar[] = [];
    const p = ngParse(contextStr, 'ng-repeat');

    // 不同于其他地方，这里一旦有错误，就返回空数组
    if (p.errors.length > 0) {
        return result;
    }

    if (p.config?.itemKey?.value) {
        result.push({ kind: 'key', name: p.config.itemKey.value });
    }

    if (p.config?.itemValue?.value) {
        const isArray = p.config.mode === 'array';
        const scopeVar: NgScopeVar = {
            kind: isArray ? 'item' : 'value',
            name: p.config.itemValue.value,
        };
        // 目前只考虑数组的情况
        if (isArray) {
            const arrayExpr = p.config.items;
            const exprStr = contextStr.slice(arrayExpr.start, arrayExpr.end);
            scopeVar.replaceTo =
                arrayExpr.is<PropertyAccessExpression>(SyntaxKind.PropertyAccessExpression) ||
                arrayExpr.is<Identifier>(SyntaxKind.Identifier)
                    ? `${exprStr}[0]`
                    : `(${exprStr})[0]`;
            // $first, $middle, $last, $even, $odd
            ['$first', '$middle', '$last', '$even', '$odd'].forEach((name) => {
                result.push({ kind: 'item', name, replaceTo: scopeVar.replaceTo });
            });
            // $index
            result.push({ kind: 'item', name: '$index', typeString: 'number' });
        }
        result.push(scopeVar);
    }

    if (p.config?.as?.value) {
        result.push({ kind: 'as', name: p.config.as.value });
    }

    return result;
}
