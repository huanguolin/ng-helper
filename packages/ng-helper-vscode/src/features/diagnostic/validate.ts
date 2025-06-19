import { parseHtmlFragmentWithCache, type DocumentFragment } from '@ng-helper/shared/lib/html';
import { getNgDiagnosticResult, type NgDiagnosticAdditionalInfo } from '@ng-helper/shared/lib/ngDiagnostic';
import { camelCase, kebabCase } from 'change-case';
import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range, TextDocument } from 'vscode';

import { logger } from '../../logger';
import type { NgContext } from '../../ngContext';
import { normalizePath } from '../../utils';
import { getComponentsAndDirectives } from '../semantic/utils';

const myLogger = logger.prefixWith('diagnostic');

export async function validate(
    ngContext: NgContext,
    diagnosticCollection: DiagnosticCollection,
    document: TextDocument,
) {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const filePath = normalizePath(document.uri.fsPath); // 注意：这里的处理方式要一致，否则缓存会失效
    const meta = { filePath, version: document.version };

    const htmlAst = parseHtmlFragmentWithCache(text, meta);

    const additionalInfo = await getExpressionAttrMaps(ngContext, htmlAst, filePath);

    const ngDiagnostics = getNgDiagnosticResult(text, {
        additionalInfo,
        meta,
    });

    for (const ngDiagnostic of ngDiagnostics) {
        const d = new Diagnostic(
            new Range(document.positionAt(ngDiagnostic.start), document.positionAt(ngDiagnostic.end)),
            ngDiagnostic.message,
            DiagnosticSeverity.Error,
        );
        d.source = '[ng-helper]';
        diagnostics.push(d);
    }

    // Set diagnostics
    diagnosticCollection.set(document.uri, diagnostics);
}

async function getExpressionAttrMaps(
    ngContext: NgContext,
    htmlAst: DocumentFragment,
    filePath: string,
): Promise<NgDiagnosticAdditionalInfo | undefined> {
    const { components, maybeDirectives } = getComponentsAndDirectives(htmlAst);

    let componentExpressionAttrMap: Record<string, string[]> | undefined;
    if (components.length) {
        try {
            const componentsExpressionAttrs = await ngContext.rpcApi.listComponentsExpressionAttrs({
                params: { componentNames: components.map((x) => camelCase(x)), fileName: filePath },
            });
            if (componentsExpressionAttrs) {
                componentExpressionAttrMap = kebabCaseRecord(componentsExpressionAttrs);
            }
        } catch (error) {
            myLogger.logError('listComponentsExpressionAttrs failed', error);
        }
    }

    let directiveExpressionAttrMap: Record<string, string[]> | undefined;
    if (maybeDirectives.length) {
        try {
            const directivesExpressionAttrs = await ngContext.rpcApi.listDirectivesExpressionAttrs({
                params: { maybeDirectiveNames: maybeDirectives.map((x) => camelCase(x)), fileName: filePath },
            });
            if (directivesExpressionAttrs) {
                directiveExpressionAttrMap = kebabCaseRecord(directivesExpressionAttrs);
            }
        } catch (error) {
            myLogger.logError('listDirectivesExpressionAttrs failed', error);
        }
    }

    if (!componentExpressionAttrMap && !directiveExpressionAttrMap) {
        return undefined;
    }

    return {
        componentExpressionAttrMap: componentExpressionAttrMap ?? {},
        directiveExpressionAttrMap: directiveExpressionAttrMap ?? {},
    };
}

function kebabCaseRecord(record: Record<string, string[]>) {
    return Object.fromEntries(
        Object.entries(record).map(([key, value]) => [kebabCase(key), value.map((x) => kebabCase(x))]),
    );
}
