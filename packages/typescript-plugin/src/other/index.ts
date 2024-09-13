import type { NgComponentsStringAttrsResponse, NgListComponentsStringAttrsRequest } from '@ng-helper/shared/lib/plugin';

import { getCtxOfCoreCtx, ngHelperServer } from '../ngHelperServer';
import type { CorePluginContext } from '../type';
import { getComponentDeclareLiteralNode, getComponentTypeInfo, isStringBinding, removeBindingControlChars } from '../utils/ng';

type ComponentDirectivePathInfo = {
    type: 'component' | 'directive';
    /**
     * component or directive name.
     */
    name: string;
    filePath: string;
};

export function getComponentsStringAttrsInfo(
    coreCtx: CorePluginContext,
    { fileName, componentNames }: NgListComponentsStringAttrsRequest,
): NgComponentsStringAttrsResponse {
    ngHelperServer.refreshInternalMaps(fileName);

    const componentDirectiveMap = ngHelperServer.getComponentDirectiveMap(fileName);
    if (!componentDirectiveMap) {
        return;
    }

    const componentNameMap = new Map<string, ComponentDirectivePathInfo>();
    for (const [filePath, componentDirectiveInfo] of componentDirectiveMap) {
        for (const component of componentDirectiveInfo.components) {
            componentNameMap.set(component.componentName, { type: 'component', name: component.componentName, filePath });
        }
        for (const directive of componentDirectiveInfo.directives) {
            componentNameMap.set(directive.directiveName, { type: 'directive', name: directive.directiveName, filePath });
        }
    }

    const result: Record<string, string[]> = {};
    for (const componentName of componentNames) {
        if (componentNameMap.has(componentName)) {
            const info = componentNameMap.get(componentName)!;
            const bindings = getBindings(info);

            const attrs: string[] = [];
            if (bindings) {
                for (const [k, v] of bindings) {
                    // is string
                    if (isStringBinding(v)) {
                        const attrName = removeBindingControlChars(v).trim() || k;
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

    function getBindings({ type, name, filePath }: ComponentDirectivePathInfo) {
        const ctx = getCtxOfCoreCtx(coreCtx, filePath);
        if (!ctx) {
            return;
        }

        if (type === 'component') {
            const componentLiteralNode = getComponentDeclareLiteralNode(ctx, name);
            if (!componentLiteralNode) {
                return;
            }

            const info = getComponentTypeInfo(ctx, componentLiteralNode);
            return info.bindings;
        } else {
            // TODO directive
        }
    }
}
