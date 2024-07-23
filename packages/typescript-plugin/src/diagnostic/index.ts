import type ts from 'typescript';
import type tsserver from 'typescript/lib/tsserverlibrary';

import { GetContextFn, PluginContext } from '../type';
import { findClassDeclaration } from '../utils/common';
import { isComponentTsFile, isControllerTsFile, isServiceTsFile } from '../utils/ng';

import { getConstructor, getStaticPublicInjectionField } from './utils';

export function overrideGetSemanticDiagnostics({
    proxy,
    info,
    getContext,
}: {
    proxy: tsserver.LanguageService;
    info: tsserver.server.PluginCreateInfo;
    getContext: GetContextFn;
}) {
    proxy.getSemanticDiagnostics = (fileName: string) => {
        const prior = info.languageService.getSemanticDiagnostics(fileName);

        if (!isComponentTsFile(fileName) && !isControllerTsFile(fileName) && !isServiceTsFile(fileName)) {
            return prior;
        }

        const ctx = getContext(fileName);
        if (!ctx) {
            return prior;
        }

        try {
            const diagnostic = getTsInjectionDiagnostic(ctx);
            ctx.logger.info('getSemanticDiagnostics():', diagnostic);
            if (diagnostic) {
                prior.push(diagnostic);
            }
        } catch (error) {
            ctx.logger.error('getSemanticDiagnostics():', (error as Error).message, (error as Error).stack);
        }

        return prior;
    };
}

function getTsInjectionDiagnostic(ctx: PluginContext): ts.Diagnostic | undefined {
    const logger = ctx.logger.prefix('getTsInjectionDiagnostics()');
    const classNode = findClassDeclaration(ctx, ctx.sourceFile);
    if (!classNode) {
        return;
    }

    const staticInjectField = getStaticPublicInjectionField(ctx, classNode);
    if (!staticInjectField) {
        logger.info('miss staticInjectField');
        return;
    }

    const constructor = getConstructor(ctx, classNode);
    if (!constructor) {
        logger.info('miss constructor');
        return;
    }

    // 暂不考虑不合理的情况
    if (!staticInjectField.initializer || !ctx.ts.isArrayLiteralExpression(staticInjectField.initializer)) {
        logger.info('miss staticInjectField.initializer');
        return;
    }

    const injectionArray = staticInjectField.initializer.elements;
    const constructorParams = constructor.parameters;
    if (injectionArray.length === 0 && constructorParams.length === 0) {
        logger.info('no injection');
        return;
    }

    if (injectionArray.length === 0) {
        const { left, right } = getConstructorParenPosition(ctx, constructor);
        return buildDiagnostic({
            start: left,
            length: right - left + 1,
            messageText: getNotMatchMsg(true),
        });
    } else if (constructorParams.length === 0) {
        const { left, right } = getConstructorParenPosition(ctx, constructor);
        return buildDiagnostic({
            start: left,
            length: right - left + 1,
            messageText: getNotMatchMsg(true),
        });
    } else {
        for (let i = 0; i < Math.max(injectionArray.length, constructorParams.length); i++) {
            const injectEle = injectionArray[i];
            const param = constructorParams[i];

            if (!injectEle || !param) {
                const existOne = injectEle || param;
                return buildDiagnostic({
                    start: existOne.getStart(ctx.sourceFile),
                    length: existOne.getWidth(ctx.sourceFile),
                    messageText: getNotMatchMsg(!!param),
                });
            }

            if (!ctx.ts.isStringLiteral(injectEle)) {
                return buildDiagnostic({
                    start: injectEle.getStart(ctx.sourceFile),
                    length: injectEle.getWidth(ctx.sourceFile),
                    messageText: '$inject element must be literal string.',
                });
            }

            if (injectEle.text.toLowerCase() !== param.name.getText(ctx.sourceFile).toLowerCase()) {
                const isConstructorSide = injectionArray.length <= constructorParams.length;
                const wrongSide = isConstructorSide ? param : injectEle;
                return buildDiagnostic({
                    start: wrongSide.getStart(ctx.sourceFile),
                    length: wrongSide.getWidth(ctx.sourceFile),
                    messageText: getNotMatchMsg(isConstructorSide),
                });
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

function getNotMatchMsg(isConstructorSide: boolean): string {
    return isConstructorSide ? 'Constructor parameter not match $inject element.' : '$inject element not match constructor parameter.';
}
