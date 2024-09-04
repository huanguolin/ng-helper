import type { NgComponentsStringAttrsResponse, NgListComponentsStringAttrsRequest } from '@ng-helper/shared/lib/plugin';

import { getCtxOfCoreCtx, ngHelperServer } from '../ngHelperServer';
import type { CorePluginContext } from '../type';
import { getComponentDeclareLiteralNode, getComponentTypeInfo } from '../utils/ng';

export function getComponentsStringAttrsInfo(
    coreCtx: CorePluginContext,
    { fileName, componentNames }: NgListComponentsStringAttrsRequest,
): NgComponentsStringAttrsResponse {
    ngHelperServer.refreshInternalMaps(fileName);

    const componentMap = ngHelperServer.getComponentMap(fileName);
    if (!componentMap) {
        return;
    }

    const componentNameMap = new Map(Array.from(componentMap).map(([k, v]) => [v.componentName, k]));

    const result: Record<string, string[]> = {};
    for (const componentName of componentNames) {
        if (componentNameMap.has(componentName)) {
            const componentFilePath = componentNameMap.get(componentName)!;
            const bindings = getBindings(componentFilePath);

            const attrs: string[] = [];
            if (bindings) {
                for (const [k, v] of bindings) {
                    // is string
                    if (v.includes('@')) {
                        const attrName = v.replace(/[@\\?]/g, '') || k;
                        attrs.push(attrName);
                    }
                }
            }

            if (attrs.length) {
                result[componentName] = attrs;
            }
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;

    function getBindings(componentFilePath: string) {
        const ctx = getCtxOfCoreCtx(coreCtx, componentFilePath);
        if (!ctx) {
            return;
        }

        const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
        if (!componentLiteralNode) {
            return;
        }

        const info = getComponentTypeInfo(ctx, componentLiteralNode);
        return info.bindings;
    }
}
