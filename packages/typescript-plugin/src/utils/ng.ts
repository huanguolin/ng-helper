import { NgComponentNameInfo, NgTypeInfo } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { NgComponentTypeInfo, PluginContext, type CorePluginContext } from '../type';

import { isTypeOfType } from './common';

export function isAngularComponentRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    if (
        ctx.ts.isCallExpression(node) &&
        ctx.ts.isPropertyAccessExpression(node.expression) &&
        ctx.ts.isCallExpression(node.expression.expression) &&
        ctx.ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === 'component' &&
        node.arguments.length === 2 &&
        ctx.ts.isStringLiteral(node.arguments[0]) &&
        ctx.ts.isObjectLiteralExpression(node.arguments[1])
    ) {
        return true;
    }
    return false;
}

export function isAngularControllerRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    if (
        ctx.ts.isCallExpression(node) &&
        ctx.ts.isPropertyAccessExpression(node.expression) &&
        ctx.ts.isCallExpression(node.expression.expression) &&
        ctx.ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === 'controller' &&
        node.arguments.length === 2 &&
        ctx.ts.isStringLiteral(node.arguments[0])
    ) {
        return true;
    }
    return false;
}

export function getComponentTypeInfo(ctx: PluginContext, componentLiteralNode: ts.ObjectLiteralExpression): NgComponentTypeInfo {
    const result: NgComponentTypeInfo = {
        controllerAs: '$ctrl',
        bindings: new Map(),
    };
    for (const prop of componentLiteralNode.properties) {
        if (ctx.ts.isPropertyAssignment(prop) && ctx.ts.isIdentifier(prop.name)) {
            if (prop.name.text === 'controller' && ctx.ts.isIdentifier(prop.initializer)) {
                let controllerType = ctx.typeChecker.getTypeAtLocation(prop.initializer);
                if (isTypeOfType(ctx, controllerType)) {
                    const targetSymbol = controllerType.symbol;
                    if (targetSymbol) {
                        controllerType = ctx.typeChecker.getDeclaredTypeOfSymbol(targetSymbol);
                    }
                }
                result.controllerType = controllerType;
            } else if (prop.name.text === 'controllerAs' && ctx.ts.isStringLiteral(prop.initializer)) {
                result.controllerAs = prop.initializer.text;
            } else if (prop.name.text === 'bindings' && ctx.ts.isObjectLiteralExpression(prop.initializer)) {
                const bindingsObj = getObjLiteral(ctx, prop.initializer);
                result.bindings = new Map(Object.entries(bindingsObj));
            }
        }
    }
    return result;
}

export function getControllerType(ctx: PluginContext): ts.Type | undefined {
    const logger = ctx.logger.prefix('getControllerType()');

    let targetNode: ts.Identifier | undefined;
    visit(ctx.sourceFile);
    if (!targetNode) {
        logger.info('not found target node!');
        return;
    }

    const controllerType = ctx.typeChecker.getTypeAtLocation(targetNode);
    if (isTypeOfType(ctx, controllerType)) {
        const targetSymbol = controllerType.symbol;
        if (targetSymbol) {
            return ctx.typeChecker.getDeclaredTypeOfSymbol(targetSymbol);
        }
    }
    return controllerType;

    function visit(node: ts.Node) {
        if (isAngularControllerRegisterNode(ctx, node)) {
            // logger.info(node.getText(ctx.sourceFile));
            // 第二个参数是对象字面量
            const theNode = node.arguments[1];
            if (ctx.ts.isIdentifier(theNode)) {
                targetNode = theNode;
            }
        }

        if (!targetNode) {
            ctx.ts.forEachChild(node, visit);
        }
    }
}

export function getComponentDeclareLiteralNode(ctx: PluginContext): ts.ObjectLiteralExpression | undefined {
    let componentLiteralNode: ts.ObjectLiteralExpression | undefined;
    visit(ctx.sourceFile);
    return componentLiteralNode;

    function visit(node: ts.Node) {
        if (isAngularComponentRegisterNode(ctx, node)) {
            // 第二个参数是对象字面量
            const theNode = node.arguments[1];
            if (ctx.ts.isObjectLiteralExpression(theNode)) {
                componentLiteralNode = theNode;
            }
        }
        if (!componentLiteralNode) {
            ctx.ts.forEachChild(node, visit);
        }
    }
}

export function getComponentNameInfo(ctx: PluginContext): NgComponentNameInfo | undefined {
    let info: NgComponentNameInfo | undefined;
    visit(ctx.sourceFile);
    return info;

    function visit(node: ts.Node) {
        if (isAngularComponentRegisterNode(ctx, node)) {
            // 第一个参数是字符串字面量
            const nameNode = node.arguments[0];
            if (ctx.ts.isStringLiteralLike(nameNode)) {
                info = {
                    componentName: nameNode.text,
                };

                // 第二个参数是对象字面量
                const configNode = node.arguments[1];
                if (ctx.ts.isObjectLiteralExpression(configNode)) {
                    const transcludeObj = configNode.properties.find((p) => p.name && ctx.ts.isIdentifier(p.name) && p.name.text === 'transclude');
                    if (transcludeObj) {
                        info.transclude = getTranscludeInfo(transcludeObj);
                    }
                }
            }
        }

        if (!info) {
            ctx.ts.forEachChild(node, visit);
        }
    }

    function getTranscludeInfo(transclude: ts.ObjectLiteralElementLike): boolean | Record<string, string> | undefined {
        if (ctx.ts.isPropertyAssignment(transclude)) {
            if (transclude.initializer.kind === ctx.ts.SyntaxKind.TrueKeyword) {
                return true;
            } else if (ctx.ts.isObjectLiteralExpression(transclude.initializer)) {
                return getObjLiteral(ctx, transclude.initializer);
            }
        }
    }
}

export function getControllerNameInfo(ctx: PluginContext): string | undefined {
    let name: string | undefined;
    visit(ctx.sourceFile);
    return name;

    function visit(node: ts.Node) {
        if (isAngularControllerRegisterNode(ctx, node)) {
            // 第一个参数是字符串字面量
            const nameNode = node.arguments[0];
            if (ctx.ts.isStringLiteralLike(nameNode)) {
                name = nameNode.text;
            }
        }

        if (!name) {
            ctx.ts.forEachChild(node, visit);
        }
    }
}

export function getPublicMembersTypeInfoOfBindings(
    ctx: PluginContext,
    bindingsMap: Map<string, string>,
    /**
     * 站在使用组件的视角。
     */
    perspectivesOnUsing = false,
): NgTypeInfo[] | undefined {
    if (!bindingsMap.size) {
        return;
    }

    const result: NgTypeInfo[] = [];
    for (const [k, v] of bindingsMap) {
        const typeInfo = getBindType(v);
        const item: NgTypeInfo = {
            kind: 'property',
            name: perspectivesOnUsing ? typeInfo.inputName || k : k,
            typeString: typeInfo.typeString,
            document: `bindings config: "${v}"`,
            optional: typeInfo.optional,
            isFunction: false,
        };
        if (typeInfo.type === 'function') {
            result.push({
                ...item,
                kind: 'method',
                isFunction: true,
                paramNames: [],
            });
        } else {
            result.push(item);
        }
    }
    return result;

    function getBindType(s: string) {
        const inputName = s.replace(/[@=<?&]/g, '').trim();
        const result: {
            type: 'any' | 'string' | 'function';
            optional: boolean;
            typeString: string;
            inputName?: string;
        } = {
            type: 'any',
            optional: s.includes('?'),
            typeString: 'any',
            inputName: inputName ? inputName : undefined,
        };

        if (s.includes('@')) {
            result.type = 'string';
            result.typeString = 'string';
        } else if (s.includes('&')) {
            result.type = 'function';
            result.typeString = perspectivesOnUsing ? 'expression' : '(...args: any[]) => any';
        }

        return result;
    }
}

export function getObjLiteral(coreCtx: CorePluginContext, objLiteral: ts.ObjectLiteralExpression): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const p of objLiteral.properties) {
        if (coreCtx.ts.isPropertyAssignment(p) && coreCtx.ts.isIdentifier(p.name) && coreCtx.ts.isStringLiteralLike(p.initializer)) {
            obj[p.name.text] = p.initializer.text;
        }
    }
    return obj;
}

export function isComponentTsFile(fileName: string): boolean {
    return fileName.endsWith('.component.ts');
}

export function isControllerTsFile(fileName: string): boolean {
    return fileName.endsWith('.controller.ts');
}

export function isServiceTsFile(fileName: string): boolean {
    return fileName.endsWith('.service.ts');
}
