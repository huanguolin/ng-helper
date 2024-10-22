import { NgComponentNameInfo, NgTypeInfo, type NgComponentDirectiveNamesInfo, type NgDirectiveNameInfo } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { NgComponentTypeInfo, PluginContext } from '../type';

import { isTypeOfType } from './common';
import { getObjLiteral } from './common';

export function isAngularModuleNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // 检查 angular.module('moduleName') 的调用，注意 module 函数还有两个可选参数：
    // module(name: string, requires?: string[], configFn?: Injectable<Function>): IModule;
    if (
        ctx.ts.isCallExpression(node) &&
        ctx.ts.isPropertyAccessExpression(node.expression) &&
        ctx.ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'angular' &&
        ctx.ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === 'module' &&
        node.arguments.length >= 1 &&
        ctx.ts.isStringLiteral(node.arguments[0])
    ) {
        return true;
    }
    return false;
}

export function isAngularComponentRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // only support: component(name: string, options: IComponentOptions): IModule;
    // not support: component(object: {[componentName: string]: IComponentOptions}): IModule;
    return isAngularRegisterNode(ctx, node, 'component', 'object');
}

export function isAngularDirectiveRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // only support: directive<...>(name: string, directiveFactory: Injectable<IDirectiveFactory<...>>): IModule;
    // not support: directive<...>(object: {[directiveName: string]: Injectable<IDirectiveFactory<...>>}): IModule;
    return isAngularRegisterNode(ctx, node, 'directive', 'arrayOrFunction');
}

export function isAngularControllerRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // only support: controller(name: string, controllerConstructor: Injectable<IControllerConstructor>): IModule;
    // not support: controller(object: {[name: string]: Injectable<IControllerConstructor>}): IModule;
    return isAngularRegisterNode(ctx, node, 'controller', 'arrayOrFunction');
}

export function isAngularServiceRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // only support: service(name: string, serviceConstructor: Injectable<Function>): IModule;
    // not support: service(object: {[name: string]: Injectable<Function>}): IModule;
    return isAngularRegisterNode(ctx, node, 'service', 'arrayOrFunction');
}

export function isAngularFilterRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // only support: filter(name: string, filterFactoryFunction: Injectable<FilterFactory>): IModule;
    // not support: filter(object: {[name: string]: Injectable<FilterFactory>}): IModule;
    return isAngularRegisterNode(ctx, node, 'filter', 'arrayOrFunction');
}

export function isAngularFactoryRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // only support: factory(name: string, $getFn: Injectable<Function>): IModule;
    // not support: factory(object: {[name: string]: Injectable<Function>}): IModule;
    return isAngularRegisterNode(ctx, node, 'factory', 'arrayOrFunction');
}

export function isAngularProviderRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // only support: provider(name: string, inlineAnnotatedConstructor: any[]): IModule;
    // not support:
    // provider(name: string, serviceProviderFactory: IServiceProviderFactory): IModule;
    // provider(name: string, serviceProviderConstructor: IServiceProviderClass): IModule;
    // provider(name: string, providerObject: IServiceProvider): IModule;
    // provider(object: Object): IModule;
    return isAngularRegisterNode(ctx, node, 'provider', 'arrayOrFunction');
}

function isAngularRegisterNode(
    ctx: PluginContext,
    node: ts.Node,
    registerName: string,
    configType: 'arrayOrFunction' | 'object',
): node is ts.CallExpression {
    if (
        ctx.ts.isCallExpression(node) &&
        ctx.ts.isPropertyAccessExpression(node.expression) &&
        ctx.ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === registerName &&
        node.arguments.length === 2 &&
        ctx.ts.isStringLiteral(node.arguments[0])
    ) {
        if (configType === 'arrayOrFunction') {
            return isInjectableNode(ctx, node.arguments[1]);
        } else if (configType === 'object') {
            return ctx.ts.isObjectLiteralExpression(node.arguments[1]);
        }
    }
    return false;
}

export function isAngularRunNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // run(initializationFunction: Injectable<Function>): IModule;
    if (
        ctx.ts.isCallExpression(node) &&
        ctx.ts.isPropertyAccessExpression(node.expression) &&
        ctx.ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === 'run' &&
        node.arguments.length === 1 &&
        isInjectableNode(ctx, node.arguments[0])
    ) {
        return true;
    }
    return false;
}

export function isAngularConfigNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // only support: config(inlineAnnotatedFunction: any[]): IModule;
    // not support: config(configFn: Function): IModule;
    // not support: config(object: Object): IModule;
    if (
        ctx.ts.isCallExpression(node) &&
        ctx.ts.isPropertyAccessExpression(node.expression) &&
        ctx.ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === 'config' &&
        node.arguments.length === 1 &&
        isInjectableNode(ctx, node.arguments[0])
    ) {
        return true;
    }
    return false;
}

function isInjectableNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // 只考虑常见情况，其他情况不考虑
    return ctx.ts.isArrayLiteralExpression(node) || ctx.ts.isFunctionExpression(node) || ctx.ts.isClassExpression(node) || ctx.ts.isIdentifier(node);
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

export function getComponentDeclareLiteralNode(ctx: PluginContext, componentName?: string): ts.ObjectLiteralExpression | undefined {
    let componentLiteralNode: ts.ObjectLiteralExpression | undefined;
    visit(ctx.sourceFile);
    return componentLiteralNode;

    function visit(node: ts.Node) {
        if (isAngularComponentRegisterNode(ctx, node)) {
            if (!componentName || (ctx.ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === componentName)) {
                // 第二个参数是对象字面量
                const theNode = node.arguments[1];
                if (ctx.ts.isObjectLiteralExpression(theNode)) {
                    componentLiteralNode = theNode;
                }
            }
        }
        if (!componentLiteralNode) {
            ctx.ts.forEachChild(node, visit);
        }
    }
}

export function getDirectiveConfigNode(ctx: PluginContext, directiveName: string): ts.ObjectLiteralExpression | undefined {
    let directiveConfigLiteralNode: ts.ObjectLiteralExpression | undefined;
    visit(ctx.sourceFile);
    return directiveConfigLiteralNode;

    function visit(node: ts.Node) {
        if (isAngularDirectiveRegisterNode(ctx, node) && ctx.ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === directiveName) {
            // 第二个参数是数组字面量或者函数表达式
            const directiveFuncExpr = getDirectiveFunctionExpression(ctx, node.arguments[1]);
            // 获取函数的返回值
            if (directiveFuncExpr) {
                const returnStatement = directiveFuncExpr.body.statements.find((s) => ctx.ts.isReturnStatement(s)) as ts.ReturnStatement;
                if (returnStatement && returnStatement.expression && ctx.ts.isObjectLiteralExpression(returnStatement.expression)) {
                    directiveConfigLiteralNode = returnStatement.expression;
                }
            }
        }
        if (!directiveConfigLiteralNode) {
            ctx.ts.forEachChild(node, visit);
        }
    }
}

export function getComponentDirectiveNameInfo(ctx: PluginContext): NgComponentDirectiveNamesInfo | undefined {
    const info: NgComponentDirectiveNamesInfo = {
        components: [],
        directives: [],
    };
    visit(ctx.sourceFile);
    return info.components.length || info.directives.length ? info : undefined;

    function visit(node: ts.Node) {
        if (isAngularComponentRegisterNode(ctx, node)) {
            const componentInfo = getComponentNameInfo(node);
            if (componentInfo) {
                info.components.push(componentInfo);
            }
        } else if (isAngularDirectiveRegisterNode(ctx, node)) {
            const directiveInfo = getDirectiveNameInfo(node);
            if (directiveInfo) {
                info.directives.push(directiveInfo);
            }
        }

        ctx.ts.forEachChild(node, visit);
    }

    function getComponentNameInfo(node: ts.CallExpression): NgComponentNameInfo | undefined {
        let info: NgComponentNameInfo | undefined;

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

        return info;
    }

    function getDirectiveNameInfo(node: ts.CallExpression): NgDirectiveNameInfo | undefined {
        let info: NgDirectiveNameInfo | undefined;

        // 第一个参数是字符串字面量
        const nameNode = node.arguments[0];
        if (ctx.ts.isStringLiteralLike(nameNode)) {
            info = {
                directiveName: nameNode.text,
                restrict: 'EA', // default value, see: https://docs.angularjs.org/api/ng/service/$compile#directive-definition-object
            };

            // 第二个参数是数组字面量或者函数表达式
            const directiveFuncExpr = getDirectiveFunctionExpression(ctx, node.arguments[1]);

            // 获取函数的返回值
            if (directiveFuncExpr) {
                const returnStatement = directiveFuncExpr.body.statements.find((s) => ctx.ts.isReturnStatement(s)) as ts.ReturnStatement;
                if (returnStatement && returnStatement.expression && ctx.ts.isObjectLiteralExpression(returnStatement.expression)) {
                    const returnObj = returnStatement.expression;

                    // restrict
                    const restrictStr = returnObj.properties.find((p) => p.name && ctx.ts.isIdentifier(p.name) && p.name.text === 'restrict');
                    if (restrictStr && ctx.ts.isPropertyAssignment(restrictStr) && ctx.ts.isStringLiteralLike(restrictStr.initializer)) {
                        info.restrict = restrictStr.initializer.text;
                    }

                    // transclude
                    const transcludeObj = returnObj.properties.find((p) => p.name && ctx.ts.isIdentifier(p.name) && p.name.text === 'transclude');
                    if (transcludeObj) {
                        info.transclude = getTranscludeInfo(transcludeObj);
                    }
                }
            }
        }

        return info;
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

function getDirectiveFunctionExpression(ctx: PluginContext, configNode: ts.Expression) {
    let directiveFuncExpr: ts.FunctionExpression | undefined;
    if (ctx.ts.isFunctionExpression(configNode)) {
        directiveFuncExpr = configNode;
    } else if (ctx.ts.isArrayLiteralExpression(configNode) && ctx.ts.isFunctionExpression(configNode.elements[configNode.elements.length - 1])) {
        directiveFuncExpr = configNode.elements[configNode.elements.length - 1] as ts.FunctionExpression;
    }
    return directiveFuncExpr;
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

export function getTypeInfoOfDirectiveScope(
    ctx: PluginContext,
    scopeMap: Map<string, string>,
    /**
     * 站在使用组件的视角。
     */
    perspectivesOnUsing = true,
): NgTypeInfo[] | undefined {
    return getPublicMembersTypeInfoOfBindings(ctx, scopeMap, perspectivesOnUsing);
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
        const inputName = removeBindingControlChars(s).trim();
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

export function isStringBinding(bindingName: string): boolean {
    return bindingName.includes('@');
}

export function removeBindingControlChars(bindingName: string): string {
    return bindingName.replace(/[@=<?&]/g, '');
}

export function isElementDirective(directiveNameInfo: NgDirectiveNameInfo): boolean {
    return directiveNameInfo.restrict.includes('E');
}

export function isAttributeDirective(directiveNameInfo: NgDirectiveNameInfo): boolean {
    return directiveNameInfo.restrict.includes('A');
}

export function isComponentOrDirectiveFile(fileName: string): boolean {
    return isComponentTsFile(fileName) || isComponentJsFile(fileName) || isDirectiveFile(fileName);
}

export function isTsFile(fileName: string): boolean {
    return fileName.endsWith('.ts');
}

export function isDtsFile(fileName: string): boolean {
    return fileName.endsWith('.d.ts');
}

export function isJsFile(fileName: string): boolean {
    return fileName.endsWith('.js');
}

export function isDirectiveFile(fileName: string): boolean {
    return (
        fileName.endsWith('.directive.ts') ||
        fileName.endsWith('.directives.ts') ||
        fileName.endsWith('.directive.js') ||
        fileName.endsWith('.directives.js')
    );
}
export function isComponentJsFile(fileName: string): boolean {
    return fileName.endsWith('.component.js');
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
