import { getCursorAtInfo, type CursorAtAttrValueInfo, type CursorAtTemplateInfo } from '@ng-helper/shared/lib/cursorAt';
import { getActiveParameterIndex, getFnCallNode } from '@ng-helper/shared/lib/fnCallNgSyntax';
import type { NgHoverInfo } from '@ng-helper/shared/lib/plugin';
import {
    languages,
    SignatureHelp,
    SignatureInformation,
    ParameterInformation,
    type TextDocument,
    type Position,
    type CancellationToken,
} from 'vscode';

import { checkCancellation, createCancellationTokenSource, withTimeoutAndMeasure } from '../../asyncUtils';
import type { NgContext } from '../../ngContext';
import { buildCursor, normalizePath } from '../../utils';
import { onTypeHover } from '../hover/utils';
import { getControllerNameInfo, isComponentHtmlWithConfig } from '../utils';

export const triggerChars = ['(', ','];

export function registerSignatureHelp(ngContext: NgContext): void {
    ngContext.vscodeContext.subscriptions.push(
        languages.registerSignatureHelpProvider(
            'html',
            {
                async provideSignatureHelp(document, position, token, _context): Promise<SignatureHelp | undefined> {
                    if (!ngContext.isNgProjectDocument(document)) {
                        return;
                    }

                    const cancelTokenSource = createCancellationTokenSource(token);
                    return await withTimeoutAndMeasure(
                        'provideSignatureHelp',
                        () => provideSignatureHelp({ document, position, cancelToken: token, ngContext }),
                        { cancelTokenSource },
                    );
                },
            },
            ...triggerChars,
        ),
    );
}

async function provideSignatureHelp({
    document,
    position,
    ngContext,
    cancelToken,
}: {
    document: TextDocument;
    position: Position;
    ngContext: NgContext;
    cancelToken: CancellationToken;
}) {
    const cursorAtInfo = getCursorAtInfo(document.getText(), buildCursor(document, position), {
        filePath: normalizePath(document.uri.fsPath), // 注意：这里的处理方式要一致，否则缓存会失效
        version: document.version,
    });

    if (cursorAtInfo.type !== 'template' && cursorAtInfo.type !== 'attrValue') {
        return;
    }

    const cursorAt = cursorAtInfo.relativeCursorAt;
    const ngExprStr = cursorAtInfo.type === 'template' ? cursorAtInfo.template : cursorAtInfo.attrValue;
    const callNode = getFnCallNode(ngExprStr, cursorAt);
    if (!callNode) {
        return;
    }

    const activeParameterIndex = getActiveParameterIndex(callNode, cursorAt);
    if (activeParameterIndex === -1) {
        return;
    }

    const newCursorAtInfo = { ...cursorAtInfo };
    // 将光标移到函数名字上
    newCursorAtInfo.relativeCursorAt -= cursorAt - (callNode.callee.end - 1);

    const hoverInfo = await getMethodHoverInfo({
        document,
        ngContext,
        cursorAtInfo: newCursorAtInfo,
        cancelToken,
    });
    if (!hoverInfo) {
        return;
    }

    checkCancellation(cancelToken);

    return buildSignatureHelp(hoverInfo, activeParameterIndex);
}

async function getMethodHoverInfo({
    document,
    ngContext,
    cursorAtInfo,
    cancelToken,
}: {
    document: TextDocument;
    cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo;
    ngContext: NgContext;
    cancelToken: CancellationToken;
}) {
    const componentTemplateFileSuffix = ngContext.config.userConfig.componentTemplateFileSuffix!;
    return await onTypeHover({
        type: 'hover',
        document,
        cursorAtInfo,
        // eslint-disable-next-line
        onHoverFilterName: async () => undefined,
        onHoverLocalType: () => undefined,
        onHoverType: async (scriptFilePath, contextString, cursorAt, hoverPropName) => {
            checkCancellation(cancelToken);

            if (isComponentHtmlWithConfig(document, componentTemplateFileSuffix)) {
                return await ngContext.rpcApi.getComponentTypeHoverApi({
                    cancelToken,
                    params: { fileName: scriptFilePath, contextString, cursorAt, hoverPropName },
                });
            }

            const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
            if (ctrlInfo) {
                return await ngContext.rpcApi.getControllerTypeHoverApi({
                    cancelToken,
                    params: { fileName: scriptFilePath, contextString, cursorAt, hoverPropName, ...ctrlInfo },
                });
            }
        },
    });
}

function buildSignatureHelp(hoverInfo: NgHoverInfo, activeParameterIndex: number): SignatureHelp | undefined {
    if (!hoverInfo.isMethod) {
        return;
    }

    // remove '(method) ' from start
    hoverInfo.formattedTypeString = hoverInfo.formattedTypeString.slice('(method) '.length);

    const signature = new SignatureInformation(hoverInfo.formattedTypeString, hoverInfo.document);
    signature.parameters =
        hoverInfo.parameters?.map((p) => {
            const paramStr = `${p.name}: ${p.typeString}`;
            const start = hoverInfo.formattedTypeString.indexOf(paramStr);
            const end = start + paramStr.length;
            return new ParameterInformation([start, end], p.document);
        }) ?? [];

    const sigHelp = new SignatureHelp();
    sigHelp.signatures = [signature];
    sigHelp.activeParameter = activeParameterIndex;
    sigHelp.activeSignature = 0; // 目前不考虑重载

    return sigHelp;
}
