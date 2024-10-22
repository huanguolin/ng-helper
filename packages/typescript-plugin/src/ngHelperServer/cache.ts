import type ts from 'typescript';

import type { GetCoreContextFn, FileVersion, PluginContext } from '../type';
import { getSourceFileVersion } from '../utils/common';
import {
    getAngularDefineFunctionExpression,
    getAngularDefineFunctionReturnStatement,
    isAngularComponentRegisterNode,
    isAngularControllerRegisterNode,
    isAngularDirectiveRegisterNode,
    isAngularFilterRegisterNode,
    isAngularModuleNode,
    isDtsFile,
} from '../utils/ng';

export interface FileCacheInfo extends FileVersion {
    components: string[];
    directives: string[];
    controllers: string[];
    filters: string[];
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

export interface ComponentInfo {
    name: string;
    filePath: string;
    location: Location;
    bindings: Property[];
    controllerAs: string;
    transclude?: boolean | Property[];
}

export interface DirectiveInfo {
    name: string;
    filePath: string;
    location: Location;
    /**
     * E - Element name (default): <my-directive></my-directive>
     * A - Attribute (default): <div my-directive="exp"></div>
     * C - Class: <div class="my-directive: exp;"></div>
     * M - Comment: <!-- directive: my-directive exp -->
     */
    restrict: string;
    scope: Property[];
    transclude?: boolean | Property[];
}

export interface ControllerInfo {
    name: string;
    filePath: string;
    location: Location;
}

export interface FilterInfo {
    name: string;
    filePath: string;
    location: Location;
    parameters: Parameter[];
}

export interface Cache {
    getComponentMap: () => Map<string, ComponentInfo>;
    getDirectiveMap: () => Map<string, DirectiveInfo>;
    getControllerMap: () => Map<string, ControllerInfo>;
    getFilterMap: () => Map<string, FilterInfo>;
}

const REFRESH_THRESHOLDS = 1000; // 1s

export function buildCache(getCoreContext: GetCoreContextFn): Cache {
    let lastRefreshed = 0;
    const fileCacheMap = new Map<string, FileCacheInfo>();
    const componentMap = new Map<string, ComponentInfo>();
    const directiveMap = new Map<string, DirectiveInfo>();
    const controllerMap = new Map<string, ControllerInfo>();
    const filterMap = new Map<string, FilterInfo>();

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
    };

    function refreshInternalMaps() {
        const diff = Date.now() - lastRefreshed;
        if (diff < REFRESH_THRESHOLDS) {
            // Skip refresh if less than REFRESH_THRESHOLDS ms has passed since last refresh
            return;
        }
        lastRefreshed = Date.now();

        const coreCtx = getCoreContext()!;

        const start = lastRefreshed;
        const scannedTs = lastRefreshed;
        const logger = coreCtx.logger.prefix('refreshInternalMaps()');
        logger.startGroup();

        const sourceFiles = coreCtx.program.getSourceFiles();
        logger.info(
            'sourceFiles count:',
            sourceFiles.length,
            'old cache files count:',
            fileCacheMap.size,
            'old component count:',
            componentMap.size,
            'old directive count:',
            directiveMap.size,
            'old controller count:',
            controllerMap.size,
            'old filter count:',
            filterMap.size,
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
            } else {
                fileCacheInfo.lastScanned = scannedTs;
                const version = getSourceFileVersion(sourceFile);
                if (fileCacheInfo.version === version) {
                    continue;
                }
                // File modify
                scanFile(ctx, scannedTs, fileCacheInfo);
            }
        }

        removeDeletedFiles(scannedTs);

        const end = Date.now();
        logger.info(
            'new cache files count:',
            fileCacheMap.size,
            'new component count:',
            componentMap.size,
            'new directive count:',
            directiveMap.size,
            'new controller count:',
            controllerMap.size,
            'new filter count:',
            filterMap.size,
            'cost:',
            `${end - start}ms`,
        );
        logger.endGroup();
    }

    function scanFile(ctx: PluginContext, scannedTs: number, fileCacheInfo?: FileCacheInfo) {
        if (fileCacheInfo) {
            removeItemsFromAllMaps(fileCacheInfo, ctx.sourceFile.fileName);
        }

        let isNgModule = false;
        const components: ComponentInfo[] = [];
        const directives: DirectiveInfo[] = [];
        const controllers: ControllerInfo[] = [];
        const filters: FilterInfo[] = [];
        visitNode(ctx.sourceFile);
        if (!isNgModule) {
            return;
        }

        fileCacheMap.set(ctx.sourceFile.fileName, {
            version: getSourceFileVersion(ctx.sourceFile),
            components: components.map((c) => c.name),
            directives: directives.map((d) => d.name),
            controllers: controllers.map((c) => c.name),
            filters: filters.map((f) => f.name),
            lastScanned: scannedTs,
        });

        const mapsToSet = [
            { map: componentMap, items: components },
            { map: directiveMap, items: directives },
            { map: controllerMap, items: controllers },
            { map: filterMap, items: filters },
        ];

        for (const { map, items } of mapsToSet) {
            for (const item of items) {
                map.set(item.name, item);
            }
        }

        function visitNode(node: ts.Node) {
            if (isAngularModuleNode(ctx, node)) {
                isNgModule = true;
            } else if (isAngularComponentRegisterNode(ctx, node)) {
                const componentInfo = getComponentInfo(node);
                if (componentInfo) {
                    components.push(componentInfo);
                }
            } else if (isAngularDirectiveRegisterNode(ctx, node)) {
                const directiveInfo = getDirectiveInfo(node);
                if (directiveInfo) {
                    directives.push(directiveInfo);
                }
            } else if (isAngularControllerRegisterNode(ctx, node)) {
                const controllerInfo = getControllerInfo(node);
                if (controllerInfo) {
                    controllers.push(controllerInfo);
                }
            } else if (isAngularFilterRegisterNode(ctx, node)) {
                const filterInfo = getFilterInfo(node);
                if (filterInfo) {
                    filters.push(filterInfo);
                }
            }

            ctx.ts.forEachChild(node, visitNode);
        }

        function getComponentInfo(node: ts.CallExpression): ComponentInfo | undefined {
            // 第一个参数是字符串字面量
            const nameNode = node.arguments[0];
            if (ctx.ts.isStringLiteralLike(nameNode)) {
                // TODO
                return {
                    name: nameNode.text,
                    filePath: ctx.sourceFile.fileName,
                    location: {
                        start: nameNode.getStart(ctx.sourceFile),
                        end: nameNode.getEnd(),
                    },
                    bindings: [],
                    controllerAs: '$ctrl',
                };
            }
        }

        function getDirectiveInfo(node: ts.CallExpression): DirectiveInfo | undefined {
            // 第一个参数是字符串字面量
            const nameNode = node.arguments[0];
            if (ctx.ts.isStringLiteralLike(nameNode)) {
                // TODO
                return {
                    name: nameNode.text,
                    filePath: ctx.sourceFile.fileName,
                    location: {
                        start: nameNode.getStart(ctx.sourceFile),
                        end: nameNode.getEnd(),
                    },
                    restrict: 'E',
                    scope: [],
                };
            }
        }

        function getControllerInfo(node: ts.CallExpression): ControllerInfo | undefined {
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

        function getFilterInfo(node: ts.CallExpression): FilterInfo | undefined {
            // 第一个参数是字符串字面量
            const nameNode = node.arguments[0];
            if (!ctx.ts.isStringLiteralLike(nameNode)) {
                return;
            }

            const name = nameNode.text;
            const parameters: Parameter[] = [];
            const funcExpr = getAngularDefineFunctionExpression(ctx, node);
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
    }

    function removeDeletedFiles(scannedTs: number) {
        const entries = fileCacheMap.entries();
        for (const [filePath, fileCacheInfo] of entries) {
            if (fileCacheInfo.lastScanned === scannedTs) {
                continue;
            }

            removeItemsFromAllMaps(fileCacheInfo, filePath);

            fileCacheMap.delete(filePath);
        }
    }

    function removeItemsFromAllMaps(fileCacheInfo: FileCacheInfo, filePath: string) {
        const mapsToClean = [
            { map: componentMap, items: fileCacheInfo.components },
            { map: directiveMap, items: fileCacheInfo.directives },
            { map: controllerMap, items: fileCacheInfo.controllers },
            { map: filterMap, items: fileCacheInfo.filters },
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
