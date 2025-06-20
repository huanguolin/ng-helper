import { parseHtmlFragmentWithCache, type DocumentFragment } from '@ng-helper/shared/lib/html';
import { getNgDiagnosticResult, type NgDiagnosticAdditionalInfo } from '@ng-helper/shared/lib/ngDiagnostic';
import { kebabCase } from 'change-case';
import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range, TextDocument } from 'vscode';

import { logger } from '../../logger';
import type { NgContext } from '../../ngContext';
import { normalizePath } from '../../utils';
import { resolveVirtualDocText } from '../inlineHtml/utils';
import { getComponentsAndDirectives } from '../semantic/utils';
import { isInlinedHtml } from '../utils';

const myLogger = logger.prefixWith('diagnostic');

export async function validate(
    ngContext: NgContext,
    diagnosticCollection: DiagnosticCollection,
    document: TextDocument,
) {
    // 注意：
    // inline html 似乎在提供了 virtualDocumentProvider 后，vscode 会自动触发诊断（返回嵌入式文档）。
    // 但是这种方式，实时性较差，修改后并不能立即诊断，只有保存后才会触发。
    // 所以这里不用嵌入式文档来诊断，直接从 js/ts 中提取文本诊断更好。
    if (isInlinedHtml(document)) {
        return;
    }

    let text = '';
    if (document.languageId === 'html') {
        text = document.getText();
    } else if (document.languageId === 'typescript' || document.languageId === 'javascript') {
        text = resolveVirtualDocText(document) ?? '';
    }

    if (!text) {
        return;
    }

    const filePath = normalizePath(document.uri.fsPath); // 注意：这里的处理方式要一致，否则缓存会失效
    const meta = { filePath, version: document.version };

    const htmlAst = parseHtmlFragmentWithCache(text, meta);

    const additionalInfo = await getExpressionAttrMaps(ngContext, htmlAst, filePath);

    const ngDiagnostics = getNgDiagnosticResult(text, {
        additionalInfo,
        meta,
    });

    const diagnostics: Diagnostic[] = [];
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
    const { componentNames, maybeDirectiveNames } = getComponentsAndDirectives(htmlAst);

    let componentExpressionAttrMap: Record<string, string[]> | undefined;
    if (componentNames.length) {
        try {
            const componentsExpressionAttrs = await ngContext.rpcApi.listComponentsExpressionAttrs({
                params: { componentNames, fileName: filePath },
            });
            if (componentsExpressionAttrs) {
                componentExpressionAttrMap = kebabCaseRecord(componentsExpressionAttrs);
            }
        } catch (error) {
            myLogger.logError('listComponentsExpressionAttrs failed', error);
        }
    }

    let directiveExpressionAttrMap: Record<string, string[]> | undefined;
    if (maybeDirectiveNames.length) {
        try {
            const directivesExpressionAttrs = await ngContext.rpcApi.listDirectivesExpressionAttrs({
                params: { maybeDirectiveNames, fileName: filePath },
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
