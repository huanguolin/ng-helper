import type { CursorAtAttrValueInfo, CursorAtContext, CursorAtTemplateInfo } from '@ng-helper/shared/lib/cursorAt';
import { SPACE } from '@ng-helper/shared/lib/html';
import { getNgScopes } from '@ng-helper/shared/lib/ngScope';
import { isComponentTagName, isNgBuiltinDirective, isNgUserCustomAttr } from '@ng-helper/shared/lib/ngUtils';
import { NgCtrlInfo, NgTypeInfo } from '@ng-helper/shared/lib/plugin';
import {
    CancellationToken,
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    Range,
    SnippetString,
    TextDocument,
    type Position,
} from 'vscode';

import { checkCancellation } from '../../asyncUtils';
import { EXT_MARK } from '../../constants';
import type { RpcApi } from '../../service/tsService/rpcApi';
import { getContextString, getControllerNameInfo, getCorrespondingScriptFileName, isComponentHtml } from '../utils';

import { builtinFilterNameCompletion } from './builtin';

import type { CompletionParamObj } from '.';

export async function templateOrAttrValueCompletion({
    document,
    position,
    cancelToken,
    cursorAtInfo,
    ngContext,
    completionContext,
}: CompletionParamObj<CursorAtTemplateInfo | CursorAtAttrValueInfo> & { position: Position }): Promise<
    CompletionList<CompletionItem> | undefined
> {
    const { type, value } = getContextString(cursorAtInfo);

    checkCancellation(cancelToken);

    const isPropAccessTriggerChar = completionContext.triggerCharacter === '.';
    const isUndefinedTriggerChar = typeof completionContext.triggerCharacter === 'undefined';

    if (isPropAccessTriggerChar && type === 'propertyAccess') {
        return await getTypeCompletion({
            document,
            cursorAtInfo,
            contextString: value,
            rpcApi: ngContext.rpcApi,
            cancelToken: cancelToken,
        });
    } else if (isUndefinedTriggerChar) {
        if (type === 'filterName') {
            return await getFilterNameCompletion({
                document,
                rpcApi: ngContext.rpcApi,
                cancelToken,
            });
        } else if (type === 'identifier') {
            // ctrl 输入第一个字符 c 后，便成为 'identifier' 状态。
            // 其他的类似 ng-repeat 的 item/$index/$first 等，也是 'identifier' 状态。
            const items = getLocalVarsCompletion(cursorAtInfo.context);
            if (isComponentHtml(document)) {
                const ctrlAsItem = await getComponentCtrlAsCompletion({
                    document,
                    cursorAtInfo,
                    rpcApi: ngContext.rpcApi,
                    cancelToken,
                });
                if (ctrlAsItem) {
                    items.push(ctrlAsItem);
                }
            }
            return buildLocalVarsCompletion(items, position);
        }
    }
}

async function getTypeCompletion({
    document,
    cursorAtInfo,
    contextString,
    rpcApi,
    cancelToken,
}: {
    document: TextDocument;
    cursorAtInfo: CursorAtTemplateInfo | CursorAtAttrValueInfo;
    contextString: string;
    rpcApi: RpcApi;
    cancelToken: CancellationToken;
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
        return await getTypeCompletionQuery({ document, ctrlInfo, prefix: contextString, rpcApi, cancelToken });
    }
}

async function getTypeCompletionQuery({
    document,
    ctrlInfo,
    prefix,
    rpcApi,
    cancelToken,
}: {
    document: TextDocument;
    ctrlInfo?: NgCtrlInfo;
    prefix: string;
    rpcApi: RpcApi;
    cancelToken: CancellationToken;
}) {
    const scriptFilePath = await getCorrespondingScriptFileName(document, ctrlInfo?.controllerName);
    if (!scriptFilePath) {
        return;
    }

    checkCancellation(cancelToken);

    const res = ctrlInfo
        ? await rpcApi.getControllerTypeCompletionApi({
              cancelToken,
              params: { fileName: scriptFilePath, prefix, ...ctrlInfo },
          })
        : await rpcApi.getComponentTypeCompletionApi({
              cancelToken,
              params: { fileName: scriptFilePath, prefix },
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

        if (x.isFilter && x.paramNames?.length) {
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
    rpcApi,
    cancelToken,
}: {
    document: TextDocument;
    cursorAtInfo: CursorAtTemplateInfo | CursorAtAttrValueInfo;
    rpcApi: RpcApi;
    cancelToken: CancellationToken;
}): Promise<CompletionItem | undefined> {
    let ctrlAs: string | undefined;
    if (cursorAtInfo.type === 'template') {
        ctrlAs = await getComponentControllerAsCompletion(document, rpcApi, cancelToken);
    } else if (
        isComponentTagName(cursorAtInfo.tagName) ||
        isNgBuiltinDirective(cursorAtInfo.attrName) ||
        isNgUserCustomAttr(cursorAtInfo.attrName)
    ) {
        ctrlAs = await getComponentControllerAsCompletion(document, rpcApi, cancelToken);
    }

    if (!ctrlAs) {
        return;
    }

    const item = new CompletionItem(ctrlAs, CompletionItemKind.Property);
    item.filterText = ctrlAs;
    item.detail = EXT_MARK;
    item.documentation = 'Controller As';
    return item;
}

function getLocalVarsCompletion(context: CursorAtContext[]): CompletionItem[] {
    const scopes = getNgScopes(context);
    return scopes.flatMap((s) =>
        s.vars.map((v) => {
            const item = new CompletionItem(v.name, CompletionItemKind.Property);
            item.filterText = v.name;
            item.detail = EXT_MARK;
            item.documentation = `${s.kind} scope`;
            return item;
        }),
    );
}

function buildLocalVarsCompletion(items: CompletionItem[], position: Position): CompletionList<CompletionItem> {
    items.forEach((x, i) => {
        if (x.filterText?.startsWith('$')) {
            // 默认的 range 是 CurrentWord, 默认没有包含 $ 字符，
            // 所以这里调整一下，把它含进去。否则确认补全后会多出来一个 $ 字符。
            x.range = new Range(position.translate(0, -1), position);
        }
        x.sortText = i.toString().padStart(3, '0');
    });

    return new CompletionList(items, false);
}

async function getComponentControllerAsCompletion(
    document: TextDocument,
    rpcApi: RpcApi,
    cancelToken: CancellationToken,
): Promise<string | undefined> {
    const scriptFilePath = await getCorrespondingScriptFileName(document);

    checkCancellation(cancelToken);

    if (!scriptFilePath) {
        return;
    }

    return await rpcApi.getComponentControllerAsApi({
        params: { fileName: scriptFilePath },
        cancelToken,
    });
}

async function getFilterNameCompletion({
    document,
    rpcApi,
    cancelToken,
}: {
    document: TextDocument;
    rpcApi: RpcApi;
    cancelToken: CancellationToken;
}): Promise<CompletionList | undefined> {
    const builtinList = builtinFilterNameCompletion();

    const scriptFilePath = await getCorrespondingScriptFileName(document);
    if (!scriptFilePath) {
        return new CompletionList(builtinList, false);
    }

    checkCancellation(cancelToken);

    const res = await rpcApi.getFilterNameCompletionApi({ cancelToken, params: { fileName: scriptFilePath } });
    if (res) {
        const custom = buildCompletionList(res);
        return new CompletionList(builtinList.concat(custom.items), false);
    } else {
        return new CompletionList(builtinList, false);
    }
}
