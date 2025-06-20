import type {
    NgAllComponentsExpressionAttrsResponse,
    NgComponentsAttrsResponse,
    NgDirectivesAttrsResponse,
    NgListComponentsAttrsRequest,
    NgListDirectivesAttrsRequest,
} from '@ng-helper/shared/lib/plugin';

import { ngHelperTsService } from '../ngHelperTsService';
import type { ComponentInfo, DirectiveInfo } from '../ngHelperTsService/ngCache';
import type { CorePluginContext } from '../type';
import { getBindingName, isAttributeDirective, isStringBinding } from '../utils/ng';

// 用于 html 中组件的语义颜色高亮
export function getComponentsStringAttrsInfo(
    coreCtx: CorePluginContext,
    { fileName, componentNames }: NgListComponentsAttrsRequest,
): NgComponentsAttrsResponse {
    const logger = coreCtx.logger.prefix('getComponentsStringAttrsInfo()');

    const cache = ngHelperTsService.getCache(fileName);
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
            const bindingNames = componentInfo.bindings
                .filter((x) => isStringBinding(x.value))
                .map((x) => getBindingName(x));
            if (bindingNames.length > 0) {
                result[componentName] = bindingNames;
            }
        } else if (directiveMap.has(componentName)) {
            const directiveInfo = directiveMap.get(componentName)!;
            const bindingNames = directiveInfo.scope
                .filter((x) => isStringBinding(x.value))
                .map((x) => getBindingName(x));
            if (bindingNames.length > 0) {
                result[componentName] = bindingNames;
            }
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

// 用于 html diagnostic
export function getComponentsExpressionAttrsInfo(
    coreCtx: CorePluginContext,
    { fileName, componentNames }: NgListComponentsAttrsRequest,
): NgComponentsAttrsResponse {
    const logger = coreCtx.logger.prefix('getComponentsExpressionAttrsInfo()');

    const cache = ngHelperTsService.getCache(fileName);
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
            const bindingNames = componentInfo.bindings
                .filter((x) => !isStringBinding(x.value))
                .map((x) => getBindingName(x));
            if (bindingNames.length > 0) {
                result[componentName] = bindingNames;
            }
        } else if (directiveMap.has(componentName)) {
            const directiveInfo = directiveMap.get(componentName)!;
            const bindingNames = directiveInfo.scope
                .filter((x) => !isStringBinding(x.value))
                .map((x) => getBindingName(x));
            if (bindingNames.length > 0) {
                result[componentName] = bindingNames;
            }
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

// 用于 html 中组件的语义颜色高亮
export function getDirectivesStringAttrsInfo(
    coreCtx: CorePluginContext,
    { fileName, maybeDirectiveNames }: NgListDirectivesAttrsRequest,
): NgDirectivesAttrsResponse {
    const logger = coreCtx.logger.prefix('getDirectivesStringAttrsInfo()');

    const cache = ngHelperTsService.getCache(fileName);
    if (!cache) {
        logger.info(`cache not found for file(${fileName})!`);
        return;
    }

    const directiveMap = cache.getDirectiveMap();

    const result: Record<string, string[]> = {};
    for (const maybeDirectiveName of maybeDirectiveNames) {
        const directiveInfo = directiveMap.get(maybeDirectiveName)!;
        if (directiveInfo && isAttributeDirective(directiveInfo)) {
            const bindingNames = directiveInfo.scope
                .filter((x) => isStringBinding(x.value))
                .map((x) => getBindingName(x));
            if (bindingNames.length > 0) {
                result[maybeDirectiveName] = bindingNames;
            }
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

// 用于 html diagnostic
export function getDirectivesExpressionAttrsInfo(
    coreCtx: CorePluginContext,
    { fileName, maybeDirectiveNames }: NgListDirectivesAttrsRequest,
): NgDirectivesAttrsResponse {
    const logger = coreCtx.logger.prefix('getDirectivesExpressionAttrsInfo()');

    const cache = ngHelperTsService.getCache(fileName);
    if (!cache) {
        logger.info(`cache not found for file(${fileName})!`);
        return;
    }

    const directiveMap = cache.getDirectiveMap();

    const result: Record<string, string[]> = {};
    for (const maybeDirectiveName of maybeDirectiveNames) {
        const directiveInfo = directiveMap.get(maybeDirectiveName)!;
        if (directiveInfo && isAttributeDirective(directiveInfo)) {
            const bindingNames = directiveInfo.scope
                .filter((x) => !isStringBinding(x.value))
                .map((x) => getBindingName(x));
            if (bindingNames.length > 0) {
                result[maybeDirectiveName] = bindingNames;
            }
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

export function getAllComponentsExpressionAttrsInfo(coreCtx: CorePluginContext) {
    const logger = coreCtx.logger.prefix('getAllComponentsExpressionAttrsInfo()');

    const config = ngHelperTsService.getConfig();
    if (!config) {
        logger.info('config not found!');
        return;
    }

    const projectRoots = config.projectMappings?.map((x) => x.ngProjectPath) ?? [];
    if (projectRoots.length === 0) {
        logger.info('projectRoots not found!');
        return;
    }

    const result: NgAllComponentsExpressionAttrsResponse = {};
    for (const projectRoot of projectRoots) {
        const cache = ngHelperTsService.getCache(projectRoot);
        if (!cache) {
            logger.info(`cache not found for projectRoot(${projectRoot})!`);
            continue;
        }

        // 先初始化，否则后面使用会报错
        result[projectRoot] = {};

        addExpressionAttrs(projectRoot, true, cache.getComponentMap());
        addExpressionAttrs(projectRoot, false, cache.getDirectiveMap());
    }

    return result;

    function addExpressionAttrs(
        projectRoot: string,
        isComponent: boolean,
        map: Map<string, ComponentInfo | DirectiveInfo>,
    ) {
        const logger = coreCtx.logger.prefix('addExpressionAttrs()');
        logger.startGroup();
        try {
            for (const [name, info] of map) {
                const exprAttrNames = isComponent
                    ? (info as ComponentInfo).bindings
                          .filter((x) => !isStringBinding(x.value))
                          .map((x) => getBindingName(x))
                    : (info as DirectiveInfo).scope
                          .filter((x) => !isStringBinding(x.value))
                          .map((x) => getBindingName(x));
                if (exprAttrNames.length > 0) {
                    result[projectRoot][name] = exprAttrNames;
                }
            }
        } catch (error) {
            logger.error(`error: ${error as string}`);
        } finally {
            logger.endGroup();
        }
    }
}
