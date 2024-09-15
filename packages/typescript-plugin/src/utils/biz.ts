import type { NgComponentDirectiveNamesInfo, NgDirectiveNameInfo, NgTypeInfo } from '@ng-helper/shared/lib/plugin';

import { getCtxOfCoreCtx } from '../ngHelperServer';
import type { CorePluginContext } from '../type';

import { getDirectiveConfigNode, getObjLiteral, getPropValueByName, getTypeInfoOfDirectiveScope, isAttributeDirective } from './ng';

export interface DirectiveFileInfo {
    filePath: string;
    directiveInfo: NgDirectiveNameInfo;
}

export function findMatchedDirectives(componentDirectiveMap: Map<string, NgComponentDirectiveNamesInfo>, attrNames: string[]): DirectiveFileInfo[] {
    const matchedDirectives: DirectiveFileInfo[] = [];
    const attrNamesSet = new Set(attrNames);
    for (const [filePath, value] of componentDirectiveMap.entries()) {
        for (const directive of value.directives) {
            if (isAttributeDirective(directive) && attrNamesSet.has(directive.directiveName)) {
                matchedDirectives.push({ filePath, directiveInfo: directive });
            }
        }
    }
    return matchedDirectives;
}

export function getDirectivesUsableAsAttributes(componentDirectiveMap: Map<string, NgComponentDirectiveNamesInfo>): DirectiveFileInfo[] {
    const directives: DirectiveFileInfo[] = [];
    for (const [filePath, value] of componentDirectiveMap.entries()) {
        for (const directive of value.directives) {
            if (isAttributeDirective(directive)) {
                directives.push({ filePath, directiveInfo: directive });
            }
        }
    }
    return directives;
}

export function getTypeInfosFromDirectiveScope(coreCtx: CorePluginContext, directiveFileInfo: DirectiveFileInfo): NgTypeInfo[] | undefined {
    const { filePath, directiveInfo } = directiveFileInfo;
    const ctx = getCtxOfCoreCtx(coreCtx, filePath);
    if (!ctx) {
        return;
    }

    const directiveConfigNode = getDirectiveConfigNode(ctx, directiveInfo.directiveName);
    if (!directiveConfigNode) {
        return;
    }

    const scopePropertyValue = getPropValueByName(ctx, directiveConfigNode, 'scope');
    if (!scopePropertyValue || !ctx.ts.isObjectLiteralExpression(scopePropertyValue)) {
        return;
    }

    const obj = getObjLiteral(ctx, scopePropertyValue);
    const map = new Map<string, string>(Object.entries(obj));
    return getTypeInfoOfDirectiveScope(ctx, map);
}
