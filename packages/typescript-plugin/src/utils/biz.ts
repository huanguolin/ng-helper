import type { NgTypeInfo } from '@ng-helper/shared/lib/plugin';

import type { DirectiveInfo, NgCache } from '../ngHelperServer/ngCache';
import { getCtxOfCoreCtx } from '../ngHelperServer/utils';
import type { CorePluginContext } from '../type';

import { getTypeInfoOfDirectiveScope, isAttributeDirective } from './ng';

/**
 * 查找匹配的指令（属性形式）
 * @param cache 缓存
 * @param attrNames 属性名数组
 * @returns 匹配的指令数组
 */
export function findMatchedDirectives(cache: NgCache, attrNames: string[]): DirectiveInfo[] {
    const matchedDirectives: DirectiveInfo[] = [];

    const directiveMap = cache.getDirectiveMap();
    for (const attrName of attrNames) {
        const directiveInfo = directiveMap.get(attrName);
        if (directiveInfo && isAttributeDirective(directiveInfo)) {
            matchedDirectives.push(directiveInfo);
        }
    }
    return matchedDirectives;
}

/**
 * 获取所有可作为属性的指令
 * @param cache 缓存
 * @returns 指令数组
 */
export function getDirectivesUsableAsAttributes(cache: NgCache): DirectiveInfo[] {
    const directives: DirectiveInfo[] = [];
    for (const value of cache.getDirectiveMap().values()) {
        if (isAttributeDirective(value)) {
            directives.push(value);
        }
    }
    return directives;
}

export function getTypeInfosFromDirectiveScope(coreCtx: CorePluginContext, directiveInfo: DirectiveInfo): NgTypeInfo[] | undefined {
    const ctx = getCtxOfCoreCtx(coreCtx, directiveInfo.filePath);
    if (!ctx) {
        return;
    }
    return getTypeInfoOfDirectiveScope(ctx, directiveInfo.scope);
}
