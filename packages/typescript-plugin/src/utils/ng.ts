import { SPACE } from '@ng-helper/shared/lib/html';
import { NgTypeInfo } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import type { DirectiveInfo, Property } from '../ngHelperServer/ngCache';
import { PluginContext } from '../type';

import { getPropValueByName, isTypeOfType } from './common';

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
        node.arguments.length >= 1
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

export function isAngularConstantRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    // only support: constant<T>(name: string, value: T): IModule;
    // not support: constant(object: Object): IModule;
    return isAngularRegisterNode(ctx, node, 'constant', 'any');
}

function isAngularRegisterNode(
    ctx: PluginContext,
    node: ts.Node,
    registerName: string,
    configType: 'arrayOrFunction' | 'object' | 'any',
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
        } else if (configType === 'any') {
            return true;
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
    return (
        ctx.ts.isArrayLiteralExpression(node) ||
        ctx.ts.isFunctionExpression(node) ||
        ctx.ts.isClassExpression(node) ||
        ctx.ts.isIdentifier(node)
    );
}

export function getComponentControllerType(ctx: PluginContext, componentName: string): ts.Type | undefined {
    const logger = ctx.logger.prefix('getComponentControllerType()');

    const componentLiteralNode = getComponentDeclareLiteralNode(ctx, componentName);
    if (!componentLiteralNode) {
        logger.info(`componentLiteralNode not found! componentName: ${componentName}`);
        return;
    }

    const controllerPropValue = getPropValueByName(ctx, componentLiteralNode, 'controller');
    // 暂不考虑 controller 是 inline class 的情况
    if (!controllerPropValue || !ctx.ts.isIdentifier(controllerPropValue)) {
        logger.info(`controllerPropValue not found, or it's not an identifier! componentName: ${componentName}`);
        return;
    }

    let controllerType = ctx.typeChecker.getTypeAtLocation(controllerPropValue);
    if (isTypeOfType(ctx, controllerType)) {
        const targetSymbol = controllerType.symbol;
        if (targetSymbol) {
            controllerType = ctx.typeChecker.getDeclaredTypeOfSymbol(targetSymbol);
        }
    }

    return controllerType;
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

export function getComponentDeclareLiteralNode(
    ctx: PluginContext,
    componentName?: string,
): ts.ObjectLiteralExpression | undefined {
    let componentLiteralNode: ts.ObjectLiteralExpression | undefined;
    visit(ctx.sourceFile);
    return componentLiteralNode;

    function visit(node: ts.Node) {
        if (isAngularComponentRegisterNode(ctx, node)) {
            if (
                !componentName ||
                (ctx.ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === componentName)
            ) {
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

export function getDirectiveConfigNode(
    ctx: PluginContext,
    directiveName: string,
): ts.ObjectLiteralExpression | undefined {
    let directiveConfigLiteralNode: ts.ObjectLiteralExpression | undefined;
    visit(ctx.sourceFile);
    return directiveConfigLiteralNode;

    function visit(node: ts.Node) {
        if (
            isAngularDirectiveRegisterNode(ctx, node) &&
            ctx.ts.isStringLiteral(node.arguments[0]) &&
            node.arguments[0].text === directiveName
        ) {
            // 第二个参数是数组字面量或者函数表达式
            const directiveFuncExpr = getAngularDefineFunctionExpression(ctx, node.arguments[1]);
            // 获取函数的返回值
            if (directiveFuncExpr) {
                const returnStatement = directiveFuncExpr.body.statements.find((s) =>
                    ctx.ts.isReturnStatement(s),
                ) as ts.ReturnStatement;
                if (
                    returnStatement &&
                    returnStatement.expression &&
                    ctx.ts.isObjectLiteralExpression(returnStatement.expression)
                ) {
                    directiveConfigLiteralNode = returnStatement.expression;
                }
            }
        }
        if (!directiveConfigLiteralNode) {
            ctx.ts.forEachChild(node, visit);
        }
    }
}

export function getAngularDefineFunctionExpression(
    ctx: PluginContext,
    defineNode: ts.Expression,
): ts.FunctionExpression | undefined {
    let funcExpr: ts.FunctionExpression | undefined;
    if (ctx.ts.isFunctionExpression(defineNode)) {
        funcExpr = defineNode;
    } else if (
        ctx.ts.isArrayLiteralExpression(defineNode) &&
        ctx.ts.isFunctionExpression(defineNode.elements[defineNode.elements.length - 1])
    ) {
        funcExpr = defineNode.elements[defineNode.elements.length - 1] as ts.FunctionExpression;
    }
    return funcExpr;
}

export function getAngularDefineFunctionReturnStatement(
    ctx: PluginContext,
    funcExpr: ts.FunctionExpression,
): ts.ReturnStatement | undefined {
    return funcExpr.body.statements.find((s) => ctx.ts.isReturnStatement(s)) as ts.ReturnStatement;
}

export function getTypeInfoOfDirectiveScope(
    ctx: PluginContext,
    scope: Property[],
    /**
     * 是否站在使用组件的视角。
     */
    perspectivesOnUsing = true,
): NgTypeInfo[] | undefined {
    return getPublicMembersTypeInfoOfBindings(ctx, scope, perspectivesOnUsing);
}

export function getPublicMembersTypeInfoOfBindings(
    ctx: PluginContext,
    bindings: Property[],
    /**
     * 是否站在使用组件的视角。
     */
    perspectivesOnUsing = false,
): NgTypeInfo[] {
    return bindings.map((binding) => getBindingTypeInfo(binding, perspectivesOnUsing));
}

export function getBindingTypeInfo(
    binding: Property,
    /**
     * 是否站在使用组件的视角。
     * 有两种视角（举例：input: '<inputValue'）：
     * 1. 使用组件时，给组件属性传递值(此时属性的名字是 inputValue)。
     * 2. 编写组件时，使用外部传入的值(此时属性的名字是 input)。
     */
    perspectivesOnUsing: boolean,
): NgTypeInfo {
    const item: NgTypeInfo = {
        kind: 'property',
        name: perspectivesOnUsing ? getBindingName(binding) : binding.name,
        typeString: getBindingType(binding.value, perspectivesOnUsing),
        document: `bindings config: "${binding.value}"`,
        optional: isOptionalBinding(binding.value),
        isFunction: false,
    };
    if (isEventBinding(binding.value)) {
        item.isFunction = true;
        item.paramNames = [];
    }
    return item;
}

export function getBindingType(
    bindingConfig: string,
    /**
     * 是否站在使用组件的视角。
     * 有两种视角：
     * 1. 使用组件时，给组件属性传递值；举例：对于 &, 接受表达式。
     * 2. 编写组件时，使用外部传入的值；举例：对于 &, 其类型类似方法，可以按照方法调用。
     */
    perspectivesOnUsing: boolean,
): string {
    if (isEventBinding(bindingConfig)) {
        return perspectivesOnUsing ? '<expression>' : '(...args: any[]) => any';
    } else if (isStringBinding(bindingConfig)) {
        return 'string';
    }
    return 'any';
}

export function isStringBinding(bindingConfig: string): boolean {
    return bindingConfig.includes('@');
}

export function isEventBinding(bindingConfig: string): boolean {
    return bindingConfig.includes('&');
}

export function isOptionalBinding(bindingConfig: string): boolean {
    return bindingConfig.includes('?');
}

export function getBindingName(binding: Property): string {
    return removeBindingControlChars(binding.value).trim() || binding.name;
}

export function removeBindingControlChars(bindingConfig: string): string {
    return bindingConfig.replace(/[@=<?&]/g, '');
}

export function isElementDirective(directiveInfo: DirectiveInfo): boolean {
    return directiveInfo.restrict.includes('E');
}

export function isAttributeDirective(directiveInfo: DirectiveInfo): boolean {
    return directiveInfo.restrict.includes('A');
}

export function isDtsFile(fileName: string): boolean {
    return fileName.endsWith('.d.ts');
}

export const INDENT = SPACE.repeat(4);
