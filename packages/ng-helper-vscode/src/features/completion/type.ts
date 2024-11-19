import type { CursorAtAttrValueInfo, CursorAtTemplateInfo } from '@ng-helper/shared/lib/cursorAt';
import {
    getTextInTemplate,
    isContainsNgFilter,
    getBeforeCursorText,
    Cursor,
    getTheAttrWhileCursorAtValue,
    getHtmlTagAt,
} from '@ng-helper/shared/lib/html';
import { NgCtrlInfo, NgTypeInfo } from '@ng-helper/shared/lib/plugin';
import {
    CancellationToken,
    CompletionItem,
    CompletionItemKind,
    CompletionItemProvider,
    CompletionList,
    Position,
    SnippetString,
    TextDocument,
    languages,
} from 'vscode';

import { timeCost } from '../../debug';
import { getComponentTypeCompletionApi, getControllerTypeCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import {
    getControllerNameInfo,
    getControllerNameInfoFromHtml,
    getCorrespondingScriptFileName,
    isComponentHtml,
    isComponentTagName,
    isNgBuiltinDirective,
} from '../utils';

import { getComponentControllerAsCompletion } from './ctrl';

import type { CompletionParamObj } from '.';

export function type(port: number) {
    return languages.registerCompletionItemProvider('html', new TypeCompletionProvider(port), '.');
}

class TypeCompletionProvider implements CompletionItemProvider {
    constructor(private port: number) {}

    async provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
    ): Promise<CompletionList<CompletionItem> | undefined> {
        if (isComponentHtml(document)) {
            return timeCost('provideComponentTypeCompletion', async () => {
                return await this.provideComponentTypeCompletion({ document, position, token });
            });
        }

        const ctrlInfo = getControllerNameInfoFromHtml(document);
        if (ctrlInfo && ctrlInfo.controllerAs) {
            return timeCost('provideControllerTypeCompletion', async () => {
                return await this.provideControllerTypeCompletion({ document, position, ctrlInfo, token });
            });
        }
    }

    private async provideControllerTypeCompletion({
        document,
        position,
        ctrlInfo,
        token,
    }: {
        document: TextDocument;
        position: Position;
        ctrlInfo: NgCtrlInfo;
        token: CancellationToken;
    }): Promise<CompletionList<CompletionItem> | undefined> {
        const docText = document.getText();
        const cursor: Cursor = { at: document.offsetAt(position), isHover: false };

        // 模版 {{}} 中
        const tplText = getTextInTemplate(docText, cursor);
        if (tplText) {
            const prefix = getBeforeCursorText(tplText);
            if (prefix && !isContainsNgFilter(prefix)) {
                return await this.getControllerTypeCompletionItems({
                    document,
                    prefix,
                    ctrlInfo,
                    vscodeCancelToken: token,
                });
            }
        }

        // 组件属性值中 或者 ng-* 属性值中
        const tag = getHtmlTagAt(docText, cursor);
        if (tag) {
            const attr = getTheAttrWhileCursorAtValue(tag, cursor);
            if (attr && attr.value && (isComponentTagName(tag.tagName) || isNgBuiltinDirective(attr.name.text))) {
                let prefix = attr.value.text.slice(0, cursor.at - attr.value.start);
                if (prefix && !isContainsNgFilter(prefix)) {
                    prefix = processPrefix(attr.name.text, prefix);
                    if (prefix) {
                        return await this.getControllerTypeCompletionItems({
                            document,
                            prefix,
                            ctrlInfo,
                            vscodeCancelToken: token,
                        });
                    }
                }
            }
        }
    }

    private async provideComponentTypeCompletion({
        document,
        position,
        token,
    }: {
        document: TextDocument;
        position: Position;
        token: CancellationToken;
    }): Promise<CompletionList<CompletionItem> | undefined> {
        const docText = document.getText();
        const cursor: Cursor = { at: document.offsetAt(position), isHover: false };

        // 模版 {{}} 中
        const tplText = getTextInTemplate(docText, cursor);
        if (tplText) {
            const prefix = getBeforeCursorText(tplText);
            if (prefix && !isContainsNgFilter(prefix)) {
                return await this.getComponentTypeCompletionItems(document, prefix, token);
            }
        }

        // 组件属性值中 或者 ng-* 属性值中
        const tag = getHtmlTagAt(docText, cursor);
        if (tag) {
            const attr = getTheAttrWhileCursorAtValue(tag, cursor);
            if (attr && attr.value && (isComponentTagName(tag.tagName) || isNgBuiltinDirective(attr.name.text))) {
                let prefix = attr.value.text.slice(0, cursor.at - attr.value.start);
                if (prefix && !isContainsNgFilter(prefix)) {
                    prefix = processPrefix(attr.name.text, prefix);
                    if (prefix) {
                        return await this.getComponentTypeCompletionItems(document, prefix, token);
                    }
                }
            }
        }
    }
    private async getControllerTypeCompletionItems({
        document,
        prefix,
        ctrlInfo,
        vscodeCancelToken,
    }: {
        document: TextDocument;
        prefix: string;
        ctrlInfo: NgCtrlInfo;
        vscodeCancelToken: CancellationToken;
    }): Promise<CompletionList<CompletionItem> | undefined> {
        const scriptFilePath = (await getCorrespondingScriptFileName(document, ctrlInfo.controllerName))!;

        if (!(await checkNgHelperServerRunning(scriptFilePath, this.port))) {
            return;
        }

        const res = await getControllerTypeCompletionApi({
            port: this.port,
            vscodeCancelToken,
            info: { fileName: scriptFilePath, prefix, ...ctrlInfo },
        });
        if (res) {
            return buildCompletionList(res);
        }
    }

    private async getComponentTypeCompletionItems(
        document: TextDocument,
        prefix: string,
        vscodeCancelToken: CancellationToken,
    ): Promise<CompletionList<CompletionItem> | undefined> {
        const scriptFilePath = (await getCorrespondingScriptFileName(document))!;

        if (!(await checkNgHelperServerRunning(scriptFilePath, this.port))) {
            return;
        }

        const res = await getComponentTypeCompletionApi({
            port: this.port,
            vscodeCancelToken,
            info: { fileName: scriptFilePath, prefix },
        });
        if (res) {
            return buildCompletionList(res);
        }
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

// 特殊处理:
// 输入：prefix = "{ 'class-name': ctrl."
// 输出：prefix = "ctrl."
function processPrefix(attrName: string, prefix: string): string {
    prefix = prefix.trim();
    if ((attrName === 'ng-class' || attrName === 'ng-style') && prefix.startsWith('{') && prefix.includes(':')) {
        return prefix.split(':').pop()!;
    }
    return prefix;
}

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
    if (!context.triggerCharacter && noRegisterTriggerChar) {
        return await getCtrlCompletion({ document, cursorAtInfo, port, vscodeCancelToken });
    } else if (context.triggerCharacter === '.') {
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

    if (cursorAtInfo.type === 'template') {
        const prefix = cursorAtInfo.template.slice(0, cursorAtInfo.relativeCursorAt + 1);
        // TODO: use ng-parser handle this
        if (prefix && !isContainsNgFilter(prefix)) {
            return await getTypeCompletionQuery({ document, ctrlInfo, prefix, port, vscodeCancelToken });
        }
    } else {
        if (isComponentTagName(cursorAtInfo.tagName) || isNgBuiltinDirective(cursorAtInfo.attrName)) {
            // TODO: 指令的属性也要走这个分支，需要考虑怎么去判断：当前属性是一个指令的属性
            let prefix = cursorAtInfo.attrValue.slice(0, cursorAtInfo.relativeCursorAt + 1);
            // TODO: use ng-parser handle this
            if (prefix && !isContainsNgFilter(prefix)) {
                prefix = processPrefix(cursorAtInfo.attrValue, prefix);
                if (prefix) {
                    return await getTypeCompletionQuery({ document, ctrlInfo, prefix, port, vscodeCancelToken });
                }
            }
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
        } else if (isComponentTagName(cursorAtInfo.tagName) || isNgBuiltinDirective(cursorAtInfo.attrName)) {
            // TODO: 指令的属性也要走这个分支，需要考虑怎么去判断：当前属性是一个指令的属性
            return await getComponentControllerAsCompletion(document, port, vscodeCancelToken);
        }
    } else {
        const ctrlInfo = getControllerNameInfo(cursorAtInfo.context);
        if (ctrlInfo && ctrlInfo.controllerAs) {
            return new CompletionList([new CompletionItem(ctrlInfo.controllerAs)], false);
        }
    }
}
