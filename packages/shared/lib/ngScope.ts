import type { NgAttrName } from '@ng-helper/ng-parser/src/types';

import type { CursorAtContext } from './cursorAt';
import { ngParse } from './ngParse';

export interface NgScopeVar {
    kind: 'itemValue' | 'itemKey' | 'as';
    name: string;
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
    if (p.config?.as?.value) {
        result.push({ kind: 'as', name: p.config.as.value });
    }
    return result;
}

function getNgRepeatScope(contextStr: string): NgScopeVar[] {
    const result: NgScopeVar[] = [];
    const p = ngParse(contextStr, 'ng-repeat');

    if (p.config?.itemKey?.value) {
        result.push({ kind: 'itemKey', name: p.config.itemKey.value });
    }

    if (p.config?.itemValue?.value) {
        result.push({ kind: 'itemValue', name: p.config.itemValue.value });
    }

    if (p.config?.as?.value) {
        result.push({ kind: 'as', name: p.config.as.value });
    }

    return result;
}
