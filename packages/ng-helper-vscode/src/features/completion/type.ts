import type { CursorAtAttrValueInfo, CursorAtTemplateInfo } from '@ng-helper/shared/lib/cursorAt';
import { NgCtrlInfo, NgTypeInfo } from '@ng-helper/shared/lib/plugin';
import {
    CancellationToken,
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    SnippetString,
    TextDocument,
} from 'vscode';

import {
    getComponentControllerAsApi,
    getComponentTypeCompletionApi,
    getControllerTypeCompletionApi,
} from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import {
    getContextString,
    getControllerNameInfo,
    getCorrespondingScriptFileName,
    isComponentHtml,
    isComponentTagName,
    isNgBuiltinDirective,
    isNgUserCustomAttr,
} from '../utils';

import type { CompletionParamObj } from '.';

export async function templateOrAttrValueCompletion({
    document,
    port,
    vscodeCancelToken,
    cursorAtInfo,
    context,
    noRegisterTriggerChar,
}: CompletionParamObj<CursorAtTemplateInfo | CursorAtAttrValueInfo>): Promise<
    CompletionList<CompletionItem> | undefined
> {
    if (noRegisterTriggerChar && typeof context.triggerCharacter === 'undefined') {
        return await getCtrlCompletion({ document, cursorAtInfo, port, vscodeCancelToken });
    } else if (!noRegisterTriggerChar && context.triggerCharacter === '.') {
        return await getTypeCompletion({ document, cursorAtInfo, port, vscodeCancelToken });
    }
}

async function getTypeCompletion({
    document,
    cursorAtInfo,
    port,
    vscodeCancelToken,
}: {
    document: TextDocument;
    cursorAtInfo: CursorAtTemplateInfo | CursorAtAttrValueInfo;
    port: number;
    vscodeCancelToken: CancellationToken;
}) {
    const isComponent = isComponentHtml(document);
    const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
    if (!isComponent && !ctrlInfo) {
        return;
    }

    const contextString = getContextString(cursorAtInfo);
    switch (contextString.type) {
        case 'none':
        case 'literal':
            // do nothing
            return;
        case 'filterName':
            // TODO: support filter name hover
            break;
        case 'identifier':
        case 'propertyAccess':
            return await checkAndCallApi(contextString.value);
    }

    async function checkAndCallApi(contextString: string) {
        const isTemplateValue = cursorAtInfo.type === 'template';
        const isAttrValueAndCompletable =
            cursorAtInfo.type === 'attrValue' &&
            (isComponentTagName(cursorAtInfo.tagName) ||
                isNgBuiltinDirective(cursorAtInfo.attrName) ||
                isNgUserCustomAttr(cursorAtInfo.attrName));
        if (isTemplateValue || isAttrValueAndCompletable) {
            return await getTypeCompletionQuery({ document, ctrlInfo, prefix: contextString, port, vscodeCancelToken });
        }
    }
}

async function getTypeCompletionQuery({
    document,
    ctrlInfo,
    prefix,
    port,
    vscodeCancelToken,
}: {
    document: TextDocument;
    ctrlInfo?: NgCtrlInfo;
    prefix: string;
    port: number;
    vscodeCancelToken: CancellationToken;
}) {
    const scriptFilePath = (await getCorrespondingScriptFileName(document, ctrlInfo?.controllerName))!;
    if (!(await checkNgHelperServerRunning(scriptFilePath, port))) {
        return;
    }

    const res = ctrlInfo
        ? await getControllerTypeCompletionApi({
              vscodeCancelToken,
              port,
              info: { fileName: scriptFilePath, prefix, ...ctrlInfo },
          })
        : await getComponentTypeCompletionApi({
              vscodeCancelToken,
              port,
              info: { fileName: scriptFilePath, prefix },
          });
    if (res) {
        return buildCompletionList(res);
    }
}

function buildCompletionList(res: NgTypeInfo[]) {
    const items = res.map((x, i) => {
        const item = new CompletionItem(x.name, x.isFunction ? CompletionItemKind.Method : CompletionItemKind.Field);
        if (x.isFunction) {
            // 分两段补全，第一段是函数名，第二段是参数
            let snippet = `${x.name}$1(`;
            snippet += x.paramNames!.map((x, i) => `\${${i + 2}:${x}}`).join(', ');
            snippet += ')$0';
            item.insertText = new SnippetString(snippet);
        }
        item.detail = `(${x.kind}) ${x.name}: ${x.typeString}`;
        item.documentation = x.document;
        item.sortText = i.toString().padStart(3, '0');
        return item;
    });
    return new CompletionList(items, false);
}

async function getCtrlCompletion({
    document,
    cursorAtInfo,
    port,
    vscodeCancelToken,
}: {
    document: TextDocument;
    cursorAtInfo: CursorAtTemplateInfo | CursorAtAttrValueInfo;
    port: number;
    vscodeCancelToken: CancellationToken;
}) {
    if (isComponentHtml(document)) {
        if (cursorAtInfo.type === 'template') {
            return await getComponentControllerAsCompletion(document, port, vscodeCancelToken);
        } else if (
            isComponentTagName(cursorAtInfo.tagName) ||
            isNgBuiltinDirective(cursorAtInfo.attrName) ||
            isNgUserCustomAttr(cursorAtInfo.attrName)
        ) {
            return await getComponentControllerAsCompletion(document, port, vscodeCancelToken);
        }
    } else {
        const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
        if (ctrlInfo && ctrlInfo.controllerAs) {
            return new CompletionList([new CompletionItem(ctrlInfo.controllerAs)], false);
        }
    }
}

async function getComponentControllerAsCompletion(
    document: TextDocument,
    port: number,
    vscodeCancelToken: CancellationToken,
) {
    const scriptFilePath = (await getCorrespondingScriptFileName(document))!;

    if (!(await checkNgHelperServerRunning(scriptFilePath, port))) {
        return;
    }

    const res = await getComponentControllerAsApi({ port, info: { fileName: scriptFilePath }, vscodeCancelToken });
    if (res) {
        return new CompletionList([new CompletionItem(res)], false);
    }
}
