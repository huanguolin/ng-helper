import type { InjectionCheckMode } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';
import type tsserver from 'typescript/lib/tsserverlibrary';

import { ngHelperTsService } from '../ngHelperTsService';
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

export function overrideGetSemanticDiagnostics({
    proxy,
    info,
}: {
    proxy: tsserver.LanguageService;
    info: tsserver.server.PluginCreateInfo;
}) {
    proxy.getSemanticDiagnostics = (fileName: string) => {
        const prior = info.languageService.getSemanticDiagnostics(fileName);
        const checkMode = ngHelperTsService.getConfig()?.injectionCheckMode;
        if (!ngHelperTsService.isExtensionActivated() || !isValidCheckMode(checkMode)) {
            return prior;
        }

        if (isDtsFile(fileName)) {
            return prior;
        }

        const ctx = ngHelperTsService.getContext(fileName);
        if (!ctx || !isAngularFile(ctx)) {
            return prior;
        }

        try {
            const diagnostics = diagnoseInjection(ctx, checkMode);
            ctx.logger.info('diagnoseInjection():', diagnostics);
            if (diagnostics.length > 0) {
                prior.push(...diagnostics);
            }
        } catch (error) {
            ctx.logger.error('diagnoseInjection():', (error as Error).message, (error as Error).stack);
        }

        return prior;
    };
}

function isValidCheckMode(checkMode: InjectionCheckMode | undefined): checkMode is InjectionCheckMode {
    return !!checkMode && ['strict_equal', 'count_match', 'ignore_case_word_match'].includes(checkMode);
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
                    checkFunction(declaration);
                } else if (ctx.ts.isClassDeclaration(declaration)) {
                    checkClass(declaration);
                }
            }
        } else if (ctx.ts.isFunctionExpression(node)) {
            // 这种情况不用检查，因为这种写法无法添加 $inject 属性
        }
    }

    function checkArray(arrNode: ts.ArrayLiteralExpression) {
        logger.info('enter checkArray().');

        const funcNode = arrNode.elements[arrNode.elements.length - 1];
        let fnDeclaration: ts.FunctionLikeDeclarationBase | undefined;
        if (ctx.ts.isIdentifier(funcNode)) {
            const declaration = resolveIdentifier(funcNode);
            if (declaration && ctx.ts.isFunctionDeclaration(declaration)) {
                fnDeclaration = declaration;
            }
        } else if (ctx.ts.isFunctionExpression(funcNode)) {
            fnDeclaration = funcNode;
        }

        if (!fnDeclaration) {
            return;
        }

        const injectionArr = arrNode.elements.slice(0, -1);
        const paramArr = fnDeclaration.parameters;
        checkMatch(injectionArr, paramArr);
    }

    function checkClass(classNode: ts.ClassLikeDeclarationBase) {
        logger.info('enter checkClass().');

        const staticInjectField = getStaticPublicInjectionField(ctx, classNode);
        if (
            !staticInjectField ||
            !staticInjectField.initializer ||
            !ctx.ts.isArrayLiteralExpression(staticInjectField.initializer)
        ) {
            return;
        }

        const constructor = getConstructor(ctx, classNode);
        if (!constructor) {
            return;
        }

        checkMatch(staticInjectField.initializer.elements, constructor.parameters);
    }

    function checkFunction(funcNode: ts.FunctionDeclaration) {
        logger.info('enter checkFunction().');

        if (!funcNode.name) {
            return;
        }

        const funcNameSymbol = ctx.typeChecker.getSymbolAtLocation(funcNode.name);
        if (!funcNameSymbol) {
            return;
        }

        const injection = findInjection(funcNameSymbol);
        if (!injection) {
            return;
        }

        checkMatch(injection.elements, funcNode.parameters);

        function findInjection(funcSymbol: ts.Symbol): ts.ArrayLiteralExpression | undefined {
            // XController.$inject = ['a', 'b'];
            // function XController(a, b) { }
            let result: ts.ArrayLiteralExpression | undefined;
            visit(ctx.sourceFile);
            return result;

            function visit(node: ts.Node) {
                if (
                    ctx.ts.isBinaryExpression(node) &&
                    ctx.ts.isPropertyAccessExpression(node.left) &&
                    ctx.ts.isIdentifier(node.left.name) &&
                    node.left.name.text === '$inject' &&
                    ctx.ts.isArrayLiteralExpression(node.right) &&
                    ctx.ts.isIdentifier(node.left.expression)
                ) {
                    const symbol = ctx.typeChecker.getSymbolAtLocation(node.left.expression);
                    if (symbol === funcSymbol) {
                        result = node.right;
                    }
                }

                if (!result) {
                    ctx.ts.forEachChild(node, visit);
                }
            }
        }
    }

    function checkMatch(
        injectionArr: ts.Expression[] | ts.NodeArray<ts.Expression>,
        paramArr: ts.ParameterDeclaration[] | ts.NodeArray<ts.ParameterDeclaration>,
    ) {
        logger.info(
            'enter checkMatch(), injectionArr.length:',
            injectionArr.length,
            'paramArr.length:',
            paramArr.length,
        );

        if (injectionArr.length === 0 && paramArr.length === 0) {
            return;
        }

        if (checkMode === 'count_match') {
            if (injectionArr.length === paramArr.length) {
                return;
            }
            const isInjectionSide = injectionArr.length > paramArr.length;
            const theIndex = Math.min(injectionArr.length, paramArr.length);
            const theNode = isInjectionSide ? injectionArr[theIndex] : paramArr[theIndex];
            return diagnostics.push(
                buildDiagnostic({
                    start: theNode.getStart(ctx.sourceFile),
                    length: theNode.getWidth(ctx.sourceFile),
                }),
            );
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
                        }),
                    );
                }

                if (!ctx.ts.isStringLiteral(injectEle)) {
                    return buildDiagnostic({
                        start: injectEle.getStart(ctx.sourceFile),
                        length: injectEle.getWidth(ctx.sourceFile),
                        messageText: 'Injection element must be literal string.',
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
                        }),
                    );
                }
            }
        }
    }

    function buildDiagnostic(
        input: Omit<ts.Diagnostic, 'category' | 'code' | 'file' | 'messageText'> & { messageText?: string },
    ): ts.Diagnostic {
        const messageText = input.messageText || `Injection element mismatch (mode: '${checkMode}').`;
        return {
            ...input,
            category: ctx.ts.DiagnosticCategory.Error,
            code: 0,
            file: ctx.sourceFile,
            messageText: `[ng-helper] ${messageText}`,
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
