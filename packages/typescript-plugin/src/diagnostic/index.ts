import type { InjectionCheckMode } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';
import type tsserver from 'typescript/lib/tsserverlibrary';

import { ngHelperServer } from '../ngHelperServer';
import { PluginContext } from '../type';
import { getPropValueByName } from '../utils/common';
import {
    getComponentDeclareLiteralNode,
    isAngularComponentRegisterNode,
    isAngularConfigNode,
    isAngularControllerRegisterNode,
    isAngularDirectiveRegisterNode,
    isAngularFactoryRegisterNode,
    isAngularFilterRegisterNode,
    isAngularProviderRegisterNode,
    isAngularRunNode,
    isAngularServiceRegisterNode,
    isDtsFile,
} from '../utils/ng';

import { getConstructor, getStaticPublicInjectionField, isAngularFile } from './utils';

export function overrideGetSemanticDiagnostics({ proxy, info }: { proxy: tsserver.LanguageService; info: tsserver.server.PluginCreateInfo }) {
    proxy.getSemanticDiagnostics = (fileName: string) => {
        const prior = info.languageService.getSemanticDiagnostics(fileName);
        if (!ngHelperServer.isExtensionActivated()) {
            return prior;
        }

        if (isDtsFile(fileName)) {
            return prior;
        }

        const ctx = ngHelperServer.getContext(fileName);
        if (!ctx || !isAngularFile(ctx)) {
            return prior;
        }

        try {
            const diagnostics = diagnoseInjection(ctx, 'strict_equal');
            ctx.logger.info('getSemanticDiagnostics():', diagnostics);
            if (diagnostics.length > 0) {
                prior.push(...diagnostics);
            }
        } catch (error) {
            ctx.logger.error('getSemanticDiagnostics():', (error as Error).message, (error as Error).stack);
        }

        return prior;
    };
}

function diagnoseInjection(ctx: PluginContext, checkMode: InjectionCheckMode): ts.Diagnostic[] {
    const logger = ctx.logger.prefix('diagnoseInjection()');
    logger.info('checkMode:', checkMode);

    const diagnostics: ts.Diagnostic[] = [];
    visit(ctx.sourceFile);
    return diagnostics;

    function visit(node: ts.Node) {
        if (isAngularComponentRegisterNode(ctx, node)) {
            const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
            if (componentLiteralNode) {
                check(getPropValueByName(ctx, componentLiteralNode, 'controller'));
            }
        } else if (
            isAngularDirectiveRegisterNode(ctx, node) ||
            isAngularControllerRegisterNode(ctx, node) ||
            isAngularServiceRegisterNode(ctx, node) ||
            isAngularFilterRegisterNode(ctx, node) ||
            isAngularFactoryRegisterNode(ctx, node) ||
            isAngularProviderRegisterNode(ctx, node)
        ) {
            check(node.arguments[1]);
        } else if (isAngularRunNode(ctx, node) || isAngularConfigNode(ctx, node)) {
            check(node.arguments[0]);
        }

        ctx.ts.forEachChild(node, visit);
    }

    function check(node: ts.Node | undefined) {
        if (!node) {
            return;
        }

        logger.info('enter check().');
        if (ctx.ts.isArrayLiteralExpression(node)) {
            checkArray(node);
        } else if (ctx.ts.isClassExpression(node)) {
            checkClass(node);
        } else if (ctx.ts.isIdentifier(node)) {
            // 不考虑把数组也定义为变量的情况，只考虑把函数和类定义为变量的情况
            const declaration = resolveIdentifier(node);
            if (declaration) {
                if (ctx.ts.isFunctionDeclaration(declaration)) {
                    checkFunction(declaration, node);
                } else if (ctx.ts.isClassDeclaration(declaration)) {
                    checkClass(declaration);
                }
            }
        } else if (ctx.ts.isFunctionExpression(node)) {
            // 这种情况不用检查，因为这种写法无法添加 $inject 属性
        }
    }

    function checkArray(node: ts.ArrayLiteralExpression) {
        logger.info('enter checkArray().');

        const fnNode = node.elements[node.elements.length - 1];
        let fnDeclaration: ts.FunctionLikeDeclarationBase | undefined;
        if (ctx.ts.isIdentifier(fnNode)) {
            const declaration = resolveIdentifier(fnNode);
            if (declaration && ctx.ts.isFunctionDeclaration(declaration)) {
                fnDeclaration = declaration;
            }
        } else if (ctx.ts.isFunctionExpression(fnNode)) {
            fnDeclaration = fnNode;
        }

        if (!fnDeclaration) {
            return;
        }

        const injectionArr = node.elements.slice(0, -1);
        const paramArr = fnDeclaration.parameters;
        if (injectionArr.length === 0 && paramArr.length === 0) {
            return;
        }

        logger.info('checkArray() before real check.');
        if (checkMode === 'count_match') {
            if (injectionArr.length !== paramArr.length) {
                return diagnostics.push(
                    buildDiagnostic({
                        start: fnNode.getStart(ctx.sourceFile),
                        length: fnNode.getWidth(ctx.sourceFile),
                        messageText: getNotMatchMsg(true),
                    }),
                );
            }
        } else {
            const maxLength = Math.max(injectionArr.length, paramArr.length);
            for (let i = 0; i < maxLength; i++) {
                const injectEle = injectionArr[i];
                const param = paramArr[i];

                if (!injectEle || !param) {
                    const existOne = injectEle || param;
                    return diagnostics.push(
                        buildDiagnostic({
                            start: existOne.getStart(ctx.sourceFile),
                            length: existOne.getWidth(ctx.sourceFile),
                            messageText: getNotMatchMsg(!!param),
                        }),
                    );
                }

                if (!ctx.ts.isStringLiteral(injectEle)) {
                    return buildDiagnostic({
                        start: injectEle.getStart(ctx.sourceFile),
                        length: injectEle.getWidth(ctx.sourceFile),
                        messageText: '$inject element must be literal string.',
                    });
                }

                let leftText = injectEle.text;
                let rightText = param.name.getText(ctx.sourceFile);

                if (checkMode === 'ignore_case_word_match') {
                    leftText = leftText.toLowerCase();
                    rightText = rightText.toLowerCase();
                }

                if (leftText !== rightText) {
                    const isConstructorSide = injectionArr.length <= paramArr.length;
                    const wrongSide = isConstructorSide ? param : injectEle;
                    return diagnostics.push(
                        buildDiagnostic({
                            start: wrongSide.getStart(ctx.sourceFile),
                            length: wrongSide.getWidth(ctx.sourceFile),
                            messageText: getNotMatchMsg(isConstructorSide),
                        }),
                    );
                }
            }
        }
    }

    function checkFunction(node: ts.FunctionLikeDeclarationBase, identifier: ts.Identifier) {
        logger.info('enter checkFunction().');

        const symbol = ctx.typeChecker.getSymbolAtLocation(identifier)!;
        const injectionProperty = symbol.members?.get(ctx.ts.escapeLeadingUnderscores('$inject'));
        if (!injectionProperty) {
            return;
        }

        const declaration = injectionProperty.valueDeclaration;
        if (!declaration || !ctx.ts.isBinaryExpression(declaration) || !ctx.ts.isArrayLiteralExpression(declaration.right)) {
            return;
        }

        const injectionArr = declaration.right;

        // TODO: 检查函数参数
    }

    function checkClass(node: ts.ClassLikeDeclarationBase) {
        logger.info('enter checkClass().');
        const staticInjectField = getStaticPublicInjectionField(ctx, node);
        if (!staticInjectField || !staticInjectField.initializer || !ctx.ts.isArrayLiteralExpression(staticInjectField.initializer)) {
            return;
        }

        const constructor = getConstructor(ctx, node);
        if (!constructor) {
            return;
        }

        const injectionArray = staticInjectField.initializer.elements;
        const constructorParams = constructor.parameters;
        if (injectionArray.length === 0 && constructorParams.length === 0) {
            return;
        }

        logger.info('checkClass() before real check.');
        if (checkMode === 'count_match') {
            if (injectionArray.length !== constructorParams.length) {
                const { left, right } = getConstructorParenPosition(ctx, constructor);
                return diagnostics.push(
                    buildDiagnostic({
                        start: left,
                        length: right - left + 1,
                        messageText: getNotMatchMsg(true),
                    }),
                );
            }
        } else {
            const maxLength = Math.max(injectionArray.length, constructorParams.length);
            for (let i = 0; i < maxLength; i++) {
                const injectEle = injectionArray[i];
                const param = constructorParams[i];

                if (!injectEle || !param) {
                    const existOne = injectEle || param;
                    return diagnostics.push(
                        buildDiagnostic({
                            start: existOne.getStart(ctx.sourceFile),
                            length: existOne.getWidth(ctx.sourceFile),
                            messageText: getNotMatchMsg(!!param),
                        }),
                    );
                }

                if (!ctx.ts.isStringLiteral(injectEle)) {
                    return buildDiagnostic({
                        start: injectEle.getStart(ctx.sourceFile),
                        length: injectEle.getWidth(ctx.sourceFile),
                        messageText: '$inject element must be literal string.',
                    });
                }

                let leftText = injectEle.text;
                let rightText = param.name.getText(ctx.sourceFile);
                if (checkMode === 'ignore_case_word_match') {
                    leftText = leftText.toLowerCase();
                    rightText = rightText.toLowerCase();
                }

                if (leftText !== rightText) {
                    const isConstructorSide = injectionArray.length <= constructorParams.length;
                    const wrongSide = isConstructorSide ? param : injectEle;
                    return diagnostics.push(
                        buildDiagnostic({
                            start: wrongSide.getStart(ctx.sourceFile),
                            length: wrongSide.getWidth(ctx.sourceFile),
                            messageText: getNotMatchMsg(isConstructorSide),
                        }),
                    );
                }
            }
        }
    }

    function buildDiagnostic(input: Omit<ts.Diagnostic, 'category' | 'code' | 'file'>): ts.Diagnostic {
        return {
            ...input,
            category: ctx.ts.DiagnosticCategory.Error,
            code: 0,
            file: ctx.sourceFile,
            messageText: `[ng-helper] ${input.messageText as string}`,
        };
    }

    function resolveIdentifier(node: ts.Identifier): ts.Declaration | undefined {
        const symbol = ctx.typeChecker.getSymbolAtLocation(node);
        if (symbol) {
            const declarations = symbol.getDeclarations();
            if (declarations && declarations.length > 0) {
                return declarations[0];
            }
        }
    }
}

function getNotMatchMsg(isConstructorSide: boolean): string {
    return isConstructorSide ? 'Constructor parameter not match $inject element.' : '$inject element not match constructor parameter.';
}

function getConstructorParenPosition(ctx: PluginContext, constructor: ts.ConstructorDeclaration): { left: number; right: number } {
    const constructorStartAt = constructor.getStart(ctx.sourceFile);
    const constructorText = constructor.getText(ctx.sourceFile);
    // 获取左括号的位置
    const left = constructorStartAt + constructorText.indexOf('(');
    // 获取右括号的位置
    const right = constructorStartAt + constructorText.indexOf(')');
    return { left, right };
}
