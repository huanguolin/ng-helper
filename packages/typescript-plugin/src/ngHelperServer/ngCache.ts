import type ts from 'typescript';

import type { GetCoreContextFn, FileVersion, PluginContext } from '../type';
import { getPropByName, getPropValueByName, getSourceFileVersion } from '../utils/common';
import {
    getAngularDefineFunctionExpression,
    getAngularDefineFunctionReturnStatement,
    isAngularComponentRegisterNode,
    isAngularConstantRegisterNode,
    isAngularControllerRegisterNode,
    isAngularDirectiveRegisterNode,
    isAngularFactoryRegisterNode,
    isAngularFilterRegisterNode,
    isAngularModuleNode,
    isAngularProviderRegisterNode,
    isAngularServiceRegisterNode,
    isDtsFile,
} from '../utils/ng';

export interface FileCacheInfo extends FileVersion {
    isNgModule: boolean;
    components: string[];
    directives: string[];
    controllers: string[];
    filters: string[];
    /**
     * service/factory/provider/constant
     */
    services: string[];
    lastScanned: number;
}

export interface Location {
    start: number;
    end: number;
}

export interface Property {
    name: string;
    value: string;
    location: Location;
}

export interface Parameter {
    name: string;
    type: string;
    location: Location;
}

interface BaseInfo {
    name: string;
    filePath: string;
    location: Location;
}

export interface ComponentInfo extends BaseInfo {
    bindings: Property[];
    controllerAs: {
        value: string;
        location?: Location;
    };
    transclude?: boolean | Property[];
}

export interface DirectiveInfo extends BaseInfo {
    /**
     * E - Element name (default): <my-directive></my-directive>
     * A - Attribute (default): <div my-directive="exp"></div>
     * C - Class: <div class="my-directive: exp;"></div>
     * M - Comment: <!-- directive: my-directive exp -->
     */
    restrict: string;
    scope: Property[];
    transclude?: boolean | Property[];
    require?: string;
    replace?: boolean;
    priority?: number;
    terminal?: boolean;
}

export interface ControllerInfo extends BaseInfo {}

export interface FilterInfo extends BaseInfo {
    parameters: Parameter[];
}

export interface ServiceInfo extends BaseInfo {}

export interface NgCache {
    getComponentMap: () => Map<string, ComponentInfo>;
    getDirectiveMap: () => Map<string, DirectiveInfo>;
    getControllerMap: () => Map<string, ControllerInfo>;
    getFilterMap: () => Map<string, FilterInfo>;
    getServiceMap: () => Map<string, ServiceInfo>;
    getFileCacheMap: () => Map<string, FileCacheInfo>;
}

const REFRESH_THRESHOLDS = 1000; // 1s

export function buildCache(getCoreContext: GetCoreContextFn): NgCache {
    let lastRefreshed = 0;
    const fileCacheMap = new Map<string, FileCacheInfo>();
    const componentMap = new Map<string, ComponentInfo>();
    const directiveMap = new Map<string, DirectiveInfo>();
    const controllerMap = new Map<string, ControllerInfo>();
    const filterMap = new Map<string, FilterInfo>();
    const serviceMap = new Map<string, ServiceInfo>();

    return {
        getComponentMap: () => {
            refreshInternalMaps();
            return componentMap;
        },
        getDirectiveMap: () => {
            refreshInternalMaps();
            return directiveMap;
        },
        getControllerMap: () => {
            refreshInternalMaps();
            return controllerMap;
        },
        getFilterMap: () => {
            refreshInternalMaps();
            return filterMap;
        },
        getFileCacheMap: () => {
            refreshInternalMaps();
            return fileCacheMap;
        },
        getServiceMap: () => {
            refreshInternalMaps();
            return serviceMap;
        },
    };

    function refreshInternalMaps() {
        const diff = Date.now() - lastRefreshed;
        if (diff < REFRESH_THRESHOLDS) {
            // Skip refresh if less than REFRESH_THRESHOLDS ms has passed since last refresh
            return;
        }
        lastRefreshed = Date.now();
        const oldCacheFilesCount = fileCacheMap.size;
        const oldCompCnt = componentMap.size;
        const oldDirtCnt = directiveMap.size;
        const oldCtrlCnt = controllerMap.size;
        const oldFltrCnt = filterMap.size;
        const oldSrvCnt = serviceMap.size;

        const coreCtx = getCoreContext()!;

        const start = lastRefreshed;
        const scannedTs = lastRefreshed;
        let addedFilesCount = 0;
        let modifiedFilesCount = 0;
        let deletedFilesCount = 0;
        const logger = coreCtx.logger.prefix(`[${scannedTs.toString(36)}] refreshInternalMaps()`);
        logger.startGroup();

        const sourceFiles = coreCtx.program.getSourceFiles();
        logger.info(
            '>> srcFilesCnt:',
            sourceFiles.length,
            ', cacheFilesCnt:',
            oldCacheFilesCount,
            ', compCnt:',
            oldCompCnt,
            ', dirtCnt:',
            oldDirtCnt,
            ', ctrlCnt:',
            oldCtrlCnt,
            ', fltrCnt:',
            oldFltrCnt,
            ', oldSrvCnt',
            oldSrvCnt,
        );
        for (const sourceFile of sourceFiles) {
            const filePath = sourceFile.fileName;
            if (isDtsFile(filePath)) {
                continue;
            }

            const ctx = Object.assign({ sourceFile }, coreCtx);
            const fileCacheInfo = fileCacheMap.get(filePath);
            if (!fileCacheInfo) {
                // File add
                scanFile(ctx, scannedTs);
                addedFilesCount++;
            } else {
                fileCacheInfo.lastScanned = scannedTs;
                const version = getSourceFileVersion(sourceFile);
                if (fileCacheInfo.version === version) {
                    continue;
                }
                // File modify
                scanFile(ctx, scannedTs, fileCacheInfo);
                modifiedFilesCount++;
            }
        }

        deletedFilesCount = removeDeletedFiles(scannedTs);

        const end = Date.now();
        const cacheFilesDiff = fileCacheMap.size - oldCacheFilesCount;
        const compDiff = componentMap.size - oldCompCnt;
        const dirtDiff = directiveMap.size - oldDirtCnt;
        const ctrlDiff = controllerMap.size - oldCtrlCnt;
        const fltrDiff = filterMap.size - oldFltrCnt;
        const srvDiff = serviceMap.size - oldSrvCnt;

        const formatDiff = (diff: number) => `${diff >= 0 ? '+' : ''}${diff}`;

        logger.info(
            '<< diff: cacheFilesCnt:',
            formatDiff(cacheFilesDiff),
            `(A:${addedFilesCount}, M:${modifiedFilesCount}, D:${deletedFilesCount})`,
            ', compCnt:',
            formatDiff(compDiff),
            ', dirtCnt:',
            formatDiff(dirtDiff),
            ', ctrlCnt:',
            formatDiff(ctrlDiff),
            ', fltrCnt:',
            formatDiff(fltrDiff),
            ', srvCnt:',
            formatDiff(srvDiff),
            ', cost:',
            `${end - start}ms`,
        );
        logger.endGroup();
    }

    function scanFile(ctx: PluginContext, scannedTs: number, fileCacheInfo?: FileCacheInfo) {
        const logger = ctx.logger.prefix('scanFile()');

        if (fileCacheInfo && fileCacheInfo.isNgModule) {
            removeItemsFromAllMaps(fileCacheInfo, ctx.sourceFile.fileName);
        }

        let isNgModule = false;
        const components: ComponentInfo[] = [];
        const directives: DirectiveInfo[] = [];
        const controllers: ControllerInfo[] = [];
        const filters: FilterInfo[] = [];
        const services: ServiceInfo[] = [];
        scanNode(ctx.sourceFile);
        if (!isNgModule) {
            // 设置为空值，避免反复扫描这些文件。
            fileCacheMap.set(ctx.sourceFile.fileName, {
                isNgModule: false,
                version: getSourceFileVersion(ctx.sourceFile),
                components: [],
                directives: [],
                controllers: [],
                filters: [],
                services: [],
                lastScanned: scannedTs,
            });

            if (
                components.length > 0 ||
                directives.length > 0 ||
                controllers.length > 0 ||
                filters.length > 0 ||
                services.length > 0
            ) {
                logger.info(
                    'not ng module but got:',
                    components.length > 0 ? `components: ${components.map((c) => c.name).join(',')}` : '',
                    directives.length > 0 ? `directives: ${directives.map((d) => d.name).join(',')}` : '',
                    controllers.length > 0 ? `controllers: ${controllers.map((c) => c.name).join(',')}` : '',
                    filters.length > 0 ? `filters: ${filters.map((f) => f.name).join(',')}` : '',
                    services.length > 0 ? `services: ${services.map((s) => s.name).join(',')}` : '',
                    ', filePath:',
                    ctx.sourceFile.fileName,
                );
            }
            return;
        }

        fileCacheMap.set(ctx.sourceFile.fileName, {
            isNgModule: true,
            version: getSourceFileVersion(ctx.sourceFile),
            components: components.map((c) => c.name),
            directives: directives.map((d) => d.name),
            controllers: controllers.map((c) => c.name),
            filters: filters.map((f) => f.name),
            services: services.map((s) => s.name),
            lastScanned: scannedTs,
        });

        const mapsToSet = [
            { map: componentMap, items: components },
            { map: directiveMap, items: directives },
            { map: controllerMap, items: controllers },
            { map: filterMap, items: filters },
            { map: serviceMap, items: services },
        ];

        for (const { map, items } of mapsToSet) {
            for (const item of items) {
                map.set(item.name, item);
            }
        }

        function scanNode(node: ts.Node) {
            if (isAngularModuleNode(ctx, node)) {
                isNgModule = true;
            } else if (isAngularComponentRegisterNode(ctx, node)) {
                const componentInfo = getComponentInfo(ctx, node);
                if (componentInfo) {
                    components.push(componentInfo);
                }
            } else if (isAngularDirectiveRegisterNode(ctx, node)) {
                const directiveInfo = getDirectiveInfo(ctx, node);
                if (directiveInfo) {
                    directives.push(directiveInfo);
                }
            } else if (isAngularControllerRegisterNode(ctx, node)) {
                const controllerInfo = getControllerInfo(ctx, node);
                if (controllerInfo) {
                    controllers.push(controllerInfo);
                }
            } else if (isAngularFilterRegisterNode(ctx, node)) {
                const filterInfo = getFilterInfo(ctx, node);
                if (filterInfo) {
                    filters.push(filterInfo);
                }
            } else if (
                isAngularServiceRegisterNode(ctx, node) ||
                isAngularFactoryRegisterNode(ctx, node) ||
                isAngularProviderRegisterNode(ctx, node) ||
                isAngularConstantRegisterNode(ctx, node)
            ) {
                const serviceInfo = getServiceInfo(ctx, node);
                if (serviceInfo) {
                    services.push(serviceInfo);
                }
            }

            ctx.ts.forEachChild(node, scanNode);
        }
    }

    function removeDeletedFiles(scannedTs: number) {
        let count = 0;
        const entries = fileCacheMap.entries();
        for (const [filePath, fileCacheInfo] of entries) {
            if (fileCacheInfo.lastScanned === scannedTs) {
                continue;
            }

            removeItemsFromAllMaps(fileCacheInfo, filePath);
            fileCacheMap.delete(filePath);
            count++;
        }
        return count;
    }

    function removeItemsFromAllMaps(fileCacheInfo: FileCacheInfo, filePath: string) {
        const mapsToClean = [
            { map: componentMap, items: fileCacheInfo.components },
            { map: directiveMap, items: fileCacheInfo.directives },
            { map: controllerMap, items: fileCacheInfo.controllers },
            { map: filterMap, items: fileCacheInfo.filters },
            { map: serviceMap, items: fileCacheInfo.services },
        ];

        for (const { map, items } of mapsToClean) {
            for (const itemName of items) {
                const itemInfo = map.get(itemName);
                // Check file path to avoid removing items with the same name from different files
                if (itemInfo?.filePath === filePath) {
                    map.delete(itemName);
                }
            }
        }
    }
}

function getComponentInfo(ctx: PluginContext, node: ts.CallExpression): ComponentInfo | undefined {
    let info: ComponentInfo | undefined;

    // 第一个参数是字符串字面量
    const nameNode = node.arguments[0];
    if (ctx.ts.isStringLiteralLike(nameNode)) {
        info = {
            name: nameNode.text,
            filePath: ctx.sourceFile.fileName,
            location: {
                start: nameNode.getStart(ctx.sourceFile),
                end: nameNode.getEnd(),
            },
            bindings: [],
            controllerAs: {
                value: '$ctrl', // 默认值
            },
        };

        // 第二个参数是对象字面量
        const configNode = node.arguments[1];
        if (ctx.ts.isObjectLiteralExpression(configNode)) {
            // bindings
            const bindingsObj = getPropByName(ctx, configNode, 'bindings');
            if (bindingsObj && ctx.ts.isObjectLiteralExpression(bindingsObj.initializer)) {
                info.bindings = getPropertiesOfObjLiteral(ctx, bindingsObj.initializer);
            }

            // controllerAs
            const controllerAsVal = getPropValueByName(ctx, configNode, 'controllerAs');
            if (controllerAsVal && ctx.ts.isStringLiteralLike(controllerAsVal)) {
                info.controllerAs.value = controllerAsVal.text;
                info.controllerAs.location = {
                    start: controllerAsVal.getStart(ctx.sourceFile),
                    end: controllerAsVal.getEnd(),
                };
            }

            // transclude
            const transcludeObj = getPropByName(ctx, configNode, 'transclude');
            if (transcludeObj) {
                info.transclude = getTranscludeInfo(ctx, transcludeObj);
            }
        }
    }

    return info;
}

function getDirectiveInfo(ctx: PluginContext, node: ts.CallExpression): DirectiveInfo | undefined {
    let info: DirectiveInfo | undefined;

    // 第一个参数是字符串字面量
    const nameNode = node.arguments[0];
    if (ctx.ts.isStringLiteralLike(nameNode)) {
        info = {
            name: nameNode.text,
            filePath: ctx.sourceFile.fileName,
            location: {
                start: nameNode.getStart(ctx.sourceFile),
                end: nameNode.getEnd(),
            },
            restrict: 'EA', // 默认值
            scope: [],
        };

        // 第二个参数是数组字面量或者函数表达式
        const directiveFuncExpr = getAngularDefineFunctionExpression(ctx, node.arguments[1]);

        // 获取函数的返回值
        if (directiveFuncExpr) {
            const returnStatement = getAngularDefineFunctionReturnStatement(ctx, directiveFuncExpr);
            if (
                returnStatement &&
                returnStatement.expression &&
                ctx.ts.isObjectLiteralExpression(returnStatement.expression)
            ) {
                const configNode = returnStatement.expression;

                // restrict
                const restrictVal = getPropValueByName(ctx, configNode, 'restrict');
                if (restrictVal && ctx.ts.isStringLiteralLike(restrictVal)) {
                    info.restrict = restrictVal.text;
                }

                // scope
                const bindingsObj = getPropByName(ctx, configNode, 'scope');
                if (bindingsObj && ctx.ts.isObjectLiteralExpression(bindingsObj.initializer)) {
                    info.scope = getPropertiesOfObjLiteral(ctx, bindingsObj.initializer);
                }

                // transclude
                const transcludeObj = getPropByName(ctx, configNode, 'transclude');
                if (transcludeObj) {
                    info.transclude = getTranscludeInfo(ctx, transcludeObj);
                }

                // replace
                const replaceVal = getPropValueByName(ctx, configNode, 'replace');
                if (replaceVal && replaceVal.kind === ctx.ts.SyntaxKind.TrueKeyword) {
                    info.replace = true;
                }

                // require
                const requireVal = getPropValueByName(ctx, configNode, 'require');
                if (requireVal && ctx.ts.isStringLiteralLike(requireVal)) {
                    info.require = requireVal.text;
                }

                // priority
                const priorityVal = getPropValueByName(ctx, configNode, 'priority');
                if (priorityVal && ctx.ts.isNumericLiteral(priorityVal)) {
                    info.priority = Number(priorityVal.text);
                }

                // terminal
                const terminalVal = getPropValueByName(ctx, configNode, 'terminal');
                if (terminalVal && terminalVal.kind === ctx.ts.SyntaxKind.TrueKeyword) {
                    info.terminal = true;
                }
            }
        }
    }

    return info;
}

function getControllerInfo(ctx: PluginContext, node: ts.CallExpression): ControllerInfo | undefined {
    // 第一个参数是字符串字面量
    const nameNode = node.arguments[0];
    if (ctx.ts.isStringLiteralLike(nameNode)) {
        return {
            name: nameNode.text,
            filePath: ctx.sourceFile.fileName,
            location: {
                start: nameNode.getStart(ctx.sourceFile),
                end: nameNode.getEnd(),
            },
        };
    }
}

function getServiceInfo(ctx: PluginContext, node: ts.CallExpression): ServiceInfo | undefined {
    // 第一个参数是字符串字面量
    const nameNode = node.arguments[0];
    if (ctx.ts.isStringLiteralLike(nameNode)) {
        return {
            name: nameNode.text,
            filePath: ctx.sourceFile.fileName,
            location: {
                start: nameNode.getStart(ctx.sourceFile),
                end: nameNode.getEnd(),
            },
        };
    }
}

function getFilterInfo(ctx: PluginContext, node: ts.CallExpression): FilterInfo | undefined {
    // 第一个参数是字符串字面量
    const nameNode = node.arguments[0];
    if (!ctx.ts.isStringLiteralLike(nameNode)) {
        return;
    }

    const name = nameNode.text;
    const parameters: Parameter[] = [];
    const funcExpr = getAngularDefineFunctionExpression(ctx, node.arguments[1]);
    if (funcExpr) {
        const returnStatement = getAngularDefineFunctionReturnStatement(ctx, funcExpr);
        if (returnStatement && returnStatement.expression && ctx.ts.isFunctionExpression(returnStatement.expression)) {
            for (const param of returnStatement.expression.parameters) {
                // 暂不考虑数组模式的可变参数和对象解构模式参数
                if (ctx.ts.isIdentifier(param.name)) {
                    parameters.push({
                        name: param.name.text,
                        location: {
                            start: param.getStart(ctx.sourceFile),
                            end: param.getEnd(),
                        },
                        type: param.type ? param.type.getText(ctx.sourceFile) : 'any',
                    });
                }
            }
        }
    }

    return {
        name,
        filePath: ctx.sourceFile.fileName,
        location: {
            start: nameNode.getStart(ctx.sourceFile),
            end: nameNode.getEnd(),
        },
        parameters,
    };
}

function getTranscludeInfo(
    ctx: PluginContext,
    transclude: ts.ObjectLiteralElementLike,
): boolean | Property[] | undefined {
    if (ctx.ts.isPropertyAssignment(transclude)) {
        if (transclude.initializer.kind === ctx.ts.SyntaxKind.TrueKeyword) {
            return true;
        } else if (ctx.ts.isObjectLiteralExpression(transclude.initializer)) {
            return getPropertiesOfObjLiteral(ctx, transclude.initializer);
        }
    }
}

function getPropertiesOfObjLiteral(ctx: PluginContext, objLiteral: ts.ObjectLiteralExpression): Property[] {
    const props: Property[] = [];
    for (const p of objLiteral.properties) {
        if (
            ctx.ts.isPropertyAssignment(p) &&
            ctx.ts.isIdentifier(p.name) &&
            ctx.ts.isStringLiteralLike(p.initializer)
        ) {
            props.push({
                name: p.name.text,
                value: p.initializer.text,
                location: {
                    start: p.getStart(ctx.sourceFile),
                    end: p.getEnd(),
                },
            });
        }
    }
    return props;
}
