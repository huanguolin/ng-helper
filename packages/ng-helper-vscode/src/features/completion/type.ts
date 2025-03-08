import type { CursorAtAttrValueInfo, CursorAtContext, CursorAtTemplateInfo } from '@ng-helper/shared/lib/cursorAt';
import { SPACE } from '@ng-helper/shared/lib/html';
import { getNgScopes } from '@ng-helper/shared/lib/ngScope';
import { NgCtrlInfo, NgTypeInfo } from '@ng-helper/shared/lib/plugin';
import {
    CancellationToken,
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    SnippetString,
    TextDocument,
} from 'vscode';

import { checkCancellation } from '../../asyncUtils';
import { EXT_MARK } from '../../constants';
import {
    getComponentControllerAsApi,
    getComponentTypeCompletionApi,
    getControllerTypeCompletionApi,
    getFilterNameCompletionApi,
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

import { builtinFilterNameCompletion } from './builtin';

import type { CompletionParamObj } from '.';

export async function templateOrAttrValueCompletion({
    document,
    port,
    vscodeCancelToken,
    cursorAtInfo,
    context,
}: CompletionParamObj<CursorAtTemplateInfo | CursorAtAttrValueInfo>): Promise<
    CompletionList<CompletionItem> | undefined
> {
    const { type, value } = getContextString(cursorAtInfo);

    checkCancellation(vscodeCancelToken);

    const isPropAccessTriggerChar = context.triggerCharacter === '.';
    const isUndefinedTriggerChar = typeof context.triggerCharacter === 'undefined';

    if (isPropAccessTriggerChar && type === 'propertyAccess') {
        return await getTypeCompletion({
            document,
            cursorAtInfo,
            contextString: value,
            port,
            vscodeCancelToken,
        });
    } else if (isUndefinedTriggerChar) {
        if (type === 'filterName') {
            return await getFilterNameCompletion({
                document,
                port,
                vscodeCancelToken,
            });
        } else if (type === 'identifier') {
            // ctrl 输入第一个字符 c 后，便成为 'identifier' 状态。
            // 其他的类似 ng-repeat 的 item/$index/$first 等，也是 'identifier' 状态。
            const result = getLocalVarsCompletion(cursorAtInfo.context);
            if (isComponentHtml(document)) {
                const ctrlItemList = await getComponentCtrlAsCompletion({
                    document,
                    cursorAtInfo,
                    port,
                    vscodeCancelToken,
                });
                if (ctrlItemList) {
                    result.items.push(...ctrlItemList.items);
                }
            }
            return result;
        }
    }
}

async function getTypeCompletion({
    document,
    cursorAtInfo,
    contextString,
    port,
    vscodeCancelToken,
}: {
    document: TextDocument;
    cursorAtInfo: CursorAtTemplateInfo | CursorAtAttrValueInfo;
    contextString: string;
    port: number;
    vscodeCancelToken: CancellationToken;
}) {
    const isComponent = isComponentHtml(document);
    const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
    if (!isComponent && !ctrlInfo) {
        return;
    }

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

    checkCancellation(vscodeCancelToken);

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
        const item = new CompletionItem(
            x.name,
            x.isFunction
                ? CompletionItemKind.Method
                : x.isFilter
                  ? CompletionItemKind.Function
                  : CompletionItemKind.Field,
        );

        if (x.isFunction) {
            // 分两段补全，第一段是函数名，第二段是参数
            let snippet = `${x.name}$1(`;
            snippet += x.paramNames!.map((x, i) => `\${${i + 2}:${x}}`).join(', ');
            snippet += ')';
            item.insertText = new SnippetString(snippet);
        } else if (x.isFilter && x.paramNames?.length) {
            let snippet = x.name + SPACE;
            snippet += x.paramNames.map((x, i) => `:\${${i + 1}:${x}}`).join(' ');
            item.insertText = new SnippetString(snippet);
        }

        if (x.isFilter) {
            item.detail = `(filter) ${x.name}${x.typeString}`;
        } else {
            item.detail = `(${x.kind}) ${x.name}: ${x.typeString}`;
        }
        item.documentation = x.document;
        item.sortText = i.toString().padStart(3, '0');
        return item;
    });
    return new CompletionList(items, false);
}

async function getComponentCtrlAsCompletion({
    document,
    cursorAtInfo,
    port,
    vscodeCancelToken,
}: {
    document: TextDocument;
    cursorAtInfo: CursorAtTemplateInfo | CursorAtAttrValueInfo;
    port: number;
    vscodeCancelToken: CancellationToken;
}): Promise<CompletionList<CompletionItem> | undefined> {
    if (cursorAtInfo.type === 'template') {
        return await getComponentControllerAsCompletion(document, port, vscodeCancelToken);
    } else if (
        isComponentTagName(cursorAtInfo.tagName) ||
        isNgBuiltinDirective(cursorAtInfo.attrName) ||
        isNgUserCustomAttr(cursorAtInfo.attrName)
    ) {
        return await getComponentControllerAsCompletion(document, port, vscodeCancelToken);
    }
}

function getLocalVarsCompletion(context: CursorAtContext[]): CompletionList<CompletionItem> {
    const scopes = getNgScopes(context);
    const items = scopes.flatMap((s, i) =>
        s.vars.map((v, j) => {
            const item = new CompletionItem(v.name, CompletionItemKind.Property);
            item.sortText = (i + j).toString().padStart(3, '0');
            item.detail = s.kind;
            return item;
        }),
    );
    return new CompletionList(items, false);
}

async function getComponentControllerAsCompletion(
    document: TextDocument,
    port: number,
    vscodeCancelToken: CancellationToken,
) {
    const scriptFilePath = (await getCorrespondingScriptFileName(document))!;

    checkCancellation(vscodeCancelToken);

    if (!(await checkNgHelperServerRunning(scriptFilePath, port))) {
        return;
    }

    checkCancellation(vscodeCancelToken);

    const res = await getComponentControllerAsApi({ port, info: { fileName: scriptFilePath }, vscodeCancelToken });
    if (res) {
        const item = new CompletionItem(res);
        // 往前排
        item.sortText = '0';
        item.detail = EXT_MARK;
        return new CompletionList([item], false);
    }
}

async function getFilterNameCompletion({
    document,
    port,
    vscodeCancelToken,
}: {
    document: TextDocument;
    port: number;
    vscodeCancelToken: CancellationToken;
}): Promise<CompletionList | undefined> {
    const builtinList = builtinFilterNameCompletion();

    const scriptFilePath = (await getCorrespondingScriptFileName(document))!;
    if (!(await checkNgHelperServerRunning(scriptFilePath, port))) {
        return new CompletionList(builtinList, false);
    }

    checkCancellation(vscodeCancelToken);

    const res = await getFilterNameCompletionApi({ port, vscodeCancelToken, info: { fileName: scriptFilePath } });
    if (res) {
        const custom = buildCompletionList(res);
        return new CompletionList(builtinList.concat(custom.items), false);
    } else {
        return new CompletionList(builtinList, false);
    }
}
