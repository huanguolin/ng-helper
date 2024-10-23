import type { NgComponentsStringAttrsResponse, NgListComponentsStringAttrsRequest } from '@ng-helper/shared/lib/plugin';

import { ngHelperServer } from '../ngHelperServer';
import type { CorePluginContext } from '../type';
import { removeBindingControlChars } from '../utils/ng';

export function getComponentsStringAttrsInfo(
    coreCtx: CorePluginContext,
    { fileName, componentNames }: NgListComponentsStringAttrsRequest,
): NgComponentsStringAttrsResponse {
    const logger = coreCtx.logger.prefix('getComponentsStringAttrsInfo()');

    const cache = ngHelperServer.getCache(fileName);
    if (!cache) {
        logger.info(`cache not found for file(${fileName})!`);
        return;
    }

    const componentMap = cache.getComponentMap();
    const directiveMap = cache.getDirectiveMap();

    const result: Record<string, string[]> = {};
    for (const componentName of componentNames) {
        if (componentMap.has(componentName)) {
            const componentInfo = componentMap.get(componentName)!;
            const bindingNames = componentInfo.bindings.map((x) => removeBindingControlChars(x.value).trim() || x.name);
            if (bindingNames.length > 0) {
                result[componentName] = bindingNames;
            }
        } else if (directiveMap.has(componentName)) {
            const directiveInfo = directiveMap.get(componentName)!;
            const bindingNames = directiveInfo.scope.map((x) => removeBindingControlChars(x.value).trim() || x.name);
            if (bindingNames.length > 0) {
                result[componentName] = bindingNames;
            }
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}
